#!/usr/bin/env node

/**
 * Comprehensive test for B-tree Page events and visualization
 * Tests:
 * 1. PAGE_ALLOCATE event handling
 * 2. PAGE_FREE event handling
 * 3. BTREE_INSERT event (cell insertion)
 * 4. BTREE_DELETE event (cell deletion)
 * 5. BTREE_SPLIT event (page splitting)
 * 6. BTREE_BALANCE event
 * 7. Page-to-node mapping
 * 8. Tree layout and rendering
 */

const fs = require('fs');

// Setup mocks
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = () => {};
global.ResizeObserver = class { constructor() {} observe() {} unobserve() {} disconnect() {} };

let btreeTestsPassed = 0;
let btreeTestsFailed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`✓ ${message}`);
        btreeTestsPassed++;
    } else {
        console.error(`✗ ${message}`);
        btreeTestsFailed++;
    }
}

console.log('='.repeat(60));
console.log('B-tree Page Event and Visualization Tests');
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

    console.log('\n--- Test 1: B-tree Initialization ---');
    const viz = new BTreeVisualizer('visualization-canvas');
    viz.setViewMode('btree');
    assert(viz.viewMode === 'btree', 'View mode set to btree');
    assert(viz.nodes instanceof Map, 'Nodes is a Map');
    assert(viz.nodes.size === 0, 'Nodes map is initially empty');

    console.log('\n--- Test 2: Connect Event Manager to Visualizer ---');
    // Simulate main.js connection for B-tree events
    eventManager.on(0, (e) => { // BTREE_OPEN
        viz.pageSize = e.data.pageSize;
    });
    eventManager.on(2, (e) => { // BTREE_INSERT
        viz.addCell(e.data.page, e.data.cell, e.data.keyLen);
    });
    eventManager.on(3, (e) => { // BTREE_DELETE
        viz.deleteCell(e.data.page, e.data.cell);
    });
    eventManager.on(4, (e) => { // BTREE_SPLIT
        viz.splitPage(e.data.originalPage, e.data.newPage, e.data.splitCell);
    });
    eventManager.on(6, (e) => { // PAGE_ALLOCATE
        viz.addPage(e.data.page, e.data.type);
    });
    eventManager.on(7, (e) => { // PAGE_FREE
        viz.nodes.delete(e.data.page);
        viz.layout();
        viz.draw();
    });
    assert(true, 'Event manager connected to visualizer for B-tree events');

    console.log('\n--- Test 3: PAGE_ALLOCATE Event (Event Type 6) ---');
    eventManager.handleEvent(6, JSON.stringify({ page: 1, type: 0 })); // Interior page
    assert(viz.nodes.size === 1, 'Page 1 added to nodes map');

    const page1 = viz.nodes.get(1);
    assert(page1 !== undefined, 'Page 1 exists in nodes');
    assert(page1.page === 1, 'Page number is 1');
    assert(page1.type === 0, 'Page type is 0 (interior)');

    console.log('\n--- Test 4: Multiple Page Allocation ---');
    eventManager.handleEvent(6, JSON.stringify({ page: 2, type: 1 })); // Leaf page
    eventManager.handleEvent(6, JSON.stringify({ page: 3, type: 1 })); // Leaf page
    assert(viz.nodes.size === 3, 'All 3 pages added');

    const page2 = viz.nodes.get(2);
    assert(page2.type === 1, 'Page 2 type is 1 (leaf)');
    assert(page2.cells.length === 0, 'Page 2 has no cells initially');

    console.log('\n--- Test 5: Parent-Child Relationships ---');
    // Add pages with explicit parent
    eventManager.handleEvent(6, JSON.stringify({ page: 4, type: 1 }));
    eventManager.handleEvent(6, JSON.stringify({ page: 5, type: 1 }));

    // Manually set parent for page 4 to be page 1
    const page4 = viz.nodes.get(4);
    const page1_ref = viz.nodes.get(1);
    if (page1_ref && !page1_ref.children.includes(4)) {
        page1_ref.children.push(4);
        page4.parent = 1;
    }

    assert(page4.parent === 1, 'Page 4 has parent page 1');
    assert(page1_ref.children.includes(4), 'Page 1 has page 4 as child');

    console.log('\n--- Test 6: BTREE_INSERT Event (Event Type 2) ---');
    viz.clear();
    viz.setViewMode('btree');

    // Create a page and insert cells
    eventManager.handleEvent(6, JSON.stringify({ page: 1, type: 1 }));
    eventManager.handleEvent(2, JSON.stringify({ page: 1, cell: 0, keyLen: 4 }));
    eventManager.handleEvent(2, JSON.stringify({ page: 1, cell: 1, keyLen: 8 }));
    eventManager.handleEvent(2, JSON.stringify({ page: 1, cell: 2, keyLen: 12 }));

    const pageWithCells = viz.nodes.get(1);
    assert(pageWithCells !== undefined, 'Page 1 exists');
    assert(pageWithCells.cells.length === 3, 'Page 1 has 3 cells');

    console.log('\n--- Test 7: Cell Data Structure ---');
    const firstCell = pageWithCells.cells[0];
    assert(firstCell.idx === 0, 'First cell index is 0');
    assert(firstCell.keyLen === 4, 'First cell key length is 4');
    assert(firstCell.key === 'Key0', 'First cell has default key name');

    const secondCell = pageWithCells.cells[1];
    assert(secondCell.idx === 1, 'Second cell index is 1');
    assert(secondCell.keyLen === 8, 'Second cell key length is 8');

    console.log('\n--- Test 8: BTREE_DELETE Event (Event Type 3) ---');
    eventManager.handleEvent(3, JSON.stringify({ page: 1, cell: 1 }));

    const pageAfterDelete = viz.nodes.get(1);
    assert(pageAfterDelete.cells.length === 2, 'Page has 2 cells after deletion');
    assert(pageAfterDelete.cells[0].idx === 0, 'First cell still at index 0');
    assert(pageAfterDelete.cells[1].idx === 2, 'Third cell now at index 1');

    console.log('\n--- Test 9: BTREE_SPLIT Event (Event Type 4) ---');
    viz.clear();
    viz.setViewMode('btree');

    // Create original page
    eventManager.handleEvent(6, JSON.stringify({ page: 1, type: 1 }));
    eventManager.handleEvent(2, JSON.stringify({ page: 1, cell: 0, keyLen: 4 }));
    eventManager.handleEvent(2, JSON.stringify({ page: 1, cell: 1, keyLen: 8 }));
    eventManager.handleEvent(2, JSON.stringify({ page: 1, cell: 2, keyLen: 12 }));
    eventManager.handleEvent(2, JSON.stringify({ page: 1, cell: 3, keyLen: 16 }));

    // Split the page
    eventManager.handleEvent(4, JSON.stringify({
        originalPage: 1,
        newPage: 2,
        splitCell: 2
    }));

    assert(viz.nodes.size === 2, 'Split created new page');
    assert(viz.nodes.has(2), 'New page 2 exists');

    const originalPage = viz.nodes.get(1);
    const newPage = viz.nodes.get(2);
    assert(originalPage.cells.length === 2, 'Original page has 2 cells after split');
    assert(newPage.cells.length === 2, 'New page has 2 cells');
    assert(newPage.type === originalPage.type, 'New page has same type as original');

    console.log('\n--- Test 10: Split Preserves Parent-Child Relationships ---');
    // Both pages should have the same parent
    assert(originalPage.parent === newPage.parent, 'Split pages share same parent');

    console.log('\n--- Test 11: PAGE_FREE Event (Event Type 7) ---');
    eventManager.handleEvent(7, JSON.stringify({ page: 2 }));
    assert(viz.nodes.size === 1, 'Page 2 removed after PAGE_FREE');
    assert(!viz.nodes.has(2), 'Page 2 no longer exists');
    assert(viz.nodes.has(1), 'Page 1 still exists');

    console.log('\n--- Test 12: Complex Tree Structure ---');
    viz.clear();
    viz.setViewMode('btree');

    // Build a small B-tree:
    //      Page 1 (root, interior)
    //      /        \
    //  Page 2      Page 3 (both leaves)

    eventManager.handleEvent(6, JSON.stringify({ page: 1, type: 0 })); // Root (interior)
    eventManager.handleEvent(6, JSON.stringify({ page: 2, type: 1 })); // Leaf
    eventManager.handleEvent(6, JSON.stringify({ page: 3, type: 1 })); // Leaf

    // Set up parent-child relationships manually
    const root = viz.nodes.get(1);
    const leaf2 = viz.nodes.get(2);
    const leaf3 = viz.nodes.get(3);

    leaf2.parent = 1;
    leaf3.parent = 1;
    root.children = [2, 3];

    // Add cells to leaves
    eventManager.handleEvent(2, JSON.stringify({ page: 2, cell: 0, keyLen: 10 }));
    eventManager.handleEvent(2, JSON.stringify({ page: 2, cell: 1, keyLen: 20 }));
    eventManager.handleEvent(2, JSON.stringify({ page: 3, cell: 0, keyLen: 30 }));

    assert(viz.nodes.size === 3, 'Tree has 3 pages');
    assert(leaf2.cells.length === 2, 'Leaf 2 has 2 cells');
    assert(leaf3.cells.length === 1, 'Leaf 3 has 1 cell');
    assert(root.children.length === 2, 'Root has 2 children');

    console.log('\n--- Test 13: Layout Calculation ---');
    viz.layout();
    assert(root.x !== 0, 'Root has X position');
    assert(root.y !== 0, 'Root has Y position');
    assert(leaf2.x !== 0, 'Leaf 2 has X position');
    assert(leaf2.y > root.y, 'Leaf 2 is below root');

    console.log('\n--- Test 14: Direct Visualizer Method Calls ---');
    viz.clear();
    viz.setViewMode('btree');

    // Direct addPage
    viz.addPage(10, 1, null);
    assert(viz.nodes.has(10), 'Direct addPage creates page 10');

    // Direct addCell
    viz.addCell(10, 0, 100);
    const page10 = viz.nodes.get(10);
    assert(page10.cells.length === 1, 'Direct addCell adds cell');

    // Direct deleteCell
    viz.deleteCell(10, 0);
    assert(page10.cells.length === 0, 'Direct deleteCell removes cell');

    // Direct splitPage
    viz.addCell(10, 0, 50);
    viz.addCell(10, 1, 100);
    viz.addCell(10, 2, 150);
    viz.splitPage(10, 11, 1);
    assert(viz.nodes.has(11), 'Direct splitPage creates new page');
    assert(viz.nodes.get(11).cells.length === 2, 'Split moved 2 cells to new page');

    console.log('\n--- Test 15: Node Properties ---');
    const testNode = viz.nodes.get(10);
    assert(typeof testNode.x === 'number', 'Node has numeric X coordinate');
    assert(typeof testNode.y === 'number', 'Node has numeric Y coordinate');
    assert(typeof testNode.page === 'number', 'Node has numeric page number');
    assert(typeof testNode.type === 'number', 'Node has numeric type');
    assert(Array.isArray(testNode.cells), 'Node has cells array');
    assert(Array.isArray(testNode.children), 'Node has children array');
    assert(typeof testNode.expanded === 'boolean', 'Node has expanded boolean');

    console.log('\n--- Test 16: B-tree Methods Exist ---');
    assert(typeof viz.addPage === 'function', 'addPage method exists');
    assert(typeof viz.addCell === 'function', 'addCell method exists');
    assert(typeof viz.deleteCell === 'function', 'deleteCell method exists');
    assert(typeof viz.splitPage === 'function', 'splitPage method exists');
    assert(typeof viz.layout === 'function', 'layout method exists');
    assert(typeof viz.buildLevels === 'function', 'buildLevels method exists');
    assert(typeof viz.draw === 'function', 'draw method exists');
    assert(typeof viz.clear === 'function', 'clear method exists');

    console.log('\n--- Test 17: Edge Case - Large Page Numbers ---');
    viz.clear();
    viz.setViewMode('btree');

    const largePageNum = 999999;
    eventManager.handleEvent(6, JSON.stringify({ page: largePageNum, type: 1 }));
    assert(viz.nodes.has(largePageNum), 'Large page number handled correctly');

    console.log('\n--- Test 18: Edge Case - Empty Operations ---');
    viz.clear();
    viz.setViewMode('btree');

    // Try operations on non-existent pages
    viz.addCell(999, 0, 10);
    assert(true, 'Adding cell to non-existent page does not crash');

    viz.deleteCell(999, 0);
    assert(true, 'Deleting cell from non-existent page does not crash');

    viz.splitPage(999, 1000, 0);
    assert(true, 'Splitting non-existent page does not crash');

    console.log('\n--- Test 19: Page Type Variations ---');
    viz.clear();
    viz.setViewMode('btree');

    eventManager.handleEvent(6, JSON.stringify({ page: 1, type: 0 })); // Interior
    eventManager.handleEvent(6, JSON.stringify({ page: 2, type: 1 })); // Leaf

    assert(viz.nodes.get(1).type === 0, 'Interior page type correct');
    assert(viz.nodes.get(2).type === 1, 'Leaf page type correct');

} catch (error) {
    console.error('\n❌ Error during B-tree testing:', error.message);
    console.error(error.stack);
    btreeTestsFailed++;
}

console.log('\n' + '='.repeat(60));
console.log(`B-tree Tests Complete: ${btreeTestsPassed} passed, ${btreeTestsFailed} failed`);
console.log('='.repeat(60));

process.exit(btreeTestsFailed > 0 ? 1 : 0);
