// Visual Effects and Renderer
console.log('Loading renderer...');

class Effect {
    constructor(position, duration = 1000) {
        this.position = position.clone();
        this.duration = duration;
        this.startTime = Date.now();
        this.isDead = false;
        this.alpha = 1;
    }
    
    update(deltaTime) {
        const elapsed = Date.now() - this.startTime;
        const progress = elapsed / this.duration;
        
        if (progress >= 1) {
            this.isDead = true;
            return;
        }
        
        this.alpha = 1 - progress;
        this.onUpdate(progress, deltaTime);
    }
    
    onUpdate(progress, deltaTime) {
        // Override in subclasses
    }
    
    render(ctx, camera) {
        if (this.isDead) return;
        
        ctx.save();
        ctx.globalAlpha = this.alpha;
        this.onRender(ctx, camera);
        ctx.restore();
    }
    
    onRender(ctx, camera) {
        // Override in subclasses
    }
}

class AttackEffect extends Effect {
    constructor(fromPos, toPos) {
        super(fromPos, 200);
        this.fromPos = fromPos.clone();
        this.toPos = toPos.clone();
        this.color = '#ffff00';
    }
    
    onRender(ctx, camera) {
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.fromPos.x, this.fromPos.y);
        ctx.lineTo(this.toPos.x, this.toPos.y);
        ctx.stroke();
    }
}

class DamageEffect extends Effect {
    constructor(position, damage) {
        super(position, 1000);
        this.damage = damage;
        this.velocity = new Vector2(
            MathUtils.randomBetween(-20, 20),
            MathUtils.randomBetween(-30, -10)
        );
        this.color = '#ff4444';
    }
    
    onUpdate(progress, deltaTime) {
        this.position = this.position.add(this.velocity.multiply(deltaTime / 1000));
        this.velocity.y += 50 * (deltaTime / 1000); // Gravity
    }
    
    onRender(ctx, camera) {
        ctx.fillStyle = this.color;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`-${this.damage}`, this.position.x, this.position.y);
    }
}

class DeathEffect extends Effect {
    constructor(position) {
        super(position, 500);
        this.particles = [];
        
        // Create explosion particles
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                position: position.clone(),
                velocity: new Vector2(
                    MathUtils.randomBetween(-100, 100),
                    MathUtils.randomBetween(-100, 100)
                ),
                size: MathUtils.randomBetween(2, 6),
                color: `hsl(${MathUtils.randomBetween(0, 60)}, 100%, 50%)`
            });
        }
    }
    
    onUpdate(progress, deltaTime) {
        this.particles.forEach(particle => {
            particle.position = particle.position.add(
                particle.velocity.multiply(deltaTime / 1000)
            );
            particle.velocity = particle.velocity.multiply(0.98); // Friction
        });
    }
    
    onRender(ctx, camera) {
        this.particles.forEach(particle => {
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(particle.position.x, particle.position.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}

class MuzzleFlashEffect extends Effect {
    constructor(position, direction) {
        super(position, 100);
        this.direction = direction.normalize();
        this.length = 20;
    }
    
    onRender(ctx, camera) {
        const endPos = this.position.add(this.direction.multiply(this.length));
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(this.position.x, this.position.y);
        ctx.lineTo(endPos.x, endPos.y);
        ctx.stroke();
        
        // Flash circle
        ctx.fillStyle = '#ffff88';
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, 8, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Bullet {
    constructor(fromPos, toPos, speed = 400) {
        this.position = fromPos.clone();
        this.target = toPos.clone();
        this.speed = speed;
        this.isDead = false;
        
        // Calculate direction and distance
        this.direction = this.target.subtract(this.position).normalize();
        this.totalDistance = this.position.distance(this.target);
        this.traveledDistance = 0;
    }
    
    update(deltaTime) {
        if (this.isDead) return;
        
        const moveDistance = this.speed * (deltaTime / 1000);
        this.traveledDistance += moveDistance;
        
        // Move bullet
        this.position = this.position.add(this.direction.multiply(moveDistance));
        
        // Check if bullet reached target
        if (this.traveledDistance >= this.totalDistance) {
            this.isDead = true;
        }
    }
    
    render(ctx, camera) {
        if (this.isDead) return;
        
        ctx.save();
        
        // Draw bullet trail
        const trailLength = 15;
        const trailStart = this.position.subtract(this.direction.multiply(trailLength));
        
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(trailStart.x, trailStart.y);
        ctx.lineTo(this.position.x, this.position.y);
        ctx.stroke();
        
        // Draw bullet
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}

// UI Renderer
class UIRenderer {
    constructor() {
        this.selectedUnit = null;
    }
    
    update() {
        // Update selected unit info
        if (!window.game || !window.game.engine) return;
        
        const selected = window.game.engine.selectedEntities;
        if (selected.length === 1) {
            this.selectedUnit = selected[0];
        } else {
            this.selectedUnit = null;
        }
        
        this.updateSelectionPanel();
        this.updateCommandButtons();
        this.updateSelectedUnitsDisplay();
    }
    
    updateSelectionPanel() {
        const selectionCard = document.getElementById('selectionCard');
        const unitNameElement = document.getElementById('unitName');
        const statsElement = document.getElementById('unitStats');
        const unitIcon = document.querySelector('.unit-icon');
        
        if (!selectionCard || !unitNameElement || !statsElement) return;
        
        if (this.selectedUnit) {
            const info = this.selectedUnit.getInfo();
            
            // Show selection card
            selectionCard.style.display = 'block';
            
            // Update unit name
            unitNameElement.textContent = info.type;
            
            // Update unit icon based on type
            if (unitIcon) {
                const iconMap = {
                    'Marine': '🪖',
                    'Warthog': '🚗',
                    'Scorpion': '🦂',
                    'Base': '🏢',
                    'SupplyDepot': '📦',
                    'Barracks': '🏭',
                    'Unit': '⚪',
                    'Building': '🏗️'
                };
                unitIcon.textContent = iconMap[info.type] || '⚪';
            }
            
            // Update stats
            let statsHTML = `
                <div><strong>Team:</strong> ${info.team}</div>
                <div><strong>Health:</strong> ${info.health}/${info.maxHealth}</div>
            `;
            
            if (this.selectedUnit instanceof Unit) {
                statsHTML += `
                    <div><strong>State:</strong> ${info.state}</div>
                    <div><strong>Damage:</strong> ${info.damage}</div>
                    <div><strong>Range:</strong> ${info.attackRange}</div>
                `;
            } else if (this.selectedUnit instanceof Building) {
                statsHTML += `
                    <div><strong>Active:</strong> ${info.isActive ? 'Yes' : 'No'}</div>
                `;
                
                if (info.isUnderConstruction) {
                    statsHTML += `
                        <div><strong>Construction:</strong> ${Math.round(info.constructionProgress * 100)}%</div>
                    `;
                }
                
                if (info.currentProduction) {
                    statsHTML += `
                        <div><strong>Producing:</strong> ${info.currentProduction}</div>
                    `;
                }
                
                if (info.productionQueue > 0) {
                    statsHTML += `
                        <div><strong>Queue:</strong> ${info.productionQueue} units</div>
                    `;
                }
            }
            
            statsElement.innerHTML = statsHTML;
        } else {
            // Hide selection card
            selectionCard.style.display = 'none';
        }
    }
    
    updateCommandButtons() {
        if (!window.game || !window.game.resources) return;
        
        // Update unit production buttons
        const unitButtons = document.querySelectorAll('.unit-btn');
        unitButtons.forEach(button => {
            const unitType = button.getAttribute('data-unit');
            const cost = UnitFactory.getUnitCost(unitType);
            
            const canAfford = window.game.resources.canAfford(cost.supplies, cost.power, cost.population);
            button.disabled = !canAfford;
            
            if (!canAfford) {
                button.style.opacity = '0.5';
                button.style.cursor = 'not-allowed';
            } else {
                button.style.opacity = '1';
                button.style.cursor = 'pointer';
            }
        });
        
        // Update building buttons  
        const buildingButtons = document.querySelectorAll('.building-btn');
        buildingButtons.forEach(button => {
            const buildingType = button.getAttribute('data-building');
            const cost = BuildingFactory.getBuildingCost(buildingType);
            
            // Update reactor cost display dynamically
            if (buildingType === 'reactor') {
                const costElement = button.querySelector('.btn-cost');
                if (costElement) {
                    costElement.textContent = `${cost.supplies}💰`;
                }
            }
            
            // Buildings don't consume population, only check supplies and power
            const canAfford = window.game.resources.supplies >= cost.supplies && 
                             window.game.resources.power >= cost.power;
            button.disabled = !canAfford;
            
            if (!canAfford) {
                button.style.opacity = '0.5';
                button.style.cursor = 'not-allowed';
            } else {
                button.style.opacity = '1';
                button.style.cursor = 'pointer';
            }
        });
    }

    updateSelectedUnitsDisplay() {
        const selectedUnitsDisplay = document.getElementById('selectedUnitsDisplay');
        if (!selectedUnitsDisplay) return;

        const selectedUnits = window.game.engine.selectedEntities.filter(entity => entity instanceof Unit);
        
        if (selectedUnits.length === 0) {
            selectedUnitsDisplay.style.display = 'none';
            return;
        }

        // Count units by type
        const unitCounts = {};
        selectedUnits.forEach(unit => {
            const unitType = unit.constructor.name;
            if (unitCounts[unitType]) {
                unitCounts[unitType].count++;
            } else {
                unitCounts[unitType] = {
                    count: 1,
                    icon: this.getUnitIcon(unitType),
                    name: unitType
                };
            }
        });

        // Build the display HTML
        let html = '';
        Object.values(unitCounts).forEach(unitType => {
            html += `
                <div class="selected-unit-item">
                    <div class="selected-unit-icon">${unitType.icon}</div>
                    <div class="selected-unit-count">${unitType.count}</div>
                    <div class="selected-unit-name">${unitType.name}</div>
                </div>
            `;
        });

        selectedUnitsDisplay.innerHTML = html;
        selectedUnitsDisplay.style.display = 'flex';
    }

    getUnitIcon(unitType) {
        const icons = {
            'Marine': '🪖',
            'Warthog': '🚗',
            'Scorpion': '🦂'
        };
        return icons[unitType] || '👤';
    }
}