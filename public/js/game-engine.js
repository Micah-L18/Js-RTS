// Game Engine - Core game loop and state management
console.log('Loading game engine...');

class GameEngine {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.isRunning = false;
        this.isPaused = false;
        this.gameSpeed = 1;
        this.lastFrameTime = 0;
        this.deltaTime = 0;
        this.fps = 60;
        this.targetFrameTime = 1000 / this.fps;
        
        // Game world settings
        this.worldWidth = 2400;
        this.worldHeight = 1600;
        this.camera = {
            x: 0,
            y: 0,
            zoom: 1,
            bounds: {
                minX: 0,
                minY: 0,
                maxX: this.worldWidth,
                maxY: this.worldHeight
            }
        };
        
        // Game objects
        this.entities = [];
        this.selectedEntities = [];
        this.bullets = [];
        this.effects = [];
        
        this.init();
    }
    
    init() {
        console.log('GameEngine.init() called');
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            throw new Error('Canvas element with id "gameCanvas" not found');
        }
        
        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) {
            throw new Error('Could not get 2D context from canvas');
        }
        
        // Set canvas to full screen
        this.resizeCanvas();
        
        // Listen for window resize
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Set up canvas properties
        this.ctx.imageSmoothingEnabled = false;
        
        console.log('Game Engine initialized successfully');
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        console.log(`Canvas resized to: ${this.canvas.width}x${this.canvas.height}`);
    }
    
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.lastFrameTime = performance.now();
        this.gameLoop();
        
        console.log('Game started');
    }
    
    stop() {
        this.isRunning = false;
        console.log('Game stopped');
    }
    
    pause() {
        this.isPaused = !this.isPaused;
        console.log(`Game ${this.isPaused ? 'paused' : 'resumed'}`);
    }
    
    setSpeed(speed) {
        this.gameSpeed = MathUtils.clamp(speed, 0.5, 3);
        console.log(`Game speed set to ${this.gameSpeed}x`);
    }
    
    gameLoop() {
        if (!this.isRunning) return;
        
        const currentTime = performance.now();
        this.deltaTime = (currentTime - this.lastFrameTime) * this.gameSpeed;
        this.lastFrameTime = currentTime;
        
        if (!this.isPaused) {
            this.update(this.deltaTime);
        }
        
        this.render();
        
        requestAnimationFrame(() => this.gameLoop());
    }
    
    update(deltaTime) {
        // Update all entities
        this.entities.forEach(entity => {
            if (entity.update) {
                entity.update(deltaTime);
            }
        });
        
        // Update bullets
        this.bullets.forEach(bullet => {
            bullet.update(deltaTime);
        });
        
        // Update effects
        this.effects.forEach(effect => {
            if (effect.update) {
                effect.update(deltaTime);
            }
        });
        
        // Remove dead entities, bullets, and effects
        this.entities = this.entities.filter(entity => !entity.isDead);
        this.selectedEntities = this.selectedEntities.filter(entity => !entity.isDead);
        this.bullets = this.bullets.filter(bullet => !bullet.isDead);
        this.effects = this.effects.filter(effect => !effect.isDead);
        
        // Update game-specific logic
        if (window.game && window.game.isInitialized) {
            window.game.update(deltaTime);
        }
    }
    
    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Save context for camera transformation
        this.ctx.save();
        
        // Apply camera transformation
        this.ctx.translate(-this.camera.x, -this.camera.y);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        
        // Render background grid
        this.renderGrid();
        
        // Render world border
        this.renderWorldBorder();
        
        // Render all entities
        this.entities.forEach(entity => {
            if (entity.render) {
                entity.render(this.ctx, this.camera);
            }
        });
        
        // Render bullets
        this.bullets.forEach(bullet => {
            bullet.render(this.ctx, this.camera);
        });
        
        // Render effects
        this.effects.forEach(effect => {
            if (effect.render) {
                effect.render(this.ctx, this.camera);
            }
        });
        
        // Render selection indicators
        this.renderSelectionIndicators();
        
        // Restore context
        this.ctx.restore();
        
        // Render UI elements (not affected by camera)
        this.renderUI();
        
        // Render game-specific elements
        if (window.game && window.game.isInitialized) {
            window.game.render(this.ctx);
        }
    }
    
    renderGrid() {
        const gridSize = 50;
        const startX = Math.floor(this.camera.x / gridSize) * gridSize;
        const startY = Math.floor(this.camera.y / gridSize) * gridSize;
        const endX = this.camera.x + this.canvas.width;
        const endY = this.camera.y + this.canvas.height;
        
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.3;
        
        // Vertical lines
        for (let x = startX; x < endX; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, this.camera.y);
            this.ctx.lineTo(x, endY);
            this.ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = startY; y < endY; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.camera.x, y);
            this.ctx.lineTo(endX, y);
            this.ctx.stroke();
        }
        
        this.ctx.globalAlpha = 1;
    }
    
    renderWorldBorder() {
        // Draw world boundary
        this.ctx.strokeStyle = '#ff6600';
        this.ctx.lineWidth = 3;
        this.ctx.globalAlpha = 0.8;
        
        // Main border rectangle
        this.ctx.strokeRect(0, 0, this.worldWidth, this.worldHeight);
        
        // Add warning stripes for visual clarity
        this.ctx.strokeStyle = '#ffaa00';
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.4;
        
        const stripeSpacing = 20;
        
        // Top border stripes
        for (let x = 0; x < this.worldWidth; x += stripeSpacing * 2) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x + stripeSpacing, 0);
            this.ctx.stroke();
        }
        
        // Bottom border stripes
        for (let x = 0; x < this.worldWidth; x += stripeSpacing * 2) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, this.worldHeight);
            this.ctx.lineTo(x + stripeSpacing, this.worldHeight);
            this.ctx.stroke();
        }
        
        // Left border stripes
        for (let y = 0; y < this.worldHeight; y += stripeSpacing * 2) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(0, y + stripeSpacing);
            this.ctx.stroke();
        }
        
        // Right border stripes
        for (let y = 0; y < this.worldHeight; y += stripeSpacing * 2) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.worldWidth, y);
            this.ctx.lineTo(this.worldWidth, y + stripeSpacing);
            this.ctx.stroke();
        }
        
        this.ctx.globalAlpha = 1;
    }
    
    renderSelectionIndicators() {
        this.selectedEntities.forEach(entity => {
            if (entity.position && entity.radius) {
                this.ctx.strokeStyle = '#00ff00';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(entity.position.x, entity.position.y, entity.radius + 5, 0, Math.PI * 2);
                this.ctx.stroke();
                
                // Health bar
                if (entity.health !== undefined && entity.maxHealth !== undefined) {
                    this.renderHealthBar(entity);
                }
            }
        });
    }
    
    renderHealthBar(entity) {
        const barWidth = entity.radius * 2;
        const barHeight = 6;
        const x = entity.position.x - barWidth / 2;
        const y = entity.position.y - entity.radius - 15;
        
        // Background
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(x, y, barWidth, barHeight);
        
        // Health
        const healthPercent = entity.health / entity.maxHealth;
        const healthColor = healthPercent > 0.5 ? '#0f0' : healthPercent > 0.25 ? '#ff0' : '#f00';
        this.ctx.fillStyle = healthColor;
        this.ctx.fillRect(x, y, barWidth * healthPercent, barHeight);
        
        // Border
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, y, barWidth, barHeight);
    }
    
    renderUI() {
        // Render minimap
        this.renderMinimap();
        
        // FPS counter (debug)
        if (this.showDebug) {
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '12px Arial';
            this.ctx.fillText(`FPS: ${Math.round(1000 / this.deltaTime)}`, 10, 20);
            this.ctx.fillText(`Entities: ${this.entities.length}`, 10, 35);
            this.ctx.fillText(`Selected: ${this.selectedEntities.length}`, 10, 50);
            this.ctx.fillText(`Zoom: ${this.camera.zoom.toFixed(2)}x`, 10, 65);
            this.ctx.fillText(`Camera: (${Math.round(this.camera.x)}, ${Math.round(this.camera.y)})`, 10, 80);
            
            // Show mouse coordinates if input handler is available
            if (window.game && window.game.inputHandler) {
                const mouse = window.game.inputHandler.mousePos;
                const worldMouse = window.game.inputHandler.worldMousePos;
                this.ctx.fillText(`Mouse Screen: (${Math.round(mouse.x)}, ${Math.round(mouse.y)})`, 10, 95);
                this.ctx.fillText(`Mouse World: (${Math.round(worldMouse.x)}, ${Math.round(worldMouse.y)})`, 10, 110);
            }
        }
    }
    
    renderMinimap() {
        const minimapCanvas = document.getElementById('minimapCanvas');
        const minimapCtx = minimapCanvas.getContext('2d');
        
        // Clear minimap
        minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
        
        // Scale factors
        const scaleX = minimapCanvas.width / this.worldWidth;
        const scaleY = minimapCanvas.height / this.worldHeight;
        
        // Draw entities on minimap
        this.entities.forEach(entity => {
            if (entity.position) {
                const x = entity.position.x * scaleX;
                const y = entity.position.y * scaleY;
                
                minimapCtx.fillStyle = entity.team === 'player' ? '#0f0' : '#f00';
                minimapCtx.fillRect(x - 1, y - 1, 2, 2);
            }
        });
        
        // Draw camera viewport
        minimapCtx.strokeStyle = '#fff';
        minimapCtx.lineWidth = 1;
        minimapCtx.strokeRect(
            this.camera.x * scaleX,
            this.camera.y * scaleY,
            this.canvas.width * scaleX / this.camera.zoom,
            this.canvas.height * scaleY / this.camera.zoom
        );
    }
    
    addEntity(entity) {
        // Only generate ID if entity doesn't already have one (for multiplayer sync)
        if (!entity.id) {
            entity.id = this.generateEntityId();
        }
        this.entities.push(entity);
    }
    
    addBullet(bullet) {
        this.bullets.push(bullet);
    }
    
    addEffect(effect) {
        this.effects.push(effect);
    }
    
    removeEntity(entity) {
        const index = this.entities.indexOf(entity);
        if (index > -1) {
            this.entities.splice(index, 1);
        }
        
        const selectedIndex = this.selectedEntities.indexOf(entity);
        if (selectedIndex > -1) {
            this.selectedEntities.splice(selectedIndex, 1);
        }
    }
    
    selectEntity(entity) {
        if (!this.selectedEntities.includes(entity)) {
            this.selectedEntities.push(entity);
        }
    }
    
    deselectEntity(entity) {
        const index = this.selectedEntities.indexOf(entity);
        if (index > -1) {
            this.selectedEntities.splice(index, 1);
        }
    }
    
    clearSelection() {
        this.selectedEntities = [];
    }
    
    moveCamera(dx, dy) {
        this.camera.x = MathUtils.clamp(
            this.camera.x + dx,
            this.camera.bounds.minX,
            this.camera.bounds.maxX - this.canvas.width / this.camera.zoom
        );
        this.camera.y = MathUtils.clamp(
            this.camera.y + dy,
            this.camera.bounds.minY,
            this.camera.bounds.maxY - this.canvas.height / this.camera.zoom
        );
    }
    
    setCameraPosition(x, y) {
        this.camera.x = MathUtils.clamp(
            x - this.canvas.width / (2 * this.camera.zoom),
            this.camera.bounds.minX,
            this.camera.bounds.maxX - this.canvas.width / this.camera.zoom
        );
        this.camera.y = MathUtils.clamp(
            y - this.canvas.height / (2 * this.camera.zoom),
            this.camera.bounds.minY,
            this.camera.bounds.maxY - this.canvas.height / this.camera.zoom
        );
    }
    
    screenToWorld(screenX, screenY) {
        return new Vector2(
            screenX / this.camera.zoom + this.camera.x,
            screenY / this.camera.zoom + this.camera.y
        );
    }
    
    worldToScreen(worldX, worldY) {
        return new Vector2(
            (worldX - this.camera.x) * this.camera.zoom,
            (worldY - this.camera.y) * this.camera.zoom
        );
    }
    
    generateEntityId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    getEntitiesInArea(x, y, width, height) {
        return this.entities.filter(entity => {
            if (!entity.position) return false;
            
            return entity.position.x >= x &&
                   entity.position.x <= x + width &&
                   entity.position.y >= y &&
                   entity.position.y <= y + height;
        });
    }
    
    getEntitiesNear(position, radius) {
        return this.entities.filter(entity => {
            if (!entity.position) return false;
            return entity.position.distance(position) <= radius;
        });
    }
}