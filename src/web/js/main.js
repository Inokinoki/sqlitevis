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
        this._stepIndex = 0;
        this._sqlInput = null;
    }

    /**
     * Initialize the application (optimized with lazy loading)
     */
    async init() {
        try {
            this.updateStatus('Initializing SQLite WebAssembly...');

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
     * Initialize SQLite WebAssembly module
     */
    async initSQLite() {
        // Check if SQLite module loader exists
        if (typeof createSQLiteModule === 'undefined') {
            throw new Error('SQLite WASM module not found. Please build the project using "make build-wasm"');
        }

        try {
            // window.sqliteVisEventHandler is already registered by events.js
            // No need to override it here — the global handler from events.js
            // forwards all events to eventManager.handleEvent() directly.

            // Load the module
            this.sqliteModule = await createSQLiteModule();

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

            // Clear initialization events from the log
            if (typeof eventManager !== 'undefined') {
                eventManager.clear();
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
            if (this.visualizer) this.visualizer.pageSize = e.data.pageSize;
        });

        // BTREE_CLOSE(1), BTREE_BALANCE(5) — not yet instrumented

        eventManager.on(2, (e) => { // BTREE_INSERT
            if (this.visualizer) {
                const { page, cell, keyLen, rootPage } = e.data;
                // Skip sqlite_master writes (rootPage 1 = schema table, not user data)
                if (rootPage === 1) return;
                // If inserting into a page different from root, it's a child of root
                if (rootPage && page !== rootPage) {
                    this.visualizer.addPage(page, 1, rootPage);
                } else if (rootPage) {
                    // This page IS the root — ensure it exists
                    this.visualizer.addPage(page, 1);
                    this.visualizer.rootPage = rootPage;
                }
                this.visualizer.addCell(page, cell, keyLen);
            }
        });

        eventManager.on(3, (e) => { // BTREE_DELETE
            if (this.visualizer) this.visualizer.deleteCell(e.data.page, e.data.cell);
        });

        eventManager.on(4, (e) => { // BTREE_SPLIT
            if (this.visualizer) {
                const { originalPage, newPage, splitCell, type } = e.data;
                this.visualizer.splitPage(originalPage, newPage, splitCell, type);
            }
        });

        // PAGE_ALLOCATE(6) — nodes auto-created by BTREE_INSERT events

        eventManager.on(7, (e) => { // PAGE_FREE
            if (this.visualizer) {
                this.visualizer.removePage(e.data.page);
            }
        });

        // Parse events — PARSE_START(8), PARSE_TOKEN(9) data logged via eventManager

        eventManager.on(10, (e) => { // PARSE_COMPLETE
            if (this.visualizer) this.visualizer.showParseComplete(e.data.success);
        });

        // VDBE events
        eventManager.on(11, (e) => { // VDBE_START
            if (this.visualizer) this.visualizer.showVdbeStart(e.data.numOpcodes);
        });

        eventManager.on(12, (e) => { // VDBE_OPCODE
            if (this.visualizer) this.visualizer.showVdbeOpcode(e.data.pc, e.data.opcode, e.data.p1, e.data.p2, e.data.p3);
        });

        eventManager.on(13, (e) => { // VDBE_COMPLETE
            if (this.visualizer) this.visualizer.showVdbeComplete(e.data.resultCode);
        });

        // Node data query callback
        this.visualizer.onQueryNodeData = async (pageNum, rowids) => {
            return this.queryNodeData(pageNum, rowids);
        };
    }

    /**
     * Setup UI event handlers
     */
    setupUIHandlers() {
        this._sqlInput = document.getElementById('sql-input');

        // Execute button
        document.getElementById('execute-btn').addEventListener('click', () => {
            this.executeSQL();
        });

        // Clear button
        document.getElementById('clear-btn').addEventListener('click', () => {
            this._sqlInput.value = '';
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

        // VDBE step controls
        document.getElementById('vdbe-next').addEventListener('click', () => {
            if (this.visualizer) this.visualizer.stepVdbe(1);
        });
        document.getElementById('vdbe-prev').addEventListener('click', () => {
            if (this.visualizer) this.visualizer.stepVdbe(-1);
        });
        document.getElementById('vdbe-reset').addEventListener('click', () => {
            if (this.visualizer) this.visualizer.stepVdbe(0);
        });

        // Ctrl+Enter / Cmd+Enter to execute SQL
        this._sqlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.executeSQL();
            }
        });

        // Reset step index when SQL content changes
        this._sqlInput.addEventListener('input', () => {
            this._stepIndex = 0;
        });
    }

    /**
     * Step through SQL statements one at a time
     */
    stepThroughSQL() {
        const sql = this._sqlInput.value.trim();
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
        const sql = this._sqlInput.value.trim();
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

        // Build parse tree once for the entire SQL batch
        if (this.visualizer && stmts.length > 0) {
            this.visualizer.showParseStart(sql.trim());
        }

        for (const stmt of stmts) {
            if (!stmt.trim()) continue;
            lastOutput = this._executeOne(stmt.trim());
            if (lastOutput && lastOutput.error) {
                this.showHTMLOutput(
                    `<div style="color:var(--danger-color);font-weight:600">SQL Error</div>` +
                    `<div style="color:var(--text-secondary);margin:4px 0;font-family:monospace;font-size:13px;background:var(--bg-tertiary);padding:6px 10px;border-radius:4px">${escapeHtml(stmt.trim())}</div>` +
                    `<div style="color:var(--danger-color)">${escapeHtml(lastOutput.error)}</div>`
                );
                this.updateStatus('Error');
                return;
            }
        }

        if (lastOutput && lastOutput.table) {
            this.showHTMLOutput(lastOutput.table);
        } else if (lastOutput && lastOutput.message) {
            this.showHTMLOutput(`<div style="color:var(--success-color)">${escapeHtml(lastOutput.message)}</div>`);
        }

        // Rebuild page-to-table mapping only if SQL may have changed the schema
        if (/\b(CREATE|DROP|ALTER)\b/i.test(sql)) {
            this._buildPageToTableMap();
        }

        this.updateStatus('Ready');
    }

    _splitStatements(sql) {
        const stmts = [];
        let cur = '', inStr = false, q = '', prev = '';
        for (const c of sql) {
            if (!inStr && (c === "'" || c === '"')) { inStr = true; q = c; cur += c; prev = c; continue; }
            if (inStr && c === q) {
                if (prev === q) { cur += c; prev = ''; continue; } // escaped quote ''
                inStr = false; cur += c; prev = c; continue;
            }
            if (inStr) { cur += c; prev = c; continue; }
            if (c === ';') { stmts.push(cur); cur = ''; }
            else cur += c;
            prev = c;
        }
        if (cur.trim()) stmts.push(cur);
        return stmts;
    }

    /**
     * Core WASM SQL execution — returns { columns, rows, error }
     */
    _execSql(sql) {
        const mod = this.sqliteModule;
        const trimmedSql = sql.trim();

        try {
            const sqlLen = mod.lengthBytesUTF8(trimmedSql) + 1;
            const sqlPtr = mod._malloc(sqlLen);
            mod.stringToUTF8(trimmedSql, sqlPtr, sqlLen);

            const errorPtrPtr = mod._malloc(4);
            mod.HEAP32[errorPtrPtr >> 2] = 0;

            let columns = null;
            let rows = [];

            const callback = (unused, colCount, colValuesPtr, colNamesPtr) => {
                if (!columns) {
                    columns = [];
                    for (let i = 0; i < colCount; i++) {
                        const namePtr = mod.HEAP32[(colNamesPtr >> 2) + i];
                        columns.push(mod.UTF8ToString(namePtr));
                    }
                }
                const row = [];
                for (let i = 0; i < colCount; i++) {
                    const valPtr = mod.HEAP32[(colValuesPtr >> 2) + i];
                    row.push(valPtr === 0 ? null : mod.UTF8ToString(valPtr));
                }
                rows.push(row);
                return 0;
            };
            const callbackPtr = mod.addFunction(callback, 'iiiii');

            const result = mod._sqlite3_exec(this.db, sqlPtr, callbackPtr, 0, errorPtrPtr);
            mod.removeFunction(callbackPtr);
            mod._free(sqlPtr);

            if (result !== 0) {
                const errorMsgPtr = mod.HEAP32[errorPtrPtr >> 2];
                const errMsg = errorMsgPtr ? mod.UTF8ToString(errorMsgPtr) : 'Error code: ' + result;
                if (errorMsgPtr) mod._free(errorMsgPtr);
                mod._free(errorPtrPtr);
                return { columns: [], rows: [], error: errMsg };
            }

            mod._free(errorPtrPtr);
            return { columns: columns || [], rows, error: null };
        } catch (e) {
            return { columns: [], rows: [], error: e.message };
        }
    }

    _executeOne(sql) {
        const { columns, rows, error } = this._execSql(sql);
        if (error) return { error };
        if (columns.length > 0) return { table: buildTableHtml(columns, rows) };
        return { message: 'SQL executed successfully' };
    }

    /**
     * Execute SQL and return raw {columns, rows} instead of HTML
     */
    _queryRaw(sql) {
        const { columns, rows, error } = this._execSql(sql);
        if (error) return { error };
        return { columns, rows };
    }

    /**
     * Build mapping from rootPage number to table name
     */
    _buildPageToTableMap() {
        this._pageToTable = new Map();
        const result = this._queryRaw("SELECT name, rootpage FROM sqlite_master WHERE type='table'");
        if (result.columns) {
            const nameIdx = result.columns.indexOf('name');
            const rootIdx = result.columns.indexOf('rootpage');
            if (nameIdx >= 0 && rootIdx >= 0) {
                for (const row of result.rows) {
                    this._pageToTable.set(parseInt(row[rootIdx]), row[nameIdx]);
                }
            }
        }
    }

    /**
     * Query actual row data for a node by rowid
     */
    queryNodeData(pageNum, rowids) {
        if (!rowids || !rowids.length) return { error: 'No rowids' };

        // Validate rowids are numeric to prevent SQL injection
        const validRowids = rowids.filter(r => /^\d+$/.test(String(r)));
        if (validRowids.length === 0) return { error: 'No valid rowids' };

        const rootPage = this.visualizer.findRootPage(pageNum);
        if (!rootPage) return { error: 'Cannot determine table for page ' + pageNum };

        if (!this._pageToTable || !this._pageToTable.has(rootPage)) {
            return { error: 'Unknown table for root page ' + rootPage };
        }

        const tableName = this._pageToTable.get(rootPage).replace(/"/g, '""');
        const sql = `SELECT * FROM "${tableName}" WHERE rowid IN (${validRowids.join(',')})`;
        const result = this._queryRaw(sql);
        if (result.error) return result;
        return { columns: result.columns, rows: result.rows };
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

        // Clear visualizer state for fresh execution
        if (this.visualizer) this.visualizer.clear();
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
