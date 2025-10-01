// AI Opponent System for Single-Player Mode
console.log('Loading AI opponent system...');

class AIOpponent {
    constructor(team = 'enemy', aiId = null) {
        this.team = team;
        this.aiId = aiId || `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.difficulty = 'normal'; // easy, normal, hard
        
        // AI State
        this.isActive = false;
        this.lastUpdateTime = 0;
        this.updateInterval = 2000; // Update AI every 2 seconds
        
        // Strategy parameters
        this.aggressiveness = 0.7; // How often to attack (0-1)
        this.economyFocus = 0.4; // How much to focus on economy vs military (0-1)
        this.defenseRadius = 400; // How close enemies need to be to trigger defense
        
        // Attack wave management
        this.attackWaves = {
            nextWaveTime: 0,
            waveInterval: 45000, // 45 seconds between waves
            waveSize: 3, // Starting wave size
            currentWave: 0
        };
        
        // Production management
        this.production = {
            unitQueue: [],
            priorityUnits: ['marine', 'warthog', 'scorpion'],
            maxQueueSize: 3,
            productionTimer: 0,
            productionInterval: 8000 // Try to produce every 8 seconds
        };
        
        // Resource management
        this.economy = {
            targetSupplies: 2000,
            targetPower: 5,
            buildingPriority: ['supply', 'reactor', 'barracks'],
            lastBuildingTime: 0,
            buildingInterval: 30000 // Build buildings every 30 seconds
        };
        
        // Population management
        this.populationCap = 50; // Maximum population limit
        this.currentPopulation = 0; // Track current population
        
        // Tactical state
        this.tactics = {
            baseDefenders: [], // Units assigned to defend base
            attackForce: [], // Units assigned to attack
            scouts: [], // Units assigned to scout
            isDefending: false,
            lastDefenseTime: 0
        };
    }
    
    // Initialize AI with just the main base, then build sequentially
    initializeBase() {
        if (!window.game || !window.game.engine) {
            console.error('Cannot initialize AI base: game engine not available');
            return;
        }
        
        // Calculate position based on AI index to avoid overlapping
        const { baseX, baseY } = this.calculateBasePosition();
        
        // Create main base (HQ) only
        const mainBase = BuildingFactory.create('base', baseX, baseY, this.team);
        mainBase.id = `ai_base_${this.aiIndex}_${Date.now()}`;
        mainBase.isUnderConstruction = false; // Start completed
        window.game.engine.addEntity(mainBase);
        
        // Initialize building queue system for AI
        this.initializeBuildingQueue(baseX, baseY);
        
        // Create initial army
        this.spawnInitialUnits(baseX, baseY);
        
        console.log(`AI base ${this.aiIndex} initialized at (${baseX}, ${baseY}) - will build sequentially`);
    }
    
    // Initialize the AI building queue system
    initializeBuildingQueue(baseX, baseY) {
        this.buildingQueue = [];
        this.currentlyBuilding = null;
        this.buildingPositions = {
            supply: [
                { x: baseX - 100, y: baseY + 150 },
                { x: baseX - 150, y: baseY + 200 }
            ],
            reactor: [
                { x: baseX + 100, y: baseY + 150 },
                { x: baseX + 150, y: baseY + 200 }
            ],
            barracks: [
                { x: baseX, y: baseY + 200 },
                { x: baseX + 50, y: baseY + 250 }
            ],
            turret: [
                { x: baseX - 150, y: baseY - 100 },
                { x: baseX + 150, y: baseY - 100 },
                { x: baseX - 150, y: baseY + 100 },
                { x: baseX + 150, y: baseY + 100 },
                { x: baseX, y: baseY - 200 },
                { x: baseX - 200, y: baseY }
            ]
        };
        
        // Queue the building order: 1 of each type first, then second of each type
        const buildOrder = [
            'supply', 'reactor', 'barracks', 'turret',  // First round
            'supply', 'reactor', 'barracks', 'turret'   // Second round (limited to 2 each)
        ];
        
        buildOrder.forEach(buildingType => {
            this.queueBuilding(buildingType);
        });
        
        // Start building immediately
        this.processBuildingQueue();
    }
    
    // Queue a building for construction
    queueBuilding(buildingType) {
        const positions = this.buildingPositions[buildingType];
        if (!positions) return;
        
        // Count existing AND queued buildings of this type to prevent over-building
        const existingBuildings = window.game.engine.entities.filter(entity => 
            entity.team === this.team && 
            entity.type === buildingType &&
            !entity.isDead
        );
        
        // Count buildings already in queue
        const queuedBuildings = this.buildingQueue.filter(queuedBuilding => 
            queuedBuilding.type === buildingType
        );
        
        const totalCount = existingBuildings.length + queuedBuildings.length;
        
        // Only build up to 2 of each type (including queued buildings)
        const maxCount = 2;
        if (totalCount >= maxCount) {
            console.log(`🤖 AI QUEUE BLOCKED: Already have/queued ${totalCount} ${buildingType} buildings (existing: ${existingBuildings.length}, queued: ${queuedBuildings.length}) - STRICT 2-BUILDING CAP`);
            return;
        }
        
        const position = positions[totalCount]; // Use total count for position
        if (!position) return;
        
        this.buildingQueue.push({
            type: buildingType,
            position: position,
            startTime: null
        });
        
        console.log(`🤖 AI QUEUED: ${buildingType} #${totalCount + 1} at position (${position.x}, ${position.y})`);
    }
    
    // Process the building queue
    processBuildingQueue() {
        // If already building something, wait
        if (this.currentlyBuilding) return;
        
        // If queue is empty, we're done
        if (this.buildingQueue.length === 0) {
            // Start producing units once all buildings are complete
            this.startUnitProduction();
            return;
        }
        
        // Start next building
        const nextBuilding = this.buildingQueue.shift();
        this.startBuilding(nextBuilding);
    }
    
    // Start constructing a building
    startBuilding(buildingData) {
        const building = BuildingFactory.create(
            buildingData.type, 
            buildingData.position.x, 
            buildingData.position.y, 
            this.team
        );
        
        building.id = `ai_${buildingData.type}_${this.aiIndex}_${Date.now()}`;
        building.isUnderConstruction = true;
        building.constructionProgress = 0;
        building.constructionTime = this.getBuildingConstructionTime(buildingData.type);
        building.constructionStartTime = Date.now();
        
        window.game.engine.addEntity(building);
        
        this.currentlyBuilding = {
            building: building,
            startTime: Date.now(),
            type: buildingData.type
        };
        
        console.log(`AI ${this.aiIndex} started building ${buildingData.type} at (${buildingData.position.x}, ${buildingData.position.y})`);
    }
    
    // Get construction time for different building types
    getBuildingConstructionTime(buildingType) {
        const times = {
            supply: 8000,    // 8 seconds
            reactor: 10000,  // 10 seconds
            barracks: 12000, // 12 seconds
            turret: 6000     // 6 seconds
        };
        return times[buildingType] || 8000;
    }
    
    // Check building progress and completion
    updateBuildingProgress() {
        if (!this.currentlyBuilding) return;
        
        const { building, startTime } = this.currentlyBuilding;
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / building.constructionTime, 1);
        
        building.constructionProgress = progress;
        
        // Building completed
        if (progress >= 1) {
            building.isUnderConstruction = false;
            building.constructionProgress = 1;
            
            console.log(`AI ${this.aiIndex} completed building ${this.currentlyBuilding.type}`);
            
            this.currentlyBuilding = null;
            
            // Process next building in queue
            setTimeout(() => this.processBuildingQueue(), 1000); // Small delay between buildings
        }
    }
    
    // Start unit production after buildings are complete
    startUnitProduction() {
        console.log(`AI ${this.aiIndex} finished building base, starting unit production`);
        this.unitProductionActive = true;
    }

    calculateBasePosition() {
        // Get world size for dynamic positioning
        const worldWidth = window.game.engine.worldWidth;
        const worldHeight = window.game.engine.worldHeight;
        
        // Get selected difficulty from single-player page
        const difficulty = window.selectedDifficulty || 'easy';
        
        if (difficulty === 'easy') {
            // Easy: 2000x2000 map - Single AI in top right corner
            return { baseX: 1600, baseY: 400 };
            
        } else if (difficulty === 'normal') {
            // Normal: 2500x2500 map - 2 AIs positioned strategically
            if (this.aiIndex === 0) {
                // First AI - top center
                return { baseX: 1250, baseY: 400 };
            } else {
                // Second AI - right center
                return { baseX: 2000, baseY: 1250 };
            }
            
        } else if (difficulty === 'hard') {
            // Hard: 3000x3000 map - 3 AIs in triangle formation
            if (this.aiIndex === 0) {
                // First AI - northeast corner
                return { baseX: 2400, baseY: 600 };
            } else if (this.aiIndex === 1) {
                // Second AI - northwest corner
                return { baseX: 600, baseY: 600 };
            } else {
                // Third AI - south center
                return { baseX: 1500, baseY: 2400 };
            }
            
        } else {
            // Fallback for any other difficulty - spread them out
            const spacing = Math.min(worldWidth, worldHeight) / 3;
            const row = Math.floor(this.aiIndex / 2);
            const col = this.aiIndex % 2;
            return { 
                baseX: worldWidth * 0.7 + col * spacing * 0.3, 
                baseY: worldHeight * 0.3 + row * spacing * 0.3 
            };
        }
    }
    
    spawnInitialUnits(baseX, baseY) {
        // AI now starts with no units - must build them through normal production
        console.log(`AI ${this.aiIndex}: Starting with no units - will build army through production`);
        this.currentPopulation = 0;
    }
    
    getUnitPopulationCost(unitType) {
        // Return population cost for each unit type
        switch(unitType) {
            case 'marine': return 1;
            case 'warthog': return 3;
            case 'scorpion': return 5;
            default: return 1;
        }
    }
    
    initializeLegendaryBase(aiIndex) {
        console.log(`Initializing enhanced legendary AI base ${aiIndex} for team ${this.team}...`);
        
        // Position AI bases in a circle around the center of the 5000x5000 map
        const centerX = 2500;
        const centerY = 2500;
        const radius = 1750; // Distance from center (player) to AI bases - closer for 5k map
        const totalAIs = 9;
        
        // Calculate position on the circle
        const angle = (aiIndex / totalAIs) * Math.PI * 2;
        const baseX = centerX + Math.cos(angle) * radius;
        const baseY = centerY + Math.sin(angle) * radius;
        
        console.log(`AI ${aiIndex} positioned at angle ${(angle * 180 / Math.PI).toFixed(1)}° - (${baseX.toFixed(0)}, ${baseY.toFixed(0)})`);
        
        // Store this AI's base position for future building placement
        this.basePosition = { x: baseX, y: baseY };
        this.baseId = `ai_base_${this.team}_${aiIndex}_${Date.now()}`;
        
        // Create AI base (HQ)
        const base = BuildingFactory.create('base', baseX, baseY, this.team);
        base.id = this.baseId;
        base.isUnderConstruction = false;
        window.game.engine.addEntity(base);
        
        // Create full base infrastructure with 2 of each building
        this.createFullBaseInfrastructure(baseX, baseY, aiIndex);
        
        // Spawn initial army
        this.spawnLegendaryInitialUnits(baseX, baseY);
        
        // Start with moderate resources for enhanced base
        this.resources = {
            credits: 1000,
            energy: 200,
            materials: 400
        };
        
        console.log(`Enhanced legendary AI base ${aiIndex} initialized at (${baseX.toFixed(0)}, ${baseY.toFixed(0)}) with full infrastructure and population cap of ${this.populationCap}`);
    }
    
    spawnLegendaryInitialUnits(baseX, baseY) {
        // Spawn legendary army respecting population cap of 50
        // Same composition as regular bases for consistency
        const unitComposition = [
            // 30 Marines (30 population)
            ...Array(30).fill('marine'),
            // 4 Warthogs (12 population)
            ...Array(4).fill('warthog'),
            // 1 Scorpion (5 population)
            'scorpion'
        ];
        
        const spawnRadius = 180; // Larger radius for legendary bases
        let currentPop = 0;
        
        unitComposition.forEach((unitType, index) => {
            // Check population before spawning
            const unitPopCost = this.getUnitPopulationCost(unitType);
            if (currentPop + unitPopCost <= this.populationCap) {
                const angle = (index / unitComposition.length) * Math.PI * 2;
                const spawnX = baseX + Math.cos(angle) * spawnRadius;
                const spawnY = baseY + Math.sin(angle) * spawnRadius;
                
                const unit = UnitFactory.create(unitType, spawnX, spawnY, this.team);
                unit.id = `ai_${unitType}_${this.team}_${index}_${Date.now()}`;
                window.game.engine.addEntity(unit);
                
                // Track population
                currentPop += unitPopCost;
                this.currentPopulation = currentPop;
                
                // Assign initial defenders
                this.tactics.baseDefenders.push(unit);
            }
        });
        
        console.log(`Legendary AI: Spawned initial army with ${currentPop}/${this.populationCap} population`);
    }
    
    createFullBaseInfrastructure(baseX, baseY, aiIndex) {
        console.log(`Creating full infrastructure for AI base ${aiIndex}...`);
        
        // Define building positions in a grid around the base
        const buildingSpacing = 120;
        const buildingPositions = [
            // Row 1 (top)
            { x: baseX - buildingSpacing, y: baseY - buildingSpacing },
            { x: baseX + buildingSpacing, y: baseY - buildingSpacing },
            // Row 2 (sides)
            { x: baseX - buildingSpacing * 1.5, y: baseY },
            { x: baseX + buildingSpacing * 1.5, y: baseY },
            // Row 3 (bottom)
            { x: baseX - buildingSpacing, y: baseY + buildingSpacing },
            { x: baseX + buildingSpacing, y: baseY + buildingSpacing },
            // Row 4 (outer ring)
            { x: baseX, y: baseY - buildingSpacing * 1.5 },
            { x: baseX, y: baseY + buildingSpacing * 1.5 }
        ];
        
        let posIndex = 0;
        
        // Create 2 supply depots
        for (let i = 0; i < 2; i++) {
            const pos = buildingPositions[posIndex++];
            const supply = BuildingFactory.create('supply', pos.x, pos.y, this.team);
            supply.id = `ai_supply_${this.team}_${aiIndex}_${i}_${Date.now()}`;
            supply.isUnderConstruction = false;
            window.game.engine.addEntity(supply);
        }
        
        // Create 2 reactors
        for (let i = 0; i < 2; i++) {
            const pos = buildingPositions[posIndex++];
            const reactor = BuildingFactory.create('reactor', pos.x, pos.y, this.team);
            reactor.id = `ai_reactor_${this.team}_${aiIndex}_${i}_${Date.now()}`;
            reactor.isUnderConstruction = false;
            window.game.engine.addEntity(reactor);
        }
        
        // Create 2 barracks
        for (let i = 0; i < 2; i++) {
            const pos = buildingPositions[posIndex++];
            const barracks = BuildingFactory.create('barracks', pos.x, pos.y, this.team);
            barracks.id = `ai_barracks_${this.team}_${aiIndex}_${i}_${Date.now()}`;
            barracks.isUnderConstruction = false;
            window.game.engine.addEntity(barracks);
        }
        
        // Create 2 turrets
        for (let i = 0; i < 2; i++) {
            const pos = buildingPositions[posIndex++];
            const turret = BuildingFactory.create('turret', pos.x, pos.y, this.team);
            turret.id = `ai_turret_${this.team}_${aiIndex}_${i}_${Date.now()}`;
            turret.isUnderConstruction = false;
            window.game.engine.addEntity(turret);
        }
        
        console.log(`Created full infrastructure: 2 supply depots, 2 reactors, 2 barracks, 2 turrets for AI base ${aiIndex}`);
    }
    
    start() {
        this.isActive = true;
        this.lastUpdateTime = Date.now();
        this.attackWaves.nextWaveTime = Date.now() + this.attackWaves.waveInterval;
        console.log(`AI opponent ${this.aiId} activated`);
    }
    
    stop() {
        this.isActive = false;
        console.log(`AI opponent ${this.aiId} deactivated`);
    }
    
    update(deltaTime) {
        if (!this.isActive || !window.game || !window.game.engine) return;
        
        const currentTime = Date.now();
        
        // Update building progress
        this.updateBuildingProgress();
        
        // Only update AI at intervals to avoid spam
        if (currentTime - this.lastUpdateTime < this.updateInterval) return;
        this.lastUpdateTime = currentTime;
        
        // Main AI decision making
        this.updateTacticalState();
        this.manageEconomy();
        this.manageProduction();
        this.manageAttackWaves();
        this.manageDefense();
        this.assignUnitTasks();
    }
    
    updateTacticalState() {
        // Clean up dead units from tactical lists
        this.tactics.baseDefenders = this.tactics.baseDefenders.filter(unit => !unit.isDead);
        this.tactics.attackForce = this.tactics.attackForce.filter(unit => !unit.isDead);
        this.tactics.scouts = this.tactics.scouts.filter(unit => !unit.isDead);
        
        // Check if base is under attack
        const playerUnitsNearBase = this.getPlayerUnitsNearBase();
        this.tactics.isDefending = playerUnitsNearBase.length > 0;
        
        if (this.tactics.isDefending) {
            this.tactics.lastDefenseTime = Date.now();
        }
    }
    
    getPlayerUnitsNearBase() {
        if (!window.game || !window.game.engine) return [];
        
        // Find AI base position
        const aiBase = window.game.engine.entities.find(e => 
            e instanceof Building && e.team === this.team && e.constructor.name === 'Base'
        );
        
        if (!aiBase) return [];
        
        return window.game.engine.getEntitiesNear(aiBase.position, this.defenseRadius)
            .filter(entity => 
                entity instanceof Unit && 
                entity.team !== this.team && 
                !entity.isDead
            );
    }
    
    manageEconomy() {
        const currentTime = Date.now();
        if (currentTime - this.economy.lastBuildingTime < this.economy.buildingInterval) return;
        
        // Check current resource buildings (count ALL buildings including under construction and dead)
        const allAIBuildings = this.getAIBuildings(); // Get all buildings
        const completedBuildings = allAIBuildings.filter(b => !b.isUnderConstruction && !b.isDead);
        const underConstructionBuildings = allAIBuildings.filter(b => b.isUnderConstruction && !b.isDead);
        
        const supplyDepots = completedBuildings.filter(b => b instanceof SupplyDepot).length;
        const reactors = completedBuildings.filter(b => b instanceof Reactor).length;
        const barracks = completedBuildings.filter(b => b instanceof Barracks).length;
        
        const supplyUnderConstruction = underConstructionBuildings.filter(b => b instanceof SupplyDepot).length;
        const reactorUnderConstruction = underConstructionBuildings.filter(b => b instanceof Reactor).length;
        const barracksUnderConstruction = underConstructionBuildings.filter(b => b instanceof Barracks).length;
        
        const totalSupply = supplyDepots + supplyUnderConstruction;
        const totalReactor = reactors + reactorUnderConstruction;
        const totalBarracks = barracks + barracksUnderConstruction;
        
        console.log(`🤖 AI ECONOMY CHECK: Supply:${supplyDepots}+${supplyUnderConstruction}=${totalSupply}/2, Reactor:${reactors}+${reactorUnderConstruction}=${totalReactor}/2, Barracks:${barracks}+${barracksUnderConstruction}=${totalBarracks}/2`);
        
        // Log to single player logger
        if (window.spLogger) {
            window.spLogger.log('AI_ECONOMY', 'Economy check performed', {
                aiId: this.aiId,
                team: this.team,
                buildings: {
                    supply: { completed: supplyDepots, underConstruction: supplyUnderConstruction, total: totalSupply },
                    reactor: { completed: reactors, underConstruction: reactorUnderConstruction, total: totalReactor },
                    barracks: { completed: barracks, underConstruction: barracksUnderConstruction, total: totalBarracks }
                },
                allBuildingIds: allAIBuildings.map(b => ({ id: b.id, type: b.constructor.name, isDead: b.isDead, isUnderConstruction: b.isUnderConstruction }))
            });
        }
        
        // FIXED: Respect building limits - only rebuild to maintain the original 2-building limit
        // Count both completed AND under construction buildings to prevent over-building
        
        // Only rebuild if we're below the intended 2-building limit (including under construction)
        if (totalSupply < 2) {
            console.log(`🤖 AI ECONOMY: Need to rebuild supply depot (${totalSupply}/2)`);
            this.buildBuilding('supply');
        } else if (totalReactor < 2) {
            console.log(`🤖 AI ECONOMY: Need to rebuild reactor (${totalReactor}/2)`);
            this.buildBuilding('reactor');
        } else if (totalBarracks < 2) {
            console.log(`🤖 AI ECONOMY: Need to rebuild barracks (${totalBarracks}/2)`);
            this.buildBuilding('barracks');
        }
        
        this.economy.lastBuildingTime = currentTime;
    }
    
    manageProduction() {
        const currentTime = Date.now();
        if (currentTime - this.production.productionTimer < this.production.productionInterval) return;
        
        // Find available barracks
        const availableBarracks = this.getAIBuildings()
            .filter(b => b instanceof Barracks && !b.isProducing && !b.isUnderConstruction);
        
        if (availableBarracks.length === 0) return;
        
        // FIXED: Check population limits before producing
        const currentAIPopulation = this.getCurrentAIPopulation();
        const maxAIPopulation = this.getMaxAIPopulation();
        
        // Don't produce if at or near population cap
        if (currentAIPopulation >= maxAIPopulation) {
            console.log(`AI production stopped: Population at capacity (${currentAIPopulation}/${maxAIPopulation})`);
            return;
        }
        
        // In legendary mode, produce from ALL available barracks simultaneously (if population allows)
        const barracksToUse = this.isLegendaryMode ? availableBarracks : [availableBarracks[0]];
        
        // Determine what to produce based on current army composition
        const aiUnits = this.getAIUnits();
        const marines = aiUnits.filter(u => u instanceof Marine).length;
        const warthogs = aiUnits.filter(u => u instanceof Warthog).length;
        const scorpions = aiUnits.filter(u => u instanceof Scorpion).length;
        
        let unitToProduce = 'marine'; // Default
        
        // Strategic unit selection (more aggressive in legendary mode)
        if (this.isLegendaryMode) {
            // LEGENDARY: Prioritize heavy units more
            if (scorpions < marines * 0.5) { // More scorpions
                unitToProduce = 'scorpion';
            } else if (warthogs < marines * 0.8) { // More warthogs
                unitToProduce = 'warthog';
            } else {
                unitToProduce = 'marine';
            }
        } else {
            // Normal production logic
            if (marines < 4) {
                unitToProduce = 'marine';
            } else if (warthogs < 2) {
                unitToProduce = 'warthog';
            } else if (scorpions < 1) {
                unitToProduce = 'scorpion';
            } else {
                // Random selection with weighting
                const random = Math.random();
                if (random < 0.5) unitToProduce = 'marine';
                else if (random < 0.8) unitToProduce = 'warthog';
                else unitToProduce = 'scorpion';
            }
        }
        
        // Check if we have enough population space for the unit we want to produce
        const unitCost = UnitFactory.getUnitCost(unitToProduce);
        if (currentAIPopulation + unitCost.population > maxAIPopulation) {
            console.log(`AI: Cannot produce ${unitToProduce} - would exceed population limit`);
            return;
        }
        
        // Produce units from selected barracks (respecting population limits)
        barracksToUse.forEach(barracks => {
            // Double-check population before each production
            const newCurrentPop = this.getCurrentAIPopulation();
            if (newCurrentPop + unitCost.population <= maxAIPopulation) {
                this.produceUnit(unitToProduce, barracks);
            }
        });
        
        if (this.isLegendaryMode) {
            console.log(`🔥 LEGENDARY: Producing ${unitToProduce} from ${barracksToUse.length} barracks (Pop: ${currentAIPopulation}/${maxAIPopulation})`);
        }
        
        this.production.productionTimer = currentTime;
    }
    
    manageAttackWaves() {
        const currentTime = Date.now();
        
        // Don't attack if currently defending
        if (this.tactics.isDefending) {
            this.attackWaves.nextWaveTime = currentTime + (this.attackWaves.waveInterval / 2);
            return;
        }
        
        if (currentTime >= this.attackWaves.nextWaveTime) {
            this.launchAttackWave();
            this.attackWaves.currentWave++;
            this.attackWaves.nextWaveTime = currentTime + this.attackWaves.waveInterval;
            
            // Increase difficulty over time
            if (this.attackWaves.currentWave % 3 === 0) {
                this.attackWaves.waveSize = Math.min(this.attackWaves.waveSize + 1, 8);
                this.attackWaves.waveInterval = Math.max(this.attackWaves.waveInterval - 2000, 25000);
            }
        }
    }
    
    launchAttackWave() {
        // Find available units not currently defending
        const availableUnits = this.getAIUnits().filter(unit => 
            !this.tactics.baseDefenders.includes(unit) && 
            unit.state !== 'attacking'
        );
        
        if (availableUnits.length < 2) {
            console.log('AI: Not enough units for attack wave');
            return;
        }
        
        // Select units for attack - in legendary mode, use ALL available units!
        let waveUnits;
        if (this.isLegendaryMode) {
            // LEGENDARY: Send EVERYTHING - no wave size limit!
            waveUnits = availableUnits.slice(); // Take all available units
            console.log(`AI: LEGENDARY MODE - Sending ALL ${waveUnits.length} available units in massive assault!`);
        } else {
            // Normal mode: Respect wave size limits
            waveUnits = availableUnits.slice(0, Math.min(this.attackWaves.waveSize, availableUnits.length));
        }
        
        // Find best target using enhanced targeting
        const target = this.findBestPlayerTarget();
        
        if (!target) {
            console.log('AI: No valid player targets found for attack wave');
            return;
        }
        
        // Attack the target
        this.attackTarget(waveUnits, target);
        
        console.log(`AI: Launching ${this.isLegendaryMode ? 'LEGENDARY' : ''} attack wave ${this.attackWaves.currentWave} with ${waveUnits.length} units targeting ${target.constructor.name}`);
    }
    
    attackTarget(units, target) {
        units.forEach(unit => {
            // Move unit to attack position near target
            const attackPos = this.getAttackPosition(target.position);
            unit.moveTo(attackPos);
            
            // Set as attack force
            if (!this.tactics.attackForce.includes(unit)) {
                this.tactics.attackForce.push(unit);
            }
        });
    }
    
    getAttackPosition(targetPos) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 100 + Math.random() * 50; // 100-150 units away
        return new Vector2(
            targetPos.x + Math.cos(angle) * distance,
            targetPos.y + Math.sin(angle) * distance
        );
    }
    
    manageDefense() {
        if (!this.tactics.isDefending) return;
        
        const threats = this.getPlayerUnitsNearBase();
        
        // Assign defenders to threats
        this.tactics.baseDefenders.forEach(defender => {
            if (threats.length > 0 && defender.state === 'idle') {
                const closestThreat = threats.reduce((closest, threat) => {
                    const closestDist = defender.position.distance(closest.position);
                    const threatDist = defender.position.distance(threat.position);
                    return threatDist < closestDist ? threat : closest;
                });
                
                defender.attackUnit(closestThreat);
            }
        });
        
        // Call back attack force if base is in serious danger
        if (threats.length > 3) {
            this.tactics.attackForce.forEach(unit => {
                if (unit.state !== 'dead') {
                    const aiBase = window.game.engine.entities.find(e => 
                        e instanceof Building && e.team === this.team && e.constructor.name === 'Base'
                    );
                    if (aiBase) {
                        unit.moveTo(aiBase.position);
                    }
                }
            });
            
            // Convert attack force to defenders
            this.tactics.baseDefenders.push(...this.tactics.attackForce);
            this.tactics.attackForce = [];
        }
    }
    
    assignUnitTasks() {
        const aiUnits = this.getAIUnits();
        
        // Ensure minimum defenders
        const minDefenders = Math.max(3, Math.floor(aiUnits.length * 0.4));
        
        while (this.tactics.baseDefenders.length < minDefenders && aiUnits.length > 0) {
            const availableUnit = aiUnits.find(u => 
                !this.tactics.baseDefenders.includes(u) && 
                !this.tactics.attackForce.includes(u)
            );
            
            if (availableUnit) {
                this.tactics.baseDefenders.push(availableUnit);
            } else {
                break;
            }
        }
        
        // Position idle defenders around base
        const aiBase = this.getAIBase();
        if (aiBase) {
            this.tactics.baseDefenders.forEach((defender, index) => {
                if (defender.state === 'idle') {
                    const angle = (index / this.tactics.baseDefenders.length) * Math.PI * 2;
                    const defensePos = new Vector2(
                        aiBase.position.x + Math.cos(angle) * 100,
                        aiBase.position.y + Math.sin(angle) * 100
                    );
                    defender.moveTo(defensePos);
                }
            });
        }
    }
    
    // Helper methods
    getAIBuildings() {
        if (!window.game || !window.game.engine) return [];
        const buildings = window.game.engine.entities.filter(e => 
            e instanceof Building && e.team === this.team && !e.isDead
        );
        
        // Log building count periodically
        if (window.spLogger && Math.random() < 0.1) { // 10% chance to log
            window.spLogger.log('BUILDING_COUNT', `AI building inventory`, {
                aiId: this.aiId,
                team: this.team,
                totalBuildings: buildings.length,
                buildingDetails: buildings.map(b => ({
                    id: b.id,
                    type: b.constructor.name,
                    position: { x: b.position.x, y: b.position.y },
                    isDead: b.isDead,
                    isUnderConstruction: b.isUnderConstruction,
                    health: b.health
                }))
            });
        }
        
        return buildings;
    }
    
    getAIUnits() {
        if (!window.game || !window.game.engine) return [];
        return window.game.engine.entities.filter(e => 
            e instanceof Unit && e.team === this.team && !e.isDead
        );
    }
    
    getAIBase() {
        // Use the specific base ID to find this AI's base
        if (this.baseId) {
            return window.game.engine.entities.find(e => e.id === this.baseId);
        }
        // Fallback to original method for non-legendary modes
        return this.getAIBuildings().find(b => b.constructor.name === 'Base');
    }
    
    getCurrentAIPopulation() {
        // Calculate current AI population using the same method as the player
        const aiUnits = this.getAIUnits();
        
        // Count existing units (use populationCost property like the player system)
        const unitPopulation = aiUnits.reduce((total, unit) => total + (unit.populationCost || 1), 0);
        
        // Count units in production queues at barracks
        let queuedPopulation = 0;
        const aiBarracks = this.getAIBuildings().filter(b => b instanceof Barracks);
        aiBarracks.forEach(barracks => {
            if (barracks.productionQueue) {
                queuedPopulation += barracks.productionQueue.reduce((total, item) => {
                    return total + (item.cost && item.cost.population ? item.cost.population : 0);
                }, 0);
            }
            // Also count currently producing unit
            if (barracks.currentProduction) {
                queuedPopulation += (barracks.currentProduction.cost && barracks.currentProduction.cost.population) 
                    ? barracks.currentProduction.cost.population : 0;
            }
        });
        
        return unitPopulation + queuedPopulation;
    }
    
    getMaxAIPopulation() {
        // Calculate max AI population using the same system as the player
        const aiBarracks = this.getAIBuildings().filter(b => 
            b instanceof Barracks && !b.isUnderConstruction
        );
        
        // Base population: 25 + 5 per barracks, max 50 (same as player)
        const maxPopulation = Math.min(50, 25 + (aiBarracks.length * 5));
        
        return maxPopulation;
    }
    
    getBuildingClassName(buildingType) {
        // Convert building type string to actual class name
        const typeMap = {
            'supply': 'SupplyDepot',
            'reactor': 'Reactor', 
            'barracks': 'Barracks',
            'turret': 'Turret'
        };
        return typeMap[buildingType] || buildingType;
    }
    
    buildBuilding(buildingType) {
        // Log the build attempt
        if (window.spLogger) {
            window.spLogger.log('AI_BUILD', `Build attempt for ${buildingType}`, {
                aiId: this.aiId,
                team: this.team,
                buildingType: buildingType
            });
        }
        
        // Use stored base position if available (for legendary mode)
        let basePosition;
        if (this.basePosition) {
            basePosition = this.basePosition;
        } else {
            const aiBase = this.getAIBase();
            if (!aiBase) return;
            basePosition = aiBase.position;
        }
        
        // First check: Count existing buildings of this type to prevent over-building  
        // STRICT 2-BUILDING CAP for all building types (including queued buildings)
        const existingBuildings = this.getAIBuildings().filter(b => 
            b.constructor.name === this.getBuildingClassName(buildingType) && !b.isDead
        );
        
        // Also count buildings currently in queue
        const queuedBuildings = this.buildingQueue ? this.buildingQueue.filter(queuedBuilding => 
            queuedBuilding.type === buildingType
        ) : [];
        
        const totalCount = existingBuildings.length + queuedBuildings.length;
        
        if (totalCount >= 2) {
            console.log(`🤖 AI BUILD BLOCKED: Already have/queued ${totalCount} ${buildingType} buildings (existing: ${existingBuildings.length}, queued: ${queuedBuildings.length}) - STRICT 2-BUILDING CAP`);
            if (window.spLogger) {
                window.spLogger.log('AI_BUILD', `Build blocked - strict 2-building cap`, {
                    aiId: this.aiId,
                    buildingType: buildingType,
                    existingCount: existingBuildings.length,
                    queuedCount: queuedBuildings.length,
                    totalCount: totalCount,
                    existingBuildings: existingBuildings.map(b => ({ id: b.id, isDead: b.isDead, isUnderConstruction: b.isUnderConstruction }))
                });
            }
            return;
        }
        
        // Find a good position near base
        const buildPos = this.findBuildingPosition(basePosition, buildingType);
        if (!buildPos) {
            console.log(`🤖 AI BUILD FAILED: No valid position found for ${buildingType}`);
            if (window.spLogger) {
                window.spLogger.log('AI_BUILD', `Build failed - no valid position`, {
                    aiId: this.aiId,
                    buildingType: buildingType,
                    basePosition: basePosition
                });
            }
            return;
        }
        
        try {
            const building = BuildingFactory.create(buildingType, buildPos.x, buildPos.y, this.team);
            building.id = `ai_${buildingType}_${Date.now()}`;
            window.game.engine.addEntity(building);
            console.log(`🤖 AI REBUILD: Built ${buildingType} at (${buildPos.x.toFixed(0)}, ${buildPos.y.toFixed(0)}) - rebuilding lost infrastructure`);
            
            if (window.spLogger) {
                window.spLogger.log('AI_BUILD', `Build successful`, {
                    aiId: this.aiId,
                    buildingType: buildingType,
                    buildingId: building.id,
                    position: { x: buildPos.x, y: buildPos.y },
                    team: this.team
                });
            }
        } catch (error) {
            console.error(`AI: Failed to build ${buildingType}:`, error);
            if (window.spLogger) {
                window.spLogger.log('AI_BUILD', `Build error`, {
                    aiId: this.aiId,
                    buildingType: buildingType,
                    error: error.message
                });
            }
        }
    }
    
    findBuildingPosition(basePos, buildingType) {
        const attempts = 20;
        const minDistance = 80;  // Minimum distance from base
        const maxDistance = 150; // Reduced from 200 to 150 - same as player building radius
        
        for (let i = 0; i < attempts; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = minDistance + Math.random() * (maxDistance - minDistance);
            
            const pos = new Vector2(
                basePos.x + Math.cos(angle) * distance,
                basePos.y + Math.sin(angle) * distance
            );
            
            // Check if position is valid
            if (this.isValidBuildingPosition(pos, buildingType)) {
                return pos;
            }
        }
        
        return null; // No valid position found
    }
    
    isValidBuildingPosition(pos, buildingType) {
        const buildingSize = 80; // Standard building size
        const buffer = 60; // Increased to 60 pixels (3/4 of building size) for better spacing
        
        // Check world bounds
        if (pos.x - buildingSize/2 < 0 || pos.x + buildingSize/2 > window.game.engine.worldWidth ||
            pos.y - buildingSize/2 < 0 || pos.y + buildingSize/2 > window.game.engine.worldHeight) {
            return false;
        }
        
        // Check collision with other buildings (including dead ones that might not be cleaned up yet)
        const allBuildings = window.game.engine.entities.filter(e => e instanceof Building);
        
        for (const building of allBuildings) {
            const distance = pos.distance(building.position);
            const requiredDistance = (buildingSize + (building.width || 80)) / 2 + buffer;
            
            if (distance < requiredDistance) {
                console.log(`🤖 AI BUILD COLLISION: Position (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}) too close to ${building.constructor.name} at (${building.position.x.toFixed(0)}, ${building.position.y.toFixed(0)}) - distance: ${distance.toFixed(0)}, required: ${requiredDistance.toFixed(0)}`);
                
                if (window.spLogger) {
                    window.spLogger.log('COLLISION', `Build position collision detected`, {
                        buildingType: buildingType,
                        attemptedPosition: { x: pos.x, y: pos.y },
                        collidingBuilding: {
                            id: building.id,
                            type: building.constructor.name,
                            position: { x: building.position.x, y: building.position.y },
                            isDead: building.isDead,
                            team: building.team
                        },
                        distance: distance,
                        requiredDistance: requiredDistance
                    });
                }
                
                return false;
            }
        }
        
        return true;
    }
    
    produceUnit(unitType, barracks) {
        if (!barracks || barracks.isProducing) return;
        
        try {
            // Add unit to barracks production queue using the same method as player
            const success = barracks.addToProductionQueue(unitType, true); // Skip resource deduction for AI
            
            if (success) {
                console.log(`AI: Queued ${unitType} for production`);
            } else {
                console.error(`AI: Failed to queue ${unitType} - production queue full or invalid unit type`);
            }
        } catch (error) {
            console.error(`AI: Failed to produce ${unitType}:`, error);
        }
    }
    
    setDifficulty(difficulty) {
        this.difficulty = difficulty;
        
        switch (difficulty) {
            case 'easy':
                this.aggressiveness = 0.4;
                this.attackWaves.waveInterval = 60000; // 60 seconds
                this.attackWaves.waveSize = 2;
                this.production.productionInterval = 12000; // 12 seconds
                break;
                
            case 'hard':
                this.aggressiveness = 0.9;
                this.attackWaves.waveInterval = 30000; // 30 seconds
                this.attackWaves.waveSize = 5;
                this.production.productionInterval = 6000; // 6 seconds
                break;
                
            case 'legendary':
                this.aggressiveness = 1.0; // Maximum aggression
                this.attackWaves.waveInterval = 10000; // 10 seconds - EXTREMELY fast attacks
                this.attackWaves.waveSize = Infinity; // NO LIMIT - send everything!
                this.production.productionInterval = 2000; // 2 seconds - hyper-fast production
                this.economyFocus = 0.8; // Maximum economy focus for sustainability
                this.defenseRadius = 1000; // Maximum awareness radius
                this.isLegendaryMode = true; // Flag for special behavior
                console.log('🔥 LEGENDARY MODE ACTIVATED: No wave limits, maximum aggression!');
                break;
                
            default: // normal
                this.aggressiveness = 0.7;
                this.attackWaves.waveInterval = 45000; // 45 seconds
                this.attackWaves.waveSize = 3;
                this.production.productionInterval = 8000; // 8 seconds
        }
        
        console.log(`AI difficulty set to: ${difficulty}`);
    }
    
    // Enhanced targeting for legendary mode
    findBestPlayerTarget() {
        if (!window.game || !window.game.engine) return null;
        
        // In legendary mode, prioritize player base for maximum pressure
        if (this.isLegendaryMode) {
            const playerBase = window.game.engine.entities.find(e => 
                e instanceof Building && e.team === 'player' && e.constructor.name === 'Base' && !e.isDead
            );
            
            if (playerBase) return playerBase;
        }
        
        // Fallback to any player building
        const playerBuildings = window.game.engine.entities.filter(e => 
            e instanceof Building && e.team === 'player' && !e.isDead
        );
        
        if (playerBuildings.length > 0) {
            return playerBuildings[Math.floor(Math.random() * playerBuildings.length)];
        }
        
        return null;
    }
}

// Make AI opponent available globally
window.AIOpponent = AIOpponent;
console.log('AI opponent system loaded');