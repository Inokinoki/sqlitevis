/**
 * B-Tree Visualizer
 * Renders SQLite B-tree structures on canvas with animations
 */

class BTreeVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        // State
        this.nodes = new Map(); // page_num -> node data
        this.rootPage = 1;
        this.pageSize = 4096;
        this.viewMode = 'btree'; // 'btree', 'parse', 'vdbe'
        this.showTransitions = true;
        this.animationSpeed = 1.0;

        // Animation state
        this.animations = [];
        this.highlightedNodes = new Set();

        // Layout
        this.nodeWidth = 120;
        this.nodeHeight = 60;
        this.levelHeight = 120;
        this.horizontalSpacing = 40;

        // Colors
        this.colors = {
            node: '#3b82f6',
            nodeLeaf: '#10b981',
            nodeInternal: '#8b5cf6',
            nodeHighlight: '#f59e0b',
            text: '#1e293b',
            textLight: '#64748b',
            border: '#cbd5e1',
            connection: '#94a3b8',
            background: '#f8fafc'
        };

        this.setupCanvas();
        this.bindEvents();
        this.startAnimationLoop();
    }

    /**
     * Setup canvas size and scaling
     */
    setupCanvas() {
        const resize = () => {
            const rect = this.canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;

            // Use actual container size (CSS will constrain it)
            const width = rect.width;
            const height = rect.height;

            this.canvas.width = width * dpr;
            this.canvas.height = height * dpr;

            this.ctx.scale(dpr, dpr);
            this.canvas.style.width = width + 'px';
            this.canvas.style.height = height + 'px';

            this.draw();
        };

        window.addEventListener('resize', resize);
        resize();
    }

    /**
     * Bind mouse events for interaction
     */
    bindEvents() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const node = this.getNodeAtPosition(x, y);
            if (node) {
                this.showNodeInfo(node);
                this.canvas.style.cursor = 'pointer';
            } else {
                this.hideNodeInfo();
                this.canvas.style.cursor = 'crosshair';
            }
        });

        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const node = this.getNodeAtPosition(x, y);
            if (node) {
                this.toggleNodeExpansion(node);
            }
        });
    }

    /**
     * Handle B-tree page allocation
     */
    addPage(pageNum, pageType) {
        const node = {
            page: pageNum,
            type: pageType, // 0: interior, 1: leaf
            cells: [],
            parent: null,
            children: [],
            x: 0,
            y: 0,
            expanded: true
        };

        this.nodes.set(pageNum, node);
        this.layout();
        this.draw();
    }

    /**
     * Handle cell insertion
     */
    addCell(pageNum, cellIdx, keyLen) {
        const node = this.nodes.get(pageNum);
        if (!node) return;

        const cell = {
            idx: cellIdx,
            keyLen: keyLen,
            key: `Key${cellIdx}`
        };

        node.cells.splice(cellIdx, 0, cell);

        // Animation
        if (this.showTransitions) {
            this.animateInsertion(pageNum, cellIdx);
        }

        this.layout();
        this.draw();
    }

    /**
     * Handle cell deletion
     */
    deleteCell(pageNum, cellIdx) {
        const node = this.nodes.get(pageNum);
        if (!node) return;

        if (this.showTransitions) {
            this.animateDeletion(pageNum, cellIdx);
        }

        node.cells.splice(cellIdx, 1);
        this.layout();
        this.draw();
    }

    /**
     * Handle page split
     */
    splitPage(originalPage, newPage, splitCell) {
        const original = this.nodes.get(originalPage);
        if (!original) return;

        // Create new page
        this.addPage(newPage, original.type);
        const newNode = this.nodes.get(newPage);

        // Move cells
        const cellsToMove = original.cells.splice(splitCell);
        newNode.cells = cellsToMove;

        // Animation
        if (this.showTransitions) {
            this.animateSplit(originalPage, newPage, splitCell);
        }

        this.layout();
        this.draw();
    }

    /**
     * Calculate layout positions for all nodes
     */
    layout() {
        if (this.nodes.size === 0) return;

        const root = this.nodes.get(this.rootPage);
        if (!root) return;

        // Simple tree layout algorithm
        const levels = this.buildLevels(root);
        let currentY = 50;

        levels.forEach((levelNodes, level) => {
            const totalWidth = levelNodes.length * (this.nodeWidth + this.horizontalSpacing);
            const canvasWidth = this.canvas.clientWidth;
            let currentX = (canvasWidth - totalWidth) / 2;

            levelNodes.forEach(node => {
                node.x = currentX;
                node.y = currentY;
                currentX += this.nodeWidth + this.horizontalSpacing;
            });

            currentY += this.levelHeight;
        });
    }

    /**
     * Build level-order array of nodes
     */
    buildLevels(root) {
        const levels = [];
        const queue = [[root, 0]];

        while (queue.length > 0) {
            const [node, level] = queue.shift();

            if (!levels[level]) {
                levels[level] = [];
            }
            levels[level].push(node);

            node.children.forEach(childPage => {
                const child = this.nodes.get(childPage);
                if (child) {
                    queue.push([child, level + 1]);
                }
            });
        }

        return levels;
    }

    /**
     * Main draw function
     */
    draw() {
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.clearRect(0, 0, rect.width, rect.height);

        // Draw background
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, rect.width, rect.height);

        // Draw connections first
        this.nodes.forEach(node => {
            this.drawConnections(node);
        });

        // Draw nodes
        this.nodes.forEach(node => {
            this.drawNode(node);
        });

        // Update page count
        document.getElementById('page-count').textContent = this.nodes.size;
    }

    /**
     * Draw connections between nodes
     */
    drawConnections(node) {
        node.children.forEach(childPage => {
            const child = this.nodes.get(childPage);
            if (!child) return;

            this.ctx.strokeStyle = this.colors.connection;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(
                node.x + this.nodeWidth / 2,
                node.y + this.nodeHeight
            );
            this.ctx.lineTo(
                child.x + this.nodeWidth / 2,
                child.y
            );
            this.ctx.stroke();
        });
    }

    /**
     * Draw a single node
     */
    drawNode(node) {
        const isHighlighted = this.highlightedNodes.has(node.page);
        const isLeaf = node.type === 1;

        // Node background
        this.ctx.fillStyle = isHighlighted
            ? this.colors.nodeHighlight
            : (isLeaf ? this.colors.nodeLeaf : this.colors.nodeInternal);

        this.ctx.strokeStyle = this.colors.border;
        this.ctx.lineWidth = 2;

        this.roundRect(node.x, node.y, this.nodeWidth, this.nodeHeight, 8);
        this.ctx.fill();
        this.ctx.stroke();

        // Page number
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 12px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(
            `Page ${node.page}`,
            node.x + this.nodeWidth / 2,
            node.y + 20
        );

        // Type label
        this.ctx.font = '10px sans-serif';
        this.ctx.fillText(
            isLeaf ? 'LEAF' : 'INTERIOR',
            node.x + this.nodeWidth / 2,
            node.y + 35
        );

        // Cell count
        this.ctx.fillText(
            `${node.cells.length} cells`,
            node.x + this.nodeWidth / 2,
            node.y + 50
        );
    }

    /**
     * Helper to draw rounded rectangle
     */
    roundRect(x, y, width, height, radius) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();
    }

    /**
     * Get node at mouse position
     */
    getNodeAtPosition(x, y) {
        for (const node of this.nodes.values()) {
            if (x >= node.x && x <= node.x + this.nodeWidth &&
                y >= node.y && y <= node.y + this.nodeHeight) {
                return node;
            }
        }
        return null;
    }

    /**
     * Show node information panel
     */
    showNodeInfo(node) {
        const infoPanel = document.getElementById('node-info');
        const detailsDiv = document.getElementById('node-details');

        const cellsHtml = node.cells.map(c =>
            `<div>Cell ${c.idx}: ${c.key} (${c.keyLen} bytes)</div>`
        ).join('');

        detailsDiv.innerHTML = `
            <dl>
                <dt>Page Number:</dt><dd>${node.page}</dd>
                <dt>Type:</dt><dd>${node.type === 1 ? 'Leaf' : 'Interior'}</dd>
                <dt>Cells:</dt><dd>${node.cells.length}</dd>
                <dt>Children:</dt><dd>${node.children.length}</dd>
            </dl>
            <div style="margin-top: 10px;">
                <strong>Cells:</strong>
                ${cellsHtml || '<em>No cells</em>'}
            </div>
        `;

        infoPanel.classList.remove('hidden');
    }

    /**
     * Hide node information panel
     */
    hideNodeInfo() {
        const infoPanel = document.getElementById('node-info');
        infoPanel.classList.add('hidden');
    }

    /**
     * Toggle node expansion
     */
    toggleNodeExpansion(node) {
        node.expanded = !node.expanded;
        this.layout();
        this.draw();
    }

    /**
     * Animate insertion
     */
    animateInsertion(pageNum, cellIdx) {
        this.highlightedNodes.add(pageNum);
        setTimeout(() => {
            this.highlightedNodes.delete(pageNum);
            this.draw();
        }, 500 / this.animationSpeed);
    }

    /**
     * Animate deletion
     */
    animateDeletion(pageNum, cellIdx) {
        this.highlightedNodes.add(pageNum);
        setTimeout(() => {
            this.highlightedNodes.delete(pageNum);
            this.draw();
        }, 500 / this.animationSpeed);
    }

    /**
     * Animate split
     */
    animateSplit(originalPage, newPage, splitCell) {
        this.highlightedNodes.add(originalPage);
        this.highlightedNodes.add(newPage);

        setTimeout(() => {
            this.highlightedNodes.delete(originalPage);
            this.highlightedNodes.delete(newPage);
            this.draw();
        }, 1000 / this.animationSpeed);
    }

    /**
     * Animation loop
     */
    startAnimationLoop() {
        const animate = () => {
            // Process animations
            this.animations = this.animations.filter(anim => {
                anim.progress += 0.016 * this.animationSpeed; // ~60fps
                if (anim.progress >= 1) {
                    if (anim.onComplete) anim.onComplete();
                    return false;
                }
                return true;
            });

            if (this.animations.length > 0) {
                this.draw();
            }

            requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
    }

    /**
     * Clear all visualization
     */
    clear() {
        this.nodes.clear();
        this.animations = [];
        this.highlightedNodes.clear();
        this.draw();
    }

    /**
     * Set view mode
     */
    setViewMode(mode) {
        this.viewMode = mode;
        this.draw();
    }

    /**
     * Set animation speed
     */
    setAnimationSpeed(speed) {
        this.animationSpeed = speed;
    }

    /**
     * Toggle transitions
     */
    setShowTransitions(show) {
        this.showTransitions = show;
    }
}
