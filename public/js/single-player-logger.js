// Single Player Logger for debugging building issues
console.log('Loading single-player logger...');

class SinglePlayerLogger {
    constructor() {
        this.logs = [];
        this.sessionId = `sp_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.startTime = Date.now();
        
        console.log(`Single Player Logger initialized: ${this.sessionId}`);
        this.log('SYSTEM', 'Single Player Logger initialized', { sessionId: this.sessionId });
    }
    
    log(category, message, data = {}) {
        const timestamp = new Date().toISOString();
        const relativeTime = Date.now() - this.startTime;
        
        const logEntry = {
            timestamp,
            relativeTime,
            category,
            message,
            data
        };
        
        this.logs.push(logEntry);
        
        // Also log to console with emoji for visibility
        const categoryEmojis = {
            'SYSTEM': '🔧',
            'BUILD_CREATE': '🏗️',
            'BUILD_DESTROY': '💥',
            'AI_ECONOMY': '🤖',
            'AI_BUILD': '🔨',
            'COLLISION': '⚠️',
            'BUILDING_COUNT': '📊'
        };
        
        const emoji = categoryEmojis[category] || '📝';
        console.log(`${emoji} [+${(relativeTime/1000).toFixed(1)}s] ${category}: ${message}`, data);
        
        // Save to file periodically (every 10 logs)
        if (this.logs.length % 10 === 0) {
            this.saveToFile();
        }
    }
    
    saveToFile() {
        const logContent = this.generateLogContent();
        
        // Create a blob and download link
        const blob = new Blob([logContent], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        
        // Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = `single_player_debug_${this.sessionId}.txt`;
        a.style.display = 'none';
        document.body.appendChild(a);
        
        // Trigger download (commented out to avoid spam, but can be enabled)
        // a.click();
        
        // Clean up
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        // Store in localStorage as backup
        try {
            localStorage.setItem(`sp_log_${this.sessionId}`, logContent);
        } catch (e) {
            console.warn('Could not save log to localStorage:', e);
        }
    }
    
    generateLogContent() {
        let content = '';
        content += '================================================================================\n';
        content += 'HALO WARS JS RTS - SINGLE PLAYER DEBUG LOG\n';
        content += `Session ID: ${this.sessionId}\n`;
        content += `Started: ${new Date(this.startTime).toISOString()}\n`;
        content += '================================================================================\n\n';
        
        this.logs.forEach(log => {
            content += `[${log.timestamp}] [+${(log.relativeTime/1000).toFixed(1)}s] [${log.category}] ${log.message}\n`;
            if (Object.keys(log.data).length > 0) {
                content += `  Data: ${JSON.stringify(log.data, null, 2)}\n`;
            }
            content += '\n';
        });
        
        return content;
    }
    
    // Manual save function that can be called from console
    saveNow() {
        const logContent = this.generateLogContent();
        const blob = new Blob([logContent], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `single_player_debug_${this.sessionId}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        console.log('📄 Single player log saved to downloads');
    }
    
    // Get logs from localStorage
    getStoredLogs() {
        const keys = Object.keys(localStorage).filter(key => key.startsWith('sp_log_'));
        return keys.map(key => {
            return {
                sessionId: key.replace('sp_log_', ''),
                content: localStorage.getItem(key)
            };
        });
    }
}

// Create global logger instance
window.spLogger = new SinglePlayerLogger();

// Add helper function to window for easy access
window.saveSPLog = () => window.spLogger.saveNow();

console.log('📄 Single Player Logger ready! Use window.saveSPLog() to download current log');