#!/usr/bin/env node

/**
 * Data Integrity and Consistency Tests
 * Verifies that data remains consistent across operations and view mode switches
 */

const fs = require('fs');

global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = () => {};
global.ResizeObserver = class { constructor() {} observe() {} unobserve() {} disconnect() {} };

let integrityTestsPassed = 0;
let integrityTestsFailed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`✓ ${message}`);
        integrityTestsPassed++;
    } else {
        console.error(`✗ ${message}`);
        integrityTestsFailed++;
    }
}

console.log('='.repeat(70));
console.log('Data Integrity and Consistency Tests');
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

    // Connect events
    eventManager.on(2, (e) => { viz.addCell(e.data.page, e.data.cell, e.data.keyLen); });
    eventManager.on(6, (e) => { viz.addPage(e.data.page, e.data.type); });
    eventManager.on(8, (e) => { viz.showParseStart(e.data.sql); });
    eventManager.on(9, (e) => { viz.showParseToken(e.data.token, e.data.type); });
    eventManager.on(11, (e) => { viz.showVdbeStart(e.data.numOpcodes || e.data.opcode_count); });
    eventManager.on(12, (e) => { viz.showVdbeOpcode(e.data.pc, e.data.opcode, e.data.p1, e.data.p2, e.data.p3); });

    const viz = new BTreeVisualizer('visualization-canvas');

    console.log('\n### Test Suite 1: B-tree Data Integrity ###');

    console.log('\n--- Test 1: Cell Data Preservation ---');
    viz.setViewMode('btree');
    viz.addPage(1, 1, null);
    viz.addCell(1, 0, 100);
    viz.addCell(1, 1, 200);
    viz.addCell(1, 2, 300);

    const page1 = viz.nodes.get(1);
    assert(page1.cells[0].keyLen === 100, 'First cell key length preserved');
    assert(page1.cells[1].keyLen === 200, 'Second cell key length preserved');
    assert(page1.cells[2].keyLen === 300, 'Third cell key length preserved');
    assert(page1.cells[0].idx === 0, 'First cell index preserved');
    assert(page1.cells[1].idx === 1, 'Second cell index preserved');
    assert(page1.cells[2].idx === 2, 'Third cell index preserved');

    console.log('\n--- Test 2: Data After View Mode Switch ---');
    const beforeSwitch = JSON.stringify(Array.from(viz.nodes.entries()));
    viz.setViewMode('parse');
    viz.setViewMode('btree');
    const afterSwitch = JSON.stringify(Array.from(viz.nodes.entries()));

    assert(beforeSwitch === afterSwitch, 'B-tree data preserved after mode switch');

    console.log('\n--- Test 3: Page Properties Integrity ---');
    viz.addPage(10, 0, null);
    viz.addPage(20, 1, 10);

    const page10 = viz.nodes.get(10);
    const page20 = viz.nodes.get(20);

    assert(page10.page === 10, 'Page 10 number correct');
    assert(page10.type === 0, 'Page 10 type correct (interior)');
    assert(page10.parent === null, 'Page 10 has no parent');

    assert(page20.page === 20, 'Page 20 number correct');
    assert(page20.type === 1, 'Page 20 type correct (leaf)');
    assert(page20.parent === 10, 'Page 20 parent is page 10');
    assert(page10.children.includes(20), 'Page 10 has page 20 as child');

    console.log('\n### Test Suite 2: VDBE Data Integrity ###');

    console.log('\n--- Test 4: Opcode Data Preservation ---');
    viz.setViewMode('vdbe');
    viz.showVdbeStart(10);
    viz.showVdbeOpcode(0, 'Init', 1, 2, 3);
    viz.showVdbeOpcode(5, 'OpenRead', 4, 5, 6);
    viz.showVdbeOpcode(9, 'Halt', 7, 8, 9);

    assert(viz.vdbeOpcodes[0].opcode === 'Init', 'Opcode 0 name preserved');
    assert(viz.vdbeOpcodes[0].p1 === 1, 'Opcode 0 P1 preserved');
    assert(viz.vdbeOpcodes[0].p2 === 2, 'Opcode 0 P2 preserved');
    assert(viz.vdbeOpcodes[0].p3 === 3, 'Opcode 0 P3 preserved');

    assert(viz.vdbeOpcodes[5].opcode === 'OpenRead', 'Opcode 5 preserved');
    assert(viz.vdbeOpcodes[9].opcode === 'Halt', 'Opcode 9 preserved');

    console.log('\n--- Test 5: VDBE Data Across Mode Switches ---');
    const opcodeCount = viz.vdbeOpcodes.length;
    viz.setViewMode('btree');
    viz.addPage(1, 1, null);
    viz.setViewMode('vdbe');

    assert(viz.vdbeOpcodes.length === opcodeCount, 'VDBE data preserved after mode switches');

    console.log('\n### Test Suite 3: Parse Data Integrity ###');

    console.log('\n--- Test 6: SQL Preservation ---');
    viz.setViewMode('parse');
    const testSQL = 'SELECT id, name FROM users WHERE age > 25';
    viz.showParseStart(testSQL);

    assert(viz.currentSQL === testSQL, 'SQL text preserved exactly');

    console.log('\n--- Test 7: Token Data Preservation ---');
    viz.showParseToken('SELECT', 38);
    viz.showParseToken('id', 1);
    viz.showParseToken('FROM', 41);

    assert(viz.parseTokens[0].token === 'SELECT', 'First token preserved');
    assert(viz.parseTokens[0].type === 'TK_SELECT', 'First token type correct');
    assert(viz.parseTokens[1].token === 'id', 'Second token preserved');
    assert(viz.parseTokens[2].token === 'FROM', 'Third token preserved');

    console.log('\n--- Test 8: Parse Data Across Mode Switches ---');
    const tokenCount = viz.parseTokens.length;
    const sqlText = viz.currentSQL;

    viz.setViewMode('btree');
    viz.addPage(5, 1, null);
    viz.setViewMode('parse');

    assert(viz.parseTokens.length === tokenCount, 'Token count preserved');
    assert(viz.currentSQL === sqlText, 'SQL text preserved');

    console.log('\n### Test Suite 4: Sequential Operation Integrity ###');

    console.log('\n--- Test 9: Sequential Cell Operations ---');
    viz.clear();
    viz.setViewMode('btree');
    viz.addPage(1, 1, null);

    for (let i = 0; i < 20; i++) {
        viz.addCell(1, i, i * 10);
    }

    assert(viz.nodes.get(1).cells.length === 20, '20 cells added');
    for (let i = 0; i < 20; i++) {
        assert(viz.nodes.get(1).cells[i].idx === i, `Cell ${i} index correct`);
        assert(viz.nodes.get(1).cells[i].keyLen === i * 10, `Cell ${i} data correct`);
    }

    console.log('\n--- Test 10: Sequential Page Creation ---');
    for (let i = 2; i <= 10; i++) {
        viz.addPage(i, 1, i > 2 ? i - 1 : null);
    }

    assert(viz.nodes.size === 10, '10 pages total');
    for (let i = 1; i <= 10; i++) {
        assert(viz.nodes.has(i), `Page ${i} exists`);
        assert(viz.nodes.get(i).page === i, `Page ${i} number correct`);
    }

    console.log('\n### Test Suite 5: Operation Ordering ###');

    console.log('\n--- Test 11: Token Order Preservation ---');
    viz.clear();
    viz.setViewMode('parse');
    viz.showParseStart('SELECT * FROM t');

    const tokens = ['SELECT', '*', 'FROM', 't'];
    const types = [38, 103, 41, 1];

    tokens.forEach((token, i) => {
        viz.showParseToken(token, types[i]);
    });

    for (let i = 0; i < tokens.length; i++) {
        assert(viz.parseTokens[i].token === tokens[i], `Token ${i} in correct order`);
        assert(viz.parseTokens[i].type === 'TK_' + tokens[i] || viz.parseTokens[i].type === 'TK_' + tokens[i].toUpperCase(), `Token ${i} type correct`);
    }

    console.log('\n--- Test 12: VDBE Opcode Order ---');
    viz.setViewMode('vdbe');
    viz.showVdbeStart(5);

    const opcodes = [
        { pc: 0, op: 'Init' },
        { pc: 1, op: 'OpenRead' },
        { pc: 2, op: 'Rewind' },
        { pc: 3, op: 'ResultRow' },
        { pc: 4, op: 'Halt' }
    ];

    opcodes.forEach(o => {
        viz.showVdbeOpcode(o.pc, o.op, 0, 0, 0);
    });

    for (let i = 0; i < opcodes.length; i++) {
        assert(viz.vdbeOpcodes[i].opcode === opcodes[i].op, `Opcode ${i} in correct order`);
        assert(viz.vdbeOpcodes[i].pc === opcodes[i].pc, `Opcode ${i} PC correct`);
    }

    console.log('\n### Test Suite 6: Cross-System Data Isolation ###');

    console.log('\n--- Test 13: B-tree Does Not Affect Parse ---');
    viz.clear();
    viz.setViewMode('parse');
    viz.showParseStart('SELECT 1');
    viz.showParseToken('SELECT', 38);

    const parseTokenCount = viz.parseTokens.length;
    const parseSQL = viz.currentSQL;

    viz.setViewMode('btree');
    viz.addPage(1, 1, null);
    viz.addCell(1, 0, 100);

    viz.setViewMode('parse');

    assert(viz.parseTokens.length === parseTokenCount, 'Parse tokens not affected by B-tree ops');
    assert(viz.currentSQL === parseSQL, 'Parse SQL not affected by B-tree ops');

    console.log('\n--- Test 14: VDBE Does Not Affect B-tree ---');
    viz.setViewMode('btree');
    const btreeSize = viz.nodes.size;

    viz.setViewMode('vdbe');
    viz.showVdbeStart(5);
    viz.showVdbeOpcode(0, 'Test', 1, 2, 3);

    viz.setViewMode('btree');

    assert(viz.nodes.size === btreeSize, 'B-tree size not affected by VDBE ops');

    console.log('\n### Test Suite 7: State Consistency After Clear ---');

    console.log('\n--- Test 15: Clear Resets All State ---');
    viz.setViewMode('btree');
    viz.addPage(1, 1, null);
    viz.addPage(2, 1, null);
    viz.addCell(1, 0, 100);

    viz.setViewMode('parse');
    viz.showParseStart('SELECT 1');
    viz.showParseToken('SELECT', 38);

    viz.setViewMode('vdbe');
    viz.showVdbeStart(3);
    viz.showVdbeOpcode(0, 'Init', 0, 0, 0);

    viz.clear();

    assert(viz.nodes.size === 0, 'Clear removes all B-tree nodes');
    assert(viz.parseTokens.length === 0, 'Clear removes all parse tokens');
    assert(viz.vdbeOpcodes.length === 0, 'Clear removes all VDBE opcodes');
    assert(viz.currentSQL === '', 'Clear resets SQL');

    console.log('\n### Test Suite 8: Concurrent Operations ###');

    console.log('\n--- Test 16: Interleaved Operations ---');
    viz.clear();

    // Start B-tree
    viz.setViewMode('btree');
    viz.addPage(1, 1, null);

    // Add parse data
    viz.setViewMode('parse');
    viz.showParseStart('INSERT INTO t VALUES (1)');
    viz.showParseToken('INSERT', 54);

    // Continue B-tree
    viz.setViewMode('btree');
    viz.addCell(1, 0, 50);

    // Add VDBE data
    viz.setViewMode('vdbe');
    viz.showVdbeOpcode(0, 'Insert', 1, 2, 3);

    // Verify all data preserved
    viz.setViewMode('btree');
    assert(viz.nodes.has(1), 'B-tree page exists');
    assert(viz.nodes.get(1).cells.length === 1, 'B-tree cell exists');

    viz.setViewMode('parse');
    assert(viz.currentSQL === 'INSERT INTO t VALUES (1)', 'Parse SQL preserved');
    assert(viz.parseTokens.length === 1, 'Parse token preserved');

    viz.setViewMode('vdbe');
    assert(viz.vdbeOpcodes.length === 1, 'VDBE opcode preserved');

    console.log('\n### Test Suite 9: Edge Case Integrity ###');

    console.log('\n--- Test 17: Empty State Operations ---');
    viz.clear();

    viz.setViewMode('btree');
    assert(viz.nodes.size === 0, 'Empty B-tree has 0 nodes');
    viz.layout();
    assert(true, 'Layout on empty tree succeeds');
    viz.draw();
    assert(true, 'Draw on empty tree succeeds');

    viz.setViewMode('parse');
    assert(viz.parseTokens.length === 0, 'Empty parse has 0 tokens');
    assert(viz.currentSQL === '', 'Empty parse has no SQL');

    viz.setViewMode('vdbe');
    assert(viz.vdbeOpcodes.length === 0, 'Empty VDBE has 0 opcodes');

    console.log('\n--- Test 18: Single Item States ---');
    viz.clear();

    viz.setViewMode('btree');
    viz.addPage(1, 1, null);
    assert(viz.nodes.size === 1, 'Single page created');

    viz.setViewMode('parse');
    viz.showParseStart('SELECT 1');
    assert(viz.currentSQL === 'SELECT 1', 'Single SQL stored');

    viz.setViewMode('vdbe');
    viz.showVdbeOpcode(0, 'Init', 0, 0, 0);
    assert(viz.vdbeOpcodes.length === 1, 'Single opcode created');

    console.log('\n### Test Suite 10: Data Type Consistency ###');

    console.log('\n--- Test 19: Numeric Data Types ---');
    viz.clear();
    viz.setViewMode('btree');
    viz.addPage(1, 1, null);
    viz.addCell(1, 0, 42);
    viz.addCell(1, 1, 3.14);
    viz.addCell(1, 2, 0);

    assert(typeof viz.nodes.get(1).cells[0].keyLen === 'number', 'Integer keyLen is number');
    assert(typeof viz.nodes.get(1).cells[1].keyLen === 'number', 'Float keyLen is number');
    assert(typeof viz.nodes.get(1).cells[2].keyLen === 'number', 'Zero keyLen is number');

    console.log('\n--- Test 20: String Data Types ---');
    viz.setViewMode('parse');
    viz.showParseStart('SELECT "string", 123, NULL');

    assert(viz.currentSQL.includes('string'), 'String literal preserved');
    assert(viz.currentSQL.includes('123'), 'Number preserved');
    assert(viz.currentSQL.includes('NULL'), 'NULL keyword preserved');

} catch (error) {
    console.error('\n❌ Error during integrity testing:', error.message);
    console.error(error.stack);
    integrityTestsFailed++;
}

console.log('\n' + '='.repeat(70));
console.log(`Integrity Tests Complete: ${integrityTestsPassed} passed, ${integrityTestsFailed} failed`);
console.log('='.repeat(70));

process.exit(integrityTestsFailed > 0 ? 1 : 0);
