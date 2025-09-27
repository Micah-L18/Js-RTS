// Input Handler - Mouse and keyboard input management
console.log('Loading input handler...');

class InputHandler {
    constructor(gameEngine, game = null) {
        this.engine = gameEngine;
        this.canvas = gameEngine.canvas;
        this.game = game; // Reference to the main game instance
        
        // Mouse state
        this.mousePos = new Vector2(0, 0);
        this.worldMousePos = new Vector2(0, 0);
        this.isMouseDown = false;
        this.isDragging = false;
        this.dragStart = new Vector2(0, 0);
        this.dragEnd = new Vector2(0, 0);
        this.dragThreshold = 5;
        
        // Keyboard state
        this.keys = {};
        this.keyBindings = {
            'KeyW': 'moveUp',
            'KeyS': 'moveDown',
            'KeyA': 'moveLeft',
            'KeyD': 'moveRight',
            'Space': 'pause',
            'Escape': 'deselect',
            'Delete': 'delete',
            'KeyF': 'focus'
        };
        
        // Camera controls
        this.cameraSpeed = 300;
        this.edgeScrollMargin = 50;
        this.edgeScrollSpeed = 200;
        
        // Selection
        this.selectionBox = null;
        this.multiSelect = false;
        this.clickedOnEntity = false;
        
        // Movement indicators
        this.movementTargets = []; // Array of {position: Vector2, timestamp: number}
        this.movementIndicatorDuration = 2000; // 2 seconds
        
        this.init();
    }
    
    // Get the current player's team
    getPlayerTeam() {
        return this.game ? this.game.playerTeam : 'player';
    }
    
    // Check if an entity belongs to the current player
    isPlayerEntity(entity) {
        return entity && entity.team === this.getPlayerTeam();
    }
    
    // Check if an entity is an enemy
    isEnemyEntity(entity) {
        return entity && entity.team !== this.getPlayerTeam();
    }
    
    init() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Keyboard events
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
        
        // Prevent context menu
        this.canvas.oncontextmenu = (e) => e.preventDefault();
        
        console.log('Input handler initialized');
    }
    
    update(deltaTime) {
        this.updateKeyboardInput(deltaTime);
        this.updateEdgeScrolling(deltaTime);
        this.updateMovementTargets();
    }
    
    updateKeyboardInput(deltaTime) {
        const cameraSpeed = this.cameraSpeed * (deltaTime / 1000);
        
        if (this.isKeyPressed('moveUp')) {
            this.engine.moveCamera(0, -cameraSpeed);
        }
        if (this.isKeyPressed('moveDown')) {
            this.engine.moveCamera(0, cameraSpeed);
        }
        if (this.isKeyPressed('moveLeft')) {
            this.engine.moveCamera(-cameraSpeed, 0);
        }
        if (this.isKeyPressed('moveRight')) {
            this.engine.moveCamera(cameraSpeed, 0);
        }
    }
    
    updateEdgeScrolling(deltaTime) {
        const rect = this.canvas.getBoundingClientRect();
        const scrollSpeed = this.edgeScrollSpeed * (deltaTime / 1000);
        
        if (this.mousePos.x < this.edgeScrollMargin) {
            this.engine.moveCamera(-scrollSpeed, 0);
        } else if (this.mousePos.x > rect.width - this.edgeScrollMargin) {
            this.engine.moveCamera(scrollSpeed, 0);
        }
        
        if (this.mousePos.y < this.edgeScrollMargin) {
            this.engine.moveCamera(0, -scrollSpeed);
        } else if (this.mousePos.y > rect.height - this.edgeScrollMargin) {
            this.engine.moveCamera(0, scrollSpeed);
        }
    }
    
    updateWorldMousePosition() {
        this.worldMousePos = this.engine.screenToWorld(this.mousePos.x, this.mousePos.y);
    }
    
    onMouseDown(e) {
        e.preventDefault();
        
        this.updateMousePosition(e);
        this.updateWorldMousePosition(); // Fix: Update world coordinates too
        this.isMouseDown = true;
        this.dragStart = this.mousePos.clone();
        this.multiSelect = e.ctrlKey || e.shiftKey;
        
        if (e.button === 0) { // Left click
            this.handleLeftMouseDown();
        } else if (e.button === 2) { // Right click
            this.handleRightMouseDown();
        }
    }
    
    onMouseMove(e) {
        this.updateMousePosition(e);
        this.updateWorldMousePosition(); // Update world coordinates on mouse move too
        
        // Check for building hover and update cursor
        this.updateCursorForBuildingHover();
        
        if (this.isMouseDown && !this.clickedOnEntity) {
            const distance = this.mousePos.distance(this.dragStart);
            
            if (distance > this.dragThreshold) {
                this.isDragging = true;
                this.dragEnd = this.mousePos.clone();
                
                // Update selection box
                this.updateSelectionBox();
            }
        }
    }
    
    updateCursorForBuildingHover() {
        // Don't change cursor if in building placement mode or currently dragging
        if ((this.game && this.game.buildMode === 'building') || this.isDragging) {
            return;
        }
        
        // Check if mouse is over a building (using small radius for point detection)
        const entitiesAtMouse = this.engine.getEntitiesNear(this.worldMousePos, 10);
        const buildingsAtMouse = entitiesAtMouse.filter(entity => 
            entity.type === 'building' || entity instanceof Building
        );
        
        if (buildingsAtMouse.length > 0) {
            // Change cursor to pointer when hovering over buildings
            this.canvas.style.cursor = 'pointer';
        } else {
            // Reset to default cursor
            this.canvas.style.cursor = 'crosshair';
        }
    }
    
    onMouseUp(e) {
        e.preventDefault();
        
        this.updateMousePosition(e);
        
        if (e.button === 0) { // Left click
            this.handleLeftMouseUp();
        }
        
        this.isMouseDown = false;
        this.isDragging = false;
        this.selectionBox = null;
        this.clickedOnEntity = false; // Reset the entity click flag
    }
    
    onWheel(e) {
        e.preventDefault();
        
        const zoomFactor = 1.1; // Multiplicative zoom factor
        const zoomDirection = e.deltaY > 0 ? -1 : 1;
        const oldZoom = this.engine.camera.zoom;
        
        // Use multiplicative scaling for more natural feel
        const newZoom = MathUtils.clamp(
            zoomDirection > 0 ? oldZoom * zoomFactor : oldZoom / zoomFactor,
            0.5, 3.0
        );
        
        if (Math.abs(oldZoom - newZoom) < 0.001) return; // No significant zoom change
        
        // Get world position under mouse before zoom
        const mouseWorldPos = this.engine.screenToWorld(this.mousePos.x, this.mousePos.y);
        
        // Update zoom
        this.engine.camera.zoom = newZoom;
        
        // Calculate where the mouse world position is now in screen coordinates
        const newMouseScreenPos = this.engine.worldToScreen(mouseWorldPos.x, mouseWorldPos.y);
        
        // Adjust camera to keep the world point under the mouse cursor
        const deltaX = (this.mousePos.x - newMouseScreenPos.x) / newZoom;
        const deltaY = (this.mousePos.y - newMouseScreenPos.y) / newZoom;
        
        this.engine.camera.x += deltaX;
        this.engine.camera.y += deltaY;
        
        // Clamp camera to bounds
        this.engine.camera.x = MathUtils.clamp(
            this.engine.camera.x,
            this.engine.camera.bounds.minX,
            this.engine.camera.bounds.maxX - this.engine.canvas.width / this.engine.camera.zoom
        );
        this.engine.camera.y = MathUtils.clamp(
            this.engine.camera.y,
            this.engine.camera.bounds.minY,
            this.engine.camera.bounds.maxY - this.engine.canvas.height / this.engine.camera.zoom
        );
    }
    
    onKeyDown(e) {
        this.keys[e.code] = true;
        
        const action = this.keyBindings[e.code];
        if (action) {
            this.handleKeyAction(action, true);
            e.preventDefault();
        }
    }
    
    onKeyUp(e) {
        this.keys[e.code] = false;
        
        const action = this.keyBindings[e.code];
        if (action) {
            this.handleKeyAction(action, false);
        }
    }
    
    handleLeftMouseDown() {
        // If we're in building placement mode, don't select entities
        if (this.game && this.game.buildMode === 'building') {
            return; // Let the building placement handler deal with the click
        }
        
        // Check if we clicked on an entity first
        const clickedEntity = this.getEntityAtPosition(this.worldMousePos);
        
        if (clickedEntity) {
            // Store that we clicked on an entity to prevent drag selection
            this.clickedOnEntity = true;
            
            // Only allow selection of player's own entities
            if (this.isPlayerEntity(clickedEntity)) {
                if (!this.multiSelect) {
                    this.engine.clearSelection();
                }
                this.engine.selectEntity(clickedEntity);
                clickedEntity.selected = true;
                console.log(`Selected ${clickedEntity.constructor.name} at ${clickedEntity.position.x}, ${clickedEntity.position.y}`);
                
                // Show modal for buildings
                if (clickedEntity instanceof Building && this.game) {
                    this.game.showBuildingModal(clickedEntity.constructor.name);
                }
            } else {
                console.log(`Cannot select enemy ${clickedEntity.constructor.name}`);
            }
        } else {
            this.clickedOnEntity = false;
            if (!this.multiSelect) {
                this.engine.clearSelection();
                this.clearUnitSelection();
            }
        }
    }
    
    handleLeftMouseUp() {
        if (this.isDragging && this.selectionBox) {
            // Box selection
            this.performBoxSelection();
        }
    }
    
    handleRightMouseDown() {
        // First check if we're in building placement mode
        if (this.game && this.game.buildMode === 'building') {
            this.game.exitBuildingPlacement();
            return;
        }
        
        // Command selected units
        if (this.engine.selectedEntities.length > 0) {
            const targetEntity = this.getEntityAtPosition(this.worldMousePos);
            
            if (targetEntity && this.isEnemyEntity(targetEntity) && !targetEntity.isDead) {
                // Attack command - can attack both units and buildings
                this.commandSelectedUnits('attack', targetEntity);
                console.log(`Attack command issued on ${targetEntity.constructor.name}`);
            } else {
                // Move command
                this.commandSelectedUnits('move', this.worldMousePos);
                console.log(`Move command issued to ${this.worldMousePos.x}, ${this.worldMousePos.y}`);
            }
        }
    }
    
    handleKeyAction(action, isPressed) {
        if (!isPressed) return;
        
        switch (action) {
            case 'pause':
                this.engine.pause();
                break;
            case 'deselect':
                // Exit building placement mode if active
                if (this.game && this.game.buildMode === 'building') {
                    this.game.exitBuildingPlacement();
                } else {
                    this.engine.clearSelection();
                    this.clearUnitSelection();
                }
                break;
            case 'delete':
                this.deleteSelectedUnits();
                break;
            case 'focus':
                this.focusOnSelectedUnits();
                break;
        }
    }
    
    updateMousePosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        
        // Simple coordinate calculation without DPR scaling
        this.mousePos.x = e.clientX - rect.left;
        this.mousePos.y = e.clientY - rect.top;
    }
    
    updateSelectionBox() {
        if (!this.isDragging) return;
        
        const startWorld = this.engine.screenToWorld(this.dragStart.x, this.dragStart.y);
        const endWorld = this.engine.screenToWorld(this.dragEnd.x, this.dragEnd.y);
        
        this.selectionBox = {
            x: Math.min(startWorld.x, endWorld.x),
            y: Math.min(startWorld.y, endWorld.y),
            width: Math.abs(endWorld.x - startWorld.x),
            height: Math.abs(endWorld.y - startWorld.y)
        };
    }
    
    performBoxSelection() {
        if (!this.selectionBox) return;
        
        if (!this.multiSelect) {
            this.engine.clearSelection();
            this.clearUnitSelection();
        }
        
        const unitsInBox = this.engine.getEntitiesInArea(
            this.selectionBox.x,
            this.selectionBox.y,
            this.selectionBox.width,
            this.selectionBox.height
        ).filter(entity => entity instanceof Unit && this.isPlayerEntity(entity));
        
        unitsInBox.forEach(unit => {
            this.engine.selectEntity(unit);
            unit.selected = true;
        });
    }
    
    getUnitAtPosition(worldPos) {
        return this.engine.entities.find(entity => {
            if (!(entity instanceof Unit)) return false;
            
            const distance = entity.position.distance(worldPos);
            return distance <= entity.radius;
        });
    }
    
    getEntityAtPosition(worldPos) {
        // Check buildings first (they're usually larger and should take priority)
        const building = this.engine.entities.find(entity => {
            if (!(entity instanceof Building)) return false;
            
            const halfWidth = entity.width / 2;
            const halfHeight = entity.height / 2;
            
            return worldPos.x >= entity.position.x - halfWidth &&
                   worldPos.x <= entity.position.x + halfWidth &&
                   worldPos.y >= entity.position.y - halfHeight &&
                   worldPos.y <= entity.position.y + halfHeight;
        });
        
        if (building) return building;
        
        // If no building found, check for units
        return this.getUnitAtPosition(worldPos);
    }
    
    commandSelectedUnits(command, target) {
        const selectedUnits = this.engine.selectedEntities.filter(entity => entity instanceof Unit);
        
        if (selectedUnits.length === 0) return;
        
        // Only command player's own units
        const playerUnits = selectedUnits.filter(unit => this.isPlayerEntity(unit));
        if (playerUnits.length === 0) return;
        
        switch (command) {
            case 'move':
                // Calculate formation positions first
                const formationPositions = this.calculateFormationPositions(playerUnits, target);
                
                // Add movement target indicator
                this.addMovementTarget(target);
                
                // Move units locally and send their actual destinations
                playerUnits.forEach((unit, index) => {
                    const unitDestination = formationPositions[index];
                    unit.moveTo(unitDestination);
                    
                    // Send multiplayer action with actual formation position
                    if (this.game && this.game.isMultiplayer) {
                        this.game.sendMultiplayerAction('unitMove', {
                            unitId: unit.id,
                            destination: { x: unitDestination.x, y: unitDestination.y },
                            team: unit.team
                        });
                    }
                });
                break;
            case 'attack':
                playerUnits.forEach(unit => {
                    unit.attackUnit(target);
                    
                    // Send multiplayer action
                    if (this.game && this.game.isMultiplayer) {
                        this.game.sendMultiplayerAction('attack', {
                            attackerId: unit.id,
                            targetId: target.id,
                            team: unit.team
                        });
                    }
                });
                break;
        }
    }
    
    calculateFormationPositions(units, destination) {
        if (units.length === 1) {
            return [destination];
        }
        
        // Calculate formation positions
        const center = destination;
        const spacing = 40;
        const unitsPerRow = Math.ceil(Math.sqrt(units.length));
        const positions = [];
        
        units.forEach((unit, index) => {
            const row = Math.floor(index / unitsPerRow);
            const col = index % unitsPerRow;
            
            const offsetX = (col - (unitsPerRow - 1) / 2) * spacing;
            const offsetY = row * spacing;
            
            const unitDestination = new Vector2(
                center.x + offsetX,
                center.y + offsetY
            );
            
            positions.push(unitDestination);
        });
        
        return positions;
    }
    
    moveUnitsInFormation(units, destination) {
        const positions = this.calculateFormationPositions(units, destination);
        units.forEach((unit, index) => {
            unit.moveTo(positions[index]);
        });
    }
    
    addMovementTarget(position) {
        this.movementTargets.push({
            position: position.clone(),
            timestamp: Date.now()
        });
    }
    
    updateMovementTargets() {
        const currentTime = Date.now();
        this.movementTargets = this.movementTargets.filter(target => 
            currentTime - target.timestamp < this.movementIndicatorDuration
        );
    }
    
    clearUnitSelection() {
        this.engine.entities.forEach(entity => {
            if (entity instanceof Unit) {
                entity.selected = false;
            }
        });
    }
    
    deleteSelectedUnits() {
        const selectedUnits = this.engine.selectedEntities.filter(entity => entity instanceof Unit);
        selectedUnits.forEach(unit => {
            unit.die();
        });
        this.engine.clearSelection();
    }
    
    focusOnSelectedUnits() {
        const selectedUnits = this.engine.selectedEntities.filter(entity => entity instanceof Unit);
        if (selectedUnits.length === 0) return;
        
        // Calculate center of selected units
        let centerX = 0, centerY = 0;
        selectedUnits.forEach(unit => {
            centerX += unit.position.x;
            centerY += unit.position.y;
        });
        centerX /= selectedUnits.length;
        centerY /= selectedUnits.length;
        
        this.engine.setCameraPosition(centerX, centerY);
    }
    
    isKeyPressed(action) {
        for (const [key, keyAction] of Object.entries(this.keyBindings)) {
            if (keyAction === action && this.keys[key]) {
                return true;
            }
        }
        return false;
    }
    
    render(ctx) {
        // Render selection box
        if (this.isDragging && this.selectionBox) {
            const startScreen = this.engine.worldToScreen(this.selectionBox.x, this.selectionBox.y);
            const endScreen = this.engine.worldToScreen(
                this.selectionBox.x + this.selectionBox.width,
                this.selectionBox.y + this.selectionBox.height
            );
            
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transformation
            
            ctx.strokeStyle = '#00ff00';
            ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
            ctx.lineWidth = 1;
            
            const width = endScreen.x - startScreen.x;
            const height = endScreen.y - startScreen.y;
            
            ctx.fillRect(startScreen.x, startScreen.y, width, height);
            ctx.strokeRect(startScreen.x, startScreen.y, width, height);
            
            ctx.restore();
        }
        
        // Render movement target indicators
        this.renderMovementTargets(ctx);
        
        // Debug: render mouse crosshair in world space
        if (this.engine.showDebug && this.worldMousePos) {
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            // Vertical line
            ctx.moveTo(this.worldMousePos.x, this.worldMousePos.y - 10);
            ctx.lineTo(this.worldMousePos.x, this.worldMousePos.y + 10);
            // Horizontal line
            ctx.moveTo(this.worldMousePos.x - 10, this.worldMousePos.y);
            ctx.lineTo(this.worldMousePos.x + 10, this.worldMousePos.y);
            ctx.stroke();
        }
    }
    
    renderMovementTargets(ctx) {
        const currentTime = Date.now();
        
        this.movementTargets.forEach(target => {
            const age = currentTime - target.timestamp;
            const progress = age / this.movementIndicatorDuration;
            const alpha = Math.max(0, 1 - progress);
            
            if (alpha > 0) {
                // Convert world position to screen position
                const screenPos = this.engine.worldToScreen(target.position.x, target.position.y);
                
                ctx.save();
                
                // Animated expanding circle
                const baseRadius = 15;
                const maxRadius = 25;
                const radius = baseRadius + (maxRadius - baseRadius) * progress;
                
                // Main circle
                ctx.strokeStyle = `rgba(0, 255, 0, ${alpha})`;
                ctx.fillStyle = `rgba(0, 255, 0, ${alpha * 0.2})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                
                // Inner dot
                ctx.fillStyle = `rgba(0, 255, 0, ${alpha})`;
                ctx.beginPath();
                ctx.arc(screenPos.x, screenPos.y, 3, 0, Math.PI * 2);
                ctx.fill();
                
                // Directional arrows (4 small arrows pointing outward)
                const arrowLength = 8;
                const arrowRadius = radius + 5;
                for (let i = 0; i < 4; i++) {
                    const angle = (i * Math.PI * 0.5) + (progress * Math.PI * 0.25); // Slight rotation animation
                    const arrowX = screenPos.x + Math.cos(angle) * arrowRadius;
                    const arrowY = screenPos.y + Math.sin(angle) * arrowRadius;
                    
                    ctx.strokeStyle = `rgba(255, 255, 0, ${alpha})`;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(arrowX - Math.cos(angle) * arrowLength, arrowY - Math.sin(angle) * arrowLength);
                    ctx.lineTo(arrowX, arrowY);
                    ctx.lineTo(arrowX - Math.cos(angle + 0.5) * arrowLength * 0.6, arrowY - Math.sin(angle + 0.5) * arrowLength * 0.6);
                    ctx.moveTo(arrowX, arrowY);
                    ctx.lineTo(arrowX - Math.cos(angle - 0.5) * arrowLength * 0.6, arrowY - Math.sin(angle - 0.5) * arrowLength * 0.6);
                    ctx.stroke();
                }
                
                ctx.restore();
            }
        });
    }
}