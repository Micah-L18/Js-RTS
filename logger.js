// Game Logger - Captures all console logs and game events
const fs = require('fs');
const path = require('path');

class GameLogger {
    constructor() {
        this.logDir = path.join(__dirname, 'logs');
        this.currentLogFile = null;
        this.sessionId = this.generateSessionId();
        
        // Ensure logs directory exists
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir);
        }
        
        // Create new log file for this session
        this.createLogFile();
        
        // Override console methods to capture logs
        this.setupConsoleCapture();
        
        // Log session start
        this.logEvent('SYSTEM', 'LOGGER_INIT', 'Game logger initialized', {
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            logFile: this.currentLogFile
        });
    }
    
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    }
    
    createLogFile() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `game_log_${timestamp}.log`;
        this.currentLogFile = path.join(this.logDir, filename);
        
        // Write log file header
        const header = [
            '='.repeat(80),
            `HALO WARS JS RTS - GAME LOG`,
            `Session ID: ${this.sessionId}`,
            `Started: ${new Date().toISOString()}`,
            `Log File: ${filename}`,
            '='.repeat(80),
            ''
        ].join('\n');
        
        fs.writeFileSync(this.currentLogFile, header);
    }
    
    setupConsoleCapture() {
        // Store original console methods
        this.originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info
        };
        
        // Override console.log
        console.log = (...args) => {
            this.writeToLog('LOG', args);
            this.originalConsole.log.apply(console, args);
        };
        
        // Override console.error
        console.error = (...args) => {
            this.writeToLog('ERROR', args);
            this.originalConsole.error.apply(console, args);
        };
        
        // Override console.warn
        console.warn = (...args) => {
            this.writeToLog('WARN', args);
            this.originalConsole.warn.apply(console, args);
        };
        
        // Override console.info
        console.info = (...args) => {
            this.writeToLog('INFO', args);
            this.originalConsole.info.apply(console, args);
        };
    }
    
    writeToLog(level, args) {
        const timestamp = new Date().toISOString();
        const message = args.map(arg => {
            if (typeof arg === 'object') {
                return JSON.stringify(arg, null, 2);
            }
            return String(arg);
        }).join(' ');
        
        const logEntry = `[${timestamp}] [${level}] ${message}\n`;
        
        try {
            fs.appendFileSync(this.currentLogFile, logEntry);
        } catch (error) {
            this.originalConsole.error('Failed to write to log file:', error);
        }
    }
    
    logEvent(category, action, description, data = null) {
        const timestamp = new Date().toISOString();
        const eventData = {
            timestamp,
            category,
            action,
            description,
            sessionId: this.sessionId,
            data
        };
        
        const logEntry = `[${timestamp}] [EVENT] ${category}:${action} - ${description}`;
        const dataEntry = data ? `\n  Data: ${JSON.stringify(data, null, 2)}` : '';
        const fullEntry = logEntry + dataEntry + '\n';
        
        try {
            fs.appendFileSync(this.currentLogFile, fullEntry);
        } catch (error) {
            this.originalConsole.error('Failed to write event to log file:', error);
        }
    }
    
    logPlayerAction(playerId, action, details) {
        this.logEvent('PLAYER', action, `Player ${playerId} performed action`, {
            playerId,
            action,
            details
        });
    }
    
    logGameState(state, details) {
        this.logEvent('GAME', 'STATE_CHANGE', `Game state changed to ${state}`, {
            state,
            details
        });
    }
    
    logMultiplayer(action, roomCode, playerData) {
        this.logEvent('MULTIPLAYER', action, `Multiplayer action in room ${roomCode}`, {
            roomCode,
            playerData,
            timestamp: Date.now()
        });
    }
    
    logError(error, context) {
        this.logEvent('ERROR', 'EXCEPTION', `Error occurred: ${error.message}`, {
            error: error.stack,
            context
        });
    }
    
    // Get current log file path for client access
    getLogFile() {
        return this.currentLogFile;
    }
    
    // Get session info
    getSessionInfo() {
        return {
            sessionId: this.sessionId,
            logFile: this.currentLogFile,
            startTime: new Date().toISOString()
        };
    }
    
    // Clean up old log files (keep last 10)
    cleanupOldLogs() {
        try {
            const files = fs.readdirSync(this.logDir)
                .filter(file => file.startsWith('game_log_') && file.endsWith('.log'))
                .map(file => ({
                    name: file,
                    path: path.join(this.logDir, file),
                    time: fs.statSync(path.join(this.logDir, file)).mtime
                }))
                .sort((a, b) => b.time - a.time);
            
            if (files.length > 10) {
                const filesToDelete = files.slice(10);
                filesToDelete.forEach(file => {
                    fs.unlinkSync(file.path);
                    this.logEvent('SYSTEM', 'LOG_CLEANUP', `Deleted old log file: ${file.name}`);
                });
            }
        } catch (error) {
            this.originalConsole.error('Error cleaning up old logs:', error);
        }
    }
    
    // Get recent logs from current session
    getRecentLogs(maxLines = 100, filterType = null) {
        const logs = [];
        
        try {
            if (fs.existsSync(this.currentLogFile)) {
                const content = fs.readFileSync(this.currentLogFile, 'utf8');
                const lines = content.split('\n').filter(line => line.trim());
                
                let filteredLines = lines;
                if (filterType) {
                    filteredLines = lines.filter(line => 
                        line.includes(`[${filterType.toUpperCase()}]`)
                    );
                }
                
                // Return the last maxLines entries
                const recentLines = filteredLines.slice(-maxLines);
                
                return recentLines.map(line => ({
                    timestamp: this.extractTimestamp(line),
                    content: line,
                    type: this.extractLogType(line)
                }));
            }
        } catch (error) {
            this.originalConsole.error('Error reading recent logs:', error);
        }
        
        return logs;
    }
    
    // Get current log file path
    getCurrentLogFile() {
        return this.currentLogFile;
    }
    
    // Extract timestamp from log line
    extractTimestamp(logLine) {
        const timestampMatch = logLine.match(/\[([\d-T:.Z]+)\]/);
        return timestampMatch ? timestampMatch[1] : null;
    }
    
    // Extract log type from log line
    extractLogType(logLine) {
        const typeMatch = logLine.match(/\[([A-Z]+)\]/g);
        if (typeMatch && typeMatch.length > 1) {
            return typeMatch[1].replace(/[\[\]]/g, '').toLowerCase();
        }
        return 'unknown';
    }
    
    // Graceful shutdown
    shutdown() {
        this.logEvent('SYSTEM', 'LOGGER_SHUTDOWN', 'Game logger shutting down');
        
        // Restore original console methods
        console.log = this.originalConsole.log;
        console.error = this.originalConsole.error;
        console.warn = this.originalConsole.warn;
        console.info = this.originalConsole.info;
    }
}

module.exports = GameLogger;