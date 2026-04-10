import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameRoom } from './GameRoom.js';

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Map<roomCode, GameRoom>
const rooms = new Map();

// Map<socketId, roomCode> — track which room each socket is in
const socketRoom = new Map();

// Utility

// Generate a cryptographically-adequate 6-char uppercase room code
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
        code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    } while (rooms.has(code));
    return code;
}

// Broadcast updated lobby state to everyone in a room.
function broadcastRoomUpdate(room) {
    io.to(room.code).emit('room_update', room.serializeLobby());
}

// REST health check
app.get('/health', (_req, res) => res.json({ status: 'ok', rooms: rooms.size }));

// Socket.io Events
io.on('connection', (socket) => {
    console.log(`Connected: ${socket.id}`);

    // create_room
    socket.on('create_room', ({ nickname } = {}, ack) => {
        if (!nickname || typeof nickname !== 'string' || nickname.trim().length === 0) {
            return ack?.({ success: false, error: 'Invalid nickname' });
        }
        const code = generateRoomCode();
        const room = new GameRoom(code, socket.id, nickname.trim().slice(0, 20), io);
        rooms.set(code, room);
        socketRoom.set(socket.id, code);

        socket.join(code);
        broadcastRoomUpdate(room);
        console.log(`[Room] ${code} created by ${socket.id}`);
        ack?.({ success: true, code });
    });

    // join_room
    socket.on('join_room', ({ code, nickname } = {}, ack) => {
        if (!code || !nickname) return ack?.({ success: false, error: 'Missing fields' });
        const upperCode = code.toUpperCase();
        const room = rooms.get(upperCode);
        if (!room) return ack?.({ success: false, error: 'Room not found' });

        const result = room.addPlayer(socket.id, nickname.trim().slice(0, 20));
        if (!result.success) return ack?.({ success: false, error: result.error });

        socketRoom.set(socket.id, upperCode);
        socket.join(upperCode);
        broadcastRoomUpdate(room);
        console.log(`[Room] ${socket.id} joined ${upperCode}`);
        ack?.({ success: true, code: upperCode });
    });

    // player_ready
    socket.on('player_ready', () => {
        const room = _getRoom(socket.id);
        if (!room || room.phase !== 'lobby') return;
        room.toggleReady(socket.id);
        broadcastRoomUpdate(room);
    });

    // select_character
    socket.on('select_character', ({ character } = {}) => {
        const room = _getRoom(socket.id);
        if (!room || room.phase !== 'lobby') return;
        room.selectCharacter(socket.id, character);
        broadcastRoomUpdate(room);
    });

    // start_game
    socket.on('start_game', (_, ack) => {
        const room = _getRoom(socket.id);
        if (!room) return ack?.({ success: false, error: 'Not in a room' });

        const result = room.startGame(socket.id);
        if (!result.success) return ack?.({ success: false, error: result.error });

        io.to(room.code).emit('game_start', {
            mapSeed: result.mapSeed,
            playerIds: result.playerIds,
            players: room.serializeLobby().players,
        });
        console.log(`[Game] Room ${room.code} started with seed ${result.mapSeed}`);
        ack?.({ success: true });
    });

    function _getRoom(socketId) {
        const code = socketRoom.get(socketId);
        return code ? rooms.get(code) : null;
    }

    // player_move
    socket.on('player_move', (move) => {
        const room = _getRoom(socket.id);
        if (!room || room.phase !== 'game') return;
        room.queueMove(socket.id, move);
    });

    // place_bomb
    socket.on('place_bomb', () => {
        const room = _getRoom(socket.id);
        if (!room || room.phase !== 'game') return;
        const bomb = room.placeBomb(socket.id);
        if (bomb) {
            io.to(room.code).emit('bomb_placed', bomb);
        }
    });

    // detonate_bomb
    socket.on('detonate_bomb', () => {
        const room = _getRoom(socket.id);
        if (!room || room.phase !== 'game') return;
        room.detonateRemote(socket.id);
    });

    // return_to_lobby
    socket.on('return_to_lobby', () => {
        const room = _getRoom(socket.id);
        if (!room) return;
        if (socket.id !== room.hostId) return;
        room.phase = 'lobby';
        room.gameState = null;
        for (const player of room.players.values()) {
            player.ready = false;
        }
        broadcastRoomUpdate(room);
        console.log(`[Room] ${room.code} returned to lobby`);
    });

    // leave_room
    socket.on('leave_room', () => {
        const room = _getRoom(socket.id);
        if (!room) return;

        const { empty } = room.removePlayer(socket.id);
        socketRoom.delete(socket.id);
        socket.leave(room.code);

        if (empty) {
            rooms.delete(room.code);
            console.log(`[Room] ${room.code} destroyed (empty after leave)`);
        } else {
            broadcastRoomUpdate(room);
            console.log(`[Room] ${socket.id} voluntarily left ${room.code}`);
        }
    });

    // chat_message
    socket.on('chat_message', ({ text } = {}) => {
        const room = _getRoom(socket.id);
        if (!room || !text || typeof text !== 'string') return;
        const player = room.players.get(socket.id);
        if (!player) return;
        io.to(room.code).emit('chat_message', {
            nickname: player.nickname,
            color: player.color,
            text: text.trim().slice(0, 200),
            timestamp: Date.now(),
        });
    });

    socket.on('disconnect', () => {
        console.log(`Disconnected: ${socket.id} (${socket.user?.username})`);
        const room = _getRoom(socket.id);
        if (!room) return;

        const { empty } = room.removePlayer(socket.id);
        socketRoom.delete(socket.id);

        if (empty) {
            rooms.delete(room.code);
            console.log(`[Room] ${room.code} destroyed (empty)`);
        } else {
            broadcastRoomUpdate(room);
        }
    });
});

// Start
httpServer.listen(PORT, () => {
    console.log(`BOMB CHAOS server running on http://localhost:${PORT}`);
});
