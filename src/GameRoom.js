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

        this.phase = 'lobby'; // always 'lobby' for now
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