/**
 * Turbo-Fast Event Manager
 * Only logs when explicitly enabled, maximum performance when disabled
 */

class TurboEventManager {
    constructor() {
        this.enabled = false;
        this.count = 0;
        this.logEl = null;
        this.countEl = null;
        this.pending = [];
        this.maxEvents = 10; // Even fewer for turbo mode
        this.scheduled = false;
    }

    enable() {
        this.enabled = true;
        this.logEl = document.getElementById('event-log');
        this.countEl = document.getElementById('event-count');
    }

    disable() {
        this.enabled = false;
        this.clear();
    }

    handleEvent(type, data) {
        this.count++;

        // Fast path - completely skip if disabled
        if (!this.enabled) return;

        // Skip 95% of VDBE opcodes (even more aggressive)
        if (type === 12) {
            this._opcodeCounter = (this._opcodeCounter || 0) + 1;
            if (this._opcodeCounter % 20 !== 0) return;
        }

        // Only show parse events (skip VDBE too for max speed)
        if (type !== 8 && type !== 9 && type !== 10) return;

        let parsed;
        try {
            parsed = typeof data === 'string' ? JSON.parse(data) : data;
        } catch {
            parsed = {};
        }

        const names = {
            8: 'PARSE', 9: 'TOKEN', 10: 'DONE'
        };

        this.pending.push({
            type: names[type] || 'EVENT',
            data: parsed,
            time: Date.now()
        });

        // Batch flush
        if (this.pending.length >= 3 && !this.scheduled) {
            this.scheduled = true;
            requestAnimationFrame(() => this.flush());
        }
    }

    flush() {
        this.scheduled = false;
        if (!this.enabled || this.pending.length === 0 || !this.logEl) return;

        // Trim to max 10 events
        while (this.logEl.children.length >= this.maxEvents) {
            this.logEl.removeChild(this.logEl.firstElementChild);
        }

        // Add all pending
        const frag = document.createDocumentFragment();
        for (const ev of this.pending) {
            const div = document.createElement('div');
            div.className = 'event parse';
            div.textContent = this.format(ev);
            frag.appendChild(div);
        }
        this.logEl.appendChild(frag);

        // Scroll
        this.logEl.scrollTop = this.logEl.scrollHeight;

        // Update count
        if (this.countEl) this.countEl.textContent = this.count;

        this.pending = [];
    }

    format(ev) {
        const t = new Date(ev.time).toLocaleTimeString();
        const d = ev.data;
        if (ev.type === 'PARSE') return `[${t}] ${ev.type} "${d.sql || ''}"`;
        if (ev.type === 'TOKEN') return `[${t}] ${ev.type} "${d.token || ''}"`;
        return `[${t}] ${ev.type}`;
    }

    clear() {
        this.pending = [];
        if (this.logEl) this.logEl.textContent = '';
        if (this.countEl) this.countEl.textContent = '0';
    }
}

const eventManager = new TurboEventManager();

// Setup handler that checks enabled state
window.sqliteVisEventHandler = (type, data) => {
    eventManager.handleEvent(type, data);
};
