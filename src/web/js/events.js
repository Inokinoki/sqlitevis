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

        // Virtual scrolling optimization
        this._visibleStart = 0;
        this._visibleEnd = 50;
        this._scrollTop = 0;
        this._itemHeight = 32; // Approximate height per event
        this._containerHeight = 0;

        // Object pooling for DOM elements to reduce GC pressure
        this._elementPool = [];
        this._maxPoolSize = 100;

        // Performance: Throttle event processing
        this._lastProcessTime = 0;
        this._processInterval = 8; // Process events every 8ms max (120fps)
        this._pendingEvents = [];
        this._processingScheduled = false;

        // Performance: Limit visible events to prevent DOM overload
        this._maxVisibleEvents = 500; // Only show last 500 events
        this._eventLogEnabled = true; // Can toggle to disable log entirely

        // Setup scroll listener for virtual scrolling
        this._setupVirtualScroll();

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
     * Handle an event from the WASM module (with throttling for performance)
     */
    handleEvent(eventType, dataJson) {
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
     * Setup virtual scrolling for event log with passive listeners
     */
    _setupVirtualScroll() {
        // Delay setup until DOM is ready
        setTimeout(() => {
            const logElement = document.getElementById('event-log');
            if (!logElement) return;

            this._containerHeight = logElement.clientHeight;

            // Throttled scroll handler with passive option for better performance
            let scrollTimeout;
            logElement.addEventListener('scroll', () => {
                if (scrollTimeout) return;

                scrollTimeout = requestAnimationFrame(() => {
                    this._updateVisibleRange();
                    scrollTimeout = null;
                });
            }, { passive: true });

            // Resize observer for container
            const resizeObserver = new ResizeObserver(entries => {
                for (const entry of entries) {
                    this._containerHeight = entry.contentRect.height;
                    this._updateVisibleRange();
                }
            });
            resizeObserver.observe(logElement);
        }, 100);
    }

    /**
     * Update visible range for virtual scrolling
     */
    _updateVisibleRange() {
        const logElement = document.getElementById('event-log');
        if (!logElement) return;

        const scrollTop = logElement.scrollTop;
        const viewportHeight = this._containerHeight;

        // Calculate visible range with buffer
        const bufferSize = 20;
        this._visibleStart = Math.max(0, Math.floor(scrollTop / this._itemHeight) - bufferSize);
        this._visibleEnd = Math.min(
            this.events.length,
            Math.ceil((scrollTop + viewportHeight) / this._itemHeight) + bufferSize
        );

        // Re-render if needed
        this._renderVisibleEvents();
    }

    /**
     * Render only visible events (virtual scrolling) with object pooling
     */
    _renderVisibleEvents() {
        const logElement = document.getElementById('event-log');
        if (!logElement) return;

        // Return old elements to pool before rendering
        const oldElements = logElement.querySelectorAll('.event-item');
        oldElements.forEach(el => this._returnElementToPool(el));

        // Use DocumentFragment for efficient batch insertion
        const fragment = document.createDocumentFragment();

        // Set total height for scrollbar
        const totalHeight = this.events.length * this._itemHeight;
        logElement.style.height = `${totalHeight}px`;
        logElement.style.position = 'relative';

        // Limit rendering to prevent DOM overload
        const maxRender = Math.min(this._visibleEnd - this._visibleStart, 100);
        const renderEnd = Math.min(this._visibleEnd, this._visibleStart + maxRender);

        // Render visible events (limited)
        for (let i = this._visibleStart; i < renderEnd; i++) {
            const event = this.events[i];
            if (!event) continue;

            const eventItem = this._createEventElement(event);
            eventItem.style.position = 'absolute';
            eventItem.style.top = `${i * this._itemHeight}px`;
            eventItem.style.width = '100%';
            fragment.appendChild(eventItem);
        }

        // Clear and append (faster than innerHTML)
        while (logElement.firstChild) {
            logElement.removeChild(logElement.firstChild);
        }
        logElement.appendChild(fragment);
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

        // Cache timestamp formatting
        if (!this._timeFormatter) {
            this._timeFormatter = new Intl.DateTimeFormat('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                fractionalSecondDigits: 3
            });
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
     * Log event to the UI with aggressive performance optimization
     */
    logEvent(event) {
        // Early exit if event log is disabled
        if (!this._eventLogEnabled) return;

        const logElement = document.getElementById('event-log');
        if (!logElement) return;

        // Performance: Prune old events to prevent DOM overload
        if (this.events.length > this._maxVisibleEvents) {
            // Remove oldest event from DOM
            const firstEvent = logElement.firstElementChild;
            if (firstEvent) {
                firstEvent.remove();
            }
        }

        // For small number of events, render immediately
        if (this.events.length < 100) {
            const eventItem = this._createEventElement(event);
            logElement.appendChild(eventItem);

            // Auto-scroll
            if (this.autoScroll) {
                logElement.scrollTop = logElement.scrollHeight;
            }
        } else {
            // For large number of events, use virtual scrolling
            if (!this._virtualScrollEnabled) {
                this._virtualScrollEnabled = true;
                this._updateVisibleRange();
            } else {
                // Just update the visible range
                this._updateVisibleRange();

                // Auto-scroll if enabled
                if (this.autoScroll && this.events.length > 0) {
                    const lastEventTop = (this.events.length - 1) * this._itemHeight;
                    if (lastEventTop > logElement.scrollTop + this._containerHeight - 100) {
                        logElement.scrollTop = lastEventTop;
                    }
                }
            }
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
        this._virtualScrollEnabled = false;
        this._visibleStart = 0;
        this._visibleEnd = 50;

        const logElement = document.getElementById('event-log');
        if (logElement) {
            // Much faster than innerHTML = ''
            while (logElement.firstChild) {
                logElement.removeChild(logElement.firstChild);
            }
            logElement.style.height = '';
            logElement.style.position = '';
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
