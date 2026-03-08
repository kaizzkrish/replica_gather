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
    customization?: any;
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
        if (!data || !data.userId) return;
        const { room, name, picture, userId, email } = data;
        socket.join(room);

        let playerData: Partial<Player> = {
            x: 380, y: 300, name: name || 'Explorer', picture: picture || '',
            customization: { skinColor: '#ffdbac', hairColor: '#4b2c20', hairStyle: 'default', outfitColor: '#646cff', outfitId: 'basic' }
        };
        try {
            // Priority 1: Check if user already exists in DB to avoid Auth0 overwriting manual edits
            const existingRes = await pool.query(`SELECT * FROM replica_users WHERE id = $1`, [userId]);

            if (existingRes.rows.length > 0) {
                // User exists - Use DB data (Source of Truth)
                const dbUser = existingRes.rows[0];
                playerData = {
                    x: dbUser.last_x,
                    y: dbUser.last_y,
                    name: dbUser.name,
                    picture: dbUser.picture,
                    customization: dbUser.customization
                };

                // If DB has no picture but Auth0 has one (e.g. initial run after schema wipe)
                if ((!dbUser.picture || dbUser.picture === '') && picture) {
                    await pool.query(`UPDATE replica_users SET picture = $1 WHERE id = $2`, [picture, userId]);
                    playerData.picture = picture;
                }

                // Just update last_seen and room
                await pool.query(`UPDATE replica_users SET last_seen = NOW(), room = $1 WHERE id = $2`, [room, userId]);
            } else {
                // New User - Insert from Auth0 data
                const insertRes = await pool.query(
                    `INSERT INTO replica_users (id, name, email, picture, room, last_seen) 
                     VALUES ($1, $2, $3, $4, $5, NOW()) 
                     RETURNING last_x, last_y`,
                    [userId, name, email, picture, room]
                );
                if (insertRes.rows[0]) {
                    playerData.x = insertRes.rows[0].last_x;
                    playerData.y = insertRes.rows[0].last_y;
                }
            }
        } catch (err: any) { console.error('DB joinRoom:', err.message); }

        const newPlayer: Player = {
            x: playerData.x!, y: playerData.y!, id: socket.id,
            userId: userId, name: playerData.name!, picture: playerData.picture!, room: room,
            customization: playerData.customization
        };
        activePlayers[socket.id] = newPlayer;

        // Sync local user's view with their persistent DB data (rather than Auth0 fallback)
        socket.emit('profileSync', { userId, name: newPlayer.name, picture: newPlayer.picture, customization: newPlayer.customization });

        // Broadcast status
        io.to(room).emit('userStatusChange', { userId, isOnline: true, lastSeen: new Date() });

        // Fetch History
        try {
            const historyRes = await pool.query(
                `SELECT m.*, u.name as sender_name, u.picture as sender_picture 
                 FROM replica_messages m 
                 JOIN replica_users u ON m.sender_id = u.id
                 WHERE m.room = $1 AND (m.target_to = 'global' OR m.target_to = $2 OR m.sender_id = $2)
                 ORDER BY m.created_at ASC LIMIT 100`,
                [room, userId]
            );
            socket.emit('chatHistory', historyRes.rows.map(row => ({
                id: row.sender_id === userId ? socket.id : 'persistent-' + row.sender_id,
                senderUserId: row.sender_id,
                name: row.sender_name,
                picture: row.sender_picture, // Crucial: send picture from DB
                message: row.message,
                timestamp: new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                to: row.target_to,
                isRead: row.is_read
            })));
        } catch (err) { console.error('Fetch History Error:', err); }

        // Sync Players
        const roomPlayers: Record<string, Player> = {};
        Object.keys(activePlayers).forEach(id => {
            const p = activePlayers[id];
            if (p && p.room === room) roomPlayers[id] = p;
        });

        socket.emit('currentPlayers', roomPlayers);
        socket.to(room).emit('newPlayer', newPlayer);
    });

    socket.on('requestChatHistory', async () => {
        const player = activePlayers[socket.id];
        if (!player) return;
        try {
            const historyRes = await pool.query(
                `SELECT m.*, u.name as sender_name, u.picture as sender_picture 
                 FROM replica_messages m 
                 JOIN replica_users u ON m.sender_id = u.id
                 WHERE m.room = $1 AND (m.target_to = 'global' OR m.target_to = $2 OR m.sender_id = $2)
                 ORDER BY m.created_at ASC LIMIT 100`,
                [player.room, player.userId]
            );
            socket.emit('chatHistory', historyRes.rows.map(row => ({
                id: row.sender_id === player.userId ? socket.id : 'persistent-' + row.sender_id,
                senderUserId: row.sender_id,
                name: row.sender_name,
                picture: row.sender_picture,
                message: row.message,
                timestamp: new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                to: row.target_to,
                isRead: row.is_read
            })));
        } catch (err) { console.error('requestChatHistory Error:', err); }
    });

    socket.on('markAsRead', async (data: { partnerUserId: string }) => {
        const player = activePlayers[socket.id];
        if (player && data.partnerUserId) {
            try {
                await pool.query(
                    `UPDATE replica_messages SET is_read = true 
                     WHERE target_to = $1 AND sender_id = $2 AND is_read = false`,
                    [player.userId, data.partnerUserId]
                );
                // Optionally notify the sender that it was read
                const partnerSocket = Object.values(activePlayers).find(p => p.userId === data.partnerUserId);
                if (partnerSocket) {
                    io.to(partnerSocket.id).emit('messagesMarkedRead', { by: player.userId });
                }
            } catch (err) { console.error('Mark Read Error:', err); }
        }
    });

    socket.on('playerMovement', async (movementData: { x: number, y: number, animationKey?: string }) => {
        if (!movementData) return;
        const player = activePlayers[socket.id];
        if (player) {
            player.x = movementData.x;
            player.y = movementData.y;
            socket.to(player.room).emit('playerMoved', { ...player, animationKey: movementData.animationKey });
        }
    });

    socket.on('updateProfile', async (data: { name: string, picture: string, customization?: any }) => {
        const player = activePlayers[socket.id];
        if (player) {
            player.name = data.name;
            player.picture = data.picture;
            if (data.customization) player.customization = data.customization;

            try {
                await pool.query(
                    `UPDATE replica_users SET name = $1, picture = $2, customization = $3 WHERE id = $4`,
                    [data.name, data.picture, JSON.stringify(player.customization), player.userId]
                );
                io.to(player.room).emit('profileUpdated', player);
            } catch (err) { console.error('Update Profile Error:', err); }
        }
    });

    socket.on('chatMessage', async (data: any) => {
        const player = activePlayers[socket.id];
        if (player) {
            const isObject = typeof data === 'object' && data !== null;
            const message = isObject ? data.message : data;
            const to = isObject ? (data.to || 'global') : 'global';

            // Find recipient's userId if it's a socketId
            let targetUserId = to;
            let targetSocketId = to;

            if (to !== 'global') {
                const targetPlayer = activePlayers[to] || Object.values(activePlayers).find(p => p.userId === to);
                if (targetPlayer) {
                    targetUserId = targetPlayer.userId;
                    targetSocketId = targetPlayer.id;
                }
            }

            const payload = {
                id: socket.id,
                senderUserId: player.userId,
                name: player.name,
                message: message,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                to: targetUserId,
                isRead: false
            };

            try {
                await pool.query(
                    `INSERT INTO replica_messages(sender_id, sender_name, message, target_to, room) 
                     VALUES($1, $2, $3, $4, $5)`,
                    [player.userId, player.name, message, targetUserId, player.room]
                );
            } catch (err) { console.error('Save Message Error:', err); }

            if (targetUserId !== 'global') {
                io.to(targetSocketId).emit('newMessage', payload);
                if (targetSocketId !== socket.id) {
                    socket.emit('newMessage', payload);
                }
            } else {
                io.to(player.room).emit('newMessage', payload);
            }
        }
    });

    socket.on('disconnect', async () => {
        const player = activePlayers[socket.id];
        if (player) {
            try {
                await pool.query(
                    `UPDATE replica_users SET last_x = $1, last_y = $2, last_seen = NOW() WHERE id = $3`,
                    [Math.round(player.x), Math.round(player.y), player.userId]
                );
                io.to(player.room).emit('userStatusChange', { userId: player.userId, isOnline: false, lastSeen: new Date() });
            } catch (err) { console.error('Save Position Error:', err); }
            io.to(player.room).emit('playerDisconnected', socket.id);
            delete activePlayers[socket.id];
        }
    });

});

