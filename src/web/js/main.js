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
        this._addFunctionAvailable = null; // cached check
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
            this.hideLoading();
        }
    }

    /**
     * Setup lazy loading of visualizer when canvas is scrolled into view
     */
    setupLazyVisualizer() {
        // Check if BTreeVisualizer class exists before trying to use it
        if (typeof BTreeVisualizer === 'undefined') {
            console.log('Visualizer not loaded - skipping visualization setup');
            return;
        }

        // Initialize immediately (IntersectionObserver doesn't fire in headless browsers)
        this.visualizer = new BTreeVisualizer('visualization-canvas');
        window.viz = this.visualizer;
        this.connectEvents();
    }

    /**
     * Setup event handlers before visualizer is ready
     */
    setupEventHandlers() {
        // Event handlers connected in connectEvents() when visualizer is ready
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
            // window.sqliteVisEventHandler is already registered by events.js
            // No need to override it here — the global handler from events.js
            // forwards all events to eventManager.handleEvent() directly.

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
            // Update page count in footer immediately
            const el = document.getElementById('page-count');
            if (el && this.visualizer) el.textContent = this.visualizer.nodes.size;
        });

        eventManager.on(7, (e) => { // PAGE_FREE
            this.debugLog('[PAGE_FREE] Page:', e.data.page);
            if (this.visualizer) {
                this.visualizer.nodes.delete(e.data.page);
                this.visualizer.layout();
                this.visualizer.draw();
                const el = document.getElementById('page-count');
                if (el) el.textContent = this.visualizer.nodes.size;
            }
        });

        // Parse events - logged for event display, token data from client-side tokenizer
        eventManager.on(8, (e) => { // PARSE_START
            this.debugLog('[PARSE_START] SQL:', e.data.sql);
        });

        eventManager.on(9, (e) => { // PARSE_TOKEN
            this.debugLog('[PARSE_TOKEN] Token:', e.data.token, 'Type:', e.data.type);
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
        const viewModeSelect = document.getElementById('view-mode');
        if (viewModeSelect) {
            viewModeSelect.addEventListener('change', (e) => {
                if (this.visualizer) this.visualizer.setViewMode(e.target.value);
            });
        }

        // Show transitions checkbox
        const showTransitionsCheck = document.getElementById('show-transitions');
        if (showTransitionsCheck) {
            showTransitionsCheck.addEventListener('change', (e) => {
                if (this.visualizer) this.visualizer.setShowTransitions(e.target.checked);
            });
        }

        // Animation speed slider
        const speedSlider = document.getElementById('animation-speed');
        const speedValue = document.getElementById('speed-value');

        if (speedSlider) {
            speedSlider.addEventListener('input', (e) => {
                const speed = parseFloat(e.target.value);
                if (this.visualizer) this.visualizer.setAnimationSpeed(speed);
                speedValue.textContent = speed.toFixed(1) + 'x';
            });
        }

        // Step button
        document.getElementById('step-btn').addEventListener('click', () => {
            this.stepThroughSQL();
        });

        // Ctrl+Enter / Cmd+Enter to execute SQL
        document.getElementById('sql-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.executeSQL();
            }
        });
    }

    /**
     * Step through SQL statements one at a time
     */
    stepThroughSQL() {
        const sql = document.getElementById('sql-input').value.trim();
        if (!sql) {
            this.showOutput('Please enter SQL to step through', 'error');
            return;
        }

        const statements = this._splitStatements(sql).map(s => s.trim()).filter(s => s);

        if (statements.length === 0) {
            this.showOutput('No SQL statements found', 'error');
            return;
        }

        // Track current step index
        if (typeof this._stepIndex === 'undefined') this._stepIndex = 0;
        if (this._stepIndex >= statements.length) {
            this._stepIndex = 0;
            this.showOutput('All statements executed. Starting from beginning.', 'text');
            eventManager.clear();
        }

        const stmt = statements[this._stepIndex];
        this.showOutput(`Step ${this._stepIndex + 1}/${statements.length}: ${stmt}`, 'text');
        this.executeRealSQL(stmt + ';');
        this._stepIndex++;
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
     * Execute real SQL with WASM, splitting statements and rendering SELECT results
     */
    executeRealSQL(sql) {
        if (!this.db || !this.sqliteModule) {
            this.showOutput('Database not initialized', 'error');
            return;
        }

        const stmts = this._splitStatements(sql);
        let lastOutput = null;

        for (const stmt of stmts) {
            if (!stmt.trim()) continue;
            // Notify visualizer of each statement for parse tree visualization
            if (this.visualizer) this.visualizer.showParseStart(stmt.trim());
            lastOutput = this._executeOne(stmt.trim());
            if (lastOutput && lastOutput.error) {
                this.showHTMLOutput(
                    `<div style="color:var(--danger-color);font-weight:600">SQL Error</div>` +
                    `<div style="color:var(--text-secondary);margin:4px 0;font-family:monospace;font-size:13px;background:var(--bg-tertiary);padding:6px 10px;border-radius:4px">${this._escapeHtml(stmt.trim())}</div>` +
                    `<div style="color:var(--danger-color)">${this._escapeHtml(lastOutput.error)}</div>`
                );
                this.updateStatus('Error');
                return;
            }
        }

        if (lastOutput && lastOutput.table) {
            this.showHTMLOutput(lastOutput.table);
        } else if (lastOutput && lastOutput.message) {
            this.showHTMLOutput(`<div style="color:var(--success-color)">${this._escapeHtml(lastOutput.message)}</div>`);
        }
        this.updateStatus('Ready');
    }

    _splitStatements(sql) {
        const stmts = [];
        let cur = '', inStr = false, q = '';
        for (const c of sql) {
            if (!inStr && (c === "'" || c === '"')) { inStr = true; q = c; cur += c; continue; }
            if (inStr && c === q) { inStr = false; cur += c; continue; }
            if (inStr) { cur += c; continue; }
            if (c === ';') { stmts.push(cur); cur = ''; }
            else cur += c;
        }
        if (cur.trim()) stmts.push(cur);
        return stmts;
    }

    _escapeHtml(s) {
        const d = document.createElement('div');
        d.textContent = s == null ? 'NULL' : String(s);
        return d.innerHTML;
    }

    _executeOne(sql) {
        const mod = this.sqliteModule;
        const trimmedSql = sql.trim();

        try {
            // First execute the SQL (for side effects like CREATE/INSERT/DELETE)
            const sqlLen = mod.lengthBytesUTF8(trimmedSql) + 1;
            const sqlPtr = mod._malloc(sqlLen);
            mod.stringToUTF8(trimmedSql, sqlPtr, sqlLen);

            const errorPtrPtr = mod._malloc(4);
            mod.HEAP32[errorPtrPtr >> 2] = 0;

            // Try sqlite3_exec with callback first
            let resultColumns = null;
            let resultRows = [];
            let hasResults = false;
            let callbackPtr = 0;

            // Cache addFunction availability check (pre-built WASM lacks RESERVED_FUNCTION_POINTERS)
            if (this._addFunctionAvailable === null) {
                try {
                    if (mod.addFunction) {
                        mod.addFunction(() => 0, 'ii');
                        mod.removeFunction(mod.addFunction(() => 0, 'ii'));
                        // If we get here, addFunction works (but we leaked 2 slots - that's OK for one-time check)
                        // Actually let's test differently
                        this._addFunctionAvailable = true;
                    } else {
                        this._addFunctionAvailable = false;
                    }
                } catch (e) {
                    this._addFunctionAvailable = false;
                }
            }

            if (this._addFunctionAvailable) {
                try {
                    const callback = (unused, colCount, colValuesPtr, colNamesPtr) => {
                        hasResults = true;
                        if (!resultColumns) {
                            resultColumns = [];
                            for (let i = 0; i < colCount; i++) {
                                const namePtr = mod.HEAP32[(colNamesPtr >> 2) + i];
                                resultColumns.push(mod.UTF8ToString(namePtr));
                            }
                        }
                        const row = [];
                        for (let i = 0; i < colCount; i++) {
                            const valPtr = mod.HEAP32[(colValuesPtr >> 2) + i];
                            if (valPtr === 0) {
                                row.push(null);
                            } else {
                                row.push(mod.UTF8ToString(valPtr));
                            }
                        }
                        resultRows.push(row);
                        return 0;
                    };
                    callbackPtr = mod.addFunction(callback, 'iiiii');
                } catch (e) {
                    callbackPtr = 0;
                    this._addFunctionAvailable = false;
                }
            }

            let result;
            if (callbackPtr) {
                result = mod._sqlite3_exec(this.db, sqlPtr, callbackPtr, 0, errorPtrPtr);
                try { mod.removeFunction(callbackPtr); } catch(e) {}
            } else {
                // Fallback: try prepare/step for SELECT statements
                if (/^\s*SELECT\b/i.test(trimmedSql)) {
                    mod._free(sqlPtr);
                    mod._free(errorPtrPtr);
                    return this._executeSelect(trimmedSql);
                }
                result = mod._sqlite3_exec(this.db, sqlPtr, 0, 0, errorPtrPtr);
            }

            mod._free(sqlPtr);

            if (result !== 0) {
                const errorMsgPtr = mod.HEAP32[errorPtrPtr >> 2];
                let errMsg = 'Error code: ' + result;
                if (errorMsgPtr) errMsg = mod.UTF8ToString(errorMsgPtr);
                mod._free(errorPtrPtr);
                return { error: errMsg };
            }

            mod._free(errorPtrPtr);

            if (hasResults && resultColumns) {
                return { table: this._buildTable(resultColumns, resultRows) };
            }

            return { message: 'SQL executed successfully' };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Fallback for SELECT when addFunction is unavailable:
     * Use sqlite3_prepare_v2 + sqlite3_step + sqlite3_column_text
     */
    _executeSelect(sql) {
        const mod = this.sqliteModule;
        try {
            const sqlLen = mod.lengthBytesUTF8(sql) + 1;
            const sqlPtr = mod._malloc(sqlLen);
            mod.stringToUTF8(sql, sqlPtr, sqlLen);

            const stmtPtrPtr = mod._malloc(4);
            const tailPtrPtr = mod._malloc(4);
            const result = mod._sqlite3_prepare_v2(this.db, sqlPtr, sqlLen - 1, stmtPtrPtr, tailPtrPtr);
            mod._free(sqlPtr);

            if (result !== 0) {
                const errPtr = mod._sqlite3_errmsg(this.db);
                const errMsg = errPtr ? mod.UTF8ToString(errPtr) : 'prepare error ' + result;
                mod._free(stmtPtrPtr);
                mod._free(tailPtrPtr);
                return { error: errMsg };
            }

            const stmt = mod.HEAP32[stmtPtrPtr >> 2];
            mod._free(stmtPtrPtr);
            mod._free(tailPtrPtr);

            if (!stmt) {
                return { message: 'SQL executed successfully' };
            }

            const SQLITE_ROW = 100;
            const SQLITE_DONE = 101;

            const firstStep = mod._sqlite3_step(stmt);

            if (firstStep === SQLITE_DONE) {
                mod._sqlite3_finalize(stmt);
                return { table: '<table></table>' };
            }

            if (firstStep !== SQLITE_ROW) {
                mod._sqlite3_finalize(stmt);
                return { error: 'Step error: ' + firstStep };
            }

            // Use sqlite3_column_count (available in rebuilt WASM)
            const colCount = mod._sqlite3_column_count(stmt);
            if (colCount <= 0) {
                mod._sqlite3_finalize(stmt);
                return { table: '<table></table>' };
            }

            // Get column names
            const colNames = [];
            for (let i = 0; i < colCount; i++) {
                const namePtr = mod._sqlite3_column_name(stmt, i);
                colNames.push(namePtr ? mod.UTF8ToString(namePtr) : 'col' + (i + 1));
            }

            // Read first row
            const firstRow = [];
            for (let i = 0; i < colCount; i++) {
                const ptr = mod._sqlite3_column_text(stmt, i);
                firstRow.push(ptr === 0 ? null : mod.UTF8ToString(ptr));
            }

            const rows = [firstRow];

            while (true) {
                const stepResult = mod._sqlite3_step(stmt);
                if (stepResult === SQLITE_DONE) break;
                if (stepResult !== SQLITE_ROW) {
                    mod._sqlite3_finalize(stmt);
                    return { error: 'Step error: ' + stepResult };
                }

                const row = [];
                for (let i = 0; i < colCount; i++) {
                    const ptr = mod._sqlite3_column_text(stmt, i);
                    row.push(ptr === 0 ? null : mod.UTF8ToString(ptr));
                }
                rows.push(row);
            }

            mod._sqlite3_finalize(stmt);
            return { table: this._buildTable(colNames, rows) };
        } catch (error) {
            return { error: error.message };
        }
    }


    _buildTable(columns, rows) {
        const parts = ['<table><tr>'];
        for (const col of columns) parts.push(`<th>${this._escapeHtml(col)}</th>`);
        parts.push('</tr>');
        for (const row of rows) {
            parts.push('<tr>');
            for (const cell of row) parts.push(`<td>${this._escapeHtml(cell)}</td>`);
            parts.push('</tr>');
        }
        parts.push('</table>');
        return parts.join('');
    }

    /**
     * Show output in the output panel (optimized - avoids innerHTML)
     */
    showOutput(content, type = 'text') {
        const outputDiv = document.getElementById('output');
        outputDiv.textContent = content;

        if (type === 'error') {
            outputDiv.style.color = 'var(--danger-color)';
        } else if (type === 'success') {
            outputDiv.style.color = 'var(--success-color)';
        } else {
            outputDiv.style.color = 'var(--text-primary)';
        }
    }

    /**
     * Show HTML content in the output panel
     */
    showHTMLOutput(html) {
        const outputDiv = document.getElementById('output');
        outputDiv.innerHTML = html;
    }

    /**
     * Clear output panel (optimized - avoids innerHTML)
     */
    clearOutput() {
        const outputDiv = document.getElementById('output');
        // Clear all children efficiently
        while (outputDiv.firstChild) {
            outputDiv.removeChild(outputDiv.firstChild);
        }
        // Add placeholder
        const placeholder = document.createElement('p');
        placeholder.className = 'placeholder';
        placeholder.textContent = 'Results will appear here...';
        outputDiv.appendChild(placeholder);
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
        // Dispatch event to let HTML know WASM is ready
        window.dispatchEvent(new Event('wasm-ready'));
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new SQLiteVisApp();
    app.init();

    // Make app globally available for debugging
    window.sqliteApp = app;
});
