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