import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db/pool.js';
import { initDb } from './db/init.js';

dotenv.config();

// Version: 1.0.1 - Universal Standard

const app = express();
const origins = process.env.CORS_ORIGINS?.split(',') || ["http://localhost:5173", "http://localhost:5174"];

app.use(cors({ origin: origins }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: origins,
        methods: ["GET", "POST"]
    }
});

interface Player {
    x: number;
    y: number;
    id: string; // Socket ID
    userId: string; // Auth0 Sub
    name: string;
    picture: string;
    room: string;
}

// In-memory store for active connections
const activePlayers: Record<string, Player> = {};

const PORT = process.env.PORT || 3001;

// Initialize Database and Start Server
const startServer = async () => {
    try {
        await initDb();

        server.listen(PORT, () => {
            console.log(`Server listening on port ${PORT}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
};

startServer();

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinRoom', async (data: { room: string, name: string, picture?: string, userId: string, email?: string }) => {
        console.log('Received joinRoom data:', data);
        if (!data || !data.userId) {
            console.warn('joinRoom received invalid data:', data);
            return;
        }
        const { room, name, picture, userId, email } = data;

        socket.join(room);

        let playerData: Partial<Player> = {
            x: 380,
            y: 300,
            name: name || 'Guest',
            picture: picture || ''
        };

        try {
            // Upsert user in Postgres
            const res = await pool.query(
                `INSERT INTO replica_users (id, name, email, picture, room) 
                 VALUES ($1, $2, $3, $4, $5) 
                 ON CONFLICT (id) DO UPDATE 
                 SET name = EXCLUDED.name, email = EXCLUDED.email, picture = EXCLUDED.picture, room = EXCLUDED.room
                 RETURNING last_x, last_y, name, picture`,
                [userId, name, email, picture, room]
            );

            if (res.rows[0]) {
                const dbUser = res.rows[0];
                playerData = {
                    x: dbUser.last_x,
                    y: dbUser.last_y,
                    name: dbUser.name,
                    picture: dbUser.picture
                };
            }
        } catch (err: any) {
            console.error('Database Error in joinRoom:', err.message);
            // We continue with default playerData so the user can still play
        }

        const newPlayer: Player = {
            x: playerData.x!,
            y: playerData.y!,
            id: socket.id,
            userId: userId,
            name: playerData.name!,
            picture: playerData.picture!,
            room: room
        };

        activePlayers[socket.id] = newPlayer;

        // Filter players by room
        const roomPlayers: Record<string, Player> = {};
        Object.keys(activePlayers).forEach(id => {
            const p = activePlayers[id];
            if (p && p.room === room) {
                roomPlayers[id] = p;
            }
        });

        // Sync with client
        socket.emit('currentPlayers', roomPlayers);
        socket.to(room).emit('newPlayer', newPlayer);

        console.log(`User ${newPlayer.name} (${userId}) joined room: ${room}`);
    });

    socket.on('playerMovement', async (movementData: { x: number, y: number }) => {
        if (!movementData) return;
        const player = activePlayers[socket.id];
        if (player) {
            player.x = movementData.x;
            player.y = movementData.y;

            // Broadcast movement
            socket.to(player.room).emit('playerMoved', player);

            // Persist position occasionally or on disconnect is better for performance, 
            // but for "universal standard" we might want to update DB on some interval.
            // For now, let's keep it in memory and save on disconnect.
        }
    });

    socket.on('updateProfile', async (data: { name: string, picture: string }) => {
        const player = activePlayers[socket.id];
        if (player) {
            player.name = data.name;
            player.picture = data.picture;

            try {
                // Persist to Postgres
                await pool.query(
                    `UPDATE replica_users SET name = $1, picture = $2 WHERE id = $3`,
                    [data.name, data.picture, player.userId]
                );

                // Broadcast update
                io.to(player.room).emit('profileUpdated', player);
            } catch (err) {
                console.error('Error updating profile in DB:', err);
            }
        }
    });

    socket.on('chatMessage', (data: any) => {
        const player = activePlayers[socket.id];
        if (player) {
            const isObject = typeof data === 'object' && data !== null;
            const message = isObject ? data.message : data;
            const targets = isObject ? data.targets : null;

            const payload = {
                id: socket.id,
                name: player.name,
                message: message,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isProximity: !!(targets && targets.length > 0)
            };

            if (targets && targets.length > 0) {
                // Send to specifically targeted players in proximity
                targets.forEach((targetId: string) => {
                    io.to(targetId).emit('newMessage', payload);
                });
                // Also send back to self if not already in targets
                if (!targets.includes(socket.id)) {
                    socket.emit('newMessage', payload);
                }
            } else {
                // Global room chat
                io.to(player.room).emit('newMessage', payload);
            }
        }
    });

    socket.on('disconnect', async () => {
        const player = activePlayers[socket.id];
        if (player) {
            console.log('User disconnected:', player.name);

            try {
                // Save last position on disconnect
                await pool.query(
                    `UPDATE replica_users SET last_x = $1, last_y = $2 WHERE id = $3`,
                    [player.x, player.y, player.userId]
                );
            } catch (err) {
                console.error('Error saving position on disconnect:', err);
            }

            io.to(player.room).emit('playerDisconnected', socket.id);
            delete activePlayers[socket.id];
        }
    });
});

