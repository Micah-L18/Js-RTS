// Resource Management System
console.log('Loading resource manager...');

class ResourceManager {
    constructor() {
        this.supplies = 1000;
        this.power = 0; // Power is now a count, not accumulated
        this.currentPopulation = 0;
        this.maxPopulation = 25; // Starting population cap is 25
        
        // Resource generation rates (per second)
        this.supplyRate = 0; // Base supply rate is 0, comes from buildings
        
        // Track reactor count for escalating costs
        this.reactorCount = 0;
        
        // UI elements
        this.suppliesElement = null;
        this.powerElement = null;
        this.currentPopElement = null;
        this.maxPopElement = null;
        
        this.lastUpdateTime = Date.now();
        
        // Find UI elements when DOM is ready
        this.findUIElements();
    }
    
    findUIElements() {
        // Try to find UI elements, but don't fail if they're not found
        try {
            this.suppliesElement = document.querySelector('#supplies');
            this.powerElement = document.querySelector('#power');
            this.currentPopElement = document.querySelector('.current-pop');
            this.maxPopElement = document.querySelector('.max-pop');
        } catch (error) {
            console.warn('Could not find some UI elements:', error);
        }
    }
    
    update(deltaTime) {
        const currentTime = Date.now();
        const timeDelta = (currentTime - this.lastUpdateTime) / 1000;
        
        // Generate only supplies (power is now a count from reactors)
        this.supplies += this.getSupplyRate() * timeDelta;
        
        // Update power count from reactors
        this.updatePowerCount();
        
        // Update population count and max population
        this.updatePopulation();
        this.updateMaxPopulation();
        
        // Update UI
        this.updateUI();
        this.lastUpdateTime = currentTime;
    }
    
    updatePowerCount() {
        if (!window.game || !window.game.engine) return;
        
        const playerTeam = window.game.playerTeam || 'player';
        const reactors = window.game.engine.entities.filter(entity => 
            entity instanceof Building && 
            entity.constructor.name === 'Reactor' && 
            entity.team === playerTeam && 
            !entity.isDead &&
            !entity.isUnderConstruction
        );
        
        this.power = reactors.length; // 1 power per reactor
        this.reactorCount = reactors.length;
    }
    
    updateMaxPopulation() {
        if (!window.game || !window.game.engine) return;
        
        const playerTeam = window.game.playerTeam || 'player';
        const barracks = window.game.engine.entities.filter(entity => 
            entity instanceof Building && 
            entity.constructor.name === 'Barracks' && 
            entity.team === playerTeam && 
            !entity.isDead &&
            !entity.isUnderConstruction
        );
        
        this.maxPopulation = Math.min(50, 25 + (barracks.length * 5)); // 25 + 5 per barracks, max 50
    }
    
    updatePopulation() {
        if (!window.game || !window.game.engine) return;
        
        const playerTeam = window.game.playerTeam || 'player';
        const units = window.game.engine.entities.filter(entity => 
            entity instanceof Unit && entity.team === playerTeam && !entity.isDead
        );
        
        this.currentPopulation = units.reduce((total, unit) => total + (unit.populationCost || 1), 0);
    }
    
    updateUI() {
        if (this.suppliesElement) {
            this.suppliesElement.textContent = Math.floor(this.supplies);
        }
        if (this.powerElement) {
            this.powerElement.textContent = this.power; // Show power count, not accumulated
        }
        if (this.currentPopElement) {
            this.currentPopElement.textContent = this.currentPopulation;
        }
        if (this.maxPopElement) {
            this.maxPopElement.textContent = this.maxPopulation;
        }
    }
    
    canAfford(supplyCost = 0, powerCost = 0, populationCost = 0) {
        return this.supplies >= supplyCost && 
               this.power >= powerCost && 
               (this.currentPopulation + populationCost) <= this.maxPopulation;
    }
    
    spendResources(supplyCost = 0, powerCost = 0) {
        this.supplies -= supplyCost;
        // Don't subtract power since it's a count from reactors, not spent
    }
    
    // Helper method to get reactor cost based on current count
    getReactorCost() {
        return 250 + (this.reactorCount * 250); // 250, 500, 750, etc.
    }
    
    // Helper method to get supply generation rate
    getSupplyRate() {
        if (!window.game || !window.game.engine) return 0;
        
        // Use the player's team from the game object instead of multiplayer manager
        const playerTeam = window.game.isMultiplayer ? window.game.playerTeam : 'player';
        
        const supplyDepots = window.game.engine.entities.filter(entity => 
            entity instanceof Building && 
            entity.constructor.name === 'SupplyDepot' && 
            entity.team === playerTeam && 
            !entity.isDead &&
            !entity.isUnderConstruction
        );
        
        return supplyDepots.length * 4; // 4 supplies per second per depot
    }
    
    addSupplies(amount) {
        this.supplies += amount;
    }
    
    addPower(amount) {
        this.power += amount;
    }
    
    increasePopulationCap(amount) {
        this.maxPopulation += amount;
    }
    
    getResourceRates() {
        // Calculate actual resource generation based on buildings
        if (!window.game || !window.game.engine) {
            return {
                supplies: this.supplyRate,
                power: this.powerRate
            };
        }
        
        const buildings = window.game.engine.entities.filter(entity => 
            entity instanceof Building && entity.team === 'player' && !entity.isDead
        );
        
        let totalSupplyRate = this.supplyRate;
        let totalPowerRate = this.powerRate;
        
        buildings.forEach(building => {
            if (building.isActive) {
                totalSupplyRate += building.supplyRate || 0;
                totalPowerRate += building.powerRate || 0;
            }
        });
        
        return {
            supplies: totalSupplyRate,
            power: totalPowerRate
        };
    }
}