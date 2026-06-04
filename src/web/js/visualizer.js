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
        this._resetVdbeState();

        // Callback for querying actual row data from main.js
        this.onQueryNodeData = null; // async (pageNum, rowids) => { columns, rows } or { error }

        // Store ResizeObserver for cleanup
        this.resizeObserver = null;

        // Performance optimization: throttle canvas redraws
        this._needsRedraw = false;
        this._scheduledDraw = false;

        // Canvas dimensions read fresh each frame (clientWidth/Height is cheap)

        // Performance optimization: throttle VDBE rendering
        this._vdbeDrawScheduled = false;
        this._vdbeRafId = null;
        this._opcodeCount = 0;

        // Performance optimization: Cache expensive calculations
        this._layoutCache = new Map();

        // SQLite token type mapping (numeric -> name)
        // Layout
        this.nodeWidth = 120;
        this.nodeHeight = 40;
        this.levelHeight = 80;
        this.horizontalSpacing = 30;

        // AST node type colors (class-level constant)
        this._astColorMap = {
            'SELECT': '#7c3aed',
            'INSERT': '#2563eb',
            'CREATE': '#0891b2',
            'UPDATE': '#d97706',
            'DELETE': '#dc2626',
            'SQL': '#334155',
        };

        // SQL clause boundary keywords (used by parser)
        this._clauseBoundaries = ['WHERE', 'ORDER', 'LIMIT', 'GROUP', 'HAVING'];
        this._joinBoundaries = ['JOIN', 'LEFT', 'RIGHT', 'INNER', 'CROSS'];
        this._postFromBoundaries = [...this._clauseBoundaries, ...this._joinBoundaries];

        // AST node clause types (for rendering)
        this._astClauseTypes = new Set(['columns', 'from', 'from_clause', 'where', 'values', 'set', 'table',
            'group_by', 'order_by', 'limit', 'modifier', 'join', 'on', 'having']);

        // SQL keywords for tokenization (Set for O(1) lookup)
        this._sqlKeywords = new Set(['SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
            'CREATE', 'TABLE', 'DROP', 'ALTER', 'INDEX', 'AND', 'OR', 'NOT', 'NULL', 'INTEGER', 'TEXT',
            'PRIMARY', 'KEY', 'REAL', 'INT', 'VARCHAR', 'CHAR', 'BLOB', 'IF', 'EXISTS', 'UNIQUE',
            'ORDER', 'BY', 'ASC', 'DESC', 'LIMIT', 'OFFSET', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
            'ON', 'AS', 'DISTINCT', 'GROUP', 'HAVING', 'UNION', 'ALL', 'LIKE', 'BETWEEN', 'IS', 'IN']);

        // Pan & zoom state
        this._panX = 0;
        this._panY = 0;
        this._zoom = 1;
        this._isDragging = false;
        this._dragStartX = 0;
        this._dragStartY = 0;
        this._dragStartPanX = 0;
        this._dragStartPanY = 0;
        this._dragMoved = false;

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
        // Default to visible; IntersectionObserver updates when available
        this._isVisible = true;
        if ('IntersectionObserver' in window) {
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
            const dpr = window.devicePixelRatio || 1;

            // Use canvas's own CSS layout size (set by flex), not parent.
            // Using parent.getBoundingClientRect() causes infinite growth:
            // canvas.style.height = parent.height → parent grows → canvas grows → ...
            const width = this.canvas.clientWidth;
            const height = this.canvas.clientHeight;

            // Skip if dimensions haven't changed
            if (this.canvas.width === Math.round(width * dpr) &&
                this.canvas.height === Math.round(height * dpr)) return;

            // Set canvas internal size (for drawing) — this resets context state
            this.canvas.width = Math.round(width * dpr);
            this.canvas.height = Math.round(height * dpr);

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
        this._debouncedResize = debounce(resize, 150);

        // Watch for window resize
        window.addEventListener('resize', this._debouncedResize);

        // Watch for container size changes with debouncing
        this.resizeObserver = new ResizeObserver(this._debouncedResize);
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
        if (this._debouncedResize) {
            window.removeEventListener('resize', this._debouncedResize);
            this._debouncedResize = null;
        }
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
            this.intersectionObserver = null;
        }
        // Remove window event listeners added in bindEvents
        if (this._windowMousemoveHandler) {
            window.removeEventListener('mousemove', this._windowMousemoveHandler);
            this._windowMousemoveHandler = null;
        }
        if (this._windowMouseupHandler) {
            window.removeEventListener('mouseup', this._windowMouseupHandler);
            this._windowMouseupHandler = null;
        }
        this._animationRunning = false;
    }

    /**
     * Convert screen coordinates to world coordinates (accounts for pan/zoom)
     */
    _screenToWorld(sx, sy) {
        return {
            x: (sx - this._panX) / this._zoom,
            y: (sy - this._panY) / this._zoom
        };
    }

    /**
     * Schedule layout recalculation and draw (deduped via rAF)
     */
    _scheduleLayoutAndDraw() {
        if (!this._layoutScheduled) {
            this._layoutScheduled = true;
            requestAnimationFrame(() => {
                this.layout();
                this._layoutScheduled = false;
            });
        }
        this.draw();
    }

    /** Clear canvas and fill with background color */
    _clearCanvas(width, height) {
        this.ctx.clearRect(0, 0, width, height);
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, width, height);
    }

    /** Apply pan/zoom transform (call ctx.restore() when done) */
    _applyTransform() {
        this.ctx.save();
        this.ctx.translate(this._panX, this._panY);
        this.ctx.scale(this._zoom, this._zoom);
    }

    /** Draw centered title at y=12 and subtitle at y=30 */
    _drawTitle(title, subtitle, width) {
        this.ctx.fillStyle = this.colors.text;
        this.ctx.font = 'bold 13px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(title, width / 2, 12);
        if (subtitle) {
            this.ctx.fillStyle = this.colors.textLight;
            this.ctx.font = '11px sans-serif';
            this.ctx.fillText(subtitle, width / 2, 30);
        }
    }

    /** Create an AST node object */
    _node(type, text, children = []) {
        return { type, text, children };
    }

    /** Join token texts with separator */
    _tokensText(tokens, sep = ' ') {
        return tokens.map(c => c.text).join(sep);
    }

    /** Reset VDBE execution state */
    _resetVdbeState() {
        this.vdbeCurrentPc = -1;
        this.vdbeStepIndex = -1;
        this._opcodeCount = 0;
    }

    /** Get dense (non-null) opcode list from sparse vdbeOpcodes array */
    _getDenseOpcodes() {
        return this.vdbeOpcodes.filter(o => o);
    }

    /**
     * Compute display label for an AST node (single source of truth)
     */
    _astLabel(node) {
        return node.type === node.text ? node.type :
               node.text.length > 30 ? node.type + ': ' + node.text.substring(0, 27) + '...' :
               node.type + ': ' + node.text;
    }

    /**
     * Brief flash highlight on pages (unified animation helper)
     */
    _flashHighlight(pages, durationMs) {
        if (!this.showTransitions) return;
        for (const p of pages) this.highlightedNodes.add(p);
        this.draw(); // immediate draw to show highlight

        // Use single timeout — clear all highlights at once
        clearTimeout(this._flashTimeout);
        this._flashTimeout = setTimeout(() => {
            this.highlightedNodes.clear();
            this.draw();
        }, durationMs);
    }

    /**
     * Bind mouse events for interaction with throttled updates and passive listeners
     */
    bindEvents() {
        // Throttled node info update with debouncing
        let lastNode = null;
        let updateScheduled = false;
        let updateTimeout = null;

        // --- Pan (drag) ---
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // left button
                this._isDragging = true;
                this._dragMoved = false;
                this._dragStartX = e.clientX;
                this._dragStartY = e.clientY;
                this._dragStartPanX = this._panX;
                this._dragStartPanY = this._panY;
                this.canvas.style.cursor = 'grabbing';
            }
        });

        this._windowMousemoveHandler = (e) => {
            if (!this._isDragging) return;
            const dx = e.clientX - this._dragStartX;
            const dy = e.clientY - this._dragStartY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this._dragMoved = true;
            this._panX = this._dragStartPanX + dx;
            this._panY = this._dragStartPanY + dy;
            this.draw(); // throttled via rAF instead of drawImmediate()
        };
        window.addEventListener('mousemove', this._windowMousemoveHandler);

        this._windowMouseupHandler = () => {
            if (this._isDragging) {
                this._isDragging = false;
                this.canvas.style.cursor = 'crosshair';
            }
        };
        window.addEventListener('mouseup', this._windowMouseupHandler);

        // --- Zoom (scroll wheel) ---
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;

            const oldZoom = this._zoom;
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this._zoom = Math.max(0.2, Math.min(5, this._zoom * delta));

            // Zoom toward mouse position
            this._panX = mx - (mx - this._panX) * (this._zoom / oldZoom);
            this._panY = my - (my - this._panY) * (this._zoom / oldZoom);

            this.drawImmediate();
        }, { passive: false });

        // --- Hover (mousemove) ---
        this.canvas.addEventListener('mousemove', (e) => {
            if (this._isDragging) return;

            const rect = this.canvas.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            const { x, y } = this._screenToWorld(sx, sy);

            const node = this.getNodeAtPosition(x, y);

            if (node !== lastNode) {
                lastNode = node;

                if (node) {
                    this.canvas.style.cursor = 'pointer';

                    if (updateTimeout) clearTimeout(updateTimeout);
                    updateTimeout = setTimeout(() => {
                        if (!updateScheduled) {
                            updateScheduled = true;
                            requestAnimationFrame(() => {
                                this.showNodeInfo(node);
                                updateScheduled = false;
                            });
                        }
                    }, 50);
                } else {
                    this.hideNodeInfo();
                    this.canvas.style.cursor = 'crosshair';
                }
            }
        }, { passive: true });

        // --- Click ---
        this.canvas.addEventListener('click', (e) => {
            if (this._dragMoved) return; // was a drag, not a click

            const rect = this.canvas.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            const { x, y } = this._screenToWorld(sx, sy);

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
        // Filter out invalid page numbers from misdirected events
        if (pageNum === null || pageNum === undefined || isNaN(pageNum) || !isFinite(pageNum)) return;
        // Page 0 is not valid in SQLite (pages are 1-indexed)
        const validParent = (parentPage !== null && parentPage > 0) ? parentPage : null;

        // Don't overwrite existing node (preserves cells, children, etc.)
        const existing = this.nodes.get(pageNum);
        if (existing) {
            // Update parent if provided and not set
            if (validParent !== null && existing.parent === null) {
                existing.parent = validParent;
                this._linkChild(validParent, pageNum);
            }
            this.draw();
            return;
        }

        const node = {
            page: pageNum,
            type: pageType, // 0: interior, 1: leaf
            cells: [],
            parent: validParent,
            children: [],
            x: 0,
            y: 0,
            expanded: true
        };

        this.nodes.set(pageNum, node);

        // If we have a parent, add this page as a child
        if (validParent !== null) {
            this._linkChild(validParent, pageNum);
        }

        // Batch layout and draw calls
        this._scheduleLayoutAndDraw();
    }

    /**
     * Register child in parent's children list (idempotent)
     */
    _linkChild(parentPage, childPage) {
        const parent = this.nodes.get(parentPage);
        if (parent && !parent.children.includes(childPage)) {
            parent.children.push(childPage);
        }
    }

    /**
     * Remove a page from the tree
     */
    removePage(pageNum) {
        const node = this.nodes.get(pageNum);
        if (node) {
            // Unlink from parent's children list
            if (node.parent !== null) {
                const parent = this.nodes.get(node.parent);
                if (parent) {
                    const idx = parent.children.indexOf(pageNum);
                    if (idx >= 0) parent.children.splice(idx, 1);
                }
            }
        }
        this.nodes.delete(pageNum);
        this._layoutCache.clear();
        this._scheduleLayoutAndDraw();
    }

    /**
     * Walk up the tree to find root page for a given node
     */
    findRootPage(pageNum) {
        let current = this.nodes.get(pageNum);
        let steps = 0;
        const maxSteps = this.nodes.size + 1;
        while (current && current.parent !== null && steps < maxSteps) {
            current = this.nodes.get(current.parent);
            steps++;
        }
        return current ? current.page : null;
    }

    /**
     * Handle cell insertion
     */
    addCell(pageNum, cellIdx, keyLen) {
        let node = this.nodes.get(pageNum);
        if (!node) {
            // Auto-create page node if not yet allocated (PAGE_ALLOCATE may have fired before JS connected)
            this.addPage(pageNum, 1);
            node = this.nodes.get(pageNum);
            if (!node) return; // guard: addPage may reject invalid pageNum
        }

        // Bounds-check cellIdx to prevent splice from wrong position
        if (cellIdx < 0) cellIdx = 0;

        const cell = {
            idx: cellIdx,
            keyLen: keyLen,
            key: String(keyLen) // For intkey tables, nKey IS the rowid value
        };

        node.cells.splice(cellIdx, 0, cell);

        // Animation
        if (this.showTransitions) {
            this.animateInsertion(pageNum, cellIdx);
        }

        this._scheduleLayoutAndDraw();
    }

    /**
     * Handle cell deletion
     */
    deleteCell(pageNum, cellIdx) {
        const node = this.nodes.get(pageNum);
        if (!node) return;

        // Bounds-check: ignore invalid indices
        if (cellIdx < 0 || cellIdx >= node.cells.length) return;

        if (this.showTransitions) {
            this.animateDeletion(pageNum, cellIdx);
        }

        node.cells.splice(cellIdx, 1);

        this._scheduleLayoutAndDraw();
    }

    /**
     * Handle page split
     * When a page splits, the new page is a sibling of the original
     * (they share the same parent)
     */
    splitPage(originalPage, newPage, splitCell, splitType = 1) {
        const original = this.nodes.get(originalPage);

        if (splitType === 2) {
            // balance_deeper: root page splits, tree grows one level deeper.
            // originalPage (root) becomes interior node, newPage gets old content.
            // originalPage.children now includes newPage.
            const oldCells = original ? original.cells.slice() : [];
            const oldType = original ? original.type : 1;
            if (original) {
                original.cells = [];
                original.type = 0; // interior
                this._linkChild(originalPage, newPage);
            }
            // Create the child page that holds the old root content
            this.addPage(newPage, oldType, originalPage);
            const newChild = this.nodes.get(newPage);
            if (newChild) newChild.cells = oldCells;
        } else {
            // balance_quick: sibling split. New page is a sibling of original.
            if (!original) return;
            this.addPage(newPage, original.type, original.parent);
            const newNode = this.nodes.get(newPage);

            // Move cells from split point onward
            if (!newNode) return;
            const splitIdx = Math.max(0, Math.min(splitCell || 0, original.cells.length));
            const cellsToMove = original.cells.splice(splitIdx);
            newNode.cells = cellsToMove;

            // Add new page as sibling (same parent)
            if (original.parent !== null) {
                this._linkChild(original.parent, newPage);
            }
        }

        // Animation
        if (this.showTransitions) {
            this.animateSplit(originalPage, newPage, splitCell);
        }

        this._scheduleLayoutAndDraw();
    }

    /**
     * Calculate layout positions for all nodes (with caching)
     */
    layout() {
        if (this.nodes.size === 0) return;

        // Check cache (key includes parent-child structure, not just page numbers)
        const parts = [];
        this.nodes.forEach((n, p) => {
            parts.push(`${p}:${n.type}:${n.parent}:${n.children.join(',')}:${n.cells.length}`);
        });
        const cacheKey = parts.sort().join('|');
        if (this._layoutCache.has(cacheKey)) {
            const cached = this._layoutCache.get(cacheKey);
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

        // Check if we have parent-child relationships
        const hasChildren = [...this.nodes.values()].some(n => n.children && n.children.length > 0);

        let layoutMap = new Map();

        if (root && hasChildren) {
            // Tree layout for structured B-tree data
            const levels = this.buildLevels(root);
            let currentY = 50;

            levels.forEach((levelNodes) => {
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
        } else {
            // Flat grid layout for isolated page nodes (no parent-child links)
            const nodes = [...this.nodes.values()];
            const canvasWidth = this.canvas.clientWidth;
            const cols = Math.max(1, Math.min(nodes.length, Math.floor(canvasWidth / (this.nodeWidth + this.horizontalSpacing))));
            const totalWidth = cols * (this.nodeWidth + this.horizontalSpacing) - this.horizontalSpacing;
            const startX = (canvasWidth - totalWidth) / 2;

            nodes.forEach((node, i) => {
                const col = i % cols;
                const row = Math.floor(i / cols);
                node.x = startX + col * (this.nodeWidth + this.horizontalSpacing);
                node.y = 50 + row * this.levelHeight;
                layoutMap.set(node.page, { x: node.x, y: node.y });
            });
        }

        // Evict oldest entry if cache is full (max 50 entries)
        if (this._layoutCache.size >= 50) {
            this._layoutCache.delete(this._layoutCache.keys().next().value);
        }
        this._layoutCache.set(cacheKey, layoutMap);
    }

    /**
     * Build level-order array of nodes
     */
    buildLevels(root) {
        const levels = [];
        const queue = [[root, 0]];
        const visited = new Set();
        let i = 0;

        while (i < queue.length) {
            const [node, level] = queue[i++];

            if (visited.has(node.page)) continue;
            visited.add(node.page);

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
                requestAnimationFrame(() => this._performDraw());
            } else {
                this._scheduledDraw = false;
            }
        });
    }

    /**
     * Internal draw implementation - HIGHLY OPTIMIZED
     */
    _performDraw() {
        const startTime = performance.now();

        // Dispatch to the correct view renderer
        if (this.viewMode === 'parse') {
            this.drawParseTree(!this.currentSQL);
            return;
        }
        if (this.viewMode === 'vdbe') {
            const denseOps = this._getDenseOpcodes();
            if (denseOps.length > 0) {
                this.drawVdbeList('Complete', `Total opcodes: ${denseOps.length}`);
            } else {
                this.drawVdbeList('Idle', 'Execute SQL to see VDBE execution');
            }
            return;
        }

        const w = this.canvas.clientWidth;
        const h = this.canvas.clientHeight;

        // Clear canvas
        this._clearCanvas(w, h);

        // Early exit if no nodes to draw in btree mode
        if (this.viewMode === 'btree' && this.nodes.size === 0) {
            const renderTime = performance.now() - startTime;
            if (typeof perfMonitor !== 'undefined') {
                perfMonitor.recordFrame(renderTime);
            }
            return;
        }

        // Apply pan/zoom transform
        this._applyTransform();

        // Batch all stroke/fillStyle changes to minimize context state changes
        // Draw all connections first (same color/style)
        this.ctx.strokeStyle = this.colors.connection;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();

        const connectionsToDraw = [];

        this.nodes.forEach(node => {
            node.children.forEach(childPage => {
                const child = this.nodes.get(childPage);
                if (child) {
                    connectionsToDraw.push([node, child]);
                }
            });
        });

        // Draw all connections in a single path
        connectionsToDraw.forEach(([node, child]) => {
            this.ctx.moveTo(
                node.x + this.nodeWidth / 2,
                node.y + this.nodeHeight
            );
            this.ctx.lineTo(
                child.x + this.nodeWidth / 2,
                child.y
            );
        });
        this.ctx.stroke();

        // Pre-calculate colors to minimize property access
        const nodeLeafColor = this.colors.nodeLeaf;
        const nodeInternalColor = this.colors.nodeInternal;
        const nodeHighlightColor = this.colors.nodeHighlight;
        const borderColor = this.colors.border;

        // Draw nodes - batch by color to minimize fillStyle changes
        const leafNodes = [];
        const internalNodes = [];
        const highlightedNodes = [];

        this.nodes.forEach(node => {
            if (this.highlightedNodes.has(node.page)) {
                highlightedNodes.push(node);
            } else if (node.type === 1) {
                leafNodes.push(node);
            } else {
                internalNodes.push(node);
            }
        });

        // Determine node info
        const getNodeInfo = (node) => {
            const isLeaf = node.type === 1;
            const typeLabel = isLeaf ? 'LEAF' : 'INT';
            const accentColor = this.highlightedNodes.has(node.page) ? nodeHighlightColor : (isLeaf ? nodeLeafColor : nodeInternalColor);
            return { isLeaf, typeLabel, accentColor };
        };

        // Compact node sizing (headerH + bodyH must equal this.nodeHeight)
        const headerH = 22;
        const bodyH = this.nodeHeight - headerH;

        // Draw a single compact node
        const drawRichNode = (node) => {
            const info = getNodeInfo(node);
            const x = node.x;
            const y = node.y;
            const w = this.nodeWidth;
            const h = this.nodeHeight;
            const pad = 6;

            // Shadow
            this.ctx.save();
            this.ctx.shadowColor = 'rgba(0,0,0,0.08)';
            this.ctx.shadowBlur = 4;
            this.ctx.shadowOffsetY = 1;
            this.roundRect(x, y, w, h, 5);
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fill();
            this.ctx.restore();

            // Header bar (rounded top)
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.moveTo(x + 5, y);
            this.ctx.lineTo(x + w - 5, y);
            this.ctx.quadraticCurveTo(x + w, y, x + w, y + 5);
            this.ctx.lineTo(x + w, y + headerH);
            this.ctx.lineTo(x, y + headerH);
            this.ctx.lineTo(x, y + 5);
            this.ctx.quadraticCurveTo(x, y, x + 5, y);
            this.ctx.closePath();
            this.ctx.fillStyle = info.accentColor;
            this.ctx.fill();
            this.ctx.restore();

            // Border
            this.roundRect(x, y, w, h, 5);
            this.ctx.strokeStyle = '#e2e8f0';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();

            // Header: "Page N · LEAF/INT"
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 10px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(`P${node.page} ${info.typeLabel}`, x + w / 2, y + headerH / 2);

            // Body: compact key range + count
            const cy = y + headerH + bodyH / 2;
            const cellCount = node.cells.length;
            if (cellCount > 0) {
                const keys = node.cells.map(c => parseInt(c.key)).filter(k => !isNaN(k)).sort((a, b) => a - b);
                if (keys.length > 0) {
                    this.ctx.fillStyle = '#334155';
                    this.ctx.font = '9px monospace';
                    this.ctx.textAlign = 'left';
                    this.ctx.fillText(`${keys[0]}..${keys[keys.length - 1]}`, x + pad, cy);
                    this.ctx.fillStyle = '#94a3b8';
                    this.ctx.textAlign = 'right';
                    this.ctx.fillText(`${cellCount}`, x + w - pad, cy);
                }
            } else {
                this.ctx.fillStyle = '#94a3b8';
                this.ctx.font = '9px sans-serif';
                this.ctx.textAlign = 'center';
                const label = node.parent !== null && node.parent !== undefined ? 'after split' : 'empty';
                this.ctx.fillText(label, x + w / 2, cy);
            }
        };

        // Draw all nodes (highlighted drawn last so they render on top)
        internalNodes.forEach(n => drawRichNode(n));
        leafNodes.forEach(n => drawRichNode(n));
        highlightedNodes.forEach(n => drawRichNode(n));

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

        // Restore pan/zoom transform
        this.ctx.restore();

        // Record frame to performance monitor
        if (typeof perfMonitor !== 'undefined') {
            perfMonitor.recordFrame(performance.now() - startTime);
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

        // Add "View Row Data" button for leaf nodes with cells
        if (node.type === 1 && node.cells.length > 0 && this.onQueryNodeData) {
            const btn = document.createElement('button');
            btn.textContent = 'View Row Data';
            btn.className = 'btn-view-data';
            btn.onclick = async () => {
                btn.textContent = 'Loading...';
                btn.disabled = true;
                const rowids = node.cells.map(c => c.key);
                try {
                    const result = await this.onQueryNodeData(node.page, rowids);
                    this.showNodeData(node, result);
                } catch (e) {
                    this.showNodeData(node, { error: e.message });
                }
                btn.textContent = 'View Row Data';
                btn.disabled = false;
            };
            this._nodeInfoCache.cellDiv.appendChild(btn);
        }

        // Clear any previous data display
        const existingData = document.getElementById('node-data');
        if (existingData) existingData.remove();
    }

    /**
     * Show actual row data for a node (queried from SQLite)
     */
    showNodeData(node, result) {
        const detailsDiv = document.getElementById('node-details');
        if (!detailsDiv) return;

        let dataDiv = document.getElementById('node-data');
        if (!dataDiv) {
            dataDiv = document.createElement('div');
            dataDiv.id = 'node-data';
            detailsDiv.appendChild(dataDiv);
        }

        if (result.error) {
            dataDiv.innerHTML = '<div style="color:var(--danger-color);margin-top:8px">' +
                escapeHtml(result.error) + '</div>';
            return;
        }

        if (!result.columns || !result.rows || result.rows.length === 0) {
            dataDiv.innerHTML = '<div style="color:var(--text-secondary);margin-top:8px;font-style:italic">No rows found</div>';
            return;
        }

        dataDiv.innerHTML = buildTableHtml(result.columns, result.rows, 'node-data-table');
    }

    /**
     * Hide node information panel
     */
    hideNodeInfo() {
        const infoPanel = document.getElementById('node-info');
        if (infoPanel) infoPanel.classList.add('hidden');
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
     * Animate insertion - SIMPLIFIED for performance
     * Uses minimal highlighting instead of full animation
     */
    animateInsertion(pageNum, cellIdx) {
        this._flashHighlight([pageNum], 200);
    }

    /**
     * Animate deletion - SIMPLIFIED for performance
     */
    animateDeletion(pageNum, cellIdx) {
        this._flashHighlight([pageNum], 200);
    }

    /**
     * Animate split - SIMPLIFIED for performance
     */
    animateSplit(originalPage, newPage, splitCell) {
        this._flashHighlight([originalPage, newPage], 300);
    }

    /**
     * Animation loop - OPTIMIZED: Only runs when there are active animations
     * This is CRITICAL for performance - no continuous loops!
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
            const hadAnimations = this.animations.length > 0;
            this.animations = this.animations.filter(anim => {
                anim.progress += 0.016 * this.animationSpeed; // ~60fps
                if (anim.progress >= 1) {
                    if (anim.onComplete) anim.onComplete();
                    return false;
                }
                return true;
            });

            // Draw only if we have animations
            if (this.animations.length > 0) {
                this.draw();
            }

            // CRITICAL: Stop the loop if no more animations
            // This prevents continuous rendering and saves CPU/battery
            if (this.animations.length === 0) {
                this._animationRunning = false;
                return;
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
        this.rootPage = 1;
        this.parseTokens = [];
        this.currentSQL = '';
        this.parseTree = null;
        this.vdbeOpcodes = [];
        this._resetVdbeState();
        if (this._vdbeRafId !== null) {
            cancelAnimationFrame(this._vdbeRafId);
            this._vdbeRafId = null;
        }
        this._vdbeDrawScheduled = false;
        this.animations = [];
        this.highlightedNodes.clear();
        clearTimeout(this._flashTimeout);
        this._layoutCache.clear();
        // Invalidate node info cache (DOM refs may be stale after clear)
        this._nodeInfoCache = null;
        // Reset pan/zoom
        this._panX = 0;
        this._panY = 0;
        this._zoom = 1;
        // Hide VDBE controls
        const vdbeCtrl = document.getElementById('vdbe-controls');
        if (vdbeCtrl) vdbeCtrl.classList.add('hidden');
        const vdbeInfo = document.getElementById('vdbe-step-info');
        if (vdbeInfo) vdbeInfo.textContent = '';
        this.draw();
    }

    /**
     * Set view mode
     */
    setViewMode(mode) {
        this.viewMode = mode;

        // Toggle VDBE step controls visibility
        const denseOps = this._getDenseOpcodes();
        const vdbeCtrl = document.getElementById('vdbe-controls');
        if (vdbeCtrl) {
            if (mode === 'vdbe' && denseOps.length > 0) {
                vdbeCtrl.classList.remove('hidden');
            } else {
                vdbeCtrl.classList.add('hidden');
            }
        }

        // Render the appropriate view
        if (mode === 'parse') {
            this.drawParseTree(!this.currentSQL);  // only show waiting if no SQL data
        } else if (mode === 'vdbe') {
            if (denseOps.length > 0) {
                this.drawVdbeList('Complete', `Total opcodes: ${denseOps.length}`);
            } else {
                this.drawVdbeList('Idle', 'Execute SQL to see VDBE execution');
            }
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
     * Step through VDBE opcodes one at a time
     * @param {number} direction - 1 for forward, -1 for backward, 0 for reset
     */
    stepVdbe(direction) {
        // Compute validPcs once for reuse (from dense opcodes)
        const denseOps = this._getDenseOpcodes();
        const validPcs = denseOps.map(o => o.pc);
        if (validPcs.length === 0) return;

        if (direction === 0) {
            // Reset
            this.vdbeStepIndex = -1;
        } else {
            if (this.vdbeStepIndex < 0) {
                // Not started yet — begin from first or last
                this.vdbeStepIndex = direction > 0 ? validPcs[0] : validPcs[validPcs.length - 1];
            } else {
                const currentPos = validPcs.indexOf(this.vdbeStepIndex);
                if (currentPos < 0) {
                    this.vdbeStepIndex = validPcs[0];
                } else {
                    const newPos = currentPos + direction;
                    if (newPos < 0 || newPos >= validPcs.length) return; // at boundary
                    this.vdbeStepIndex = validPcs[newPos];
                }
            }
        }

        // Update step info text
        const pos = validPcs.indexOf(this.vdbeStepIndex) + 1;
        const info = document.getElementById('vdbe-step-info');
        if (info) {
            if (this.vdbeStepIndex < 0) {
                info.textContent = '';
            } else {
                const op = this.vdbeOpcodes[this.vdbeStepIndex];
                if (op) {
                    info.textContent = `Step ${pos}/${validPcs.length}: [${op.pc}] ${op.opcode}`;
                }
            }
        }

        // Redraw with step highlight
        this.drawVdbeList('Stepping', this.vdbeStepIndex >= 0
            ? `Opcode ${pos} of ${validPcs.length}` : 'Ready');
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
        // Skip if called with empty/undefined SQL from WASM events
        // (the app already calls this directly with the actual SQL)
        if (!sql || typeof sql !== 'string' || sql.trim() === '') {
            if (this.viewMode === 'parse' && this.currentSQL) {
                this.drawParseTree(false);
            }
            return;
        }

        // Accumulate parse tree across statements (don't reset if same batch)
        this.currentSQL = sql;
        this.parseTokens = [];
        this.parseTree = this.buildParseTree(sql);

        // Generate tokens from the same tokenization used by buildParseTree
        // (buildParseTree caches them in this._lastTokens)
        if (this._lastTokens) {
            for (const t of this._lastTokens) {
                this.parseTokens.push({ token: t.text, type: t.type });
            }
        }

        if (this.viewMode === 'parse') {
            this.drawParseTree(false);
        }
    }

    /**
     * Show parse complete
     */
    showParseComplete(success) {
        // Always update state regardless of view mode
        if (this.viewMode === 'parse') {
            this.drawParseTree(false);
        }
    }

    /**
     * Build a proper AST from SQL for visualization
     * Handles SELECT, INSERT, CREATE TABLE, UPDATE, DELETE
     */
    buildParseTree(sql) {
        const tokens = this.tokenizeSQL(sql);
        this._lastTokens = tokens; // cache for showParseStart to avoid double tokenization
        if (tokens.length === 0) return { type: 'root', text: sql, children: [] };

        // Simple recursive descent parser
        let pos = 0;
        const peek = () => tokens[pos];
        const advance = () => tokens[pos++];
        const expectKeyword = (kw) => {
            const t = peek();
            if (t && t.type === 'keyword' && t.text.toUpperCase() === kw) return advance();
            return null;
        };
        const isKeyword = (kw) => peek() && peek().type === 'keyword' && peek().text.toUpperCase() === kw;

        // Collect tokens until a boundary keyword or semicolon (respects parenthesis depth)
        const collectUntil = (stopWords) => {
            const items = [];
            let parenDepth = 0;
            while (pos < tokens.length) {
                const t = peek();
                if (!t) break;
                if (t.text === ';') break;  // always stop at semicolons
                if (t.text === '(') {
                    parenDepth++;
                } else if (t.text === ')') {
                    if (parenDepth === 0) break; // closing paren we didn't open — stop before it
                    parenDepth--;
                } else if (parenDepth === 0 && t.type === 'keyword' && stopWords.some(w => t.text.toUpperCase() === w)) {
                    break;
                }
                advance();
                items.push(t);
            }
            return items;
        };

        const parseSelect = () => {
            advance(); // SELECT
            const node = this._node('SELECT', 'SELECT');

            // DISTINCT?
            if (isKeyword('DISTINCT')) {
                node.children.push(this._node('modifier', 'DISTINCT'));
                advance();
            }

            // Columns
            const cols = collectUntil(['FROM', 'WHERE', 'ORDER', 'LIMIT', 'GROUP', 'HAVING']);
            if (cols.length > 0) {
                node.children.push(this._node('columns', this._tokensText(cols)));
            }

            // FROM + JOINs as a nested group
            if (isKeyword('FROM')) {
                advance();
                const fromNode = this._node('from_clause', 'FROM');
                const CB = this._postFromBoundaries;
                const JB = this._joinBoundaries;

                const fromItems = collectUntil([...CB, 'ON']);
                fromNode.children.push(this._node('from', this._tokensText(fromItems)));

                // Handle JOINs as children of FROM
                while (pos < tokens.length && JB.some(kw => isKeyword(kw))) {
                    const joinParts = [];
                    while (pos < tokens.length && [...JB, 'OUTER', 'JOIN'].some(kw => isKeyword(kw))) {
                        joinParts.push(advance().text.toUpperCase());
                    }
                    const joinType = joinParts.includes('LEFT') ? 'LEFT JOIN' :
                                     joinParts.includes('RIGHT') ? 'RIGHT JOIN' :
                                     joinParts.includes('INNER') ? 'INNER JOIN' :
                                     joinParts.includes('CROSS') ? 'CROSS JOIN' : 'JOIN';

                    const joinTableItems = collectUntil(['ON', ...CB]);
                    const joinNode = this._node('join', joinType + ' ' + this._tokensText(joinTableItems));

                    // ON condition as child of join
                    if (isKeyword('ON')) {
                        advance();
                        const onItems = collectUntil(CB);
                        joinNode.children.push(this._node('on', this._tokensText(onItems)));
                    }
                    fromNode.children.push(joinNode);
                }
                node.children.push(fromNode);
            }

            // WHERE
            if (isKeyword('WHERE')) {
                advance();
                const whereItems = collectUntil(this._clauseBoundaries);
                node.children.push(this._node('where', this._tokensText(whereItems)));
            }

            // GROUP BY
            if (isKeyword('GROUP')) {
                advance(); // GROUP
                if (isKeyword('BY')) advance(); // BY (optional, defensive)
                const items = collectUntil(['HAVING', 'ORDER', 'LIMIT']);
                node.children.push(this._node('group_by', this._tokensText(items)));
            }

            // HAVING
            if (isKeyword('HAVING')) {
                advance();
                const items = collectUntil(['ORDER', 'LIMIT']);
                node.children.push(this._node('having', this._tokensText(items)));
            }

            // ORDER BY
            if (isKeyword('ORDER')) {
                advance(); // ORDER
                if (isKeyword('BY')) advance(); // BY (optional, defensive)
                const items = collectUntil(['LIMIT']);
                node.children.push(this._node('order_by', this._tokensText(items)));
            }

            // LIMIT
            if (isKeyword('LIMIT')) {
                advance();
                const items = collectUntil([]);
                node.children.push(this._node('limit', this._tokensText(items)));
            }

            return node;
        };

        const parseInsert = () => {
            advance(); // INSERT
            if (isKeyword('INTO')) advance(); // optional INTO keyword
            const node = this._node('INSERT', 'INSERT');

            // Table name
            const table = advance();
            if (table) {
                node.children.push(this._node('table', table.text));
            }

            // Column list (...)
            if (peek() && peek().text === '(') {
                advance(); // (
                const cols = collectUntil([')']);
                if (peek() && peek().text === ')') advance();
                node.children.push(this._node('columns', this._tokensText(cols, ', ')));
            }

            // VALUES
            if (isKeyword('VALUES')) {
                advance();
                const vals = collectUntil([]);
                // Split by ) and ( to get value groups
                const valText = this._tokensText(vals);
                node.children.push(this._node('values', valText));
            }

            return node;
        };

        const parseCreate = () => {
            advance(); // CREATE
            let createType = 'TABLE';
            if (isKeyword('TABLE')) { advance(); }
            else if (isKeyword('INDEX')) { createType = 'INDEX'; advance(); }
            else if (isKeyword('VIEW')) { createType = 'VIEW'; advance(); }
            else if (isKeyword('TRIGGER')) { createType = 'TRIGGER'; advance(); }
            const node = this._node('CREATE', 'CREATE ' + createType);

            // IF NOT EXISTS
            if (isKeyword('IF')) { advance(); if (isKeyword('NOT')) advance(); if (isKeyword('EXISTS')) advance(); }

            // Table name
            const table = advance();
            if (table) {
                node.children.push(this._node('table', table.text));
            }

            // Column definitions: collect everything inside (...)
            if (peek() && peek().text === '(') {
                advance(); // (
                let depth = 0;
                const colTokens = [];
                while (pos < tokens.length) {
                    const t = peek();
                    if (t.text === '(') depth++;
                    if (t.text === ')') {
                        if (depth === 0) { advance(); break; }
                        depth--;
                    }
                    advance();
                    colTokens.push(t);
                }
                // Split by comma to get individual column defs (respecting nested parens)
                const colDefs = [];
                let current = [];
                let commaDepth = 0;
                for (const t of colTokens) {
                    if (t.text === '(') { commaDepth++; current.push(t); }
                    else if (t.text === ')') { commaDepth--; current.push(t); }
                    else if (t.text === ',' && commaDepth === 0) {
                        if (current.length > 0) {
                            colDefs.push(this._tokensText(current));
                            current = [];
                        }
                    } else {
                        current.push(t);
                    }
                }
                if (current.length > 0) colDefs.push(this._tokensText(current));

                for (const def of colDefs) {
                    node.children.push(this._node('column_def', def));
                }
            }

            return node;
        };

        const parseUpdate = () => {
            advance(); // UPDATE
            const node = this._node('UPDATE', 'UPDATE');

            const table = advance();
            if (table) node.children.push(this._node('table', table.text));

            if (isKeyword('SET')) {
                advance();
                const setItems = collectUntil(['WHERE']);
                node.children.push(this._node('set', this._tokensText(setItems)));
            }

            if (isKeyword('WHERE')) {
                advance();
                const whereItems = collectUntil([]);
                node.children.push(this._node('where', this._tokensText(whereItems)));
            }

            return node;
        };

        const parseDelete = () => {
            advance(); // DELETE
            if (isKeyword('FROM')) advance(); // optional FROM keyword
            const node = this._node('DELETE', 'DELETE');

            const table = advance();
            if (table) node.children.push(this._node('table', table.text));

            if (isKeyword('WHERE')) {
                advance();
                const whereItems = collectUntil([]);
                node.children.push(this._node('where', this._tokensText(whereItems)));
            }

            return node;
        };

        // Parse one statement
        const parseStatement = () => {
            const t = peek();
            if (!t) return null;

            if (t.type === 'keyword') {
                const kw = t.text.toUpperCase();
                if (kw === 'SELECT') return parseSelect();
                if (kw === 'INSERT') return parseInsert();
                if (kw === 'CREATE') return parseCreate();
                if (kw === 'UPDATE') return parseUpdate();
                if (kw === 'DELETE') return parseDelete();
            }

            // Unknown statement — collect all remaining
            const all = collectUntil([]);
            return this._node('statement', this._tokensText(all));
        };

        const tree = this._node('SQL', sql);
        while (pos < tokens.length) {
            const stmt = parseStatement();
            if (stmt) tree.children.push(stmt);
            // Skip any stray semicolons
            while (pos < tokens.length && tokens[pos].text === ';') pos++;
        }

        // If only one statement, return it directly (skip "SQL" root wrapper)
        if (tree.children.length === 1) {
            return tree.children[0];
        }
        return tree;
    }

    /**
     * Tokenize SQL for visualization
     */
    tokenizeSQL(sql) {
        const tokens = [];
        const keywords = this._sqlKeywords;

        // Strip comments before tokenizing (-- line comments and /* */ block comments)
        // but preserve string literals (don't strip -- inside quotes)
        let cleaned = '';
        let i = 0;
        while (i < sql.length) {
            if (sql[i] === "'" || sql[i] === '"') {
                // String literal — copy verbatim including escaped quotes
                const q = sql[i];
                cleaned += sql[i++];
                while (i < sql.length) {
                    cleaned += sql[i];
                    if (sql[i] === q && (i + 1 >= sql.length || sql[i + 1] !== q)) { i++; break; }
                    i++;
                }
            } else if (sql[i] === '-' && i + 1 < sql.length && sql[i + 1] === '-') {
                // Line comment — skip to end of line
                i += 2;
                while (i < sql.length && sql[i] !== '\n') i++;
            } else if (sql[i] === '/' && i + 1 < sql.length && sql[i + 1] === '*') {
                // Block comment — skip to */
                i += 2;
                while (i < sql.length && !(sql[i] === '*' && i + 1 < sql.length && sql[i + 1] === '/')) i++;
                if (i < sql.length) i += 2; // skip */
            } else {
                cleaned += sql[i++];
            }
        }

        // Match: quoted strings (with '' escapes), numbers, identifiers/keywords, operators, punctuation
        const regex = /'(?:[^']|'')*'|"(?:[^"]|"")*"|\d+(?:\.\d+)?|[A-Za-z_]\w*|[<>=!|]+|[*,().;\[\]\/+\-]/g;
        let match;

        while ((match = regex.exec(cleaned)) !== null) {
            const text = match[0];
            let type;
            if (text.startsWith("'") || text.startsWith('"')) {
                type = 'string';
            } else if (/^\d/.test(text)) {
                type = 'number';
            } else if (text === '.' || text === '[' || text === ']') {
                type = 'symbol';
            } else if (keywords.has(text.toUpperCase())) {
                type = 'keyword';
            } else if (/[A-Za-z_]/.test(text[0])) {
                type = 'identifier';
            } else {
                type = 'symbol';
            }
            tokens.push({ text, type });
        }

        return tokens;
    }

    /**
     * Draw parse tree visualization — AST tree with nodes and connections
     */
    drawParseTree(waiting = false) {
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;

        this._clearCanvas(width, height);

        // Show waiting message if no SQL yet (no pan/zoom needed for static text)
        if (waiting || !this.currentSQL) {
            this.ctx.fillStyle = this.colors.text;
            this.ctx.font = 'bold 16px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('SQL Parse Tree', width / 2, height / 2 - 40);
            this.ctx.font = '14px sans-serif';
            this.ctx.fillStyle = this.colors.textLight;
            this.ctx.fillText('Execute a SQL query to see its AST', width / 2, height / 2);
            this.ctx.font = '13px monospace';
            this.ctx.fillStyle = '#94a3b8';
            this.ctx.fillText('Example: SELECT id, name FROM users WHERE age > 18;', width / 2, height / 2 + 30);
            return;
        }

        // Draw title and SQL text outside pan/zoom (fixed position)
        const displaySQL = this.currentSQL.length > 80
            ? this.currentSQL.substring(0, 77) + '...'
            : this.currentSQL;
        this._drawTitle('SQL Abstract Syntax Tree', displaySQL, width);

        // Apply pan/zoom for parse tree content
        this._applyTransform();

        // Build AST if not built yet
        if (!this.parseTree || this.parseTree.children.length === 0) {
            this.parseTree = this.buildParseTree(this.currentSQL);
        }

        // Layout AST tree on canvas
        if (this.parseTree && this.parseTree.children.length > 0) {
            this._layoutAndDrawAST(this.parseTree, width, height);
        }

        this.ctx.restore(); // end pan/zoom

        // Token count at bottom (outside pan/zoom, fixed position)
        this.ctx.font = '11px sans-serif';
        this.ctx.fillStyle = '#10b981';
        this.ctx.textBaseline = 'bottom';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${this.parseTokens.length} tokens parsed | ${this.parseTree ? this.parseTree.children.length : 0} statement(s)`, width / 2, height - 8);
    }

    /**
     * Layout and draw AST as a tree with proper spacing
     */
    _layoutAndDrawAST(tree, canvasWidth, canvasHeight) {
        const startY = 50;
        const nodeH = 28;
        const vGap = 12;
        const hGap = 12;
        const padding = 20;

        // Determine if tree has multiple statements (SQL root) or single
        const isMultiStmt = tree.type === 'SQL' && tree.children && tree.children.length > 1;
        const stmts = isMultiStmt ? tree.children : [tree];

        // Measure node text width (compact, not canvas-filling)
        const measureTextW = (node) => {
            const label = this._astLabel(node);
            this.ctx.font = (this._astColorMap[node.type] !== undefined) ? 'bold 11px sans-serif' : '10px sans-serif';
            return this.ctx.measureText(label).width + 20; // 10px padding each side
        };

        const colorMap = this._astColorMap;

        // Measure subtree width bottom-up
        const measureNode = (node) => {
            const textW = Math.max(measureTextW(node), 50);
            node._textW = textW;
            if (!node.children || node.children.length === 0) {
                node._subtreeW = textW;
                node._subtreeH = nodeH;
                return;
            }
            for (const child of node.children) measureNode(child);
            const childTotalW = node.children.reduce((s, c) => s + c._subtreeW, 0) + (node.children.length - 1) * hGap;
            node._subtreeW = Math.max(textW, childTotalW);
            const maxChildH = node.children.reduce((m, c) => Math.max(m, c._subtreeH), 0);
            node._subtreeH = nodeH + vGap + maxChildH;
        };

        // Assign positions: node width = text width, centered in subtree
        const assignPositions = (node, x, y) => {
            // This node is centered within its subtree allocation
            node._x = x + (node._subtreeW - node._textW) / 2;
            node._y = y;
            node._w = node._textW;

            if (!node.children || node.children.length === 0) return;

            // Layout children side by side within subtree width
            const childY = y + nodeH + vGap;
            let cx = x;
            for (const child of node.children) {
                assignPositions(child, cx, childY);
                cx += child._subtreeW + hGap;
            }
        };

        // Layout statements
        for (const stmt of stmts) measureNode(stmt);

        const totalWidth = stmts.reduce((s, st) => s + st._subtreeW, 0) + (stmts.length - 1) * hGap * 2;
        const offsetX = Math.max(padding, (canvasWidth - totalWidth) / 2);

        if (isMultiStmt) {
            let cx = offsetX;
            for (const stmt of stmts) {
                assignPositions(stmt, cx, startY);
                cx += stmt._subtreeW + hGap * 2;
            }
        } else {
            assignPositions(stmts[0], offsetX, startY);
        }

        // Draw
        const clauseColor = '#64748b';
        const leafColor = '#059669';

        const drawASTNode = (node) => {
            const isTopLevel = colorMap[node.type] !== undefined;
            const isClause = this._astClauseTypes.has(node.type);
            const isColDef = node.type === 'column_def';

            let bgColor = isTopLevel ? colorMap[node.type] :
                          isColDef ? '#475569' :
                          isClause ? clauseColor :
                          leafColor;

            const label = this._astLabel(node);

            const x = node._x;
            const y = node._y;
            const w = node._w;

            // Connections to children
            if (node.children && node.children.length > 0) {
                for (const child of node.children) {
                    this.ctx.strokeStyle = '#cbd5e1';
                    this.ctx.lineWidth = 1.5;
                    this.ctx.beginPath();
                    this.ctx.moveTo(x + w / 2, y + nodeH);
                    this.ctx.lineTo(child._x + child._w / 2, child._y);
                    this.ctx.stroke();
                }
            }

            // Node box
            this.ctx.fillStyle = bgColor;
            this.roundRect(x, y, w, nodeH, 5);
            this.ctx.fill();
            this.ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            this.ctx.lineWidth = 1;
            this.roundRect(x, y, w, nodeH, 5);
            this.ctx.stroke();

            // Text — fits within measured width, no truncation needed
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = isTopLevel ? 'bold 11px sans-serif' : '10px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(label, x + w / 2, y + nodeH / 2);

            // Recurse
            if (node.children) {
                for (const child of node.children) drawASTNode(child);
            }
        };

        for (const stmt of stmts) drawASTNode(stmt);
    }

    /**
     * Show VDBE execution start
     */
    showVdbeStart(numOpcodes) {
        // Always reset state regardless of view mode
        this.vdbeOpcodes = [];
        this._resetVdbeState();
        const info = document.getElementById('vdbe-step-info');
        if (info) info.textContent = '';
        if (this.viewMode === 'vdbe') {
            this.drawVdbeList('Program starting', `Expected ${numOpcodes} opcodes`);
        }
    }

    /**
     * Show VDBE opcode execution (with batched rendering for performance)
     */
    showVdbeOpcode(pc, opcode, p1, p2, p3) {
        // Validate inputs
        if (typeof pc !== 'number' || pc < 0 || !Number.isInteger(pc)) {
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
        this._opcodeCount = Math.max(this._opcodeCount, pc + 1);
        this.vdbeCurrentPc = pc;

        // Batch rendering for performance - only draw periodically
        if (!this._vdbeDrawScheduled) {
            this._vdbeDrawScheduled = true;
            this._vdbeRafId = requestAnimationFrame(() => {
                this.drawVdbeList('Executing', `Opcode ${this.vdbeCurrentPc + 1} of ${this._opcodeCount}`);
                this._vdbeDrawScheduled = false;
                this._vdbeRafId = null;
            });
        }
    }

    /**
     * Show VDBE execution complete
     */
    showVdbeComplete(resultCode) {
        // Cancel any pending "Executing" draw so it doesn't overwrite "Complete"
        if (this._vdbeRafId !== null) {
            cancelAnimationFrame(this._vdbeRafId);
            this._vdbeRafId = null;
        }
        this._vdbeDrawScheduled = false;
        const rcName = eventManager.resultCodeNames[resultCode] || `code ${resultCode}`;
        if (this.viewMode === 'vdbe') {
            this.drawVdbeList('Complete', `Result: ${rcName}`);
        }
    }

    /**
     * Draw VDBE opcode list with current execution highlighted (HIGHLY OPTIMIZED)
     * Uses viewport virtualization and batched rendering
     */
    drawVdbeList(state, info) {
        // Use cached dimensions
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;

        // Clear and draw background
        this._clearCanvas(width, height);

        // Draw title and state outside pan/zoom (fixed position)
        this._drawTitle('VDBE Program Execution', `${state} — ${info}`, width);

        // Apply pan/zoom for VDBE content
        this._applyTransform();

        // If we have individual opcodes, draw them
        if (this._opcodeCount > 0) {
            this._drawVdbeOpcodes(width, height);
            this.ctx.restore();
            return;
        }

        // No individual opcodes from WASM — show program traces from VDBE events
        if (typeof eventManager === 'undefined') {
            this.ctx.fillStyle = this.colors.textLight;
            this.ctx.font = '13px sans-serif';
            this.ctx.fillText('Execute SQL to see VDBE execution trace', width / 2, height / 2);
            this.ctx.restore();
            return;
        }

        const vdbeStarts = eventManager.getEventsByType(11).filter(e => e.data.numOpcodes !== undefined);
        const vdbeCompletes = eventManager.getEventsByType(13).filter(e => e.data.resultCode !== undefined);

        const resultNames = eventManager.resultCodeNames;
        const lineHeight = 24;
        const startY = 55;
        const maxRows = Math.floor((height - startY - 40) / lineHeight);
        const totalTraces = vdbeStarts.length;

        this.ctx.font = '12px monospace';
        this.ctx.textAlign = 'left';

        // Draw header
        this.ctx.fillStyle = this.colors.textLight;
        this.ctx.fillText('Program                Opcodes  Result', 40, startY - 5);
        this.ctx.fillStyle = '#4a5568';
        this.ctx.fillRect(40, startY, width - 80, 1);

        for (let i = 0; i < Math.min(totalTraces, maxRows); i++) {
            const start = vdbeStarts[i];
            const complete = vdbeCompletes[i];
            const y = startY + 10 + i * lineHeight;

            // Program number
            this.ctx.fillStyle = '#7c3aed';
            this.ctx.fillText(`Program #${i + 1}`, 40, y);

            // Opcode count
            this.ctx.fillStyle = this.colors.textLight;
            this.ctx.fillText(`${start.data.numOpcodes} ops`, 180, y);

            // Result code
            if (complete) {
                const rc = complete.data.resultCode;
                const rcName = resultNames[rc] || rc;
                this.ctx.fillStyle = rc === 0 ? '#10b981' : '#f59e0b';
                this.ctx.fillText(`${rcName} (${rc})`, 280, y);
            }
        }

        if (totalTraces > maxRows) {
            this.ctx.fillStyle = this.colors.textLight;
            this.ctx.font = '12px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`... and ${totalTraces - maxRows} more programs`, width / 2, startY + 10 + maxRows * lineHeight);
        }

        // Summary at bottom
        this.ctx.fillStyle = this.colors.textLight;
        this.ctx.font = '12px sans-serif';
        this.ctx.textAlign = 'center';
        const summaryY = height - 30;
        this.ctx.fillText(`Total: ${totalTraces} programs executed`, width / 2, summaryY);

        this.ctx.restore(); // restore pan/zoom
    }

    _drawVdbeOpcodes(width, height) {
        const startY = 50;
        const lineHeight = 24;
        const padding = 40;
        const availableHeight = height - startY - padding;
        const maxVisibleOpcodes = Math.floor(availableHeight / lineHeight);

        // Use step index for highlight if stepping, otherwise use final currentPc
        const highlightPc = this.vdbeStepIndex >= 0 ? this.vdbeStepIndex : this.vdbeCurrentPc;

        let viewportStart = 0;
        if (highlightPc >= maxVisibleOpcodes / 2) {
            viewportStart = Math.floor(highlightPc - maxVisibleOpcodes / 2);
        }
        viewportStart = Math.max(0, Math.min(viewportStart, this._opcodeCount - maxVisibleOpcodes));
        const viewportEnd = Math.min(this._opcodeCount, viewportStart + maxVisibleOpcodes);

        const allRows = [];
        let drawRow = 0;

        for (let i = viewportStart; i < viewportEnd; i++) {
            const op = this.vdbeOpcodes[i];
            if (!op) continue;

            const y = startY + drawRow * lineHeight;
            drawRow++;
            const isCurrent = i === highlightPc;
            // In step mode, mark opcodes before current as "executed"
            const isExecuted = this.vdbeStepIndex >= 0 && i < this.vdbeStepIndex && this.vdbeOpcodes[i];

            // Tag category directly on the data object
            const category = isCurrent ? 'highlight' : isExecuted ? 'executed' : 'normal';
            allRows.push({ op, y, category });
        }

        // Pre-calculate positions and text
        const textX = 40;
        const maxWidth = Math.min(500, width - 60);
        this.ctx.font = '13px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';

        // Draw all rows (already in y-order)
        for (const { op, y, category } of allRows) {
            const text = `[${op.pc}] ${op.opcode.padEnd(12)} P1=${String(op.p1).padStart(3)} P2=${String(op.p2).padStart(3)} P3=${String(op.p3).padStart(3)}`;

            if (category === 'highlight') {
                this.ctx.fillStyle = this.colors.nodeHighlight;
                this.ctx.fillRect(textX - 10, y - 2, maxWidth, lineHeight - 2);
                this.ctx.fillStyle = '#ffffff';
            } else if (category === 'executed') {
                this.ctx.fillStyle = '#e0f2fe';
                this.ctx.fillRect(textX - 10, y - 2, maxWidth, lineHeight - 2);
                this.ctx.fillStyle = '#0369a1';
            } else {
                this.ctx.fillStyle = this.colors.text;
            }
            this.ctx.fillText(text, textX, y + 4);
        }

        // Draw stats at bottom (inside pan/zoom, _drawVdbeOpcodes does not own the save/restore)
        this.ctx.fillStyle = this.colors.textLight;
        this.ctx.font = '12px sans-serif';
        const countText = `Total opcodes: ${this._opcodeCount}`;
        const scrollText = viewportEnd < this._opcodeCount
            ? ` (showing ${viewportStart + 1}-${viewportEnd})`
            : '';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(countText + scrollText, textX - 10, height - 20);
    }
}
