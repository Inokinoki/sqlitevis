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
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            this.updateStatus('Initializing SQLite WebAssembly...');

            // Initialize visualizer
            this.visualizer = new BTreeVisualizer('visualization-canvas');

            // Connect event manager to visualizer
            this.connectEvents();

            // Initialize SQLite WASM
            await this.initSQLite();

            // Setup UI event handlers
            this.setupUIHandlers();

            this.isInitialized = true;
            this.updateStatus('Ready');
            this.hideLoading();

        } catch (error) {
            console.error('Initialization error:', error);
            this.updateStatus('Error: ' + error.message);
            alert('Failed to initialize SQLite WebAssembly: ' + error.message);
        }
    }

    /**
     * Initialize SQLite WebAssembly module
     */
    async initSQLite() {
        // Check if SQLite module loader exists
        if (typeof createSQLiteModule === 'undefined') {
            // For development without WASM, use mock
            console.warn('SQLite WASM not found, using mock mode');
            this.useMockMode();
            return;
        }

        try {
            this.sqliteModule = await createSQLiteModule();
            console.log('SQLite WASM module loaded');

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
                const errPtr = this.sqliteModule._sqlite3_errmsg(dbPtrPtr);
                const errMsg = this.sqliteModule.UTF8ToString(errPtr);
                throw new Error('Failed to open database: ' + errMsg);
            }

            // Read the database pointer from memory
            this.db = this.sqliteModule.HEAP32[dbPtrPtr >> 2];

            // Free temporary memory
            this.sqliteModule._free(dbPathPtr);
            this.sqliteModule._free(dbPtrPtr);

            console.log('SQLite initialized successfully (in-memory database)');
        } catch (error) {
            console.error('SQLite initialization failed:', error);
            console.log('Falling back to mock mode');
            this.useMockMode();
        }
    }

    /**
     * Use mock mode for development without WASM
     */
    useMockMode() {
        console.log('Running in mock mode');

        // Simulate some events for testing
        setTimeout(() => {
            eventManager.handleEvent(0, '{"pageSize":4096,"numPages":1}');
            eventManager.handleEvent(6, '{"page":1,"type":1}');
        }, 500);
    }

    /**
     * Connect event manager to visualizer
     */
    connectEvents() {
        // B-tree events
        eventManager.on(0, (e) => { // BTREE_OPEN
            this.visualizer.pageSize = e.data.pageSize;
        });

        eventManager.on(6, (e) => { // PAGE_ALLOCATE
            this.visualizer.addPage(e.data.page, e.data.type);
        });

        eventManager.on(7, (e) => { // PAGE_FREE
            this.visualizer.nodes.delete(e.data.page);
            this.visualizer.layout();
            this.visualizer.draw();
        });

        eventManager.on(2, (e) => { // BTREE_INSERT
            this.visualizer.addCell(e.data.page, e.data.cell, e.data.keyLen);
        });

        eventManager.on(3, (e) => { // BTREE_DELETE
            this.visualizer.deleteCell(e.data.page, e.data.cell);
        });

        eventManager.on(4, (e) => { // BTREE_SPLIT
            this.visualizer.splitPage(
                e.data.originalPage,
                e.data.newPage,
                e.data.splitCell
            );
        });
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
            // Emit parse start event
            eventManager.handleEvent(8, `{"sql":"${sql.replace(/"/g, '\\"')}"}`);

            // In mock mode, simulate some operations
            if (!this.sqliteModule) {
                this.executeMockSQL(sql);
                return;
            }

            // Execute real SQL (to be implemented with WASM)
            this.executeRealSQL(sql);

        } catch (error) {
            this.showOutput('Error: ' + error.message, 'error');
            this.updateStatus('Error');
        }
    }

    /**
     * Execute mock SQL for testing
     */
    executeMockSQL(sql) {
        const sqlUpper = sql.toUpperCase();

        if (sqlUpper.includes('CREATE TABLE')) {
            // Simulate table creation
            eventManager.handleEvent(6, '{"page":1,"type":1}');
            this.showOutput('Table created (mock)', 'success');
        }

        if (sqlUpper.includes('INSERT INTO')) {
            // Simulate insertions
            const matches = sql.match(/INSERT INTO/gi);
            const count = matches ? matches.length : 1;

            for (let i = 0; i < count; i++) {
                setTimeout(() => {
                    eventManager.handleEvent(2, `{"page":1,"cell":${i},"keyLen":16}`);
                }, i * 200);
            }

            this.showOutput(`Inserted ${count} row(s) (mock)`, 'success');
        }

        if (sqlUpper.includes('SELECT')) {
            // Simulate query
            this.showOutput('<table><tr><th>id</th><th>name</th><th>age</th></tr>' +
                '<tr><td>1</td><td>Alice</td><td>30</td></tr>' +
                '<tr><td>2</td><td>Bob</td><td>25</td></tr></table>', 'table');
        }

        eventManager.handleEvent(10, '{"success":1}');
        this.updateStatus('Ready');
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
                console.log('SQL executed:', sql);
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
     * Step through SQL execution
     */
    stepThroughSQL() {
        alert('Step-through mode coming soon!');
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
