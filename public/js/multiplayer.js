// Multiplayer Manager - Handles lobby and networking
console.log('Loading multiplayer manager...');

class MultiplayerManager {
    constructor() {
        this.socket = io();
        this.currentRoom = null;
        this.playerTeam = null;
        this.playerId = null;
        this.gameStarted = false;
        
        // Check for saved game state on page load
        this.checkForSavedGame();
        
        this.setupSocketListeners();
        this.setupUIHandlers();
    }
    
    setupSocketListeners() {
        // Room creation
        this.socket.on('roomCreated', (data) => {
            console.log('Room created:', data);
            this.currentRoom = data.roomCode;
            this.playerTeam = data.playerTeam;
            this.playerId = data.playerId;
            this.playerNickname = data.nickname;
            this.saveGameState(); // Save state when joining room
            this.showWaitingRoom(data.roomCode);
        });
        
        // Room joining
        this.socket.on('roomJoined', (data) => {
            console.log('Joined room:', data);
            this.currentRoom = data.roomCode;
            this.playerTeam = data.playerTeam;
            this.playerId = data.playerId;
            this.playerNickname = data.nickname;
            this.saveGameState(); // Save state when joining room
            this.showWaitingRoom(data.roomCode);
        });
        
        // Join errors
        this.socket.on('joinError', (message) => {
            alert(message);
            console.log('Join error:', message);
        });
        
        // Players ready
        this.socket.on('playersReady', (data) => {
            console.log('Players ready:', data);
            this.updatePlayersList(data.players);
            
            if (data.canStart) {
                document.getElementById('startGameBtn').style.display = 'block';
            }
        });
        
        // Game started
        this.socket.on('gameStarted', () => {
            console.log('Game started!');
            this.gameStarted = true;
            this.saveGameState(); // Save game state when game starts
            this.showGameInterface();
            this.initializeGame();
        });
        
        // Game actions from other players
        this.socket.on('gameAction', (data) => {
            console.log('Received game action:', data);
            this.handleRemoteGameAction(data);
        });
        
        // Game over
        this.socket.on('gameOver', (data) => {
            console.log('Game over:', data);
            this.handleGameOver(data);
        });
        
        // Lobby count updates
        this.socket.on('lobbyCountUpdate', (data) => {
            this.updateLobbyCount(data.count);
        });
        
        // Player disconnected
        this.socket.on('playerDisconnected', (data) => {
            console.log('Other player disconnected');
            if (data && data.timeout) {
                alert(`Other player disconnected. They have ${data.timeout} to reconnect before you win.`);
            }
            this.handlePlayerDisconnected();
        });
        
        // Player reconnected
        this.socket.on('playerReconnected', (data) => {
            console.log('Other player reconnected:', data);
            alert(`${data.nickname} has reconnected to the game.`);
        });
        
        // Rejoin success
        this.socket.on('rejoinSuccess', (data) => {
            console.log('Successfully rejoined room:', data);
            this.gameStarted = data.gameInProgress;
            if (data.gameInProgress) {
                this.showGameInterface();
                this.initializeGame();
            } else {
                this.showWaitingRoom(data.roomCode);
            }
        });
        
        // Rejoin failed
        this.socket.on('rejoinFailed', (message) => {
            console.log('Failed to rejoin room:', message);
            this.clearGameState();
            alert('Could not reconnect to your previous game: ' + message);
        });
    }
    
    setupUIHandlers() {
        // Create room button
        document.getElementById('createRoomBtn').addEventListener('click', () => {
            const nickname = document.getElementById('nicknameInput').value.trim();
            if (!nickname) {
                alert('Please enter a nickname');
                return;
            }
            this.createRoom(nickname);
        });
        
        // Quick Game button
        document.getElementById('quickGameBtn').addEventListener('click', () => {
            const nickname = document.getElementById('nicknameInput').value.trim();
            if (!nickname) {
                alert('Please enter a nickname');
                return;
            }
            this.quickGame(nickname);
        });
        
        // Join room button
        document.getElementById('joinRoomBtn').addEventListener('click', () => {
            const nickname = document.getElementById('nicknameInput').value.trim();
            const roomCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();
            
            if (!nickname) {
                alert('Please enter a nickname');
                return;
            }
            if (roomCode.length === 6) {
                this.joinRoom(roomCode, nickname);
            } else {
                alert('Please enter a valid 6-character room code');
            }
        });
        
        // Start game button
        document.getElementById('startGameBtn').addEventListener('click', () => {
            this.startGame();
        });
        
        // Leave room button
        document.getElementById('leaveRoomBtn').addEventListener('click', () => {
            this.leaveRoom();
        });
        
        // Return to menu button
        document.getElementById('returnToMenuBtn').addEventListener('click', () => {
            this.returnToMenu();
        });
        
        // Room code input enter key
        document.getElementById('roomCodeInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('joinRoomBtn').click();
            }
        });
    }
    
    createRoom(nickname) {
        console.log('Creating room...');
        this.socket.emit('createRoom', { nickname: nickname });
    }
    
    joinRoom(roomCode, nickname) {
        console.log('Joining room:', roomCode);
        this.socket.emit('joinRoom', { roomCode: roomCode, nickname: nickname });
    }
    
    quickGame(nickname) {
        console.log('Finding quick game...');
        this.socket.emit('quickGame', { nickname: nickname });
    }
    
    startGame() {
        console.log('Starting game...');
        this.socket.emit('startGame');
    }
    
    leaveRoom() {
        this.socket.disconnect();
        this.socket.connect();
        this.currentRoom = null;
        this.playerTeam = null;
        this.gameStarted = false;
        this.showMainMenu();
    }
    
    returnToMenu() {
        this.leaveRoom();
    }
    
    showMainMenu() {
        document.getElementById('lobbyInterface').style.display = 'flex';
        document.getElementById('gameUI').style.display = 'none';
        document.getElementById('mainMenu').style.display = 'block';
        document.getElementById('waitingRoom').style.display = 'none';
        document.getElementById('gameStatus').style.display = 'none';
    }
    
    showWaitingRoom(roomCode) {
        document.getElementById('currentRoomCode').textContent = roomCode;
        document.getElementById('mainMenu').style.display = 'none';
        document.getElementById('waitingRoom').style.display = 'block';
        document.getElementById('startGameBtn').style.display = 'none';
        
        // Set up room code copy functionality
        this.setupRoomCodeCopy(roomCode);
    }
    
    setupRoomCodeCopy(roomCode) {
        const roomCodeElement = document.getElementById('currentRoomCode');
        const copyButton = document.getElementById('copyRoomCodeBtn');
        
        // Remove existing event listeners
        const newRoomCodeElement = roomCodeElement.cloneNode(true);
        const newCopyButton = copyButton.cloneNode(true);
        roomCodeElement.parentNode.replaceChild(newRoomCodeElement, roomCodeElement);
        copyButton.parentNode.replaceChild(newCopyButton, copyButton);
        
        // Add click handlers
        const copyRoomCode = () => this.copyRoomCode(roomCode);
        newRoomCodeElement.addEventListener('click', copyRoomCode);
        newCopyButton.addEventListener('click', copyRoomCode);
    }
    
    async copyRoomCode(roomCode) {
        try {
            await navigator.clipboard.writeText(roomCode);
            this.showCopyFeedback('Room code copied to clipboard!');
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = roomCode;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showCopyFeedback('Room code copied to clipboard!');
        }
    }
    
    showCopyFeedback(message) {
        // Remove existing feedback
        const existingFeedback = document.querySelector('.copy-feedback');
        if (existingFeedback) {
            existingFeedback.remove();
        }
        
        // Create and show new feedback
        const feedback = document.createElement('div');
        feedback.className = 'copy-feedback';
        feedback.textContent = message;
        document.body.appendChild(feedback);
        
        // Remove feedback after animation
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.remove();
            }
        }, 2000);
    }
    
    showGameInterface() {
        document.getElementById('lobbyInterface').style.display = 'none';
        document.getElementById('gameUI').style.display = 'block';
        document.getElementById('gameStatus').style.display = 'block';
        document.getElementById('playerTeam').textContent = this.playerTeam === 'player' ? 'Blue Team' : 'Red Team';
    }
    
    updatePlayersList(players) {
        const playersList = document.getElementById('playersList');
        playersList.innerHTML = '';
        
        // Player 1 (always the room creator)
        const player1 = players[0];
        const player1Div = document.createElement('div');
        player1Div.className = 'player-slot';
        player1Div.innerHTML = `
            <span class="player-name">${player1.nickname} (Blue Team)</span>
            <span class="player-status">Connected</span>
        `;
        playersList.appendChild(player1Div);
        
        // Player 2
        const player2Div = document.createElement('div');
        if (players.length >= 2) {
            const player2 = players[1];
            player2Div.className = 'player-slot';
            player2Div.innerHTML = `
                <span class="player-name">${player2.nickname} (Red Team)</span>
                <span class="player-status">Connected</span>
            `;
        } else {
            player2Div.className = 'player-slot waiting';
            player2Div.innerHTML = `
                <span class="player-name">Waiting for Player 2...</span>
                <span class="player-status">-</span>
            `;
        }
        playersList.appendChild(player2Div);
    }
    
    updateLobbyCount(count) {
        const lobbyCountText = document.getElementById('lobbyCountText');
        if (lobbyCountText) {
            const emoji = count > 0 ? '🟢' : '🔴';
            const text = count === 1 ? '1 lobby available' : `${count} lobbies available`;
            lobbyCountText.textContent = `${emoji} ${text}`;
        }
    }
    
    initializeGame() {
        // Initialize the game with multiplayer settings
        if (window.game) {
            window.game.initializeMultiplayer(this.playerTeam, this);
        }
    }
    
    sendGameAction(action, data) {
        if (this.gameStarted && this.socket) {
            this.socket.emit('gameAction', {
                action: action,
                data: data,
                timestamp: Date.now()
            });
        }
    }
    
    handleRemoteGameAction(actionData) {
        if (window.game && this.gameStarted) {
            window.game.handleRemoteAction(actionData);
        }
    }
    
    handleGameOver(data) {
        const resultElement = document.getElementById('gameResult');
        const gameEndResult = document.getElementById('gameEndResult');
        
        // Get player names for better messaging
        const playerName = this.playerNickname || 'You';
        const opponentName = data.winnerNickname || 'Opponent';
        
        if (data.winner === this.playerTeam) {
            resultElement.textContent = `🎉 Victory! ${playerName} won the battle!`;
            resultElement.style.color = '#00ff00';
        } else {
            resultElement.textContent = `💀 Defeat! ${opponentName} defeated ${playerName}!`;
            resultElement.style.color = '#ff4444';
        }
        
        gameEndResult.style.display = 'block';
        this.gameStarted = false;
        this.clearGameState(); // Clear saved game state when game ends
        
        // Show game over screen
        document.getElementById('gameStatus').style.display = 'block';
        document.getElementById('lobbyInterface').style.display = 'flex';
    }
    
    handlePlayerDisconnected() {
        if (this.gameStarted) {
            // Auto-win if opponent disconnects during game
            this.handleGameOver({ winner: this.playerTeam });
        } else {
            // Return to main menu if in lobby
            alert('Other player disconnected');
            this.showMainMenu();
        }
    }
    
    notifyGameOver(winner) {
        this.socket.emit('gameOver', { winner: winner });
    }
    
    // Game state persistence methods
    saveGameState() {
        const gameState = {
            currentRoom: this.currentRoom,
            playerTeam: this.playerTeam,
            playerId: this.playerId,
            gameStarted: this.gameStarted,
            nickname: this.playerNickname,
            timestamp: Date.now()
        };
        localStorage.setItem('rts-game-state', JSON.stringify(gameState));
        console.log('Game state saved:', gameState);
    }
    
    loadGameState() {
        const savedState = localStorage.getItem('rts-game-state');
        if (savedState) {
            try {
                return JSON.parse(savedState);
            } catch (e) {
                console.error('Error parsing saved game state:', e);
                localStorage.removeItem('rts-game-state');
            }
        }
        return null;
    }
    
    clearGameState() {
        localStorage.removeItem('rts-game-state');
        console.log('Game state cleared');
    }
    
    checkForSavedGame() {
        const savedState = this.loadGameState();
        if (savedState && savedState.gameStarted) {
            const timeSinceLastSave = Date.now() - savedState.timestamp;
            const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
            
            if (timeSinceLastSave < fiveMinutes) {
                console.log('Found recent game session, attempting to reconnect...');
                this.attemptReconnection(savedState);
            } else {
                console.log('Saved game session too old, clearing...');
                this.clearGameState();
            }
        }
    }
    
    attemptReconnection(savedState) {
        // Set the saved state
        this.currentRoom = savedState.currentRoom;
        this.playerTeam = savedState.playerTeam;
        this.playerId = savedState.playerId;
        this.playerNickname = savedState.nickname;
        
        // Fill in the nickname field
        if (savedState.nickname) {
            document.getElementById('nicknameInput').value = savedState.nickname;
        }
        
        // Attempt to rejoin the room
        console.log('Attempting to rejoin room:', savedState.currentRoom);
        this.socket.emit('rejoinRoom', {
            roomCode: savedState.currentRoom,
            playerId: savedState.playerId,
            nickname: savedState.nickname
        });
    }
}

// Initialize multiplayer when page loads
window.multiplayerManager = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing multiplayer manager...');
    window.multiplayerManager = new MultiplayerManager();
});