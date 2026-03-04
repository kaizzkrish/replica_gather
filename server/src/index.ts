import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db/pool.js';
import { initDb } from './db/init.js';

dotenv.config();

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

// Initialize Database
initDb();

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinRoom', async (data: { room: string, name: string, picture?: string, userId: string, email?: string }) => {
        if (!data || !data.userId) return;
        const { room, name, picture, userId, email } = data;

        socket.join(room);

        try {
            // Upsert user in Postgres
            const res = await pool.query(
                `INSERT INTO users (id, name, email, picture, room) 
                 VALUES ($1, $2, $3, $4, $5) 
                 ON CONFLICT (id) DO UPDATE 
                 SET name = EXCLUDED.name, email = EXCLUDED.email, picture = EXCLUDED.picture, room = EXCLUDED.room
                 RETURNING last_x, last_y, name, picture`,
                [userId, name, email, picture, room]
            );

            const dbUser = res.rows[0];

            const newPlayer: Player = {
                x: dbUser.last_x,
                y: dbUser.last_y,
                id: socket.id,
                userId: userId,
                name: dbUser.name,
                picture: dbUser.picture,
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

            console.log(`User ${dbUser.name} (${userId}) joined room: ${room}`);
        } catch (err) {
            console.error('Error in joinRoom:', err);
        }
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
                    `UPDATE users SET name = $1, picture = $2 WHERE id = $3`,
                    [data.name, data.picture, player.userId]
                );

                // Broadcast update
                io.to(player.room).emit('profileUpdated', player);
            } catch (err) {
                console.error('Error updating profile in DB:', err);
            }
        }
    });

    socket.on('chatMessage', (message: string) => {
        const player = activePlayers[socket.id];
        if (player) {
            io.to(player.room).emit('newMessage', {
                id: socket.id,
                name: player.name,
                message: message,
                timestamp: new Date().toLocaleTimeString()
            });
        }
    });

    socket.on('disconnect', async () => {
        const player = activePlayers[socket.id];
        if (player) {
            console.log('User disconnected:', player.name);

            try {
                // Save last position on disconnect
                await pool.query(
                    `UPDATE users SET last_x = $1, last_y = $2 WHERE id = $3`,
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

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
