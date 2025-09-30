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
        
        // Tactical state
        this.tactics = {
            baseDefenders: [], // Units assigned to defend base
            attackForce: [], // Units assigned to attack
            scouts: [], // Units assigned to scout
            isDefending: false,
            lastDefenseTime: 0
        };
    }
    
    // Initialize AI with a premade base
    initializeBase() {
        if (!window.game || !window.game.engine) {
            console.error('Cannot initialize AI base: game engine not available');
            return;
        }
        
        const baseX = 1800; // Right side of map
        const baseY = 800; // Center vertically
        
        // Create main base (HQ)
        const mainBase = BuildingFactory.create('base', baseX, baseY, this.team);
        mainBase.id = `ai_base_${Date.now()}`;
        mainBase.isUnderConstruction = false; // Start completed
        window.game.engine.addEntity(mainBase);
        
        // Create defensive turrets around base
        const turretPositions = [
            { x: baseX - 150, y: baseY - 100 }, // Top-left
            { x: baseX + 150, y: baseY - 100 }, // Top-right
            { x: baseX - 150, y: baseY + 100 }, // Bottom-left
            { x: baseX + 150, y: baseY + 100 }, // Bottom-right
            { x: baseX, y: baseY - 200 },       // North guard
            { x: baseX - 200, y: baseY }        // West guard
        ];
        
        turretPositions.forEach((pos, index) => {
            const turret = BuildingFactory.create('turret', pos.x, pos.y, this.team);
            turret.id = `ai_turret_${index}_${Date.now()}`;
            turret.isUnderConstruction = false; // Start completed
            window.game.engine.addEntity(turret);
        });
        
        // Create support buildings
        const supplyDepot = BuildingFactory.create('supply', baseX - 100, baseY + 150, this.team);
        supplyDepot.id = `ai_supply_${Date.now()}`;
        supplyDepot.isUnderConstruction = false;
        window.game.engine.addEntity(supplyDepot);
        
        const reactor = BuildingFactory.create('reactor', baseX + 100, baseY + 150, this.team);
        reactor.id = `ai_reactor_${Date.now()}`;
        reactor.isUnderConstruction = false;
        window.game.engine.addEntity(reactor);
        
        const barracks = BuildingFactory.create('barracks', baseX, baseY + 200, this.team);
        barracks.id = `ai_barracks_${Date.now()}`;
        barracks.isUnderConstruction = false;
        window.game.engine.addEntity(barracks);
        
        // Create initial army
        this.spawnInitialUnits(baseX, baseY);
        
        console.log(`AI base initialized at (${baseX}, ${baseY}) with 6 turrets and initial army`);
    }
    
    spawnInitialUnits(baseX, baseY) {
        // Spawn initial defending units
        const unitTypes = ['marine', 'marine', 'warthog', 'marine', 'scorpion'];
        const spawnRadius = 120;
        
        unitTypes.forEach((unitType, index) => {
            const angle = (index / unitTypes.length) * Math.PI * 2;
            const spawnX = baseX + Math.cos(angle) * spawnRadius;
            const spawnY = baseY + Math.sin(angle) * spawnRadius;
            
            const unit = UnitFactory.create(unitType, spawnX, spawnY, this.team);
            unit.id = `ai_${unitType}_${index}_${Date.now()}`;
            window.game.engine.addEntity(unit);
            
            // Assign initial defenders
            this.tactics.baseDefenders.push(unit);
        });
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
        
        // Start with moderate resources for enhanced base
        this.resources = {
            credits: 1000,
            energy: 200,
            materials: 400
        };
        
        console.log(`Enhanced legendary AI base ${aiIndex} initialized at (${baseX.toFixed(0)}, ${baseY.toFixed(0)}) with full infrastructure`);
    }
    
    spawnLegendaryInitialUnits(baseX, baseY) {
        // Spawn larger initial army for legendary mode
        const unitTypes = ['marine', 'marine', 'marine', 'warthog', 'warthog', 'scorpion', 'marine', 'marine'];
        const spawnRadius = 180;
        
        unitTypes.forEach((unitType, index) => {
            const angle = (index / unitTypes.length) * Math.PI * 2;
            const spawnX = baseX + Math.cos(angle) * spawnRadius;
            const spawnY = baseY + Math.sin(angle) * spawnRadius;
            
            const unit = UnitFactory.create(unitType, spawnX, spawnY, this.team);
            unit.id = `ai_${unitType}_${this.team}_${index}_${Date.now()}`;
            window.game.engine.addEntity(unit);
            
            // Assign initial defenders
            this.tactics.baseDefenders.push(unit);
        });
    }
    
    initializeSuperNovaBase(aiIndex) {
        console.log(`Initializing enhanced Super Nova AI base ${aiIndex} for team ${this.team}...`);
        
        // Position AI bases randomly across the 6000x6000 map, but not too close to center
        const centerX = 3000;
        const centerY = 3000;
        const minRadius = 1200; // Increased minimum distance from center for proper spacing
        const maxRadius = 2700; // Reduced maximum to ensure they fit in map
        
        // Generate position with collision checking
        let baseX, baseY, attempts = 0;
        do {
            const angle = Math.random() * Math.PI * 2;
            const radius = minRadius + Math.random() * (maxRadius - minRadius);
            baseX = centerX + Math.cos(angle) * radius;
            baseY = centerY + Math.sin(angle) * radius;
            attempts++;
        } while (this.checkBaseOverlap(baseX, baseY, 600) && attempts < 50); // 600 unit minimum distance
        
        console.log(`Super Nova AI ${aiIndex} positioned at (${baseX.toFixed(0)}, ${baseY.toFixed(0)}) after ${attempts} attempts`);
        
        // Store this AI's base position for future building placement
        this.basePosition = { x: baseX, y: baseY };
        this.baseId = `supernova_base_${this.team}_${aiIndex}_${Date.now()}`;
        
        // Create AI base (HQ)
        const base = BuildingFactory.create('base', baseX, baseY, this.team);
        base.id = this.baseId;
        base.isUnderConstruction = false;
        window.game.engine.addEntity(base);
        
        // Create full base infrastructure with 2 of each building
        this.createFullBaseInfrastructure(baseX, baseY, aiIndex);
        
        // Start with moderate resources for Super Nova mode
        this.resources = {
            credits: 600,
            energy: 150,
            materials: 300
        };
        
        console.log(`Enhanced Super Nova AI base ${aiIndex} initialized at (${baseX.toFixed(0)}, ${baseY.toFixed(0)}) with full infrastructure`);
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
    
    checkBaseOverlap(newX, newY, minDistance) {
        // Check against player base position
        const playerBaseX = this.team === 'enemy' ? 3000 : 2500; // Adjust based on mode
        const playerBaseY = this.team === 'enemy' ? 3000 : 2500;
        
        const distToPlayer = Math.sqrt((newX - playerBaseX) ** 2 + (newY - playerBaseY) ** 2);
        if (distToPlayer < minDistance) {
            return true; // Too close to player
        }
        
        // Check against existing AI bases (if any exist)
        if (window.game && window.game.engine) {
            const existingBases = window.game.engine.entities.filter(entity => 
                entity.constructor.name === 'Base' && 
                entity.team === this.team
            );
            
            for (const base of existingBases) {
                const dist = Math.sqrt((newX - base.position.x) ** 2 + (newY - base.position.y) ** 2);
                if (dist < minDistance) {
                    return true; // Too close to existing AI base
                }
            }
        }
        
        return false; // No overlap
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
        
        // Check current resource buildings
        const aiBuildings = this.getAIBuildings();
        const supplyDepots = aiBuildings.filter(b => b instanceof SupplyDepot).length;
        const reactors = aiBuildings.filter(b => b instanceof Reactor).length;
        const barracks = aiBuildings.filter(b => b instanceof Barracks).length;
        
        // Build based on priority and need (more aggressive in legendary mode)
        if (this.isLegendaryMode) {
            // LEGENDARY: Build massive infrastructure for overwhelming production
            if (supplyDepots < 5) { // More supply depots
                this.buildBuilding('supply');
            } else if (reactors < 3) { // More reactors
                this.buildBuilding('reactor');
            } else if (barracks < 5) { // More barracks for massive production
                this.buildBuilding('barracks');
            }
        } else {
            // Normal build limits
            if (supplyDepots < 2) {
                this.buildBuilding('supply');
            } else if (reactors < 2) {
                this.buildBuilding('reactor');
            } else if (barracks < 2) {
                this.buildBuilding('barracks');
            }
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
        
        // In legendary mode, produce from ALL available barracks simultaneously
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
        
        // Produce units from selected barracks
        barracksToUse.forEach(barracks => {
            this.produceUnit(unitToProduce, barracks);
        });
        
        if (this.isLegendaryMode) {
            console.log(`🔥 LEGENDARY: Producing ${unitToProduce} from ${barracksToUse.length} barracks simultaneously!`);
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
        return window.game.engine.entities.filter(e => 
            e instanceof Building && e.team === this.team && !e.isDead
        );
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
    
    buildBuilding(buildingType) {
        // Use stored base position if available (for legendary mode)
        let basePosition;
        if (this.basePosition) {
            basePosition = this.basePosition;
        } else {
            const aiBase = this.getAIBase();
            if (!aiBase) return;
            basePosition = aiBase.position;
        }
        
        // Find a good position near base
        const buildPos = this.findBuildingPosition(basePosition, buildingType);
        if (!buildPos) return;
        
        try {
            const building = BuildingFactory.create(buildingType, buildPos.x, buildPos.y, this.team);
            building.id = `ai_${buildingType}_${Date.now()}`;
            window.game.engine.addEntity(building);
            console.log(`AI: Built ${buildingType} at (${buildPos.x}, ${buildPos.y})`);
        } catch (error) {
            console.error(`AI: Failed to build ${buildingType}:`, error);
        }
    }
    
    findBuildingPosition(basePos, buildingType) {
        const attempts = 20;
        const minDistance = 80;
        const maxDistance = 200;
        
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
        const buffer = 20;
        
        // Check world bounds
        if (pos.x - buildingSize/2 < 0 || pos.x + buildingSize/2 > window.game.engine.worldWidth ||
            pos.y - buildingSize/2 < 0 || pos.y + buildingSize/2 > window.game.engine.worldHeight) {
            return false;
        }
        
        // Check collision with other buildings
        const allBuildings = window.game.engine.entities.filter(e => e instanceof Building && !e.isDead);
        
        for (const building of allBuildings) {
            const distance = pos.distance(building.position);
            if (distance < (buildingSize + building.width) / 2 + buffer) {
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