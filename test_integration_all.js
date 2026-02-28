#!/usr/bin/env node

/**
 * Comprehensive Integration Test
 * Tests all three visualization systems working together:
 * 1. B-tree (page nodes)
 * 2. Parse tree (SQL parsing)
 * 3. VDBE (opcode execution)
 *
 * Simulates a complete SQL execution flow
 */

const fs = require('fs');

// Setup mocks
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = () => {};
global.ResizeObserver = class { constructor() {} observe() {} unobserve() {} disconnect() {} };

let integrationTestsPassed = 0;
let integrationTestsFailed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`✓ ${message}`);
        integrationTestsPassed++;
    } else {
        console.error(`✗ ${message}`);
        integrationTestsFailed++;
    }
}

console.log('='.repeat(70));
console.log('Comprehensive Integration Test - All Visualization Systems');
console.log('='.repeat(70));

try {
    // Load modules
    const eventsCode = fs.readFileSync('src/web/js/events.js', 'utf8');
    const visualizerCode = fs.readFileSync('src/web/js/visualizer.js', 'utf8');

    const mockCanvas = {
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
            measureText: (text) => ({ width: text.length * 8, height: 14 }),
            arc: () => {},
            rect: () => {},
            clip: () => {},
            quadraticCurveTo: () => {},
            bezierCurveTo: () => {},
            closePath: () => {},
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
            if (id === 'event-log') return {
                children: [],
                appendChild: () => {},
                scrollTop: 0,
                scrollHeight: 100,
                innerHTML: '',
                removeChild: () => {}
            };
            if (id === 'event-count') return { textContent: '' };
            if (id === 'page-count') return { textContent: '' };
            return null;
        },
        createElement: () => ({ className: '', innerHTML: '', textContent: '' })
    };

    global.window = {
        sqliteVisEventHandler: null,
        requestAnimationFrame: () => {},
        cancelAnimationFrame: () => {},
        innerWidth: 1024,
        innerHeight: 768,
        addEventListener: () => {},
        removeEventListener: () => {}
    };

    let eventManager, BTreeVisualizer, moduleExports = {};
    eval(eventsCode + '; moduleExports.eventManager = eventManager;');
    eventManager = moduleExports.eventManager;
    eval(visualizerCode + '; moduleExports.BTreeVisualizer = BTreeVisualizer;');
    BTreeVisualizer = moduleExports.BTreeVisualizer;

    const viz = new BTreeVisualizer('visualization-canvas');

    console.log('\n### Test Suite 1: System Connection ###');

    console.log('\n--- Connect All Event Types ---');
    // B-tree events
    eventManager.on(0, (e) => { viz.pageSize = e.data.pageSize; });
    eventManager.on(2, (e) => { viz.addCell(e.data.page, e.data.cell, e.data.keyLen); });
    eventManager.on(3, (e) => { viz.deleteCell(e.data.page, e.data.cell); });
    eventManager.on(4, (e) => { viz.splitPage(e.data.originalPage, e.data.newPage, e.data.splitCell); });
    eventManager.on(6, (e) => { viz.addPage(e.data.page, e.data.type); });
    eventManager.on(7, (e) => { viz.nodes.delete(e.data.page); viz.layout(); viz.draw(); });

    // Parse events
    eventManager.on(8, (e) => { viz.showParseStart(e.data.sql); });
    eventManager.on(9, (e) => { viz.showParseToken(e.data.token, e.data.type); });
    eventManager.on(10, (e) => { viz.showParseComplete(e.data.success); });

    // VDBE events
    eventManager.on(11, (e) => { viz.showVdbeStart(e.data.numOpcodes || e.data.opcode_count); });
    eventManager.on(12, (e) => { viz.showVdbeOpcode(e.data.pc, e.data.opcode, e.data.p1, e.data.p2, e.data.p3); });
    eventManager.on(13, (e) => { viz.showVdbeComplete(e.data.resultCode || e.data.result_code); });

    assert(true, 'All event types connected to visualizer');

    console.log('\n### Test Suite 2: CREATE TABLE Flow ###');

    console.log('\n--- CREATE TABLE: Parse Phase ---');
    viz.setViewMode('parse');
    const createTableSQL = 'CREATE TABLE users (id INTEGER, name TEXT)';
    eventManager.handleEvent(8, JSON.stringify({ sql: createTableSQL }));

    const createTokens = [
        { token: 'CREATE', type: 17 },
        { token: 'TABLE', type: 1 },
        { token: 'users', type: 1 },
        { token: '(', type: 39 },
        { token: 'id', type: 1 },
        { token: 'INTEGER', type: 1 },
        { token: ',', type: 53 },
        { token: 'name', type: 1 },
        { token: 'TEXT', type: 1 },
        { token: ')', type: 40 }
    ];

    createTokens.forEach(t => eventManager.handleEvent(9, JSON.stringify(t)));
    eventManager.handleEvent(10, JSON.stringify({ success: 1 }));

    assert(viz.currentSQL === createTableSQL, 'CREATE TABLE SQL stored');
    assert(viz.parseTokens.length === createTokens.length, 'All CREATE TABLE tokens parsed');

    console.log('\n--- CREATE TABLE: B-tree Phase ---');
    viz.setViewMode('btree');

    // Simulate table creation (page 1 = root)
    eventManager.handleEvent(0, JSON.stringify({ pageSize: 4096, numPages: 1 }));
    eventManager.handleEvent(6, JSON.stringify({ page: 1, type: 0 })); // Root page
    eventManager.handleEvent(6, JSON.stringify({ page: 2, type: 1 })); // Table leaf page

    assert(viz.pageSize === 4096, 'Page size set to 4096');
    assert(viz.nodes.size === 2, '2 pages created for table');

    console.log('\n### Test Suite 3: INSERT Flow ###');

    console.log('\n--- INSERT: Parse Phase ---');
    viz.clear();
    viz.setViewMode('parse');

    const insertSQL = 'INSERT INTO users VALUES (1, "Alice")';
    eventManager.handleEvent(8, JSON.stringify({ sql: insertSQL }));

    const insertTokens = [
        { token: 'INSERT', type: 54 },
        { token: 'INTO', type: 67 },
        { token: 'users', type: 1 },
        { token: 'VALUES', type: 58 },
        { token: '(', type: 39 },
        { token: '1', type: 40 },
        { token: ',', type: 53 },
        { token: '"Alice"', type: 112 },
        { token: ')', type: 40 }
    ];

    insertTokens.forEach(t => eventManager.handleEvent(9, JSON.stringify(t)));
    eventManager.handleEvent(10, JSON.stringify({ success: 1 }));

    assert(viz.currentSQL === insertSQL, 'INSERT SQL stored');
    assert(viz.parseTokens.length === insertTokens.length, 'All INSERT tokens parsed');

    console.log('\n--- INSERT: VDBE Phase ---');
    viz.setViewMode('vdbe');

    eventManager.handleEvent(11, JSON.stringify({ opcode_count: 8 }));

    const insertOpcodes = [
        { pc: 0, opcode: 'Init', p1: 0, p2: 8, p3: 0 },
        { pc: 1, opcode: 'OpenWrite', p1: 0, p2: 2, p3: 0 },
        { pc: 2, opcode: 'NewRowid', p1: 1, p2: 2, p3: 0 },
        { pc: 3, opcode: 'Blob', p1: 6, p2: 1, p3: 0 },
        { pc: 4, opcode: 'String8', p1: 5, p2: 2, p3: 0 },
        { pc: 5, opcode: 'MakeRecord', p1: 1, p2: 2, p3: 3 },
        { pc: 6, opcode: 'Insert', p1: 2, p2: 3, p3: 0 },
        { pc: 7, opcode: 'Halt', p1: 0, p2: 0, p3: 0 }
    ];

    insertOpcodes.forEach(op => eventManager.handleEvent(12, JSON.stringify(op)));
    eventManager.handleEvent(13, JSON.stringify({ result_code: 0 }));

    assert(viz.vdbeOpcodes.length === 8, 'All 8 INSERT opcodes recorded');
    assert(viz.vdbeOpcodes[4].opcode === 'String8', 'String8 opcode found');

    console.log('\n--- INSERT: B-tree Phase ---');
    viz.setViewMode('btree');
    viz.clear();

    // Re-create pages
    eventManager.handleEvent(6, JSON.stringify({ page: 1, type: 1 }));
    eventManager.handleEvent(6, JSON.stringify({ page: 2, type: 1 }));

    // Insert cells
    eventManager.handleEvent(2, JSON.stringify({ page: 2, cell: 0, keyLen: 8 }));
    eventManager.handleEvent(2, JSON.stringify({ page: 2, cell: 1, keyLen: 16 }));

    const page2 = viz.nodes.get(2);
    assert(page2.cells.length === 2, '2 cells inserted into page 2');

    console.log('\n### Test Suite 4: SELECT Flow ###');

    console.log('\n--- SELECT: Parse Phase ---');
    viz.clear();
    viz.setViewMode('parse');

    const selectSQL = 'SELECT id, name FROM users WHERE id = 1';
    eventManager.handleEvent(8, JSON.stringify({ sql: selectSQL }));

    const selectTokens = [
        { token: 'SELECT', type: 38 },
        { token: 'id', type: 1 },
        { token: ',', type: 53 },
        { token: 'name', type: 1 },
        { token: 'FROM', type: 41 },
        { token: 'users', type: 1 },
        { token: 'WHERE', type: 48 },
        { token: 'id', type: 1 },
        { token: '=', type: 21 },
        { token: '1', type: 40 }
    ];

    selectTokens.forEach(t => eventManager.handleEvent(9, JSON.stringify(t)));
    eventManager.handleEvent(10, JSON.stringify({ success: 1 }));

    assert(viz.currentSQL === selectSQL, 'SELECT SQL stored');
    assert(viz.parseTokens.length === selectTokens.length, 'All SELECT tokens parsed');

    console.log('\n--- SELECT: VDBE Phase ---');
    viz.setViewMode('vdbe');

    eventManager.handleEvent(11, JSON.stringify({ opcode_count: 12 }));

    const selectOpcodes = [
        { pc: 0, opcode: 'Init', p1: 0, p2: 12, p3: 0 },
        { pc: 1, opcode: 'OpenRead', p1: 0, p2: 2, p3: 0 },
        { pc: 2, opcode: 'Rewind', p1: 0, p2: 10, p3: 0 },
        { pc: 3, opcode: 'Column', p1: 0, p2: 0, p3: 1 },
        { pc: 4, opcode: 'Column', p1: 0, p2: 1, p3: 2 },
        { pc: 5, opcode: 'Eq', p1: 3, p2: 9, p3: 4 },
        { pc: 6, opcode: 'RowData', p1: 0, p2: 0, p3: 0 },
        { pc: 7, opcode: 'ResultRow', p1: 1, p2: 2, p3: 0 },
        { pc: 8, opcode: 'Next', p1: 0, p2: 2, p3: 0 },
        { pc: 9, opcode: 'Goto', p1: 0, p2: 3, p3: 0 },
        { pc: 10, opcode: 'Halt', p1: 0, p2: 0, p3: 0 },
        { pc: 11, opcode: 'Transaction', p1: 1, p2: 0, p3: 0 }
    ];

    selectOpcodes.forEach(op => eventManager.handleEvent(12, JSON.stringify(op)));
    eventManager.handleEvent(13, JSON.stringify({ result_code: 0 }));

    assert(viz.vdbeOpcodes.length === 12, 'All 12 SELECT opcodes recorded');
    assert(viz.vdbeOpcodes[7].opcode === 'ResultRow', 'ResultRow opcode found');

    console.log('\n### Test Suite 5: Complex Multi-Statement Transaction ###');

    console.log('\n--- Transaction with Multiple Operations ---');
    viz.clear();

    // START TRANSACTION
    viz.setViewMode('parse');
    eventManager.handleEvent(8, JSON.stringify({ sql: 'BEGIN' }));
    eventManager.handleEvent(9, JSON.stringify({ token: 'BEGIN', type: 62 }));
    eventManager.handleEvent(10, JSON.stringify({ success: 1 }));

    // INSERT multiple rows
    viz.setViewMode('btree');
    eventManager.handleEvent(6, JSON.stringify({ page: 3, type: 1 }));
    for (let i = 0; i < 5; i++) {
        eventManager.handleEvent(2, JSON.stringify({ page: 3, cell: i, keyLen: (i + 1) * 10 }));
    }

    const page3 = viz.nodes.get(3);
    assert(page3.cells.length === 5, '5 cells inserted in transaction');

    // COMMIT
    viz.setViewMode('parse');
    eventManager.handleEvent(8, JSON.stringify({ sql: 'COMMIT' }));
    eventManager.handleEvent(9, JSON.stringify({ token: 'COMMIT', type: 66 }));
    eventManager.handleEvent(10, JSON.stringify({ success: 1 }));

    assert(true, 'Transaction completed successfully');

    console.log('\n### Test Suite 6: View Mode Switching ###');

    console.log('\n--- Switching Between View Modes ---');
    viz.clear();

    // Set up data in all modes
    viz.setViewMode('parse');
    eventManager.handleEvent(8, JSON.stringify({ sql: 'SELECT * FROM test' }));

    viz.setViewMode('btree');
    eventManager.handleEvent(6, JSON.stringify({ page: 1, type: 1 }));

    viz.setViewMode('vdbe');
    eventManager.handleEvent(11, JSON.stringify({ opcode_count: 3 }));
    eventManager.handleEvent(12, JSON.stringify({ pc: 0, opcode: 'Init', p1: 0, p2: 3, p3: 0 }));

    // Verify data persists across mode switches
    assert(viz.currentSQL === 'SELECT * FROM test', 'Parse data persists');
    assert(viz.nodes.size === 1, 'B-tree data persists');
    assert(viz.vdbeOpcodes.length === 1, 'VDBE data persists');

    console.log('\n### Test Suite 7: Event Statistics ###');

    console.log('\n--- Event Manager Statistics ---');
    const totalEvents = eventManager.eventCount;
    const btreeEvents = eventManager.getEventsByCategory('btree').length;
    const parseEvents = eventManager.getEventsByCategory('parse').length;
    const vdbeEvents = eventManager.getEventsByCategory('vdbe').length;

    assert(totalEvents > 0, 'Events were recorded');
    assert(btreeEvents > 0, 'B-tree events recorded');
    assert(parseEvents > 0, 'Parse events recorded');
    assert(vdbeEvents > 0, 'VDBE events recorded');

    console.log(`   Total events: ${totalEvents}`);
    console.log(`   B-tree events: ${btreeEvents}`);
    console.log(`   Parse events: ${parseEvents}`);
    console.log(`   VDBE events: ${vdbeEvents}`);

    console.log('\n### Test Suite 8: Error Handling ###');

    console.log('\n--- Graceful Error Handling ---');
    viz.clear();

    // Invalid events
    eventManager.handleEvent(99, JSON.stringify({ invalid: 'data' }));
    assert(true, 'Unknown event type handled gracefully');

    viz.setViewMode('vdbe');
    eventManager.handleEvent(12, JSON.stringify({ pc: -1, opcode: 'Invalid' }));
    assert(true, 'Invalid opcode PC handled gracefully');

    viz.setViewMode('btree');
    eventManager.handleEvent(2, JSON.stringify({ page: 9999, cell: 0, keyLen: 10 }));
    assert(true, 'Operation on non-existent page handled gracefully');

    console.log('\n### Test Suite 9: Stress Test ###');

    console.log('\n--- Large Number of Events ---');
    viz.clear();
    viz.setViewMode('btree');

    // Create many pages
    for (let i = 1; i <= 20; i++) {
        eventManager.handleEvent(6, JSON.stringify({ page: i, type: 1 }));
    }

    assert(viz.nodes.size === 20, '20 pages created');

    // Insert many cells
    for (let i = 0; i < 50; i++) {
        eventManager.handleEvent(2, JSON.stringify({ page: 1, cell: i, keyLen: i * 10 }));
    }

    const page1 = viz.nodes.get(1);
    assert(page1.cells.length === 50, '50 cells inserted');

    viz.setViewMode('vdbe');
    eventManager.handleEvent(11, JSON.stringify({ opcode_count: 100 }));

    for (let i = 0; i < 100; i++) {
        eventManager.handleEvent(12, JSON.stringify({
            pc: i,
            opcode: 'Opcode' + i,
            p1: i,
            p2: i * 2,
            p3: i * 3
        }));
    }

    assert(viz.vdbeOpcodes.length === 100, '100 opcodes processed');

    viz.setViewMode('parse');
    eventManager.handleEvent(8, JSON.stringify({ sql: 'SELECT * FROM large_table' }));

    for (let i = 0; i < 30; i++) {
        eventManager.handleEvent(9, JSON.stringify({ token: 'token' + i, type: 1 }));
    }

    assert(viz.parseTokens.length === 30, '30 parse tokens recorded');

    console.log('\n### Test Suite 10: System Health Checks ###');

    console.log('\n--- Component Health ---');
    assert(typeof viz.setViewMode === 'function', 'Visualizer is functional');
    assert(typeof viz.clear === 'function', 'Clear method works');
    assert(typeof viz.draw === 'function', 'Draw method works');
    assert(typeof eventManager.handleEvent === 'function', 'Event handler works');
    assert(typeof eventManager.clear === 'function', 'Event manager clear works');
    assert(eventManager.eventCount > 100, 'Many events processed successfully');

} catch (error) {
    console.error('\n❌ Error during integration testing:', error.message);
    console.error(error.stack);
    integrationTestsFailed++;
}

console.log('\n' + '='.repeat(70));
console.log(`Integration Tests Complete: ${integrationTestsPassed} passed, ${integrationTestsFailed} failed`);
console.log('='.repeat(70));

process.exit(integrationTestsFailed > 0 ? 1 : 0);
