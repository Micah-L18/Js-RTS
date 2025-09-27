// Math utility functions for the game
console.log('Loading math utils...');

// Vector2 class for 2D positions and calculations
class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    add(other) {
        return new Vector2(this.x + other.x, this.y + other.y);
    }

    subtract(other) {
        return new Vector2(this.x - other.x, this.y - other.y);
    }

    multiply(scalar) {
        return new Vector2(this.x * scalar, this.y * scalar);
    }

    distance(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    normalize() {
        const length = Math.sqrt(this.x * this.x + this.y * this.y);
        if (length === 0) return new Vector2(0, 0);
        return new Vector2(this.x / length, this.y / length);
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    dot(other) {
        return this.x * other.x + this.y * other.y;
    }

    clone() {
        return new Vector2(this.x, this.y);
    }
}

// Utility functions
const MathUtils = {
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    
    lerp: (a, b, t) => a + (b - a) * t,
    
    randomBetween: (min, max) => Math.random() * (max - min) + min,
    
    degreesToRadians: (degrees) => degrees * (Math.PI / 180),
    
    radiansToDegrees: (radians) => radians * (180 / Math.PI),
    
    pointInRect: (point, rect) => {
        return point.x >= rect.x && point.x <= rect.x + rect.width &&
               point.y >= rect.y && point.y <= rect.y + rect.height;
    },
    
    circleIntersection: (circle1, circle2) => {
        const distance = circle1.position.distance(circle2.position);
        return distance < (circle1.radius + circle2.radius);
    }
};