// Debug version with error display
console.log('Loading debug game...');

class DebugGame {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.errors = [];
        this.entities = [];
        this.camera = { x: 0, y: 0, zoom: 1 };
        this.selectedEntities = [];
        this.isRunning = false;
        
        this.init();
    }
    
    init() {
        try {
            console.log('Debug game init...');
            this.canvas = document.getElementById('gameCanvas');
            if (!this.canvas) {
                this.addError('Canvas not found');
                return;
            }
            
            this.ctx = this.canvas.getContext('2d');
            if (!this.ctx) {
                this.addError('Canvas context not found');
                return;
            }
            
            this.addError('Canvas initialized successfully');
            
            // Test basic classes
            if (typeof Vector2 === 'undefined') {
                this.addError('Vector2 class missing');
            } else {
                this.addError('Vector2 class found');
                
                // Test creating a Vector2
                try {
                    const v = new Vector2(10, 20);
                    this.addError(`Vector2 test: (${v.x}, ${v.y})`);
                } catch (e) {
                    this.addError('Vector2 creation failed: ' + e.message);
                }
            }
            
            // Test Unit class
            if (typeof Unit === 'undefined') {
                this.addError('Unit class missing');
            } else {
                this.addError('Unit class found');
                
                try {
                    const unit = new Unit(100, 100);
                    this.entities.push(unit);
                    this.addError('Unit created successfully');
                } catch (e) {
                    this.addError('Unit creation failed: ' + e.message);
                }
            }
            
            // Test Building class
            if (typeof Building === 'undefined') {
                this.addError('Building class missing');
            } else {
                this.addError('Building class found');
            }
            
            // Test Marine class
            if (typeof Marine === 'undefined') {
                this.addError('Marine class missing');
            } else {
                this.addError('Marine class found');
                
                try {
                    const marine = new Marine(150, 150);
                    this.entities.push(marine);
                    this.addError('Marine created successfully');
                } catch (e) {
                    this.addError('Marine creation failed: ' + e.message);
                }
            }
            
            this.start();
            
        } catch (error) {
            this.addError('Init failed: ' + error.message);
        }
    }
    
    addError(message) {
        console.log('DEBUG:', message);
        this.errors.push(message);
        if (this.errors.length > 20) {
            this.errors.shift();
        }
    }
    
    start() {
        this.isRunning = true;
        this.gameLoop();
        this.addError('Game loop started');
    }
    
    gameLoop() {
        if (!this.isRunning) return;
        
        this.update();
        this.render();
        
        requestAnimationFrame(() => this.gameLoop());
    }
    
    update() {
        // Update entities
        this.entities.forEach(entity => {
            if (entity.update) {
                try {
                    entity.update(16); // 60 FPS
                } catch (e) {
                    this.addError('Entity update failed: ' + e.message);
                }
            }
        });
    }
    
    render() {
        if (!this.ctx) return;
        
        // Clear canvas
        this.ctx.fillStyle = '#001122';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Render entities
        this.entities.forEach(entity => {
            if (entity.render) {
                try {
                    entity.render(this.ctx, this.camera);
                } catch (e) {
                    this.addError('Entity render failed: ' + e.message);
                }
            } else {
                // Simple fallback render
                this.ctx.fillStyle = '#ffffff';
                this.ctx.fillRect(entity.position.x - 5, entity.position.y - 5, 10, 10);
            }
        });
        
        // Render errors
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px Arial';
        
        let y = 20;
        this.errors.forEach(error => {
            this.ctx.fillText(error, 10, y);
            y += 15;
        });
        
        // Render basic info
        this.ctx.fillText(`Entities: ${this.entities.length}`, 10, this.canvas.height - 40);
        this.ctx.fillText(`Time: ${new Date().toLocaleTimeString()}`, 10, this.canvas.height - 25);
        this.ctx.fillText('Debug Game Running', 10, this.canvas.height - 10);
    }
}

// Initialize debug game
window.addEventListener('load', () => {
    console.log('Starting debug game...');
    window.debugGame = new DebugGame();
});