// Building System
console.log('Loading buildings...');

class Building {
    constructor(x, y, team = 'player') {
        this.id = null;
        this.position = new Vector2(x, y);
        this.team = team;
        this.isDead = false;
        
        // Basic properties
        this.width = 80;
        this.height = 80;
        this.maxHealth = 500;
        this.health = this.maxHealth;
        
        // Building state
        this.isActive = true;
        this.isUnderConstruction = true;
        this.constructionTime = 30000; // 30 seconds
        this.constructionProgress = 0;
        this.constructionStartTime = Date.now();
        
        // Production
        this.productionQueue = [];
        this.isProducing = false;
        this.currentProduction = null;
        this.productionStartTime = 0;
        
        // Resources
        this.supplyRate = 0;
        this.powerRate = 0;
        this.supplyCost = 200;
        this.powerCost = 100;
        
        // Visual
        this.color = team === 'player' ? '#004488' : '#884400';
        this.selected = false;
    }
    
    update(deltaTime) {
        if (this.isDead) return;
        
        // Update construction
        if (this.isUnderConstruction) {
            this.updateConstruction();
        }
        
        // Update production
        if (this.isActive && !this.isUnderConstruction) {
            this.updateProduction();
        }
        
        // Check for death
        if (this.health <= 0) {
            this.die();
        }
    }
    
    updateConstruction() {
        const currentTime = Date.now();
        const elapsed = currentTime - this.constructionStartTime;
        this.constructionProgress = Math.min(elapsed / this.constructionTime, 1);
        
        if (this.constructionProgress >= 1) {
            this.isUnderConstruction = false;
            this.onConstructionComplete();
        }
    }
    
    updateProduction() {
        if (!this.isProducing && this.productionQueue.length > 0) {
            this.startNextProduction();
        }
        
        if (this.isProducing && this.currentProduction) {
            const currentTime = Date.now();
            const elapsed = currentTime - this.productionStartTime;
            this.currentProduction.progress = Math.min(elapsed / this.currentProduction.buildTime, 1);
            
            if (this.currentProduction.progress >= 1) {
                this.completeProduction();
            }
        }
    }
    
    render(ctx, camera) {
        if (this.isDead) return;
        
        ctx.save();
        
        // Building body
        ctx.fillStyle = this.isUnderConstruction ? 
            `rgba(${this.getRGBFromHex(this.color)}, ${this.constructionProgress})` : 
            this.color;
        
        ctx.fillRect(
            this.position.x - this.width / 2,
            this.position.y - this.height / 2,
            this.width,
            this.height
        );
        
        // Building outline
        ctx.strokeStyle = this.team === 'player' ? '#00ff00' : '#ff0000';
        ctx.lineWidth = this.selected ? 3 : 1;
        ctx.strokeRect(
            this.position.x - this.width / 2,
            this.position.y - this.height / 2,
            this.width,
            this.height
        );
        
        // Construction progress
        if (this.isUnderConstruction) {
            this.renderConstructionProgress(ctx);
        }
        
        // Production progress
        if (this.isProducing && this.currentProduction) {
            this.renderProductionProgress(ctx);
        }
        
        // Health bar
        if (this.selected || this.health < this.maxHealth) {
            this.renderHealthBar(ctx);
        }
        
        ctx.restore();
    }
    
    renderConstructionProgress(ctx) {
        const barWidth = this.width;
        const barHeight = 8;
        const x = this.position.x - barWidth / 2;
        const y = this.position.y + this.height / 2 + 10;
        
        // Background
        ctx.fillStyle = '#333';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // Progress
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(x, y, barWidth * this.constructionProgress, barHeight);
        
        // Border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, barWidth, barHeight);
        
        // Text
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Building...', this.position.x, y - 5);
    }
    
    renderProductionProgress(ctx) {
        const barWidth = this.width;
        const barHeight = 6;
        const x = this.position.x - barWidth / 2;
        const y = this.position.y + this.height / 2 + 25;
        
        // Background
        ctx.fillStyle = '#333';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // Progress
        ctx.fillStyle = '#00aaff';
        ctx.fillRect(x, y, barWidth * this.currentProduction.progress, barHeight);
        
        // Border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, barWidth, barHeight);
        
        // Text
        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Producing: ${this.currentProduction.type}`, this.position.x, y - 3);
    }
    
    renderHealthBar(ctx) {
        const barWidth = this.width;
        const barHeight = 6;
        const x = this.position.x - barWidth / 2;
        const y = this.position.y - this.height / 2 - 15;
        
        // Background
        ctx.fillStyle = '#333';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // Health
        const healthPercent = this.health / this.maxHealth;
        const healthColor = healthPercent > 0.5 ? '#0f0' : healthPercent > 0.25 ? '#ff0' : '#f00';
        ctx.fillStyle = healthColor;
        ctx.fillRect(x, y, barWidth * healthPercent, barHeight);
        
        // Border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, barWidth, barHeight);
    }
    
    onConstructionComplete() {
        console.log(`${this.constructor.name} construction completed`);
        
        // Add any population capacity
        if (this.populationCapacity && window.game && window.game.resources) {
            window.game.resources.increasePopulationCap(this.populationCapacity);
        }
    }
    
    addToProductionQueue(unitType, skipResourceDeduction = false) {
        const unitCost = UnitFactory.getUnitCost(unitType);
        
        if (!skipResourceDeduction) {
            if (!window.game || !window.game.resources || !window.game.resources.canAfford(unitCost.supplies, unitCost.power, unitCost.population)) {
                console.log(`Cannot afford ${unitType} - needs ${unitCost.supplies} supplies, ${unitCost.power} power, and ${unitCost.population} population space`);
                return false;
            }
            
            // Spend supplies when queuing
            window.game.resources.spendResources(unitCost.supplies, 0); 
        }
        
        this.productionQueue.push({
            type: unitType,
            buildTime: unitCost.buildTime,
            progress: 0,
            cost: unitCost
        });
        
        // Update population immediately to show reserved population
        if (window.game.resources) {
            window.game.resources.updatePopulation();
            window.game.resources.updateUI();
        }
        
        return true;
    }
    
    startNextProduction() {
        if (this.productionQueue.length === 0) return;
        
        this.currentProduction = this.productionQueue.shift();
        this.isProducing = true;
        this.productionStartTime = Date.now();
    }
    
    completeProduction() {
        if (!this.currentProduction) return;
        
        // Spawn unit at rally point or building position
        const spawnPos = this.getRallyPoint();
        const unit = UnitFactory.create(this.currentProduction.type, spawnPos.x, spawnPos.y, this.team);
        
        if (window.game && window.game.engine) {
            window.game.engine.addEntity(unit);
            
            // Update population count after spawning
            if (window.game.resourceManager) {
                window.game.resourceManager.updatePopulation();
            }
            
            // Send multiplayer action for unit spawn
            if (window.game.isMultiplayer) {
                window.game.sendMultiplayerAction('unitSpawn', {
                    unitType: this.currentProduction.type,
                    position: { x: spawnPos.x, y: spawnPos.y },
                    team: this.team,
                    unitId: unit.id,
                    buildingId: this.id
                });
            }
        }
        
        console.log(`${this.currentProduction.type} production completed`);
        
        this.currentProduction = null;
        this.isProducing = false;
    }
    
    getRallyPoint() {
        // Find available spawn position near building
        const baseX = this.position.x;
        const baseY = this.position.y + this.height / 2 + 60; // Increased initial distance
        
        // Try to find an unoccupied position
        const unitRadius = 15; // Standard unit size
        const maxAttempts = 30; // Increased attempts
        const spreadDistance = 50; // Increased spread distance
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            let offsetX = 0;
            let offsetY = 0;
            
            if (attempt > 0) {
                // Improved formation pattern - create concentric circles
                const ring = Math.floor((attempt - 1) / 8) + 1; // Which ring (circle) we're on
                const posInRing = (attempt - 1) % 8; // Position within the ring
                const angle = (posInRing * 45) * (Math.PI / 180); // 45 degrees apart (8 positions per ring)
                const distance = ring * spreadDistance;
                offsetX = Math.cos(angle) * distance;
                offsetY = Math.sin(angle) * distance;
            }
            
            const testPos = new Vector2(
                baseX + offsetX,
                baseY + offsetY
            );
            
            // Check if position is clear and within bounds
            if (this.isPositionClear(testPos, unitRadius) && this.isWithinBounds(testPos)) {
                return testPos;
            }
        }
        
        // Fallback to base position if no clear spot found
        return new Vector2(baseX, baseY);
    }
    
    isWithinBounds(position) {
        // Make sure spawn position is within world bounds
        if (!window.game || !window.game.engine) return true;
        
        const margin = 50; // Keep units away from world edges
        return position.x >= margin && 
               position.x <= window.game.engine.worldWidth - margin &&
               position.y >= margin && 
               position.y <= window.game.engine.worldHeight - margin;
    }
    
    isPositionClear(position, radius) {
        if (!window.game || !window.game.engine) return true;
        
        // Check against all existing units (both friendly and enemy for better spacing)
        for (const entity of window.game.engine.entities) {
            if (entity.type === 'unit') {
                const distance = Math.sqrt(
                    Math.pow(entity.position.x - position.x, 2) + 
                    Math.pow(entity.position.y - position.y, 2)
                );
                // Use larger radius for better spacing (3x instead of 2x)
                if (distance < radius * 3) {
                    return false; // Too close to existing unit
                }
            }
            // Also check against buildings to avoid spawning inside them
            if (entity.type === 'building') {
                const distance = Math.sqrt(
                    Math.pow(entity.position.x - position.x, 2) + 
                    Math.pow(entity.position.y - position.y, 2)
                );
                // Check if unit would spawn inside or too close to building
                const buildingRadius = Math.max(entity.width, entity.height) / 2;
                if (distance < radius + buildingRadius + 10) {
                    return false; // Too close to building
                }
            }
        }
        return true;
    }
    
    takeDamage(amount, fromMultiplayer = false, attacker = null) {
        this.health = Math.max(0, this.health - amount);
        
        if (this.health <= 0) {
            this.die();
        }
    }
    
    die() {
        this.isDead = true;
        this.isActive = false;
        
        if (window.game && window.game.engine) {
            window.game.engine.deselectEntity(this);
        }
        
        // Cancel production - queued units will be automatically removed from population count
        this.productionQueue = [];
        this.currentProduction = null;
        this.isProducing = false;
    }
    
    getRGBFromHex(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `${r}, ${g}, ${b}`;
    }
    
    getInfo() {
        return {
            type: this.constructor.name,
            team: this.team,
            health: this.health,
            maxHealth: this.maxHealth,
            isActive: this.isActive,
            isUnderConstruction: this.isUnderConstruction,
            constructionProgress: this.constructionProgress,
            productionQueue: this.productionQueue.length,
            currentProduction: this.currentProduction?.type || null
        };
    }
}

// Specific Building Types
class Base extends Building {
    constructor(x, y, team = 'player') {
        super(x, y, team);
        
        this.width = 120;
        this.height = 120;
        this.maxHealth = 1000;
        this.health = this.maxHealth;
        this.constructionTime = 30000; // 30 seconds to build
        
        this.supplyRate = 0; // Base doesn't generate supplies anymore
        this.powerRate = 0; // Power comes from reactors
        this.populationCapacity = 0; // Base doesn't add population
        
        this.supplyCost = 500;
        this.powerCost = 0; // All buildings cost supplies only
        
        this.color = team === 'player' ? '#003366' : '#663300';
        
        // Can produce basic units
        this.canProduce = ['marine'];
    }
    
    render(ctx, camera) {
        super.render(ctx, camera);
        
        if (!this.isDead) {
            // Add base-specific details
            ctx.fillStyle = '#666';
            ctx.fillRect(
                this.position.x - 10,
                this.position.y - 10,
                20, 20
            );
            
            // Command center indicator
            ctx.fillStyle = '#fff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('HQ', this.position.x, this.position.y + 4);
        }
    }
}

class SupplyDepot extends Building {
    constructor(x, y, team = 'player') {
        super(x, y, team);
        
        this.width = 60;
        this.height = 60;
        this.maxHealth = 300;
        this.health = this.maxHealth;
        this.constructionTime = 30000; // 30 seconds to build
        
        this.supplyRate = 4; // SupplyDepots generate 4 supplies per second
        this.populationCapacity = 0; // SupplyDepots don't add population
        
        this.supplyCost = 150;
        this.powerCost = 0; // All buildings cost supplies only
        
        this.color = team === 'player' ? '#446644' : '#664444';
    }
}

class Barracks extends Building {
    constructor(x, y, team = 'player') {
        super(x, y, team);
        
        this.width = 100;
        this.height = 80;
        this.maxHealth = 600;
        this.health = this.maxHealth;
        this.constructionTime = 30000; // 30 seconds to build
        
        this.populationCapacity = 5; // Barracks add 5 population capacity
        
        this.supplyCost = 300;
        this.powerCost = 0; // All buildings cost supplies only
        
        this.color = team === 'player' ? '#664422' : '#442266';
        
        // Can produce infantry units
        this.canProduce = ['marine', 'warthog', 'scorpion'];
    }
    
    render(ctx, camera) {
        super.render(ctx, camera);
        
        if (!this.isDead && !this.isUnderConstruction) {
            // Add barracks-specific details
            ctx.fillStyle = '#888';
            
            // Training facility indicator
            ctx.fillRect(
                this.position.x - 30,
                this.position.y - 15,
                60, 30
            );
            
            ctx.fillStyle = '#fff';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('BARRACKS', this.position.x, this.position.y + 3);
        }
    }
}

class Reactor extends Building {
    constructor(x, y, team = 'player') {
        super(x, y, team);
        
        this.width = 70;
        this.height = 70;
        this.maxHealth = 400;
        this.health = this.maxHealth;
        this.constructionTime = 30000; // 30 seconds to build
        
        // Reactor provides 1 power when completed
        this.powerGeneration = 1;
        
        // Cost calculated dynamically based on existing reactors
        const reactorCount = window.game?.resources?.reactorCount || 0;
        this.supplyCost = 250 + (reactorCount * 250);
        this.powerCost = 0; // Only costs supplies
        
        this.color = team === 'player' ? '#0066cc' : '#cc6600';
    }
    
    render(ctx, camera) {
        super.render(ctx, camera);
        
        if (!this.isDead && !this.isUnderConstruction) {
            // Add reactor-specific details
            ctx.fillStyle = '#00aaff';
            
            // Reactor core
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, 15, 0, Math.PI * 2);
            ctx.fill();
            
            // Power lines/connections
            ctx.strokeStyle = '#66ccff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.position.x - 25, this.position.y);
            ctx.lineTo(this.position.x + 25, this.position.y);
            ctx.moveTo(this.position.x, this.position.y - 25);
            ctx.lineTo(this.position.x, this.position.y + 25);
            ctx.stroke();
            
            // Reactor label
            ctx.fillStyle = '#fff';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('REACTOR', this.position.x, this.position.y + 40);
        }
    }
}

// Building Factory
const BuildingFactory = {
    create: (type, x, y, team = 'player') => {
        switch (type.toLowerCase()) {
            case 'base':
                return new Base(x, y, team);
            case 'supply':
            case 'supplydepot':
                return new SupplyDepot(x, y, team);
            case 'barracks':
                return new Barracks(x, y, team);
            case 'reactor':
                return new Reactor(x, y, team);
            case 'turret':
                return new Turret(x, y, team);
            default:
                return new Building(x, y, team);
        }
    },
    
    getBuildingCost: (type) => {
        // Special handling for reactor cost
        if (type.toLowerCase() === 'reactor') {
            const reactorCount = window.game?.resources?.reactorCount || 0;
            return {
                supplies: 250 + (reactorCount * 250),
                power: 0,
                buildTime: 30000 // 30 seconds to build
            };
        }
        
        const tempBuilding = BuildingFactory.create(type, 0, 0);
        return {
            supplies: tempBuilding.supplyCost,
            power: tempBuilding.powerCost,
            buildTime: tempBuilding.constructionTime
        };
    }
};

// Turret Defense Building
class Turret extends Building {
    constructor(x, y, team = 'player') {
        super(x, y, team);
        
        this.width = 60;
        this.height = 60;
        this.maxHealth = 800; // Doubled from 400 - much more durable
        this.health = this.maxHealth;
        this.constructionTime = 15000; // 15 seconds to build
        
        this.supplyCost = 250;
        this.powerCost = 1; // Requires 1 power
        
        this.color = team === 'player' ? '#666666' : '#993333';
        
        // Combat properties - Rapid fire, low damage
        this.damage = 25; // Much lower damage per shot (was 75)
        this.attackRange = 180; // Keep same range
        this.attackCooldown = 150; // Much faster rate of fire (was 300ms)
        this.lastAttackTime = 0;
        this.attackTarget = null;
        
        // Turret specific properties
        this.rotation = 0; // Turret can rotate to face targets
        this.detectionRange = 200; // Slightly longer than attack range
        
        this.canProduce = []; // Turrets don't produce anything
    }
    
    update(deltaTime) {
        super.update(deltaTime);
        
        if (this.isDead || this.isUnderConstruction) return;
        
        // Auto-target enemies
        this.updateTargeting(deltaTime);
        
        // Attack current target
        this.updateAttack(deltaTime);
    }
    
    updateTargeting(deltaTime) {
        if (!window.game || !window.game.engine) return;
        
        // All turrets should auto-target enemies, but only send multiplayer events for our turrets
        const isMultiplayer = window.game && window.game.isMultiplayer === true;
        const isMyTurret = !isMultiplayer || this.team === window.game.playerTeam;
        
        // If we don't have a target or target is dead/out of range, find a new one
        if (!this.attackTarget || this.attackTarget.isDead || 
            this.position.distance(this.attackTarget.position) > this.detectionRange) {
            
            const nearbyEnemies = window.game.engine.getEntitiesNear(this.position, this.detectionRange)
                .filter(entity => 
                    (entity instanceof Unit || entity instanceof Building) && 
                    entity.team !== this.team && 
                    !entity.isDead
                );
            
            if (nearbyEnemies.length > 0) {
                // Prioritize units over buildings, then by closest distance
                const enemyUnits = nearbyEnemies.filter(e => e instanceof Unit);
                const targets = enemyUnits.length > 0 ? enemyUnits : nearbyEnemies;
                
                // Find closest target
                this.attackTarget = targets.reduce((closest, target) => {
                    const closestDist = this.position.distance(closest.position);
                    const targetDist = this.position.distance(target.position);
                    return targetDist < closestDist ? target : closest;
                });
                
                // Only send multiplayer action for our turrets to avoid conflicts
                if (isMyTurret && isMultiplayer) {
                    window.game.sendMultiplayerAction('turretTarget', {
                        turretId: this.id,
                        targetId: this.attackTarget.id,
                        team: this.team
                    });
                }
            } else {
                this.attackTarget = null;
            }
        }
        
        // Rotate turret to face target
        if (this.attackTarget) {
            const direction = this.attackTarget.position.subtract(this.position);
            this.rotation = Math.atan2(direction.y, direction.x);
        }
    }
    
    updateAttack(deltaTime) {
        if (!this.attackTarget || this.attackTarget.isDead) {
            this.attackTarget = null;
            return;
        }
        
        const distance = this.position.distance(this.attackTarget.position);
        
        if (distance > this.attackRange) {
            this.attackTarget = null; // Target moved out of range
            return;
        }
        
        // Attack if cooldown is ready
        const currentTime = Date.now();
        if (currentTime - this.lastAttackTime >= this.attackCooldown) {
            this.performAttack(this.attackTarget);
            this.lastAttackTime = currentTime;
        }
    }
    
    performAttack(target) {
        if (!target || target.isDead) return;
        
        // In multiplayer, turrets should always be able to deal damage regardless of team
        // Each player simulates all turret damage to ensure turrets can actually kill units
        // This is different from units where only the owner has authority
        const isMultiplayer = window.game && window.game.isMultiplayer === true;
        const isMyBuilding = !isMultiplayer || this.team === window.game.playerTeam;
        
        // Debug logging for turret authority check
        console.log(`TURRET AUTHORITY: ${this.constructor.name} ${this.id} (team: ${this.team}) attacking ${target.constructor.name} ${target.id} (team: ${target.team})`);
        console.log(`  isMultiplayer: ${isMultiplayer}, playerTeam: ${window.game ? window.game.playerTeam : 'N/A'}`);
        console.log(`  this.team === playerTeam: ${this.team === (window.game ? window.game.playerTeam : 'N/A')}`);
        console.log(`  isMyBuilding: ${isMyBuilding}, but turrets always have authority in multiplayer`);
        
        // Create visual effects
        this.createAttackEffects(target);
        
        // Turrets always apply damage in multiplayer (unlike units which need ownership authority)
        // This ensures turrets can actually kill enemy troops as intended
        target.takeDamage(this.damage, false, this); // Pass the turret as attacker
        console.log(`${this.constructor.name} attacked ${target.constructor.name} for ${this.damage} damage`);
        
        // Send damage event to other players
        if (isMultiplayer) {
            window.game.sendMultiplayerAction('turretDamage', {
                turretId: this.id,
                targetId: target.id,
                damage: this.damage,
                targetTeam: target.team,
                timestamp: Date.now()
            });
        }
    }
    
    createAttackEffects(target) {
        // Create bullet effect from turret to target
        if (window.game && window.game.engine) {
            const bullet = new Bullet(this.position.clone(), target.position.clone());
            window.game.engine.addBullet(bullet);
        }
        
        // Create muzzle flash effect
        if (window.game && window.game.engine) {
            const direction = target.position.subtract(this.position);
            const muzzleFlash = new MuzzleFlashEffect(this.position.clone(), direction);
            window.game.engine.addEffect(muzzleFlash);
        }
    }
    
    render(ctx, camera) {
        if (this.isDead) return;
        
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        
        // Base platform
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
        
        // Turret gun (rotated)
        ctx.save();
        ctx.rotate(this.rotation);
        
        // Gun barrel
        ctx.fillStyle = this.team === 'player' ? '#444444' : '#771111';
        ctx.fillRect(0, -4, 30, 8);
        
        // Gun base
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
        
        // Construction overlay
        if (this.isUnderConstruction) {
            ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
            ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
            
            const progress = Math.min(1, this.constructionProgress);
            ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
            ctx.fillRect(-this.width/2, this.height/2 - 4, this.width * progress, 4);
        }
        
        // Selection indicator
        if (this.selected) {
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            ctx.strokeRect(-this.width/2 - 2, -this.height/2 - 2, this.width + 4, this.height + 4);
        }
        
        // Health bar
        if (this.health < this.maxHealth) {
            const barWidth = this.width;
            const barHeight = 6;
            const healthPercent = this.health / this.maxHealth;
            
            ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
            ctx.fillRect(-barWidth/2, -this.height/2 - 12, barWidth, barHeight);
            
            ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
            ctx.fillRect(-barWidth/2, -this.height/2 - 12, barWidth * healthPercent, barHeight);
        }
        
        // Attack range when selected
        if (this.selected) {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(0, 0, this.attackRange, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        ctx.restore();
    }
}