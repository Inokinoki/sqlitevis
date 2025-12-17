/**
 * Event Handler for SQLite Visualization Events
 * Receives events from the WASM module and manages the event log
 */

class EventManager {
    constructor() {
        this.events = [];
        this.listeners = new Map();
        this.eventCount = 0;
        this.autoScroll = true;

        // Event type names
        this.eventTypeNames = {
            0: 'BTREE_OPEN',
            1: 'BTREE_CLOSE',
            2: 'BTREE_INSERT',
            3: 'BTREE_DELETE',
            4: 'BTREE_SPLIT',
            5: 'BTREE_BALANCE',
            6: 'PAGE_ALLOCATE',
            7: 'PAGE_FREE',
            8: 'PARSE_START',
            9: 'PARSE_TOKEN',
            10: 'PARSE_COMPLETE',
            11: 'VDBE_START',
            12: 'VDBE_OPCODE',
            13: 'VDBE_COMPLETE'
        };

        // Event categories
        this.eventCategories = {
            0: 'btree', 1: 'btree', 2: 'btree', 3: 'btree', 4: 'btree', 5: 'btree',
            6: 'btree', 7: 'btree', 8: 'parse', 9: 'parse', 10: 'parse',
            11: 'vdbe', 12: 'vdbe', 13: 'vdbe'
        };
    }

    /**
     * Handle an event from the WASM module
     */
    handleEvent(eventType, dataJson) {
        const event = {
            id: this.eventCount++,
            type: eventType,
            typeName: this.eventTypeNames[eventType] || 'UNKNOWN',
            category: this.eventCategories[eventType] || 'other',
            data: JSON.parse(dataJson),
            timestamp: Date.now()
        };

        this.events.push(event);
        this.logEvent(event);
        this.notifyListeners(event);
        this.updateStats();
    }

    /**
     * Register a listener for specific event types
     */
    on(eventType, callback) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }
        this.listeners.get(eventType).push(callback);
    }

    /**
     * Register a listener for all events
     */
    onAll(callback) {
        this.on('*', callback);
    }

    /**
     * Notify all listeners of an event
     */
    notifyListeners(event) {
        // Notify specific type listeners
        const typeListeners = this.listeners.get(event.type) || [];
        typeListeners.forEach(callback => callback(event));

        // Notify wildcard listeners
        const allListeners = this.listeners.get('*') || [];
        allListeners.forEach(callback => callback(event));
    }

    /**
     * Log event to the UI
     */
    logEvent(event) {
        const logElement = document.getElementById('event-log');
        if (!logElement) return;

        const eventItem = document.createElement('div');
        eventItem.className = `event-item event-${event.category}`;

        const time = new Date(event.timestamp).toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3
        });

        const dataStr = this.formatEventData(event);

        eventItem.innerHTML = `
            <span class="event-time">${time}</span>
            <span class="event-type">${event.typeName}</span>
            <span class="event-data">${dataStr}</span>
        `;

        logElement.appendChild(eventItem);

        // Auto-scroll to bottom if enabled
        if (this.autoScroll) {
            logElement.scrollTop = logElement.scrollHeight;
        }

        // Limit log size (keep last 1000 events in DOM)
        while (logElement.children.length > 1000) {
            logElement.removeChild(logElement.firstChild);
        }
    }

    /**
     * Format event data for display
     */
    formatEventData(event) {
        const data = event.data;

        switch (event.typeName) {
            case 'BTREE_OPEN':
                return `pageSize=${data.pageSize}, pages=${data.numPages}`;

            case 'BTREE_INSERT':
                return `page=${data.page}, cell=${data.cell}, keyLen=${data.keyLen}`;

            case 'BTREE_DELETE':
                return `page=${data.page}, cell=${data.cell}`;

            case 'BTREE_SPLIT':
                return `original=${data.originalPage} → new=${data.newPage}, split at cell ${data.splitCell}`;

            case 'PAGE_ALLOCATE':
                return `page=${data.page}, type=${data.type}`;

            case 'PAGE_FREE':
                return `page=${data.page}`;

            case 'PARSE_START':
                return `sql="${data.sql}"`;

            case 'PARSE_TOKEN':
                return `token="${data.token}", type=${data.type}`;

            case 'PARSE_COMPLETE':
                return `success=${data.success}`;

            case 'VDBE_START':
                return `opcodes=${data.numOpcodes}`;

            case 'VDBE_OPCODE':
                return `[${data.pc}] ${data.opcode} ${data.p1},${data.p2},${data.p3}`;

            case 'VDBE_COMPLETE':
                return `result=${data.resultCode}`;

            default:
                return JSON.stringify(data);
        }
    }

    /**
     * Update statistics display
     */
    updateStats() {
        const eventCountElement = document.getElementById('event-count');
        if (eventCountElement) {
            eventCountElement.textContent = this.eventCount;
        }
    }

    /**
     * Clear all events
     */
    clear() {
        this.events = [];
        this.eventCount = 0;

        const logElement = document.getElementById('event-log');
        if (logElement) {
            logElement.innerHTML = '';
        }

        this.updateStats();
    }

    /**
     * Get events by type
     */
    getEventsByType(eventType) {
        return this.events.filter(e => e.type === eventType);
    }

    /**
     * Get events by category
     */
    getEventsByCategory(category) {
        return this.events.filter(e => e.category === category);
    }

    /**
     * Get recent events
     */
    getRecentEvents(count = 100) {
        return this.events.slice(-count);
    }
}

// Global event manager instance
const eventManager = new EventManager();

// Register global event handler for WASM callbacks
window.sqliteVisEventHandler = (eventType, dataJson) => {
    eventManager.handleEvent(eventType, dataJson);
};
