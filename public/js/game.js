// Main Game Class - Ties everything together
console.log('Loading main game class...');

class Game {
    constructor() {
        this.engine = null;
        this.inputHandler = null;
        this.resources = null;
        this.uiRenderer = null;
        this.effects = [];
        
        this.isInitialized = false;
        this.gameSpeed = 1;
        this.buildMode = null; // null, 'building', 'unit'
        this.buildingToPlace = null;
        
        // Multiplayer properties
        this.isMultiplayer = false;
        this.playerTeam = 'player';
        this.multiplayerManager = null;
        this.positionSyncTimer = null;
        
        // Don't auto-initialize in multiplayer mode
        if (!window.multiplayerManager) {
            this.init();
        }
    }
    
    init() {
        try {
            console.log('Starting game initialization...');
            
            // Initialize core systems
            console.log('Creating GameEngine...');
            this.engine = new GameEngine();
            
            console.log('Creating ResourceManager...');
            this.resources = new ResourceManager();
            
            console.log('Creating UIRenderer...');
            this.uiRenderer = new UIRenderer();
            
            console.log('Creating InputHandler...');
            this.inputHandler = new InputHandler(this.engine, this);
            
            console.log('Core systems created, setting up UI...');
            
            // Set up UI event handlers
            this.setupUIHandlers();
            
            console.log('UI handlers set up, creating initial state...');
            
            // Create initial game state
            this.createInitialState();
            
            this.isInitialized = true;
            console.log('Game initialized successfully');
            
            // Start the game
            this.start();
            
        } catch (error) {
            console.error('Failed to initialize game:', error);
            console.error('Error stack:', error.stack);
        }
    }
    
    setupUIHandlers() {
        console.log('Setting up UI handlers...');
        
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(tabBtn => {
            tabBtn.addEventListener('click', () => {
                const tabName = tabBtn.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });
        
        // Unit production buttons
        const unitButtons = document.querySelectorAll('.unit-btn');
        console.log(`Found ${unitButtons.length} unit buttons`);
        unitButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const unitType = button.getAttribute('data-unit');
                console.log(`Unit button clicked: ${unitType}`);
                console.log('Button element:', button);
                console.log('Event:', e);
                this.handleUnitProduction(unitType);
            });
        });
        
        // Building buttons
        const buildingButtons = document.querySelectorAll('.building-btn');
        console.log(`Found ${buildingButtons.length} building buttons`);
        buildingButtons.forEach(button => {
            button.addEventListener('click', () => {
                const buildingType = button.getAttribute('data-building');
                console.log(`Building button clicked: ${buildingType}`);
                this.handleBuildingPlacement(buildingType);
            });
        });
        
        // Minimap click
        const minimapCanvas = document.getElementById('minimapCanvas');
        if (minimapCanvas) {
            minimapCanvas.addEventListener('click', (e) => {
                console.log('Minimap clicked');
                this.handleMinimapClick(e);
            });
            console.log('Minimap click handler added');
        } else {
            console.warn('Minimap canvas not found');
        }
        
        // Action buttons
        const stopBtn = document.getElementById('stopBtn');
        const holdBtn = document.getElementById('holdBtn');
        
        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                this.handleUnitAction('stop');
            });
        }
        
        if (holdBtn) {
            holdBtn.addEventListener('click', () => {
                this.handleUnitAction('hold');
            });
        }

        // Modal event handlers
        this.setupModalHandlers();
        
        console.log('UI handlers setup complete');
    }

    setupModalHandlers() {
        // Remove existing event listeners first to prevent duplicates
        document.querySelectorAll('.modal-btn').forEach(button => {
            // Clone the node to remove all event listeners
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
        });
        
        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => {
                this.closeAllModals();
            });
        });

        // Click outside modal to close
        document.querySelectorAll('.building-modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeAllModals();
                }
            });
        });

        // Modal button handlers - re-attach after cloning
        document.querySelectorAll('.modal-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (button.classList.contains('unit-btn')) {
                    const unitType = button.getAttribute('data-unit');
                    this.handleUnitProduction(unitType);
                } else if (button.classList.contains('building-btn')) {
                    const buildingType = button.getAttribute('data-building');
                    this.handleBuildingPlacement(buildingType);
                }
                
                this.closeAllModals();
            });
        });
    }

    closeAllModals() {
        document.querySelectorAll('.building-modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    showBuildingModal(buildingType) {
        this.closeAllModals();
        
        if (buildingType === 'Base') {
            document.getElementById('hqModal').style.display = 'flex';
        } else if (buildingType === 'Barracks') {
            document.getElementById('barracksModal').style.display = 'flex';
        }
    }
    
    switchTab(tabName) {
        // Remove active class from all tabs and sections
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.command-section').forEach(section => section.classList.remove('active'));
        
        // Add active class to selected tab and section
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}Tab`).classList.add('active');
    }
    
    handleUnitAction(action) {
        const selectedUnits = this.engine.selectedEntities.filter(entity => entity instanceof Unit);
        
        selectedUnits.forEach(unit => {
            switch (action) {
                case 'stop':
                    unit.destination = null;
                    unit.attackTarget = null;
                    unit.state = 'idle';
                    unit.velocity = new Vector2(0, 0);
                    break;
                case 'hold':
                    unit.destination = null;
                    unit.state = 'idle';
                    break;
            }
        });
        
        console.log(`${action} command executed on ${selectedUnits.length} units`);
    }
    
    createInitialState() {
        console.log('Creating initial state...');
        
        // Check if classes are available
        if (typeof Base === 'undefined') {
            console.error('Base class not found!');
            return;
        }
        if (typeof Marine === 'undefined') {
            console.error('Marine class not found!');
            return;
        }
        
        try {
            if (this.isMultiplayer) {
                // Multiplayer initialization - each player gets one base and some starting units
                console.log(`Creating multiplayer initial state for ${this.playerTeam}`);
                
                // Player positions
                let playerBasePos, playerUnitPos, enemyBasePos, enemyUnitPos, cameraPos;
                
                if (this.playerTeam === 'player') {
                    // Blue team (bottom-left)
                    playerBasePos = { x: 200, y: 200 };
                    playerUnitPos = { x: 150, y: 280 };
                    enemyBasePos = { x: 1800, y: 1200 };
                    enemyUnitPos = { x: 1750, y: 1280 };
                    cameraPos = { x: 200, y: 200 };
                } else {
                    // Red team (top-right) 
                    playerBasePos = { x: 1800, y: 1200 };
                    playerUnitPos = { x: 1750, y: 1280 };
                    enemyBasePos = { x: 200, y: 200 };
                    enemyUnitPos = { x: 150, y: 280 };
                    cameraPos = { x: 1800, y: 1200 };
                }
                
                // Create bases with deterministic IDs
                const playerBase = new Base(playerBasePos.x, playerBasePos.y, this.playerTeam);
                playerBase.isUnderConstruction = false;
                playerBase.id = `base_${this.playerTeam}`; // Deterministic ID
                this.engine.entities.push(playerBase); // Add directly to avoid ID generation
                
                const enemyBase = new Base(enemyBasePos.x, enemyBasePos.y, this.playerTeam === 'player' ? 'enemy' : 'player');
                enemyBase.isUnderConstruction = false;
                enemyBase.id = `base_${this.playerTeam === 'player' ? 'enemy' : 'player'}`; // Deterministic ID
                this.engine.entities.push(enemyBase); // Add directly to avoid ID generation
                
                // Create starting units with deterministic IDs
                const marine1 = new Marine(playerUnitPos.x, playerUnitPos.y, this.playerTeam);
                marine1.id = `marine1_${this.playerTeam}`;
                this.engine.entities.push(marine1);
                
                const marine2 = new Marine(playerUnitPos.x + 30, playerUnitPos.y, this.playerTeam);
                marine2.id = `marine2_${this.playerTeam}`;
                this.engine.entities.push(marine2);
                
                // Create enemy starting units that both players can see
                const enemyTeam = this.playerTeam === 'player' ? 'enemy' : 'player';
                const enemyMarine1 = new Marine(enemyUnitPos.x, enemyUnitPos.y, enemyTeam);
                enemyMarine1.id = `marine1_${enemyTeam}`;
                this.engine.entities.push(enemyMarine1);
                
                const enemyMarine2 = new Marine(enemyUnitPos.x + 30, enemyUnitPos.y, enemyTeam);
                enemyMarine2.id = `marine2_${enemyTeam}`;
                this.engine.entities.push(enemyMarine2);
                
                // Set camera to player's starting position
                this.engine.setCameraPosition(cameraPos.x, cameraPos.y);
                
            } else {
                // Single player initialization (original)
                const base = new Base(200, 200, 'player');
                base.isUnderConstruction = false;
                this.engine.addEntity(base);
                
                const marine1 = new Marine(150, 280, 'player');
                const marine2 = new Marine(180, 280, 'player');
                this.engine.addEntity(marine1);
                this.engine.addEntity(marine2);
                
                if (typeof Warthog !== 'undefined') {
                    const warthog = new Warthog(250, 280, 'player');
                    this.engine.addEntity(warthog);
                }
                
                const enemyBase = new Base(1800, 1200, 'enemy');
                enemyBase.isUnderConstruction = false;
                this.engine.addEntity(enemyBase);
                
                const enemyMarine1 = new Marine(1750, 1280, 'enemy');
                const enemyMarine2 = new Marine(1780, 1280, 'enemy');
                this.engine.addEntity(enemyMarine1);
                this.engine.addEntity(enemyMarine2);
                
                if (typeof Scorpion !== 'undefined') {
                    const enemyScorpion = new Scorpion(1850, 1280, 'enemy');
                    this.engine.addEntity(enemyScorpion);
                }
                
                this.engine.setCameraPosition(200, 200);
            }
            
            console.log('Initial game state created successfully');
        } catch (error) {
            console.error('Error creating initial state:', error);
        }
    }
    
    start() {
        if (!this.isInitialized) {
            console.error('Cannot start game - not initialized');
            return;
        }
        
        this.engine.start();
        console.log('Game started');
    }
    
    // Multiplayer initialization
    initializeMultiplayer(playerTeam, multiplayerManager) {
        console.log(`Initializing multiplayer as ${playerTeam}`);
        this.isMultiplayer = true;
        this.playerTeam = playerTeam;
        this.multiplayerManager = multiplayerManager;
        
        // Initialize the game
        this.init();
        
        // Start position sync timer
        this.positionSyncTimer = setInterval(() => {
            this.sendPositionSync();
        }, 1000); // Sync every second
    }
    
    // Handle actions from remote players
    handleRemoteAction(actionData) {
        const { action, data, playerId } = actionData;
        
        switch (action) {
            case 'unitMove':
                this.handleRemoteUnitMove(data);
                break;
            case 'buildingPlace':
                this.handleRemoteBuildingPlace(data);
                break;
            case 'unitProduce':
                this.handleRemoteUnitProduce(data);
                break;
            case 'unitSpawn':
                this.handleRemoteUnitSpawn(data);
                break;
            case 'attack':
                this.handleRemoteAttack(data);
                break;
            case 'unitDamage':
                this.handleRemoteUnitDamage(data);
                break;
            case 'attackPerformed':
                this.handleRemoteAttackPerformed(data);
                break;
            case 'positionSync':
                this.handleRemotePositionSync(data);
                break;
            default:
                console.log('Unknown remote action:', action);
        }
    }
    
    // Send actions to other players
    sendMultiplayerAction(action, data) {
        if (this.isMultiplayer && this.multiplayerManager) {
            this.multiplayerManager.sendGameAction(action, data);
        }
    }
    
    // Remote action handlers
    handleRemoteUnitMove(data) {
        console.log('Remote unit move data:', data);
        const unit = this.engine.entities.find(e => e.id === data.unitId);
        
        if (unit) {
            console.log(`Found unit: ${unit.constructor.name}, team: ${unit.team}, playerTeam: ${this.playerTeam}`);
            if (unit.team !== this.playerTeam) {
                // Create Vector2 object for destination
                const destination = new Vector2(data.destination.x, data.destination.y);
                unit.moveTo(destination);
                console.log(`Remote unit ${unit.id} moved to (${data.destination.x}, ${data.destination.y})`);
            } else {
                console.log('Ignoring move for own unit');
            }
        } else {
            console.log(`Unit with ID ${data.unitId} not found`);
        }
    }
    
    handleRemoteBuildingPlace(data) {
        console.log('Remote building placement data:', data);
        
        // Only allow enemy team buildings to be placed remotely
        if (data.team !== this.playerTeam) {
            try {
                if (typeof BuildingFactory === 'undefined') {
                    console.error('BuildingFactory is not defined!');
                    return;
                }
                
                const building = BuildingFactory.create(data.type, data.position.x, data.position.y, data.team);
                // Set the same ID to keep sync
                building.id = data.buildingId;
                this.engine.entities.push(building); // Add directly to avoid generating new ID
                console.log(`Remote building placed: ${data.type} by ${data.team} at (${data.position.x}, ${data.position.y})`);
            } catch (error) {
                console.error('Error placing remote building:', error);
            }
        }
    }
    
    handleRemoteUnitProduce(data) {
        // Find the building and add unit to production queue
        const building = this.engine.entities.find(e => e.id === data.buildingId);
        if (building && building.team !== this.playerTeam) {
            building.addToProductionQueue(data.unitType, true); // Skip resource deduction for remote actions
            console.log(`Remote unit production: ${data.unitType} by ${data.team}`);
        }
    }
    
    handleRemoteUnitSpawn(data) {
        // Only spawn enemy units remotely
        if (data.team !== this.playerTeam) {
            const unit = UnitFactory.create(data.unitType, data.position.x, data.position.y, data.team);
            // Set the same ID to keep sync
            unit.id = data.unitId;
            this.engine.entities.push(unit); // Add directly to avoid generating new ID
            console.log(`Remote unit spawned: ${data.unitType} by ${data.team} at (${data.position.x}, ${data.position.y})`);
        }
    }
    
    handleRemoteAttack(data) {
        const attacker = this.engine.entities.find(e => e.id === data.attackerId);
        const target = this.engine.entities.find(e => e.id === data.targetId);
        if (attacker && target && attacker.team !== this.playerTeam) {
            // Set attack target for enemy unit so we see the visual attack
            attacker.attackUnit(target);
        }
    }
    
    handleRemoteUnitDamage(data) {
        const unit = this.engine.entities.find(e => e.id === data.targetId);
        if (unit && unit.team !== this.playerTeam) {
            // Apply damage without triggering another multiplayer event
            unit.takeDamage(data.damage, true);
            console.log(`Remote damage: ${unit.constructor.name} health updated to ${unit.health}`);
        }
    }
    
    handleRemoteAttackPerformed(data) {
        const attacker = this.engine.entities.find(e => e.id === data.attackerId);
        const target = this.engine.entities.find(e => e.id === data.targetId);
        if (attacker && target && attacker.team !== this.playerTeam) {
            // Show visual attack effects only (no damage calculation)
            attacker.performVisualAttack(target);
        }
    }
    
    handleRemotePositionSync(data) {
        // Update positions of enemy units
        data.units.forEach(unitData => {
            const unit = this.engine.entities.find(e => e.id === unitData.id);
            if (unit && unit.team !== this.playerTeam) {
                // Smoothly update position instead of teleporting
                unit.position.x = unitData.x;
                unit.position.y = unitData.y;
            }
        });
    }
    
    sendPositionSync() {
        if (!this.isMultiplayer) return;
        
        // Gather positions of our units
        const ourUnits = this.engine.entities
            .filter(e => e.type === 'unit' && e.team === this.playerTeam)
            .map(unit => ({
                id: unit.id,
                x: unit.position.x,
                y: unit.position.y,
                team: unit.team
            }));
        
        if (ourUnits.length > 0) {
            this.sendMultiplayerAction('positionSync', {
                units: ourUnits
            });
        }
    }

    update(deltaTime) {
        if (!this.isInitialized || this.engine.isPaused) return;
        
        // Update core systems
        this.inputHandler.update(deltaTime);
        this.resources.update(deltaTime);
        this.uiRenderer.update();
        
        // Update effects
        this.effects.forEach(effect => effect.update(deltaTime));
        this.effects = this.effects.filter(effect => !effect.isDead);
        
        // Check win condition in multiplayer
        if (this.isMultiplayer) {
            this.checkWinCondition();
        }
        
        // Update debug panel
        this.updateDebugPanel();
    }
    
    // Check win condition (HQ destruction)
    checkWinCondition() {
        const playerBases = this.engine.entities.filter(e => 
            e instanceof Base && e.team === this.playerTeam && !e.isDead
        );
        const enemyBases = this.engine.entities.filter(e => 
            e instanceof Base && e.team !== this.playerTeam && !e.isDead
        );
        
        // Player loses if their HQ is destroyed
        if (playerBases.length === 0) {
            console.log('Player HQ destroyed - Game Over!');
            this.endGame(this.playerTeam === 'player' ? 'enemy' : 'player');
            return;
        }
        
        // Player wins if enemy HQ is destroyed
        if (enemyBases.length === 0) {
            console.log('Enemy HQ destroyed - Victory!');
            this.endGame(this.playerTeam);
            return;
        }
    }
    
    endGame(winner) {
        this.engine.pause();
        
        // Cleanup multiplayer timer
        if (this.positionSyncTimer) {
            clearInterval(this.positionSyncTimer);
            this.positionSyncTimer = null;
        }
        
        if (this.isMultiplayer && this.multiplayerManager) {
            this.multiplayerManager.notifyGameOver(winner);
        } else {
            // Single player end game logic
            const message = winner === this.playerTeam ? 'Victory!' : 'Defeat!';
            alert(message);
        }
    }

    render(ctx) {
        if (!this.isInitialized) return;
        
        // Render effects
        this.effects.forEach(effect => effect.render(ctx, this.engine.camera));
        
        // Render input (selection box, etc.)
        this.inputHandler.render(ctx);
        
        // Render building placement preview
        if (this.buildMode && this.buildingToPlace) {
            this.renderBuildingPreview(ctx);
        }
    }
    
    handleUnitProduction(unitType) {
        console.log('=== UNIT PRODUCTION DEBUG ===');
        console.log(`Attempting to produce ${unitType}`);
        console.log(`Selected entities count: ${this.engine.selectedEntities.length}`);
        
        // Debug: Log all selected entities
        this.engine.selectedEntities.forEach((entity, index) => {
            console.log(`Selected entity ${index}:`, {
                type: entity.constructor.name,
                canProduce: entity.canProduce,
                isUnderConstruction: entity.isUnderConstruction,
                team: entity.team
            });
        });
        
        // Find selected barracks or base that can produce this unit
        const producers = this.engine.selectedEntities.filter(entity => 
            entity instanceof Building && 
            entity.canProduce && 
            entity.canProduce.includes(unitType) &&
            !entity.isUnderConstruction &&
            entity.team === this.playerTeam  // Only allow player's own buildings
        );
        
        console.log(`Suitable producers found: ${producers.length}`);
        
        if (producers.length === 0) {
            // Show message to user about needing to select a building
            this.showMessage(`Select a Base or Barracks to produce ${unitType}`);
            console.log(`No suitable building selected to produce ${unitType}`);
            console.log('=== END DEBUG ===');
            return;
        }
        
        console.log(`Using producer: ${producers[0].constructor.name}`);
        
        // Add to production queue of first suitable building
        const success = producers[0].addToProductionQueue(unitType);
        if (success) {
            this.showMessage(`${unitType} added to production queue`);
            console.log(`${unitType} added to production queue`);
            
            // Send multiplayer action
            if (this.isMultiplayer) {
                this.sendMultiplayerAction('unitProduce', {
                    unitType: unitType,
                    buildingId: producers[0].id,
                    team: this.playerTeam
                });
            }
        } else {
            this.showMessage(`Failed to add ${unitType} to production queue`);
        }
        console.log('=== END DEBUG ===');
    }

    hasActiveBuildingConstruction() {
        // Check if any of the player's buildings are currently under construction
        const buildings = this.engine.entities.filter(entity => 
            entity instanceof Building && entity.team === this.playerTeam
        );
        
        for (let building of buildings) {
            if (building.isUnderConstruction) {
                return true;
            }
        }
        return false;
    }
    
    showMessage(message) {
        // Create or update a temporary message element
        let messageElement = document.getElementById('game-message');
        if (!messageElement) {
            messageElement = document.createElement('div');
            messageElement.id = 'game-message';
            messageElement.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 8px;
                color: white;
                padding: 12px 24px;
                font-size: 16px;
                z-index: 1000;
                transition: opacity 0.3s ease;
                pointer-events: none;
            `;
            document.body.appendChild(messageElement);
        }
        
        messageElement.textContent = message;
        messageElement.style.opacity = '1';
        
        // Clear any existing timeout
        if (this.messageTimeout) {
            clearTimeout(this.messageTimeout);
        }
        
        // Hide message after 3 seconds
        this.messageTimeout = setTimeout(() => {
            messageElement.style.opacity = '0';
        }, 3000);
    }

    handleBuildingPlacement(buildingType) {
        // Prevent base building in multiplayer or always
        if (buildingType === 'base') {
            this.showMessage('Base building is disabled');
            console.log('Base building is disabled');
            return;
        }
        
        // If already in building placement mode, exit first
        if (this.buildMode === 'building') {
            this.exitBuildingPlacement();
        }
        
        // Check if there's already a building under construction
        if (this.hasActiveBuildingConstruction()) {
            this.showMessage('Cannot build: Another building is already under construction');
            console.log('Cannot build: Another building is already under construction');
            return;
        }
        
        const cost = BuildingFactory.getBuildingCost(buildingType);
        
        if (!this.resources.canAfford(cost.supplies, cost.power)) {
            console.log(`Cannot afford ${buildingType}`);
            return;
        }
        
        // Enter building placement mode
        this.buildMode = 'building';
        this.buildingToPlace = buildingType;
        
        // Change cursor
        this.engine.canvas.style.cursor = 'crosshair';
        
        // Add click handler for placement
        this.placementClickHandler = (e) => this.placeBuildingAtMouse(e, buildingType, cost);
        this.engine.canvas.addEventListener('click', this.placementClickHandler);
        
        console.log(`Entering building placement mode: ${buildingType}`);
    }
    
    placeBuildingAtMouse(e, buildingType, cost) {
        const rect = this.engine.canvas.getBoundingClientRect();
        const mousePos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
        const worldPos = this.engine.screenToWorld(mousePos.x, mousePos.y);
        
        // Check if position is valid (not overlapping other buildings)
        if (this.isValidBuildingPosition(worldPos, buildingType)) {
            // Spend resources and place building
            this.resources.spendResources(cost.supplies, cost.power);
            
            const building = BuildingFactory.create(buildingType, worldPos.x, worldPos.y, this.playerTeam);
            this.engine.addEntity(building);
            
            console.log(`${buildingType} placed at (${Math.round(worldPos.x)}, ${Math.round(worldPos.y)})`);
            
            // Send multiplayer action
            if (this.isMultiplayer) {
                this.sendMultiplayerAction('buildingPlace', {
                    type: buildingType,
                    position: { x: worldPos.x, y: worldPos.y },
                    team: this.playerTeam,
                    buildingId: building.id
                });
            }
        } else {
            console.log('Invalid building position');
        }
        
        // Exit building placement mode
        this.exitBuildingPlacement();
    }
    
    isValidBuildingPosition(position, buildingType) {
        const tempBuilding = BuildingFactory.create(buildingType, position.x, position.y);
        
        // Check for overlaps with existing buildings using rectangular collision
        const buildings = this.engine.entities.filter(entity => entity instanceof Building && !entity.isDead);
        
        const tempHalfWidth = tempBuilding.width / 2;
        const tempHalfHeight = tempBuilding.height / 2;
        const buffer = 15; // Minimum spacing between buildings
        
        for (const building of buildings) {
            const buildingHalfWidth = building.width / 2;
            const buildingHalfHeight = building.height / 2;
            
            // Calculate bounds with buffer
            const tempLeft = position.x - tempHalfWidth - buffer;
            const tempRight = position.x + tempHalfWidth + buffer;
            const tempTop = position.y - tempHalfHeight - buffer;
            const tempBottom = position.y + tempHalfHeight + buffer;
            
            const buildingLeft = building.position.x - buildingHalfWidth;
            const buildingRight = building.position.x + buildingHalfWidth;
            const buildingTop = building.position.y - buildingHalfHeight;
            const buildingBottom = building.position.y + buildingHalfHeight;
            
            // Check for rectangular overlap
            if (tempLeft < buildingRight && tempRight > buildingLeft &&
                tempTop < buildingBottom && tempBottom > buildingTop) {
                return false;
            }
        }
        
        // Check world bounds
        const halfWidth = tempBuilding.width / 2;
        const halfHeight = tempBuilding.height / 2;
        
        return position.x - halfWidth >= 0 &&
               position.x + halfWidth <= this.engine.worldWidth &&
               position.y - halfHeight >= 0 &&
               position.y + halfHeight <= this.engine.worldHeight;
    }
    
    exitBuildingPlacement() {
        this.buildMode = null;
        this.buildingToPlace = null;
        this.engine.canvas.style.cursor = 'crosshair';
        
        if (this.placementClickHandler) {
            this.engine.canvas.removeEventListener('click', this.placementClickHandler);
            this.placementClickHandler = null;
        }
    }
    
    renderBuildingPreview(ctx) {
        if (!this.buildingToPlace) return;
        
        const worldPos = this.inputHandler.worldMousePos;
        const isValid = this.isValidBuildingPosition(worldPos, this.buildingToPlace);
        
        const tempBuilding = BuildingFactory.create(this.buildingToPlace, worldPos.x, worldPos.y);
        
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = isValid ? '#00ff00' : '#ff0000';
        ctx.fillRect(
            worldPos.x - tempBuilding.width / 2,
            worldPos.y - tempBuilding.height / 2,
            tempBuilding.width,
            tempBuilding.height
        );
        ctx.restore();
    }
    
    handleMinimapClick(e) {
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Convert minimap coordinates to world coordinates
        const worldX = (x / rect.width) * this.engine.worldWidth;
        const worldY = (y / rect.height) * this.engine.worldHeight;
        
        this.engine.setCameraPosition(worldX, worldY);
    }
    
    addEffect(effect) {
        this.effects.push(effect);
    }
    
    // Cheat/debug functions
    addResources(supplies = 1000, power = 500) {
        this.resources.addSupplies(supplies);
        this.resources.addPower(power);
        console.log(`Added ${supplies} supplies and ${power} power`);
    }
    
    toggleDebug() {
        this.engine.showDebug = !this.engine.showDebug;
        
        // Toggle debug panel visibility
        const debugPanel = document.getElementById('debugPanel');
        if (debugPanel) {
            debugPanel.style.display = this.engine.showDebug ? 'block' : 'none';
        }
        
        console.log(`Debug mode: ${this.engine.showDebug ? 'ON' : 'OFF'}`);
        return this.engine.showDebug;
    }
    
    updateDebugPanel() {
        if (!this.engine.showDebug) return;
        
        const debugInfo = document.getElementById('debugInfo');
        if (!debugInfo) return;
        
        const mouse = this.inputHandler.mousePos;
        const worldMouse = this.inputHandler.worldMousePos;
        
        debugInfo.innerHTML = `
            FPS: ${Math.round(1000 / this.engine.deltaTime)}<br>
            Entities: ${this.engine.entities.length}<br>
            Selected: ${this.engine.selectedEntities.length}<br>
            Zoom: ${this.engine.camera.zoom.toFixed(2)}x<br>
            Camera: (${Math.round(this.engine.camera.x)}, ${Math.round(this.engine.camera.y)})<br>
            Mouse Screen: (${Math.round(mouse.x)}, ${Math.round(mouse.y)})<br>
            Mouse World: (${Math.round(worldMouse.x)}, ${Math.round(worldMouse.y)})<br>
            Canvas: ${this.engine.canvas.width}x${this.engine.canvas.height}<br>
            Build Mode: ${this.buildMode || 'None'}
        `;
    }
    
    spawnEnemyWave() {
        const spawnX = this.engine.worldWidth - 100;
        const spawnY = this.engine.worldHeight / 2;
        
        // Spawn random enemy units
        const unitTypes = ['marine', 'warthog', 'scorpion'];
        const count = Math.floor(Math.random() * 5) + 3;
        
        for (let i = 0; i < count; i++) {
            const unitType = unitTypes[Math.floor(Math.random() * unitTypes.length)];
            const x = spawnX + Math.random() * 200 - 100;
            const y = spawnY + Math.random() * 200 - 100;
            
            const unit = UnitFactory.create(unitType, x, y, 'enemy');
            this.engine.addEntity(unit);
        }
        
        console.log(`Spawned enemy wave of ${count} units`);
    }
    
    showMessage(message, duration = 3000) {
        // Create or update message element
        let messageEl = document.getElementById('game-message');
        if (!messageEl) {
            messageEl = document.createElement('div');
            messageEl.id = 'game-message';
            messageEl.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 15px 25px;
                border-radius: 10px;
                font-size: 16px;
                font-weight: bold;
                z-index: 1000;
                pointer-events: none;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
            `;
            document.body.appendChild(messageEl);
        }
        
        messageEl.textContent = message;
        messageEl.style.display = 'block';
        
        // Clear any existing timeout
        if (this.messageTimeout) {
            clearTimeout(this.messageTimeout);
        }
        
        // Hide message after duration
        this.messageTimeout = setTimeout(() => {
            messageEl.style.display = 'none';
        }, duration);
    }
}

// Initialize game when page loads
let game;

window.addEventListener('load', () => {
    console.log('Initializing Halo Wars JS RTS...');
    
    // Wait a bit for all scripts to load
    setTimeout(() => {
        try {
            game = new Game();
            
            // Add global functions for debugging
            window.game = game;
            window.addResources = (s, p) => game.addResources(s, p);
            window.toggleDebug = () => game.toggleDebug();
            window.spawnEnemyWave = () => game.spawnEnemyWave();
            
            console.log('Game ready! Try these debug commands:');
            console.log('- addResources(1000, 500) - Add resources');
            console.log('- toggleDebug() - Toggle debug info');
            console.log('- spawnEnemyWave() - Spawn enemy units');
        } catch (error) {
            console.error('Failed to initialize game:', error);
        }
    }, 100);
});

