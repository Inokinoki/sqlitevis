/**
 * Turbo-Fast SQLite App
 * Extreme performance optimization - events off by default
 */

class TurboSQLiteApp {
    constructor() {
        this.db = null;
        this.mod = null;
        this.eventsEnabled = false;
        this.inited = false;
        this.logEl = null;
        this.countEl = null;
    }

    async init() {
        // Cache DOM elements
        this.logEl = document.getElementById('event-log');
        this.countEl = document.getElementById('event-count');

        try {
            this.setStatus('Initializing...');

            // Setup UI handlers
            document.getElementById('execute-btn').onclick = () => this.exec();
            document.getElementById('clear-btn').onclick = () => this.clear();
            document.getElementById('clear-events-btn').onclick = () => this.clearEvents();

            // Add toggle for events
            const eventsSection = document.getElementById('events-section');
            const toggle = document.createElement('label');
            toggle.innerHTML = '<input type="checkbox" id="events-toggle"> Enable Events';
            toggle.style.cssText = 'display:block;margin-bottom:0.5rem;font-size:12px;';
            eventsSection.insertBefore(toggle, this.logEl);
            document.getElementById('events-toggle').onchange = (e) => {
                this.eventsEnabled = e.target.checked;
                if (!this.eventsEnabled) this.clearEvents();
            };

            // Wait for SQLite
            await this.waitInit();
            await this.initSQLite();

            this.inited = true;
            this.setStatus('Ready');
            this.hideLoading();

        } catch (e) {
            this.setStatus('Error: ' + e.message);
            console.error(e);
        }
    }

    waitInit() {
        return new Promise((resolve, reject) => {
            if (typeof createSQLiteModule !== 'undefined') {
                resolve();
                return;
            }
            let attempts = 0;
            const maxAttempts = 200; // 10 seconds
            const check = () => {
                if (++attempts > maxAttempts) {
                    reject(new Error('SQLite module timeout'));
                    return;
                }
                if (typeof createSQLiteModule !== 'undefined') {
                    resolve();
                } else {
                    setTimeout(check, 50);
                }
            };
            check();
        });
    }

    async initSQLite() {
        const mod = await createSQLiteModule();
        this.mod = mod;

        const dbPath = ':memory:';
        const pathPtr = mod._malloc(mod.lengthBytesUTF8(dbPath) + 1);
        mod.stringToUTF8(dbPath, pathPtr, mod.lengthBytesUTF8(dbPath) + 1);

        const dbPtrPtr = mod._malloc(4);
        const rc = mod._sqlite3_open(pathPtr, dbPtrPtr);

        if (rc !== 0) {
            mod._free(pathPtr);
            mod._free(dbPtrPtr);
            throw new Error('sqlite3_open failed: ' + rc);
        }

        this.db = mod.HEAP32[dbPtrPtr >> 2];
        mod._free(pathPtr);
        mod._free(dbPtrPtr);

        // NO event handler setup - events disabled by default
    }

    exec() {
        const sql = document.getElementById('sql-input').value.trim();
        if (!sql) {
            this.out('Please enter SQL', 'error');
            return;
        }

        this.clearOutput();
        this.setStatus('Executing...');

        try {
            const sqlLen = this.mod.lengthBytesUTF8(sql) + 1;
            const sqlPtr = this.mod._malloc(sqlLen);
            this.mod.stringToUTF8(sql, sqlPtr, sqlLen);

            const errPtr = this.mod._malloc(4);
            this.mod.HEAP32[errPtr >> 2] = 0;

            const rc = this.mod._sqlite3_exec(this.db, sqlPtr, 0, 0, errPtr);

            this.mod._free(sqlPtr);

            if (rc !== 0) {
                const errPtrVal = this.mod.HEAP32[errPtr >> 2];
                if (errPtrVal) {
                    const errMsg = this.mod.UTF8ToString(errPtrVal);
                    this.out('Error: ' + errMsg, 'error');
                } else {
                    this.out('Error code: ' + rc, 'error');
                }
            } else {
                this.out('✓ Executed successfully', 'success');
            }

            this.mod._free(errPtr);
            this.setStatus('Ready');

        } catch (e) {
            this.out('Error: ' + e.message, 'error');
            this.setStatus('Error');
        }
    }

    out(msg, type = 'text') {
        const el = document.getElementById('output');
        el.textContent = msg;
        el.style.color = type === 'error' ? '#ef4444' :
                        type === 'success' ? '#10b981' : '#333';
    }

    clearOutput() {
        document.getElementById('output').textContent = '';
    }

    clear() {
        document.getElementById('sql-input').value = '';
        this.clearOutput();
    }

    clearEvents() {
        if (this.logEl) this.logEl.textContent = '';
        if (this.countEl) this.countEl.textContent = '0';
        if (typeof eventManager !== 'undefined') {
            eventManager.clear();
        }
    }

    setStatus(msg) {
        const el = document.getElementById('db-status');
        if (el) el.textContent = msg;
    }

    hideLoading() {
        const el = document.getElementById('loading');
        if (el) el.classList.add('hidden');
    }
}

// Start app when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new TurboSQLiteApp();
    app.init();
    window.app = app;
});
