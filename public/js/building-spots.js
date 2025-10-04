// Building Spot System
console.log('Loading building spots system...');

class BuildingSpot {
    constructor(x, y, type = 'building', spotId) {
        this.position = new Vector2(x, y);
        this.type = type; // 'building' or 'turret'
        this.spotId = spotId;
        this.isOccupied = false;
        this.occupiedBy = null; // Reference to the building in this spot
        this.isUnlocked = false;
        this.team = null; // Which team owns this base
        this.radius = type === 'turret' ? 20 : 40; // Turrets: 20px radius, Buildings: 40px radius
    }

    canBuild(team, buildingType) {
        if (!this.isUnlocked) return false;
        if (this.isOccupied) return false;
        if (this.type === 'turret' && buildingType !== 'turret') return false;
        if (this.type === 'building' && buildingType === 'turret') return false;
        return true;
    }

    occupy(building) {
        this.isOccupied = true;
        this.occupiedBy = building;
        
        // If building is null, log a warning and don't actually occupy
        if (building === null) {
            console.warn(`WARNING: Attempting to occupy spot ${this.spotId} with null building - this should not happen`);
            this.isOccupied = false;
            this.occupiedBy = null;
        }
    }

    vacate() {
        this.isOccupied = false;
        this.occupiedBy = null;
    }
    
    // Clean up spots that are occupied but have no valid building
    cleanupInvalidOccupation() {
        if (this.isOccupied && (this.occupiedBy === null || this.occupiedBy === undefined)) {
            console.log(`Cleaning up invalid occupation for spot ${this.spotId}`);
            this.vacate();
            return true;
        }
        return false;
    }

    containsPoint(x, y) {
        const distance = Math.sqrt((x - this.position.x) ** 2 + (y - this.position.y) ** 2);
        return distance <= this.radius;
    }

    render(ctx, camera) {
        // Don't render if not unlocked
        if (!this.isUnlocked) return;
        
        ctx.save();
        
        if (this.isOccupied) {
            // Occupied spot - subtle indicator
            ctx.strokeStyle = this.type === 'turret' ? 'rgba(255, 100, 100, 0.3)' : 'rgba(100, 255, 100, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([]);
        } else {
            // Available spot - more visible
            ctx.strokeStyle = this.type === 'turret' ? 'rgba(255, 100, 100, 0.8)' : 'rgba(100, 255, 100, 0.8)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
        }
        
        // Draw circle for the spot (using world coordinates)
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw icon in center
        if (!this.isOccupied) {
            ctx.fillStyle = this.type === 'turret' ? 'rgba(255, 100, 100, 0.8)' : 'rgba(100, 255, 100, 0.8)';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.type === 'turret' ? '🎯' : '🏗️', this.position.x, this.position.y);
        }
        
        ctx.restore();
    }
}

class BaseLayout {
    constructor(baseX, baseY, team) {
        this.basePosition = new Vector2(baseX, baseY);
        this.team = team;
        this.buildingSpots = [];
        this.turretSpots = [];
        this.upgradeLevel = 0; // 0 = initial, 1 = first upgrade, 2 = max upgrade
        
        this.initializeSpots();
        this.unlockInitialSpots();
    }

    initializeSpots() {
        const baseX = this.basePosition.x;
        const baseY = this.basePosition.y;
        
        // Layout design around a 4x4 base (160x160 pixels):
        // X    X
        //  TTT     (T = building spots, B = 4x4 base, X = corner turrets)
        //  TBT
        //  TBT
        // X     X
        
        // Base takes up 4x4 grid units (160x160 pixels at 40px per unit)
        // Buildings take up 2x2 grid units (80x80 pixels)
        // Turrets take up 1x1 grid units (40x40 pixels)
        
        const gridSize = 40; // Base grid unit
        
        // Building spots (2x2 each) - arranged around the base in T pattern
        // Top row of building spots (above base)
        this.buildingSpots.push(new BuildingSpot(baseX - 80, baseY - 120, 'building', 'build_1')); // Top left
        this.buildingSpots.push(new BuildingSpot(baseX, baseY - 120, 'building', 'build_2'));      // Top center
        this.buildingSpots.push(new BuildingSpot(baseX + 80, baseY - 120, 'building', 'build_3')); // Top right
        
        // Side building spots (flanking the base)
        this.buildingSpots.push(new BuildingSpot(baseX - 120, baseY, 'building', 'build_4'));      // Left of base
        this.buildingSpots.push(new BuildingSpot(baseX + 120, baseY, 'building', 'build_5'));     // Right of base
        
        // Bottom building spots (below base) 
        this.buildingSpots.push(new BuildingSpot(baseX - 120, baseY + 80, 'building', 'build_6')); // Bottom left
        this.buildingSpots.push(new BuildingSpot(baseX + 120, baseY + 80, 'building', 'build_7')); // Bottom right
        
        // Corner turret spots (1x1 each) - defensive perimeter
        this.turretSpots.push(new BuildingSpot(baseX - 180, baseY - 180, 'turret', 'turret_1')); // Far top left corner
        this.turretSpots.push(new BuildingSpot(baseX + 180, baseY - 180, 'turret', 'turret_2')); // Far top right corner
        this.turretSpots.push(new BuildingSpot(baseX - 180, baseY + 180, 'turret', 'turret_3')); // Far bottom left corner
        this.turretSpots.push(new BuildingSpot(baseX + 180, baseY + 180, 'turret', 'turret_4')); // Far bottom right corner
        
        // Set team for all spots
        [...this.buildingSpots, ...this.turretSpots].forEach(spot => {
            spot.team = this.team;
        });
    }

    unlockInitialSpots() {
        // Unlock initial 3 building spots and all 4 turret spots
        for (let i = 0; i < 3; i++) {
            this.buildingSpots[i].isUnlocked = true;
        }
        this.turretSpots.forEach(spot => spot.isUnlocked = true);
    }

    upgradeBaseLayout() {
        this.upgradeLevel++;
        
        if (this.upgradeLevel === 1) {
            // First upgrade: unlock 2 more building spots (total 5)
            this.buildingSpots[3].isUnlocked = true;
            this.buildingSpots[4].isUnlocked = true;
            console.log(`🔓 ${this.team} base upgraded to level 1: 5 building spots available`);
            return { slotsUnlocked: 2, totalSlots: 5 };
        } else if (this.upgradeLevel === 2) {
            // Second upgrade: unlock final 2 building spots (total 7)
            this.buildingSpots[5].isUnlocked = true;
            this.buildingSpots[6].isUnlocked = true;
            console.log(`🔓 ${this.team} base upgraded to level 2: 7 building spots available`);
            return { slotsUnlocked: 2, totalSlots: 7 };
        }
        
        return { slotsUnlocked: 0, totalSlots: this.getAvailableBuildingSlots() };
    }

    getAvailableBuildingSlots() {
        return this.buildingSpots.filter(spot => spot.isUnlocked).length;
    }

    getAvailableTurretSlots() {
        return this.turretSpots.filter(spot => spot.isUnlocked).length;
    }
    
    // Debug method to inspect building spots
    inspectBuildingSpots() {
        console.log('=== BUILDING SPOTS INSPECTION ===');
        console.log(`Base Position: (${this.basePosition.x}, ${this.basePosition.y})`);
        console.log(`Upgrade Level: ${this.upgradeLevel}`);
        
        console.log('\nBuilding Spots:');
        this.buildingSpots.forEach((spot, i) => {
            const status = spot.isOccupied ? `OCCUPIED by ${spot.occupiedBy?.constructor.name || 'unknown'}` : 'AVAILABLE';
            const locked = spot.isUnlocked ? '' : ' (LOCKED)';
            console.log(`  ${spot.spotId}: ${status}${locked} at (${spot.position.x}, ${spot.position.y})`);
        });
        
        console.log('\nTurret Spots:');
        this.turretSpots.forEach((spot, i) => {
            const status = spot.isOccupied ? `OCCUPIED by ${spot.occupiedBy?.constructor.name || 'unknown'}` : 'AVAILABLE';
            const locked = spot.isUnlocked ? '' : ' (LOCKED)';
            console.log(`  ${spot.spotId}: ${status}${locked} at (${spot.position.x}, ${spot.position.y})`);
        });
        
        const availableBuilding = this.buildingSpots.filter(spot => spot.isUnlocked && !spot.isOccupied).length;
        const availableTurret = this.turretSpots.filter(spot => spot.isUnlocked && !spot.isOccupied).length;
        
        console.log(`\nSummary: ${availableBuilding} building spots available, ${availableTurret} turret spots available`);
        console.log('=== END INSPECTION ===');
    }

    findNearestBuildingSpot(x, y, buildingType) {
        const spots = buildingType === 'turret' ? this.turretSpots : this.buildingSpots;
        const availableSpots = spots.filter(spot => spot.canBuild(this.team, buildingType));
        
        if (availableSpots.length === 0) return null;
        
        // Find closest available spot
        let nearest = availableSpots[0];
        let nearestDistance = new Vector2(x, y).distance(nearest.position);
        
        for (let i = 1; i < availableSpots.length; i++) {
            const distance = new Vector2(x, y).distance(availableSpots[i].position);
            if (distance < nearestDistance) {
                nearest = availableSpots[i];
                nearestDistance = distance;
            }
        }
        
        return nearest;
    }

    render(ctx, camera) {
        // Render all unlocked spots
        [...this.buildingSpots, ...this.turretSpots].forEach(spot => {
            spot.render(ctx, camera);
        });
    }
}

// Global base layout manager
class BaseLayoutManager {
    constructor() {
        this.baseLayouts = new Map(); // team -> BaseLayout
    }

    createBaseLayout(baseX, baseY, team) {
        const layout = new BaseLayout(baseX, baseY, team);
        this.baseLayouts.set(team, layout);
        return layout;
    }

    getBaseLayout(team) {
        return this.baseLayouts.get(team);
    }

    findBuildingSpot(team, x, y, buildingType) {
        const layout = this.baseLayouts.get(team);
        if (!layout) return null;
        return layout.findNearestBuildingSpot(x, y, buildingType);
    }

    upgradeBase(team) {
        const layout = this.baseLayouts.get(team);
        if (!layout) return null;
        return layout.upgradeBaseLayout();
    }

    render(ctx, camera) {
        this.baseLayouts.forEach(layout => {
            layout.render(ctx, camera);
        });
    }

    findClickedBuildingSpot(team, x, y) {
        const layout = this.baseLayouts.get(team);
        if (!layout) return null;
        
        // Check all spots (buildings and turrets)
        const allSpots = [...layout.buildingSpots, ...layout.turretSpots];
        
        for (let spot of allSpots) {
            if (spot.isUnlocked && !spot.isOccupied && spot.containsPoint(x, y)) {
                return spot;
            }
        }
        
        return null;
    }
}

// Create global instance
window.baseLayoutManager = new BaseLayoutManager();

// Global debug function for console access
window.debugBuildingSpots = function() {
    if (window.baseLayoutManager) {
        const layout = window.baseLayoutManager.getBaseLayout('player');
        if (layout) {
            layout.inspectBuildingSpots();
        } else {
            console.log('No player base layout found');
        }
    } else {
        console.log('Base layout manager not found');
    }
};

console.log('Building spots system loaded successfully. Use debugBuildingSpots() in console to inspect.');