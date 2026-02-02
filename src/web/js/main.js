/**
 * Main Application Controller
 * Initializes SQLite WASM and coordinates between components
 */

class SQLiteVisApp {
    constructor() {
        this.db = null;
        this.sqliteModule = null;
        this.visualizer = null;
        this.isInitialized = false;
        // Debug mode - can be toggled via console: app.setDebugMode(true)
        this.debugMode = false;
    }

    /**
     * Set debug mode for verbose logging
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log('Debug mode:', enabled ? 'ENABLED' : 'DISABLED');
    }

    /**
     * Debug logging helper
     */
    debugLog(...args) {
        if (this.debugMode) {
            console.log(...args);
        }
    }

    /**
     * Initialize the application (optimized with lazy loading)
     */
    async init() {
        try {
            this.updateStatus('Initializing SQLite WebAssembly...');

            // Connect event manager to visualizer setup (lazy load visualizer later)
            this.setupEventHandlers();

            // Set initialized flag BEFORE loading SQLite so events are processed
            this.isInitialized = true;

            // Initialize SQLite WASM
            await this.initSQLite();

            // Setup UI event handlers
            this.setupUIHandlers();

            // Lazy load visualizer only when canvas is visible
            this.setupLazyVisualizer();

            this.updateStatus('Ready');
            this.hideLoading();

        } catch (error) {
            console.error('Initialization error:', error);
            this.updateStatus('Error: ' + error.message);
            alert('Failed to initialize SQLite WebAssembly: ' + error.message);
        }
    }

    /**
     * Setup lazy loading of visualizer when canvas is scrolled into view
     */
    setupLazyVisualizer() {
        // Use IntersectionObserver to lazy load visualizer
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !this.visualizer) {
                        // Initialize visualizer when canvas becomes visible
                        this.visualizer = new BTreeVisualizer('visualization-canvas');
                        this.connectEvents();
                        observer.disconnect();
                    }
                });
            }, { threshold: 0.1 });

            const canvas = document.getElementById('visualization-canvas');
            if (canvas) {
                observer.observe(canvas);
            }
        } else {
            // Fallback: initialize immediately
            this.visualizer = new BTreeVisualizer('visualization-canvas');
            this.connectEvents();
        }
    }

    /**
     * Setup event handlers before visualizer is ready
     */
    setupEventHandlers() {
        // Event handlers will be connected in connectEvents() when visualizer is ready
        this._pendingEvents = [];
    }

    /**
     * Initialize SQLite WebAssembly module
     */
    async initSQLite() {
        // Check if SQLite module loader exists
        if (typeof createSQLiteModule === 'undefined') {
            throw new Error('SQLite WASM module not found. Please build the project using "make build-wasm"');
        }

        // Store reference to self for event handler
        const self = this;

        try {
            // Register event handler BEFORE loading the module
            // This ensures we can capture events during SQLite initialization
            window.sqliteVisEventHandler = (eventType, eventData) => {
                // Only handle events if eventManager exists and app is initialized
                if (typeof eventManager !== 'undefined' && self.isInitialized) {
                    try {
                        eventManager.handleEvent(eventType, eventData);
                    } catch (e) {
                        console.error('Event handler error:', e);
                    }
                }
            };

            // Load the module
            this.sqliteModule = await createSQLiteModule();
            this.debugLog('SQLite WASM module loaded successfully');

            // Allocate memory for database path string
            const dbPath = ':memory:'; // Use in-memory database
            const dbPathLen = this.sqliteModule.lengthBytesUTF8(dbPath) + 1;
            const dbPathPtr = this.sqliteModule._malloc(dbPathLen);
            this.sqliteModule.stringToUTF8(dbPath, dbPathPtr, dbPathLen);

            // Allocate memory for database pointer
            const dbPtrPtr = this.sqliteModule._malloc(4);

            // Open database
            const result = this.sqliteModule._sqlite3_open(dbPathPtr, dbPtrPtr);

            if (result !== 0) {
                // Try to read error - handle potential HEAP32 access issues
                let errMsg = 'Unknown error';
                try {
                    if (this.sqliteModule.HEAP32) {
                        const dbHandle = this.sqliteModule.HEAP32[dbPtrPtr >> 2];
                        if (dbHandle) {
                            const errPtr = this.sqliteModule._sqlite3_errmsg(dbHandle);
                            errMsg = this.sqliteModule.UTF8ToString(errPtr);
                        }
                    }
                } catch (e) {
                    console.error('Error reading SQLite error message:', e);
                }
                this.sqliteModule._free(dbPathPtr);
                this.sqliteModule._free(dbPtrPtr);
                throw new Error('Failed to open database: ' + errMsg);
            }

            // Read the database pointer from memory
            if (!this.sqliteModule.HEAP32) {
                throw new Error('HEAP32 not available on module - cannot read database pointer');
            }
            this.db = this.sqliteModule.HEAP32[dbPtrPtr >> 2];

            // Free temporary memory
            this.sqliteModule._free(dbPathPtr);
            this.sqliteModule._free(dbPtrPtr);

            this.debugLog('SQLite initialized successfully (in-memory database)');
            this.debugLog('Database handle:', this.db);

            // Clear initialization events from the log
            // SQLite fires internal events during sqlite3_open() that we don't want to show
            if (typeof eventManager !== 'undefined') {
                eventManager.clear();
                this.debugLog('Cleared initialization events');
            }
        } catch (error) {
            console.error('SQLite initialization failed:', error);
            throw error;
        }
    }

    /**
     * Connect event manager to visualizer (optimized to check if visualizer exists)
     */
    connectEvents() {
        // B-tree events
        eventManager.on(0, (e) => { // BTREE_OPEN
            this.debugLog('[BTREE_OPEN] Page size:', e.data.pageSize, 'Pages:', e.data.numPages);
            if (this.visualizer) this.visualizer.pageSize = e.data.pageSize;
        });

        eventManager.on(1, (e) => { // BTREE_CLOSE
            this.debugLog('[BTREE_CLOSE] B-tree closed');
            // B-tree close doesn't need visualization
        });

        eventManager.on(2, (e) => { // BTREE_INSERT
            this.debugLog('[BTREE_INSERT] Page:', e.data.page, 'Cell:', e.data.cell, 'KeyLen:', e.data.keyLen);
            if (this.visualizer) this.visualizer.addCell(e.data.page, e.data.cell, e.data.keyLen);
        });

        eventManager.on(3, (e) => { // BTREE_DELETE
            this.debugLog('[BTREE_DELETE] Page:', e.data.page, 'Cell:', e.data.cell);
            if (this.visualizer) this.visualizer.deleteCell(e.data.page, e.data.cell);
        });

        eventManager.on(4, (e) => { // BTREE_SPLIT
            this.debugLog('[BTREE_SPLIT] Original:', e.data.originalPage, 'New:', e.data.newPage, 'SplitCell:', e.data.splitCell);
            if (this.visualizer) {
                this.visualizer.splitPage(
                    e.data.originalPage,
                    e.data.newPage,
                    e.data.splitCell
                );
            }
        });

        eventManager.on(5, (e) => { // BTREE_BALANCE
            this.debugLog('[BTREE_BALANCE] Page:', e.data.page, 'NumCells:', e.data.numCells);
            // Could add visualization for balancing operation
        });

        eventManager.on(6, (e) => { // PAGE_ALLOCATE
            this.debugLog('[PAGE_ALLOCATE] Page:', e.data.page, 'Type:', e.data.type);
            if (this.visualizer) this.visualizer.addPage(e.data.page, e.data.type);
        });

        eventManager.on(7, (e) => { // PAGE_FREE
            this.debugLog('[PAGE_FREE] Page:', e.data.page);
            if (this.visualizer) {
                this.visualizer.nodes.delete(e.data.page);
                this.visualizer.layout();
                this.visualizer.draw();
            }
        });

        // Parse events
        eventManager.on(8, (e) => { // PARSE_START
            this.debugLog('[PARSE_START] SQL:', e.data.sql);
            if (this.visualizer) this.visualizer.showParseStart(e.data.sql);
        });

        eventManager.on(9, (e) => { // PARSE_TOKEN
            this.debugLog('[PARSE_TOKEN] Token:', e.data.token, 'Type:', e.data.type);
            if (this.visualizer) this.visualizer.showParseToken(e.data.token, e.data.type);
        });

        eventManager.on(10, (e) => { // PARSE_COMPLETE
            this.debugLog('[PARSE_COMPLETE] Success:', e.data.success);
            if (this.visualizer) this.visualizer.showParseComplete(e.data.success);
        });

        // VDBE events
        eventManager.on(11, (e) => { // VDBE_START
            this.debugLog('[VDBE_START] NumOpcodes:', e.data.numOpcodes);
            if (this.visualizer) this.visualizer.showVdbeStart(e.data.numOpcodes);
        });

        eventManager.on(12, (e) => { // VDBE_OPCODE
            this.debugLog('[VDBE_OPCODE] PC:', e.data.pc, 'Opcode:', e.data.opcode, 'P1:', e.data.p1, 'P2:', e.data.p2, 'P3:', e.data.p3);
            if (this.visualizer) this.visualizer.showVdbeOpcode(e.data.pc, e.data.opcode, e.data.p1, e.data.p2, e.data.p3);
        });

        eventManager.on(13, (e) => { // VDBE_COMPLETE
            this.debugLog('[VDBE_COMPLETE] ResultCode:', e.data.resultCode);
            if (this.visualizer) this.visualizer.showVdbeComplete(e.data.resultCode);
        });

        this.debugLog('All event handlers registered successfully');
    }

    /**
     * Setup UI event handlers
     */
    setupUIHandlers() {
        // Execute button
        document.getElementById('execute-btn').addEventListener('click', () => {
            this.executeSQL();
        });

        // Clear button
        document.getElementById('clear-btn').addEventListener('click', () => {
            document.getElementById('sql-input').value = '';
            this.clearOutput();
        });

        // Clear events button
        document.getElementById('clear-events-btn').addEventListener('click', () => {
            eventManager.clear();
        });

        // Auto-scroll checkbox
        document.getElementById('auto-scroll').addEventListener('change', (e) => {
            eventManager.autoScroll = e.target.checked;
        });

        // View mode selector
        document.getElementById('view-mode').addEventListener('change', (e) => {
            this.visualizer.setViewMode(e.target.value);
        });

        // Show transitions checkbox
        document.getElementById('show-transitions').addEventListener('change', (e) => {
            this.visualizer.setShowTransitions(e.target.checked);
        });

        // Animation speed slider
        const speedSlider = document.getElementById('animation-speed');
        const speedValue = document.getElementById('speed-value');

        speedSlider.addEventListener('input', (e) => {
            const speed = parseFloat(e.target.value);
            this.visualizer.setAnimationSpeed(speed);
            speedValue.textContent = speed.toFixed(1) + 'x';
        });

        // Step button
        document.getElementById('step-btn').addEventListener('click', () => {
            this.stepThroughSQL();
        });
    }

    /**
     * Execute SQL from the editor
     */
    executeSQL() {
        const sql = document.getElementById('sql-input').value.trim();
        if (!sql) {
            this.showOutput('Please enter SQL to execute', 'error');
            return;
        }

        this.clearOutput();
        this.updateStatus('Executing SQL...');

        try {
            // Execute real SQL with WASM
            this.executeRealSQL(sql);

        } catch (error) {
            this.showOutput('Error: ' + error.message, 'error');
            this.updateStatus('Error');
        }
    }

    /**
     * Execute real SQL with WASM
     */
    executeRealSQL(sql) {
        if (!this.db || !this.sqliteModule) {
            this.showOutput('Database not initialized', 'error');
            return;
        }

        try {
            // Allocate memory for SQL string
            const sqlLen = this.sqliteModule.lengthBytesUTF8(sql) + 1;
            const sqlPtr = this.sqliteModule._malloc(sqlLen);
            this.sqliteModule.stringToUTF8(sql, sqlPtr, sqlLen);

            // Allocate memory for error message pointer
            const errorPtrPtr = this.sqliteModule._malloc(4);
            this.sqliteModule.HEAP32[errorPtrPtr >> 2] = 0;

            // Execute SQL
            const result = this.sqliteModule._sqlite3_exec(
                this.db,
                sqlPtr,
                0, // callback
                0, // callback arg
                errorPtrPtr
            );

            // Free SQL string
            this.sqliteModule._free(sqlPtr);

            if (result !== 0) {
                // Read error message pointer
                const errorMsgPtr = this.sqliteModule.HEAP32[errorPtrPtr >> 2];
                if (errorMsgPtr) {
                    const errorMsg = this.sqliteModule.UTF8ToString(errorMsgPtr);
                    this.showOutput('SQL Error: ' + errorMsg, 'error');
                } else {
                    this.showOutput('SQL Error code: ' + result, 'error');
                }
            } else {
                this.showOutput('✅ SQL executed successfully', 'success');
                this.debugLog('SQL executed:', sql);

                // Real events are automatically emitted by instrumented SQLite
                // through the window.sqliteVisEventHandler callback
            }

            this.sqliteModule._free(errorPtrPtr);
            this.updateStatus('Ready');
        } catch (error) {
            console.error('Error executing SQL:', error);
            this.showOutput('Error: ' + error.message, 'error');
            this.updateStatus('Error');
        }
    }

    /**
     * Show output in the output panel
     */
    showOutput(content, type = 'text') {
        const outputDiv = document.getElementById('output');
        outputDiv.innerHTML = content;

        if (type === 'error') {
            outputDiv.style.color = 'var(--danger-color)';
        } else if (type === 'success') {
            outputDiv.style.color = 'var(--success-color)';
        } else {
            outputDiv.style.color = 'var(--text-primary)';
        }
    }

    /**
     * Clear output panel
     */
    clearOutput() {
        const outputDiv = document.getElementById('output');
        outputDiv.innerHTML = '<p class="placeholder">Results will appear here...</p>';
    }

    /**
     * Update status message
     */
    updateStatus(message) {
        const statusElement = document.getElementById('db-status');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new SQLiteVisApp();
    app.init();

    // Make app globally available for debugging
    window.sqliteApp = app;
});
