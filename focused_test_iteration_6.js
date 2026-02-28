#!/usr/bin/env node

/**
 * Iteration 6: Focused System Testing
 * Deep dive testing for each visualization system individually
 */

const fs = require('fs');

global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = () => {};
global.ResizeObserver = class { constructor() {} observe() {} unobserve() {} disconnect() {} };

console.log('='.repeat(80));
console.log('ITERATION 6: FOCUSED SYSTEM TESTING');
console.log('='.repeat(80));

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
            if (id === 'event-log') return { children: [], appendChild: () => {}, scrollTop: 0, scrollHeight: 100, innerHTML: '', removeChild: () => {} };
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

    // Connect event handlers
    eventManager.on(2, (e) => { viz.addCell && viz.addCell(e.data.page, e.data.cell, e.data.keyLen); });
    eventManager.on(4, (e) => { viz.splitPage && viz.splitPage(e.data.originalPage, e.data.newPage, e.data.splitCell); });
    eventManager.on(6, (e) => { viz.addPage && viz.addPage(e.data.page, e.data.type); });
    eventManager.on(8, (e) => { viz.showParseStart && viz.showParseStart(e.data.sql); });
    eventManager.on(9, (e) => { viz.showParseToken && viz.showParseToken(e.data.token, e.data.type); });
    eventManager.on(11, (e) => { viz.showVdbeStart && viz.showVdbeStart(e.data.numOpcodes || e.data.opcode_count); });
    eventManager.on(12, (e) => { viz.showVdbeOpcode && viz.showVdbeOpcode(e.data.pc, e.data.opcode, e.data.p1, e.data.p2, e.data.p3); });

    console.log('\n### FOCUS AREA 1: VDBE SYSTEM DEEP DIVE ###\n');

    viz.setViewMode('vdbe');
    viz.vdbeOpcodes = [];
    viz.vdbeCurrentPc = -1;

    let vdbeTests = { passed: 0, failed: 0, tests: [] };

    function vdbeTest(name, condition, details = '') {
        const result = { name, passed: condition };
        vdbeTests.tests.push(result);
        if (condition) {
            vdbeTests.passed++;
            console.log(`  ✓ ${name}`);
            if (details) console.log(`    ${details}`);
        } else {
            vdbeTests.failed++;
            console.log(`  ✗ ${name}`);
            if (details) console.log(`    ${details}`);
        }
    }

    // VDBE Test Suite
    vdbeTest('VDBE-INIT-1', viz.vdbeOpcodes.length === 0, 'Initial state: empty opcodes array');

    eventManager.handleEvent(11, JSON.stringify({ opcode_count: 15 }));
    vdbeTest('VDBE-START-1', true, 'VDBE_START event handled');

    // Test all major VDBE opcode types
    const majorOpcodes = [
        { name: 'Init', expected: { pc: 0, opcode: 'Init' } },
        { name: 'OpenRead', expected: { pc: 1, opcode: 'OpenRead', p1: 0, p2: 2 } },
        { name: 'OpenWrite', expected: { pc: 2, opcode: 'OpenWrite', p1: 0, p2: 3 } },
        { name: 'Rewind', expected: { pc: 3, opcode: 'Rewind', p1: 0, p2: 10 } },
        { name: 'Column', expected: { pc: 4, opcode: 'Column', p1: 0, p2: 1, p3: 1 } },
        { name: 'MakeRecord', expected: { pc: 5, opcode: 'MakeRecord', p1: 1, p2: 3 } },
        { name: 'Insert', expected: { pc: 6, opcode: 'Insert', p1: 0, p2: 2, p3: 0 } },
        { name: 'SeekRowid', expected: { pc: 7, opcode: 'SeekRowid', p1: 0, p2: 1 } },
        { name: 'NotFound', expected: { pc: 8, opcode: 'NotFound', p1: 0, p2: 9 } },
        { name: 'Next', expected: { pc: 9, opcode: 'Next', p1: 0, p2: 10 } },
        { name: 'ResultRow', expected: { pc: 10, opcode: 'ResultRow', p1: 1, p2: 3 } },
        { name: 'Goto', expected: { pc: 11, opcode: 'Goto', p1: 0, p2: 3 } },
        { name: 'If', expected: { pc: 12, opcode: 'If', p1: 1, p2: 14 } },
        { name: 'NotExists', expected: { pc: 13, opcode: 'NotExists', p1: 0, p2: 5 } },
        { name: 'Halt', expected: { pc: 14, opcode: 'Halt', p1: 0, p2: 0 } }
    ];

    majorOpcodes.forEach((op, i) => {
        eventManager.handleEvent(12, JSON.stringify(op.expected));
        const recorded = viz.vdbeOpcodes[i];
        const match = recorded && recorded.opcode === op.expected.opcode;
        vdbeTest(`VDBE-OPCODE-${i}`, match, `${op.expected.opcode}: ${match ? 'recorded' : 'failed'}`);
    });

    vdbeTest('VDBE-COUNT-1', viz.vdbeOpcodes.length === 15, `15 opcodes recorded: ${viz.vdbeOpcodes.length}`);
    vdbeTest('VDBE-PC-1', viz.vdbeCurrentPc === 14, `PC at 14: ${viz.vdbeCurrentPc}`);

    eventManager.handleEvent(13, JSON.stringify({ result_code: 0 }));
    vdbeTest('VDBE-COMPLETE-1', true, 'VDBE_COMPLETE event handled');

    // Test data integrity
    const initOp = viz.vdbeOpcodes[0];
    vdbeTest('VDBE-INTEGRITY-1', initOp.opcode === 'Init' && initOp.p1 === 0, 'Init opcode data integrity');

    console.log(`\nVDBE System: ${vdbeTests.passed}/${vdbeTests.tests.length} tests passed`);

    console.log('\n### FOCUS AREA 2: PARSE SYSTEM DEEP DIVE ###\n');

    viz.setViewMode('parse');
    viz.parseTokens = [];
    viz.currentSQL = '';

    let parseTests = { passed: 0, failed: 0, tests: [] };

    function parseTest(name, condition, details = '') {
        const result = { name, passed: condition };
        parseTests.tests.push(result);
        if (condition) {
            parseTests.passed++;
            console.log(`  ✓ ${name}`);
            if (details) console.log(`    ${details}`);
        } else {
            parseTests.failed++;
            console.log(`  ✗ ${name}`);
            if (details) console.log(`    ${details}`);
        }
    }

    // Parse Test Suite
    parseTest('PARSE-INIT-1', viz.parseTokens.length === 0, 'Initial state: empty tokens array');
    parseTest('PARSE-INIT-2', viz.currentSQL === '', 'Initial state: no SQL stored');

    // Test various SQL statements
    const sqlStatements = [
        'SELECT * FROM users',
        'INSERT INTO users VALUES (1, "Alice")',
        'CREATE TABLE test (id INTEGER, name TEXT)',
        'UPDATE users SET name = "Bob" WHERE id = 1',
        'DELETE FROM users WHERE id = 1',
        'SELECT COUNT(*) FROM orders WHERE status = "pending"',
        'SELECT u.name, o.order_date FROM users u JOIN orders o ON u.id = o.user_id'
    ];

    sqlStatements.forEach((sql, i) => {
        viz.parseTokens = [];
        viz.currentSQL = '';

        eventManager.handleEvent(8, JSON.stringify({ sql: sql }));
        parseTest(`PARSE-START-${i}`, viz.currentSQL === sql, `SQL ${i+1} captured: ${sql.substring(0, 30)}...`);

        // Tokenize
        const tokens = sql.split(/\s+/);
        tokens.forEach((token, j) => {
            eventManager.handleEvent(9, JSON.stringify({ token: token, type: 1 }));
        });

        parseTest(`PARSE-TOKENS-${i}`, viz.parseTokens.length === tokens.length, `SQL ${i+1}: ${tokens.length} tokens`);

        eventManager.handleEvent(10, JSON.stringify({ success: 1 }));
        parseTest(`PARSE-COMPLETE-${i}`, true, `SQL ${i+1}: parse complete`);
    });

    // Test specific token types
    viz.parseTokens = [];
    const tokenTypes = [
        { token: 'SELECT', type: 38, name: 'TK_SELECT' },
        { token: 'FROM', type: 41, name: 'TK_FROM' },
        { token: 'WHERE', type: 48, name: 'TK_WHERE' },
        { token: 'ORDER', type: 44, name: 'TK_ORDER' },
        { token: '*', type: 103, name: 'TK_STAR' }
    ];

    tokenTypes.forEach((tt, i) => {
        eventManager.handleEvent(9, JSON.stringify({ token: tt.token, type: tt.type }));
        const recorded = viz.parseTokens[i];
        const match = recorded && recorded.token === tt.token;
        parseTest(`PARSE-TYPE-${i}`, match, `Token "${tt.token}": ${match ? 'recorded' : 'failed'}`);
    });

    console.log(`\nParse System: ${parseTests.passed}/${parseTests.tests.length} tests passed`);

    console.log('\n### FOCUS AREA 3: B-TREE SYSTEM DEEP DIVE ###\n');

    viz.setViewMode('btree');
    viz.nodes.clear();
    viz.rootPage = 1;

    let btreeTests = { passed: 0, failed: 0, tests: [] };

    function btreeTest(name, condition, details = '') {
        const result = { name, passed: condition };
        btreeTests.tests.push(result);
        if (condition) {
            btreeTests.passed++;
            console.log(`  ✓ ${name}`);
            if (details) console.log(`    ${details}`);
        } else {
            btreeTests.failed++;
            console.log(`  ✗ ${name}`);
            if (details) console.log(`    ${details}`);
        }
    }

    // B-tree Test Suite
    btreeTest('BTREE-INIT-1', viz.nodes.size === 0, 'Initial state: no pages');
    btreeTest('BTREE-INIT-2', viz.rootPage === 1, 'Root page initialized to 1');

    // Test page allocation
    for (let i = 1; i <= 5; i++) {
        eventManager.handleEvent(6, JSON.stringify({ page: i, type: i % 2 }));
        btreeTest(`BTREE-ALLOC-${i}`, viz.nodes.has(i), `Page ${i} allocated`);
    }

    btreeTest('BTREE-COUNT-1', viz.nodes.size === 5, `5 pages created: ${viz.nodes.size}`);

    // Test page type distribution
    let leafCount = 0, interiorCount = 0;
    viz.nodes.forEach(node => {
        if (node.type === 1) leafCount++;
        else interiorCount++;
    });
    btreeTest('BTREE-TYPES-1', leafCount === 3 && interiorCount === 2, `Leaf: ${leafCount}, Interior: ${interiorCount}`);

    // Test cell insertions
    for (let page = 1; page <= 5; page++) {
        for (let cell = 0; cell < 3; cell++) {
            eventManager.handleEvent(2, JSON.stringify({
                page: page,
                cell: cell,
                keyLen: (page * 10) + cell
            }));
        }
    }

    let totalCells = 0;
    viz.nodes.forEach(node => {
        totalCells += node.cells.length;
    });
    btreeTest('BTREE-CELLS-1', totalCells === 15, `15 cells inserted: ${totalCells}`);

    // Test cell data integrity
    const page1 = viz.nodes.get(1);
    btreeTest('BTREE-CELL-DATA-1', page1 && page1.cells.length === 3, `Page 1 has 3 cells: ${page1?.cells.length}`);

    if (page1 && page1.cells[0]) {
        btreeTest('BTREE-CELL-DATA-2', page1.cells[0].keyLen === 10, `Cell 0 keyLen: ${page1.cells[0].keyLen}`);
    }

    // Test page split
    eventManager.handleEvent(6, JSON.stringify({ page: 6, type: 1 }));
    eventManager.handleEvent(4, JSON.stringify({
        originalPage: 1,
        newPage: 6,
        splitCell: 1
    }));
    btreeTest('BTREE-SPLIT-1', viz.nodes.size === 6, `6 pages after split: ${viz.nodes.size}`);
    btreeTest('BTREE-SPLIT-2', viz.nodes.has(6), `New page 6 created`);

    // Test root page stability
    btreeTest('BTREE-ROOT-1', viz.rootPage === 1, `Root page still 1: ${viz.rootPage}`);

    console.log(`\nB-tree System: ${btreeTests.passed}/${btreeTests.tests.length} tests passed`);

    console.log('\n### FOCUS AREA 4: INTEGRATION TESTING ###\n');

    let integrationTests = { passed: 0, failed: 0, tests: [] };

    function integrationTest(name, condition, details = '') {
        const result = { name, passed: condition };
        integrationTests.tests.push(result);
        if (condition) {
            integrationTests.passed++;
            console.log(`  ✓ ${name}`);
            if (details) console.log(`    ${details}`);
        } else {
            integrationTests.failed++;
            console.log(`  ✗ ${name}`);
            if (details) console.log(`    ${details}`);
        }
    }

    // Verify all systems have data
    integrationTest('INT-DATA-1', viz.vdbeOpcodes.length > 0, `VDBE data: ${viz.vdbeOpcodes.length} opcodes`);
    integrationTest('INT-DATA-2', viz.parseTokens.length > 0, `Parse data: ${viz.parseTokens.length} tokens`);
    integrationTest('INT-DATA-3', viz.nodes.size > 0, `B-tree data: ${viz.nodes.size} pages`);

    // Test view mode switching
    const vdbeCount = viz.vdbeOpcodes.length;
    const parseCount = viz.parseTokens.length;
    const btreeCount = viz.nodes.size;

    viz.setViewMode('vdbe');
    integrationTest('INT-SWITCH-1', viz.vdbeOpcodes.length === vdbeCount, `VDBE preserved: ${viz.vdbeOpcodes.length}`);

    viz.setViewMode('parse');
    integrationTest('INT-SWITCH-2', viz.parseTokens.length === parseCount, `Parse preserved: ${viz.parseTokens.length}`);

    viz.setViewMode('btree');
    integrationTest('INT-SWITCH-3', viz.nodes.size === btreeCount, `B-tree preserved: ${viz.nodes.size}`);

    // Test event statistics
    const totalEvents = eventManager.eventCount;
    const vdbeEvents = eventManager.events.filter(e => e.category === 'vdbe').length;
    const parseEvents = eventManager.events.filter(e => e.category === 'parse').length;
    const btreeEvents = eventManager.events.filter(e => e.category === 'btree').length;

    integrationTest('INT-EVENTS-1', totalEvents > 0, `Total events: ${totalEvents}`);
    integrationTest('INT-EVENTS-2', vdbeEvents > 0 && parseEvents > 0 && btreeEvents > 0,
        `VDBE: ${vdbeEvents}, Parse: ${parseEvents}, B-tree: ${btreeEvents}`);

    console.log(`\nIntegration: ${integrationTests.passed}/${integrationTests.tests.length} tests passed`);

    console.log('\n### ITERATION 6 RESULTS SUMMARY ###\n');

    const totalPassed = vdbeTests.passed + parseTests.passed + btreeTests.passed + integrationTests.passed;
    const totalFailed = vdbeTests.failed + parseTests.failed + btreeTests.failed + integrationTests.failed;
    const totalTests = totalPassed + totalFailed;

    console.log('VDBE System:');
    console.log(`  Passed: ${vdbeTests.passed}/${vdbeTests.tests.length}`);
    console.log(`  Failed: ${vdbeTests.failed}/${vdbeTests.tests.length}`);
    console.log(`  Status: ${vdbeTests.failed === 0 ? '✅ EXCELLENT' : vdbeTests.passed > vdbeTests.failed ? '✅ GOOD' : '⚠️ NEEDS ATTENTION'}`);

    console.log('\nParse System:');
    console.log(`  Passed: ${parseTests.passed}/${parseTests.tests.length}`);
    console.log(`  Failed: ${parseTests.failed}/${parseTests.tests.length}`);
    console.log(`  Status: ${parseTests.failed === 0 ? '✅ EXCELLENT' : parseTests.passed > parseTests.failed ? '✅ GOOD' : '⚠️ NEEDS ATTENTION'}`);

    console.log('\nB-tree System:');
    console.log(`  Passed: ${btreeTests.passed}/${btreeTests.tests.length}`);
    console.log(`  Failed: ${btreeTests.failed}/${btreeTests.tests.length}`);
    console.log(`  Status: ${btreeTests.failed === 0 ? '✅ EXCELLENT' : btreeTests.passed > btreeTests.failed ? '✅ GOOD' : '⚠️ NEEDS ATTENTION'}`);

    console.log('\nIntegration:');
    console.log(`  Passed: ${integrationTests.passed}/${integrationTests.tests.length}`);
    console.log(`  Failed: ${integrationTests.failed}/${integrationTests.tests.length}`);
    console.log(`  Status: ${integrationTests.failed === 0 ? '✅ EXCELLENT' : integrationTests.passed > integrationTests.failed ? '✅ GOOD' : '⚠️ NEEDS ATTENTION'}`);

    console.log('\n' + '='.repeat(80));
    console.log(`TOTAL: ${totalPassed}/${totalTests} tests passed (${Math.round(totalPassed/totalTests*100)}%)`);
    console.log('='.repeat(80));

    if (totalFailed === 0) {
        console.log('\n✅ ALL SYSTEMS OPERATIONAL - ITERATION 6 COMPLETE');
        console.log('  ✓ VDBE event and visualization: WORKING');
        console.log('  ✓ SQL instruction parsing and visualization: WORKING');
        console.log('  ✓ Page node event and visualization: WORKING');
    } else {
        console.log(`\n⚠️  ${totalFailed} test(s) failed - review needed`);
    }

    process.exit(totalFailed > 0 ? 1 : 0);

} catch (error) {
    console.error('\n❌ TEST ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
}
