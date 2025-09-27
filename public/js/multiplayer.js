// Multiplayer Manager - Handles lobby and networking
console.log('Loading multiplayer manager...');

class MultiplayerManager {
    constructor() {
        this.socket = io();
        this.currentRoom = null;
        this.playerTeam = null;
        this.playerId = null;
        this.gameStarted = false;
        
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
            this.showWaitingRoom(data.roomCode);
        });
        
        // Room joining
        this.socket.on('roomJoined', (data) => {
            console.log('Joined room:', data);
            this.currentRoom = data.roomCode;
            this.playerTeam = data.playerTeam;
            this.playerId = data.playerId;
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
        
        // Player disconnected
        this.socket.on('playerDisconnected', () => {
            console.log('Other player disconnected');
            this.handlePlayerDisconnected();
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
        
        if (data.winner === this.playerTeam) {
            resultElement.textContent = `🎉 Victory! You won!`;
            resultElement.style.color = '#00ff00';
        } else {
            resultElement.textContent = `💀 Defeat! ${data.winnerNickname} won the game.`;
            resultElement.style.color = '#ff4444';
        }
        
        gameEndResult.style.display = 'block';
        this.gameStarted = false;
        
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
}

// Initialize multiplayer when page loads
window.multiplayerManager = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing multiplayer manager...');
    window.multiplayerManager = new MultiplayerManager();
});