import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db/pool.js';
import { initDb } from './db/init.js';

dotenv.config();

// Version: 1.0.1 - Universal Standard

import bcrypt from 'bcryptjs';

const app = express();
const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
    : ['*'];
const allowCorsOrigin = (origin: string | undefined, callback: (error: Error | null, origin?: boolean | string) => void) => {
    if (!origin || corsOrigins.includes('*') || corsOrigins.includes(origin)) {
        callback(null, origin || true);
        return;
    }

    callback(new Error('Origin not allowed by CORS'));
};

app.use(cors({ 
    origin: allowCorsOrigin,
    credentials: true,
    allowedHeaders: ['ngrok-skip-browser-warning', 'Content-Type', 'Authorization']
}));
app.use(express.json());

// --- Simple Auth Routes ---

app.post('/api/auth/signup', async (req, res) => {
    const { username, password, name, email } = req.body;
    if (!username || !password || !email) return res.status(400).json({ error: 'Username, password and email required' });

    try {
        const check = await pool.query('SELECT id FROM replica_users WHERE username = $1 OR email = $2', [username, email]);
        if (check.rows.length > 0) return res.status(400).json({ error: 'Username or Email already taken' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = `local-${Date.now()}`;
        
        await pool.query(
            'INSERT INTO replica_users (id, username, password, name, email) VALUES ($1, $2, $3, $4, $5)',
            [userId, username, hashedPassword, name || username, email]
        );

        res.json({ id: userId, username, name: name || username, email });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM replica_users WHERE username = $1', [username]);
        if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: 'Invalid credentials' });

        res.json({
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture,
            isSuperuser: user.is_superuser,
            customization: user.customization
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
        const result = await pool.query('SELECT * FROM replica_users WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'No user found with this email' });

        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 3600000); // 1 hour

        await pool.query(
            'UPDATE replica_users SET reset_code = $1, reset_expires = $2 WHERE email = $3',
            [resetCode, expires, email]
        );

        // MOCK EMAIL SENDING - Replace with Nodemailer logic
        console.log(`--- [PASSWORD RESET CODE FOR ${email}] ---`);
        console.log(`CODE: ${resetCode}`);
        console.log(`------------------------------------------`);

        res.json({ message: 'Reset code sent to your email (Check server console for demo)' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) return res.status(400).json({ error: 'All fields are required' });

    try {
        const result = await pool.query(
            'SELECT * FROM replica_users WHERE email = $1 AND reset_code = $2 AND reset_expires > NOW()',
            [email, code]
        );

        if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired reset code' });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query(
            'UPDATE replica_users SET password = $1, reset_code = NULL, reset_expires = NULL WHERE email = $2',
            [hashedPassword, email]
        );

        res.json({ message: 'Password reset successfully' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/', (req, res) => {
    res.send('Replica Gather Server is running!');
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: allowCorsOrigin,
        methods: ["GET", "POST"],
        credentials: true
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

interface Pet {
    id: string;
    ownerUserId: string;
    nickname: string;
    breedId: string;
    growthStage: 'baby' | 'juvenile' | 'adult';
    hunger: number;
    energy: number;
    bond: number;
    mode: 'idle' | 'following' | 'sleeping';
    room: string;
    x?: number;
    y?: number;
}

const GROWTH_THRESHOLDS: Record<Pet['growthStage'], number> = { baby: 50, juvenile: 150, adult: Infinity };
const nextGrowthStage = (stage: Pet['growthStage']): Pet['growthStage'] =>
    stage === 'baby' ? 'juvenile' : stage === 'juvenile' ? 'adult' : 'adult';

// Keyed by owner userId (one pet per user) rather than socket id — unlike
// activePlayers, a pet's state should persist across its owner's
// reconnects/disconnects instead of disappearing with the socket.
const activePets: Record<string, Pet> = {};

const rowToPet = (row: any): Pet => ({
    id: row.id,
    ownerUserId: row.owner_user_id,
    nickname: row.nickname,
    breedId: row.breed_id,
    growthStage: row.growth_stage,
    hunger: row.hunger,
    energy: row.energy,
    bond: row.bond,
    mode: row.mode,
    room: row.room,
});

const PORT = process.env.PORT || 3001;

// Decays hunger/energy over time and grows bond while well-fed, same idea
// as a Tamagotchi tick — runs regardless of whether the owner is currently
// connected, since activePets persists across disconnects.
const PET_TICK_MS = 60_000;
const startPetTick = () => {
    setInterval(async () => {
        for (const pet of Object.values(activePets)) {
            pet.hunger = Math.max(0, pet.hunger - 2);
            pet.energy = pet.mode === 'sleeping'
                ? Math.min(100, pet.energy + 10)
                : Math.max(0, pet.energy - 2);
            if (pet.hunger > 50) {
                pet.bond = Math.min(GROWTH_THRESHOLDS.adult, pet.bond + 1);
                if (pet.bond >= GROWTH_THRESHOLDS[pet.growthStage]) pet.growthStage = nextGrowthStage(pet.growthStage);
            }

            try {
                await pool.query(
                    `UPDATE replica_pets SET hunger = $1, energy = $2, bond = $3, growth_stage = $4, updated_at = NOW() WHERE id = $5`,
                    [pet.hunger, pet.energy, pet.bond, pet.growthStage, pet.id]
                );
                io.to(pet.room).emit('pet:updated', pet);
            } catch (err) { console.error('Pet Tick Error:', err); }
        }
    }, PET_TICK_MS);
};

// Initialize Database and Start Server
const startServer = async () => {
    try {
        await initDb();
        startPetTick();

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
        console.log(`User ${data?.userId} version ${data?.name} joining room ${data?.room}`);
        if (!data || !data.userId) return;
        const { room, name, picture, userId, email } = data;
        socket.join(room);

        let playerData: Partial<Player> = {
            x: 380, y: 300, name: name || 'Explorer', picture: picture || '',
            customization: {
                version: 2,
                layers: [
                    { category: 'body', path: 'body/bodies/teen/walk.png' },
                    { category: 'head', path: 'head/heads/human/male/walk.png' },
                    { category: 'eyes', path: 'eyes/human/adult/default/walk.png' },
                    { category: 'hair', path: 'hair/page/adult/walk.png' },
                    { category: 'torso', path: 'torso/clothes/longsleeve/longsleeve2/teen/walk.png' },
                    { category: 'legs', path: 'legs/pants2/thin/walk.png' },
                    { category: 'feet', path: 'feet/shoes/basic/thin/walk.png' }
                ]
            }
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

        // Sync Space Settings (Home Name)
        try {
            const settingsRes = await pool.query(`SELECT home_name FROM replica_space_settings WHERE id = $1`, [room]);
            if (settingsRes.rows[0]) {
                socket.emit('homeNameUpdated', { name: settingsRes.rows[0].home_name });
            }
        } catch (err) { console.error('Fetch Space Settings Error:', err); }

        // Load this user's pet (if any) into the in-memory store, then sync
        // every pet currently known for this room to the joining socket —
        // mirrors the currentPlayers/newPlayer pattern above.
        try {
            if (!activePets[userId]) {
                const petRes = await pool.query(`SELECT * FROM replica_pets WHERE owner_user_id = $1`, [userId]);
                if (petRes.rows[0]) activePets[userId] = rowToPet(petRes.rows[0]);
            }
            const ownPet = activePets[userId];
            if (ownPet) ownPet.room = room;

            const roomPets: Record<string, Pet> = {};
            Object.values(activePets).forEach((pet) => {
                if (pet.room === room) roomPets[pet.ownerUserId] = pet;
            });
            socket.emit('pet:currentPets', roomPets);
        } catch (err) { console.error('Fetch Pet Error:', err); }
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
        // Only log movements occasionally to avoid flooding
        // console.log(`Player moved: ${player?.name} at [${movementData.x}, ${movementData.y}]`);
        if (player) {
            player.x = movementData.x;
            player.y = movementData.y;
            socket.to(player.room).emit('playerMoved', { ...player, animationKey: movementData.animationKey });
        }
    });

    socket.on('updateProfile', async (data: { name: string, picture: string, customization?: any }) => {
        const player = activePlayers[socket.id];
        console.log(`Updating profile for ${player?.name}:`, data);
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

    socket.on('pet:adopt', async (data: { nickname: string, breedId: string }) => {
        const player = activePlayers[socket.id];
        if (!player || !data?.nickname || !data?.breedId) return;
        if (activePets[player.userId]) return; // one pet per user

        const pet: Pet = {
            id: `pet-${Date.now()}`,
            ownerUserId: player.userId,
            nickname: data.nickname.slice(0, 100),
            breedId: data.breedId,
            growthStage: 'baby',
            hunger: 100,
            energy: 100,
            bond: 0,
            mode: 'idle',
            room: player.room,
        };

        try {
            await pool.query(
                `INSERT INTO replica_pets (id, owner_user_id, nickname, breed_id, growth_stage, hunger, energy, bond, mode, room)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [pet.id, pet.ownerUserId, pet.nickname, pet.breedId, pet.growthStage, pet.hunger, pet.energy, pet.bond, pet.mode, pet.room]
            );
            activePets[player.userId] = pet;
            io.to(pet.room).emit('pet:adopted', pet);
        } catch (err) { console.error('Adopt Pet Error:', err); }
    });

    socket.on('pet:remove', async () => {
        const player = activePlayers[socket.id];
        const pet = player && activePets[player.userId];
        if (!pet) return;

        try {
            await pool.query(`DELETE FROM replica_pets WHERE id = $1`, [pet.id]);
            delete activePets[pet.ownerUserId];
            io.to(pet.room).emit('pet:removed', { ownerUserId: pet.ownerUserId });
        } catch (err) { console.error('Remove Pet Error:', err); }
    });

    socket.on('pet:feed', async () => {
        const player = activePlayers[socket.id];
        const pet = player && activePets[player.userId];
        if (!pet) return;

        pet.hunger = Math.min(100, pet.hunger + 25);
        pet.bond = Math.min(GROWTH_THRESHOLDS.adult, pet.bond + 5);
        if (pet.bond >= GROWTH_THRESHOLDS[pet.growthStage]) pet.growthStage = nextGrowthStage(pet.growthStage);

        try {
            await pool.query(
                `UPDATE replica_pets SET hunger = $1, bond = $2, growth_stage = $3, updated_at = NOW() WHERE id = $4`,
                [pet.hunger, pet.bond, pet.growthStage, pet.id]
            );
            io.to(pet.room).emit('pet:updated', pet);
        } catch (err) { console.error('Feed Pet Error:', err); }
    });

    socket.on('pet:setMode', async (data: { mode: Pet['mode'] }) => {
        const player = activePlayers[socket.id];
        const pet = player && activePets[player.userId];
        if (!pet || !data?.mode) return;

        pet.mode = data.mode;
        try {
            await pool.query(`UPDATE replica_pets SET mode = $1, updated_at = NOW() WHERE id = $2`, [pet.mode, pet.id]);
            io.to(pet.room).emit('pet:updated', pet);
        } catch (err) { console.error('Set Pet Mode Error:', err); }
    });

    socket.on('pet:rename', async (data: { nickname: string }) => {
        const player = activePlayers[socket.id];
        const pet = player && activePets[player.userId];
        if (!pet || !data?.nickname) return;

        pet.nickname = data.nickname.slice(0, 100);
        try {
            await pool.query(`UPDATE replica_pets SET nickname = $1, updated_at = NOW() WHERE id = $2`, [pet.nickname, pet.id]);
            io.to(pet.room).emit('pet:updated', pet);
        } catch (err) { console.error('Rename Pet Error:', err); }
    });

    // Following-pet position, throttled client-side the same way playerMovement is.
    socket.on('pet:move', (data: { x: number, y: number, direction?: string }) => {
        const player = activePlayers[socket.id];
        const pet = player && activePets[player.userId];
        if (!pet || !data) return;

        pet.x = data.x;
        pet.y = data.y;
        socket.to(pet.room).emit('pet:moved', { ownerUserId: pet.ownerUserId, x: data.x, y: data.y, direction: data.direction });
    });

    socket.on('updateHomeName', async (data: { name: string, room?: string }) => {
        const player = activePlayers[socket.id];
        const room = data.room || player?.room || 'main-space';
        try {
            await pool.query(
                `UPDATE replica_space_settings SET home_name = $1 WHERE id = $2`,
                [data.name, room]
            );
            io.to(room).emit('homeNameUpdated', { name: data.name });
        } catch (err) { console.error('Update Home Name Error:', err); }
    });

    socket.on('call-user', (data: { to: string, signal: any, from: string }) => {
        io.to(data.to).emit('incoming-call', { signal: data.signal, from: data.from });
    });

    socket.on('answer-call', (data: { to: string, signal: any, from: string }) => {
        io.to(data.to).emit('call-accepted', { signal: data.signal, from: data.from });
    });

    socket.on('chatMessage', async (data: any) => {
        const player = activePlayers[socket.id];
        console.log(`Chat from ${player?.name}:`, data);
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

