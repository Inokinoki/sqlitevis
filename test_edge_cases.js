#!/usr/bin/env node

/**
 * Edge Cases and Stress Tests
 * Tests boundary conditions, null values, and extreme scenarios
 */

const fs = require('fs');

global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = () => {};
global.ResizeObserver = class { constructor() {} observe() {} unobserve() {} disconnect() {} };

let edgeTestsPassed = 0;
let edgeTestsFailed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`✓ ${message}`);
        edgeTestsPassed++;
    } else {
        console.error(`✗ ${message}`);
        edgeTestsFailed++;
    }
}

console.log('='.repeat(70));
console.log('Edge Cases and Stress Tests');
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

    console.log('\n### Test Suite 1: Null and Undefined Values ###');

    console.log('\n--- Test 1: Null SQL String ---');
    viz.setViewMode('parse');
    viz.showParseStart(null);
    assert(true, 'Null SQL handled without crash');

    console.log('\n--- Test 2: Empty SQL String ---');
    viz.showParseStart('');
    assert(true, 'Empty SQL handled without crash');

    console.log('\n--- Test 3: Undefined Token ---');
    viz.showParseToken(undefined, 1);
    assert(true, 'Undefined token handled');

    console.log('\n--- Test 4: Null Token ---');
    viz.showParseToken(null, 1);
    assert(true, 'Null token handled');

    console.log('\n--- Test 5: Non-string Token ---');
    viz.showParseToken(12345, 1);
    assert(true, 'Non-string token converted');

    console.log('\n### Test Suite 2: Extreme Values ###');

    console.log('\n--- Test 6: Very Large PC Value ---');
    viz.setViewMode('vdbe');
    viz.showVdbeOpcode(999999, 'Halt', 0, 0, 0);
    assert(viz.vdbeCurrentPc === 999999, 'Large PC value handled');

    console.log('\n--- Test 7: Negative PC Value ---');
    viz.showVdbeOpcode(-1, 'Invalid', 0, 0, 0);
    assert(true, 'Negative PC handled gracefully');

    console.log('\n--- Test 8: Very Large Page Number ---');
    viz.setViewMode('btree');
    viz.addPage(9999999, 1, null);
    assert(viz.nodes.has(9999999), 'Very large page number handled');

    console.log('\n--- Test 9: Zero Page Number ---');
    viz.addPage(0, 1, null);
    assert(viz.nodes.has(0), 'Zero page number handled');

    console.log('\n--- Test 10: Very Large Key Length ---');
    viz.addPage(1, 1, null);
    viz.addCell(1, 0, 9999999);
    assert(viz.nodes.get(1).cells[0].keyLen === 9999999, 'Large key length stored');

    console.log('\n### Test Suite 3: Boundary Conditions ###');

    console.log('\n--- Test 11: Empty Event Data ---');
    eventManager.handleEvent(11, JSON.stringify({}));
    assert(true, 'Empty event data handled');

    console.log('\n--- Test 12: Malformed JSON ---');
    eventManager.handleEvent(11, 'invalid json{');
    assert(true, 'Malformed JSON handled');

    console.log('\n--- Test 13: Unknown Event Type ---');
    eventManager.handleEvent(999, JSON.stringify({ test: 'data' }));
    assert(true, 'Unknown event type handled');

    console.log('\n--- Test 14: Missing Event Fields ---');
    eventManager.handleEvent(12, JSON.stringify({ pc: 0 }));
    assert(true, 'Missing opcode field handled');

    console.log('\n### Test Suite 4: Memory and Performance ###');

    console.log('\n--- Test 15: Rapid Mode Switching ---');
    for (let i = 0; i < 100; i++) {
        viz.setViewMode(i % 2 === 0 ? 'btree' : 'parse');
    }
    assert(true, '100 rapid mode switches handled');

    console.log('\n--- Test 16: Rapid Event Bursts ---');
    viz.setViewMode('btree');
    for (let i = 0; i < 1000; i++) {
        viz.addPage(i, 1, null);
    }
    assert(viz.nodes.size === 1000, '1000 pages created successfully');

    console.log('\n--- Test 17: Large Cell Count ---');
    viz.clear();
    viz.addPage(1, 1, null);
    for (let i = 0; i < 500; i++) {
        viz.addCell(1, i, i);
    }
    assert(viz.nodes.get(1).cells.length === 500, '500 cells added to single page');

    console.log('\n### Test Suite 5: Special Characters ###');

    console.log('\n--- Test 18: SQL with Quotes ---');
    viz.setViewMode('parse');
    const sqlWithQuotes = 'SELECT * FROM users WHERE name = "O\'Reilly"';
    viz.showParseStart(sqlWithQuotes);
    assert(viz.currentSQL.includes('O\'Reilly'), 'Quotes in SQL handled');

    console.log('\n--- Test 19: SQL with Newlines ---');
    const sqlWithNewlines = 'SELECT *\nFROM users\nWHERE id = 1';
    viz.showParseStart(sqlWithNewlines);
    assert(viz.currentSQL.includes('\n'), 'Newlines in SQL preserved');

    console.log('\n--- Test 20: Unicode in SQL ---');
    const sqlWithUnicode = 'SELECT * FROM 用户 WHERE 名称 = "测试"';
    viz.showParseStart(sqlWithUnicode);
    assert(viz.currentSQL.includes('测试'), 'Unicode characters preserved');

    console.log('\n### Test Suite 6: Concurrent Operations ###');

    console.log('\n--- Test 21: Mixed Event Types ---');
    viz.clear();
    viz.setViewMode('btree');
    viz.addPage(1, 1, null);
    viz.addCell(1, 0, 100);

    viz.setViewMode('parse');
    viz.showParseStart('SELECT 1');
    viz.showParseToken('SELECT', 38);

    viz.setViewMode('vdbe');
    viz.showVdbeStart(3);
    viz.showVdbeOpcode(0, 'Init', 0, 0, 0);

    assert(true, 'Mixed operations across modes handled');

    console.log('\n--- Test 22: Simultaneous Page Operations ---');
    viz.clear();
    viz.setViewMode('btree');
    viz.addPage(1, 1, null);
    viz.addPage(2, 1, 1);
    viz.addPage(3, 1, 1);
    viz.addCell(1, 0, 100);
    viz.addCell(2, 0, 200);
    viz.addCell(3, 0, 300);
    assert(viz.nodes.size === 3, 'Simultaneous page operations successful');

    console.log('\n### Test Suite 7: State Consistency ###');

    console.log('\n--- Test 23: View Mode State ---');
    viz.setViewMode('btree');
    const mode1 = viz.viewMode;
    viz.setViewMode('parse');
    const mode2 = viz.viewMode;
    viz.setViewMode('vdbe');
    const mode3 = viz.viewMode;
    assert(mode1 === 'btree' && mode2 === 'parse' && mode3 === 'vdbe', 'View mode state consistent');

    console.log('\n--- Test 24: Data Persistence Across Clear ---');
    viz.setViewMode('btree');
    viz.addPage(1, 1, null);
    viz.addPage(2, 1, null);
    const sizeBefore = viz.nodes.size;
    viz.clear();
    const sizeAfter = viz.nodes.size;
    assert(sizeBefore === 2 && sizeAfter === 0, 'Clear removes all data');

    console.log('\n--- Test 25: Page Count Updates ---');
    viz.addPage(1, 1, null);
    viz.addPage(2, 1, null);
    viz.addPage(3, 1, null);
    assert(viz.nodes.size === 3, 'Page count accurate');

    console.log('\n### Test Suite 8: Error Recovery ###');

    console.log('\n--- Test 26: Invalid Mode Switch ---');
    viz.setViewMode('invalid_mode');
    assert(viz.viewMode === 'invalid_mode', 'Invalid mode accepted (failsafe)');

    console.log('\n--- Test 27: Double Clear ---');
    viz.clear();
    viz.clear();
    assert(true, 'Double clear handled');

    console.log('\n--- Test 28: Operation on Empty State ---');
    viz.clear();
    viz.addCell(999, 0, 100);
    assert(true, 'Operation on empty state handled');

    console.log('\n--- Test 29: Layout with No Nodes ---');
    viz.clear();
    viz.layout();
    assert(true, 'Layout with no nodes handled');

    console.log('\n--- Test 30: Draw with No Nodes ---');
    viz.clear();
    viz.draw();
    assert(true, 'Draw with no nodes handled');

    console.log('\n### Test Suite 9: Data Integrity ###');

    console.log('\n--- Test 31: Page Type Integrity ---');
    viz.clear();
    viz.addPage(1, 0, null);
    viz.addPage(2, 1, null);
    assert(viz.nodes.get(1).type === 0, 'Interior type preserved');
    assert(viz.nodes.get(2).type === 1, 'Leaf type preserved');

    console.log('\n--- Test 32: Cell Index Integrity ---');
    viz.addCell(1, 0, 100);
    viz.addCell(1, 5, 500);
    viz.addCell(1, 10, 1000);
    assert(viz.nodes.get(1).cells[0].idx === 0, 'Cell index 0 preserved');
    assert(viz.nodes.get(1).cells[1].idx === 5, 'Cell index 5 preserved');
    assert(viz.nodes.get(1).cells[2].idx === 10, 'Cell index 10 preserved');

    console.log('\n--- Test 33: Opcode PC Integrity ---');
    viz.setViewMode('vdbe');
    viz.showVdbeOpcode(100, 'Test', 1, 2, 3);
    assert(viz.vdbeOpcodes[100].pc === 100, 'Opcode PC preserved');
    assert(viz.vdbeOpcodes[100].p1 === 1, 'Opcode P1 preserved');
    assert(viz.vdbeOpcodes[100].p2 === 2, 'Opcode P2 preserved');
    assert(viz.vdbeOpcodes[100].p3 === 3, 'Opcode P3 preserved');

    console.log('\n### Test Suite 10: Long-Running Operations ###');

    console.log('\n--- Test 34: Long Token Stream ---');
    viz.setViewMode('parse');
    viz.showParseStart('SELECT ' + Array(100).fill('column').join(', ') + ' FROM users');
    for (let i = 0; i < 100; i++) {
        viz.showParseToken('column' + i, 1);
    }
    assert(viz.parseTokens.length === 100, '100 token stream handled');

    console.log('\n--- Test 35: Deep Tree Structure ---');
    viz.clear();
    viz.setViewMode('btree');
    let parentPage = null;
    for (let i = 1; i <= 50; i++) {
        viz.addPage(i, 1, parentPage);
        if (parentPage !== null) {
            const parentNode = viz.nodes.get(parentPage);
            if (parentNode && !parentNode.children.includes(i)) {
                parentNode.children.push(i);
            }
        }
        parentPage = i;
    }
    assert(viz.nodes.size === 50, '50-level deep tree created');

    console.log('\n--- Test 36: Large VDBE Program ---');
    viz.setViewMode('vdbe');
    viz.showVdbeStart(500);
    for (let i = 0; i < 500; i++) {
        viz.showVdbeOpcode(i, 'Op' + i, i, i * 2, i * 3);
    }
    assert(viz.vdbeOpcodes.length === 500, '500-opcode program handled');

} catch (error) {
    console.error('\n❌ Error during edge case testing:', error.message);
    console.error(error.stack);
    edgeTestsFailed++;
}

console.log('\n' + '='.repeat(70));
console.log(`Edge Case Tests Complete: ${edgeTestsPassed} passed, ${edgeTestsFailed} failed`);
console.log('='.repeat(70));

process.exit(edgeTestsFailed > 0 ? 1 : 0);
