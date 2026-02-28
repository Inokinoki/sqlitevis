#!/usr/bin/env node

/**
 * Comprehensive test for VDBE events and visualization
 * Tests:
 * 1. VDBE_START event handling
 * 2. VDBE_OPCODE event processing
 * 3. VDBE_COMPLETE event handling
 * 4. Visualization rendering for each event type
 * 5. Integration with event manager
 */

const fs = require('fs');

// Setup mocks
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = () => {};
global.ResizeObserver = class { constructor() {} observe() {} unobserve() {} disconnect() {} };

let vdbeTestsPassed = 0;
let vdbeTestsFailed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`✓ ${message}`);
        vdbeTestsPassed++;
    } else {
        console.error(`✗ ${message}`);
        vdbeTestsFailed++;
    }
}

console.log('='.repeat(60));
console.log('VDBE Event and Visualization Tests');
console.log('='.repeat(60));

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

    console.log('\n--- Test 1: VDBE Initialization ---');
    const viz = new BTreeVisualizer('visualization-canvas');
    viz.setViewMode('vdbe');
    assert(viz.viewMode === 'vdbe', 'View mode set to vdbe');

    console.log('\n--- Test 2: Connect Event Manager to Visualizer ---');
    // Simulate main.js connection
    eventManager.on(11, (e) => { // VDBE_START
        viz.showVdbeStart(e.data.numOpcodes || e.data.opcode_count);
    });
    eventManager.on(12, (e) => { // VDBE_OPCODE
        viz.showVdbeOpcode(e.data.pc, e.data.opcode, e.data.p1, e.data.p2, e.data.p3);
    });
    eventManager.on(13, (e) => { // VDBE_COMPLETE
        viz.showVdbeComplete(e.data.resultCode || e.data.result_code);
    });
    assert(true, 'Event manager connected to visualizer');

    console.log('\n--- Test 3: VDBE_START Event (Event Type 11) ---');
    const initialOpcodeCount = 5;
    eventManager.handleEvent(11, JSON.stringify({ opcode_count: initialOpcodeCount }));
    assert(viz.vdbeOpcodes.length === 0, 'VDBE_START resets opcodes array');
    assert(viz.vdbeCurrentPc === -1, 'VDBE_START resets PC to -1');

    console.log('\n--- Test 4: VDBE_OPCODE Events (Event Type 12) ---');
    // Simulate opcode execution
    eventManager.handleEvent(12, JSON.stringify({
        pc: 0,
        opcode: 'Init',
        p1: 0,
        p2: 12,
        p3: 0
    }));

    assert(viz.vdbeOpcodes.length > 0, 'Opcodes array is populated');
    assert(viz.vdbeCurrentPc === 0, 'Current PC is set correctly');

    eventManager.handleEvent(12, JSON.stringify({
        pc: 1,
        opcode: 'OpenRead',
        p1: 0,
        p2: 2,
        p3: 0
    }));

    assert(viz.vdbeCurrentPc === 1, 'Current PC updates to 1');

    console.log('\n--- Test 5: VDBE_COMPLETE Event (Event Type 13) ---');
    eventManager.handleEvent(13, JSON.stringify({ result_code: 0 }));
    assert(true, 'VDBE_COMPLETE event processed without error');

    console.log('\n--- Test 6: Opcode Data Structure ---');
    const firstOpcode = viz.vdbeOpcodes[0];
    assert(firstOpcode !== undefined, 'First opcode exists');
    if (firstOpcode) {
        assert(firstOpcode.opcode === 'Init', 'First opcode name is "Init"');
        assert(firstOpcode.p1 === 0, 'First opcode P1 is 0');
        assert(firstOpcode.p2 === 12, 'First opcode P2 is 12');
        assert(firstOpcode.pc === 0, 'First opcode PC is 0');
    }

    console.log('\n--- Test 7: Multiple Opcodes Sequence ---');
    viz.clear();
    viz.setViewMode('vdbe');

    const opcodeSequence = [
        { pc: 0, opcode: 'Transaction', p1: 1, p2: 0, p3: 0 },
        { pc: 1, opcode: 'ReadCookie', p1: 0, p2: 2, p3: 0 },
        { pc: 2, opcode: 'Goto', p1: 0, p2: 10, p3: 0 }
    ];

    eventManager.handleEvent(11, JSON.stringify({ opcode_count: 3 }));

    opcodeSequence.forEach(op => {
        eventManager.handleEvent(12, JSON.stringify(op));
    });

    assert(viz.vdbeOpcodes.length === 3, 'All 3 opcodes recorded');
    assert(viz.vdbeOpcodes[1].opcode === 'ReadCookie', 'Second opcode is ReadCookie');

    console.log('\n--- Test 8: View Mode Persistence ---');
    assert(viz.viewMode === 'vdbe', 'View mode remains vdbe after events');

    console.log('\n--- Test 9: Event Manager Integration ---');
    const eventCount = eventManager.eventCount;
    assert(eventCount > 0, 'Event manager recorded events');

    console.log('\n--- Test 10: VDBE Display Methods ---');
    // Test that visualization methods exist and are callable
    assert(typeof viz.showVdbeStart === 'function', 'showVdbeStart method exists');
    assert(typeof viz.showVdbeOpcode === 'function', 'showVdbeOpcode method exists');
    assert(typeof viz.showVdbeComplete === 'function', 'showVdbeComplete method exists');
    assert(typeof viz.drawVdbeList === 'function', 'drawVdbeList method exists');

    console.log('\n--- Test 11: Edge Cases ---');
    // Test with maximum PC value
    eventManager.handleEvent(12, JSON.stringify({
        pc: 999,
        opcode: 'Halt',
        p1: 0,
        p2: 0,
        p3: 0
    }));
    assert(viz.vdbeCurrentPc === 999, 'Handles large PC values');

    // Test with different opcode types
    const variousOpcodes = ['Null', 'String8', 'Blob', 'Variable', 'Move', 'Copy', 'ResultRow'];
    variousOpcodes.forEach((op, idx) => {
        eventManager.handleEvent(12, JSON.stringify({
            pc: idx + 10,
            opcode: op,
            p1: idx,
            p2: idx * 2,
            p3: idx * 3
        }));
    });
    assert(viz.vdbeOpcodes.length > 10, 'Handles various opcode types');

    console.log('\n--- Test 12: Opcode Array Indexing ---');
    // Test that opcodes are stored at the correct index
    eventManager.handleEvent(12, JSON.stringify({
        pc: 50,
        opcode: 'IfNot',
        p1: 1,
        p2: 100,
        p3: 0
    }));
    assert(viz.vdbeOpcodes[50] !== undefined, 'Opcode stored at correct index 50');
    assert(viz.vdbeOpcodes[50].opcode === 'IfNot', 'Opcode at index 50 is IfNot');

    console.log('\n--- Test 13: Direct Visualizer Method Calls ---');
    viz.clear();
    viz.setViewMode('vdbe');
    viz.showVdbeStart(10);
    assert(viz.vdbeOpcodes.length === 0, 'Direct showVdbeStart resets array');

    viz.showVdbeOpcode(0, 'Init', 0, 5, 0);
    assert(viz.vdbeOpcodes[0] !== undefined, 'Direct showVdbeOpcode creates opcode');
    assert(viz.vdbeOpcodes[0].opcode === 'Init', 'Direct opcode has correct name');

    viz.showVdbeComplete(0);
    assert(true, 'Direct showVdbeComplete executes without error');

} catch (error) {
    console.error('\n❌ Error during VDBE testing:', error.message);
    console.error(error.stack);
    vdbeTestsFailed++;
}

console.log('\n' + '='.repeat(60));
console.log(`VDBE Tests Complete: ${vdbeTestsPassed} passed, ${vdbeTestsFailed} failed`);
console.log('='.repeat(60));

process.exit(vdbeTestsFailed > 0 ? 1 : 0);
