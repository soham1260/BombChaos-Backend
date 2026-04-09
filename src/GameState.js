import {
    PLAYER_COLORS,CHARACTERS,MAX_PLAYERS,MIN_PLAYERS_TO_START
} from './constants.js';

function mulberry32(seed) {
    return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

const ALL_POWERUPS = Object.values(POWERUP_TYPE);

export class GameState {
    
    constructor(mapSeed, playerIds) {
        this.mapSeed = mapSeed;
        this.rng = mulberry32(mapSeed);

        // 2D array [y][x] of TILE values 
        this.grid = this._generateGrid();

        // Map of playerId -> player object 
        this.players = new Map();

        // Map of bombId -> bomb object 
        this.bombs = new Map();
        this._bombCounter = 0;

        // Map of {x,y} -> fire object { ticksLeft } 
        this.fires = new Map();

        // Map of {x,y} -> powerup type string 
        this.powerups = new Map();

        this.tickCount = 0;
        this.gameOver = false;
        this.winnerId = null;

        // Initialize players at spawn positions
        playerIds.forEach((id, i) => {
            const spawn = SPAWN_POSITIONS[i];
            this.players.set(id, {
                id,
                slotIndex: i,
                x: spawn.x * TILE_SIZE + TILE_SIZE / 2, // pixel values
                y: spawn.y * TILE_SIZE + TILE_SIZE / 2,
                tileX: spawn.x, // actual tile index the pixel coresponds to
                tileY: spawn.y,
                alive: true,
                stats: { ...DEFAULT_PLAYER_STATS },
                activeBombs: 0,
                kills: 0,
                bombsPlaced: 0,
                powerupsCollected: 0,
                survivalTicks: 0,
                dx: 0,
                dy: 0,
            });
        });
    }

    // Generates the 15x13 grid with indestructible walls and soft blocks.
    _generateGrid() {
        const grid = [];
        for (let y = 0; y < GRID_HEIGHT; y++) {
            const row = [];
            for (let x = 0; x < GRID_WIDTH; x++) {
                if (x === 0 || x === GRID_WIDTH - 1 || y === 0 || y === GRID_HEIGHT - 1) { // make border as wall
                    row.push(TILE.WALL);
                } else if (x % 2 === 0 && y % 2 === 0) { // make inner grid as wall
                    row.push(TILE.WALL);
                } else if (this._isSpawnSafe(x, y)) { // make spawn positions and two tile radius around it as empty
                    row.push(TILE.EMPTY);
                } else {
                    row.push(this.rng() < 0.60 ? TILE.SOFT : TILE.EMPTY);
                }
            }
            grid.push(row);
        }
        return grid;
    }

    // Returns true if tile should be kept empty for spawn safety (2-tile radius from corners).
    _isSpawnSafe(x, y) {
        for (const sp of SPAWN_POSITIONS) {
            if (Math.abs(x - sp.x) + Math.abs(y - sp.y) <= 2) return true;
        }
        return false;
    }

    placeBomb(playerId) {
        const player = this.players.get(playerId);
        if (!player || !player.alive) return null;
        if (player.activeBombs >= player.stats.maxBombs) return null;

        const tx = player.tileX;
        const ty = player.tileY;

        // Check no bomb already here
        for (const bomb of this.bombs.values()) {
            if (bomb.x === tx && bomb.y === ty) return null;
        }

        const bombId = `bomb_${++this._bombCounter}`;
        const bomb = {
            id: bombId,
            ownerId: playerId,
            x: tx,
            y: ty,
            range: player.stats.bombRange,
            ticksLeft: BOMB_FUSE_TICKS,
            piercingFlame: player.stats.hasPiercingFlame,
        };
        this.bombs.set(bombId, bomb);
        player.activeBombs++;
        player.bombsPlaced++;
        return bomb;
    }

    detonateRemote(playerId, events) {
        const player = this.players.get(playerId);
        if (!player || !player.stats.hasRemoteBomb) return;
        // Detonate the OLDEST bomb belonging to this player
        for (const [bombId, bomb] of this.bombs) {
            if (bomb.ownerId === playerId) {
                this._detonateBomb(bombId, events);
                break;
            }
        }
    }

    _applyMovement(playerMoves) {
        const dt = 1 / 60; // seconds per tick
        const RADIUS = Math.floor(TILE_SIZE * 0.50);

        for (const [id, move] of playerMoves) {
            const player = this.players.get(id);
            if (!player || !player.alive) continue;

            const speed = player.stats.speed * TILE_SIZE * dt;

            // Candidate new positions
            const nx = player.x + move.dx * speed;
            const ny = player.y + move.dy * speed;

            // Check whether a circular bounding box of RADIUS at (px, py)
            const collidesAt = (px, py) => {
                const r = RADIUS - 1;
                const corners = [
                    [Math.floor((px - r) / TILE_SIZE), Math.floor((py - r) / TILE_SIZE)],
                    [Math.floor((px + r) / TILE_SIZE), Math.floor((py - r) / TILE_SIZE)],
                    [Math.floor((px - r) / TILE_SIZE), Math.floor((py + r) / TILE_SIZE)],
                    [Math.floor((px + r) / TILE_SIZE), Math.floor((py + r) / TILE_SIZE)],
                ];
                return corners.some(([cx, cy]) => this._isSolidAt(cx, cy));
            };

            const clampX = (v) => Math.max(TILE_SIZE + RADIUS, Math.min((GRID_WIDTH - 1) * TILE_SIZE - RADIUS, v));
            const clampY = (v) => Math.max(TILE_SIZE + RADIUS, Math.min((GRID_HEIGHT - 1) * TILE_SIZE - RADIUS, v));

            const canX = !collidesAt(clampX(nx), player.y);
            const canY = !collidesAt(player.x, clampY(ny));

            if (canX) player.x = clampX(nx);
            if (canY) player.y = clampY(ny);

            player.tileX = Math.floor(player.x / TILE_SIZE);
            player.tileY = Math.floor(player.y / TILE_SIZE);
        }
    }

    _isSolidAt(x, y) {
        if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return true;
        const t = this.grid[y][x];
        return t === TILE.WALL || t === TILE.SOFT;
    }

    // Tick down bomb fuses, detonate expired bombs
    _tickBombs(events) {
        for (const [bombId, bomb] of this.bombs) {
            bomb.ticksLeft--;
            if (bomb.ticksLeft <= 0) {
                this._detonateBomb(bombId, events);
            }
        }
    }
    
    _detonateBomb(bombId, events) {
        const bomb = this.bombs.get(bombId);
        if (!bomb) return;
        this.bombs.delete(bombId);

        const owner = this.players.get(bomb.ownerId);
        if (owner) owner.activeBombs = Math.max(0, owner.activeBombs - 1);

        const affectedCells = [{ x: bomb.x, y: bomb.y }];
        const piercingFlame = bomb.piercingFlame;

        // Spread in 4 directions
        for (const dir of Object.values(DIRECTIONS)) {
            for (let i = 1; i <= bomb.range; i++) {
                const cx = bomb.x + dir.dx * i;
                const cy = bomb.y + dir.dy * i;
                if (cx < 0 || cx >= GRID_WIDTH || cy < 0 || cy >= GRID_HEIGHT) break;
                const tile = this.grid[cy][cx];
                if (tile === TILE.WALL) break;
                affectedCells.push({ x: cx, y: cy });
                if (tile === TILE.SOFT) {
                    this.grid[cy][cx] = TILE.EMPTY;
                    // spawn power-up
                    if (Math.random() < POWERUP_DROP_CHANCE) {
                        const puType = ALL_POWERUPS[Math.floor(Math.random() * ALL_POWERUPS.length)];
                        this.powerups.set(`${cx},${cy}`, puType);
                    }
                    if (!piercingFlame) break;
                }
            }
        }

        // Place fire on affected cells, chain detonate other bombs
        for (const cell of affectedCells) {
            const key = `${cell.x},${cell.y}`;
            this.fires.set(key, { x: cell.x, y: cell.y, ticksLeft: FIRE_DURATION_TICKS });
            // Chain reaction
            for (const [otherId, other] of this.bombs) {
                if (other.x === cell.x && other.y === cell.y) {
                    this._detonateBomb(otherId, events);
                }
            }
        }

        events.explosions.push({ bombId, x: bomb.x, y: bomb.y, cells: affectedCells });
    }

    tick(playerMoves) {
        if (this.gameOver) return { explosions: [], eliminated: [], powerupCollections: [] };

        this.tickCount++;
        const events = { explosions: [], eliminated: [], powerupCollections: [] };

        this._applyMovement(playerMoves);

        this._tickBombs(events);

        this._tickFires();

        this._checkFireCollisions(events);

        this._checkPowerupCollection(events);

        for (const player of this.players.values()) {
            if (player.alive) player.survivalTicks++;
        }

        this._checkWinCondition();

        return events;
    }

    serialize() {
        return {
            tickCount: this.tickCount,
            grid: this.grid,
            players: [...this.players.values()].map(p => ({
                id: p.id,
                slotIndex: p.slotIndex,
                x: p.x,
                y: p.y,
                alive: p.alive,
                stats: p.stats,
                activeBombs: p.activeBombs,
                kills: p.kills,
                bombsPlaced: p.bombsPlaced,
                powerupsCollected: p.powerupsCollected,
            })),
            bombs: [...this.bombs.values()],
            fires: [...this.fires.values()],
            powerups: [...this.powerups.entries()].map(([key, type]) => {
                const [x, y] = key.split(',').map(Number);
                return { x, y, type };
            }),
            gameOver: this.gameOver,
            winnerId: this.winnerId,
        };
    }
}
