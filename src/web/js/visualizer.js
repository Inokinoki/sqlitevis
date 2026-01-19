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
        this.startAnimationLoop();
    }

    /**
     * Setup canvas size and scaling
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
            this.draw();
        };

        // Initial sizing
        resize();

        // Watch for window resize
        window.addEventListener('resize', resize);

        // Watch for container size changes
        this.resizeObserver = new ResizeObserver(() => {
            resize();
        });
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
     * Show parse token
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
        this.drawParseTree(false);  // false = not waiting, has SQL
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
     * Draw parse tokens list
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

        this.parseTokens.forEach((token, i) => {
            const x = 20;
            const y = startY + 30 + i * (tokenHeight + 5);

            // Token background
            const color = token.type === 'keyword' ? this.colors.nodeInternal :
                         token.type === 'identifier' ? this.colors.nodeLeaf :
                         this.colors.background;

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
        });
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
     * Show VDBE opcode execution
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
        this.drawVdbeList('Executing', `Opcode ${pc + 1} of ${this.vdbeOpcodes.length}`);
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
     * Draw VDBE opcode list with current execution highlighted
     */
    drawVdbeList(state, info) {
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, rect.width, rect.height);

        // Draw title and state
        this.ctx.fillStyle = this.colors.text;
        this.ctx.font = 'bold 16px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('VDBE Program Execution', rect.width / 2, 30);
        this.ctx.font = '14px sans-serif';
        this.ctx.fillText(`${state} - ${info}`, rect.width / 2, 55);

        // Draw all opcodes
        const startY = 90;
        const lineHeight = 28;

        this.vdbeOpcodes.forEach((op, index) => {
            const y = startY + index * lineHeight;
            const isCurrent = index === this.vdbeCurrentPc;

            // Highlight current instruction
            if (isCurrent) {
                this.ctx.fillStyle = this.colors.nodeHighlight;
                this.ctx.fillRect(30, y - 5, Math.min(500, rect.width - 60), lineHeight - 2);
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
        });

        // Show instruction count
        this.ctx.fillStyle = this.colors.textLight;
        this.ctx.font = '12px sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(
            `Total opcodes: ${this.vdbeOpcodes.length}`,
            30,
            rect.height - 20
        );
    }
}
