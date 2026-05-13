# Replica Gather - Project Analysis

## 🚀 Overview
**Replica Gather** is a real-time, multiplayer virtual space application inspired by platforms like Gather.town. It allows users to browse a 2D map as avatars, interact with others via chat, and engage in proximity-based voice communication.

---

## 🛠️ Technology Stack

### Frontend (Client)
- **Framework**: React 19 (Vite + TypeScript)
- **Game Engine**: [Phaser 3](https://phaser.io/) (Handles the 2D rendering, maps, and player movement)
- **Real-time Communication**: 
  - `Socket.io-client` (State synchronization, movement, chat)
  - `simple-peer` (WebRTC for proximity-based audio/video calls)
- **Authentication**: Auth0 (with fallback for local manual login)
- **Styling**: Vanilla CSS with modern aesthetics

### Backend (Server)
- **Runtime**: Node.js (TypeScript via `tsx` or `ts-node`)
- **Server Framework**: Express 5
- **WebSocket Engine**: `Socket.io`
- **Database**: PostgreSQL (`pg` driver)
- **Security**: `bcryptjs` for local password hashing

### Infrastructure
- **Containerization**: Docker & Docker Compose (Production-ready multi-stage builds)
- **Reverse Proxy**: Nginx (configured for SSL and subdomains)
- **Deployment**: AWS (based on conversation history)

---

## 🏗️ Architecture

### Real-time Flow
1. **Connection**: User connects via Socket.io and joins a specific room.
2. **State Sync**: Server broadcasts `newPlayer` to others and `currentPlayers` to the newcomer.
3. **Movement**: Frontend captures arrow/WASD input -> updates Phaser local sprite -> emits `playerMovement` -> Server broadcasts `playerMoved` to others in the same room.
4. **Proximity**: Frontend calculates distance between players. If close enough, it initiates a WebRTC peer connection for audio.

### Data Persistence
- **Room Persistence**: The server saves the player's last (X, Y) coordinates in PostgreSQL on disconnect.
- **Message History**: All chat messages (global and private) are stored in `replica_messages` and fetched upon joining a room.
- **Profiles**: Player names, pictures, and customization options (skin, hair, outfit) are persistent.

---

## 🗄️ Database Schema

The system uses a PostgreSQL database with several key tables:

- **`replica_users`**: Stores user identity, hashed passwords (for local auth), profile links, and last-known location/room.
- **`replica_messages`**: Stores chat history with support for private messaging (`target_to`).
- **`replica_space_settings`**: Stores configuration for specific rooms (e.g., custom home names).

---

## ✨ Key Features

1.  **Multiplayer Sync**: Smooth interpolation of other players' movements using Phaser.
2.  **Profile Customization**: Detailed avatar editing (Gender, Skin Color, Hair Style/Color, Outfit Color).
3.  **Chat System**: 
    - Real-time global broadcasting.
    - Private messaging with "read" status tracking.
    - Persistent history (last 100 messages).
4.  **Proximity Audio**: Audio interaction that activates only when avatars are physically near each other in the game world.
5.  **Persistent World**: Users return to their exact last location upon re-login.

---

## 📂 Project Structure

```text
replica_gather/
├── client/                 # React + Phaser + Socket.io Client
│   ├── src/
│   │   ├── components/     # UI Overlays (Chat, Profile, Auth)
│   │   ├── game/           # Phaser Scene & Character Logic
│   │   └── hooks/          # React custom hooks (e.g., Proximity logic)
├── server/                 # Node.js + Socket.io Server
│   ├── src/
│   │   ├── db/             # PG Pool & Schema Initialization
│   │   └── index.ts        # Main Server Logic / Socket Events
├── deploy/                 # Nginx/Certbot configs
└── docker-compose.yml      # Orchestration for App + DB
```

---

## 📍 Environment Variables
- `DATABASE_URL`: PostgreSQL connection string.
- `CORS_ORIGINS`: Allowed frontend domains.
- `PORT`: Server listening port (default 3001).
- `VITE_API_URL`: (Client-side) Backend API endpoint.
