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
        this.backgroundUpdateTimer = null; // Background timer for multiplayer updates
        
        // Building queue system
        this.buildingQueue = [];
        this.currentlyBuilding = null;
        this.buildingQueueTimer = null;
        
        // Pending attacks queue for message ordering
        this.pendingAttacks = [];
        this.pendingAttackTimer = null;
        
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
        
        // Unit production buttons - remove existing listeners first
        const unitButtons = document.querySelectorAll('.unit-btn');
        console.log(`Found ${unitButtons.length} unit buttons`);
        unitButtons.forEach(button => {
            // Clone node to remove all existing event listeners
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
        });
        
        // Re-add event listeners to the fresh buttons
        document.querySelectorAll('.unit-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                // Check if button is disabled
                if (button.disabled || button.hasAttribute('disabled')) {
                    console.log(`Button ${button.getAttribute('data-unit')} is disabled, ignoring click`);
                    return;
                }
                
                e.preventDefault();
                e.stopPropagation();
                const unitType = button.getAttribute('data-unit');
                console.log(`Unit button clicked: ${unitType}`);
                console.log('Button element:', button);
                console.log('Event:', e);
                this.handleUnitProduction(unitType);
                
                // If this is a unit button in a modal, close the modal
                if (button.classList.contains('modal-btn')) {
                    this.closeAllModals();
                }
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
        
        // Minimap interaction (click and drag)
        const minimapCanvas = document.getElementById('minimapCanvas');
        if (minimapCanvas) {
            // Initialize minimap interaction state
            this.minimapInteraction = {
                isMouseDown: false,
                isDragging: false,
                dragThreshold: 5,
                startPos: { x: 0, y: 0 }
            };
            
            minimapCanvas.addEventListener('mousedown', (e) => {
                this.handleMinimapMouseDown(e);
            });
            
            minimapCanvas.addEventListener('mousemove', (e) => {
                this.handleMinimapMouseMove(e);
            });
            
            minimapCanvas.addEventListener('mouseup', (e) => {
                this.handleMinimapMouseUp(e);
            });
            
            minimapCanvas.addEventListener('mouseleave', (e) => {
                this.handleMinimapMouseUp(e); // Treat mouse leave as mouse up
            });
            
            console.log('Minimap interaction handlers added');
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
        // Remove existing event listeners from non-unit modal buttons only
        document.querySelectorAll('.modal-btn:not(.unit-btn)').forEach(button => {
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

        // Modal button handlers - only add to non-unit buttons
        document.querySelectorAll('.modal-btn:not(.unit-btn)').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (button.classList.contains('building-btn')) {
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
                this.engine.addEntity(playerBase); // Use addEntity which respects existing ID
                
                const enemyBase = new Base(enemyBasePos.x, enemyBasePos.y, this.playerTeam === 'player' ? 'enemy' : 'player');
                enemyBase.isUnderConstruction = false;
                enemyBase.id = `base_${this.playerTeam === 'player' ? 'enemy' : 'player'}`; // Deterministic ID
                this.engine.addEntity(enemyBase); // Use addEntity which respects existing ID
                
                // Create starting units with deterministic IDs
                const marine1 = new Marine(playerUnitPos.x, playerUnitPos.y, this.playerTeam);
                marine1.id = `marine1_${this.playerTeam}`;
                this.engine.addEntity(marine1);
                
                const marine2 = new Marine(playerUnitPos.x + 30, playerUnitPos.y, this.playerTeam);
                marine2.id = `marine2_${this.playerTeam}`;
                this.engine.addEntity(marine2);
                
                // Create enemy starting units that both players can see
                const enemyTeam = this.playerTeam === 'player' ? 'enemy' : 'player';
                const enemyMarine1 = new Marine(enemyUnitPos.x, enemyUnitPos.y, enemyTeam);
                enemyMarine1.id = `marine1_${enemyTeam}`;
                this.engine.addEntity(enemyMarine1);
                
                const enemyMarine2 = new Marine(enemyUnitPos.x + 30, enemyUnitPos.y, enemyTeam);
                enemyMarine2.id = `marine2_${enemyTeam}`;
                this.engine.addEntity(enemyMarine2);
                
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
        
        // Start background update timer to handle multiplayer messages even when tab is not focused
        console.log('🔄 Starting background multiplayer update timer...');
        this.backgroundUpdateTimer = setInterval(() => {
            this.backgroundMultiplayerUpdate();
        }, 50); // Update every 50ms (20fps) to ensure message processing continues
    }
    
    // Background multiplayer update - runs independently of visual frame loop
    backgroundMultiplayerUpdate() {
        if (!this.isMultiplayer) return;
        
        // Process pending attacks that were delayed due to missing entities
        if (this.pendingAttacks.length > 0) {
            this.processPendingAttacks();
        }
        
        // Process any queued building operations
        if (this.buildingQueue.length > 0 && !this.currentlyBuilding) {
            this.processBuildingQueue();
        }
        
        // Update entity states that are critical for multiplayer sync
        // (Only update essential properties, not visual rendering)
        const now = Date.now();
        this.engine.entities.forEach(entity => {
            // Update health/death states
            if (entity.health <= 0 && !entity.isDead) {
                entity.die();
            }
            
            // Update building construction progress
            if (typeof Building !== 'undefined' && entity instanceof Building && entity.isUnderConstruction) {
                const constructionElapsed = now - entity.constructionStartTime;
                entity.constructionProgress = Math.min(1, constructionElapsed / entity.constructionTime);
                
                if (entity.constructionProgress >= 1) {
                    entity.isUnderConstruction = false;
                    entity.isActive = true;
                }
            }
        });
        
        // Clean up dead entities to prevent memory leaks
        this.engine.entities = this.engine.entities.filter(entity => !entity.isDead);
        this.engine.selectedEntities = this.engine.selectedEntities.filter(entity => !entity.isDead);
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
            case 'buildingQueue':
                this.handleRemoteBuildingQueue(data);
                break;
            case 'buildingStart':
                this.handleRemoteBuildingStart(data);
                break;
            case 'buildingComplete':
                this.handleRemoteBuildingComplete(data);
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
            case 'turretDamage':
                this.handleRemoteTurretDamage(data);
                break;
            case 'turretTarget':
                this.handleRemoteTurretTarget(data);
                break;
            case 'turretAttack':
                this.handleRemoteTurretAttack(data);
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
                this.engine.addEntity(building); // Use addEntity which respects existing ID
                console.log(`Remote building placed: ${data.type} by ${data.team} at (${data.position.x}, ${data.position.y})`);
            } catch (error) {
                console.error('Error placing remote building:', error);
            }
        }
    }
    
    handleRemoteBuildingQueue(data) {
        // Only handle enemy building queues
        if (data.team !== this.playerTeam) {
            // Add building to remote player's queue (simulate their queue system)
            const buildingData = {
                type: data.type,
                position: data.position,
                team: data.team
            };
            
            // Create the building immediately for remote players (they already paid the cost)
            const building = BuildingFactory.create(buildingData.type, buildingData.position.x, buildingData.position.y, buildingData.team);
            this.engine.addEntity(building);
            
            console.log(`Remote building queued and started: ${data.type} by ${data.team} at (${data.position.x}, ${data.position.y})`);
        }
    }
    
    handleRemoteBuildingStart(data) {
        // Handle remote building construction start
        if (data.team !== this.playerTeam) {
            const building = this.engine.entities.find(e => e.id === data.buildingId);
            if (building) {
                building.isUnderConstruction = true;
                building.constructionProgress = 0;
                building.constructionStartTime = Date.now();
                console.log(`Remote building construction started: ${data.buildingId} by ${data.team}`);
            }
        }
    }
    
    handleRemoteBuildingComplete(data) {
        // Handle remote building construction completion
        if (data.team !== this.playerTeam) {
            const building = this.engine.entities.find(e => e.id === data.buildingId);
            if (building) {
                building.isUnderConstruction = false;
                building.constructionProgress = 1;
                console.log(`Remote building construction completed: ${data.buildingId} by ${data.team}`);
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
        // Spawn all units remotely for attack synchronization to work properly
        // Skip only units that belong to our own team (to avoid duplicates)
        if (data.team !== this.playerTeam) {
            // Find the building that spawned this unit to use its collision system
            const building = this.engine.entities.find(e => e.id === data.buildingId && e.type === 'building');
            let spawnPos = { x: data.position.x, y: data.position.y };
            
            // If we have the building, try to find a better spawn position
            if (building && building.isPositionClear) {
                const unitRadius = 15; // Standard unit size
                const maxAttempts = 10;
                
                for (let attempt = 0; attempt < maxAttempts; attempt++) {
                    const testPos = {
                        x: data.position.x + (Math.random() - 0.5) * 60 * attempt,
                        y: data.position.y + (Math.random() - 0.5) * 60 * attempt
                    };
                    
                    if (building.isPositionClear(new Vector2(testPos.x, testPos.y), unitRadius)) {
                        spawnPos = testPos;
                        break;
                    }
                }
            }
            
            const unit = UnitFactory.create(data.unitType, spawnPos.x, spawnPos.y, data.team);
            // Set the same ID to keep sync
            unit.id = data.unitId;
            this.engine.addEntity(unit); // Use addEntity which respects existing ID
            console.log(`Remote unit spawned: ${data.unitType} by ${data.team} at (${spawnPos.x}, ${spawnPos.y})`);
        }
    }
    
    handleRemoteAttack(data) {
        const attacker = this.engine.entities.find(e => e.id === data.attackerId);
        const target = this.engine.entities.find(e => e.id === data.targetId);
        
        // Debug logging for attack synchronization
        console.log(`🔍 REMOTE ATTACK DEBUG - Processing attack from ${data.team}`);
        console.log(`   Attacker ID: ${data.attackerId}`);
        console.log(`   Target ID: ${data.targetId}`);
        console.log(`   Current entity count: ${this.engine.entities.length}`);
        console.log(`   Attacker found: ${attacker ? `${attacker.constructor.name} (team: ${attacker.team})` : 'NOT FOUND'}`);
        console.log(`   Target found: ${target ? `${target.constructor.name} (team: ${target.team})` : 'NOT FOUND'}`);
        
        if (attacker && target) {
            if (attacker.team !== this.playerTeam) {
                // Enemy unit attacking - show visual attack
                console.log(`   ✅ Team check passed: ${attacker.team} attacking ${target.team}`);
                console.log(`   🎯 Successfully processing remote attack: ${attacker.constructor.name} → ${target.constructor.name}`);
                attacker.attackUnit(target);
            } else {
                // Own unit attacking - this shouldn't happen but let's log it
                console.log(`   ⚠️ Own unit attack command received remotely - this indicates a synchronization issue`);
            }
        } else {
            console.log(`   🚨 Entity synchronization issue detected!`);
            
            // Check if this is a timing issue - queue for retry
            if (!data.retryCount) data.retryCount = 0;
            
            if (data.retryCount < 5) { // Max 5 retries
                data.retryCount++;
                data.retryTime = Date.now() + 200; // Wait 200ms before retry
                
                this.pendingAttacks.push(data);
                console.log(`   ⏳ Queueing attack for retry #${data.retryCount} (${data.attackerId} → ${data.targetId})`);
                
                // Start the pending attacks processor if not running
                if (!this.pendingAttackTimer) {
                    this.startPendingAttackProcessor();
                }
                return;
            }
            
            // Group entities by team for clearer debugging
            const playerEntities = this.engine.entities.filter(e => e.team === 'player');
            const enemyEntities = this.engine.entities.filter(e => e.team === 'enemy');
            
            console.log(`   Player team entities (${playerEntities.length}):`, 
                playerEntities.map(e => `${e.constructor.name}:${e.id}`));
            console.log(`   Enemy team entities (${enemyEntities.length}):`, 
                enemyEntities.map(e => `${e.constructor.name}:${e.id}`));
            
            // List missing entity details
            const missingEntities = [];
            if (!attacker) missingEntities.push(data.attackerId);
            if (!target) missingEntities.push(data.targetId);
            
            console.log(`   ❌ Skipping remote attack after ${data.retryCount} retries - attacker or target not found`);
            console.log(`     Missing target entities: ${missingEntities.join(', ')}`);
        }
    }
    
    startPendingAttackProcessor() {
        console.log('🔄 Starting pending attack processor...');
        this.pendingAttackTimer = setInterval(() => {
            this.processPendingAttacks();
        }, 50); // Check every 50ms
    }
    
    processPendingAttacks() {
        const now = Date.now();
        const attacksToProcess = [];
        
        // Find attacks that are ready to retry
        for (let i = this.pendingAttacks.length - 1; i >= 0; i--) {
            const attack = this.pendingAttacks[i];
            if (now >= attack.retryTime) {
                attacksToProcess.push(attack);
                this.pendingAttacks.splice(i, 1);
            }
        }
        
        // Process ready attacks
        for (const attack of attacksToProcess) {
            console.log(`🔄 Retrying pending attack (attempt ${attack.retryCount}): ${attack.attackerId} → ${attack.targetId}`);
            this.handleRemoteAttack(attack);
        }
        
        // Stop processor if no more pending attacks
        if (this.pendingAttacks.length === 0 && this.pendingAttackTimer) {
            console.log('✅ All pending attacks processed, stopping processor');
            clearInterval(this.pendingAttackTimer);
            this.pendingAttackTimer = null;
        }
    }
    
    handleRemoteUnitDamage(data) {
        const target = this.engine.entities.find(e => e.id === data.targetId);
        if (target && target.team === this.playerTeam) {
            // Apply damage to our own unit from remote attacker
            target.takeDamage(data.damage, true);
            console.log(`Remote damage: ${target.constructor.name} took ${data.damage} damage from remote attacker`);
        }
    }
    
    handleRemoteTurretDamage(data) {
        const target = this.engine.entities.find(e => e.id === data.targetId);
        if (target && target.team === this.playerTeam) {
            // Apply turret damage to our own unit/building from remote turret
            target.takeDamage(data.damage, true);
            console.log(`Remote turret damage: ${target.constructor.name} took ${data.damage} damage from remote turret`);
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
    
    handleRemoteTurretTarget(data) {
        const turret = this.engine.entities.find(e => e.id === data.turretId);
        const target = this.engine.entities.find(e => e.id === data.targetId);
        if (turret && target && turret.team !== this.playerTeam) {
            // Set target for enemy turret so we see it tracking
            turret.attackTarget = target;
        }
    }
    
    handleRemoteTurretAttack(data) {
        const turret = this.engine.entities.find(e => e.id === data.turretId);
        const target = this.engine.entities.find(e => e.id === data.targetId);
        if (turret && target && turret.team !== this.playerTeam) {
            // Show visual attack effects only (no damage calculation)
            turret.createAttackEffects(target);
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
        
        // Update building queue UI
        this.updateBuildingQueueUI();
        
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
        
        // Cleanup multiplayer timers
        if (this.positionSyncTimer) {
            clearInterval(this.positionSyncTimer);
            this.positionSyncTimer = null;
        }
        
        if (this.backgroundUpdateTimer) {
            console.log('🛑 Stopping background multiplayer update timer...');
            clearInterval(this.backgroundUpdateTimer);
            this.backgroundUpdateTimer = null;
        }
        
        if (this.pendingAttackTimer) {
            clearInterval(this.pendingAttackTimer);
            this.pendingAttackTimer = null;
        }
        
        // Cleanup building queue
        this.cleanupBuildingQueue();
        
        if (this.isMultiplayer && this.multiplayerManager) {
            this.multiplayerManager.notifyGameOver(winner);
        } else {
            // Single player end game logic with player name
            const playerName = this.playerName || 'Player';
            const message = winner === this.playerTeam ? 
                `🎉 Victory! ${playerName} won the game!` : 
                `💀 Defeat! ${playerName} lost the battle.`;
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
        
        // Render queued building outlines
        this.renderQueuedBuildingOutlines(ctx);
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
        
        // Check building limits
        const playerBuildings = this.engine.entities.filter(entity => 
            entity instanceof Building && 
            entity.team === this.playerTeam && 
            !entity.isDead
        );
        
        // Count existing buildings of this type
        const buildingCounts = {
            barracks: playerBuildings.filter(b => b.constructor.name === 'Barracks').length,
            reactor: playerBuildings.filter(b => b.constructor.name === 'Reactor').length
        };
        
        // Check building limits
        if (buildingType === 'barracks' && buildingCounts.barracks >= 5) {
            this.showMessage('Maximum 5 Barracks allowed');
            console.log('Maximum 5 Barracks allowed');
            return;
        }
        
        if (buildingType === 'reactor' && buildingCounts.reactor >= 2) {
            this.showMessage('Maximum 2 Reactors allowed');
            console.log('Maximum 2 Reactors allowed');
            return;
        }
        
        // If already in building placement mode, exit first
        if (this.buildMode === 'building') {
            this.exitBuildingPlacement();
        }
        
        // Building queue system allows multiple buildings, so no need to check for active construction
        
        const cost = BuildingFactory.getBuildingCost(buildingType);
        
        // Buildings don't consume population, only check supplies and power
        if (this.resources.supplies < cost.supplies || this.resources.power < cost.power) {
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
        
        // Account for canvas scaling and device pixel ratio (same as input handler)
        const scaleX = this.engine.canvas.width / rect.width;
        const scaleY = this.engine.canvas.height / rect.height;
        
        const mousePos = new Vector2(
            (e.clientX - rect.left) * scaleX,
            (e.clientY - rect.top) * scaleY
        );
        const worldPos = this.engine.screenToWorld(mousePos.x, mousePos.y);
        
        // Snap to grid for better placement (optional - can be removed if unwanted)
        const gridSize = 25; // Half of visual grid for better precision
        const snappedX = Math.round(worldPos.x / gridSize) * gridSize;
        const snappedY = Math.round(worldPos.y / gridSize) * gridSize;
        const snappedPos = new Vector2(snappedX, snappedY);
        
        // Check if position is valid (not overlapping other buildings)
        if (this.isValidBuildingPosition(snappedPos, buildingType)) {
            // Spend resources and add to queue
            this.resources.spendResources(cost.supplies, cost.power);
            
            // Add building to queue
            this.addBuildingToQueue({
                type: buildingType,
                position: { x: snappedPos.x, y: snappedPos.y },
                cost: cost,
                team: this.playerTeam
            });
            
            console.log(`${buildingType} queued for construction at (${Math.round(snappedPos.x)}, ${Math.round(snappedPos.y)})`);
            
            // Send multiplayer action
            if (this.isMultiplayer) {
                this.sendMultiplayerAction('buildingQueue', {
                    type: buildingType,
                    position: { x: snappedPos.x, y: snappedPos.y },
                    team: this.playerTeam
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
    
    // Building Queue Management
    addBuildingToQueue(buildingData) {
        this.buildingQueue.push(buildingData);
        this.updateBuildingQueueUI();
        this.processBuildingQueue();
    }
    
    processBuildingQueue() {
        // If not currently building and there's a queue, start next building
        if (!this.currentlyBuilding && this.buildingQueue.length > 0) {
            const nextBuilding = this.buildingQueue.shift();
            this.startBuildingConstruction(nextBuilding);
            this.updateBuildingQueueUI();
        }
    }
    
    startBuildingConstruction(buildingData) {
        // Create the building entity
        const building = BuildingFactory.create(buildingData.type, buildingData.position.x, buildingData.position.y, buildingData.team);
        this.engine.addEntity(building);
        
        this.currentlyBuilding = {
            building: building,
            data: buildingData,
            startTime: Date.now()
        };
        
        console.log(`Started construction of ${buildingData.type} at (${Math.round(buildingData.position.x)}, ${Math.round(buildingData.position.y)})`);
        
        // Send multiplayer start event
        if (this.isMultiplayer) {
            this.sendMultiplayerAction('buildingStart', {
                buildingId: building.id,
                team: this.playerTeam,
                type: buildingData.type,
                position: buildingData.position
            });
        }
        
        // Set up completion timer
        this.buildingQueueTimer = setTimeout(() => {
            this.completeBuildingConstruction();
        }, building.constructionTime);
        
        this.updateBuildingQueueUI();
    }
    
    completeBuildingConstruction() {
        if (this.currentlyBuilding) {
            const building = this.currentlyBuilding.building;
            building.isUnderConstruction = false;
            building.constructionProgress = 1;
            
            console.log(`Completed construction of ${building.constructor.name}`);
            
            // Send multiplayer completion event
            if (this.isMultiplayer) {
                this.sendMultiplayerAction('buildingComplete', {
                    buildingId: building.id,
                    team: this.playerTeam
                });
            }
            
            this.currentlyBuilding = null;
            this.buildingQueueTimer = null;
            
            // Update UI and process next building in queue
            this.updateBuildingQueueUI();
            this.processBuildingQueue();
        }
    }
    
    // Update building queue UI
    updateBuildingQueueUI() {
        const queuePanel = document.getElementById('buildingQueuePanel');
        const currentBuildingInfo = document.getElementById('currentBuildingInfo');
        const currentBuildingName = document.getElementById('currentBuildingName');
        const currentBuildingProgress = document.getElementById('currentBuildingProgress');
        const queuedBuildingsList = document.getElementById('queuedBuildingsList');
        const emptyQueueMessage = document.getElementById('emptyQueueMessage');
        
        if (!queuePanel) return; // Panel not found
        
        // Show/hide the queue panel based on whether there's activity
        const hasActivity = this.currentlyBuilding || this.buildingQueue.length > 0;
        queuePanel.style.display = hasActivity ? 'block' : 'none';
        
        // Update currently building section
        if (this.currentlyBuilding) {
            currentBuildingInfo.style.display = 'block';
            currentBuildingName.textContent = this.getBuildingDisplayName(this.currentlyBuilding.data.type);
            
            // Update progress bar
            const building = this.currentlyBuilding.building;
            if (building && building.constructionProgress !== undefined) {
                const progress = Math.round(building.constructionProgress * 100);
                currentBuildingProgress.style.width = `${progress}%`;
            }
        } else {
            currentBuildingInfo.style.display = 'none';
        }
        
        // Update queued buildings list
        queuedBuildingsList.innerHTML = '';
        if (this.buildingQueue.length > 0) {
            emptyQueueMessage.style.display = 'none';
            this.buildingQueue.forEach((buildingData, index) => {
                const queueItem = document.createElement('div');
                queueItem.className = 'building-queue-item queued-building';
                queueItem.innerHTML = `
                    <div class="queue-item-icon">${this.getBuildingIcon(buildingData.type)}</div>
                    <div class="queue-item-info">
                        <div class="queue-item-name">${this.getBuildingDisplayName(buildingData.type)}</div>
                        <div class="queue-position">Position ${index + 1}</div>
                    </div>
                `;
                queuedBuildingsList.appendChild(queueItem);
            });
        } else if (!this.currentlyBuilding) {
            emptyQueueMessage.style.display = 'block';
        } else {
            emptyQueueMessage.style.display = 'none';
        }
    }
    
    getBuildingDisplayName(buildingType) {
        const names = {
            'supply': 'Supply Depot',
            'barracks': 'Barracks',
            'reactor': 'Reactor',
            'turret': 'Turret'
        };
        return names[buildingType] || buildingType.charAt(0).toUpperCase() + buildingType.slice(1);
    }
    
    getBuildingIcon(buildingType) {
        const icons = {
            'supply': '📦',
            'barracks': '🏭',
            'reactor': '⚡',
            'turret': '🔫'
        };
        return icons[buildingType] || '🏗️';
    }
    
    // Clean up queue timer
    cleanupBuildingQueue() {
        if (this.buildingQueueTimer) {
            clearTimeout(this.buildingQueueTimer);
            this.buildingQueueTimer = null;
        }
        this.currentlyBuilding = null;
        this.buildingQueue = [];
    }
    
    renderBuildingPreview(ctx) {
        if (!this.buildingToPlace) return;
        
        const rawWorldPos = this.inputHandler.worldMousePos;
        
        // Snap to grid for preview (same as placement)
        const gridSize = 25;
        const snappedX = Math.round(rawWorldPos.x / gridSize) * gridSize;
        const snappedY = Math.round(rawWorldPos.y / gridSize) * gridSize;
        const worldPos = new Vector2(snappedX, snappedY);
        
        const isValid = this.isValidBuildingPosition(worldPos, this.buildingToPlace);
        
        const tempBuilding = BuildingFactory.create(this.buildingToPlace, worldPos.x, worldPos.y);
        
        // Convert world position to screen position for accurate rendering
        const screenPos = this.engine.worldToScreen(worldPos.x, worldPos.y);
        
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = isValid ? '#00ff00' : '#ff0000';
        ctx.fillRect(
            screenPos.x - (tempBuilding.width * this.engine.camera.zoom) / 2,
            screenPos.y - (tempBuilding.height * this.engine.camera.zoom) / 2,
            tempBuilding.width * this.engine.camera.zoom,
            tempBuilding.height * this.engine.camera.zoom
        );
        
        // Add grid snap indicator
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = isValid ? '#00ff00' : '#ff0000';
        ctx.lineWidth = 1;
        ctx.strokeRect(
            screenPos.x - (tempBuilding.width * this.engine.camera.zoom) / 2,
            screenPos.y - (tempBuilding.height * this.engine.camera.zoom) / 2,
            tempBuilding.width * this.engine.camera.zoom,
            tempBuilding.height * this.engine.camera.zoom
        );
        
        ctx.restore();
    }
    
    renderQueuedBuildingOutlines(ctx) {
        // Apply camera transformation for world coordinates
        ctx.save();
        ctx.translate(-this.engine.camera.x, -this.engine.camera.y);
        ctx.scale(this.engine.camera.zoom, this.engine.camera.zoom);
        
        // Render outlines for buildings in queue
        this.buildingQueue.forEach((buildingData, index) => {
            const tempBuilding = BuildingFactory.create(buildingData.type, buildingData.position.x, buildingData.position.y);
            
            ctx.save();
            ctx.globalAlpha = 0.3 - (index * 0.05); // Fade later queue items
            ctx.strokeStyle = '#00d4ff'; // Light blue outline
            ctx.lineWidth = 2 / this.engine.camera.zoom; // Adjust line width for zoom
            ctx.setLineDash([5 / this.engine.camera.zoom, 5 / this.engine.camera.zoom]); // Adjust dash pattern for zoom
            
            // Draw outline rectangle
            ctx.strokeRect(
                buildingData.position.x - tempBuilding.width / 2,
                buildingData.position.y - tempBuilding.height / 2,
                tempBuilding.width,
                tempBuilding.height
            );
            
            // Draw queue number
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = '#00d4ff';
            ctx.font = `${16 / this.engine.camera.zoom}px Arial`; // Adjust font size for zoom
            ctx.textAlign = 'center';
            ctx.fillText(
                `${index + 1}`,
                buildingData.position.x,
                buildingData.position.y + 5 / this.engine.camera.zoom
            );
            
            ctx.restore();
        });
        
        // Render outline for currently building structure (if any)
        if (this.currentlyBuilding) {
            const building = this.currentlyBuilding.building;
            
            ctx.save();
            ctx.globalAlpha = 0.6;
            ctx.strokeStyle = '#00ff64'; // Green outline for current building
            ctx.lineWidth = 3 / this.engine.camera.zoom; // Adjust line width for zoom
            ctx.setLineDash([3 / this.engine.camera.zoom, 3 / this.engine.camera.zoom]); // Adjust dash pattern for zoom
            
            ctx.strokeRect(
                building.position.x - building.width / 2,
                building.position.y - building.height / 2,
                building.width,
                building.height
            );
            
            // Draw "BUILDING" text
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = '#00ff64';
            ctx.font = `bold ${12 / this.engine.camera.zoom}px Arial`; // Adjust font size for zoom
            ctx.textAlign = 'center';
            ctx.fillText(
                'BUILDING',
                building.position.x,
                building.position.y - building.height / 2 - 8 / this.engine.camera.zoom
            );
            
            ctx.restore();
        }
        
        // Restore camera transformation
        ctx.restore();
    }
    
    handleMinimapMouseDown(e) {
        const rect = e.target.getBoundingClientRect();
        this.minimapInteraction.isMouseDown = true;
        this.minimapInteraction.startPos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        this.minimapInteraction.isDragging = false;
    }
    
    handleMinimapMouseMove(e) {
        if (!this.minimapInteraction.isMouseDown) return;
        
        const rect = e.target.getBoundingClientRect();
        const canvas = e.target;
        const currentPos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        const distance = Math.sqrt(
            Math.pow(currentPos.x - this.minimapInteraction.startPos.x, 2) +
            Math.pow(currentPos.y - this.minimapInteraction.startPos.y, 2)
        );
        
        if (distance > this.minimapInteraction.dragThreshold) {
            this.minimapInteraction.isDragging = true;
        }
        
        if (this.minimapInteraction.isDragging) {
            // Convert minimap coordinates to world coordinates and move camera
            // Use canvas dimensions instead of rect dimensions for accuracy
            const worldX = (currentPos.x / canvas.width) * this.engine.worldWidth;
            const worldY = (currentPos.y / canvas.height) * this.engine.worldHeight;
            this.engine.setCameraPosition(worldX, worldY);
        }
    }
    
    handleMinimapMouseUp(e) {
        if (!this.minimapInteraction.isMouseDown) return;
        
        const rect = e.target.getBoundingClientRect();
        const canvas = e.target;
        const endPos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        // If it was just a click (not a drag), center camera on click position
        if (!this.minimapInteraction.isDragging) {
            // Use canvas dimensions instead of rect dimensions for accuracy
            const worldX = (endPos.x / canvas.width) * this.engine.worldWidth;
            const worldY = (endPos.y / canvas.height) * this.engine.worldHeight;
            this.engine.setCameraPosition(worldX, worldY);
        }
        
        // Reset interaction state
        this.minimapInteraction.isMouseDown = false;
        this.minimapInteraction.isDragging = false;
    }
    
    handleMinimapMouseLeave(e) {
        // Reset interaction state when mouse leaves minimap
        this.minimapInteraction.isMouseDown = false;
        this.minimapInteraction.isDragging = false;
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
            Build Mode: ${this.buildMode || 'None'}<br>
            Building Queue: ${this.buildingQueue.length}<br>
            Currently Building: ${this.currentlyBuilding ? this.currentlyBuilding.data.type : 'None'}
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

