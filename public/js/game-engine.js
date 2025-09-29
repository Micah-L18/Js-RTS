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
        this.worldWidth = 2000;
        this.worldHeight = 2000;
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
        
        // Handle page visibility changes to prevent game pause
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('🔇 Page became hidden - maintaining game loop');
                // Don't pause the game, but we can reduce update frequency if needed
            } else {
                console.log('👁️ Page became visible - normal game loop');
                // Reset timing to prevent huge deltaTime jumps
                this.lastFrameTime = performance.now();
            }
        });
        
        // Set up canvas properties
        this.ctx.imageSmoothingEnabled = false;
        
        console.log('Game Engine initialized successfully');
    }
    
    resizeCanvas() {
        // Get the device pixel ratio for high-DPI displays
        const dpr = window.devicePixelRatio || 1;
        
        // Set the actual canvas size in memory (scaled for device pixel ratio)
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        
        // Set the display size (CSS pixels)
        this.canvas.style.width = window.innerWidth + 'px';
        this.canvas.style.height = window.innerHeight + 'px';
        
        // Scale the context to match device pixel ratio
        this.ctx.scale(dpr, dpr);
        
        console.log(`Canvas resized to: ${this.canvas.width}x${this.canvas.height} (DPR: ${dpr})`);
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
    
    pause(shouldPause = null) {
        if (shouldPause !== null) {
            this.isPaused = shouldPause;
        } else {
            this.isPaused = !this.isPaused;
        }
        console.log(`Game ${this.isPaused ? 'paused' : 'resumed'}`);
    }
    
    setSpeed(speed) {
        this.gameSpeed = MathUtils.clamp(speed, 0.5, 3);
        console.log(`Game speed set to ${this.gameSpeed}x`);
    }
    
    gameLoop() {
        if (!this.isRunning) return;
        
        const currentTime = performance.now();
        
        // Prevent huge time jumps when returning to tab
        const maxDeltaTime = 100; // Cap at 100ms to prevent physics issues
        const rawDelta = currentTime - this.lastFrameTime;
        this.deltaTime = Math.min(rawDelta, maxDeltaTime) * this.gameSpeed;
        this.lastFrameTime = currentTime;
        
        if (!this.isPaused) {
            this.update(this.deltaTime);
        }
        
        this.render();
        
        // Use requestAnimationFrame normally, but add fallback timer for hidden pages
        if (document.hidden) {
            // When page is hidden, use setTimeout to maintain updates (but slower)
            setTimeout(() => this.gameLoop(), 100); // 10 FPS when hidden
        } else {
            // Normal frame rate when visible
            requestAnimationFrame(() => this.gameLoop());
        }
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
        
        // Render hover glow effects (before entities)
        this.renderHoverGlows();
        
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
        
        // Render minimap
        this.renderMinimap();
        
        // Render game-specific elements
        if (window.game && window.game.isInitialized) {
            window.game.render(this.ctx);
        }
    }
    
    renderGrid() {
        const gridSize = 50;
        const zoom = this.camera.zoom;
        
        // Don't render grid if zoomed out too much (grid would be too dense)
        if (zoom < 0.2) return;
        
        // Calculate visible world area (accounting for device pixel ratio)
        const dpr = window.devicePixelRatio || 1;
        const viewWidth = (this.canvas.width / dpr) / zoom;
        const viewHeight = (this.canvas.height / dpr) / zoom;
        
        // Calculate which grid lines are visible
        // Start from the first grid line before the visible area
        const firstVisibleX = Math.floor(this.camera.x / gridSize) * gridSize;
        const firstVisibleY = Math.floor(this.camera.y / gridSize) * gridSize;
        const lastVisibleX = this.camera.x + viewWidth;
        const lastVisibleY = this.camera.y + viewHeight;
        
        // Adjust line width and opacity based on zoom
        const lineWidth = Math.max(0.5, 1 / zoom);
        const alpha = Math.min(0.6, Math.max(0.1, zoom * 0.3));
        
        this.ctx.strokeStyle = '#444';
        this.ctx.lineWidth = lineWidth;
        this.ctx.globalAlpha = alpha;
        
        // Draw grid lines in world coordinates (camera transform already applied)
        // Vertical lines - these should be at fixed world positions like 0, 50, 100, 150, etc.
        for (let x = firstVisibleX; x <= lastVisibleX + gridSize; x += gridSize) {
            // Only draw lines within world bounds
            if (x >= 0 && x <= this.worldWidth) {
                this.ctx.beginPath();
                // Line should extend from top to bottom of visible area, clamped to world bounds
                const lineStartY = Math.max(0, firstVisibleY);
                const lineEndY = Math.min(this.worldHeight, lastVisibleY + gridSize);
                this.ctx.moveTo(x, lineStartY);
                this.ctx.lineTo(x, lineEndY);
                this.ctx.stroke();
            }
        }
        
        // Horizontal lines - these should be at fixed world positions like 0, 50, 100, 150, etc.
        for (let y = firstVisibleY; y <= lastVisibleY + gridSize; y += gridSize) {
            // Only draw lines within world bounds
            if (y >= 0 && y <= this.worldHeight) {
                this.ctx.beginPath();
                // Line should extend from left to right of visible area, clamped to world bounds
                const lineStartX = Math.max(0, firstVisibleX);
                const lineEndX = Math.min(this.worldWidth, lastVisibleX + gridSize);
                this.ctx.moveTo(lineStartX, y);
                this.ctx.lineTo(lineEndX, y);
                this.ctx.stroke();
            }
        }
        
        // Add snap point indicators when zoomed in enough
        if (zoom > 1.5) {
            const snapGridSize = 25; // Same as building placement snap
            const snapFirstVisibleX = Math.floor(this.camera.x / snapGridSize) * snapGridSize;
            const snapFirstVisibleY = Math.floor(this.camera.y / snapGridSize) * snapGridSize;
            const snapLastVisibleX = this.camera.x + viewWidth;
            const snapLastVisibleY = this.camera.y + viewHeight;
            
            this.ctx.fillStyle = '#666';
            this.ctx.globalAlpha = alpha * 0.5;
            
            for (let x = snapFirstVisibleX; x <= snapLastVisibleX + snapGridSize; x += snapGridSize) {
                for (let y = snapFirstVisibleY; y <= snapLastVisibleY + snapGridSize; y += snapGridSize) {
                    if (x >= 0 && x <= this.worldWidth && y >= 0 && y <= this.worldHeight) {
                        this.ctx.fillRect(x - 1/zoom, y - 1/zoom, 2/zoom, 2/zoom);
                    }
                }
            }
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
    
    renderHoverGlows() {
        this.entities.forEach(entity => {
            if (entity.isHovered) {
                // Create a glowing effect around hovered entities
                this.ctx.save();
                
                const glowRadius = entity.radius * 1.5 || 30; // Fallback radius if entity has no radius
                const glowIntensity = 0.3 + Math.sin(Date.now() * 0.005) * 0.1; // Pulsing effect
                
                // Create radial gradient for glow effect
                const gradient = this.ctx.createRadialGradient(
                    entity.position.x, entity.position.y, entity.radius || 20,
                    entity.position.x, entity.position.y, glowRadius
                );
                
                // Different glow colors for different entity types
                let glowColor = 'rgba(255, 255, 0, '; // Default yellow
                if (entity.type === 'building' || entity instanceof Building) {
                    glowColor = 'rgba(0, 150, 255, '; // Blue for buildings
                } else if (entity.constructor.name.includes('Unit')) {
                    glowColor = 'rgba(0, 255, 150, '; // Green for units
                }
                
                gradient.addColorStop(0, glowColor + (glowIntensity * 0.8) + ')');
                gradient.addColorStop(0.5, glowColor + (glowIntensity * 0.4) + ')');
                gradient.addColorStop(1, glowColor + '0)');
                
                this.ctx.fillStyle = gradient;
                this.ctx.beginPath();
                this.ctx.arc(entity.position.x, entity.position.y, glowRadius, 0, Math.PI * 2);
                this.ctx.fill();
                
                this.ctx.restore();
            }
        });
    }
    
    renderUI() {
        // Debug info hidden - uncomment to show debug info in top-left corner
        /*
        this.ctx.fillStyle = '#00ff00';
        this.ctx.font = '16px Arial';
        this.ctx.fillText(`Entities: ${this.entities.length}`, 10, 30);
        this.ctx.fillText(`Camera: (${Math.round(this.camera.x)}, ${Math.round(this.camera.y)})`, 10, 50);
        this.ctx.fillText(`Canvas: ${this.canvas.width} x ${this.canvas.height}`, 10, 70);
        this.ctx.fillText(`World: ${this.worldWidth} x ${this.worldHeight}`, 10, 90);
        this.ctx.fillText(`Running: ${this.isRunning}`, 10, 110);
        this.ctx.fillText(`Frame: ${Math.floor(performance.now() / 1000)}`, 10, 130);
        */
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
        
        // Draw camera viewport rectangle on minimap
        const dpr = window.devicePixelRatio || 1;
        const viewportWorldWidth = (this.canvas.width / dpr) / this.camera.zoom;
        const viewportWorldHeight = (this.canvas.height / dpr) / this.camera.zoom;
        
        // Camera position represents top-left, but minimap should show the viewport correctly
        minimapCtx.strokeStyle = '#fff';
        minimapCtx.lineWidth = 1;
        minimapCtx.strokeRect(
            this.camera.x * scaleX,
            this.camera.y * scaleY,
            viewportWorldWidth * scaleX,
            viewportWorldHeight * scaleY
        );
        
        // Draw camera center point for reference
        const cameraCenterX = (this.camera.x + viewportWorldWidth / 2) * scaleX;
        const cameraCenterY = (this.camera.y + viewportWorldHeight / 2) * scaleY;
        
        minimapCtx.fillStyle = '#fff';
        minimapCtx.fillRect(cameraCenterX - 1, cameraCenterY - 1, 2, 2);
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
            this.updateCommandPanelVisibility();
        }
    }
    
    deselectEntity(entity) {
        const index = this.selectedEntities.indexOf(entity);
        if (index > -1) {
            this.selectedEntities.splice(index, 1);
            this.updateCommandPanelVisibility();
        }
    }
    
    clearSelection() {
        this.selectedEntities = [];
        this.updateCommandPanelVisibility();
    }
    
    updateCommandPanelVisibility() {
        const commandPanel = document.getElementById('commandPanel');
        if (commandPanel) {
            // Show panel if we have buildings selected
            const hasSelectedBuildings = this.selectedEntities.some(entity => {
                // Check if entity is a building by class inheritance
                if (typeof Building !== 'undefined' && entity instanceof Building) {
                    return true;
                }
                // Fallback checks for building types
                return entity.constructor.name.includes('Building') || 
                       entity.type === 'building' ||
                       ['Base', 'Barracks', 'SupplyDepot', 'Reactor', 'Turret'].includes(entity.constructor.name);
            });
            commandPanel.style.display = hasSelectedBuildings ? 'block' : 'none';
        }
    }
    
    moveCamera(dx, dy) {
        const oldX = this.camera.x;
        const oldY = this.camera.y;
        const newX = this.camera.x + dx;
        const newY = this.camera.y + dy;
        
        // Calculate bounds for current zoom level
        const dpr = window.devicePixelRatio || 1;
        const viewWidth = (this.canvas.width / dpr) / this.camera.zoom;
        const viewHeight = (this.canvas.height / dpr) / this.camera.zoom;
        
        // Camera position represents top-left of viewport
        // Keep camera strictly within world bounds
        const maxX = Math.max(0, this.worldWidth - viewWidth);
        const maxY = Math.max(0, this.worldHeight - viewHeight);
        const minX = 0;
        const minY = 0;
        
        this.camera.x = MathUtils.clamp(newX, minX, maxX);
        this.camera.y = MathUtils.clamp(newY, minY, maxY);
    }
    
    setCameraPosition(x, y) {
        const dpr = window.devicePixelRatio || 1;
        const viewWidth = (this.canvas.width / dpr) / this.camera.zoom;
        const viewHeight = (this.canvas.height / dpr) / this.camera.zoom;
        
        // Camera position represents top-left of viewport
        // Keep camera strictly within world bounds
        const maxX = Math.max(0, this.worldWidth - viewWidth);
        const maxY = Math.max(0, this.worldHeight - viewHeight);
        const minX = 0;
        const minY = 0;
        
        this.camera.x = MathUtils.clamp(
            x - viewWidth / 2,
            minX,
            maxX
        );
        this.camera.y = MathUtils.clamp(
            y - viewHeight / 2,
            minY,
            maxY
        );
    }
    
    screenToWorld(screenX, screenY) {
        // Account for device pixel ratio in coordinate conversion
        const dpr = window.devicePixelRatio || 1;
        return new Vector2(
            (screenX / dpr) / this.camera.zoom + this.camera.x,
            (screenY / dpr) / this.camera.zoom + this.camera.y
        );
    }
    
    worldToScreen(worldX, worldY) {
        // Account for device pixel ratio in coordinate conversion
        const dpr = window.devicePixelRatio || 1;
        return new Vector2(
            ((worldX - this.camera.x) * this.camera.zoom) * dpr,
            ((worldY - this.camera.y) * this.camera.zoom) * dpr
        );
    }
    
    generateEntityId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    setWorldSize(width, height) {
        this.worldWidth = width;
        this.worldHeight = height;
        this.camera.bounds.maxX = width;
        this.camera.bounds.maxY = height;
        console.log(`World size set to ${width}x${height}, camera bounds updated`);
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