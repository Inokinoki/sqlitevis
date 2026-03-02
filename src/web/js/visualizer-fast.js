/**
 * Ultra-Fast B-Tree Visualizer
 * Minimal rendering, maximum performance
 */

class FastVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.viewMode = 'btree';
        this.nodes = new Map();
        this.parseTokens = [];
        this.vdbeOpcodes = [];
        this.vdbePc = -1;
        this.currentSQL = '';
        this._drawPending = false;
        this._width = 0;
        this._height = 0;

        this.setupCanvas();
    }

    setupCanvas() {
        const resize = () => {
            const rect = this.canvas.parentElement.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
            this._width = rect.width;
            this._height = rect.height;
            this.draw();
        };

        resize();
        if (window.ResizeObserver) {
            new ResizeObserver(() => requestAnimationFrame(resize)).observe(this.canvas.parentElement);
        }
    }

    setViewMode(mode) {
        this.viewMode = mode;
        this.draw();
    }

    addNode(page, type, cells) {
        this.nodes.set(page, { page, type, cells, children: [] });
        this.requestDraw();
    }

    addChild(parentPage, childPage) {
        const parent = this.nodes.get(parentPage);
        if (parent) parent.children.push(childPage);
        this.requestDraw();
    }

    setParseTokens(tokens, sql) {
        this.parseTokens = tokens;
        this.currentSQL = sql;
        this.requestDraw();
    }

    setVdbeOpcodes(opcodes, pc) {
        this.vdbeOpcodes = opcodes;
        this.vdbePc = pc;
        this.requestDraw();
    }

    clear() {
        this.nodes.clear();
        this.parseTokens = [];
        this.vdbeOpcodes = [];
        this.vdbePc = -1;
        this.currentSQL = '';
        this.draw();
    }

    requestDraw() {
        if (!this._drawPending) {
            this._drawPending = true;
            requestAnimationFrame(() => {
                this._drawPending = false;
                this.draw();
            });
        }
    }

    draw() {
        const { ctx, _width: w, _height: h } = this;

        // Clear background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, w, h);

        if (this.viewMode === 'btree') {
            this.drawBTree();
        } else if (this.viewMode === 'parse') {
            this.drawParse();
        } else if (this.viewMode === 'vdbe') {
            this.drawVdbe();
        }
    }

    drawBTree() {
        const { ctx, _width: w, _height: h } = this;

        if (this.nodes.size === 0) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Execute a SQL query to see B-Tree structure', w/2, h/2);
            return;
        }

        // Simple layout
        const levels = [];
        const queue = [[this.nodes.get(1) || this.nodes.values().next().value, 0]];

        while (queue.length) {
            const [node, level] = queue.shift();
            if (!levels[level]) levels[level] = [];
            levels[level].push(node);
            node.children.forEach(childPage => {
                const child = this.nodes.get(childPage);
                if (child) queue.push([child, level + 1]);
            });
        }

        // Draw levels
        let y = 60;
        const nodeW = 80, nodeH = 40, gap = 20;

        levels.forEach(level => {
            const totalW = level.length * (nodeW + gap);
            let x = (w - totalW) / 2;

            level.forEach(node => {
                // Draw node
                ctx.fillStyle = node.type === 1 ? '#10b981' : '#3b82f6';
                ctx.fillRect(x, y, nodeW, nodeH);
                ctx.strokeStyle = '#e2e8f0';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, nodeW, nodeH);

                // Draw label
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`P${node.page}`, x + nodeW/2, y + 18);
                ctx.font = '10px sans-serif';
                ctx.fillText(`${node.cells.length} cells`, x + nodeW/2, y + 32);

                x += nodeW + gap;
            });

            y += 80;
        });

        // Draw title
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('B-Tree Structure', w/2, 25);
    }

    drawParse() {
        const { ctx, _width: w, _height: h } = this;

        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SQL Parse Tree', w/2, 25);

        if (!this.currentSQL) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px sans-serif';
            ctx.fillText('Execute a SQL query to see parse tree', w/2, h/2);
            return;
        }

        // Draw SQL
        ctx.fillStyle = '#94a3b8';
        ctx.font = '13px monospace';
        const maxLen = 70;
        const sql = this.currentSQL.length > maxLen
            ? this.currentSQL.slice(0, maxLen) + '...'
            : this.currentSQL;
        ctx.fillText(sql, w/2, 50);

        // Draw tokens (limited)
        const startY = 100;
        const tokenH = 25;
        const maxTokens = Math.floor((h - startY - 40) / tokenH);
        const tokensToShow = Math.min(this.parseTokens.length, maxTokens);

        ctx.font = '12px monospace';
        ctx.textAlign = 'left';

        for (let i = 0; i < tokensToShow; i++) {
            const token = this.parseTokens[i];
            const y = startY + i * tokenH;

            ctx.fillStyle = '#1e293b';
            ctx.fillRect(15, y, 200, tokenH - 2);
            ctx.fillStyle = '#38bdf8';
            ctx.fillText(`${token.token || token.text || '?'}`, 20, y + 17);
        }

        if (this.parseTokens.length > maxTokens) {
            ctx.fillStyle = '#64748b';
            ctx.font = '11px sans-serif';
            ctx.fillText(`... ${this.parseTokens.length - maxTokens} more tokens`, 20, startY + tokensToShow * tokenH + 20);
        }
    }

    drawVdbe() {
        const { ctx, _width: w, _height: h } = this;

        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('VDBE Program', w/2, 25);

        if (!this.vdbeOpcodes.length) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px sans-serif';
            ctx.fillText('Execute a SQL query to see VDBE opcodes', w/2, h/2);
            return;
        }

        // Viewport culling
        const startY = 60;
        const lineH = 22;
        const maxLines = Math.floor((h - startY - 40) / lineH);

        let startIdx = Math.max(0, this.vdbePc - maxLines / 2);
        startIdx = Math.min(startIdx, this.vdbeOpcodes.length - maxLines);
        const endIdx = Math.min(this.vdbeOpcodes.length, startIdx + maxLines);

        ctx.font = '12px monospace';
        ctx.textAlign = 'left';

        for (let i = startIdx; i < endIdx; i++) {
            const op = this.vdbeOpcodes[i];
            const y = startY + (i - startIdx) * lineH;
            const isCurrent = i === this.vdbePc;

            if (isCurrent) {
                ctx.fillStyle = '#3b82f6';
                ctx.fillRect(10, y - 2, w - 20, lineH - 2);
                ctx.fillStyle = '#fff';
            } else {
                ctx.fillStyle = '#94a3b8';
            }

            ctx.fillText(
                `[${String(op.pc).padStart(3)}] ${(op.opcode || '???').padEnd(12)} P1=${String(op.p1 ?? 0).padStart(3)} P2=${String(op.p2 ?? 0).padStart(3)}`,
                15,
                y + 15
            );
        }

        // Stats
        ctx.fillStyle = '#64748b';
        ctx.font = '11px sans-serif';
        ctx.fillText(`Total: ${this.vdbeOpcodes.length} opcodes`, 15, h - 15);
    }
}
