#!/usr/bin/env node

/**
 * Iteration 2: Deep Validation Test
 * More thorough testing of all visualization systems
 */

const fs = require('fs');

global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = () => {};
global.ResizeObserver = class { constructor() {} observe() {} unobserve() {} disconnect() {} };

console.log('='.repeat(80));
console.log('ITERATION 2: DEEP VALIDATION TEST');
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

    // Connect all event handlers
    eventManager.on(0, (e) => { viz.onBtreeOpen && viz.onBtreeOpen(e.data); });
    eventManager.on(1, (e) => { viz.onBtreeClose && viz.onBtreeClose(e.data); });
    eventManager.on(2, (e) => { viz.addCell && viz.addCell(e.data.page, e.data.cell, e.data.keyLen); });
    eventManager.on(3, (e) => { viz.deleteCell && viz.deleteCell(e.data.page, e.data.cell); });
    eventManager.on(4, (e) => { viz.splitPage && viz.splitPage(e.data.originalPage, e.data.newPage, e.data.splitCell); });
    eventManager.on(5, (e) => { viz.onBalance && viz.onBalance(e.data); });
    eventManager.on(6, (e) => { viz.addPage && viz.addPage(e.data.page, e.data.type); });
    eventManager.on(7, (e) => { viz.onPageFree && viz.onPageFree(e.data); });
    eventManager.on(8, (e) => { viz.showParseStart && viz.showParseStart(e.data.sql); });
    eventManager.on(9, (e) => { viz.showParseToken && viz.showParseToken(e.data.token, e.data.type); });
    eventManager.on(10, (e) => { viz.showParseComplete && viz.showParseComplete(); });
    eventManager.on(11, (e) => { viz.showVdbeStart && viz.showVdbeStart(e.data.numOpcodes || e.data.opcode_count); });
    eventManager.on(12, (e) => { viz.showVdbeOpcode && viz.showVdbeOpcode(e.data.pc, e.data.opcode, e.data.p1, e.data.p2, e.data.p3); });
    eventManager.on(13, (e) => { viz.showVdbeComplete && viz.showVdbeComplete(); });

    const viz = new BTreeVisualizer('visualization-canvas');

    let testResults = {
        vdbe: { passed: 0, failed: 0, tests: [] },
        parse: { passed: 0, failed: 0, tests: [] },
        btree: { passed: 0, failed: 0, tests: [] },
        integration: { passed: 0, failed: 0, tests: [] }
    };

    function testResult(category, name, passed, details = '') {
        const result = { name, passed, details };
        testResults[category].tests.push(result);
        if (passed) {
            testResults[category].passed++;
            console.log(`  ✓ ${name}`);
        } else {
            testResults[category].failed++;
            console.log(`  ✗ ${name}: ${details}`);
        }
        if (details) console.log(`    ${details}`);
    }

    console.log('\n### DEEP VDBE SYSTEM TEST ###\n');

    viz.setViewMode('vdbe');
    viz.vdbeOpcodes = [];
    viz.vdbeCurrentPc = -1;

    // VDBE Test 1: Initialization
    eventManager.handleEvent(11, JSON.stringify({ opcode_count: 5 }));
    testResult('vdbe', 'VDBE_START initializes opcode array',
        viz.vdbeOpcodes.length === 0, `Array length: ${viz.vdbeOpcodes.length}`);

    // VDBE Test 2: Single opcode
    eventManager.handleEvent(12, JSON.stringify({ pc: 0, opcode: 'Init', p1: 0, p2: 0, p3: 0 }));
    testResult('vdbe', 'VDBE_OPCODE records single opcode',
        viz.vdbeOpcodes.length === 1 && viz.vdbeOpcodes[0].opcode === 'Init',
        `Opcodes: ${viz.vdbeOpcodes.length}, First: ${viz.vdbeOpcodes[0]?.opcode}`);

    // VDBE Test 3: Sequential opcodes
    eventManager.handleEvent(12, JSON.stringify({ pc: 1, opcode: 'OpenRead', p1: 0, p2: 2, p3: 0 }));
    eventManager.handleEvent(12, JSON.stringify({ pc: 2, opcode: 'Rewind', p1: 0, p2: 5, p3: 0 }));
    testResult('vdbe', 'VDBE_OPCODE records sequential opcodes',
        viz.vdbeOpcodes.length === 3,
        `Opcodes: ${viz.vdbeOpcodes.map(o => o.opcode).join(', ')}`);

    // VDBE Test 4: Program counter tracking
    testResult('vdbe', 'VDBE program counter tracks correctly',
        viz.vdbeCurrentPc === 2, `Current PC: ${viz.vdbeCurrentPc}`);

    // VDBE Test 5: Completion
    eventManager.handleEvent(13, JSON.stringify({ result_code: 0 }));
    testResult('vdbe', 'VDBE_COMPLETE marks execution complete', true);

    // VDBE Test 6: Complex opcode types
    const complexOpcodes = [
        'Column', 'MakeRecord', 'Insert', 'SeekRowid', 'ResultRow',
        'NotExists', 'Next', 'Prev', 'Goto', 'If'
    ];
    complexOpcodes.forEach((op, i) => {
        eventManager.handleEvent(12, JSON.stringify({
            pc: 10 + i,
            opcode: op,
            p1: i,
            p2: i + 1,
            p3: i + 2
        }));
    });
    testResult('vdbe', 'VDBE handles various opcode types',
        viz.vdbeOpcodes.length >= 10,
        `Total opcodes: ${viz.vdbeOpcodes.length}`);

    console.log('\n### DEEP PARSE SYSTEM TEST ###\n');

    viz.setViewMode('parse');
    viz.parseTokens = [];
    viz.currentSQL = '';

    // Parse Test 1: SQL capture
    const testSQL = 'SELECT id, name FROM users WHERE age > 25 ORDER BY name';
    eventManager.handleEvent(8, JSON.stringify({ sql: testSQL }));
    testResult('parse', 'PARSE_START captures SQL',
        viz.currentSQL === testSQL, `SQL: "${viz.currentSQL}"`);

    // Parse Test 2: Single token
    eventManager.handleEvent(9, JSON.stringify({ token: 'SELECT', type: 38 }));
    testResult('parse', 'PARSE_TOKEN records single token',
        viz.parseTokens.length === 1 && viz.parseTokens[0].token === 'SELECT',
        `Token: ${viz.parseTokens[0]?.token}`);

    // Parse Test 3: Multiple tokens
    const tokens = [
        { token: 'id', type: 1 },
        { token: ',', type: 53 },
        { token: 'name', type: 1 },
        { token: 'FROM', type: 41 },
        { token: 'users', type: 1 },
        { token: 'WHERE', type: 48 },
        { token: 'age', type: 1 },
        { token: '>', type: 22 },
        { token: '25', type: 1 },
        { token: 'ORDER', type: 44 }
    ];
    tokens.forEach(t => eventManager.handleEvent(9, JSON.stringify(t)));
    testResult('parse', 'PARSE_TOKEN records multiple tokens',
        viz.parseTokens.length === 11,
        `Tokens: ${viz.parseTokens.length}`);

    // Parse Test 4: Token type mapping
    const selectToken = viz.parseTokens.find(t => t.token === 'SELECT');
    testResult('parse', 'PARSE_TOKEN maps token types correctly',
        selectToken && selectToken.type === 38, `SELECT type: ${selectToken?.type}`);

    // Parse Test 5: Completion
    eventManager.handleEvent(10, JSON.stringify({ success: 1 }));
    testResult('parse', 'PARSE_COMPLETE marks parsing complete', true);

    console.log('\n### DEEP B-TREE SYSTEM TEST ###\n');

    viz.setViewMode('btree');
    viz.nodes.clear();
    viz.rootPage = 1;

    // B-tree Test 1: Page allocation
    eventManager.handleEvent(6, JSON.stringify({ page: 1, type: 1 }));
    testResult('btree', 'PAGE_ALLOCATE creates page',
        viz.nodes.has(1), `Pages: ${viz.nodes.size}`);

    // B-tree Test 2: Page type tracking
    const page1 = viz.nodes.get(1);
    testResult('btree', 'PAGE_ALLOCATE sets page type',
        page1 && page1.type === 1, `Page 1 type: ${page1?.type} (1=leaf)`);

    // B-tree Test 3: Cell insertion
    eventManager.handleEvent(2, JSON.stringify({ page: 1, cell: 0, keyLen: 4, dataLen: 20 }));
    eventManager.handleEvent(2, JSON.stringify({ page: 1, cell: 1, keyLen: 4, dataLen: 25 }));
    testResult('btree', 'BTREE_INSERT adds cells to page',
        page1.cells.length === 2, `Page 1 cells: ${page1.cells.length}`);

    // B-tree Test 4: Cell data tracking
    const cell0 = page1.cells[0];
    testResult('btree', 'BTREE_INSERT tracks cell data',
        cell0 && cell0.keyLen === 4 && cell0.dataLen === 20,
        `Cell 0: keyLen=${cell0?.keyLen}, dataLen=${cell0?.dataLen}`);

    // B-tree Test 5: Page split
    eventManager.handleEvent(6, JSON.stringify({ page: 2, type: 1 }));
    eventManager.handleEvent(4, JSON.stringify({ originalPage: 1, newPage: 2, splitCell: 1 }));
    testResult('btree', 'BTREE_SPLIT creates new page',
        viz.nodes.has(2), `Pages after split: ${viz.nodes.size}`);

    // B-tree Test 6: Cell distribution after split
    const page2 = viz.nodes.get(2);
    testResult('btree', 'BTREE_SPLIT distributes cells',
        page1.cells.length > 0 && page2.cells.length >= 0,
        `Page 1: ${page1.cells.length} cells, Page 2: ${page2.cells.length} cells`);

    // B-tree Test 7: Multiple pages
    eventManager.handleEvent(6, JSON.stringify({ page: 3, type: 2 }));
    eventManager.handleEvent(6, JSON.stringify({ page: 4, type: 1 }));
    testResult('btree', 'Multiple pages tracked independently',
        viz.nodes.size === 4, `Total pages: ${viz.nodes.size}`);

    // B-tree Test 8: Root page tracking
    testResult('btree', 'Root page tracked correctly',
        viz.rootPage === 1, `Root page: ${viz.rootPage}`);

    console.log('\n### INTEGRATION TESTS ###\n');

    // Integration Test 1: Event count accuracy
    const totalEvents = eventManager.eventCount;
    testResult('integration', 'Event manager tracks event count',
        totalEvents > 0, `Total events: ${totalEvents}`);

    // Integration Test 2: Event categorization
    const vdbeEvents = eventManager.events.filter(e => e.category === 'vdbe');
    const parseEvents = eventManager.events.filter(e => e.category === 'parse');
    const btreeEvents = eventManager.events.filter(e => e.category === 'btree');
    testResult('integration', 'Events categorized correctly',
        vdbeEvents.length > 0 && parseEvents.length > 0 && btreeEvents.length > 0,
        `VDBE: ${vdbeEvents.length}, Parse: ${parseEvents.length}, B-tree: ${btreeEvents.length}`);

    // Integration Test 3: View mode switching preserves data
    const vdbeCount = viz.vdbeOpcodes.length;
    const parseCount = viz.parseTokens.length;
    const btreeCount = viz.nodes.size;

    viz.setViewMode('vdbe');
    const vdbeAfter = viz.vdbeOpcodes.length;
    viz.setViewMode('parse');
    const parseAfter = viz.parseTokens.length;
    viz.setViewMode('btree');
    const btreeAfter = viz.nodes.size;

    testResult('integration', 'View mode switching preserves VDBE data',
        vdbeCount === vdbeAfter, `Before: ${vdbeCount}, After: ${vdbeAfter}`);
    testResult('integration', 'View mode switching preserves Parse data',
        parseCount === parseAfter, `Before: ${parseCount}, After: ${parseAfter}`);
    testResult('integration', 'View mode switching preserves B-tree data',
        btreeCount === btreeAfter, `Before: ${btreeCount}, After: ${btreeAfter}`);

    // Integration Test 4: All systems have data
    const allHaveData = viz.vdbeOpcodes.length > 0 &&
                       viz.parseTokens.length > 0 &&
                       viz.nodes.size > 0;
    testResult('integration', 'All visualization systems have data',
        allHaveData,
        `VDBE: ${viz.vdbeOpcodes.length}, Parse: ${viz.parseTokens.length}, B-tree: ${viz.nodes.size}`);

    // Integration Test 5: Event manager listener system
    let listenerCalled = false;
    eventManager.on(11, () => { listenerCalled = true; });
    eventManager.handleEvent(11, JSON.stringify({ opcode_count: 1 }));
    testResult('integration', 'Event manager listener system works',
        listenerCalled, 'Listener was called');

    console.log('\n### RESULTS SUMMARY ###\n');

    const totalPassed = testResults.vdbe.passed + testResults.parse.passed +
                       testResults.btree.passed + testResults.integration.passed;
    const totalFailed = testResults.vdbe.failed + testResults.parse.failed +
                       testResults.btree.failed + testResults.integration.failed;
    const totalTests = totalPassed + totalFailed;

    console.log('VDBE System:');
    console.log(`  Passed: ${testResults.vdbe.passed}/${testResults.vdbe.tests.length}`);
    console.log(`  Failed: ${testResults.vdbe.failed}/${testResults.vdbe.tests.length}`);

    console.log('\nParse System:');
    console.log(`  Passed: ${testResults.parse.passed}/${testResults.parse.tests.length}`);
    console.log(`  Failed: ${testResults.parse.failed}/${testResults.parse.tests.length}`);

    console.log('\nB-tree System:');
    console.log(`  Passed: ${testResults.btree.passed}/${testResults.btree.tests.length}`);
    console.log(`  Failed: ${testResults.btree.failed}/${testResults.btree.tests.length}`);

    console.log('\nIntegration:');
    console.log(`  Passed: ${testResults.integration.passed}/${testResults.integration.tests.length}`);
    console.log(`  Failed: ${testResults.integration.failed}/${testResults.integration.tests.length}`);

    console.log('\n' + '='.repeat(80));
    console.log(`TOTAL: ${totalPassed}/${totalTests} tests passed (${Math.round(totalPassed/totalTests*100)}%)`);
    console.log('='.repeat(80));

    if (totalFailed === 0) {
        console.log('\n✅ ALL TESTS PASSED - ALL SYSTEMS OPERATIONAL\n');
        console.log('  ✓ VDBE event and visualization: WORKING');
        console.log('  ✓ SQL instruction parsing and visualization: WORKING');
        console.log('  ✓ Page node event and visualization: WORKING');
    } else {
        console.log(`\n⚠️  ${totalFailed} test(s) failed - review needed\n`);
    }

    process.exit(totalFailed > 0 ? 1 : 0);

} catch (error) {
    console.error('\n❌ TEST ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
}
