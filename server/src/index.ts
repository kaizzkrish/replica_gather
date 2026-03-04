import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"], // Support both common Vite ports
        methods: ["GET", "POST"]
    }
});

interface Player {
    x: number;
    y: number;
    id: string;
    name: string;
    picture: string;
    room: string;
}

const players: Record<string, Player> = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinRoom', (data: { room: string, name: string, picture?: string }) => {
        if (!data) return;
        const { room, name, picture } = data;
        socket.join(room);

        const newPlayer = {
            x: 380,
            y: 300,
            id: socket.id,
            name: name || 'Guest',
            picture: picture || '',
            room: room
        };
        players[socket.id] = newPlayer;

        // Filter players by room
        const roomPlayers: Record<string, Player> = {};
        Object.keys(players).forEach(id => {
            const p = players[id];
            if (p && p.room === room) {
                roomPlayers[id] = p;
            }
        });

        // Send current players in room to the new user
        socket.emit('currentPlayers', roomPlayers);

        // Broadcast to others in the same room
        socket.to(room).emit('newPlayer', newPlayer);

        console.log(`User ${name} joined room: ${room}`);
    });

    socket.on('playerMovement', (movementData: { x: number, y: number }) => {
        if (!movementData) return;
        const player = players[socket.id];
        if (player) {
            player.x = movementData.x;
            player.y = movementData.y;
            // Broadcast movement to all other players in the same room
            socket.to(player.room).emit('playerMoved', player);
        }
    });

    socket.on('updateProfile', (data: { name: string, picture: string }) => {
        const player = players[socket.id];
        if (player) {
            player.name = data.name;
            player.picture = data.picture;
            // Broadcast update to everyone in the room
            io.to(player.room).emit('profileUpdated', player);
        }
    });

    socket.on('chatMessage', (message: string) => {
        const player = players[socket.id];
        if (player) {
            io.to(player.room).emit('newMessage', {
                id: socket.id,
                name: player.name,
                message: message,
                timestamp: new Date().toLocaleTimeString()
            });
        }
    });

    socket.on('disconnect', () => {
        const player = players[socket.id];
        if (player) {
            console.log('User disconnected:', player.name);
            io.to(player.room).emit('playerDisconnected', socket.id);
            delete players[socket.id];
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
