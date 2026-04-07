import { MAX_PLAYERS, MIN_PLAYERS_TO_START, PLAYER_COLORS, CHARACTERS } from './constants.js';

export class GameRoom {
    constructor(code, hostId, hostNickname, io) {
        this.code = code;
        this.hostId = hostId;
        this.io = io;

        // Map<socketId, playerInfo>
        this.players = new Map();
        this.players.set(hostId, {
            id: hostId,
            nickname: hostNickname,
            slotIndex: 0,
            character: CHARACTERS[0],
            color: PLAYER_COLORS[0],
            ready: true,
            isHost: true,
        });

        this.phase = 'lobby';
    }

    addPlayer(socketId, nickname) {
        if (this.phase !== 'lobby') return { success: false, error: 'Game already in progress' };
        if (this.players.size >= MAX_PLAYERS) return { success: false, error: 'Room is full' };
        if ([...this.players.values()].some(p => p.nickname === nickname)) { //name already exists, append some random number
            nickname = nickname + Math.floor(Math.random() * 100);
        }

        const slotIndex = this._nextFreeSlot();
        this.players.set(socketId, {
            id: socketId,
            nickname,
            slotIndex,
            character: CHARACTERS[slotIndex],
            color: PLAYER_COLORS[slotIndex],
            ready: false,
            isHost: false,
        });
        return { success: true };
    }

    _nextFreeSlot() {
        const usedSlots = new Set([...this.players.values()].map(p => p.slotIndex));
        for (let i = 0; i < MAX_PLAYERS; i++) {
            if (!usedSlots.has(i)) return i;
        }
        return this.players.size;
    }

    removePlayer(socketId) {
        const player = this.players.get(socketId);
        if (!player) return { wasHost: false, empty: false };

        this.players.delete(socketId);
        this._pendingMoves.delete(socketId);

        const empty = this.players.size === 0;
        let wasHost = player.isHost;

        if (!empty && wasHost && this.phase === 'lobby') {
            // Promote the first remaining player to host
            const newHost = this.players.values().next().value;
            newHost.isHost = true;
            this.hostId = newHost.id;
        }

        if (this.phase === 'game' && this.gameState) {
            const gp = this.gameState.players.get(socketId);
            if (gp) gp.alive = false;
            this._checkGamePause();
        }

        return { wasHost, empty };
    }

    _checkGamePause() {
        const alivePlayers = [...this.gameState.players.values()].filter(p => p.alive).length;
        if (alivePlayers < MIN_PLAYERS_TO_START) {
            const remaining = [...this.gameState.players.values()].find(p => p.alive);
            this.gameState.gameOver = true;
            this.gameState.winnerId = remaining ? remaining.id : null;
        }
    }

    toggleReady(socketId) {
        const player = this.players.get(socketId);
        if (player) player.ready = !player.ready;
    }

    selectCharacter(socketId, character) {
        const player = this.players.get(socketId);
        if (player && CHARACTERS.includes(character)) player.character = character;
    }
    
    startGame(socketId) {
        if (socketId !== this.hostId) return { success: false, error: 'Only host can start' };
        if (this.players.size < MIN_PLAYERS_TO_START) {
            return { success: false, error: 'Need at least 2 players' };
        }
        const notReady = [...this.players.values()].filter(p => !p.isHost && !p.ready);
        if (notReady.length > 0) return { success: false, error: 'All players must be ready' };

        this.phase = 'game';
        const mapSeed = Math.floor(Math.random() * 0xFFFFFF);

        // Sort players by slotIndex so their positions match slot order
        const playerIds = [...this.players.values()]
            .sort((a, b) => a.slotIndex - b.slotIndex)
            .map(p => p.id);

        this.gameState = new GameState(mapSeed, playerIds);
        this._startTickLoop();

        return { success: true, mapSeed, playerIds };
    }

    // Game Loop

    // Start 60 Hz tick loop
    _startTickLoop() {
        this._tickInterval = setInterval(() => this._tick(), TICK_MS);
    }

    _stopTickLoop() {
        if (this._tickInterval) {
            clearInterval(this._tickInterval);
            this._tickInterval = null;
        }
    }

    // One game tick: apply moves, advance state, broadcast updates
    _tick() {
        if (!this.gameState) return;

        const events = this.gameState.tick(this._pendingMoves);
        this._pendingMoves.clear();

        const serialized = this.gameState.serialize();

        this.io.to(this.code).emit('game_state_update', serialized);

        for (const explosion of events.explosions) {
            this.io.to(this.code).emit('explosion', explosion);
        }
        for (const elim of events.eliminated) {
            this.io.to(this.code).emit('player_eliminated', elim);
        }
        for (const pu of events.powerupCollections) {
            this.io.to(this.code).emit('power_up_collected', pu);
        }

        if (this.gameState.gameOver) {
            this._stopTickLoop();
            this.phase = 'results';
            const scoreboard = this._buildScoreboard();
            this.io.to(this.code).emit('game_over', {
                winnerId: this.gameState.winnerId,
                scoreboard,
            });
            if (this._onGameOver) {
                this._onGameOver(this.gameState.winnerId, this).catch(() => {});
            }
        }
    }

    serializeLobby() {
        return {
            code: this.code,
            hostId: this.hostId,
            phase: this.phase,
            players: [...this.players.values()].map(p => ({
                id: p.id,
                nickname: p.nickname,
                slotIndex: p.slotIndex,
                character: p.character,
                color: p.color,
                ready: p.ready,
                isHost: p.isHost,
            })),
        };
    }
}