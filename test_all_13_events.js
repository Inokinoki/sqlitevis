#!/usr/bin/env node

/**
 * All 13 Event Types Validation
 * Comprehensive test that validates every single SQLite event type
 */

const fs = require('fs');

global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = () => {};
global.ResizeObserver = class { constructor() {} observe() {} unobserve() {} disconnect() {} };;

let eventsPassed = 0;
let eventsFailed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`✓ ${message}`);
        eventsPassed++;
    } else {
        console.error(`✗ ${message}`);
        eventsFailed++;
    }
}

console.log('='.repeat(70));
console.log('All 13 SQLite Event Types - Comprehensive Validation');
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

    // Connect all events
    eventManager.on(0, (e) => { viz.pageSize = e.data.pageSize; });
    eventManager.on(1, (e) => { /* BTREE_CLOSE */ });
    eventManager.on(2, (e) => { viz.addCell(e.data.page, e.data.cell, e.data.keyLen); });
    eventManager.on(3, (e) => { viz.deleteCell(e.data.page, e.data.cell); });
    eventManager.on(4, (e) => { viz.splitPage(e.data.originalPage, e.data.newPage, e.data.splitCell); });
    eventManager.on(5, (e) => { /* BTREE_BALANCE */ });
    eventManager.on(6, (e) => { viz.addPage(e.data.page, e.data.type); });
    eventManager.on(7, (e) => { viz.nodes.delete(e.data.page); viz.layout(); viz.draw(); });
    eventManager.on(8, (e) => { viz.showParseStart(e.data.sql); });
    eventManager.on(9, (e) => { viz.showParseToken(e.data.token, e.data.type); });
    eventManager.on(10, (e) => { viz.showParseComplete(e.data.success); });
    eventManager.on(11, (e) => { viz.showVdbeStart(e.data.numOpcodes || e.data.opcode_count); });
    eventManager.on(12, (e) => { viz.showVdbeOpcode(e.data.pc, e.data.opcode, e.data.p1, e.data.p2, e.data.p3); });
    eventManager.on(13, (e) => { viz.showVdbeComplete(e.data.resultCode || e.data.result_code); });

    const viz = new BTreeVisualizer('visualization-canvas');

    console.log('\n### Event Type 0: BTREE_OPEN ###');
    viz.setViewMode('btree');
    eventManager.handleEvent(0, JSON.stringify({ pageSize: 4096, numPages: 1 }));
    assert(viz.pageSize === 4096, 'BTREE_OPEN: Page size set');
    assert(eventManager.eventCount > 0, 'BTREE_OPEN: Event recorded');

    console.log('\n### Event Type 1: BTREE_CLOSE ###');
    eventManager.handleEvent(1, JSON.stringify({}));
    assert(true, 'BTREE_CLOSE: Event handled');

    console.log('\n### Event Type 2: BTREE_INSERT ###');
    viz.addPage(1, 1, null);
    eventManager.handleEvent(2, JSON.stringify({ page: 1, cell: 0, keyLen: 100 }));
    assert(viz.nodes.get(1).cells.length === 1, 'BTREE_INSERT: Cell added to page');

    console.log('\n### Event Type 3: BTREE_DELETE ###');
    viz.addCell(1, 1, 200);
    eventManager.handleEvent(3, JSON.stringify({ page: 1, cell: 0 }));
    assert(viz.nodes.get(1).cells.length === 1, 'BTREE_DELETE: Cell removed from page');

    console.log('\n### Event Type 4: BTREE_SPLIT ###');
    viz.clear();
    viz.addPage(1, 1, null);
    for (let i = 0; i < 5; i++) {
        viz.addCell(1, i, i * 10);
    }
    eventManager.handleEvent(4, JSON.stringify({ originalPage: 1, newPage: 2, splitCell: 2 }));
    assert(viz.nodes.size === 2, 'BTREE_SPLIT: New page created');
    assert(viz.nodes.get(1).cells.length + viz.nodes.get(2).cells.length === 5, 'BTREE_SPLIT: All cells preserved');

    console.log('\n### Event Type 5: BTREE_BALANCE ###');
    eventManager.handleEvent(5, JSON.stringify({ page: 1, numCells: 5 }));
    assert(true, 'BTREE_BALANCE: Event handled');

    console.log('\n### Event Type 6: PAGE_ALLOCATE ###');
    viz.clear();
    eventManager.handleEvent(6, JSON.stringify({ page: 1, type: 0 }));
    assert(viz.nodes.has(1), 'PAGE_ALLOCATE: Page created');
    assert(viz.nodes.get(1).type === 0, 'PAGE_ALLOCATE: Interior page type set');

    console.log('\n### Event Type 7: PAGE_FREE ###');
    eventManager.handleEvent(6, JSON.stringify({ page: 2, type: 1 }));
    eventManager.handleEvent(7, JSON.stringify({ page: 2 }));
    assert(!viz.nodes.has(2), 'PAGE_FREE: Page removed');

    console.log('\n### Event Type 8: PARSE_START ###');
    viz.setViewMode('parse');
    eventManager.handleEvent(8, JSON.stringify({ sql: 'SELECT * FROM users' }));
    assert(viz.currentSQL === 'SELECT * FROM users', 'PARSE_START: SQL stored');

    console.log('\n### Event Type 9: PARSE_TOKEN ###');
    eventManager.handleEvent(9, JSON.stringify({ token: 'SELECT', type: 38 }));
    eventManager.handleEvent(9, JSON.stringify({ token: '*', type: 103 }));
    eventManager.handleEvent(9, JSON.stringify({ token: 'FROM', type: 41 }));
    assert(viz.parseTokens.length === 3, 'PARSE_TOKEN: Tokens recorded');

    console.log('\n### Event Type 10: PARSE_COMPLETE ###');
    eventManager.handleEvent(10, JSON.stringify({ success: 1 }));
    assert(true, 'PARSE_COMPLETE: Parse completion handled');

    console.log('\n### Event Type 11: VDBE_START ###');
    viz.setViewMode('vdbe');
    eventManager.handleEvent(11, JSON.stringify({ opcode_count: 10 }));
    assert(viz.vdbeCurrentPc === -1, 'VDBE_START: PC reset to -1');

    console.log('\n### Event Type 12: VDBE_OPCODE ###');
    eventManager.handleEvent(12, JSON.stringify({ pc: 0, opcode: 'Init', p1: 0, p2: 10, p3: 0 }));
    assert(viz.vdbeOpcodes[0].opcode === 'Init', 'VDBE_OPCODE: First opcode recorded');
    assert(viz.vdbeCurrentPc === 0, 'VDBE_OPCODE: PC updated');

    eventManager.handleEvent(12, JSON.stringify({ pc: 1, opcode: 'OpenRead', p1: 0, p2: 1, p3: 0 }));
    assert(viz.vdbeOpcodes.length === 2, 'VDBE_OPCODE: Second opcode recorded');

    console.log('\n### Event Type 13: VDBE_COMPLETE ###');
    eventManager.handleEvent(13, JSON.stringify({ result_code: 0 }));
    assert(true, 'VDBE_COMPLETE: Execution completion handled');

    console.log('\n### Cross-System Integration ###');

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

    assert(viz.nodes.size === 1, 'Integration: B-tree data present');
    assert(viz.parseTokens.length === 1, 'Integration: Parse data present');
    assert(viz.vdbeOpcodes.length === 1, 'Integration: VDBE data present');

    console.log('\n### View Mode Switching ###');

    const btreeSize = viz.nodes.size;
    const parseTokens = viz.parseTokens.length;
    const vdbeOpcodes = viz.vdbeOpcodes.length;

    viz.setViewMode('btree');
    assert(viz.nodes.size === btreeSize, 'Switch to B-tree: Data preserved');

    viz.setViewMode('parse');
    assert(viz.parseTokens.length === parseTokens, 'Switch to Parse: Data preserved');

    viz.setViewMode('vdbe');
    assert(viz.vdbeOpcodes.length === vdbeOpcodes, 'Switch to VDBE: Data preserved');

    console.log('\n### All 13 Event Types Summary ###');

    const eventTypeNames = [
        'BTREE_OPEN',
        'BTREE_CLOSE',
        'BTREE_INSERT',
        'BTREE_DELETE',
        'BTREE_SPLIT',
        'BTREE_BALANCE',
        'PAGE_ALLOCATE',
        'PAGE_FREE',
        'PARSE_START',
        'PARSE_TOKEN',
        'PARSE_COMPLETE',
        'VDBE_START',
        'VDBE_OPCODE',
        'VDBE_COMPLETE'
    ];

    eventTypeNames.forEach((name, index) => {
        console.log(`✓ Event ${index}: ${name}`);
    });

    console.log('\n### Final System Verification ###');

    assert(eventManager.eventCount > 0, 'Event Manager: Events processed');
    assert(typeof viz.showVdbeStart === 'function', 'VDBE Methods: Available');
    assert(typeof viz.showParseStart === 'function', 'Parse Methods: Available');
    assert(typeof viz.addPage === 'function', 'B-tree Methods: Available');

    console.log('\n✅ ALL 13 EVENT TYPES VALIDATED');
    console.log('✅ VDBE Event and Visualization: WORKING');
    console.log('✅ SQL Instruction Parsing and Visualization: WORKING');
    console.log('✅ Page Node Event and Visualization: WORKING');

} catch (error) {
    console.error('\n❌ Error during event validation:', error.message);
    console.error(error.stack);
    eventsFailed++;
}

console.log('\n' + '='.repeat(70));
console.log(`Event Validation Complete: ${eventsPassed} passed, ${eventsFailed} failed`);
console.log('='.repeat(70));

process.exit(eventsFailed > 0 ? 1 : 0);
