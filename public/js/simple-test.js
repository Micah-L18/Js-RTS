// Simple Test Game - Minimal working version
console.log('Loading simple test game...');

class SimpleGame {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.isRunning = false;
        this.entities = [];
        this.init();
    }
    
    init() {
        console.log('Initializing simple game...');
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        if (!this.canvas || !this.ctx) {
            console.error('Canvas not found!');
            return;
        }
        
        console.log('Canvas found, starting game...');
        this.start();
    }
    
    start() {
        this.isRunning = true;
        this.gameLoop();
        console.log('Simple game started!');
    }
    
    gameLoop() {
        if (!this.isRunning) return;
        
        this.update();
        this.render();
        
        requestAnimationFrame(() => this.gameLoop());
    }
    
    update() {
        // Simple update logic
    }
    
    render() {
        // Clear canvas
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw a simple test rectangle
        this.ctx.fillStyle = '#00ff00';
        this.ctx.fillRect(100, 100, 50, 50);
        
        // Draw some text
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '16px Arial';
        this.ctx.fillText('Simple Game Running!', 200, 200);
        
        // Draw current time
        this.ctx.fillText('Time: ' + new Date().toLocaleTimeString(), 200, 230);
    }
}

// Initialize when page loads
window.addEventListener('load', () => {
    console.log('Page loaded, creating simple game...');
    const simpleGame = new SimpleGame();
    window.simpleGame = simpleGame;
});