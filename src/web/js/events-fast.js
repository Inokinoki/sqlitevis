/**
 * Ultra-Fast Event Manager
 * Uses virtual scrolling and aggressive batching for maximum performance
 */

class FastEventManager {
    constructor() {
        this.events = [];
        this.listeners = new Map();
        this.count = 0;

        // Virtual scrolling - only keep 20 events in DOM
        this.maxDomEvents = 20;
        this.batchSize = 5;
        this.pendingEvents = [];
        this.flushScheduled = false;

        this.names = {
            0: 'BTREE_OPEN', 1: 'BTREE_CLOSE', 2: 'BTREE_INSERT',
            3: 'BTREE_DELETE', 4: 'BTREE_SPLIT', 5: 'BTREE_BALANCE',
            6: 'PAGE_ALLOC', 7: 'PAGE_FREE',
            8: 'PARSE_START', 9: 'PARSE_TOKEN', 10: 'PARSE_COMPLETE',
            11: 'VDBE_START', 12: 'VDBE_OPCODE', 13: 'VDBE_COMPLETE'
        };

        this.categories = {
            0: 'btree', 1: 'btree', 2: 'btree', 3: 'btree', 4: 'btree',
            5: 'btree', 6: 'btree', 7: 'btree',
            8: 'parse', 9: 'parse', 10: 'parse',
            11: 'vdbe', 12: 'vdbe', 13: 'vdbe'
        };
    }

    handleEvent(type, data) {
        this.count++;

        // Skip 90% of VDBE opcodes for performance
        if (type === 12) {
            this._opcodeCounter = (this._opcodeCounter || 0) + 1;
            if (this._opcodeCounter % 10 !== 0) return;
        }

        // Only log parse and VDBE events
        const cat = this.categories[type];
        if (cat !== 'parse' && cat !== 'vdbe') return;

        let parsed;
        try {
            parsed = typeof data === 'string' ? JSON.parse(data) : data;
        } catch {
            parsed = {};
        }

        const event = {
            id: this.count,
            type: this.names[type] || 'UNKNOWN',
            category: cat,
            data: parsed,
            time: Date.now()
        };

        this.pendingEvents.push(event);

        // Flush when batch is full
        if (this.pendingEvents.length >= this.batchSize && !this.flushScheduled) {
            this.flushScheduled = true;
            requestAnimationFrame(() => this.flush());
        }
    }

    flush() {
        this.flushScheduled = false;
        if (this.pendingEvents.length === 0) return;

        const log = document.getElementById('event-log');
        if (!log) return;

        // Remove old events
        while (log.children.length >= this.maxDomEvents) {
            log.removeChild(log.firstElementChild);
        }

        // Add new events in one document fragment
        const frag = document.createDocumentFragment();
        for (const ev of this.pendingEvents) {
            const el = this.createElement(ev);
            frag.appendChild(el);
        }
        log.appendChild(frag);

        // Auto-scroll
        log.scrollTop = log.scrollHeight;

        // Update counter
        const counter = document.getElementById('event-count');
        if (counter) counter.textContent = this.count;

        // Clear pending
        this.pendingEvents = [];
    }

    createElement(ev) {
        const div = document.createElement('div');
        div.className = `event ${ev.category}`;

        const time = new Date(ev.time).toLocaleTimeString();
        const dataStr = this.formatData(ev);

        div.textContent = `[${time}] ${ev.type} ${dataStr}`;
        return div;
    }

    formatData(ev) {
        const d = ev.data;
        switch (ev.type) {
            case 'PARSE_START': return `"${d.sql || ''}"`;
            case 'PARSE_TOKEN': return `"${d.token || ''}" ${d.type || ''}`;
            case 'PARSE_COMPLETE': return d.success ? '✓' : '✗';
            case 'VDBE_START': return `${d.numOpcodes || 0} ops`;
            case 'VDBE_OPCODE': return `[${d.pc}] ${d.opcode || ''}`;
            case 'VDBE_COMPLETE': return `code=${d.resultCode || 0}`;
            default: return '';
        }
    }

    on(type, callback) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, []);
        }
        this.listeners.get(type).push(callback);
    }

    notify(ev) {
        const typelisteners = this.listeners.get(ev.type) || [];
        typelisteners.forEach(cb => {
            try { cb(ev); } catch {}
        });
    }

    clear() {
        this.events = [];
        this.count = 0;
        this.pendingEvents = [];
        const log = document.getElementById('event-log');
        if (log) log.textContent = '';
        const counter = document.getElementById('event-count');
        if (counter) counter.textContent = '0';
    }
}

const eventManager = new FastEventManager();
window.sqliteVisEventHandler = (type, data) => eventManager.handleEvent(type, data);
