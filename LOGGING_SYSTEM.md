# Game Logging System Documentation

## Overview
A comprehensive logging system has been implemented to capture all console output, game events, and multiplayer actions for debugging and testing purposes. The system works on both server and client sides to provide complete visibility into game operations.

## Features

### 🔧 Server-Side Logging (`logger.js`)
- **Console Capture**: Automatically captures all console.log, console.error, console.warn, and console.info output
- **Event Logging**: Structured logging for game events with categories and metadata
- **Multiplayer Action Logging**: Detailed tracking of all multiplayer interactions
- **Game State Logging**: Comprehensive game state changes and transitions
- **Error Logging**: Centralized error tracking with context
- **Automatic File Rotation**: Creates timestamped log files to prevent bloat
- **Session Tracking**: Each server session gets a unique identifier

### 🌐 Client-Side Logging (`client-logger.js`)
- **Console Override**: Captures all browser console output and sends to server
- **Error Handling**: Automatic capture of JavaScript errors and unhandled promise rejections
- **Performance Monitoring**: Tracks page load times, memory usage, and performance metrics
- **Game Action Tracking**: Logs all game actions with context
- **Offline Queue**: Queues logs when disconnected and flushes when reconnected
- **Session Management**: Client-side session tracking integrated with server logs

### 📊 Log Viewer Interface (`/log-viewer.html`)
- **Real-time Log Display**: Live view of recent log entries with automatic refresh
- **Filtering Options**: Filter by log type (Events, Errors, Multiplayer, Console, Performance)
- **Statistics Dashboard**: Shows log counts, session info, and last update time
- **Download Support**: Download complete log files for offline analysis
- **Auto-refresh Mode**: Automatically updates every 5 seconds for live monitoring
- **Color-coded Entries**: Different colors for different log types for easy scanning

### 🔌 API Endpoints
- **GET `/api/logs`**: Retrieve recent logs with filtering options
  - `?lines=100` - Number of lines to return (default: 100)
  - `?type=EVENT` - Filter by log type
- **GET `/api/logs/download`**: Download current log file

## Log Types and Categories

### Server Events
- `PLAYER_CONNECT` - Player connections and disconnections
- `ROOM_CREATION` - Room creation with player and room details
- `ROOM_JOIN` - Players joining rooms with context
- `GAME_START` - Game initiation with full game state
- `GAME_OVER` - Game completion with winner and statistics
- `DISCONNECT_HANDLING` - Player disconnect/reconnect scenarios

### Client Events
- `CLIENT_CONSOLE` - All browser console output
- `CLIENT_EVENT` - Custom game events from browser
- `CLIENT_GAME_ACTION` - Game actions performed by players
- `CLIENT_ERROR` - JavaScript errors and exceptions
- `CLIENT_PERFORMANCE` - Performance metrics and monitoring

### Game Actions
- All player actions (unit movement, building construction, combat, etc.)
- Multiplayer synchronization events
- Authority model decisions (target vs attacker authority)

## Log File Structure

```
[TIMESTAMP] [LOG_TYPE] category:action - description
  Data: {
    "detailed": "structured data",
    "sessionId": "unique_session_identifier",
    "playerId": "socket_id",
    "additional": "context"
  }
```

### Example Log Entries

```
[2025-09-27T19:31:23.682Z] [EVENT] MULTIPLAYER:ROOM_CREATION - Room JAIPX9 created
  Data: {
    "roomCode": "JAIPX9",
    "creatorId": "77nJAjCbwturwWlnAAAH",
    "creatorNickname": "John 117",
    "isPublic": true,
    "playerCount": 1
  }

[2025-09-27T19:31:32.708Z] [EVENT] CLIENT_CONSOLE:LOG - spawnEnemyWave() - Spawn enemy units
  Data: {
    "sessionId": "client_1759001492583_emykmjrpyuu",
    "url": "http://localhost:3117/",
    "playerId": "JnQ1m8NRvH5bHmK-AAAN"
  }
```

## Usage Guide

### For Development and Debugging

1. **Start the Server**: The logging system activates automatically when the server starts
2. **View Live Logs**: Visit `http://localhost:3117/log-viewer.html`
3. **Filter Logs**: Use the dropdown to focus on specific log types
4. **Monitor Real-time**: Enable auto-refresh for live monitoring
5. **Download Logs**: Click download button for offline analysis

### For Testing

1. **Performance Testing**: Client-side performance metrics are automatically logged
2. **Error Tracking**: All JavaScript errors are captured and sent to server
3. **Multiplayer Testing**: All room creation, joining, and game actions are logged
4. **Combat Testing**: Authority model decisions and combat outcomes are tracked

### Log File Locations

- **Server Logs**: `/logs/game_log_YYYY-MM-DDTHH-MM-SS-sssZ.log`
- **Automatic Cleanup**: Old logs (>7 days) are automatically removed
- **API Access**: Programmatic access through `/api/logs` endpoint

## Integration Points

The logging system is integrated throughout the codebase:

- **Server.js**: All Socket.IO events and multiplayer actions
- **Client Logger**: All browser-side activity and errors
- **Multiplayer.js**: Connection management and room operations
- **Game Engine**: Game state changes and player actions
- **Units/Buildings**: Combat system and authority decisions

## Benefits for Testing

1. **Complete Visibility**: See everything happening in both server and client
2. **Error Tracking**: Automatic capture of all errors with full context
3. **Performance Monitoring**: Track performance issues and bottlenecks
4. **Multiplayer Debugging**: Full audit trail of multiplayer interactions
5. **Session Correlation**: Link client and server actions through session IDs
6. **Historical Analysis**: Analyze patterns and issues across multiple game sessions

## Configuration

The logger automatically:
- Creates log directories if they don't exist
- Generates unique session IDs for tracking
- Rotates log files to prevent disk space issues
- Handles network interruptions gracefully
- Provides both real-time and batch logging modes

This comprehensive logging system provides complete transparency into game operations, making debugging, testing, and performance optimization much more effective.