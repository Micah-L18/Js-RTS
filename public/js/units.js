// Base Unit class and specific unit types
console.log('Loading units...');

class Unit {
    constructor(x, y, team = 'player') {
        this.id = null;
        this.position = new Vector2(x, y);
        this.velocity = new Vector2(0, 0);
        this.target = null;
        this.destination = null;
        
        // Basic properties
        this.team = team;
        this.radius = 15;
        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.isDead = false;
        
        // Movement properties
        this.maxSpeed = 50;
        this.acceleration = 200;
        this.friction = 0.8;
        this.rotationSpeed = 3;
        this.rotation = 0;
        
        // Combat properties
        this.damage = 20;
        this.attackRange = 80;
        this.attackCooldown = 1000; // milliseconds
        this.lastAttackTime = 0;
        this.attackTarget = null;
        
        // Visual properties
        this.color = team === 'player' ? '#0066cc' : '#cc3333';
        this.size = 20;
        
        // State
        this.state = 'idle'; // idle, moving, attacking, dead
        this.selected = false;
        this.savedDestination = null; // Remember destination when interrupted by attack
        
        // Cost and production
        this.supplyCost = 1;
        this.powerCost = 0;
        this.populationCost = 1; // Population space this unit takes
        this.buildTime = 3000;
    }
    
    update(deltaTime) {
        if (this.isDead) return;
        
        // Update based on current state
        switch (this.state) {
            case 'moving':
                this.updateMovement(deltaTime);
                break;
            case 'attacking':
                this.updateAttack(deltaTime);
                break;
            case 'idle':
                this.updateIdle(deltaTime);
                break;
        }
        
        // Check for death
        if (this.health <= 0) {
            this.die();
        }
        
        // Update position with collision detection
        const newPosition = this.position.add(this.velocity.multiply(deltaTime / 1000));
        
        // Check for collision with buildings
        if (window.game && window.game.engine) {
            let collisionDetected = false;
            
            const buildings = window.game.engine.entities.filter(entity => entity instanceof Building && !entity.isDead);
            
            for (const building of buildings) {
                // Calculate collision boundaries (building bounds + unit radius)
                const minX = building.position.x - building.width/2 - this.radius;
                const maxX = building.position.x + building.width/2 + this.radius;
                const minY = building.position.y - building.height/2 - this.radius;
                const maxY = building.position.y + building.height/2 + this.radius;
                
                // Check if new position would collide
                if (newPosition.x >= minX && newPosition.x <= maxX && 
                    newPosition.y >= minY && newPosition.y <= maxY) {
                    collisionDetected = true;
                    
                    // Simple avoidance: move away from building center
                    const buildingCenter = building.position;
                    const awayFromBuilding = this.position.subtract(buildingCenter).normalize();
                    
                    // If we have a destination, blend the avoidance with movement toward destination
                    if (this.destination) {
                        const toDestination = this.destination.subtract(this.position).normalize();
                        // Average the two directions
                        const blendedDirection = awayFromBuilding.add(toDestination).normalize();
                        this.velocity = blendedDirection.multiply(this.maxSpeed * 0.6);
                    } else {
                        // Just move away from building
                        this.velocity = awayFromBuilding.multiply(this.maxSpeed * 0.5);
                    }
                    break;
                }
            }
            
            // Only update position if no collision
            if (!collisionDetected) {
                this.position = newPosition;
            } else {
                // Still move slightly to avoid getting stuck
                this.position = this.position.add(this.velocity.multiply(deltaTime / 2000));
            }
            
            // Keep unit within world bounds
            this.position.x = MathUtils.clamp(this.position.x, this.radius, window.game.engine.worldWidth - this.radius);
            this.position.y = MathUtils.clamp(this.position.y, this.radius, window.game.engine.worldHeight - this.radius);
        } else {
            this.position = newPosition;
        }
        
        // Apply friction
        this.velocity = this.velocity.multiply(Math.pow(this.friction, deltaTime / 16));
    }
    
    updateMovement(deltaTime) {
        if (!this.destination) {
            this.state = 'idle';
            return;
        }
        
        // Check for enemies while moving (attack while moving feature)
        if (this.canAttack() && window.game && window.game.engine) {
            const isMyUnit = !window.game.isMultiplayer || this.team === window.game.playerTeam;
            
            if (isMyUnit) {
                const nearbyEnemies = window.game.engine.getEntitiesNear(this.position, this.attackRange)
                    .filter(entity => 
                        (entity instanceof Unit || entity instanceof Building) && 
                        entity.team !== this.team && 
                        !entity.isDead
                    );
                
                if (nearbyEnemies.length > 0) {
                    // Prioritize units over buildings
                    const enemyUnits = nearbyEnemies.filter(e => e instanceof Unit);
                    const target = enemyUnits.length > 0 ? enemyUnits[0] : nearbyEnemies[0];
                    
                    // Save current destination before attacking
                    this.savedDestination = this.destination;
                    
                    this.attackTarget = target;
                    this.state = 'attacking';
                    
                    // Send multiplayer action for attack while moving
                    if (window.game && window.game.isMultiplayer) {
                        window.game.sendMultiplayerAction('attack', {
                            attackerId: this.id,
                            targetId: target.id,
                            team: this.team
                        });
                    }
                    
                    console.log(`${this.constructor.name} attacking while moving: ${target.constructor.name}`);
                    return; // Switch to attack state
                }
            }
        }
        
        const distance = this.position.distance(this.destination);
        
        if (distance < 5) {
            this.destination = null;
            this.state = 'idle';
            this.velocity = new Vector2(0, 0);
            return;
        }
        
        // Move toward destination
        const direction = this.destination.subtract(this.position).normalize();
        const acceleration = direction.multiply(this.acceleration);
        
        this.velocity = this.velocity.add(acceleration.multiply(deltaTime / 1000));
        
        // Limit velocity
        if (this.velocity.length() > this.maxSpeed) {
            this.velocity = this.velocity.normalize().multiply(this.maxSpeed);
        }
        
        // Update rotation to face movement direction
        if (this.velocity.length() > 1) {
            this.rotation = Math.atan2(this.velocity.y, this.velocity.x);
        }
    }
    
    updateAttack(deltaTime) {
        if (!this.attackTarget || this.attackTarget.isDead) {
            this.attackTarget = null;
            
            // Resume previous movement if we had a saved destination
            if (this.savedDestination) {
                this.destination = this.savedDestination;
                this.savedDestination = null;
                this.state = 'moving';
                console.log(`${this.constructor.name} resuming movement to saved destination`);
            } else {
                this.state = 'idle';
            }
            return;
        }
        
        const distance = this.position.distance(this.attackTarget.position);
        
        if (distance > this.attackRange) {
            // Target moved out of range, resume original movement if we had one
            if (this.savedDestination) {
                this.destination = this.savedDestination;
                this.savedDestination = null;
                this.attackTarget = null;
                this.state = 'moving';
                console.log(`${this.constructor.name} target out of range, resuming movement`);
                return;
            } else {
                // No saved destination, chase the target
                this.moveTo(this.attackTarget.position);
                this.state = 'moving';
                return;
            }
        }
        
        // Face the target
        const direction = this.attackTarget.position.subtract(this.position).normalize();
        this.rotation = Math.atan2(direction.y, direction.x);
        
        // Attack if cooldown is ready
        const currentTime = Date.now();
        if (currentTime - this.lastAttackTime >= this.attackCooldown) {
            this.performAttack(this.attackTarget);
            this.lastAttackTime = currentTime;
        }
    }
    
    updateIdle(deltaTime) {
        // Only look for enemies to attack if this is our unit (to prevent duplicated auto-attacks in multiplayer)
        const isMyUnit = !window.game || !window.game.isMultiplayer || this.team === window.game.playerTeam;
        
        if (isMyUnit && this.canAttack() && window.game && window.game.engine) {
            const nearbyEnemies = window.game.engine.getEntitiesNear(this.position, this.attackRange)
                .filter(entity => 
                    (entity instanceof Unit || entity instanceof Building) && 
                    entity.team !== this.team && 
                    !entity.isDead
                );
            
            if (nearbyEnemies.length > 0) {
                // Prioritize units over buildings
                const enemyUnits = nearbyEnemies.filter(e => e instanceof Unit);
                const target = enemyUnits.length > 0 ? enemyUnits[0] : nearbyEnemies[0];
                this.attackTarget = target;
                this.state = 'attacking';
                
                // Send multiplayer action for auto-attack
                if (window.game && window.game.isMultiplayer) {
                    window.game.sendMultiplayerAction('attack', {
                        attackerId: this.id,
                        targetId: target.id,
                        team: this.team
                    });
                }
                
                console.log(`${this.constructor.name} auto-attacking ${target.constructor.name}`);
            }
        }
    }
    
    render(ctx, camera) {
        if (this.isDead) return;
        
        ctx.save();
        
        // Draw unit body
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.rotation);
        
        // Unit body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Unit direction indicator
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.radius * 0.6, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Team indicator
        ctx.strokeStyle = this.team === 'player' ? '#00ff00' : '#ff0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
        
        // Draw attack range when selected
        if (this.selected && this.canAttack()) {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, this.attackRange, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        // Draw attack indicator when attacking
        if (this.state === 'attacking' && this.attackTarget && !this.attackTarget.isDead) {
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(this.position.x, this.position.y);
            ctx.lineTo(this.attackTarget.position.x, this.attackTarget.position.y);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Draw target indicator
            ctx.strokeStyle = '#ff4444';
            ctx.lineWidth = 3;
            const time = Date.now() / 500;
            const pulseRadius = 20 + Math.sin(time) * 5;
            ctx.beginPath();
            ctx.arc(this.attackTarget.position.x, this.attackTarget.position.y, pulseRadius, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    
    moveTo(destination) {
        // Clamp destination to world bounds
        const clampedDestination = new Vector2(
            MathUtils.clamp(destination.x, this.radius, window.game.engine.worldWidth - this.radius),
            MathUtils.clamp(destination.y, this.radius, window.game.engine.worldHeight - this.radius)
        );
        
        this.destination = clampedDestination;
        this.state = 'moving';
        this.attackTarget = null;
    }
    
    attackUnit(target) {
        if (!this.canAttack() || target.team === this.team || target.isDead) return;
        
        this.attackTarget = target;
        this.state = 'attacking';
        this.destination = null;
    }
    
    performAttack(target) {
        if (!target || target.isDead) return;
        
        // In multiplayer, only the owner of this unit should calculate damage
        const isMyUnit = !window.game || !window.game.isMultiplayer || this.team === window.game.playerTeam;
        
        // Create visual effects
        this.createAttackEffects(target);
        
        // Only apply damage if this is our unit (authoritative)
        if (isMyUnit) {
            target.takeDamage(this.damage);
            console.log(`${this.constructor.name} attacked ${target.constructor.name} for ${this.damage} damage`);
            
            // Send attack performed event to other players
            if (window.game && window.game.isMultiplayer) {
                window.game.sendMultiplayerAction('attackPerformed', {
                    attackerId: this.id,
                    targetId: target.id,
                    team: this.team,
                    timestamp: Date.now()
                });
            }
        } else {
            console.log(`${this.constructor.name} performed visual attack only (not authoritative)`);
        }
    }
    
    performVisualAttack(target) {
        if (!target || target.isDead) return;
        
        // Only create visual effects, no damage
        this.createAttackEffects(target);
        console.log(`${this.constructor.name} performed synchronized visual attack on ${target.constructor.name}`);
    }
    
    createAttackEffects(target) {
        // Create bullet effect
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
    
    takeDamage(amount, fromMultiplayer = false) {
        this.health = Math.max(0, this.health - amount);
        console.log(`${this.constructor.name} took ${amount} damage, health: ${this.health}/${this.maxHealth}`);
        
        // Send damage event to other players (only if not already from multiplayer)
        if (!fromMultiplayer && window.game && window.game.isMultiplayer) {
            window.game.sendMultiplayerAction('unitDamage', {
                targetId: this.id,
                damage: amount,
                newHealth: this.health,
                team: this.team
            });
        }
    }
    
    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }
    
    die() {
        this.isDead = true;
        this.state = 'dead';
        
        console.log(`${this.constructor.name} has died`);
        
        // Update population count when unit dies
        if (window.game && window.game.resourceManager) {
            window.game.resourceManager.updatePopulation();
        }
        
        // Remove from selection if selected
        if (window.game && window.game.engine) {
            window.game.engine.deselectEntity(this);
        }
    }
    
    canAttack() {
        return this.damage > 0 && this.attackRange > 0;
    }
    
    getInfo() {
        return {
            type: this.constructor.name,
            team: this.team,
            health: this.health,
            maxHealth: this.maxHealth,
            damage: this.damage,
            attackRange: this.attackRange,
            state: this.state
        };
    }
}

// Specific Unit Types
class Marine extends Unit {
    constructor(x, y, team = 'player') {
        super(x, y, team);
        
        this.maxHealth = 80;
        this.health = this.maxHealth;
        this.damage = 25;
        this.attackRange = 100;
        this.maxSpeed = 80; // Medium speed - between Warthog and Scorpion
        this.attackCooldown = 800;
        this.radius = 12;
        this.size = 18;
        
        this.supplyCost = 50; // Marines cost 50 supplies
        this.powerCost = 0; // Marines require 0 power
        this.populationCost = 1; // Marines take 1 population space
        this.buildTime = 2000;
        
        this.color = team === 'player' ? '#006600' : '#660000';
    }
}

class Warthog extends Unit {
    constructor(x, y, team = 'player') {
        super(x, y, team);
        
        this.maxHealth = 150;
        this.health = this.maxHealth;
        this.damage = 15;
        this.attackRange = 120;
        this.maxSpeed = 120; // Fastest unit
        this.attackCooldown = 600;
        this.radius = 20;
        this.size = 35;
        
        this.supplyCost = 100; // Warthogs cost 100 supplies
        this.powerCost = 1; // Warthogs require 1 power
        this.populationCost = 3; // Warthogs take 3 population space
        this.buildTime = 4000;
        
        this.color = team === 'player' ? '#664400' : '#442200';
    }
    
    render(ctx, camera) {
        if (this.isDead) return;
        
        ctx.save();
        
        // Draw vehicle body
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.rotation);
        
        // Vehicle body (rectangle)
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size/2, -this.size/3, this.size, this.size/1.5);
        
        // Wheels
        ctx.fillStyle = '#333';
        ctx.fillRect(-this.size/2 + 5, -this.size/3 - 3, 6, 6);
        ctx.fillRect(-this.size/2 + 5, this.size/3 - 3, 6, 6);
        ctx.fillRect(this.size/2 - 11, -this.size/3 - 3, 6, 6);
        ctx.fillRect(this.size/2 - 11, this.size/3 - 3, 6, 6);
        
        // Gun turret
        ctx.fillStyle = '#555';
        ctx.fillRect(0, -3, this.size/2, 6);
        
        // Team indicator
        ctx.strokeStyle = this.team === 'player' ? '#00ff00' : '#ff0000';
        ctx.lineWidth = 2;
        ctx.strokeRect(-this.size/2, -this.size/3, this.size, this.size/1.5);
        
        ctx.restore();
        
        // Draw attack range when selected
        if (this.selected && this.canAttack()) {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, this.attackRange, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
}

class Scorpion extends Unit {
    constructor(x, y, team = 'player') {
        super(x, y, team);
        
        this.maxHealth = 300;
        this.health = this.maxHealth;
        this.damage = 60;
        this.attackRange = 150;
        this.maxSpeed = 40; // Slowest unit
        this.attackCooldown = 2000;
        this.radius = 25;
        this.size = 45;
        
        this.supplyCost = 150; // Scorpions cost 150 supplies
        this.powerCost = 2; // Scorpions require 2 power
        this.populationCost = 5; // Scorpions take 5 population space
        this.buildTime = 8000;
        
        this.color = team === 'player' ? '#004400' : '#440000';
    }
    
    render(ctx, camera) {
        if (this.isDead) return;
        
        ctx.save();
        
        // Draw tank body
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.rotation);
        
        // Tank body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size/2, this.size/3, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Tank turret
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.size/3, 0, Math.PI * 2);
        ctx.fill();
        
        // Tank cannon
        ctx.fillStyle = '#666';
        ctx.fillRect(0, -4, this.size/1.5, 8);
        
        // Treads
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 4;
        ctx.strokeRect(-this.size/2, -this.size/3, this.size, this.size/1.5);
        
        // Team indicator
        ctx.strokeStyle = this.team === 'player' ? '#00ff00' : '#ff0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size/2, this.size/3, 0, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
        
        // Draw attack range when selected
        if (this.selected && this.canAttack()) {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, this.attackRange, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
}

// Unit factory
const UnitFactory = {
    create: (type, x, y, team = 'player') => {
        switch (type.toLowerCase()) {
            case 'marine':
                return new Marine(x, y, team);
            case 'warthog':
                return new Warthog(x, y, team);
            case 'scorpion':
                return new Scorpion(x, y, team);
            default:
                return new Unit(x, y, team);
        }
    },
    
    getUnitCost: (type) => {
        const tempUnit = UnitFactory.create(type, 0, 0);
        return {
            supplies: tempUnit.supplyCost,
            power: tempUnit.powerCost,
            population: tempUnit.populationCost,
            buildTime: tempUnit.buildTime
        };
    }
};