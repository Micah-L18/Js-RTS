const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = 3117;

// Game rooms storage
const gameRooms = new Map();

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Main route - serve the game
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint for game state (for future multiplayer features)
app.get('/api/gamestate', (req, res) => {
    res.json({ 
        message: 'Halo Wars JS RTS API',
        timestamp: new Date().toISOString()
    });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    
    // Handle room creation
    socket.on('createRoom', (data) => {
        const roomCode = generateRoomCode();
        const room = {
            id: roomCode,
            players: [{ id: socket.id, team: 'player', nickname: data.nickname }],
            gameStarted: false,
            createdAt: Date.now()
        };
        
        gameRooms.set(roomCode, room);
        socket.join(roomCode);
        socket.currentRoom = roomCode;
        socket.nickname = data.nickname;
        
        socket.emit('roomCreated', {
            roomCode: roomCode,
            playerTeam: 'player',
            playerId: socket.id,
            nickname: data.nickname
        });
        
        console.log(`Room created: ${roomCode} by ${data.nickname} (${socket.id})`);
    });
    
    // Handle room joining
    socket.on('joinRoom', (data) => {
        const room = gameRooms.get(data.roomCode);
        
        if (!room) {
            socket.emit('joinError', 'Room not found');
            return;
        }
        
        if (room.players.length >= 2) {
            socket.emit('joinError', 'Room is full');
            return;
        }
        
        if (room.gameStarted) {
            socket.emit('joinError', 'Game already started');
            return;
        }
        
        room.players.push({ id: socket.id, team: 'enemy', nickname: data.nickname });
        socket.join(data.roomCode);
        socket.currentRoom = data.roomCode;
        socket.nickname = data.nickname;
        
        socket.emit('roomJoined', {
            roomCode: data.roomCode,
            playerTeam: 'enemy',
            playerId: socket.id,
            nickname: data.nickname
        });
        
        // Notify both players that room is ready
        io.to(data.roomCode).emit('playersReady', {
            players: room.players,
            canStart: room.players.length === 2
        });
        
        console.log(`Player ${data.nickname} (${socket.id}) joined room ${data.roomCode}`);
    });
    
    // Handle game start
    socket.on('startGame', () => {
        const room = gameRooms.get(socket.currentRoom);
        if (room && room.players.length === 2 && !room.gameStarted) {
            room.gameStarted = true;
            io.to(socket.currentRoom).emit('gameStarted');
            console.log(`Game started in room ${socket.currentRoom}`);
        }
    });
    
    // Handle game actions
    socket.on('gameAction', (data) => {
        if (socket.currentRoom) {
            socket.to(socket.currentRoom).emit('gameAction', {
                ...data,
                playerId: socket.id
            });
        }
    });
    
    // Handle game over
    socket.on('gameOver', (data) => {
        if (socket.currentRoom) {
            const room = gameRooms.get(socket.currentRoom);
            let winnerNickname = 'Unknown';
            
            if (room) {
                const winnerPlayer = room.players.find(p => p.team === data.winner);
                if (winnerPlayer) {
                    winnerNickname = winnerPlayer.nickname;
                }
            }
            
            io.to(socket.currentRoom).emit('gameOver', {
                ...data,
                winner: data.winner,
                winnerNickname: winnerNickname
            });
            
            // Clean up room after game over
            setTimeout(() => {
                gameRooms.delete(socket.currentRoom);
            }, 30000); // Delete room after 30 seconds
        }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        
        if (socket.currentRoom) {
            const room = gameRooms.get(socket.currentRoom);
            if (room) {
                room.players = room.players.filter(p => p.id !== socket.id);
                
                if (room.players.length === 0) {
                    gameRooms.delete(socket.currentRoom);
                    console.log(`Room ${socket.currentRoom} deleted (empty)`);
                } else {
                    // Notify remaining player
                    socket.to(socket.currentRoom).emit('playerDisconnected');
                }
            }
        }
    });
});

// Generate random room code
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

server.listen(PORT, () => {
    console.log(`🎮 Halo Wars JS RTS Server running on http://localhost:${PORT}`);
    console.log(`📁 Serving files from: ${path.join(__dirname, 'public')}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('Server shutting down...');
    process.exit(0);
});