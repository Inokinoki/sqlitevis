#!/usr/bin/env node

/**
 * End-to-End System Validation
 * Tests complete workflows from SQL input through all three visualization systems
 */

const fs = require('fs');

global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = () => {};
global.ResizeObserver = class { constructor() {} observe() {} unobserve() {} disconnect() {} };

let e2eTestsPassed = 0;
let e2eTestsFailed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`✓ ${message}`);
        e2eTestsPassed++;
    } else {
        console.error(`✗ ${message}`);
        e2eTestsFailed++;
    }
}

console.log('='.repeat(70));
console.log('End-to-End System Validation');
console.log('='.repeat(70));

try {
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

    // Connect all events
    eventManager.on(2, (e) => { viz.addCell(e.data.page, e.data.cell, e.data.keyLen); });
    eventManager.on(3, (e) => { viz.deleteCell(e.data.page, e.data.cell); });
    eventManager.on(4, (e) => { viz.splitPage(e.data.originalPage, e.data.newPage, e.data.splitCell); });
    eventManager.on(6, (e) => { viz.addPage(e.data.page, e.data.type); });
    eventManager.on(8, (e) => { viz.showParseStart(e.data.sql); });
    eventManager.on(9, (e) => { viz.showParseToken(e.data.token, e.data.type); });
    eventManager.on(10, (e) => { viz.showParseComplete(e.data.success); });
    eventManager.on(11, (e) => { viz.showVdbeStart(e.data.numOpcodes || e.data.opcode_count); });
    eventManager.on(12, (e) => { viz.showVdbeOpcode(e.data.pc, e.data.opcode, e.data.p1, e.data.p2, e.data.p3); });
    eventManager.on(13, (e) => { viz.showVdbeComplete(e.data.resultCode || e.data.result_code); });

    const viz = new BTreeVisualizer('visualization-canvas');

    console.log('\n### E2E Test 1: Complete CREATE TABLE Workflow ###');

    console.log('\n--- Step 1: Parse CREATE TABLE ---');
    viz.setViewMode('parse');
    const createSQL = 'CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, department TEXT)';
    eventManager.handleEvent(8, JSON.stringify({ sql: createSQL }));

    const createTokens = [
        { token: 'CREATE', type: 17 },
        { token: 'TABLE', type: 1 },
        { token: 'employees', type: 1 },
        { token: '(', type: 39 },
        { token: 'id', type: 1 },
        { token: 'INTEGER', type: 1 },
        { token: 'PRIMARY', type: 89 },
        { token: 'KEY', type: 79 },
        { token: ',', type: 53 },
        { token: 'name', type: 1 },
        { token: 'TEXT', type: 1 },
        { token: ',', type: 53 },
        { token: 'department', type: 1 },
        { token: 'TEXT', type: 1 },
        { token: ')', type: 40 }
    ];

    createTokens.forEach(t => eventManager.handleEvent(9, JSON.stringify(t)));
    eventManager.handleEvent(10, JSON.stringify({ success: 1 }));

    assert(viz.currentSQL === createSQL, 'Step 1: CREATE TABLE SQL parsed');
    assert(viz.parseTokens.length === createTokens.length, 'Step 1: All tokens captured');

    console.log('\n--- Step 2: B-tree Table Creation ---');
    viz.setViewMode('btree');
    eventManager.handleEvent(6, JSON.stringify({ page: 1, type: 1 })); // Employees table leaf page

    assert(viz.nodes.has(1), 'Step 2: Employees page created');
    assert(viz.nodes.get(1).type === 1, 'Step 2: Page type is leaf');

    console.log('\n--- Step 3: VDBE for CREATE TABLE ---');
    viz.setViewMode('vdbe');
    eventManager.handleEvent(11, JSON.stringify({ opcode_count: 5 }));

    const createOpcodes = [
        { pc: 0, opcode: 'Init', p1: 0, p2: 5, p3: 0 },
        { pc: 1, opcode: 'Transaction', p1: 1, p2: 0, p3: 0 },
        { pc: 2, opcode: 'TableLock', p1: 0, p2: 1, p3: 0 },
        { pc: 3, opcode: 'OpenWrite', p1: 0, p2: 1, p3: 0 },
        { pc: 4, opcode: 'Halt', p1: 0, p2: 0, p3: 0 }
    ];

    createOpcodes.forEach(op => eventManager.handleEvent(12, JSON.stringify(op)));
    eventManager.handleEvent(13, JSON.stringify({ result_code: 0 }));

    assert(viz.vdbeOpcodes.length === 5, 'Step 3: All CREATE TABLE opcodes recorded');
    assert(viz.vdbeOpcodes[2].opcode === 'TableLock', 'Step 3: TableLock opcode present');

    console.log('\n### E2E Test 2: Complete INSERT Workflow ###');

    console.log('\n--- Step 1: Parse INSERT ---');
    viz.clear();
    viz.setViewMode('parse');
    const insertSQL = 'INSERT INTO employees VALUES (1, "John Doe", "Engineering")';
    eventManager.handleEvent(8, JSON.stringify({ sql: insertSQL }));

    const insertTokens = [
        { token: 'INSERT', type: 54 },
        { token: 'INTO', type: 67 },
        { token: 'employees', type: 1 },
        { token: 'VALUES', type: 58 },
        { token: '(', type: 39 },
        { token: '1', type: 40 },
        { token: ',', type: 53 },
        { token: '"John Doe"', type: 112 },
        { token: ',', type: 53 },
        { token: '"Engineering"', type: 112 },
        { token: ')', type: 40 }
    ];

    insertTokens.forEach(t => eventManager.handleEvent(9, JSON.stringify(t)));
    eventManager.handleEvent(10, JSON.stringify({ success: 1 }));

    assert(viz.currentSQL === insertSQL, 'Step 1: INSERT SQL parsed');

    console.log('\n--- Step 2: B-tree Cell Insertion ---');
    viz.setViewMode('btree');
    eventManager.handleEvent(6, JSON.stringify({ page: 1, type: 1 })); // Recreate page after clear
    eventManager.handleEvent(2, JSON.stringify({ page: 1, cell: 0, keyLen: 50 }));

    assert(viz.nodes.get(1).cells.length === 1, 'Step 2: Employee record inserted');

    console.log('\n--- Step 3: VDBE for INSERT ---');
    viz.setViewMode('vdbe');
    eventManager.handleEvent(11, JSON.stringify({ opcode_count: 8 }));

    const insertOpcodes = [
        { pc: 0, opcode: 'Init', p1: 0, p2: 8, p3: 0 },
        { pc: 1, opcode: 'OpenWrite', p1: 0, p2: 1, p3: 0 },
        { pc: 2, opcode: 'NewRowid', p1: 1, p2: 2, p3: 0 },
        { pc: 3, opcode: 'Blob', p1: 6, p2: 1, p3: 0 },
        { pc: 4, opcode: 'String8', p1: 5, p2: 2, p3: 0 },
        { pc: 5, opcode: 'MakeRecord', p1: 1, p2: 2, p3: 3 },
        { pc: 6, opcode: 'Insert', p1: 2, p2: 3, p3: 0 },
        { pc: 7, opcode: 'Halt', p1: 0, p2: 0, p3: 0 }
    ];

    insertOpcodes.forEach(op => eventManager.handleEvent(12, JSON.stringify(op)));
    eventManager.handleEvent(13, JSON.stringify({ result_code: 0 }));

    assert(viz.vdbeOpcodes.length === 8, 'Step 3: All INSERT opcodes recorded');
    assert(viz.vdbeOpcodes[6].opcode === 'Insert', 'Step 3: Insert opcode present');

    console.log('\n### E2E Test 3: Complete SELECT Workflow ###');

    console.log('\n--- Step 1: Parse SELECT ---');
    viz.clear();
    viz.setViewMode('parse');
    const selectSQL = 'SELECT id, name FROM employees WHERE department = "Engineering"';
    eventManager.handleEvent(8, JSON.stringify({ sql: selectSQL }));

    const selectTokens = [
        { token: 'SELECT', type: 38 },
        { token: 'id', type: 1 },
        { token: ',', type: 53 },
        { token: 'name', type: 1 },
        { token: 'FROM', type: 41 },
        { token: 'employees', type: 1 },
        { token: 'WHERE', type: 48 },
        { token: 'department', type: 1 },
        { token: '=', type: 21 },
        { token: '"Engineering"', type: 112 }
    ];

    selectTokens.forEach(t => eventManager.handleEvent(9, JSON.stringify(t)));
    eventManager.handleEvent(10, JSON.stringify({ success: 1 }));

    assert(viz.currentSQL === selectSQL, 'Step 1: SELECT SQL parsed');
    assert(viz.parseTokens.some(t => t.token === 'WHERE'), 'Step 1: WHERE clause parsed');

    console.log('\n--- Step 2: B-tree Read Operations ---');
    viz.setViewMode('btree');
    eventManager.handleEvent(6, JSON.stringify({ page: 1, type: 1 }));
    for (let i = 0; i < 5; i++) {
        eventManager.handleEvent(2, JSON.stringify({ page: 1, cell: i, keyLen: 50 }));
    }

    assert(viz.nodes.get(1).cells.length === 5, 'Step 2: Multiple employee records available');

    console.log('\n--- Step 3: VDBE for SELECT ---');
    viz.setViewMode('vdbe');
    eventManager.handleEvent(11, JSON.stringify({ opcode_count: 12 }));

    const selectOpcodes = [
        { pc: 0, opcode: 'Init', p1: 0, p2: 12, p3: 0 },
        { pc: 1, opcode: 'Transaction', p1: 1, p2: 0, p3: 0 },
        { pc: 2, opcode: 'OpenRead', p1: 0, p2: 1, p3: 0 },
        { pc: 3, opcode: 'Rewind', p1: 0, p2: 10, p3: 0 },
        { pc: 4, opcode: 'Column', p1: 0, p2: 0, p3: 1 },
        { pc: 5, opcode: 'Column', p1: 0, p2: 1, p3: 2 },
        { pc: 6, opcode: 'Ne', p1: 3, p2: 9, p3: 4 },
        { pc: 7, opcode: 'RowData', p1: 0, p2: 0, p3: 0 },
        { pc: 8, opcode: 'ResultRow', p1: 1, p2: 2, p3: 0 },
        { pc: 9, opcode: 'Next', p1: 0, p2: 2, p3: 0 },
        { pc: 10, opcode: 'Goto', p1: 0, p2: 4, p3: 0 },
        { pc: 11, opcode: 'Halt', p1: 0, p2: 0, p3: 0 }
    ];

    selectOpcodes.forEach(op => eventManager.handleEvent(12, JSON.stringify(op)));
    eventManager.handleEvent(13, JSON.stringify({ result_code: 0 }));

    assert(viz.vdbeOpcodes.length === 12, 'Step 3: All SELECT opcodes recorded');
    assert(viz.vdbeOpcodes[8].opcode === 'ResultRow', 'Step 3: ResultRow opcode present');

    console.log('\n### E2E Test 4: Complete DELETE Workflow ###');

    console.log('\n--- Step 1: Parse DELETE ---');
    viz.clear();
    viz.setViewMode('parse');
    const deleteSQL = 'DELETE FROM employees WHERE id = 1';
    eventManager.handleEvent(8, JSON.stringify({ sql: deleteSQL }));

    const deleteTokens = [
        { token: 'DELETE', type: 55 },
        { token: 'FROM', type: 41 },
        { token: 'employees', type: 1 },
        { token: 'WHERE', type: 48 },
        { token: 'id', type: 1 },
        { token: '=', type: 21 },
        { token: '1', type: 40 }
    ];

    deleteTokens.forEach(t => eventManager.handleEvent(9, JSON.stringify(t)));
    eventManager.handleEvent(10, JSON.stringify({ success: 1 }));

    assert(viz.currentSQL === deleteSQL, 'Step 1: DELETE SQL parsed');

    console.log('\n--- Step 2: B-tree Cell Deletion ---');
    viz.setViewMode('btree');
    eventManager.handleEvent(6, JSON.stringify({ page: 1, type: 1 }));
    eventManager.handleEvent(2, JSON.stringify({ page: 1, cell: 0, keyLen: 50 }));
    eventManager.handleEvent(2, JSON.stringify({ page: 1, cell: 1, keyLen: 50 }));
    eventManager.handleEvent(3, JSON.stringify({ page: 1, cell: 0 }));

    assert(viz.nodes.get(1).cells.length === 1, 'Step 2: One cell deleted, one remains');

    console.log('\n--- Step 3: VDBE for DELETE ---');
    viz.setViewMode('vdbe');
    eventManager.handleEvent(11, JSON.stringify({ opcode_count: 6 }));

    const deleteOpcodes = [
        { pc: 0, opcode: 'Init', p1: 0, p2: 6, p3: 0 },
        { pc: 1, opcode: 'Transaction', p1: 1, p2: 0, p3: 0 },
        { pc: 2, opcode: 'OpenWrite', p1: 0, p2: 1, p3: 0 },
        { pc: 3, opcode: 'SeekRowid', p1: 0, p2: 1, p3: 0 },
        { pc: 4, opcode: 'Delete', p1: 0, p2: 0, p3: 0 },
        { pc: 5, opcode: 'Halt', p1: 0, p2: 0, p3: 0 }
    ];

    deleteOpcodes.forEach(op => eventManager.handleEvent(12, JSON.stringify(op)));
    eventManager.handleEvent(13, JSON.stringify({ result_code: 0 }));

    assert(viz.vdbeOpcodes[4].opcode === 'Delete', 'Step 3: Delete opcode present');

    console.log('\n### E2E Test 5: Complete UPDATE Workflow ###');

    console.log('\n--- Step 1: Parse UPDATE ---');
    viz.clear();
    viz.setViewMode('parse');
    const updateSQL = 'UPDATE employees SET department = "Sales" WHERE id = 2';
    eventManager.handleEvent(8, JSON.stringify({ sql: updateSQL }));

    const updateTokens = [
        { token: 'UPDATE', type: 56 },
        { token: 'employees', type: 1 },
        { token: 'SET', type: 57 },
        { token: 'department', type: 1 },
        { token: '=', type: 21 },
        { token: '"Sales"', type: 112 },
        { token: 'WHERE', type: 48 },
        { token: 'id', type: 1 },
        { token: '=', type: 21 },
        { token: '2', type: 40 }
    ];

    updateTokens.forEach(t => eventManager.handleEvent(9, JSON.stringify(t)));
    eventManager.handleEvent(10, JSON.stringify({ success: 1 }));

    assert(viz.currentSQL === updateSQL, 'Step 1: UPDATE SQL parsed');

    console.log('\n--- Step 2: B-tree Update (delete + insert) ---');
    viz.setViewMode('btree');
    eventManager.handleEvent(6, JSON.stringify({ page: 1, type: 1 }));
    eventManager.handleEvent(2, JSON.stringify({ page: 1, cell: 0, keyLen: 50 }));
    eventManager.handleEvent(3, JSON.stringify({ page: 1, cell: 0 })); // Delete old
    eventManager.handleEvent(2, JSON.stringify({ page: 1, cell: 0, keyLen: 55 })); // Insert new

    assert(viz.nodes.get(1).cells.length === 1, 'Step 2: Update completed (delete + insert)');

    console.log('\n--- Step 3: VDBE for UPDATE ---');
    viz.setViewMode('vdbe');
    eventManager.handleEvent(11, JSON.stringify({ opcode_count: 8 }));

    const updateOpcodes = [
        { pc: 0, opcode: 'Init', p1: 0, p2: 8, p3: 0 },
        { pc: 1, opcode: 'Transaction', p1: 1, p2: 0, p3: 0 },
        { pc: 2, opcode: 'OpenWrite', p1: 0, p2: 1, p3: 0 },
        { pc: 3, opcode: 'SeekRowid', p1: 0, p2: 2, p3: 0 },
        { pc: 4, opcode: 'IsNull', p1: 3, p2: 6, p3: 0 },
        { pc: 5, opcode: 'Delete', p1: 0, p2: 0, p3: 0 },
        { pc: 6, opcode: 'Insert', p1: 0, p2: 3, p3: 0 },
        { pc: 7, opcode: 'Halt', p1: 0, p2: 0, p3: 0 }
    ];

    updateOpcodes.forEach(op => eventManager.handleEvent(12, JSON.stringify(op)));
    eventManager.handleEvent(13, JSON.stringify({ result_code: 0 }));

    assert(viz.vdbeOpcodes[5].opcode === 'Delete' && viz.vdbeOpcodes[6].opcode === 'Insert',
           'Step 3: Update uses Delete + Insert opcodes');

    console.log('\n### E2E Test 6: Complete Transaction Workflow ###');

    console.log('\n--- Step 1: Parse BEGIN ---');
    viz.clear();
    viz.setViewMode('parse');
    eventManager.handleEvent(8, JSON.stringify({ sql: 'BEGIN TRANSACTION' }));
    eventManager.handleEvent(9, JSON.stringify({ token: 'BEGIN', type: 62 }));
    eventManager.handleEvent(9, JSON.stringify({ token: 'TRANSACTION', type: 65 }));
    eventManager.handleEvent(10, JSON.stringify({ success: 1 }));

    assert(viz.currentSQL === 'BEGIN TRANSACTION', 'Step 1: BEGIN parsed');

    console.log('\n--- Step 2: Multiple Operations ---');
    viz.setViewMode('btree');
    eventManager.handleEvent(6, JSON.stringify({ page: 1, type: 1 }));
    for (let i = 0; i < 3; i++) {
        eventManager.handleEvent(2, JSON.stringify({ page: 1, cell: i, keyLen: 40 }));
    }

    assert(viz.nodes.get(1).cells.length === 3, 'Step 2: Multiple inserts in transaction');

    console.log('\n--- Step 3: Parse COMMIT ---');
    viz.setViewMode('parse');
    eventManager.handleEvent(8, JSON.stringify({ sql: 'COMMIT' }));
    eventManager.handleEvent(9, JSON.stringify({ token: 'COMMIT', type: 66 }));
    eventManager.handleEvent(10, JSON.stringify({ success: 1 }));

    assert(viz.currentSQL === 'COMMIT', 'Step 3: COMMIT parsed');

    console.log('\n### E2E Test 7: Page Split Workflow ###');

    console.log('\n--- Step 1: Fill Page to Splitting Point ---');
    viz.clear();
    viz.setViewMode('btree');
    eventManager.handleEvent(6, JSON.stringify({ page: 1, type: 1 }));

    // Insert cells until split
    for (let i = 0; i < 20; i++) {
        eventManager.handleEvent(2, JSON.stringify({ page: 1, cell: i, keyLen: 100 }));
    }

    // Trigger split
    eventManager.handleEvent(4, JSON.stringify({
        originalPage: 1,
        newPage: 2,
        splitCell: 10
    }));

    assert(viz.nodes.size === 2, 'Step 1: Page split created new page');
    assert(viz.nodes.get(1).cells.length <= 10, 'Step 1: Original page has cells before split');
    assert(viz.nodes.get(2).cells.length > 0, 'Step 1: New page has cells after split');

    console.log('\n--- Step 2: VDBE Acknowledges Split ---');
    viz.setViewMode('vdbe');
    eventManager.handleEvent(11, JSON.stringify({ opcode_count: 3 }));
    eventManager.handleEvent(12, JSON.stringify({ pc: 0, opcode: 'Split', p1: 1, p2: 2, p3: 10 }));

    assert(viz.vdbeOpcodes[0].opcode === 'Split', 'Step 2: VDBE shows Split opcode');

    console.log('\n### E2E Test 8: Cross-System Data Verification ###');

    console.log('\n--- Verify All Systems Maintain Data ---');
    viz.clear();

    // Add data to all three systems
    viz.setViewMode('btree');
    viz.addPage(1, 1, null);
    viz.addCell(1, 0, 100);

    viz.setViewMode('parse');
    viz.showParseStart('SELECT 1');
    viz.showParseToken('SELECT', 38);

    viz.setViewMode('vdbe');
    viz.showVdbeStart(1);
    viz.showVdbeOpcode(0, 'Init', 0, 0, 0);

    // Verify all data persists
    viz.setViewMode('btree');
    assert(viz.nodes.size === 1, 'B-tree data persists');

    viz.setViewMode('parse');
    assert(viz.parseTokens.length === 1, 'Parse data persists');

    viz.setViewMode('vdbe');
    assert(viz.vdbeOpcodes.length === 1, 'VDBE data persists');

    console.log('\n### E2E Test 9: Complex Query Workflow ###');

    console.log('\n--- Step 1: Parse Complex Query ---');
    viz.clear();
    viz.setViewMode('parse');
    const complexSQL = 'SELECT COUNT(*), AVG(salary) FROM employees WHERE department = "Engineering" GROUP BY title';
    eventManager.handleEvent(8, JSON.stringify({ sql: complexSQL }));

    const complexTokens = [
        { token: 'SELECT', type: 38 },
        { token: 'COUNT', type: 1 },
        { token: '(', type: 39 },
        { token: '*', type: 103 },
        { token: ')', type: 40 },
        { token: ',', type: 53 },
        { token: 'AVG', type: 1 },
        { token: '(', type: 39 },
        { token: 'salary', type: 1 },
        { token: ')', type: 40 },
        { token: 'FROM', type: 41 },
        { token: 'employees', type: 1 },
        { token: 'WHERE', type: 48 },
        { token: 'department', type: 1 },
        { token: '=', type: 21 },
        { token: '"Engineering"', type: 112 },
        { token: 'GROUP', type: 45 },
        { token: 'BY', type: 73 },
        { token: 'title', type: 1 }
    ];

    complexTokens.forEach(t => eventManager.handleEvent(9, JSON.stringify(t)));
    eventManager.handleEvent(10, JSON.stringify({ success: 1 }));

    assert(viz.parseTokens.some(t => t.token === 'COUNT'), 'Step 1: COUNT parsed');
    assert(viz.parseTokens.some(t => t.token === 'AVG'), 'Step 1: AVG parsed');
    assert(viz.parseTokens.some(t => t.token === 'GROUP'), 'Step 1: GROUP BY parsed');

    console.log('\n--- Step 2: VDBE for Complex Query ---');
    viz.setViewMode('vdbe');
    eventManager.handleEvent(11, JSON.stringify({ opcode_count: 15 }));

    const complexOpcodes = [
        { pc: 0, opcode: 'Init', p1: 0, p2: 15, p3: 0 },
        { pc: 1, opcode: 'Transaction', p1: 1, p2: 0, p3: 0 },
        { pc: 2, opcode: 'OpenRead', p1: 0, p2: 1, p3: 0 },
        { pc: 3, opcode: 'Rewind', p1: 0, p2: 13, p3: 0 },
        { pc: 4, opcode: 'Column', p1: 0, p2: 0, p3: 1 },
        { pc: 5, opcode: 'AggStep', p1: 0, p2: 0, p3: 0 },
        { pc: 6, opcode: 'Column', p1: 0, p2: 1, p3: 2 },
        { pc: 7, opcode: 'AggStep', p1: 1, p2: 1, p3: 0 },
        { pc: 8, opcode: 'Next', p1: 0, p2: 3, p3: 0 },
        { pc: 9, opcode: 'Goto', p1: 0, p2: 4, p3: 0 },
        { pc: 10, opcode: 'AggFinal', p1: 0, p2: 0, p3: 0 },
        { pc: 11, opcode: 'AggFinal', p1: 1, p2: 1, p3: 0 },
        { pc: 12, opcode: 'ResultRow', p1: 0, p2: 2, p3: 0 },
        { pc: 13, opcode: 'Halt', p1: 0, p2: 0, p3: 0 }
    ];

    complexOpcodes.forEach(op => eventManager.handleEvent(12, JSON.stringify(op)));
    eventManager.handleEvent(13, JSON.stringify({ result_code: 0 }));

    assert(viz.vdbeOpcodes.some(o => o.opcode === 'AggStep'), 'Step 2: AggStep opcode present');
    assert(viz.vdbeOpcodes.some(o => o.opcode === 'AggFinal'), 'Step 2: AggFinal opcode present');

    console.log('\n### E2E Test 10: Full Database Session ###');

    console.log('\n--- Simulate Complete User Session ---');
    viz.clear();

    // 1. Create table
    viz.setViewMode('parse');
    viz.showParseStart('CREATE TABLE test (id INTEGER)');
    viz.setViewMode('btree');
    viz.addPage(1, 1, null);
    viz.setViewMode('vdbe');
    viz.showVdbeStart(3);
    viz.showVdbeOpcode(0, 'Init', 0, 3, 0);

    // 2. Insert data
    viz.setViewMode('parse');
    viz.showParseStart('INSERT INTO test VALUES (1)');
    viz.setViewMode('btree');
    viz.addCell(1, 0, 25);
    viz.setViewMode('vdbe');
    viz.showVdbeStart(5);
    viz.showVdbeOpcode(0, 'Insert', 0, 1, 0);

    // 3. Query data
    viz.setViewMode('parse');
    viz.showParseStart('SELECT * FROM test');
    viz.setViewMode('btree');
    viz.setViewMode('vdbe');
    viz.showVdbeStart(6);
    viz.showVdbeOpcode(0, 'ResultRow', 0, 1, 0);

    // 4. Verify all operations recorded
    assert(viz.nodes.size === 1, 'Session: B-tree has table');
    assert(viz.currentSQL === 'SELECT * FROM test', 'Session: Last query recorded');
    assert(viz.vdbeOpcodes.length >= 1, 'Session: VDBE has opcodes');

} catch (error) {
    console.error('\n❌ Error during E2E testing:', error.message);
    console.error(error.stack);
    e2eTestsFailed++;
}

console.log('\n' + '='.repeat(70));
console.log(`E2E Tests Complete: ${e2eTestsPassed} passed, ${e2eTestsFailed} failed`);
console.log('='.repeat(70));

process.exit(e2eTestsFailed > 0 ? 1 : 0);
