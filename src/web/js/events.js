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

        // Object pooling for DOM elements to reduce GC pressure
        this._elementPool = [];
        this._maxPoolSize = 100;

        // Performance: Limit visible events to prevent DOM overload
        this._maxVisibleEvents = 500; // Only show last 500 events
        this._eventLogEnabled = true; // Can toggle to disable log entirely

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

        // Time formatter cache
        this._timeFormatter = new Intl.DateTimeFormat('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3
        });
    }

    /**
     * Handle an event from the WASM module (with AGGRESSIVE throttling for performance)
     */
    handleEvent(eventType, dataJson) {
        // Ultra Fast path: Skip most VDBE opcode events entirely
        // Only log every 10th opcode to reduce UI spam
        if (eventType === 12) { // VDBE_OPCODE
            this._vdbeOpcodeCount = (this._vdbeOpcodeCount || 0) + 1;
            if (this._vdbeOpcodeCount % 10 !== 0) {
                // Skip 9 out of 10 opcode events for performance
                this.eventCount++;
                return;
            }
        }

        // Fast path: Don't parse JSON for events we don't care about
        if (eventType !== 8 && eventType !== 9 && eventType !== 10 &&
            eventType !== 11 && eventType !== 12 && eventType !== 13) {
            // For non-critical events, just increment counter and skip heavy processing
            this.eventCount++;
            return;
        }

        try {
            // Parse JSON data safely
            let data;
            try {
                data = JSON.parse(dataJson);
            } catch (parseError) {
                console.error('Failed to parse event data:', parseError, 'Raw data:', dataJson);
                // Create minimal event with raw data
                data = { _raw: dataJson, _parseError: true };
            }

            // Check for magic number workarounds for parse events
            let actualEventType = eventType;
            let actualTypeName = this.eventTypeNames[eventType] || 'UNKNOWN';
            let actualCategory = this.eventCategories[eventType] || 'other';

            // Detect parse event magic numbers
            if (eventType === 11 && data.numOpcodes === 100) {
                // PARSE_START marker
                actualEventType = 8;
                actualTypeName = 'PARSE_START';
                actualCategory = 'parse';
                data.sql = 'SQL Query';
            }

            // Detect parse_start_event wrapped in VDBE_START
            if (eventType === 11 && data.parseType === 'start') {
                actualEventType = 8;
                actualTypeName = 'PARSE_START';
                actualCategory = 'parse';
                data.sql = data.sql || 'SQL Query';
            }

            // Detect parse_complete_event wrapped in PAGE_ALLOCATE
            if (eventType === 6 && data.parseType === 'complete') {
                actualEventType = 10;
                actualTypeName = 'PARSE_COMPLETE';
                actualCategory = 'parse';
            }

            const event = {
                id: this.eventCount++,
                type: actualEventType,
                typeName: actualTypeName,
                category: actualCategory,
                data: data,
                timestamp: Date.now()
            };

            this.events.push(event);
            this.logEvent(event);
            this.notifyListeners(event);

            // Use requestIdleCallback for non-critical stats updates
            if (this.eventCount % 10 === 0) {
                this.updateStats();
            }
        } catch (error) {
            console.error('Error handling event:', error, 'Event type:', eventType, 'Data:', dataJson);
        }
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
        typeListeners.forEach(callback => {
            try {
                callback(event);
            } catch (error) {
                console.error('Error in event listener for type', event.type, ':', error);
            }
        });

        // Notify wildcard listeners
        const allListeners = this.listeners.get('*') || [];
        allListeners.forEach(callback => {
            try {
                callback(event);
            } catch (error) {
                console.error('Error in wildcard event listener:', error);
            }
        });
    }

    /**
     * Create event DOM element with object pooling
     */
    _createEventElement(event) {
        // Try to reuse from pool
        let eventItem = this._elementPool.pop();

        if (!eventItem) {
            // Create new element if pool is empty
            eventItem = document.createElement('div');
            eventItem.className = `event-item event-${event.category}`;

            const timeSpan = document.createElement('span');
            timeSpan.className = 'event-time';

            const typeSpan = document.createElement('span');
            typeSpan.className = 'event-type';

            const dataSpan = document.createElement('span');
            dataSpan.className = 'event-data';

            eventItem.appendChild(timeSpan);
            eventItem.appendChild(typeSpan);
            eventItem.appendChild(dataSpan);
        } else {
            // Update existing element
            eventItem.className = `event-item event-${event.category}`;
        }

        const time = this._timeFormatter.format(event.timestamp);
        const dataStr = this.formatEventData(event);

        // Update content (more efficient than creating new elements)
        const timeSpan = eventItem.querySelector('.event-time');
        const typeSpan = eventItem.querySelector('.event-type');
        const dataSpan = eventItem.querySelector('.event-data');

        if (timeSpan) timeSpan.textContent = time;
        if (typeSpan) typeSpan.textContent = event.typeName;
        if (dataSpan) dataSpan.textContent = dataStr;

        return eventItem;
    }

    /**
     * Return element to pool for reuse
     */
    _returnElementToPool(element) {
        if (this._elementPool.length < this._maxPoolSize) {
            // Clean element before returning to pool
            element.style.display = '';
            this._elementPool.push(element);
        }
    }

    /**
     * Log event to the UI with ULTRA aggressive performance optimization
     * Uses document fragment and throttled updates
     */
    logEvent(event) {
        // Early exit if event log is disabled
        if (!this._eventLogEnabled) return;

        const logElement = document.getElementById('event-log');
        if (!logElement) return;

        // ULTRA Performance: Keep only the most recent 25 events in the DOM
        // This is the most critical optimization for performance
        const MAX_DOM_EVENTS = 25;

        // Fast-path: check DOM size
        if (logElement.children.length >= MAX_DOM_EVENTS) {
            // Remove first child (fastest way to remove from beginning)
            if (logElement.firstElementChild) {
                // Return element to pool instead of destroying it
                this._returnElementToPool(logElement.firstElementChild);
            }
        }

        // Create and append new event
        const eventItem = this._createEventElement(event);
        logElement.appendChild(eventItem);

        // Throttled auto-scroll to reduce layout thrashing
        // Only scroll every 5 events instead of every event
        this._scrollCounter = (this._scrollCounter || 0) + 1;
        if (this.autoScroll && this._scrollCounter % 5 === 0 && !this._scrollScheduled) {
            this._scrollScheduled = true;
            requestAnimationFrame(() => {
                logElement.scrollTop = logElement.scrollHeight;
                this._scrollScheduled = false;
            });
        }

        // Prune the events array to prevent memory leaks
        // Keep only the most recent 100 events in memory (reduced from 200)
        const MAX_MEMORY_EVENTS = 100;
        if (this.events.length > MAX_MEMORY_EVENTS) {
            this.events.splice(0, this.events.length - MAX_MEMORY_EVENTS);
        }
    }


    /**
     * Format event data for display
     */
    formatEventData(event) {
        const data = event.data;

        // Handle parse events wrapped in other event types (workaround)
        if (data.parseType) {
            if (data.parseType === 'start') {
                return `sql="${data.sql}"`;
            } else if (data.parseType === 'token') {
                return `token="${data.token}", type=${data.type}`;
            } else if (data.parseType === 'complete') {
                return `success=${data.success}`;
            }
        }

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
                // Check if this is actually a parse complete event (workaround)
                if (data.parseType === 'complete') {
                    return `success=${data.success}`;
                }
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
                // Check if this is actually a parse start event (workaround)
                if (data.parseType === 'start') {
                    return `sql="${data.sql}"`;
                }
                return `opcodes=${data.numOpcodes}`;

            case 'VDBE_OPCODE':
                return `[${data.pc}] ${data.opcode} ${data.p1},${data.p2},${data.p3}`;

            case 'VDBE_COMPLETE':
                // Check if this is actually a parse token event (workaround)
                if (data.parseType === 'token') {
                    return `token="${data.token}", type=${data.type}`;
                }
                return `result=${data.resultCode}`;

            default:
                return JSON.stringify(data);
        }
    }

    /**
     * Update statistics display with requestIdleCallback for non-critical updates
     */
    updateStats() {
        // Use requestIdleCallback for non-blocking UI updates
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                const eventCountElement = document.getElementById('event-count');
                if (eventCountElement) {
                    eventCountElement.textContent = this.eventCount;
                }
            }, { timeout: 2000 });
        } else {
            // Fallback for browsers without requestIdleCallback
            const eventCountElement = document.getElementById('event-count');
            if (eventCountElement) {
                eventCountElement.textContent = this.eventCount;
            }
        }
    }

    /**
     * Clear all events (optimized)
     */
    clear() {
        this.events = [];
        this.eventCount = 0;

        const logElement = document.getElementById('event-log');
        if (logElement) {
            // Much faster than innerHTML = ''
            while (logElement.firstChild) {
                logElement.removeChild(logElement.firstChild);
            }
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
