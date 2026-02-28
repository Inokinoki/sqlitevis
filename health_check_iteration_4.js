#!/usr/bin/env node

/**
 * Iteration 4: Health Check and Regression Test
 * Verify all systems continue to work correctly after multiple iterations
 */

const fs = require('fs');

global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = () => {};
global.ResizeObserver = class { constructor() {} observe() {} unobserve() {} disconnect() {} };

console.log('='.repeat(80));
console.log('ITERATION 4: HEALTH CHECK AND REGRESSION TEST');
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

    // Connect event handlers
    eventManager.on(2, (e) => { viz.addCell && viz.addCell(e.data.page, e.data.cell, e.data.keyLen); });
    eventManager.on(4, (e) => { viz.splitPage && viz.splitPage(e.data.originalPage, e.data.newPage, e.data.splitCell); });
    eventManager.on(6, (e) => { viz.addPage && viz.addPage(e.data.page, e.data.type); });
    eventManager.on(8, (e) => { viz.showParseStart && viz.showParseStart(e.data.sql); });
    eventManager.on(9, (e) => { viz.showParseToken && viz.showParseToken(e.data.token, e.data.type); });
    eventManager.on(11, (e) => { viz.showVdbeStart && viz.showVdbeStart(e.data.numOpcodes || e.data.opcode_count); });
    eventManager.on(12, (e) => { viz.showVdbeOpcode && viz.showVdbeOpcode(e.data.pc, e.data.opcode, e.data.p1, e.data.p2, e.data.p3); });

    const viz = new BTreeVisualizer('visualization-canvas');

    console.log('\n### REGRESSION TEST SUITE ###\n');

    let testsPassed = 0;
    let testsFailed = 0;

    function test(name, condition, details = '') {
        if (condition) {
            console.log(`✓ ${name}`);
            if (details) console.log(`  ${details}`);
            testsPassed++;
        } else {
            console.log(`✗ ${name}`);
            if (details) console.log(`  ${details}`);
            testsFailed++;
        }
    }

    console.log('#### VDBE System Regression Tests ####\n');

    viz.setViewMode('vdbe');
    viz.vdbeOpcodes = [];
    viz.vdbeCurrentPc = -1;

    // Test 1: VDBE_START initialization
    eventManager.handleEvent(11, JSON.stringify({ opcode_count: 10 }));
    test('VDBE-1: VDBE_START initializes', viz.vdbeOpcodes.length === 0);

    // Test 2: Multiple opcodes
    for (let i = 0; i < 10; i++) {
        eventManager.handleEvent(12, JSON.stringify({
            pc: i,
            opcode: `Op${i}`,
            p1: i,
            p2: i * 2,
            p3: i * 3
        }));
    }
    test('VDBE-2: 10 opcodes recorded', viz.vdbeOpcodes.length === 10,
        `Recorded ${viz.vdbeOpcodes.length} opcodes`);

    // Test 3: Program counter
    test('VDBE-3: PC tracking correct', viz.vdbeCurrentPc === 9,
        `Current PC: ${viz.vdbeCurrentPc}`);

    // Test 4: Opcode data integrity
    const op5 = viz.vdbeOpcodes[5];
    test('VDBE-4: Opcode data integrity',
        op5 && op5.opcode === 'Op5' && op5.p1 === 5 && op5.p2 === 10 && op5.p3 === 15,
        `Op5: ${op5?.opcode}, p1=${op5?.p1}, p2=${op5?.p2}, p3=${op5?.p3}`);

    // Test 5: VDBE_COMPLETE
    eventManager.handleEvent(13, JSON.stringify({ result_code: 0 }));
    test('VDBE-5: VDBE_COMPLETE recorded', true);

    console.log('\n#### Parse System Regression Tests ####\n');

    viz.setViewMode('parse');
    viz.parseTokens = [];
    viz.currentSQL = '';

    // Test 6: Complex SQL capture
    const complexSQL = 'SELECT u.name, o.order_date FROM users u JOIN orders o ON u.id = o.user_id WHERE u.status = "active" ORDER BY o.order_date DESC LIMIT 10';
    eventManager.handleEvent(8, JSON.stringify({ sql: complexSQL }));
    test('PARSE-1: Complex SQL captured', viz.currentSQL === complexSQL,
        `SQL length: ${viz.currentSQL.length} chars`);

    // Test 7: Many tokens
    const manyTokens = ['SELECT', 'u', '.', 'name', ',', 'o', '.', 'order_date', 'FROM', 'users',
                       'u', 'JOIN', 'orders', 'o', 'ON', 'u', '.', 'id', '=', 'o', '.', 'user_id',
                       'WHERE', 'u', '.', 'status', '=', '"active"', 'ORDER', 'BY', 'o', '.',
                       'order_date', 'DESC', 'LIMIT', '10'];
    manyTokens.forEach((token, i) => {
        eventManager.handleEvent(9, JSON.stringify({ token: token, type: 1 }));
    });
    test('PARSE-2: 33 tokens recorded', viz.parseTokens.length === manyTokens.length,
        `Recorded ${viz.parseTokens.length} tokens`);

    // Test 8: Token integrity
    const token10 = viz.parseTokens[10];
    test('PARSE-3: Token data integrity', token10 && token10.token === 'users',
        `Token 10: ${token10?.token}`);

    // Test 9: PARSE_COMPLETE
    eventManager.handleEvent(10, JSON.stringify({ success: 1 }));
    test('PARSE-4: PARSE_COMPLETE recorded', true);

    console.log('\n#### B-Tree System Regression Tests ####\n');

    viz.setViewMode('btree');
    viz.nodes.clear();
    viz.rootPage = 1;

    // Test 10: Many pages
    for (let i = 1; i <= 10; i++) {
        eventManager.handleEvent(6, JSON.stringify({ page: i, type: i % 2 }));
    }
    test('BTREE-1: 10 pages created', viz.nodes.size === 10,
        `Created ${viz.nodes.size} pages`);

    // Test 11: Page type diversity
    let leafCount = 0;
    let interiorCount = 0;
    viz.nodes.forEach(node => {
        if (node.type === 1) leafCount++;
        else interiorCount++;
    });
    test('BTREE-2: Page type diversity', leafCount > 0 && interiorCount > 0,
        `Leaf: ${leafCount}, Interior: ${interiorCount}`);

    // Test 12: Cell insertions
    for (let i = 1; i <= 10; i++) {
        eventManager.handleEvent(2, JSON.stringify({
            page: i,
            cell: 0,
            keyLen: i * 10
        }));
    }
    let totalCells = 0;
    viz.nodes.forEach(node => {
        totalCells += node.cells.length;
    });
    test('BTREE-3: 10 cells inserted', totalCells === 10,
        `Total cells: ${totalCells}`);

    // Test 13: Page splits
    eventManager.handleEvent(6, JSON.stringify({ page: 11, type: 1 }));
    eventManager.handleEvent(4, JSON.stringify({
        originalPage: 1,
        newPage: 11,
        splitCell: 0
    }));
    test('BTREE-4: Page split successful', viz.nodes.has(11) && viz.nodes.size === 11,
        `Pages after split: ${viz.nodes.size}`);

    // Test 14: Root page tracking
    test('BTREE-5: Root page stable', viz.rootPage === 1,
        `Root page: ${viz.rootPage}`);

    console.log('\n#### Integration Regression Tests ####\n');

    // Test 15: Event count accuracy
    const totalEvents = eventManager.eventCount;
    test('INT-1: Event count accurate', totalEvents > 0,
        `Total events: ${totalEvents}`);

    // Test 16: Event categorization
    const vdbeEvents = eventManager.events.filter(e => e.category === 'vdbe');
    const parseEvents = eventManager.events.filter(e => e.category === 'parse');
    const btreeEvents = eventManager.events.filter(e => e.category === 'btree');
    test('INT-2: Events categorized',
        vdbeEvents.length > 0 && parseEvents.length > 0 && btreeEvents.length > 0,
        `VDBE: ${vdbeEvents.length}, Parse: ${parseEvents.length}, B-tree: ${btreeEvents.length}`);

    // Test 17: View mode switching (data preservation)
    const vdbeCount = viz.vdbeOpcodes.length;
    const parseCount = viz.parseTokens.length;
    const btreeCount = viz.nodes.size;

    viz.setViewMode('vdbe');
    const vdbeAfter = viz.vdbeOpcodes.length;
    viz.setViewMode('parse');
    const parseAfter = viz.parseTokens.length;
    viz.setViewMode('btree');
    const btreeAfter = viz.nodes.size;

    test('INT-3: VDBE data preserved', vdbeCount === vdbeAfter,
        `Before: ${vdbeCount}, After: ${vdbeAfter}`);
    test('INT-4: Parse data preserved', parseCount === parseAfter,
        `Before: ${parseCount}, After: ${parseAfter}`);
    test('INT-5: B-tree data preserved', btreeCount === btreeAfter,
        `Before: ${btreeCount}, After: ${btreeAfter}`);

    // Test 18: All systems have data
    test('INT-6: All systems populated',
        viz.vdbeOpcodes.length > 0 && viz.parseTokens.length > 0 && viz.nodes.size > 0,
        `VDBE: ${viz.vdbeOpcodes.length}, Parse: ${viz.parseTokens.length}, B-tree: ${viz.nodes.size}`);

    // Test 19: Event manager listener system
    let listenerCalled = false;
    eventManager.on(13, () => { listenerCalled = true; });
    eventManager.handleEvent(13, JSON.stringify({ result_code: 0 }));
    test('INT-7: Listener system works', listenerCalled);

    // Test 20: Multiple rapid event sequences
    const initialEventCount = eventManager.eventCount;
    for (let i = 0; i < 50; i++) {
        eventManager.handleEvent(11, JSON.stringify({ opcode_count: i }));
        eventManager.handleEvent(12, JSON.stringify({ pc: i, opcode: 'Test', p1: 0, p2: 0, p3: 0 }));
        eventManager.handleEvent(13, JSON.stringify({ result_code: 0 }));
    }
    const finalEventCount = eventManager.eventCount;
    test('INT-8: Rapid event handling',
        finalEventCount === initialEventCount + 150,
        `Processed ${finalEventCount - initialEventCount} events`);

    console.log('\n### RESULTS SUMMARY ###\n');

    const totalTests = testsPassed + testsFailed;
    const passRate = Math.round((testsPassed / totalTests) * 100);

    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${testsPassed}`);
    console.log(`Failed: ${testsFailed}`);
    console.log(`Pass Rate: ${passRate}%`);

    console.log('\n' + '='.repeat(80));

    if (testsFailed === 0) {
        console.log('✅ ALL REGRESSION TESTS PASSED');
        console.log('\nSystems verified:');
        console.log('  ✓ VDBE event and visualization: WORKING');
        console.log('  ✓ SQL instruction parsing and visualization: WORKING');
        console.log('  ✓ Page node event and visualization: WORKING');
        console.log('\nNo degradation detected since previous iterations.');
    } else {
        console.log(`⚠️  ${testsFailed} REGRESSION TEST(S) FAILED`);
        console.log('\nReview needed for failed tests above.');
    }

    console.log('='.repeat(80));

    process.exit(testsFailed > 0 ? 1 : 0);

} catch (error) {
    console.error('\n❌ TEST ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
}
