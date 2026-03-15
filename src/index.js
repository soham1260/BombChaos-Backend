import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

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

// REST health check
app.get('/health', (_req, res) => res.json({ status: 'ok', rooms: rooms.size }));

// Socket Events
io.on('connection', (socket) => {
    console.log(`[+] Connected: ${socket.id}`);
});

// Start
httpServer.listen(PORT, () => {
    console.log(`🚀 BOMB CHAOS server running on http://localhost:${PORT}`);
});
