#!/usr/bin/env node
/**
 * End-to-End Integration Test
 * Tests the complete flow from event emission to visualization
 */

const fs = require('fs');

console.log('=== SQLiteVis End-to-End Integration Test ===\n');

// Load all modules
const eventsCode = fs.readFileSync('src/web/js/events.js', 'utf8');
const visualizerCode = fs.readFileSync('src/web/js/visualizer.js', 'utf8');

// Mock DOM
let callLog = [];
const mockCanvas = {
    getContext: () => ({
        clearRect: (x, y, w, h) => callLog.push(['clearRect', x, y, w, h]),
        fillRect: (x, y, w, h) => callLog.push(['fillRect', x, y, w, h]),
        fillText: (text, x, y) => callLog.push(['fillText', text, x, y]),
        strokeRect: (x, y, w, h) => callLog.push(['strokeRect', x, y, w, h]),
        beginPath: () => callLog.push(['beginPath']),
        moveTo: (x, y) => callLog.push(['moveTo', x, y]),
        lineTo: (x, y) => callLog.push(['lineTo', x, y]),
        stroke: () => callLog.push(['stroke']),
        fill: () => callLog.push(['fill']),
        save: () => callLog.push(['save']),
        restore: () => callLog.push(['restore']),
        translate: (x, y) => callLog.push(['translate', x, y]),
        scale: (x, y) => callLog.push(['scale', x, y]),
        setTransform: (a, b, c, d, e, f) => callLog.push(['setTransform', a, b, c, d, e, f]),
        arc: (x, y, r, start, end) => callLog.push(['arc', x, y, r, start, end]),
        rect: (x, y, w, h) => callLog.push(['rect', x, y, w, h]),
        clip: () => callLog.push(['clip']),
        quadraticCurveTo: (cpx, cpy, x, y) => callLog.push(['quadraticCurveTo', cpx, cpy, x, y]),
        bezierCurveTo: (cp1x, cp1y, cp2x, cp2y, x, y) => callLog.push(['bezierCurveTo', cp1x, cp1y, cp2x, cp2y, x, y]),
        closePath: () => callLog.push(['closePath']),
        measureText: (text) => ({ width: text.length * 8, height: 14 }),
        font: '',
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        textAlign: '',
        textBaseline: ''
    }),
    width: 800,
    height: 600,
    classList: { remove: () => {}, add: () => {} },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    addEventListener: () => {},
    removeEventListener: () => {}
};

global.document = {
    getElementById: (id) => {
        if (id === 'visualization-canvas') return mockCanvas;
        if (id === 'event-log') {
            return {
                children: [],
                appendChild: () => {},
                scrollTop: 0,
                scrollHeight: 100,
                innerHTML: '',
                removeChild: () => {}
            };
        }
        if (id === 'event-count') return { textContent: '' };
        if (id === 'page-count') return { textContent: '' };
        return null;
    },
    createElement: (tag) => ({
        className: '',
        innerHTML: '',
        textContent: ''
    })
};

global.window = {
    sqliteVisEventHandler: null,
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    cancelAnimationFrame: () => {},
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: () => {},
    removeEventListener: () => {}
};

global.ResizeObserver = class {
    constructor(cb) { this.cb = cb; }
    observe() {}
    unobserve() {}
    disconnect() {}
};

global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = () => {};

// Execute modules and get exports
// Must define requestAnimationFrame before evaluating visualizer
let eventManager;
let BTreeVisualizer;
const moduleExports = {};

eval(eventsCode + '; moduleExports.eventManager = eventManager;');
eventManager = moduleExports.eventManager;

eval(visualizerCode + '; moduleExports.BTreeVisualizer = BTreeVisualizer;');
BTreeVisualizer = moduleExports.BTreeVisualizer;

console.log('Test 1: Complete VDBE Flow with Event Manager');
console.log('─────────────────────────────────────────────');

try {
    const viz = new BTreeVisualizer('visualization-canvas');
    viz.setViewMode('vdbe');

    let vdbeStartReceived = false;
    let vdbeOpcodeCount = 0;
    let vdbeCompleteReceived = false;

    eventManager.on(11, (e) => {
        vdbeStartReceived = true;
        viz.showVdbeStart(e.data.numOpcodes);
    });

    eventManager.on(12, (e) => {
        vdbeOpcodeCount++;
        viz.showVdbeOpcode(e.data.pc, e.data.opcode, e.data.p1, e.data.p2, e.data.p3);
    });

    eventManager.on(13, (e) => {
        vdbeCompleteReceived = true;
        viz.showVdbeComplete(e.data.resultCode);
    });

    // Simulate VDBE execution flow for: SELECT * FROM users WHERE id = 1
    eventManager.handleEvent(11, '{"numOpcodes":7}');
    eventManager.handleEvent(12, '{"pc":0,"opcode":"Init","p1":0,"p2":5,"p3":0}');
    eventManager.handleEvent(12, '{"pc":1,"opcode":"OpenRead","p1":0,"p2":2,"p3":0}');
    eventManager.handleEvent(12, '{"pc":2,"opcode":"Rewind","p1":0,"p2":9,"p3":0}');
    eventManager.handleEvent(12, '{"pc":3,"opcode":"Column","p1":0,"p2":1,"p3":1}');
    eventManager.handleEvent(12, '{"pc":4,"opcode":"Ne","p1":1,"p2":1,"p3":0}');
    eventManager.handleEvent(12, '{"pc":5,"opcode":"IfNotZero","p1":1,"p2":8,"p3":0}');
    eventManager.handleEvent(12, '{"pc":6,"opcode":"Halt","p1":0,"p2":0,"p3":0}');
    eventManager.handleEvent(13, '{"resultCode":0}');

    if (!vdbeStartReceived) {
        console.log('✗ VDBE_START not received');
        process.exit(1);
    }
    console.log('✓ VDBE_START event received and processed');

    if (vdbeOpcodeCount !== 7) {
        console.log('✗ Expected 7 opcodes, got', vdbeOpcodeCount);
        process.exit(1);
    }
    console.log('✓ VDBE_OPCODE: All 7 opcodes received');

    if (!vdbeCompleteReceived) {
        console.log('✗ VDBE_COMPLETE not received');
        process.exit(1);
    }
    console.log('✓ VDBE_COMPLETE event received');

    if (viz.vdbeCurrentPc !== 6) {
        console.log('✗ Final PC incorrect:', viz.vdbeCurrentPc);
        process.exit(1);
    }
    console.log('✓ VDBE visualization complete');
    console.log('✅ VDBE End-to-End Flow: PASS\n');

} catch (e) {
    console.log('✗ VDBE End-to-End Flow: FAIL -', e.message);
    console.log(e.stack);
    process.exit(1);
}

console.log('Test 2: Complete SQL Parse Flow with Event Manager');
console.log('─────────────────────────────────────────────────');

try {
    const viz = new BTreeVisualizer('visualization-canvas');
    viz.setViewMode('parse');

    let parseStartReceived = false;
    let tokenCount = 0;
    let parseCompleteReceived = false;

    eventManager.on(8, (e) => {
        parseStartReceived = true;
        viz.showParseStart(e.data.sql);
    });

    eventManager.on(9, (e) => {
        tokenCount++;
        viz.showParseToken(e.data.token, e.data.type);
    });

    eventManager.on(10, (e) => {
        parseCompleteReceived = true;
        viz.showParseComplete(e.data.success);
    });

    // Simulate parsing: SELECT id, name FROM users WHERE age > 18
    eventManager.handleEvent(8, '{"sql":"SELECT id, name FROM users WHERE age > 18"}');
    eventManager.handleEvent(9, '{"token":"SELECT","type":23}');
    eventManager.handleEvent(9, '{"token":"id","type":1}');
    eventManager.handleEvent(9, '{"token":",","type":44}');
    eventManager.handleEvent(9, '{"token":"name","type":1}');
    eventManager.handleEvent(9, '{"token":"FROM","type":24}');
    eventManager.handleEvent(9, '{"token":"users","type":1}');
    eventManager.handleEvent(9, '{"token":"WHERE","type":33}');
    eventManager.handleEvent(9, '{"token":"age","type":1}');
    eventManager.handleEvent(9, '{"token":">","type":63}');
    eventManager.handleEvent(9, '{"token":"18","type":40}');
    eventManager.handleEvent(10, '{"success":1}');

    if (!parseStartReceived) {
        console.log('✗ PARSE_START not received');
        process.exit(1);
    }
    console.log('✓ PARSE_START event received');

    if (viz.currentSQL !== 'SELECT id, name FROM users WHERE age > 18') {
        console.log('✗ SQL not stored correctly');
        process.exit(1);
    }
    console.log('✓ SQL stored correctly');

    if (tokenCount !== 10) {
        console.log('✗ Expected 10 tokens, got', tokenCount);
        process.exit(1);
    }
    console.log('✓ PARSE_TOKEN: All 10 tokens received');

    if (!parseCompleteReceived) {
        console.log('✗ PARSE_COMPLETE not received');
        process.exit(1);
    }
    console.log('✓ PARSE_COMPLETE event received');
    console.log('✅ SQL Parse End-to-End Flow: PASS\n');

} catch (e) {
    console.log('✗ SQL Parse End-to-End Flow: FAIL -', e.message);
    console.log(e.stack);
    process.exit(1);
}

console.log('Test 3: Complete B-Tree Flow with Event Manager');
console.log('───────────────────────────────────────────────');

try {
    const viz = new BTreeVisualizer('visualization-canvas');

    let pageAllocateCount = 0;
    let btreeInsertCount = 0;
    let btreeDeleteCount = 0;
    let btreeSplitCount = 0;

    eventManager.on(6, (e) => {
        pageAllocateCount++;
        viz.addPage(e.data.page, e.data.type);
    });

    eventManager.on(2, (e) => {
        btreeInsertCount++;
        viz.addCell(e.data.page, e.data.cell, e.data.keyLen);
    });

    eventManager.on(4, (e) => {
        btreeSplitCount++;
        viz.splitPage(e.data.originalPage, e.data.newPage, e.data.splitCell);
    });

    eventManager.on(3, (e) => {
        btreeDeleteCount++;
        viz.deleteCell(e.data.page, e.data.cell);
    });

    // Simulate B-tree operations for table creation and insertion
    eventManager.handleEvent(6, '{"page":1,"type":5}');  // Allocate leaf page
    eventManager.handleEvent(2, '{"page":1,"cell":0,"keyLen":10}');  // Insert row 1
    eventManager.handleEvent(2, '{"page":1,"cell":1,"keyLen":10}');  // Insert row 2
    eventManager.handleEvent(2, '{"page":1,"cell":2,"keyLen":10}');  // Insert row 3
    eventManager.handleEvent(4, '{"originalPage":1,"newPage":2,"splitCell":1}');  // Page split
    eventManager.handleEvent(2, '{"page":2,"cell":0,"keyLen":10}');  // Insert into new page
    eventManager.handleEvent(3, '{"page":1,"cell":0}');  // Delete from page 1

    if (pageAllocateCount !== 1) {
        console.log('✗ Expected 1 page allocate, got', pageAllocateCount);
        process.exit(1);
    }
    console.log('✓ PAGE_ALLOCATE: 1 page allocated');

    if (btreeInsertCount !== 4) {
        console.log('✗ Expected 4 inserts, got', btreeInsertCount);
        process.exit(1);
    }
    console.log('✓ BTREE_INSERT: 4 cells inserted');

    if (btreeSplitCount !== 1) {
        console.log('✗ Expected 1 split, got', btreeSplitCount);
        process.exit(1);
    }
    console.log('✓ BTREE_SPLIT: Page split executed');

    if (btreeDeleteCount !== 1) {
        console.log('✗ Expected 1 delete, got', btreeDeleteCount);
        process.exit(1);
    }
    console.log('✓ BTREE_DELETE: Cell deleted');

    if (viz.nodes.size !== 2) {
        console.log('✗ Expected 2 nodes, got', viz.nodes.size);
        process.exit(1);
    }
    console.log('✓ B-Tree visualization: 2 pages rendered');

    console.log('✅ B-Tree End-to-End Flow: PASS\n');

} catch (e) {
    console.log('✗ B-Tree End-to-End Flow: FAIL -', e.message);
    console.log(e.stack);
    process.exit(1);
}

console.log('Test 4: Complex Multi-Component Scenario');
console.log('─────────────────────────────────────');

try {
    // This test creates fresh listeners for a new visualizer
    // to verify all three components work together

    const viz = new BTreeVisualizer('visualization-canvas');
    let parseCount = 0;
    let vdbeCount = 0;
    let btreeCount = 0;

    // Register fresh listeners that call this specific visualizer
    eventManager.on(8, (e) => {
        parseCount++;
        viz.showParseStart(e.data.sql);
    });

    eventManager.on(9, (e) => {
        viz.showParseToken(e.data.token, e.data.type);
    });

    eventManager.on(11, (e) => {
        vdbeCount++;
        viz.showVdbeStart(e.data.numOpcodes);
    });

    eventManager.on(12, (e) => {
        viz.showVdbeOpcode(e.data.pc, e.data.opcode, e.data.p1, e.data.p2, e.data.p3);
    });

    eventManager.on(6, (e) => {
        btreeCount++;
        viz.addPage(e.data.page, e.data.type);
    });

    // 1. Parse phase
    viz.setViewMode('parse');
    eventManager.handleEvent(8, '{"sql":"SELECT * FROM users"}');
    eventManager.handleEvent(9, '{"token":"SELECT","type":23}');
    eventManager.handleEvent(9, '{"token":"*","type":1}');
    eventManager.handleEvent(9, '{"token":"FROM","type":24}');
    eventManager.handleEvent(9, '{"token":"users","type":1}');
    eventManager.handleEvent(10, '{"success":1}');

    if (viz.parseTokens.length < 4) {
        console.log('✗ Parse phase failed - expected at least 4 tokens, got', viz.parseTokens.length);
        process.exit(1);
    }
    console.log('✓ Parse phase:', viz.parseTokens.length, 'tokens processed');

    // 2. VDBE execution phase - verify VDBE visualization
    viz.setViewMode('vdbe');
    eventManager.handleEvent(11, '{"numOpcodes":3}');
    eventManager.handleEvent(12, '{"pc":0,"opcode":"Init","p1":0,"p2":0,"p3":0}');
    eventManager.handleEvent(12, '{"pc":1,"opcode":"OpenRead","p1":0,"p2":2,"p3":0}');
    eventManager.handleEvent(13, '{"resultCode":0}');

    if (viz.vdbeCurrentPc !== 1) {
        console.log('✗ VDBE phase failed');
        process.exit(1);
    }
    console.log('✓ VDBE phase: 2 opcodes executed');

    // 3. B-tree operations phase - verify B-tree visualization
    viz.setViewMode('btree');
    eventManager.handleEvent(6, '{"page":1,"type":5}');
    eventManager.handleEvent(2, '{"page":1,"cell":0,"keyLen":4}');

    if (viz.nodes.size !== 1) {
        console.log('✗ B-tree phase failed');
        process.exit(1);
    }
    console.log('✓ B-tree phase: Page created and cell inserted');

    // Verify event counts
    if (parseCount !== 1 || vdbeCount !== 1 || btreeCount !== 1) {
        console.log('✗ Event counts incorrect');
        process.exit(1);
    }
    console.log('✓ Event routing: All events received');

    console.log('✅ Multi-Component Scenario: PASS\n');

} catch (e) {
    console.log('✗ Multi-Component Scenario: FAIL -', e.message);
    console.log(e.stack);
    process.exit(1);
}

console.log('═══════════════════════════════════════');
console.log('  ALL END-TO-END TESTS PASSED');
console.log('═══════════════════════════════════════');
console.log();
console.log('Verified:');
console.log('  ✓ VDBE complete event flow (START → OPCODE → COMPLETE)');
console.log('  ✓ SQL parse complete flow (START → TOKEN → COMPLETE)');
console.log('  ✓ B-tree complete flow (ALLOCATE → INSERT → SPLIT → DELETE)');
console.log('  ✓ Multi-component integration scenarios');
console.log('  ✓ Event manager routing to visualizer');
console.log('  ✓ View mode switching between components');
console.log();

process.exit(0);
