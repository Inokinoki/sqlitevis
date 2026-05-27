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
     * Initialize the application (optimized with lazy loading)
     */
    async init() {
        try {
            this.updateStatus(I18N.t('status.initializing'));

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

            this.updateStatus(I18N.t('status.ready'));
            this.hideLoading();

        } catch (error) {
            console.error('Initialization error:', error);
            this.updateStatus(I18N.t('status.error') + ': ' + error.message);
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

        eventManager.on(1, (e) => { /* BTREE_CLOSE */ });

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

        eventManager.on(5, (e) => { /* BTREE_BALANCE */ });

        eventManager.on(6, (e) => { // PAGE_ALLOCATE
            // Nodes are now auto-created by BTREE_INSERT events with proper tree structure.
            // PAGE_ALLOCATE only updates existing node page count; skip creating orphan nodes.
        });

        eventManager.on(7, (e) => { // PAGE_FREE
            if (this.visualizer) {
                this.visualizer.nodes.delete(e.data.page);
                this.visualizer.layout();
                this.visualizer.draw();
                const el = document.getElementById('page-count');
                if (el) el.textContent = this.visualizer.nodes.size;
            }
        });

        // Parse events
        eventManager.on(8, (e) => { /* PARSE_START - data logged via eventManager */ });

        eventManager.on(9, (e) => { /* PARSE_TOKEN */ });

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
            this.showOutput(I18N.t('error.noSqlStep'), 'error');
            return;
        }

        const statements = this._splitStatements(sql).map(s => s.trim()).filter(s => s);

        if (statements.length === 0) {
            this.showOutput(I18N.t('error.noStatements'), 'error');
            return;
        }

        // Track current step index
        if (typeof this._stepIndex === 'undefined') this._stepIndex = 0;
        if (this._stepIndex >= statements.length) {
            this._stepIndex = 0;
            this.showOutput(I18N.t('step.allDone'), 'text');
            eventManager.clear();
        }

        const stmt = statements[this._stepIndex];
        this.showOutput(I18N.t('step.progress', this._stepIndex + 1, statements.length, stmt), 'text');
        this.executeRealSQL(stmt + ';');
        this._stepIndex++;
    }

    /**
     * Execute SQL from the editor
     */
    executeSQL() {
        const sql = document.getElementById('sql-input').value.trim();
        if (!sql) {
            this.showOutput(I18N.t('error.noSql'), 'error');
            return;
        }

        this.clearOutput();
        this.updateStatus(I18N.t('status.executing'));

        try {
            // Execute real SQL with WASM
            this.executeRealSQL(sql);

        } catch (error) {
            this.showOutput(I18N.t('status.error') + ': ' + error.message, 'error');
            this.updateStatus(I18N.t('status.error'));
        }
    }

    /**
     * Execute real SQL with WASM, splitting statements and rendering SELECT results
     */
    executeRealSQL(sql) {
        if (!this.db || !this.sqliteModule) {
            this.showOutput(I18N.t('error.noDb'), 'error');
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
                    `<div style="color:var(--danger-color);font-weight:600">${I18N.t('output.errorPrefix')}</div>` +
                    `<div style="color:var(--text-secondary);margin:4px 0;font-family:monospace;font-size:13px;background:var(--bg-tertiary);padding:6px 10px;border-radius:4px">${this._escapeHtml(stmt.trim())}</div>` +
                    `<div style="color:var(--danger-color)">${this._escapeHtml(lastOutput.error)}</div>`
                );
                this.updateStatus(I18N.t('status.error'));
                return;
            }
        }

        if (lastOutput && lastOutput.table) {
            this.showHTMLOutput(lastOutput.table);
        } else if (lastOutput && lastOutput.message) {
            this.showHTMLOutput(`<div style="color:var(--success-color)">${this._escapeHtml(lastOutput.message)}</div>`);
        }

        // Rebuild page-to-table mapping after execution (tables may have been created)
        this._buildPageToTableMap();

        this.updateStatus(I18N.t('status.ready'));
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
            const sqlLen = mod.lengthBytesUTF8(trimmedSql) + 1;
            const sqlPtr = mod._malloc(sqlLen);
            mod.stringToUTF8(trimmedSql, sqlPtr, sqlLen);

            const errorPtrPtr = mod._malloc(4);
            mod.HEAP32[errorPtrPtr >> 2] = 0;

            // Collect results via callback
            let resultColumns = null;
            let resultRows = [];
            let hasResults = false;

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
                    row.push(valPtr === 0 ? null : mod.UTF8ToString(valPtr));
                }
                resultRows.push(row);
                return 0;
            };
            const callbackPtr = mod.addFunction(callback, 'iiiii');

            const result = mod._sqlite3_exec(this.db, sqlPtr, callbackPtr, 0, errorPtrPtr);
            mod.removeFunction(callbackPtr);
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

            return { message: I18N.t('output.success') };
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
     * Execute SQL and return raw {columns, rows} instead of HTML
     */
    _queryRaw(sql) {
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
                const errMsg = errorMsgPtr ? mod.UTF8ToString(errorMsgPtr) : 'Error ' + result;
                mod._free(errorPtrPtr);
                return { error: errMsg };
            }
            mod._free(errorPtrPtr);
            return { columns: columns || [], rows };
        } catch (e) {
            return { error: e.message };
        }
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
     * Walk up the tree to find root page for a given node
     */
    _findRootPageForNode(pageNum) {
        let current = this.visualizer.nodes.get(pageNum);
        while (current && current.parent !== null) {
            current = this.visualizer.nodes.get(current.parent);
        }
        return current ? current.page : null;
    }

    /**
     * Query actual row data for a node by rowid
     */
    queryNodeData(pageNum, rowids) {
        if (!rowids || !rowids.length) return { error: I18N.t('error.noRowids') };

        const rootPage = this._findRootPageForNode(pageNum);
        if (!rootPage) return { error: I18N.t('error.noTable', pageNum) };

        if (!this._pageToTable || !this._pageToTable.has(rootPage)) {
            return { error: I18N.t('error.unknownTable', rootPage) };
        }

        const tableName = this._pageToTable.get(rootPage);
        const rowidList = rowids.join(',');
        const sql = 'SELECT * FROM "' + tableName + '" WHERE rowid IN (' + rowidList + ')';
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
        placeholder.textContent = I18N.t('output.placeholder');
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
