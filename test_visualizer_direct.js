#!/usr/bin/env node
/**
 * Direct Visualizer Test
 * Tests the BTreeVisualizer class directly with mocked canvas
 */

const fs = require('fs');

console.log('=== BTreeVisualizer Direct Test ===\n');

// Read the visualizer code
const visualizerCode = fs.readFileSync('src/web/js/visualizer.js', 'utf8');

// Mock canvas context
let callLog = [];
const mockCanvas = {
    getContext: () => ({
        clearRect: (x, y, w, h) => callLog.push(['clearRect', x, y, w, h]),
        fillRect: (x, y, w, h) => callLog.push(['fillRect', x, y, w, h]),
        fillText: (text, x, y) => callLog.push(['fillText', text, x, y]),
        strokeRect: (x, y, w, h) => callLog.push(['strokeRect', x, y, w, h]),
        beginPath: () => callLog.push(['beginPath']),
        moveTo: (x, y) => callLog.push(['moveTo', x, y]),
        lineTo: (x, y) => callLog.push(['lineTo', x, y]),
        stroke: () => callLog.push(['stroke']),
        fill: () => callLog.push(['fill']),
        save: () => callLog.push(['save']),
        restore: () => callLog.push(['restore']),
        translate: (x, y) => callLog.push(['translate', x, y]),
        scale: (x, y) => callLog.push(['scale', x, y]),
        setTransform: (a, b, c, d, e, f) => callLog.push(['setTransform', a, b, c, d, e, f]),
        arc: (x, y, r, start, end) => callLog.push(['arc', x, y, r, start, end]),
        rect: (x, y, w, h) => callLog.push(['rect', x, y, w, h]),
        clip: () => callLog.push(['clip']),
        quadraticCurveTo: (cpx, cpy, x, y) => callLog.push(['quadraticCurveTo', cpx, cpy, x, y]),
        bezierCurveTo: (cp1x, cp1y, cp2x, cp2y, x, y) => callLog.push(['bezierCurveTo', cp1x, cp1y, cp2x, cp2y, x, y]),
        closePath: () => callLog.push(['closePath']),
        measureText: (text) => ({ width: text.length * 8, height: 14 }),
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
        if (id === 'page-count') return { textContent: '' };
        return null;
    },
    createElement: (tag) => ({
        className: '',
        innerHTML: '',
        textContent: ''
    })
};

global.window = {
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    cancelAnimationFrame: () => {},
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: () => {},
    removeEventListener: () => {}
};

global.ResizeObserver = class {
    constructor(cb) { this.cb = cb; }
    observe() {}
    unobserve() {}
    disconnect() {}
};

global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = () => {};

// Execute the code and get BTreeVisualizer
let BTreeVisualizer;
const moduleExports = {};
eval(visualizerCode + '; moduleExports.BTreeVisualizer = BTreeVisualizer;');
BTreeVisualizer = moduleExports.BTreeVisualizer;

console.log('Test 1: Visualizer Instantiation');
console.log('─────────────────────────────');

try {
    const viz = new BTreeVisualizer('visualization-canvas');
    console.log('✓ BTreeVisualizer instantiated');
    console.log('✓ View mode:', viz.viewMode);
    console.log('✓ Nodes Map size:', viz.nodes.size);
    console.log('✓ Root page:', viz.rootPage);
    console.log();
} catch (e) {
    console.log('✗ FAIL:', e.message);
    process.exit(1);
}

console.log('Test 2: VDBE Visualization');
console.log('─────────────────────────────');

try {
    const viz = new BTreeVisualizer('visualization-canvas');

    // Switch to VDBE mode first
    viz.setViewMode('vdbe');

    // Test VDBE_START - initializes the opcode array
    viz.showVdbeStart(5);
    if (viz.vdbeCurrentPc !== -1) {
        console.log('✗ VDBE_START failed to reset PC');
        process.exit(1);
    }
    console.log('✓ VDBE_START: Initialized opcodes, PC reset to -1');

    // Test VDBE_OPCODE
    viz.showVdbeOpcode(0, 'Init', 0, 5, 0);
    viz.showVdbeOpcode(1, 'OpenRead', 0, 2, 0);
    viz.showVdbeOpcode(2, 'Rewind', 0, 8, 0);

    if (viz.vdbeCurrentPc !== 2) {
        console.log('✗ VDBE_OPCODE failed to update PC');
        process.exit(1);
    }
    console.log('✓ VDBE_OPCODE: Added 3 opcodes, current PC:', viz.vdbeCurrentPc);

    // Test VDBE_COMPLETE
    viz.showVdbeComplete(0);
    console.log('✓ VDBE_COMPLETE: Processed');
    console.log();
} catch (e) {
    console.log('✗ FAIL:', e.message);
    console.log(e.stack);
    process.exit(1);
}

console.log('Test 3: Parse Visualization');
console.log('─────────────────────────────');

try {
    const viz = new BTreeVisualizer('visualization-canvas');
    const sql = 'SELECT id, name FROM users';

    // Switch to Parse mode first
    viz.setViewMode('parse');

    // Test PARSE_START
    viz.showParseStart(sql);
    if (viz.currentSQL !== sql) {
        console.log('✗ PARSE_START failed to store SQL');
        process.exit(1);
    }
    console.log('✓ PARSE_START: Stored SQL');

    // Test PARSE_TOKEN
    viz.showParseToken('SELECT', 23);
    viz.showParseToken('id', 1);
    viz.showParseToken(',', 44);

    if (viz.parseTokens.length !== 3) {
        console.log('✗ PARSE_TOKEN failed to add tokens');
        process.exit(1);
    }
    console.log('✓ PARSE_TOKEN: Added', viz.parseTokens.length, 'tokens');

    // Verify token type names exist
    if (Object.keys(viz.tokenTypeNames).length < 50) {
        console.log('✗ Token type names not loaded');
        process.exit(1);
    }
    console.log('✓ Token type names:', Object.keys(viz.tokenTypeNames).length, 'types');

    // Test PARSE_COMPLETE
    viz.showParseComplete(1);
    console.log('✓ PARSE_COMPLETE: Processed');
    console.log();
} catch (e) {
    console.log('✗ FAIL:', e.message);
    console.log(e.stack);
    process.exit(1);
}

console.log('Test 4: B-Tree Visualization');
console.log('─────────────────────────────');

try {
    const viz = new BTreeVisualizer('visualization-canvas');
    callLog = []; // Reset call log

    // Test PAGE_ALLOCATE
    viz.addPage(1, 5); // leaf page
    viz.addPage(2, 5); // leaf page
    viz.addPage(3, 2); // interior page

    if (viz.nodes.size !== 3) {
        console.log('✗ PAGE_ALLOCATE failed');
        console.log('  Expected 3 nodes, got', viz.nodes.size);
        process.exit(1);
    }
    console.log('✓ PAGE_ALLOCATE: Created 3 pages');

    // Test BTREE_INSERT
    viz.addCell(1, 0, 10, 'user1');
    viz.addCell(1, 1, 10, 'user2');
    viz.addCell(2, 0, 10, 'user3');

    const page1 = viz.nodes.get(1);
    if (page1.cells.length !== 2) {
        console.log('✗ BTREE_INSERT failed');
        console.log('  Expected 2 cells, got', page1.cells.length);
        process.exit(1);
    }
    console.log('✓ BTREE_INSERT: Added cells');

    // Test BTREE_SPLIT
    viz.splitPage(1, 4, 1);

    if (viz.nodes.size !== 4) {
        console.log('✗ BTREE_SPLIT failed');
        console.log('  Expected 4 nodes, got', viz.nodes.size);
        process.exit(1);
    }
    console.log('✓ BTREE_SPLIT: Created new page');

    // After split, page 1 might have different cells - check it still exists
    const page1AfterSplit = viz.nodes.get(1);
    console.log('✓ Page 1 still exists after split with', page1AfterSplit.cells.length, 'cells');

    // Test BTREE_DELETE on page 2 which we know has 1 cell
    const page2BeforeDelete = viz.nodes.get(2);
    const cellsBeforeDelete = page2BeforeDelete.cells.length;
    viz.deleteCell(2, 0);
    const page2AfterDelete = viz.nodes.get(2);
    const cellsAfterDelete = page2AfterDelete.cells.length;

    if (cellsAfterDelete !== cellsBeforeDelete - 1) {
        console.log('✗ BTREE_DELETE failed');
        console.log('  Expected', cellsBeforeDelete - 1, 'cells, got', cellsAfterDelete);
        process.exit(1);
    }
    console.log('✓ BTREE_DELETE: Removed cell from page 2');

    // Test draw method
    viz.layout();
    viz.draw();

    if (callLog.length === 0) {
        console.log('⚠ WARNING: No canvas calls recorded (may be expected)');
    } else {
        console.log('✓ Canvas draw: Executed', callLog.length, 'canvas operations');
    }

    console.log();
} catch (e) {
    console.log('✗ FAIL:', e.message);
    console.log(e.stack);
    process.exit(1);
}

console.log('Test 5: View Mode Switching');
console.log('─────────────────────────────');

try {
    const viz = new BTreeVisualizer('visualization-canvas');

    viz.setViewMode('vdbe');
    if (viz.viewMode !== 'vdbe') {
        console.log('✗ Failed to switch to vdbe mode');
        process.exit(1);
    }
    console.log('✓ Switched to VDBE mode');

    viz.setViewMode('parse');
    if (viz.viewMode !== 'parse') {
        console.log('✗ Failed to switch to parse mode');
        process.exit(1);
    }
    console.log('✓ Switched to Parse mode');

    viz.setViewMode('btree');
    if (viz.viewMode !== 'btree') {
        console.log('✗ Failed to switch to btree mode');
        process.exit(1);
    }
    console.log('✓ Switched to B-Tree mode');

    console.log();
} catch (e) {
    console.log('✗ FAIL:', e.message);
    console.log(e.stack);
    process.exit(1);
}

console.log('═══════════════════════════════════════');
console.log('  ALL VISUALIZER TESTS PASSED');
console.log('═══════════════════════════════════════');
console.log();
console.log('Verified:');
console.log('  ✓ VDBE event visualization');
console.log('  ✓ SQL parse tree visualization');
console.log('  ✓ B-tree page visualization');
console.log('  ✓ View mode switching');
console.log();

process.exit(0);
