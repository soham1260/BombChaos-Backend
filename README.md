# Bomb Chaos Backend

Bomb Chaos Backend is the real-time multiplayer server for the Bomb Chaos game. It manages room creation, player joins, lobby synchronization, game state updates, bomb placement, explosions, and match completion using Node.js, Express, and Socket.IO.

## Overview

This service is responsible for:

- running the HTTP server
- handling Socket.IO multiplayer events
- creating and destroying game rooms
- managing lobby state and player readiness
- running the game loop and match state updates
- broadcasting real-time events to connected clients

## Features

- Express server with a simple health endpoint
- Socket.IO based multiplayer communication
- room creation and room join flow
- lobby synchronization for up to 4 players
- host-controlled game start
- in-memory room and match management
- tick-based gameplay loop
- bomb placement, explosions, eliminations, and power-up events

## Tech Stack

- Node.js
- Express
- Socket.IO
- CORS
- UUID
- Nodemon for local development

## Project Structure

```text
BombChaos-Backend/
├── src/
│   ├── config/          # Database-related utilities
│   ├── middleware/      # Auth middleware
│   ├── models/          # Data models
│   ├── routes/          # API routes
│   ├── constants.js     # Game constants
│   ├── GameRoom.js      # Room and lobby management
│   ├── GameState.js     # Core gameplay state logic
│   └── index.js         # Server entrypoint
└── package.json
```

## Prerequisites

- Node.js 18 or newer
- npm 9 or newer

## Installation

1. Move into the backend folder:

```bash
cd BombChaos-Backend
```

2. Install dependencies:

```bash
npm install
```

3. Optionally create a `.env` file:

```env
PORT=3001
```

If `PORT` is not set, the server runs on `3001`.

## Available Scripts

### `npm run dev`

Starts the backend with `nodemon` for development.

### `npm start`

Starts the backend with Node.js.

## Running The Server Locally

Start the server:

```bash
npm run dev
```

The backend will be available at:

```text
http://localhost:3001
```

## Health Check

You can verify the server is running with:

```bash
curl http://localhost:3001/health
```

Expected response shape:

```json
{
  "status": "ok",
  "rooms": 0
}
```

## Main Real-Time Events

The current server handles events such as:

- `create_room`
- `join_room`
- `player_ready`
- `select_character`
- `start_game`
- `player_move`
- `place_bomb`
- `detonate_bomb`
- `chat_message`
- `leave_room`
- `return_to_lobby`

## Environment Variables

| Variable | Required | Description | Default |
| --- | --- | --- | --- |
| `PORT` | No | Port used by the backend server | `3001` |

## Current Architecture Notes

- The active server stores room and match state in memory.
- Restarting the backend clears active rooms and ongoing games.
- CORS is currently open to all origins in the server entrypoint.

## Auth And Database Notes

This repository also contains auth and MongoDB-related files, including:

- JWT middleware
- auth route files
- a Mongoose user model
- a MongoDB connection helper

At the moment, those pieces are present in the codebase but are not actively wired into the current `src/index.js` startup path. That means the multiplayer server can run locally without MongoDB, but auth-related functionality will need additional backend wiring before it is fully operational.

## Frontend Integration

The frontend should point to this backend using:

```env
VITE_SERVER_URL=http://localhost:3001
```

If you deploy the backend somewhere else, update the frontend environment configuration to match.

## Notes

- No automated backend test script is currently defined in `package.json`.
- The current multiplayer flow is centered on local or direct server connectivity rather than persistent hosted room storage.
