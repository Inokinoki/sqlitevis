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

        // Parse tree state
        this.parseTree = null;
        this.parseTokens = [];
        this.currentSQL = '';

        // VDBE state
        this.vdbeOpcodes = [];
        this.vdbeCurrentPc = -1;

        // Track last accessed page for parent-child relationships
        this.lastAccessedPage = null;

        // Store ResizeObserver for cleanup
        this.resizeObserver = null;

        // Performance optimization: throttle canvas redraws
        this._needsRedraw = false;
        this._scheduledDraw = false;
        this._lastDrawState = null;

        // Performance optimization: cache canvas dimensions
        this._canvasWidth = 0;
        this._canvasHeight = 0;

        // Performance optimization: throttle VDBE rendering
        this._vdbeDrawPending = false;
        this._vdbeDrawScheduled = false;

        // Performance optimization: throttle parse tree rendering
        this._parseDrawPending = false;
        this._parseDrawScheduled = false;

        // Performance optimization: Cache expensive calculations
        this._layoutCache = new Map();
        this._maxCacheSize = 100;

        // Performance optimization: Skip frames if rendering is too slow
        this._frameTime = 0;
        this._targetFrameTime = 16; // 60fps target

        // SQLite token type mapping (numeric -> name)
        this.tokenTypeNames = {
            1: 'TK_ILLEGAL',
            2: 'TK_SPACE',
            3: 'TK_UNCLOSED_STRING',
            4: 'TK_COMMENT',
            5: 'TK_FUNCTION',
            6: 'TK_COLUMN',
            7: 'TK_AGG_COLUMN',
            8: 'TK_AGG_FUNCTION',
            9: 'TK_VARIABLE',
            10: 'TK_CAST',
            11: 'TK_LP',
            12: 'TK_RP',
            13: 'TK_LSQUARE',
            14: 'TK_RSQUARE',
            15: 'TK_SEMI',
            16: 'TK_TABLE',
            17: 'TK_CREATE',
            18: 'TK_IF',
            19: 'TK_NOT',
            20: 'TK_NE',
            21: 'TK_EQ',
            22: 'TK_GT',
            23: 'TK_LE',
            24: 'TK_LT',
            25: 'TK_GE',
            26: 'TK_IS',
            27: 'TK_IN',
            28: 'TK_LIKE',
            29: 'TK_GLOB',
            30: 'TK_BETWEEN',
            31: 'TK_EXISTS',
            32: 'TK_NO',
            33: 'TK_NOTNULL',
            34: 'TK_NEVER',
            35: 'TK_NULL',
            36: 'TK_ID',
            37: 'TK_OFFSET',
            38: 'TK_SELECT',
            39: 'TK_DISTINCT',
            40: 'TK_DOT',
            41: 'TK_FROM',
            42: 'TK_JOIN',
            43: 'TK_USING',
            44: 'TK_ORDER',
            45: 'TK_GROUP',
            46: 'TK_HAVING',
            47: 'TK_LIMIT',
            48: 'TK_WHERE',
            49: 'TK_THEN',
            50: 'TK_AND',
            51: 'TK_OR',
            52: 'TK_NOTHING',
            53: 'TK_COMMA',
            54: 'TK_INSERT',
            55: 'TK_DELETE',
            56: 'TK_UPDATE',
            57: 'TK_SET',
            58: 'TK_VALUES',
            59: 'TK_LIKE_OP',
            60: 'TK_ISNOT',
            61: 'TK_EXECUTE',
            62: 'TK_BEGIN',
            63: 'TK_END',
            64: 'TK_ROLLBACK',
            65: 'TK_TRANSACTION',
            66: 'TK_COMMIT',
            67: 'TK_INTO',
            68: 'TK_REPLACE',
            69: 'TK_ON',
            70: 'TK_INDEX',
            71: 'TK_ALTER',
            72: 'TK_TO',
            73: 'TK_BY',
            74: 'TK_OF',
            75: 'TK_AUTOINCR',
            76: 'TK_BLOB',
            77: 'TK_FLOAT',
            78: 'TK_INTEGER',
            79: 'TK_KEY',
            80: 'TK_CONSTRAINT',
            81: 'TK_DEFAULT',
            82: 'TK_COLLATE',
            83: 'TK_NK_SEMI',
            84: 'TK_RROW',
            85: 'TK_DEFERRED',
            86: 'TK_IMMEDIATE',
            87: 'TK_EXCLUSIVE',
            88: 'TK_CHECK',
            89: 'TK_PRIMARY',
            90: 'TK_UNIQUE',
            91: 'TK_FOREIGN',
            92: 'TK_CASCADE',
            93: 'TK_ASC',
            94: 'TK_DESC',
            95: 'TK_ATTACH',
            96: 'TK_DETACH',
            97: 'TK_EACH',
            98: 'TK_FOREACH',
            99: 'TK_MODULE',
            100: 'TK_PRAGMA',
            101: 'TK_PLUS',
            102: 'TK_MINUS',
            103: 'TK_STAR',
            104: 'TK_SLASH',
            105: 'TK_REM',
            106: 'TK_CONCAT',
            107: 'TK_BITAND',
            108: 'TK_BITOR',
            109: 'TK_LSHIFT',
            110: 'TK_RSHIFT',
            111: 'TK_BITNOT',
            112: 'TK_STRING',
            113: 'TK_JOIN_KW',
            114: 'TK_CONSTRAINT',
            115: 'TK_CHECK',
            116: 'TK_DEFAULT',
            117: 'TK_NULL',
            118: 'TK_REFERENCES',
            119: 'TK_TRIGGER',
            120: 'TK_RECURSIVE',
            121: 'TK_VACUUM',
            122: 'TK_WITH',
            123: 'TK_REINDEX',
            124: 'TK_ANALYZE',
            125: 'TK_DROP',
            126: 'TK_OFFSET',
            127: 'TK_PRAGMA'
        };

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
        this.setupIntersectionObserver();
        this.startAnimationLoop();
    }

    /**
     * Setup Intersection Observer for lazy rendering
     */
    setupIntersectionObserver() {
        // Only render when canvas is visible
        if ('IntersectionObserver' in window) {
            this._isVisible = true;
            this.intersectionObserver = new IntersectionObserver(
                (entries) => {
                    entries.forEach(entry => {
                        this._isVisible = entry.isIntersecting;

                        // Resume/pause animation loop based on visibility
                        if (this._isVisible && !this._animationRunning) {
                            this.startAnimationLoop();
                        } else if (!this._isVisible) {
                            this._animationRunning = false;
                        }
                    });
                },
                {
                    threshold: 0.1  // Trigger when 10% visible
                }
            );
            this.intersectionObserver.observe(this.canvas);
        }
    }

    /**
     * Setup canvas size and scaling with debounced resize
     */
    setupCanvas() {
        const resize = () => {
            const parent = this.canvas.parentElement;
            if (!parent) return;

            const dpr = window.devicePixelRatio || 1;

            // Get parent's dimensions
            const parentRect = parent.getBoundingClientRect();
            const width = parentRect.width;
            const height = parentRect.height;

            // Set canvas display size
            this.canvas.style.width = width + 'px';
            this.canvas.style.height = height + 'px';

            // Set canvas internal size (for drawing)
            this.canvas.width = width * dpr;
            this.canvas.height = height * dpr;

            // Scale for retina displays
            this.ctx.scale(dpr, dpr);

            // Redraw after resize
            this.drawImmediate();
        };

        // Debounce function to limit resize calls
        const debounce = (fn, delay) => {
            let timeoutId;
            return (...args) => {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => fn.apply(this, args), delay);
            };
        };

        // Initial sizing
        resize();

        // Debounced resize handler (150ms delay)
        const debouncedResize = debounce(resize, 150);

        // Watch for window resize
        window.addEventListener('resize', debouncedResize);

        // Watch for container size changes with debouncing
        this.resizeObserver = new ResizeObserver(debouncedResize);
        this.resizeObserver.observe(this.canvas.parentElement);
    }

    /**
     * Cleanup method to disconnect observers and prevent memory leaks
     */
    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
            this.intersectionObserver = null;
        }
        this._animationRunning = false;
    }

    /**
     * Bind mouse events for interaction with throttled updates and passive listeners
     */
    bindEvents() {
        // Throttled node info update with debouncing
        let lastNode = null;
        let updateScheduled = false;
        let updateTimeout = null;

        // Use passive listener for better scroll/touch performance
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const node = this.getNodeAtPosition(x, y);

            // Only update if node changed
            if (node !== lastNode) {
                lastNode = node;

                if (node) {
                    this.canvas.style.cursor = 'pointer';

                    // Debounce DOM updates to prevent excessive reflows
                    if (updateTimeout) {
                        clearTimeout(updateTimeout);
                    }
                    updateTimeout = setTimeout(() => {
                        if (!updateScheduled) {
                            updateScheduled = true;
                            requestAnimationFrame(() => {
                                this.showNodeInfo(node);
                                updateScheduled = false;
                            });
                        }
                    }, 50); // 50ms debounce
                } else {
                    this.hideNodeInfo();
                    this.canvas.style.cursor = 'crosshair';
                }
            }
        }, { passive: true });

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
     * @param {number} pageNum - Page number
     * @param {number} pageType - Page type (0=interior, 1=leaf)
     * @param {number|null} parentPage - Parent page number (optional)
     */
    addPage(pageNum, pageType, parentPage = null) {
        const node = {
            page: pageNum,
            type: pageType, // 0: interior, 1: leaf
            cells: [],
            parent: parentPage,
            children: [],
            x: 0,
            y: 0,
            expanded: true
        };

        this.nodes.set(pageNum, node);

        // If we have a parent, add this page as a child
        if (parentPage !== null) {
            const parentNode = this.nodes.get(parentPage);
            if (parentNode && !parentNode.children.includes(pageNum)) {
                parentNode.children.push(pageNum);
            }
        }

        // Track this as the last accessed page
        this.lastAccessedPage = pageNum;

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

        // Track this as the last accessed page
        this.lastAccessedPage = pageNum;

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
     * When a page splits, the new page is a sibling of the original
     * (they share the same parent)
     */
    splitPage(originalPage, newPage, splitCell) {
        const original = this.nodes.get(originalPage);
        if (!original) return;

        // Create new page with the same parent as the original
        // This establishes the proper sibling relationship
        this.addPage(newPage, original.type, original.parent);
        const newNode = this.nodes.get(newPage);

        // Move cells
        const cellsToMove = original.cells.splice(splitCell);
        newNode.cells = cellsToMove;

        // If the original had a parent, make sure the new page is also a child
        if (original.parent !== null) {
            const parentNode = this.nodes.get(original.parent);
            if (parentNode && !parentNode.children.includes(newPage)) {
                parentNode.children.push(newPage);
            }
        }

        // Animation
        if (this.showTransitions) {
            this.animateSplit(originalPage, newPage, splitCell);
        }

        this.layout();
        this.draw();
    }

    /**
     * Calculate layout positions for all nodes (with caching)
     */
    layout() {
        if (this.nodes.size === 0) return;

        // Check cache
        const cacheKey = Array.from(this.nodes.keys()).sort().join('-');
        if (this._layoutCache.has(cacheKey)) {
            const cached = this._layoutCache.get(cacheKey);
            // Apply cached positions
            cached.forEach((pos, pageNum) => {
                const node = this.nodes.get(pageNum);
                if (node) {
                    node.x = pos.x;
                    node.y = pos.y;
                }
            });
            return;
        }

        const root = this.nodes.get(this.rootPage);
        if (!root) return;

        // Simple tree layout algorithm
        const levels = this.buildLevels(root);
        let currentY = 50;

        const layoutMap = new Map();

        levels.forEach((levelNodes, level) => {
            const totalWidth = levelNodes.length * (this.nodeWidth + this.horizontalSpacing);
            const canvasWidth = this.canvas.clientWidth;
            let currentX = (canvasWidth - totalWidth) / 2;

            levelNodes.forEach(node => {
                node.x = currentX;
                node.y = currentY;
                layoutMap.set(node.page, { x: currentX, y: currentY });
                currentX += this.nodeWidth + this.horizontalSpacing;
            });

            currentY += this.levelHeight;
        });

        // Cache the layout
        if (this._layoutCache.size >= this._maxCacheSize) {
            // Clear oldest entry
            const firstKey = this._layoutCache.keys().next().value;
            this._layoutCache.delete(firstKey);
        }
        this._layoutCache.set(cacheKey, layoutMap);
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
     * Main draw function with requestAnimationFrame batching and state checking
     */
    draw() {
        // Create state hash to check if redraw is needed
        const currentState = this._createStateHash();
        if (currentState === this._lastDrawState && !this._needsRedraw) {
            return; // Skip redraw if nothing changed
        }
        this._lastDrawState = currentState;

        // Schedule redraw instead of immediate draw
        if (this._scheduledDraw) {
            this._needsRedraw = true;
            return;
        }

        this._scheduledDraw = true;
        this._needsRedraw = false;

        requestAnimationFrame(() => {
            this._performDraw();

            // If another draw was requested during this render, schedule it
            if (this._needsRedraw) {
                this._needsRedraw = false;
                this._lastDrawState = this._createStateHash();
                requestAnimationFrame(() => this._performDraw());
            } else {
                this._scheduledDraw = false;
            }
        });
    }

    /**
     * Create a hash of current visual state to detect changes
     */
    _createStateHash() {
        if (this.viewMode === 'btree') {
            return `btree-${this.nodes.size}-${Array.from(this.nodes.keys()).join('-')}-${Array.from(this.highlightedNodes).join('-')}`;
        } else if (this.viewMode === 'parse') {
            return `parse-${this.parseTokens.length}-${this.currentSQL}`;
        } else if (this.viewMode === 'vdbe') {
            return `vdbe-${this.vdbeOpcodes.length}-${this.vdbeCurrentPc}`;
        }
        return this.viewMode;
    }

    /**
     * Internal draw implementation
     */
    _performDraw() {
        const rect = this.canvas.getBoundingClientRect();

        // Cache dimensions to avoid repeated getBoundingClientRect calls
        if (this._canvasWidth !== rect.width || this._canvasHeight !== rect.height) {
            this._canvasWidth = rect.width;
            this._canvasHeight = rect.height;
        }

        this.ctx.clearRect(0, 0, this._canvasWidth, this._canvasHeight);

        // Draw background
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this._canvasWidth, this._canvasHeight);

        // Draw connections first
        this.nodes.forEach(node => {
            this.drawConnections(node);
        });

        // Draw nodes
        this.nodes.forEach(node => {
            this.drawNode(node);
        });

        // Update page count (throttled)
        if (!this._pageCountThrottled) {
            this._pageCountThrottled = true;
            requestAnimationFrame(() => {
                const pageCountEl = document.getElementById('page-count');
                if (pageCountEl) {
                    pageCountEl.textContent = this.nodes.size;
                }
                this._pageCountThrottled = false;
            });
        }
    }

    /**
     * Immediate draw (skip batching for critical updates)
     */
    drawImmediate() {
        this._scheduledDraw = false;
        this._needsRedraw = false;
        this._performDraw();
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
     * Show node information panel (optimized - caches DOM elements)
     */
    showNodeInfo(node) {
        const infoPanel = document.getElementById('node-info');
        if (!infoPanel) return;

        infoPanel.classList.remove('hidden');

        const detailsDiv = document.getElementById('node-details');
        if (!detailsDiv) return;

        // Use textContent for better performance (avoid innerHTML)
        // Create structure once, then update
        if (!this._nodeInfoCache) {
            this._nodeInfoCache = {
                dl: document.createElement('dl'),
                dtPage: document.createElement('dt'),
                ddPage: document.createElement('dd'),
                dtType: document.createElement('dt'),
                ddType: document.createElement('dd'),
                dtCells: document.createElement('dt'),
                ddCells: document.createElement('dd'),
                dtChildren: document.createElement('dt'),
                ddChildren: document.createElement('dd'),
                cellDiv: document.createElement('div'),
                cellTitle: document.createElement('strong')
            };

            // Set static labels
            this._nodeInfoCache.dtPage.textContent = 'Page Number:';
            this._nodeInfoCache.dtType.textContent = 'Type:';
            this._nodeInfoCache.dtCells.textContent = 'Cells:';
            this._nodeInfoCache.dtChildren.textContent = 'Children:';
            this._nodeInfoCache.cellTitle.textContent = 'Cells:';

            // Build structure
            const dl = this._nodeInfoCache.dl;
            dl.appendChild(this._nodeInfoCache.dtPage);
            dl.appendChild(this._nodeInfoCache.ddPage);
            dl.appendChild(this._nodeInfoCache.dtType);
            dl.appendChild(this._nodeInfoCache.ddType);
            dl.appendChild(this._nodeInfoCache.dtCells);
            dl.appendChild(this._nodeInfoCache.ddCells);
            dl.appendChild(this._nodeInfoCache.dtChildren);
            dl.appendChild(this._nodeInfoCache.ddChildren);

            const cellDiv = this._nodeInfoCache.cellDiv;
            cellDiv.style.marginTop = '10px';
            cellDiv.appendChild(this._nodeInfoCache.cellTitle);

            detailsDiv.innerHTML = '';
            detailsDiv.appendChild(dl);
            detailsDiv.appendChild(cellDiv);
        }

        // Update values (much faster than innerHTML)
        this._nodeInfoCache.ddPage.textContent = node.page;
        this._nodeInfoCache.ddType.textContent = node.type === 1 ? 'Leaf' : 'Interior';
        this._nodeInfoCache.ddCells.textContent = node.cells.length;
        this._nodeInfoCache.ddChildren.textContent = node.children.length;

        // Update cells
        const cellDiv = this._nodeInfoCache.cellDiv;
        // Remove old cell entries (keep title)
        while (cellDiv.children.length > 1) {
            cellDiv.removeChild(cellDiv.lastChild);
        }

        if (node.cells.length > 0) {
            // Only show first 10 cells to prevent DOM overload
            const maxCells = Math.min(node.cells.length, 10);
            for (let i = 0; i < maxCells; i++) {
                const c = node.cells[i];
                const cellDiv = document.createElement('div');
                cellDiv.textContent = `Cell ${c.idx}: ${c.key} (${c.keyLen} bytes)`;
                this._nodeInfoCache.cellDiv.appendChild(cellDiv);
            }
            if (node.cells.length > 10) {
                const moreDiv = document.createElement('div');
                moreDiv.textContent = `... and ${node.cells.length - 10} more`;
                moreDiv.style.fontStyle = 'italic';
                this._nodeInfoCache.cellDiv.appendChild(moreDiv);
            }
        } else {
            const noCells = document.createElement('em');
            noCells.textContent = 'No cells';
            this._nodeInfoCache.cellDiv.appendChild(noCells);
        }
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
     * Animation loop with visibility check
     */
    startAnimationLoop() {
        if (this._animationRunning) return;

        this._animationRunning = true;
        const animate = () => {
            // Stop if not visible (IntersectionObserver will restart)
            if (!this._isVisible) {
                this._animationRunning = false;
                return;
            }

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

            if (this._animationRunning) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    /**
     * Clear all visualization
     */
    clear() {
        this.nodes.clear();
        this.parseTokens = [];
        this.currentSQL = '';
        this.vdbeOpcodes = [];
        this.vdbeCurrentPc = -1;
        this.animations = [];
        this.highlightedNodes.clear();
        this.draw();
    }

    /**
     * Set view mode
     */
    setViewMode(mode) {
        this.viewMode = mode;

        // Render the appropriate view
        if (mode === 'parse') {
            this.drawParseTree(true);  // true = waiting for SQL
        } else if (mode === 'vdbe') {
            this.drawVdbeList('Idle', 'Execute SQL to see VDBE execution');
        } else {
            // B-tree mode
            this.draw();
        }
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

    /**
     * Show parse tree visualization
     */
    showParseStart(sql) {
        if (this.viewMode !== 'parse') return;

        // Initialize parse tree
        this.currentSQL = sql;
        this.parseTokens = [];
        this.parseTree = this.buildParseTree(sql);
        this.drawParseTree(false);  // false = not waiting, has SQL
    }

    /**
     * Show parse token (with batched rendering for performance)
     */
    showParseToken(token, type) {
        if (this.viewMode !== 'parse') return;

        // Validate inputs
        if (token === null || token === undefined) {
            console.warn('Invalid token value:', token);
            token = '';
        }

        if (typeof token !== 'string') {
            console.warn('Token is not a string:', typeof token);
            token = String(token);
        }

        // Truncate very long tokens to prevent rendering issues
        const MAX_TOKEN_LENGTH = 100;
        if (token.length > MAX_TOKEN_LENGTH) {
            token = token.substring(0, MAX_TOKEN_LENGTH) + '...';
        }

        // Convert numeric type to readable name
        const typeName = this.tokenTypeNames[type] || `TK_${type}`;

        // Add token to list
        this.parseTokens.push({ token, type: typeName });

        // Batch rendering for performance - only draw periodically
        this._parseDrawPending = true;
        if (!this._parseDrawScheduled) {
            this._parseDrawScheduled = true;
            requestAnimationFrame(() => {
                if (this._parseDrawPending) {
                    this.drawParseTree(false);
                    this._parseDrawPending = false;
                }
                this._parseDrawScheduled = false;
            });
        }
    }

    /**
     * Show parse complete
     */
    showParseComplete(success) {
        if (this.viewMode !== 'parse') return;

        // Finalize parse tree
        this.drawParseTree(false);  // false = not waiting, has SQL
    }

    /**
     * Build a simple parse tree from SQL
     */
    buildParseTree(sql) {
        // Simple SQL parser for visualization
        const tokens = this.tokenizeSQL(sql);
        const tree = {
            type: 'statement',
            text: sql,
            children: []
        };

        let current = tree;
        let depth = 0;

        for (const token of tokens) {
            if (token.type === 'keyword') {
                if (['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER'].includes(token.text)) {
                    const node = {
                        type: 'command',
                        text: token.text,
                        children: []
                    };
                    tree.children.push(node);
                    current = node;
                }
            } else if (token.type === 'identifier' || token.type === 'table') {
                if (current) {
                    current.children.push({
                        type: 'identifier',
                        text: token.text,
                        children: []
                    });
                }
            }
        }

        return tree;
    }

    /**
     * Tokenize SQL for visualization
     */
    tokenizeSQL(sql) {
        const tokens = [];
        const keywords = ['SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'DROP', 'ALTER', 'INDEX', 'AND', 'OR', 'NOT', 'NULL'];
        const regex = /(\w+)|([\(\),;])/g;
        let match;

        while ((match = regex.exec(sql)) !== null) {
            const text = match[0];
            const type = keywords.includes(text.toUpperCase()) ? 'keyword' :
                        text.match(/[A-Za-z_]\w*/) ? 'identifier' : 'symbol';
            tokens.push({ text, type });
        }

        return tokens;
    }

    /**
     * Draw parse tree visualization
     */
    drawParseTree(waiting = false) {
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, rect.width, rect.height);

        // Draw title
        this.ctx.fillStyle = this.colors.text;
        this.ctx.font = 'bold 16px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('SQL Parse Tree', rect.width / 2, 30);

        // Show waiting message if no SQL yet
        if (waiting || !this.currentSQL) {
            this.ctx.font = '14px sans-serif';
            this.ctx.fillStyle = this.colors.textLight;
            this.ctx.fillText('Execute a SQL query to see its parse tree structure', rect.width / 2, rect.height / 2 - 20);

            this.ctx.font = '13px monospace';
            this.ctx.fillStyle = '#94a3b8';
            this.ctx.fillText('Example: SELECT id, name FROM users;', rect.width / 2, rect.height / 2 + 20);
            return;
        }

        // Draw SQL
        this.ctx.font = '14px monospace';
        this.ctx.fillStyle = this.colors.textLight;
        this.ctx.fillText(this.currentSQL || 'No SQL', rect.width / 2, 60);

        // Draw tree
        if (this.parseTree) {
            this.drawTreeNode(this.parseTree, rect.width / 2, 100, 0);
        }

        // Draw tokens
        if (this.parseTokens.length > 0) {
            this.drawParseTokens();
        }

        // Draw status
        this.ctx.font = '12px sans-serif';
        this.ctx.fillStyle = '#10b981';
        this.ctx.fillText('Parse Complete', rect.width / 2, rect.height - 20);
    }

    /**
     * Draw tree node recursively
     */
    drawTreeNode(node, x, y, depth) {
        const nodeSize = 40;
        const levelGap = 80;

        // Draw connections to children
        if (node.children && node.children.length > 0) {
            const childWidth = (node.children.length - 1) * 100;
            let startX = x - childWidth / 2;

            node.children.forEach((child, i) => {
                const childX = startX + i * 100;
                const childY = y + levelGap;

                // Draw connection line
                this.ctx.strokeStyle = this.colors.connection;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(x, y + nodeSize / 2);
                this.ctx.lineTo(childX, childY - nodeSize / 2);
                this.ctx.stroke();

                // Recursively draw child
                this.drawTreeNode(child, childX, childY, depth + 1);
            });
        }

        // Draw node
        const color = node.type === 'command' ? this.colors.nodeInternal :
                     node.type === 'identifier' ? this.colors.nodeLeaf :
                     this.colors.node;

        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(x, y, nodeSize / 2, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.strokeStyle = this.colors.border;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw label
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 11px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(node.text.substring(0, 8), x, y);
    }

    /**
     * Draw parse tokens list with lazy rendering (only visible tokens)
     */
    drawParseTokens() {
        const rect = this.canvas.getBoundingClientRect();
        const startY = 400;
        const tokenWidth = 150;
        const tokenHeight = 30;

        this.ctx.fillStyle = this.colors.textLight;
        this.ctx.font = '12px sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Tokens (${this.parseTokens.length}):`, 20, startY);

        // Only render visible tokens to improve performance
        const availableHeight = this._canvasHeight - startY - 60;
        const maxVisibleTokens = Math.floor(availableHeight / (tokenHeight + 5));
        const tokensToRender = Math.min(this.parseTokens.length, maxVisibleTokens);

        // Use a single fillStyle for all backgrounds of the same type
        const keywordColor = this.colors.nodeInternal;
        const identifierColor = this.colors.nodeLeaf;
        const defaultColor = this.colors.background;

        for (let i = 0; i < tokensToRender; i++) {
            const token = this.parseTokens[i];
            const x = 20;
            const y = startY + 30 + i * (tokenHeight + 5);

            // Token background
            const color = token.type === 'keyword' ? keywordColor :
                         token.type === 'identifier' ? identifierColor :
                         defaultColor;

            this.ctx.fillStyle = color;
            this.ctx.fillRect(x, y, tokenWidth, tokenHeight);

            this.ctx.strokeStyle = this.colors.border;
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x, y, tokenWidth, tokenHeight);

            // Token text
            this.ctx.fillStyle = 'white';
            this.ctx.font = '11px monospace';
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(`${token.token} (${token.type})`, x + 10, y + tokenHeight / 2);
        }

        // Show indicator if there are more tokens
        if (this.parseTokens.length > tokensToRender) {
            this.ctx.fillStyle = this.colors.textSecondary;
            this.ctx.font = '10px sans-serif';
            this.ctx.fillText(`... and ${this.parseTokens.length - tokensToRender} more tokens`, 20, startY + 30 + tokensToRender * (tokenHeight + 5));
        }
    }

    /**
     * Show VDBE execution start
     */
    showVdbeStart(numOpcodes) {
        if (this.viewMode === 'vdbe') {
            this.vdbeOpcodes = [];
            this.vdbeCurrentPc = -1;
            this.drawVdbeList('Program starting', `Expected ${numOpcodes} opcodes`);
        }
    }

    /**
     * Show VDBE opcode execution (with batched rendering for performance)
     */
    showVdbeOpcode(pc, opcode, p1, p2, p3) {
        if (this.viewMode !== 'vdbe') return;

        // Validate inputs
        if (typeof pc !== 'number' || pc < 0) {
            console.warn('Invalid program counter:', pc);
            return;
        }

        if (typeof opcode !== 'string') {
            console.warn('Invalid opcode name:', opcode);
            opcode = 'Unknown';
        }

        // Store or update opcode at this position
        this.vdbeOpcodes[pc] = {
            pc: pc,
            opcode: opcode,
            p1: p1 !== undefined ? p1 : 0,
            p2: p2 !== undefined ? p2 : 0,
            p3: p3 !== undefined ? p3 : 0
        };
        this.vdbeCurrentPc = pc;

        // Batch rendering for performance - only draw periodically
        this._vdbeDrawPending = true;
        if (!this._vdbeDrawScheduled) {
            this._vdbeDrawScheduled = true;
            requestAnimationFrame(() => {
                if (this._vdbeDrawPending) {
                    this.drawVdbeList('Executing', `Opcode ${this.vdbeCurrentPc + 1} of ${this.vdbeOpcodes.length}`);
                    this._vdbeDrawPending = false;
                }
                this._vdbeDrawScheduled = false;
            });
        }
    }

    /**
     * Show VDBE execution complete
     */
    showVdbeComplete(resultCode) {
        if (this.viewMode === 'vdbe') {
            this.drawVdbeList('Complete', `Result code: ${resultCode}`);
        }
    }

    /**
     * Draw VDBE opcode list with current execution highlighted (optimized)
     */
    drawVdbeList(state, info) {
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this._canvasWidth, this._canvasHeight);

        // Draw title and state
        this.ctx.fillStyle = this.colors.text;
        this.ctx.font = 'bold 16px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('VDBE Program Execution', this._canvasWidth / 2, 30);
        this.ctx.font = '14px sans-serif';
        this.ctx.fillText(`${state} - ${info}`, this._canvasWidth / 2, 55);

        // Only render visible opcodes to improve performance
        const startY = 90;
        const lineHeight = 28;
        const availableHeight = this._canvasHeight - startY - 40;
        const maxVisibleOpcodes = Math.floor(availableHeight / lineHeight);

        // Calculate scroll position (center on current instruction if possible)
        let scrollOffset = 0;
        if (this.vdbeCurrentPc >= maxVisibleOpcodes) {
            scrollOffset = this.vdbeCurrentPc - Math.floor(maxVisibleOpcodes / 2);
        }

        const startIndex = Math.max(0, scrollOffset);
        const endIndex = Math.min(this.vdbeOpcodes.length, startIndex + maxVisibleOpcodes);

        // Draw visible opcodes
        for (let i = startIndex; i < endIndex; i++) {
            const op = this.vdbeOpcodes[i];
            if (!op) continue;

            const y = startY + (i - startIndex) * lineHeight;
            const isCurrent = i === this.vdbeCurrentPc;

            // Highlight current instruction
            if (isCurrent) {
                this.ctx.fillStyle = this.colors.nodeHighlight;
                this.ctx.fillRect(30, y - 5, Math.min(500, this._canvasWidth - 60), lineHeight - 2);
            }

            // Draw opcode
            this.ctx.fillStyle = isCurrent ? 'white' : this.colors.text;
            this.ctx.font = '13px monospace';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(
                `[${op.pc}] ${op.opcode.padEnd(12)} P1=${String(op.p1).padStart(3)} P2=${String(op.p2).padStart(3)} P3=${String(op.p3).padStart(3)}`,
                40,
                y + 12
            );
        }

        // Show instruction count and scroll indicator
        this.ctx.fillStyle = this.colors.textLight;
        this.ctx.font = '12px sans-serif';
        this.ctx.textAlign = 'left';
        const countText = `Total opcodes: ${this.vdbeOpcodes.length}`;
        const scrollText = endIndex < this.vdbeOpcodes.length ? ` (showing ${startIndex + 1}-${endIndex})` : '';
        this.ctx.fillText(countText + scrollText, 30, this._canvasHeight - 20);
    }
}
