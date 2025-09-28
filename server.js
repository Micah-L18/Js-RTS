const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const GameLogger = require('./logger');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = 3117;

// Initialize game logger
const logger = new GameLogger();

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

// API endpoint to view recent logs
app.get('/api/logs', (req, res) => {
    const lines = parseInt(req.query.lines) || 100;
    const type = req.query.type; // Filter by log type if specified
    
    try {
        const logs = logger.getRecentLogs(lines, type);
        res.json({
            success: true,
            logs: logs,
            totalLines: logs.length,
            sessionId: logger.sessionId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.logError('log_api_error', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve logs',
            timestamp: new Date().toISOString()
        });
    }
});

// API endpoint to download current log file
app.get('/api/logs/download', (req, res) => {
    try {
        const logFilePath = logger.getCurrentLogFile();
        if (fs.existsSync(logFilePath)) {
            res.download(logFilePath, path.basename(logFilePath));
        } else {
            res.status(404).json({
                success: false,
                error: 'Log file not found'
            });
        }
    } catch (error) {
        logger.logError('log_download_error', error);
        res.status(500).json({
            success: false,
            error: 'Failed to download log file'
        });
    }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    logger.logMultiplayer('PLAYER_CONNECT', 'N/A', { playerId: socket.id });
    
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
        
        logger.logMultiplayer('ROOM_CREATE', roomCode, { 
            createdBy: socket.id, 
            nickname: data.nickname,
            roomData: room
        });
        
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
        
        logger.logMultiplayer('ROOM_JOIN', data.roomCode, {
            playerId: socket.id,
            nickname: data.nickname,
            roomPlayers: room.players.length,
            canStart: room.players.length === 2
        });
        
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
            
            logger.logGameState('GAME_STARTED', {
                roomCode: socket.currentRoom,
                players: room.players.map(p => ({ id: p.id, nickname: p.nickname, team: p.team })),
                startTime: Date.now()
            });
            
            // Broadcast updated lobby count (room no longer available)
            broadcastLobbyCount();
        }
    });
    
    // Handle game actions
    socket.on('gameAction', (data) => {
        if (socket.currentRoom) {
            logger.logPlayerAction(data.type || 'unknown_action', {
                playerId: socket.id,
                roomCode: socket.currentRoom,
                actionData: data
            });
            
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
                
                logger.logGameState('game_over', {
                    roomCode: socket.currentRoom,
                    winner: data.winner,
                    winnerNickname: winnerNickname,
                    reason: data.reason || 'normal_victory',
                    gameData: data,
                    players: room.players.map(p => ({
                        id: p.id,
                        nickname: p.nickname,
                        team: p.team
                    }))
                });
            }
            
            io.to(socket.currentRoom).emit('gameOver', {
                ...data,
                winner: data.winner,
                winnerNickname: winnerNickname
            });
            
            // Clean up room after game over
            setTimeout(() => {
                gameRooms.delete(socket.currentRoom);
                logger.logEvent('room_cleanup', `Room ${socket.currentRoom} deleted after game over`);
            }, 30000); // Delete room after 30 seconds
        }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        logger.logEvent('player_disconnect', `Player disconnected: ${socket.id}`);
        console.log(`Player disconnected: ${socket.id}`);
        
        if (socket.currentRoom) {
            const room = gameRooms.get(socket.currentRoom);
            if (room) {
                const player = room.players.find(p => p.id === socket.id);
                
                if (player) {
                    logger.logMultiplayer('disconnect_handling', {
                        playerId: socket.id,
                        nickname: player.nickname,
                        roomCode: socket.currentRoom,
                        gameStarted: room.gameStarted
                    });
                    
                    if (room.gameStarted) {
                        // Game is in progress - start 5-minute timeout
                        player.disconnected = true;
                        player.disconnectTime = Date.now();
                        
                        player.disconnectTimeout = setTimeout(() => {
                            // 5 minutes passed - declare other player winner
                            const remainingPlayer = room.players.find(p => p.id !== socket.id && !p.disconnected);
                            if (remainingPlayer) {
                                logger.logGameState('game_timeout_win', {
                                    winnerPlayerId: remainingPlayer.id,
                                    winnerNickname: remainingPlayer.nickname,
                                    loserPlayerId: socket.id,
                                    loserNickname: player.nickname,
                                    roomCode: socket.currentRoom,
                                    reason: 'disconnect_timeout'
                                });
                                
                                console.log(`Player ${player.nickname} timed out. Declaring ${remainingPlayer.nickname} winner.`);
                                
                                io.to(socket.currentRoom).emit('gameOver', {
                                    winner: remainingPlayer.team,
                                    winnerNickname: remainingPlayer.nickname,
                                    reason: 'opponent_timeout'
                                });
                            }
                            
                            // Clean up room
                            gameRooms.delete(socket.currentRoom);
                            logger.logEvent('room_deleted_timeout', `Room ${socket.currentRoom} deleted (timeout)`);
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
                        
                        logger.logMultiplayer('player_removed_lobby', {
                            playerId: socket.id,
                            nickname: player.nickname,
                            roomCode: socket.currentRoom,
                            remainingPlayers: room.players.length
                        });
                        
                        if (room.players.length === 0) {
                            gameRooms.delete(socket.currentRoom);
                            logger.logEvent('room_deleted_empty', `Room ${socket.currentRoom} deleted (empty)`);
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
    
    // Handle client-side logs
    socket.on('clientLog', (logEntry) => {
        try {
            const { type, data } = logEntry;
            
            switch (type) {
                case 'client_console':
                    logger.logEvent('CLIENT_CONSOLE', data.level.toUpperCase(), data.message, {
                        sessionId: data.sessionId,
                        url: data.url,
                        userAgent: data.userAgent,
                        playerId: socket.id
                    });
                    break;
                    
                case 'client_event':
                    logger.logEvent('CLIENT_EVENT', data.category, `${data.action}: ${data.description}`, {
                        ...data.data,
                        sessionId: data.sessionId,
                        playerId: socket.id
                    });
                    break;
                    
                case 'client_game_action':
                    logger.logPlayerAction(`client_${data.actionType}`, {
                        playerId: socket.id,
                        sessionId: data.sessionId,
                        actionData: data.actionData
                    });
                    break;
                    
                case 'client_error':
                    logger.logError(`client_${data.errorType}`, {
                        playerId: socket.id,
                        sessionId: data.sessionId,
                        errorData: data.errorData
                    });
                    break;
                    
                case 'client_performance':
                    logger.logEvent('CLIENT_PERFORMANCE', data.metric, `Performance metric: ${data.value}`, {
                        playerId: socket.id,
                        sessionId: data.sessionId,
                        value: data.value,
                        context: data.context
                    });
                    break;
                    
                default:
                    logger.logEvent('CLIENT_LOG', 'UNKNOWN', `Unknown client log type: ${type}`, {
                        playerId: socket.id,
                        logEntry
                    });
            }
        } catch (error) {
            logger.logError('client_log_processing_error', {
                playerId: socket.id,
                error: error.message,
                logEntry
            });
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