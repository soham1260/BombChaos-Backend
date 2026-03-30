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
