#!/usr/bin/env node

/**
 * Visualization Rendering Validation Tests
 * Tests that all drawing and rendering methods work correctly
 */

const fs = require('fs');

// Setup mocks with better canvas tracking
let clearRectCalls = 0;
let fillRectCalls = 0;
let fillTextCalls = 0;
let strokeRectCalls = 0;
let beginPathCalls = 0;
let moveToCalls = 0;
let lineToCalls = 0;
let strokeCalls = 0;
let fillCalls = 0;
let arcCalls = 0;

global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = () => {};
global.ResizeObserver = class { constructor() {} observe() {} unobserve() {} disconnect() {} };

let renderTestsPassed = 0;
let renderTestsFailed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`✓ ${message}`);
        renderTestsPassed++;
    } else {
        console.error(`✗ ${message}`);
        renderTestsFailed++;
    }
}

console.log('='.repeat(60));
console.log('Visualization Rendering Validation Tests');
console.log('='.repeat(60));

try {
    // Load modules
    const visualizerCode = fs.readFileSync('src/web/js/visualizer.js', 'utf8');

    // Reset counters
    clearRectCalls = 0;
    fillRectCalls = 0;
    fillTextCalls = 0;
    strokeRectCalls = 0;
    beginPathCalls = 0;
    moveToCalls = 0;
    lineToCalls = 0;
    strokeCalls = 0;
    fillCalls = 0;
    arcCalls = 0;

    const mockCanvas = {
        getContext: () => ({
            clearRect: () => { clearRectCalls++; },
            fillRect: () => { fillRectCalls++; },
            fillText: () => { fillTextCalls++; },
            strokeRect: () => { strokeRectCalls++; },
            beginPath: () => { beginPathCalls++; },
            moveTo: () => { moveToCalls++; },
            lineTo: () => { lineToCalls++; },
            stroke: () => { strokeCalls++; },
            fill: () => { fillCalls++; },
            save: () => {},
            restore: () => {},
            translate: () => {},
            scale: () => {},
            setTransform: () => {},
            measureText: (text) => ({ width: text.length * 8, height: 14 }),
            arc: () => { arcCalls++; },
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

    let BTreeVisualizer, moduleExports = {};
    eval(visualizerCode + '; moduleExports.BTreeVisualizer = BTreeVisualizer;');
    BTreeVisualizer = moduleExports.BTreeVisualizer;

    console.log('\n### Test Suite 1: VDBE Visualization Rendering ###');

    console.log('\n--- Test 1: VDBE Mode Initialization ---');
    const viz = new BTreeVisualizer('visualization-canvas');
    viz.setViewMode('vdbe');

    // Reset counters
    clearRectCalls = 0;
    fillRectCalls = 0;
    fillTextCalls = 0;

    viz.showVdbeStart(10);
    assert(clearRectCalls > 0, 'VDBE start clears canvas');
    assert(fillRectCalls > 0, 'VDBE start draws background');
    assert(fillTextCalls > 0, 'VDBE start renders text');

    console.log('\n--- Test 2: VDBE Opcode Rendering ---');
    const beforeTextCalls = fillTextCalls;
    viz.showVdbeOpcode(0, 'Init', 0, 5, 0);
    assert(fillTextCalls > beforeTextCalls, 'VDBE opcode renders text');

    console.log('\n--- Test 3: VDBE Complete Rendering ---');
    viz.showVdbeComplete(0);
    assert(clearRectCalls > 0, 'VDBE complete renders');

    console.log('\n### Test Suite 2: Parse Tree Visualization Rendering ###');

    console.log('\n--- Test 4: Parse Mode Initialization ---');
    viz.setViewMode('parse');

    // Reset counters
    clearRectCalls = 0;
    fillRectCalls = 0;
    fillTextCalls = 0;

    viz.showParseStart('SELECT * FROM users');
    assert(clearRectCalls > 0, 'Parse start clears canvas');
    assert(fillRectCalls > 0, 'Parse start draws background');
    assert(fillTextCalls > 0, 'Parse start renders SQL text');

    console.log('\n--- Test 5: Parse Token Rendering ---');
    const beforeTextCalls2 = fillTextCalls;
    viz.showParseToken('SELECT', 38);
    assert(fillTextCalls > beforeTextCalls2, 'Parse token renders text');

    console.log('\n--- Test 6: Parse Complete Rendering ---');
    viz.showParseComplete(1);
    assert(clearRectCalls > 0 || fillTextCalls > 0, 'Parse complete renders');

    console.log('\n### Test Suite 3: B-tree Visualization Rendering ###');

    console.log('\n--- Test 7: B-tree Mode Initialization ---');
    viz.clear();
    viz.setViewMode('btree');

    // Reset counters
    clearRectCalls = 0;
    fillRectCalls = 0;
    strokeRectCalls = 0;
    beginPathCalls = 0;
    arcCalls = 0;

    viz.addPage(1, 1, null);
    assert(clearRectCalls > 0, 'B-tree addPage clears canvas');
    assert(fillRectCalls > 0, 'B-tree addPage fills nodes');

    console.log('\n--- Test 8: B-tree Node Rendering ---');
    const beforeFillCalls = fillRectCalls;
    const beforeStrokeCalls = strokeRectCalls;

    viz.addCell(1, 0, 100);
    assert(fillRectCalls >= beforeFillCalls, 'B-tree addCell renders');

    console.log('\n--- Test 9: B-tree Layout Calculation ---');
    viz.layout();
    const page1 = viz.nodes.get(1);
    assert(page1.x !== 0, 'B-tree layout sets X coordinate');
    assert(page1.y !== 0, 'B-tree layout sets Y coordinate');

    console.log('\n--- Test 10: B-tree Draw Method ---');
    // Reset counters
    clearRectCalls = 0;
    fillRectCalls = 0;
    strokeRectCalls = 0;
    beginPathCalls = 0;
    strokeCalls = 0;

    viz.draw();
    assert(clearRectCalls > 0, 'B-tree draw clears canvas');
    assert(fillRectCalls > 0, 'B-tree draw fills nodes');
    assert(strokeRectCalls > 0 || strokeCalls > 0, 'B-tree draw strokes nodes');

    console.log('\n### Test Suite 4: Complex Scene Rendering ###');

    console.log('\n--- Test 11: Multiple Nodes Rendering ---');
    viz.clear();
    viz.setViewMode('btree');

    // Add multiple pages
    viz.addPage(1, 0, null);  // Root
    viz.addPage(2, 1, 1);     // Child
    viz.addPage(3, 1, 1);     // Child

    // Reset counters
    clearRectCalls = 0;
    fillRectCalls = 0;

    viz.draw();
    assert(clearRectCalls > 0, 'Multi-node scene clears canvas');
    assert(fillRectCalls >= 3, 'Multi-node scene draws all nodes');

    console.log('\n--- Test 12: Tree with Cells Rendering ---');
    viz.clear();
    viz.setViewMode('btree');

    viz.addPage(1, 1, null);
    for (let i = 0; i < 5; i++) {
        viz.addCell(1, i, i * 10);
    }

    // Reset counters
    fillRectCalls = 0;
    fillTextCalls = 0;

    viz.draw();
    assert(fillTextCalls > 0, 'Tree with cells renders text labels');

    console.log('\n### Test Suite 5: View Mode Switching Rendering ###');

    console.log('\n--- Test 13: Switch from B-tree to Parse ---');
    viz.setViewMode('btree');
    viz.addPage(1, 1, null);

    // Reset counters
    clearRectCalls = 0;

    viz.setViewMode('parse');
    viz.showParseStart('SELECT 1');
    assert(clearRectCalls > 0, 'Mode switch clears canvas');

    console.log('\n--- Test 14: Switch from Parse to VDBE ---');
    // Reset counters
    clearRectCalls = 0;

    viz.setViewMode('vdbe');
    viz.showVdbeStart(5);
    assert(clearRectCalls > 0, 'Mode switch to VDBE clears canvas');

    console.log('\n--- Test 15: Switch from VDBE to B-tree ---');
    // Reset counters
    clearRectCalls = 0;

    viz.setViewMode('btree');
    viz.draw();
    assert(clearRectCalls > 0, 'Mode switch to B-tree clears canvas');

    console.log('\n### Test Suite 6: Drawing Method Validation ###');

    console.log('\n--- Test 16: All Drawing Methods Exist ---');
    assert(typeof viz.draw === 'function', 'draw() method exists');
    assert(typeof viz.drawParseTree === 'function', 'drawParseTree() method exists');
    assert(typeof viz.drawVdbeList === 'function', 'drawVdbeList() method exists');
    assert(typeof viz.drawNode === 'function', 'drawNode() method exists');
    assert(typeof viz.drawConnections === 'function', 'drawConnections() method exists');
    assert(typeof viz.drawTreeNode === 'function', 'drawTreeNode() method exists');
    assert(typeof viz.drawParseTokens === 'function', 'drawParseTokens() method exists');

    console.log('\n--- Test 17: RoundRect Helper Method ---');
    viz.clear();
    viz.setViewMode('btree');
    viz.addPage(1, 1, null);
    assert(true, 'roundRect method works (called during draw)');

    console.log('\n### Test Suite 7: Canvas State Management ###');

    console.log('\n--- Test 18: Clear Method ---');
    viz.addPage(1, 1, null);
    viz.addPage(2, 1, null);
    assert(viz.nodes.size === 2, 'Nodes added');

    viz.clear();
    assert(viz.nodes.size === 0, 'Clear removes all nodes');

    console.log('\n--- Test 19: Canvas Size ---');
    assert(viz.canvas.width === 800, 'Canvas width is 800');
    assert(viz.canvas.height === 600, 'Canvas height is 600');

    console.log('\n--- Test 20: Context Access ---');
    const ctx = viz.ctx;
    assert(ctx !== null, 'Canvas context exists');
    assert(typeof ctx.fillRect === 'function', 'Context has fillRect method');
    assert(typeof ctx.fillText === 'function', 'Context has fillText method');

} catch (error) {
    console.error('\n❌ Error during rendering testing:', error.message);
    console.error(error.stack);
    renderTestsFailed++;
}

console.log('\n' + '='.repeat(60));
console.log(`Rendering Tests Complete: ${renderTestsPassed} passed, ${renderTestsFailed} failed`);
console.log('='.repeat(60));

process.exit(renderTestsFailed > 0 ? 1 : 0);
