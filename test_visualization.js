#!/usr/bin/env node

/**
 * Direct test of visualization classes without browser
 */

// Mock DOM environment
global.document = {
    createElement: (tag) => ({
        className: '',
        style: {},
        appendChild: () => {},
        innerHTML: '',
        children: [],
        removeChild: () => {},
        scrollTop: 0,
        scrollHeight: 0,
        getBoundingClientRect: () => ({ width: 800, height: 600, left: 0, top: 0 }),
        addEventListener: () => {},
        removeEventListener: () => {}
    }),
    getElementById: (id) => {
        const mockElements = {
            'visualization-canvas': {
                width: 800,
                height: 400,
                style: { width: '800px', height: '400px' },
                parentElement: {
                    getBoundingClientRect: () => ({ width: 800, height: 400 })
                },
                getBoundingClientRect: () => ({ width: 800, height: 400, left: 0, top: 0 }),
                addEventListener: () => {}
            },
            'event-log': {
                innerHTML: '',
                appendChild: () => {},
                children: [],
                removeChild: () => {},
                scrollTop: 0,
                scrollHeight: 0
            },
            'page-count': {
                textContent: '0'
            },
            'event-count': {
                textContent: '0'
            },
            'node-info': {
                classList: { add: () => {}, remove: () => {} }
            },
            'node-details': {
                innerHTML: ''
            }
        };
        return mockElements[id] || null;
    }
};

global.window = {
    devicePixelRatio: 1,
    addEventListener: () => {},
    ResizeObserver: class {
        observe() {}
        disconnect() {}
    },
    requestAnimationFrame: (cb) => setTimeout(cb, 16)
};

// Mock canvas context
global.CanvasRenderingContext2D = class {
    constructor() {
        this.calls = [];
    }
    fillStyle = null;
    strokeStyle = null;
    lineWidth = 1;
    font = '';
    textAlign = 'left';
    textBaseline = 'alphabetic';
    fillRect(x, y, w, h) { this.calls.push(['fillRect', x, y, w, h]); }
    strokeRect(x, y, w, h) { this.calls.push(['strokeRect', x, y, w, h]); }
    fillText(text, x, y) { this.calls.push(['fillText', text, x, y]); }
    beginPath() { this.calls.push(['beginPath']); }
    closePath() { this.calls.push(['closePath']); }
    moveTo(x, y) { this.calls.push(['moveTo', x, y]); }
    lineTo(x, y) { this.calls.push(['lineTo', x, y]); }
    arc(x, y, r, s, e) { this.calls.push(['arc', x, y, r, s, e]); }
    quadraticCurveTo(x1, y1, x, y) { this.calls.push(['quadraticCurveTo', x1, y1, x, y]); }
    fill() { this.calls.push(['fill']); }
    stroke() { this.calls.push(['stroke']); }
    clearRect(x, y, w, h) { this.calls.push(['clearRect', x, y, w, h]); }
    scale(x, y) { this.calls.push(['scale', x, y]); }
};

// Load the visualizer code
const fs = require('fs');
const path = require('path');
const visualizerCode = fs.readFileSync(path.join(__dirname, 'src/web/js/visualizer.js'), 'utf8');
const eventsCode = fs.readFileSync(path.join(__dirname, 'src/web/js/events.js'), 'utf8');

// Execute the code in our environment
// The visualizer.js and events.js files use 'class' declarations which are scoped
// We need to evaluate them and then extract the classes

// Execute visualizer code - it defines class BTreeVisualizer in the eval scope
eval(visualizerCode);

// Access BTreeVisualizer from local scope (it was just defined by eval)
const BTreeVisualizer = global.BTreeVisualizer || (typeof BTreeVisualizer !== 'undefined' ? BTreeVisualizer : null);

// Execute events code - it defines class EventManager
eval(eventsCode);

// Access EventManager from local scope
const EventManager = global.EventManager || (typeof EventManager !== 'undefined' ? EventManager : null);

console.log('BTreeVisualizer available:', typeof BTreeVisualizer);
console.log('EventManager available:', typeof EventManager);

// Make them available globally for the tests
global.BTreeVisualizer = BTreeVisualizer;
global.EventManager = EventManager;

// Test helper
class TestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    async run() {
        console.log('\n=== SQLiteVis Visualization Tests ===\n');

        for (const test of this.tests) {
            try {
                await test.fn();
                this.passed++;
                console.log(`✓ ${test.name}`);
            } catch (error) {
                this.failed++;
                console.log(`✗ ${test.name}`);
                console.log(`  Error: ${error.message}`);
            }
        }

        console.log(`\n=== Results: ${this.passed} passed, ${this.failed} failed ===\n`);

        return this.failed === 0;
    }
}

// Run tests
const runner = new TestRunner();

// Test 1: VDBE Events
runner.test('VDBE event parsing and visualization', () => {
    return new Promise((resolve, reject) => {
        try {
            const viz = new BTreeVisualizer('visualization-canvas');
            viz.setViewMode('vdbe');

            // Test VDBE_START
            viz.showVdbeStart(5);
            if (viz.vdbeOpcodes.length !== 0) {
                reject(new Error('VDBE_START should initialize empty opcodes array'));
                return;
            }

            // Test VDBE_OPCODE
            viz.showVdbeOpcode(0, 'Init', 0, 1, 0);
            if (viz.vdbeOpcodes[0].opcode !== 'Init') {
                reject(new Error('VDBE_OPCODE should store opcode correctly'));
                return;
            }

            viz.showVdbeOpcode(1, 'Read', 1, 2, 0);
            if (viz.vdbeOpcodes[1].opcode !== 'Read') {
                reject(new Error('VDBE_OPCODE should store multiple opcodes'));
                return;
            }

            // Test VDBE_COMPLETE
            viz.showVdbeComplete(0);
            if (viz.vdbeCurrentPc !== 1) {
                reject(new Error('VDBE_COMPLETE should preserve state'));
                return;
            }

            resolve();
        } catch (error) {
            reject(error);
        }
    });
});

// Test 2: SQL Parsing
runner.test('SQL instruction parsing and visualization', () => {
    return new Promise((resolve, reject) => {
        try {
            const viz = new BTreeVisualizer('visualization-canvas');
            viz.setViewMode('parse');

            // Test PARSE_START
            const sql = 'SELECT id, name FROM users';
            viz.showParseStart(sql);
            if (viz.currentSQL !== sql) {
                reject(new Error('PARSE_START should store SQL'));
                return;
            }

            // Test PARSE_TOKEN
            viz.showParseToken('SELECT', 'TK_SELECT');
            if (viz.parseTokens.length !== 1) {
                reject(new Error('PARSE_TOKEN should add token to list'));
                return;
            }

            viz.showParseToken('id', 'TK_ID');
            viz.showParseToken('FROM', 'TK_FROM');
            if (viz.parseTokens.length !== 3) {
                reject(new Error('PARSE_TOKEN should accumulate tokens'));
                return;
            }

            // Test token validation
            viz.showParseToken(null, 'TK_NULL');
            viz.showParseToken(undefined, 'TK_UNDEF');
            viz.showParseToken(123, 'TK_NUMBER');

            if (viz.parseTokens.length !== 6) {
                reject(new Error('PARSE_TOKEN should handle edge cases'));
                return;
            }

            // Test PARSE_COMPLETE
            viz.showParseComplete(true);
            if (viz.parseTokens.length !== 6) {
                reject(new Error('PARSE_COMPLETE should preserve tokens'));
                return;
            }

            resolve();
        } catch (error) {
            reject(error);
        }
    });
});

// Test 3: Page Node Events
runner.test('Page node event parsing and visualization', () => {
    return new Promise((resolve, reject) => {
        try {
            const viz = new BTreeVisualizer('visualization-canvas');
            viz.setViewMode('btree');

            // Test PAGE_ALLOCATE
            viz.addPage(1, 1);  // leaf page
            if (!viz.nodes.has(1)) {
                reject(new Error('PAGE_ALLOCATE should create node'));
                return;
            }

            const page1 = viz.nodes.get(1);
            if (page1.type !== 1) {
                reject(new Error('PAGE_ALLOCATE should set page type'));
                return;
            }

            // Test BTREE_INSERT (via addCell)
            viz.addCell(1, 0, 4);
            if (page1.cells.length !== 1) {
                reject(new Error('BTREE_INSERT should add cell to page'));
                return;
            }

            viz.addCell(1, 1, 8);
            viz.addCell(1, 2, 12);
            if (page1.cells.length !== 3) {
                reject(new Error('BTREE_INSERT should add multiple cells'));
                return;
            }

            // Test BTREE_SPLIT
            viz.splitPage(1, 2, 1);
            if (!viz.nodes.has(2)) {
                reject(new Error('BTREE_SPLIT should create new page'));
                return;
            }

            const page2 = viz.nodes.get(2);
            if (page2.cells.length !== 2) {  // cells from index 1 onward
                reject(new Error('BTREE_SPLIT should move cells to new page'));
                return;
            }

            if (page1.cells.length !== 1) {  // cells before index 1
                reject(new Error('BTREE_SPLIT should leave cells in original page'));
                return;
            }

            // Test parent-child relationship
            if (page2.parent !== page1.parent) {
                reject(new Error('BTREE_SPLIT should preserve parent relationship'));
                return;
            }

            // Test BTREE_DELETE (via deleteCell)
            viz.deleteCell(1, 0);
            if (page1.cells.length !== 0) {
                reject(new Error('BTREE_DELETE should remove cell from page'));
                return;
            }

            resolve();
        } catch (error) {
            reject(error);
        }
    });
});

// Test 4: Token type mapping
runner.test('Token type name mapping', () => {
    return new Promise((resolve, reject) => {
        try {
            const viz = new BTreeVisualizer('visualization-canvas');

            // Test known tokens
            if (viz.tokenTypeNames[38] !== 'TK_SELECT') {
                reject(new Error('Token type mapping incorrect for TK_SELECT'));
                return;
            }

            if (viz.tokenTypeNames[36] !== 'TK_ID') {
                reject(new Error('Token type mapping incorrect for TK_ID'));
                return;
            }

            if (viz.tokenTypeNames[41] !== 'TK_FROM') {
                reject(new Error('Token type mapping incorrect for TK_FROM'));
                return;
            }

            // Test unknown token
            const unknownName = viz.tokenTypeNames[999];
            if (unknownName !== undefined) {
                reject(new Error('Unknown token type should be undefined'));
                return;
            }

            resolve();
        } catch (error) {
            reject(error);
        }
    });
});

// Test 5: Event Manager
runner.test('Event Manager functionality', () => {
    return new Promise((resolve, reject) => {
        try {
            const em = new EventManager();

            // Test event type names
            if (em.eventTypeNames[11] !== 'VDBE_START') {
                reject(new Error('Event type name incorrect for VDBE_START'));
                return;
            }

            if (em.eventTypeNames[8] !== 'PARSE_START') {
                reject(new Error('Event type name incorrect for PARSE_START'));
                return;
            }

            if (em.eventTypeNames[6] !== 'PAGE_ALLOCATE') {
                reject(new Error('Event type name incorrect for PAGE_ALLOCATE'));
                return;
            }

            // Test event categories
            if (em.eventCategories[11] !== 'vdbe') {
                reject(new Error('Event category incorrect for VDBE_START'));
                return;
            }

            if (em.eventCategories[8] !== 'parse') {
                reject(new Error('Event category incorrect for PARSE_START'));
                return;
            }

            if (em.eventCategories[6] !== 'btree') {
                reject(new Error('Event category incorrect for PAGE_ALLOCATE'));
                return;
            }

            // Test event handling
            let eventReceived = false;
            em.on(11, (event) => {
                eventReceived = true;
                if (event.typeName !== 'VDBE_START') {
                    reject(new Error('Event handler should receive correct event'));
                }
            });

            em.handleEvent(11, JSON.stringify({ numOpcodes: 5 }));

            if (!eventReceived) {
                reject(new Error('Event handler should be called'));
                return;
            }

            if (em.events.length !== 1) {
                reject(new Error('Event should be stored'));
                return;
            }

            // Test event filtering
            const vdbeEvents = em.getEventsByType(11);
            if (vdbeEvents.length !== 1) {
                reject(new Error('getEventsByType should return matching events'));
                return;
            }

            const parseEvents = em.getEventsByCategory('parse');
            if (parseEvents.length !== 0) {
                reject(new Error('getEventsByCategory should filter correctly'));
                return;
            }

            resolve();
        } catch (error) {
            reject(error);
        }
    });
});

// Test 6: Complex VDBE sequence
runner.test('Complex VDBE opcode sequence', () => {
    return new Promise((resolve, reject) => {
        try {
            const viz = new BTreeVisualizer('visualization-canvas');
            viz.setViewMode('vdbe');

            const opcodes = [
                { pc: 0, opcode: 'Init', p1: 0, p2: 12, p3: 0 },
                { pc: 1, opcode: 'OpenRead', p1: 0, p2: 2, p3: 0 },
                { pc: 2, opcode: 'Rewind', p1: 0, p2: 10, p3: 0 },
                { pc: 3, opcode: 'Column', p1: 0, p2: 0, p3: 1 },
                { pc: 4, opcode: 'Column', p1: 0, p2: 1, p3: 2 },
                { pc: 5, opcode: 'ResultRow', p1: 1, p2: 2, p3: 0 },
                { pc: 6, opcode: 'Next', p1: 0, p2: 3, p3: 0 },
                { pc: 7, opcode: 'Halt', p1: 0, p2: 0, p3: 0 }
            ];

            viz.showVdbeStart(opcodes.length);

            opcodes.forEach(op => {
                viz.showVdbeOpcode(op.pc, op.opcode, op.p1, op.p2, op.p3);
            });

            if (viz.vdbeOpcodes.length !== opcodes.length) {
                reject(new Error(`Expected ${opcodes.length} opcodes, got ${viz.vdbeOpcodes.length}`));
                return;
            }

            // Verify first and last opcode
            if (viz.vdbeOpcodes[0].opcode !== 'Init') {
                reject(new Error('First opcode should be Init'));
                return;
            }

            if (viz.vdbeOpcodes[7].opcode !== 'Halt') {
                reject(new Error('Last opcode should be Halt'));
                return;
            }

            // Verify current PC
            if (viz.vdbeCurrentPc !== 7) {
                reject(new Error('Current PC should be 7'));
                return;
            }

            resolve();
        } catch (error) {
            reject(error);
        }
    });
});

// Test 7: Complex SQL parse sequence
runner.test('Complex SQL token sequence', () => {
    return new Promise((resolve, reject) => {
        try {
            const viz = new BTreeVisualizer('visualization-canvas');
            viz.setViewMode('parse');

            const sql = 'SELECT id, name FROM users WHERE age > 18';
            viz.showParseStart(sql);

            const tokens = [
                { token: 'SELECT', type: 'TK_SELECT' },
                { token: 'id', type: 'TK_ID' },
                { token: ',', type: 'TK_COMMA' },
                { token: 'name', type: 'TK_ID' },
                { token: 'FROM', type: 'TK_FROM' },
                { token: 'users', type: 'TK_ID' },
                { token: 'WHERE', type: 'TK_WHERE' },
                { token: 'age', type: 'TK_ID' },
                { token: '>', type: 'TK_GT' },
                { token: '18', type: 'TK_INTEGER' }
            ];

            tokens.forEach(tok => {
                viz.showParseToken(tok.token, tok.type);
            });

            if (viz.parseTokens.length !== tokens.length) {
                reject(new Error(`Expected ${tokens.length} tokens, got ${viz.parseTokens.length}`));
                return;
            }

            // Verify first and last token
            if (viz.parseTokens[0].token !== 'SELECT') {
                reject(new Error('First token should be SELECT'));
                return;
            }

            if (viz.parseTokens[9].token !== '18') {
                reject(new Error('Last token should be 18'));
                return;
            }

            viz.showParseComplete(true);

            resolve();
        } catch (error) {
            reject(error);
        }
    });
});

// Test 8: B-Tree operations sequence
runner.test('B-Tree page operations sequence', () => {
    return new Promise((resolve, reject) => {
        try {
            const viz = new BTreeVisualizer('visualization-canvas');
            viz.setViewMode('btree');

            // Allocate initial pages
            viz.addPage(1, 1);  // leaf page
            viz.addPage(2, 1);  // leaf page
            viz.addPage(3, 0);  // interior page

            if (viz.nodes.size !== 3) {
                reject(new Error(`Expected 3 pages, got ${viz.nodes.size}`));
                return;
            }

            // Add cells to page 1
            for (let i = 0; i < 10; i++) {
                viz.addCell(1, i, 4);
            }

            const page1 = viz.nodes.get(1);
            if (page1.cells.length !== 10) {
                reject(new Error(`Expected 10 cells in page 1, got ${page1.cells.length}`));
                return;
            }

            // Split page 1
            viz.splitPage(1, 4, 5);

            if (!viz.nodes.has(4)) {
                reject(new Error('Split should create new page 4'));
                return;
            }

            const page4 = viz.nodes.get(4);
            if (page4.cells.length !== 5) {
                reject(new Error(`Expected 5 cells in new page 4, got ${page4.cells.length}`));
                return;
            }

            if (page1.cells.length !== 5) {
                reject(new Error(`Expected 5 cells remaining in page 1, got ${page1.cells.length}`));
                return;
            }

            // Delete some cells
            viz.deleteCell(1, 0);
            if (page1.cells.length !== 4) {
                reject(new Error(`Expected 4 cells after deletion, got ${page1.cells.length}`));
                return;
            }

            resolve();
        } catch (error) {
            reject(error);
        }
    });
});

// Run all tests
runner.run().then(success => {
    process.exit(success ? 0 : 1);
});
