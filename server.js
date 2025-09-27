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

// Function to count available public lobbies
function getAvailableLobbiesCount() {
    let count = 0;
    for (const [roomCode, room] of gameRooms) {
        if (room.players.length === 1 && !room.gameStarted && room.isPublic) {
            count++;
        }
    }
    return count;
}

// Function to broadcast lobby count to all connected clients
function broadcastLobbyCount() {
    const availableLobbies = getAvailableLobbiesCount();
    io.emit('lobbyCountUpdate', { count: availableLobbies });
}

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
    
    // Send current lobby count to new connection
    const availableLobbies = getAvailableLobbiesCount();
    socket.emit('lobbyCountUpdate', { count: availableLobbies });
    
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
        
        // Broadcast updated lobby count (room no longer available for quick game)
        broadcastLobbyCount();
    });
    
    // Handle quick game (join any available public room)
    socket.on('quickGame', (data) => {
        console.log(`Player ${data.nickname} (${socket.id}) looking for quick game`);
        
        // Find an available room with only 1 player that's not started
        let availableRoom = null;
        for (const [roomCode, room] of gameRooms) {
            if (room.players.length === 1 && !room.gameStarted && room.isPublic) {
                availableRoom = { roomCode, room };
                break;
            }
        }
        
        if (availableRoom) {
            // Join existing room
            const { roomCode, room } = availableRoom;
            room.players.push({ id: socket.id, team: 'enemy', nickname: data.nickname });
            socket.join(roomCode);
            socket.currentRoom = roomCode;
            socket.nickname = data.nickname;
            
            socket.emit('roomJoined', {
                roomCode: roomCode,
                playerTeam: 'enemy',
                playerId: socket.id,
                nickname: data.nickname
            });
            
            // Notify both players that room is ready
            io.to(roomCode).emit('playersReady', {
                players: room.players,
                canStart: room.players.length === 2
            });
            
            console.log(`Quick game: Player ${data.nickname} joined existing room ${roomCode}`);
            
            // Broadcast updated lobby count (room no longer available)
            broadcastLobbyCount();
        } else {
            // Create new room for others to join
            const roomCode = generateRoomCode();
            const room = {
                id: roomCode,
                players: [{ id: socket.id, team: 'player', nickname: data.nickname }],
                gameStarted: false,
                createdAt: Date.now(),
                isPublic: true // Mark as public for quick game matching
            };
            
            gameRooms.set(roomCode, room);
            socket.join(roomCode);
            socket.currentRoom = roomCode;
            socket.nickname = data.nickname;
            
            socket.emit('roomCreated', {
                roomCode: roomCode,
                playerTeam: 'player',
                playerId: socket.id,
                nickname: data.nickname,
                isQuickGame: true
            });
            
            console.log(`Quick game: Created new public room ${roomCode} for ${data.nickname}`);
            
            // Broadcast updated lobby count (new room available)
            broadcastLobbyCount();
        }
    });
    
    // Handle room rejoining
    socket.on('rejoinRoom', (data) => {
        const room = gameRooms.get(data.roomCode);
        
        if (!room) {
            socket.emit('rejoinFailed', 'Room no longer exists');
            return;
        }
        
        // Find the player in the room by nickname (since they have a new socket ID)
        const playerIndex = room.players.findIndex(p => p.nickname === data.nickname);
        
        if (playerIndex === -1) {
            socket.emit('rejoinFailed', 'Player not found in room');
            return;
        }
        
        // Update the player's socket ID
        const player = room.players[playerIndex];
        const oldSocketId = player.id;
        player.id = socket.id;
        player.reconnected = true;
        player.lastSeen = Date.now();
        
        // Clear any existing timeout for this player
        if (player.disconnectTimeout) {
            clearTimeout(player.disconnectTimeout);
            delete player.disconnectTimeout;
        }
        
        socket.join(data.roomCode);
        socket.currentRoom = data.roomCode;
        socket.nickname = data.nickname;
        
        socket.emit('rejoinSuccess', {
            roomCode: data.roomCode,
            playerTeam: player.team,
            playerId: socket.id,
            nickname: data.nickname,
            gameInProgress: room.gameStarted
        });
        
        // Notify other players of reconnection
        socket.to(data.roomCode).emit('playerReconnected', {
            nickname: data.nickname,
            team: player.team
        });
        
        console.log(`Player ${data.nickname} (${socket.id}) rejoined room ${data.roomCode}, replacing ${oldSocketId}`);
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
                const player = room.players.find(p => p.id === socket.id);
                
                if (player) {
                    if (room.gameStarted) {
                        // Game is in progress - start 5-minute timeout
                        player.disconnected = true;
                        player.disconnectTime = Date.now();
                        
                        player.disconnectTimeout = setTimeout(() => {
                            // 5 minutes passed - declare other player winner
                            const remainingPlayer = room.players.find(p => p.id !== socket.id && !p.disconnected);
                            if (remainingPlayer) {
                                console.log(`Player ${player.nickname} timed out. Declaring ${remainingPlayer.nickname} winner.`);
                                
                                io.to(socket.currentRoom).emit('gameOver', {
                                    winner: remainingPlayer.team,
                                    winnerNickname: remainingPlayer.nickname,
                                    reason: 'opponent_timeout'
                                });
                            }
                            
                            // Clean up room
                            gameRooms.delete(socket.currentRoom);
                            console.log(`Room ${socket.currentRoom} deleted (timeout)`);
                        }, 5 * 60 * 1000); // 5 minutes
                        
                        // Notify other player of disconnection
                        socket.to(socket.currentRoom).emit('playerDisconnected', {
                            nickname: player.nickname,
                            timeout: '5 minutes'
                        });
                        
                        console.log(`Player ${player.nickname} disconnected from active game. Starting 5-minute timeout.`);
                    } else {
                        // Game not started - remove player immediately
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