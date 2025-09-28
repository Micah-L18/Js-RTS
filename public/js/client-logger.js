// Client-Side Logger - Captures browser events and sends to server
class ClientLogger {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.connected = false;
        this.logQueue = []; // Queue logs when disconnected
        
        this.initializeLogger();
    }
    
    generateSessionId() {
        return 'client_' + Date.now() + '_' + Math.random().toString(36).substring(2);
    }
    
    initializeLogger() {
        // Store original console methods
        this.originalConsole = {
            log: console.log.bind(console),
            error: console.error.bind(console),
            warn: console.warn.bind(console),
            info: console.info.bind(console)
        };
        
        // Override console methods to capture logs
        console.log = (...args) => {
            this.originalConsole.log(...args);
            this.captureLog('log', args);
        };
        
        console.error = (...args) => {
            this.originalConsole.error(...args);
            this.captureLog('error', args);
        };
        
        console.warn = (...args) => {
            this.originalConsole.warn(...args);
            this.captureLog('warn', args);
        };
        
        console.info = (...args) => {
            this.originalConsole.info(...args);
            this.captureLog('info', args);
        };
        
        // Capture unhandled errors
        window.addEventListener('error', (event) => {
            this.logError('javascript_error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error ? event.error.stack : null
            });
        });
        
        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.logError('unhandled_promise_rejection', {
                reason: event.reason,
                stack: event.reason ? event.reason.stack : null
            });
        });
        
        console.log('Client Logger initialized with session:', this.sessionId);
    }
    
    setSocket(socket) {
        this.socket = socket;
        this.connected = socket && socket.connected;
        
        if (socket) {
            socket.on('connect', () => {
                this.connected = true;
                this.flushLogQueue();
            });
            
            socket.on('disconnect', () => {
                this.connected = false;
            });
        }
    }
    
    captureLog(level, args) {
        const logData = {
            level,
            message: args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' '),
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            url: window.location.href,
            userAgent: navigator.userAgent
        };
        
        this.sendToServer('client_console', logData);
    }
    
    logEvent(category, action, description, data = null) {
        const logData = {
            category,
            action,
            description,
            data,
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            url: window.location.href
        };
        
        this.sendToServer('client_event', logData);
    }
    
    logGameAction(actionType, actionData) {
        const logData = {
            actionType,
            actionData,
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId
        };
        
        this.sendToServer('client_game_action', logData);
    }
    
    logError(errorType, errorData) {
        const logData = {
            errorType,
            errorData,
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            url: window.location.href
        };
        
        this.sendToServer('client_error', logData);
    }
    
    logPerformance(metric, value, context = {}) {
        const logData = {
            metric,
            value,
            context,
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId
        };
        
        this.sendToServer('client_performance', logData);
    }
    
    sendToServer(type, data) {
        const logEntry = {
            type,
            data,
            timestamp: new Date().toISOString()
        };
        
        if (this.connected && this.socket) {
            this.socket.emit('clientLog', logEntry);
        } else {
            // Queue logs when disconnected
            this.logQueue.push(logEntry);
            
            // Limit queue size to prevent memory issues
            if (this.logQueue.length > 1000) {
                this.logQueue.shift();
            }
        }
    }
    
    flushLogQueue() {
        if (this.logQueue.length > 0 && this.connected && this.socket) {
            console.log(`Flushing ${this.logQueue.length} queued log entries`);
            
            this.logQueue.forEach(entry => {
                this.socket.emit('clientLog', entry);
            });
            
            this.logQueue = [];
        }
    }
    
    // Get performance metrics
    getPerformanceMetrics() {
        if (window.performance) {
            const navigation = performance.getEntriesByType('navigation')[0];
            const metrics = {
                loadTime: navigation ? navigation.loadEventEnd - navigation.loadEventStart : null,
                domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart : null,
                memoryUsed: performance.memory ? performance.memory.usedJSHeapSize : null,
                memoryTotal: performance.memory ? performance.memory.totalJSHeapSize : null
            };
            
            this.logPerformance('page_metrics', metrics);
            return metrics;
        }
        return null;
    }
    
    // Clean shutdown
    shutdown() {
        console.log('Client Logger shutting down');
        
        // Restore original console methods
        console.log = this.originalConsole.log;
        console.error = this.originalConsole.error;
        console.warn = this.originalConsole.warn;
        console.info = this.originalConsole.info;
    }
}

// Create global client logger instance
window.clientLogger = new ClientLogger();

// Auto-track page load performance
window.addEventListener('load', () => {
    setTimeout(() => {
        window.clientLogger.getPerformanceMetrics();
    }, 1000);
});