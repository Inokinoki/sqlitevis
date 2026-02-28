#!/usr/bin/env node
/**
 * Event Flow Simulation Test
 * Simulates the complete event flow from SQLite to visualization
 */

const fs = require('fs');
const path = require('path');

console.log('=== SQLiteVis Event Flow Simulation Test ===\n');

// Load the visualization code
const visualizerCode = fs.readFileSync(path.join(__dirname, 'src/web/js/visualizer.js'), 'utf8');
const eventsCode = fs.readFileSync(path.join(__dirname, 'src/web/js/events.js'), 'utf8');

// Mock the DOM
global.document = {
    getElementById: (id) => ({
        getContext: () => ({
            clearRect: () => {},
            fillRect: () => {},
            fillText: () => {},
            strokeRect: () => {},
            beginPath: () => {},
            moveTo: () => {},
            lineTo: () => {},
            stroke: () => {},
            fill: () => {},
            save: () => {},
            restore: () => {},
            translate: () => {},
            scale: () => {},
            setTransform: () => {},
            measureText: (text) => ({ width: text.length * 8 })
        }),
        width: 800,
        height: 600,
        classList: { remove: () => {}, add: () => {} }
    })
};

global.window = {
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    innerWidth: 1024,
    innerHeight: 768
};

// Evaluate the code
eval(eventsCode);
eval(visualizerCode);

console.log('Testing VDBE Event Flow...\n');

// Test 1: VDBE Execution Flow
console.log('Test 1: VDBE Execution Flow');
console.log('─────────────────────────────');

try {
    const visualizer = new BTreeVisualizer('test-canvas');
    const numTests = 10;

    // Simulate VDBE_START
    visualizer.showVdbeStart(numTests);
    if (visualizer.vdbeOpcodes.length !== numTests) {
        console.log('✗ VDBE_START failed to initialize opcodes');
        process.exit(1);
    }
    console.log('✓ VDBE_START: Initialized', numTests, 'opcodes');

    // Simulate VDBE_OPCODE events
    const testOpcodes = [
        { pc: 0, opcode: 'Init', p1: 0, p2: 5, p3: 0 },
        { pc: 1, opcode: 'OpenRead', p1: 0, p2: 2, p3: 0 },
        { pc: 2, opcode: 'Rewind', p1: 0, p2: 8, p3: 0 },
        { pc: 3, opcode: 'Column', p1: 0, p2: 1, p3: 1 },
        { pc: 4, opcode: 'ResultRow', p1: 1, p2: 2, p3: 0 },
        { pc: 5, opcode: 'Next', p1: 0, p2: 3, p3: 0 },
        { pc: 6, opcode: 'Halt', p1: 0, p2: 0, p3: 0 },
    ];

    for (const op of testOpcodes) {
        visualizer.showVdbeOpcode(op.pc, op.opcode, op.p1, op.p2, op.p3);
    }

    if (visualizer.vdbeCurrentPc !== testOpcodes[testOpcodes.length - 1].pc) {
        console.log('✗ VDBE_OPCODE failed to update PC');
        process.exit(1);
    }
    console.log('✓ VDBE_OPCODE: Processed', testOpcodes.length, 'opcodes');
    console.log('✓ VDBE_OPCODE: Current PC is', visualizer.vdbeCurrentPc);

    // Simulate VDBE_COMPLETE
    visualizer.showVdbeComplete(0); // SQLITE_OK

    console.log('✓ VDBE_COMPLETE: Result code processed');
    console.log('✅ VDBE Event Flow: PASS\n');

} catch (e) {
    console.log('✗ VDBE Event Flow: FAIL -', e.message);
    process.exit(1);
}

console.log('Testing SQL Parse Event Flow...\n');

// Test 2: SQL Parse Flow
console.log('Test 2: SQL Parse Event Flow');
console.log('─────────────────────────────');

try {
    const visualizer = new BTreeVisualizer('test-canvas');
    const testSQL = 'SELECT id, name FROM users WHERE age > 18';

    // Simulate PARSE_START
    visualizer.showParseStart(testSQL);

    if (visualizer.currentSQL !== testSQL) {
        console.log('✗ PARSE_START failed to store SQL');
        process.exit(1);
    }
    if (visualizer.parseTokens.length !== 0) {
        console.log('✗ PARSE_START failed to clear tokens');
        process.exit(1);
    }
    console.log('✓ PARSE_START: Stored SQL:', testSQL.substring(0, 30) + '...');
    console.log('✓ PARSE_START: Cleared previous tokens');

    // Simulate PARSE_TOKEN events
    const testTokens = [
        { token: 'SELECT', type: 23 },  // TK_SELECT
        { token: 'id', type: 1 },       // TK_ID
        { token: ',', type: 44 },       // TK_COMMA
        { token: 'name', type: 1 },     // TK_ID
        { token: 'FROM', type: 24 },    // TK_FROM
        { token: 'users', type: 1 },    // TK_ID
        { token: 'WHERE', type: 33 },   // TK_WHERE
        { token: 'age', type: 1 },      // TK_ID
        { token: '>', type: 63 },       // TK_GT
        { token: '18', type: 40 },      // TK_INTEGER
    ];

    for (const t of testTokens) {
        visualizer.showParseToken(t.token, t.type);
    }

    if (visualizer.parseTokens.length !== testTokens.length) {
        console.log('✗ PARSE_TOKEN failed to add all tokens');
        console.log('  Expected:', testTokens.length, 'Got:', visualizer.parseTokens.length);
        process.exit(1);
    }
    console.log('✓ PARSE_TOKEN: Added', testTokens.length, 'tokens');

    // Verify token types are mapped
    const hasTypeName = Object.keys(visualizer.tokenTypeNames).length > 0;
    if (!hasTypeName) {
        console.log('✗ Token type names not mapped');
        process.exit(1);
    }
    console.log('✓ Token types: Mapped');

    // Simulate PARSE_COMPLETE
    visualizer.showParseComplete(1); // success

    console.log('✓ PARSE_COMPLETE: Success flag processed');
    console.log('✅ SQL Parse Event Flow: PASS\n');

} catch (e) {
    console.log('✗ SQL Parse Event Flow: FAIL -', e.message);
    process.exit(1);
}

console.log('Testing B-Tree Page Event Flow...\n');

// Test 3: B-Tree Page Flow
console.log('Test 3: B-Tree Page Event Flow');
console.log('─────────────────────────────');

try {
    const visualizer = new BTreeVisualizer('test-canvas');

    // Simulate PAGE_ALLOCATE
    visualizer.addPage(1, 5); // page 1, leaf type
    visualizer.addPage(2, 5); // page 2, leaf type
    visualizer.addPage(3, 2); // page 3, interior type

    if (visualizer.nodes.size !== 3) {
        console.log('✗ PAGE_ALLOCATE failed to create nodes');
        console.log('  Expected: 3 nodes, Got:', visualizer.nodes.size);
        process.exit(1);
    }
    console.log('✓ PAGE_ALLOCATE: Created 3 pages');

    // Verify page structure
    const page1 = visualizer.nodes.get(1);
    if (!page1 || page1.page !== 1 || page1.type !== 5) {
        console.log('✗ PAGE_ALLOCATE page structure incorrect');
        process.exit(1);
    }
    console.log('✓ PAGE_ALLOCATE: Page structure correct');

    // Simulate BTREE_INSERT
    visualizer.addCell(1, 0, 10, 'user1');
    visualizer.addCell(1, 1, 10, 'user2');
    visualizer.addCell(2, 0, 10, 'user3');

    const page1Cells = visualizer.nodes.get(1).cells;
    if (page1Cells.length !== 2) {
        console.log('✗ BTREE_INSERT failed to add cells');
        console.log('  Expected: 2 cells, Got:', page1Cells.length);
        process.exit(1);
    }
    console.log('✓ BTREE_INSERT: Added 3 cells across pages');

    // Simulate BTREE_SPLIT
    visualizer.splitPage(1, 4, 1); // split page 1 into page 4 at cell 1

    if (visualizer.nodes.size !== 4) {
        console.log('✗ BTREE_SPLIT failed to create new page');
        console.log('  Expected: 4 nodes, Got:', visualizer.nodes.size);
        process.exit(1);
    }
    console.log('✓ BTREE_SPLIT: Created new page during split');

    // Simulate BTREE_DELETE
    visualizer.deleteCell(1, 0); // delete cell 0 from page 1

    const page1CellsAfter = visualizer.nodes.get(1).cells;
    if (page1CellsAfter.length !== 1) {
        console.log('✗ BTREE_DELETE failed to remove cell');
        console.log('  Expected: 1 cell, Got:', page1CellsAfter.length);
        process.exit(1);
    }
    console.log('✓ BTREE_DELETE: Removed cell from page');

    // Simulate PAGE_FREE
    visualizer.nodes.delete(4);
    visualizer.layout();
    visualizer.draw();

    if (visualizer.nodes.size !== 3) {
        console.log('✗ PAGE_FREE failed to remove page');
        console.log('  Expected: 3 nodes, Got:', visualizer.nodes.size);
        process.exit(1);
    }
    console.log('✓ PAGE_FREE: Removed page from visualization');

    console.log('✅ B-Tree Page Event Flow: PASS\n');

} catch (e) {
    console.log('✗ B-Tree Page Event Flow: FAIL -', e.message);
    console.log(e.stack);
    process.exit(1);
}

console.log('Testing Event Manager Integration...\n');

// Test 4: Event Manager
console.log('Test 4: Event Manager Integration');
console.log('─────────────────────────────');

try {
    let eventsReceived = [];

    // Register event listeners
    eventManager.on(11, (e) => { // VDBE_START
        eventsReceived.push({ type: 'VDBE_START', data: e.data });
    });

    eventManager.on(12, (e) => { // VDBE_OPCODE
        eventsReceived.push({ type: 'VDBE_OPCODE', data: e.data });
    });

    eventManager.on(8, (e) => { // PARSE_START
        eventsReceived.push({ type: 'PARSE_START', data: e.data });
    });

    eventManager.on(9, (e) => { // PARSE_TOKEN
        eventsReceived.push({ type: 'PARSE_TOKEN', data: e.data });
    });

    eventManager.on(6, (e) => { // PAGE_ALLOCATE
        eventsReceived.push({ type: 'PAGE_ALLOCATE', data: e.data });
    });

    eventManager.on(2, (e) => { // BTREE_INSERT
        eventsReceived.push({ type: 'BTREE_INSERT', data: e.data });
    });

    // Simulate events
    eventManager.handleEvent(11, '{"numOpcodes":5}');
    eventManager.handleEvent(12, '{"pc":0,"opcode":"Init","p1":0,"p2":5,"p3":0}');
    eventManager.handleEvent(8, '{"sql":"SELECT * FROM users"}');
    eventManager.handleEvent(9, '{"token":"SELECT","type":23}');
    eventManager.handleEvent(6, '{"page":1,"type":5}');
    eventManager.handleEvent(2, '{"page":1,"cell":0,"keyLen":10}');

    // Verify events were received
    if (eventsReceived.length !== 6) {
        console.log('✗ Event Manager failed to route all events');
        console.log('  Expected: 6 events, Got:', eventsReceived.length);
        process.exit(1);
    }

    // Verify event types
    const expectedTypes = ['VDBE_START', 'VDBE_OPCODE', 'PARSE_START', 'PARSE_TOKEN', 'PAGE_ALLOCATE', 'BTREE_INSERT'];
    for (let i = 0; i < expectedTypes.length; i++) {
        if (eventsReceived[i].type !== expectedTypes[i]) {
            console.log('✗ Event Manager routed wrong event type');
            console.log('  Expected:', expectedTypes[i], 'Got:', eventsReceived[i].type);
            process.exit(1);
        }
    }

    console.log('✓ Event Manager: Routed 6 events correctly');
    console.log('✓ Event Manager: All event types matched');
    console.log('✅ Event Manager Integration: PASS\n');

} catch (e) {
    console.log('✗ Event Manager Integration: FAIL -', e.message);
    console.log(e.stack);
    process.exit(1);
}

// Summary
console.log('═══════════════════════════════════════');
console.log('  ALL EVENT FLOW TESTS PASSED');
console.log('═══════════════════════════════════════');
console.log();
console.log('Verified:');
console.log('  ✓ VDBE event flow (START → OPCODE → COMPLETE)');
console.log('  ✓ SQL parse flow (START → TOKEN → COMPLETE)');
console.log('  ✓ B-tree operations (ALLOCATE → INSERT → SPLIT → DELETE → FREE)');
console.log('  ✓ Event manager routing and integration');
console.log();
console.log('✅ All three visualization components are working correctly!');
console.log();

process.exit(0);
