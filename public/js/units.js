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
        this.maxSpeed = 5.625; // 25% increase from 4.5 (4.5 * 1.25)
        this.acceleration = 25; // Increased base acceleration
        this.friction = 0.85; // Higher friction to slow down faster
        this.rotationSpeed = 3;
        this.rotation = 0;
        
        // Combat properties
        this.damage = 20;
        this.attackRange = 240; // Increased from 80 to 240 (3x range)
        this.attackCooldown = 1000; // milliseconds
        this.lastAttackTime = 0;
        this.attackTarget = null;
        
        // Attack-move properties
        this.isAttackMoving = false;
        this.attackMoveDestination = null;
        this.engagementRange = 240; // Range to detect enemies during attack-move
        
        // Death animation properties
        this.deathAnimationTime = 1000; // 1 second death animation
        this.deathStartTime = 0;
        this.deathRotationSpeed = 0;
        
        // Visual properties
        this.color = team === 'player' ? '#0066cc' : '#cc3333';
        this.size = 20;
        
        // State
        this.state = 'idle'; // idle, moving, attacking, attack-moving, dead, dying
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
            case 'attack-moving':
                this.updateAttackMove(deltaTime);
                break;
            case 'dying':
                this.updateDeathAnimation(deltaTime);
                break;
            case 'idle':
                this.updateIdle(deltaTime);
                break;
        }
        
        // Only check attack target validity if we actually have one
        if (this.attackTarget) {
            // Check if target is still valid
            if (this.attackTarget.isDead) {
                this.attackTarget = null;
                
                // Resume saved destination (could be movement or attack-move)
                if (this.savedDestination) {
                    if (this.isAttackMoving) {
                        // Resume attack-move
                        this.attackMoveDestination = this.savedDestination;
                        this.savedDestination = null;
                        this.state = 'attack-moving';
                        console.log(`${this.constructor.name} resuming attack-move to saved destination`);
                    } else {
                        // Resume normal movement
                        this.destination = this.savedDestination;
                        this.savedDestination = null;
                        this.state = 'moving';
                        console.log(`${this.constructor.name} resuming movement to saved destination`);
                    }
                } else {
                    this.state = 'idle';
                }
            }
        }
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
        
        // Limit velocity to max speed FIRST
        if (this.velocity.length() > this.maxSpeed) {
            this.velocity = this.velocity.normalize().multiply(this.maxSpeed);
        }
        
        // Apply light friction to prevent sliding (but only when not actively accelerating toward destination)
        const distanceToDestination = this.position.distance(this.destination);
        if (distanceToDestination < 20) {
            // Apply more friction when close to destination to help stop
            this.velocity = this.velocity.multiply(0.8);
        } else {
            // Apply minimal friction during normal movement
            this.velocity = this.velocity.multiply(0.98);
        }
        
        // Update rotation to face movement direction
        if (this.velocity.length() > 0.1) {
            this.rotation = Math.atan2(this.velocity.y, this.velocity.x);
        }
        
        // Actually update the position based on velocity
        const newPosition = this.position.add(this.velocity.multiply(deltaTime / 1000));
        
        // Improved collision detection and avoidance
        const nearbyBuildings = window.game.engine.getEntitiesNear(newPosition, this.radius + 35)
            .filter(entity => entity instanceof Building && entity !== this);
        
        let finalPosition = newPosition;
        
        // If collision detected, try to find a path around the building
        if (nearbyBuildings.length > 0) {
            const building = nearbyBuildings[0];
            const toBuildingVector = building.position.subtract(this.position);
            const distance = toBuildingVector.length();
            
            // If too close to building, push away from it instead of orbiting
            const buildingRadius = Math.max(building.width, building.height) / 2; // Use building dimensions
            const collisionBuffer = 25; // Larger buffer to match visual boundaries
            if (distance < this.radius + buildingRadius + collisionBuffer) {
                // FIXED: Push directly away from building instead of perpendicular movement
                // This prevents the spinning/orbiting behavior
                const pushAwayForce = toBuildingVector.normalize().multiply(-this.maxSpeed * 0.8);
                
                // Move away from the building
                const avoidancePosition = this.position.add(pushAwayForce.multiply(deltaTime / 1000));
                finalPosition = avoidancePosition;
                
                // Reduce velocity when avoiding obstacles
                this.velocity = this.velocity.multiply(0.5);
                
                // If unit is stuck against building and has a destination, try to clear the destination
                // and let the player re-order the unit
                if (distance < this.radius + buildingRadius + 10) {
                    this.destination = null;
                    this.state = 'idle';
                }
            } else {
                finalPosition = newPosition;
            }
        }
        
        // Clamp position to world bounds
        this.position = new Vector2(
            MathUtils.clamp(finalPosition.x, this.radius, window.game.engine.worldWidth - this.radius),
            MathUtils.clamp(finalPosition.y, this.radius, window.game.engine.worldHeight - this.radius)
        );
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
    
    updateAttackMove(deltaTime) {
        // Check for enemies within engagement range
        if (this.canAttack() && window.game && window.game.engine) {
            const nearbyEnemies = window.game.engine.getEntitiesNear(this.position, this.engagementRange)
                .filter(entity => 
                    (entity instanceof Unit || entity instanceof Building) && 
                    entity.team !== this.team && 
                    !entity.isDead
                );
            
            if (nearbyEnemies.length > 0) {
                // Prioritize closest enemy
                const closestEnemy = nearbyEnemies.reduce((closest, enemy) => {
                    const distToEnemy = this.position.distance(enemy.position);
                    const distToClosest = this.position.distance(closest.position);
                    return distToEnemy < distToClosest ? enemy : closest;
                });
                
                // Save current destination and switch to attack
                this.savedDestination = this.attackMoveDestination;
                this.attackTarget = closestEnemy;
                this.state = 'attacking';
                
                // Send multiplayer action
                if (window.game && window.game.isMultiplayer) {
                    window.game.sendMultiplayerAction('attack', {
                        attackerId: this.id,
                        targetId: closestEnemy.id,
                        team: this.team
                    });
                }
                
                return;
            }
        }
        
        // Continue moving toward destination if no enemies found
        if (this.attackMoveDestination) {
            const distance = this.position.distance(this.attackMoveDestination);
            
            if (distance < 5) {
                this.attackMoveDestination = null;
                this.isAttackMoving = false;
                this.state = 'idle';
                this.velocity = new Vector2(0, 0);
                return;
            }
            
            // Move toward destination
            const direction = this.attackMoveDestination.subtract(this.position).normalize();
            const acceleration = direction.multiply(this.acceleration);
            
            this.velocity = this.velocity.add(acceleration.multiply(deltaTime / 1000));
            
            // Limit speed
            if (this.velocity.length() > this.maxSpeed) {
                this.velocity = this.velocity.normalize().multiply(this.maxSpeed);
            }
            
            // Update rotation to face movement direction
            if (this.velocity.length() > 0.1) {
                this.rotation = Math.atan2(this.velocity.y, this.velocity.x);
            }
        }
    }
    
    updateDeathAnimation(deltaTime) {
        const currentTime = Date.now();
        const animationProgress = (currentTime - this.deathStartTime) / this.deathAnimationTime;
        
        if (animationProgress >= 1) {
            // Animation complete, mark as dead
            this.isDead = true;
            this.state = 'dead';
            return;
        }
        
        // Rotate the unit as it dies
        this.deathRotationSpeed += deltaTime * 0.01; // Gradually increase rotation speed
        this.rotation += this.deathRotationSpeed * deltaTime / 1000;
        
        // Scale down the unit
        this.size = this.size * (1 - animationProgress * 0.5); // Shrink to 50% size
    }
    
    render(ctx, camera) {
        if (this.isDead && this.state !== 'dying') return;
        
        ctx.save();
        
        // Apply death animation effects
        if (this.state === 'dying') {
            const currentTime = Date.now();
            const animationProgress = (currentTime - this.deathStartTime) / this.deathAnimationTime;
            
            // Fade out the unit
            ctx.globalAlpha = 1 - animationProgress;
            
            // Scale down the unit
            const scale = 1 - (animationProgress * 0.5);
            ctx.translate(this.position.x, this.position.y);
            ctx.scale(scale, scale);
        } else {
            ctx.translate(this.position.x, this.position.y);
        }
        
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
        
        // Interrupt any current action and start new movement
        this.destination = clampedDestination;
        this.state = 'moving';
        this.attackTarget = null;
        this.isAttackMoving = false;
        this.attackMoveDestination = null;
        this.savedDestination = null; // Clear any saved destination
        
        console.log(`${this.constructor.name} received new move command, interrupting current action`);
    }
    
    attackMoveTo(destination) {
        // Clamp destination to world bounds
        const clampedDestination = new Vector2(
            MathUtils.clamp(destination.x, this.radius, window.game.engine.worldWidth - this.radius),
            MathUtils.clamp(destination.y, this.radius, window.game.engine.worldHeight - this.radius)
        );
        
        // Interrupt any current action and start attack-move
        this.attackMoveDestination = clampedDestination;
        this.state = 'attack-moving';
        this.isAttackMoving = true;
        this.destination = null; // Clear regular movement destination
        this.attackTarget = null; // Clear current attack target
        this.savedDestination = null; // Clear any saved destination
        
        console.log(`${this.constructor.name} received new attack-move command, interrupting current action`);
    }
    
    attackUnit(target) {
        if (!this.canAttack() || target.team === this.team || target.isDead) return;
        
        this.attackTarget = target;
        this.state = 'attacking';
        this.destination = null;
    }
    
    performAttack(target) {
        if (!target || target.isDead) return;
        
        // In multiplayer, only the owner of the ATTACKER should calculate damage
        // This ensures each player has authority over their own units' attacks
        const isMultiplayer = window.game && window.game.isMultiplayer === true;
        const isMyUnit = !isMultiplayer || this.team === window.game.playerTeam;
        
        // Debug logging for authority check
        console.log(`AUTHORITY CHECK: Unit ${this.id} (team: ${this.team}) attacking ${target.id} (team: ${target.team})`);
        console.log(`  isMultiplayer: ${isMultiplayer}, playerTeam: ${window.game ? window.game.playerTeam : 'N/A'}`);
        console.log(`  this.team === playerTeam: ${this.team === (window.game ? window.game.playerTeam : 'N/A')}`);
        console.log(`  isMyUnit (has authority): ${isMyUnit}`);
        
        // Create visual effects
        this.createAttackEffects(target);
        
        // Only apply damage if this is our unit attacking (authoritative for our own units)
        if (isMyUnit) {
            let damageToApply = this.damage;
            
            // Calculate distance-based damage falloff
            const distance = this.position.distance(target.position);
            const optimalRange = this.attackRange * 0.3; // 30% of max range = full damage
            const falloffRange = this.attackRange - optimalRange; // Remaining 70% = falloff zone
            
            if (distance > optimalRange) {
                // Calculate falloff factor (1.0 at optimal range, 0.25 at max range)
                const falloffProgress = (distance - optimalRange) / falloffRange;
                const falloffFactor = Math.max(0.25, 1.0 - (falloffProgress * 0.75));
                damageToApply = Math.floor(damageToApply * falloffFactor);
            }
            
            // Reduce damage against buildings for balance
            if (target instanceof Building) {
                damageToApply = Math.floor(damageToApply * 0.75); // 25% damage reduction instead of 50%
            }
            
            target.takeDamage(damageToApply, false, this); // Pass the attacker for auto-defense
            console.log(`${this.constructor.name} attacked ${target.constructor.name} for ${damageToApply} damage (distance: ${distance.toFixed(1)})`);
            
            // Send damage event to other players
            if (isMultiplayer) {
                window.game.sendMultiplayerAction('unitDamage', {
                    attackerId: this.id,
                    targetId: target.id,
                    damage: damageToApply,
                    targetTeam: target.team,
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
    
    takeDamage(amount, fromMultiplayer = false, attacker = null) {
        this.health = Math.max(0, this.health - amount);
        console.log(`${this.constructor.name} took ${amount} damage, health: ${this.health}/${this.maxHealth}`);
        
        // Check if unit should die
        if (this.health <= 0 && !this.isDead && this.state !== 'dying') {
            this.die();
        }
        
        // Auto-defense: if we're idle and not dead, fight back!
        if (attacker && !this.isDead && this.state === 'idle' && this.canAttack()) {
            // Only auto-defend if the attacker is an enemy unit (not building)
            if (attacker instanceof Unit && attacker.team !== this.team) {
                console.log(`${this.constructor.name} auto-defending against ${attacker.constructor.name}!`);
                this.attackUnit(attacker);
            }
        }
        
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
        // Start death animation instead of immediately marking as dead
        if (this.state !== 'dying') {
            this.state = 'dying';
            this.deathStartTime = Date.now();
            this.deathRotationSpeed = Math.random() * 5 + 2; // Random rotation speed between 2-7
            
            console.log(`${this.constructor.name} is dying...`);
            
            // Update population count when unit starts dying
            if (window.game && window.game.resourceManager) {
                window.game.resourceManager.updatePopulation();
            }
            
            // Remove from selection if selected
            if (window.game && window.game.engine) {
                window.game.engine.deselectEntity(this);
            }
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
        this.maxSpeed = 10.9375; // 25% increase from 8.75 (8.75 * 1.25)
        this.acceleration = 52; // 75% increase from 30 for quicker response
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
        
        this.maxHealth = 300; // 2x defensive strength (was 150)
        this.health = this.maxHealth;
        this.damage = 45; // 3x attack damage (was 15)
        this.attackRange = 120;
        this.maxSpeed = 16.375; // 25% increase from 13.1 (13.1 * 1.25)
        this.acceleration = 70; // 75% increase from 40 for quick vehicle response
        this.attackCooldown = 600;
        this.radius = 20;
        this.size = 35;
        
        this.supplyCost = 150; // Changed from 100 to 150
        this.powerCost = 1; // Warthogs require 1 power
        this.populationCost = 3; // Warthogs take 3 population space
        this.buildTime = 8000; // 2x build time (was 4000)
        
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
        
        this.maxHealth = 1500; // 5x defensive strength (was 300)
        this.health = this.maxHealth;
        this.damage = 300; // 5x attack damage (was 60)
        this.attackRange = 150;
        this.maxSpeed = 11.875; // 25% increase from 9.5 (9.5 * 1.25)
        this.attackCooldown = 6000; // 1/3 attack speed - 3x slower (was 2000)
        this.radius = 25;
        this.size = 45;
        
        this.supplyCost = 500; // Changed from 150 to 500
        this.powerCost = 2; // Scorpions require 2 power
        this.populationCost = 5; // Scorpions take 5 population space
        this.buildTime = 24000; // 3x build time (was 8000)
        
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
        if (!type) return null;
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
        if (!type) return { supplies: 0, power: 0, population: 0, buildTime: 0 };
        const tempUnit = UnitFactory.create(type, 0, 0);
        if (!tempUnit) return { supplies: 0, power: 0, population: 0, buildTime: 0 };
        return {
            supplies: tempUnit.supplyCost,
            power: tempUnit.powerCost,
            population: tempUnit.populationCost,
            buildTime: tempUnit.buildTime
        };
    }
};