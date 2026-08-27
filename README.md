# Gather Replica

A real-time 2D virtual space built with React, Phaser.js, Socket.io, and PostgreSQL.

## Features
- **Real-time Movement**: Tiled grid-based movement with smooth animations.
- **Persistent Profiles**: Edit your name and profile image (via URL or local upload).
- **Session Persistence**: Stay logged in for up to 30 days.
- **Proximity Chat**: Interact with others in the space.
- **Database Persistence**: User profiles and positions are saved in PostgreSQL.

## Tech Stack
- **Frontend**: React, Vite, Phaser 3, Socket.io-client, Auth0.
- **Backend**: Node.js, Express, Socket.io, PostgreSQL.

## Prerequisites
- Node.js (v18+)
- PostgreSQL (v14+)
- Auth0 Account

## Setup

### 1. Database Setup
Create a PostgreSQL database named `replica_gather`:
```sql
CREATE DATABASE replica_gather;
```

### 2. Backend Configuration
Navigate to the `server` directory and create a `.env` file:
```env
PORT=3001
DATABASE_URL=postgres://your_user:your_password@localhost:5432/replica_gather
CORS_ORIGINS=http://localhost:5173
```
Install dependencies and start:
```bash
npm install
npm run dev
```

### 3. Frontend Configuration
Navigate to the `client` directory and install dependencies:
```bash
npm install
npm run dev
```

## Git Workflow
- All features are developed in feature branches.
- `main` branch is reserved for stable production code.
