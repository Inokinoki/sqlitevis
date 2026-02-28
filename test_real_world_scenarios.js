#!/usr/bin/env node

/**
 * Real-World SQL Scenario Tests
 * Tests complex SQL statements that users would actually run
 */

const fs = require('fs');

global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = () => {};
global.ResizeObserver = class { constructor() {} observe() {} unobserve() {} disconnect() {} };

let scenarioTestsPassed = 0;
let scenarioTestsFailed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`✓ ${message}`);
        scenarioTestsPassed++;
    } else {
        console.error(`✗ ${message}`);
        scenarioTestsFailed++;
    }
}

console.log('='.repeat(70));
console.log('Real-World SQL Scenario Tests');
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

    // Connect all events
    eventManager.on(2, (e) => { viz.addCell(e.data.page, e.data.cell, e.data.keyLen); });
    eventManager.on(4, (e) => { viz.splitPage(e.data.originalPage, e.data.newPage, e.data.splitCell); });
    eventManager.on(6, (e) => { viz.addPage(e.data.page, e.data.type); });
    eventManager.on(8, (e) => { viz.showParseStart(e.data.sql); });
    eventManager.on(9, (e) => { viz.showParseToken(e.data.token, e.data.type); });
    eventManager.on(10, (e) => { viz.showParseComplete(e.data.success); });
    eventManager.on(11, (e) => { viz.showVdbeStart(e.data.numOpcodes || e.data.opcode_count); });
    eventManager.on(12, (e) => { viz.showVdbeOpcode(e.data.pc, e.data.opcode, e.data.p1, e.data.p2, e.data.p3); });
    eventManager.on(13, (e) => { viz.showVdbeComplete(e.data.resultCode || e.data.result_code); });

    const viz = new BTreeVisualizer('visualization-canvas');

    console.log('\n### Scenario 1: E-commerce Database Setup ###');

    console.log('\n--- Create Products Table ---');
    viz.setViewMode('parse');
    const createProducts = 'CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price REAL, stock INTEGER)';
    eventManager.handleEvent(8, JSON.stringify({ sql: createProducts }));

    const productTokens = [
        { token: 'CREATE', type: 17 },
        { token: 'TABLE', type: 1 },
        { token: 'products', type: 1 },
        { token: '(', type: 39 },
        { token: 'id', type: 1 },
        { token: 'INTEGER', type: 1 },
        { token: 'PRIMARY', type: 89 },
        { token: 'KEY', type: 79 },
        { token: ',', type: 53 },
        { token: 'name', type: 1 },
        { token: 'TEXT', type: 1 },
        { token: ',', type: 53 },
        { token: 'price', type: 1 },
        { token: 'REAL', type: 1 },
        { token: ',', type: 53 },
        { token: 'stock', type: 1 },
        { token: 'INTEGER', type: 1 },
        { token: ')', type: 40 }
    ];

    productTokens.forEach(t => eventManager.handleEvent(9, JSON.stringify(t)));
    eventManager.handleEvent(10, JSON.stringify({ success: 1 }));

    assert(viz.currentSQL === createProducts, 'Products table SQL stored');
    assert(viz.parseTokens.length === productTokens.length, `All ${productTokens.length} tokens parsed`);

    console.log('\n--- Create Orders Table ---');
    viz.clear();
    viz.setViewMode('parse');
    const createOrders = 'CREATE TABLE orders (id INTEGER PRIMARY KEY, product_id INTEGER, quantity INTEGER, customer_name TEXT)';
    eventManager.handleEvent(8, JSON.stringify({ sql: createOrders }));
    assert(viz.currentSQL === createOrders, 'Orders table SQL stored');

    console.log('\n--- Insert Products ---');
    viz.setViewMode('btree');
    eventManager.handleEvent(6, JSON.stringify({ page: 1, type: 1 })); // Products table
    for (let i = 0; i < 10; i++) {
        eventManager.handleEvent(2, JSON.stringify({ page: 1, cell: i, keyLen: 50 }));
    }
    assert(viz.nodes.get(1).cells.length === 10, '10 products inserted');

    console.log('\n--- Insert Orders ---');
    eventManager.handleEvent(6, JSON.stringify({ page: 2, type: 1 })); // Orders table
    for (let i = 0; i < 25; i++) {
        eventManager.handleEvent(2, JSON.stringify({ page: 2, cell: i, keyLen: 80 }));
    }
    assert(viz.nodes.get(2).cells.length === 25, '25 orders inserted');

    console.log('\n### Scenario 2: Complex SELECT with JOINs ###');

    console.log('\n--- Parse JOIN Query ---');
    viz.setViewMode('parse');
    const joinQuery = `SELECT p.name, p.price, o.quantity, o.customer_name
                       FROM products p
                       JOIN orders o ON p.id = o.product_id
                       WHERE o.quantity > 5
                       ORDER BY p.price DESC`;
    eventManager.handleEvent(8, JSON.stringify({ sql: joinQuery }));

    const joinTokens = [
        { token: 'SELECT', type: 38 },
        { token: 'p', type: 1 },
        { token: '.', type: 40 },
        { token: 'name', type: 1 },
        { token: ',', type: 53 },
        { token: 'p', type: 1 },
        { token: '.', type: 40 },
        { token: 'price', type: 1 },
        { token: ',', type: 53 },
        { token: 'o', type: 1 },
        { token: '.', type: 40 },
        { token: 'quantity', type: 1 },
        { token: 'FROM', type: 41 },
        { token: 'products', type: 1 },
        { token: 'p', type: 1 },
        { token: 'JOIN', type: 113 },
        { token: 'orders', type: 1 },
        { token: 'o', type: 1 },
        { token: 'ON', type: 69 },
        { token: 'p', type: 1 },
        { token: '.', type: 40 },
        { token: 'id', type: 1 },
        { token: '=', type: 21 },
        { token: 'o', type: 1 },
        { token: '.', type: 40 },
        { token: 'product_id', type: 1 },
        { token: 'WHERE', type: 48 },
        { token: 'o', type: 1 },
        { token: '.', type: 40 },
        { token: 'quantity', type: 1 },
        { token: '>', type: 22 },
        { token: '5', type: 40 },
        { token: 'ORDER', type: 44 },
        { token: 'BY', type: 73 },
        { token: 'p', type: 1 },
        { token: '.', type: 40 },
        { token: 'price', type: 1 },
        { token: 'DESC', type: 94 }
    ];

    joinTokens.forEach(t => eventManager.handleEvent(9, JSON.stringify(t)));
    eventManager.handleEvent(10, JSON.stringify({ success: 1 }));

    assert(viz.parseTokens.length > 20, 'JOIN query tokens parsed');

    console.log('\n--- VDBE for JOIN Query ---');
    viz.setViewMode('vdbe');
    eventManager.handleEvent(11, JSON.stringify({ opcode_count: 25 }));

    const joinOpcodes = [
        { pc: 0, opcode: 'Init', p1: 0, p2: 25, p3: 0 },
        { pc: 1, opcode: 'OpenRead', p1: 0, p2: 1, p3: 0 }, // products
        { pc: 2, opcode: 'OpenRead', p1: 1, p2: 2, p3: 0 }, // orders
        { pc: 3, opcode: 'Rewind', p1: 0, p2: 22, p3: 0 },
        { pc: 4, opcode: 'Column', p1: 0, p2: 0, p3: 1 },
        { pc: 5, opcode: 'SeekGE', p1: 1, p2: 1, p3: 0 },
        { pc: 6, opcode: 'Column', p1: 1, p2: 2, p3: 4 },
        { pc: 7, opcode: 'LE', p1: 4, p2: 20, p3: 19 },
        { pc: 8, opcode: 'Column', p1: 0, p2: 1, p3: 2 },
        { pc: 9, opcode: 'Column', p1: 0, p2: 2, p3: 3 },
        { pc: 10, opcode: 'Column', p1: 1, p2: 1, p3: 4 },
        { pc: 11, opcode: 'Column', p1: 1, p2: 3, p3: 5 },
        { pc: 12, opcode: 'ResultRow', p1: 2, p2: 4, p3: 0 },
        { pc: 13, opcode: 'Next', p1: 1, p2: 17, p3: 0 },
        { pc: 14, opcode: 'Goto', p1: 0, p2: 6, p3: 0 },
        { pc: 15, opcode: 'Next', p1: 0, p2: 22, p3: 0 },
        { pc: 16, opcode: 'Goto', p1: 0, p2: 4, p3: 0 },
        { pc: 17, opcode: 'Halt', p1: 0, p2: 0, p3: 0 }
    ];

    joinOpcodes.forEach(op => eventManager.handleEvent(12, JSON.stringify(op)));
    eventManager.handleEvent(13, JSON.stringify({ result_code: 0 }));

    assert(viz.vdbeOpcodes.length === 18, 'JOIN VDBE opcodes recorded');
    assert(viz.vdbeOpcodes[5].opcode === 'SeekGE', 'SeekGE opcode present for JOIN');

    console.log('\n### Scenario 3: Aggregate Functions ###');

    console.log('\n--- Parse Aggregate Query ---');
    viz.setViewMode('parse');
    const aggregateQuery = 'SELECT COUNT(*), AVG(price), MAX(stock), MIN(stock) FROM products';
    eventManager.handleEvent(8, JSON.stringify({ sql: aggregateQuery }));

    const aggregateTokens = [
        { token: 'SELECT', type: 38 },
        { token: 'COUNT', type: 1 },
        { token: '(', type: 39 },
        { token: '*', type: 103 },
        { token: ')', type: 40 },
        { token: ',', type: 53 },
        { token: 'AVG', type: 1 },
        { token: '(', type: 39 },
        { token: 'price', type: 1 },
        { token: ')', type: 40 },
        { token: ',', type: 53 },
        { token: 'MAX', type: 1 },
        { token: '(', type: 39 },
        { token: 'stock', type: 1 },
        { token: ')', type: 40 },
        { token: ',', type: 53 },
        { token: 'MIN', type: 1 },
        { token: '(', type: 39 },
        { token: 'stock', type: 1 },
        { token: ')', type: 40 },
        { token: 'FROM', type: 41 },
        { token: 'products', type: 1 }
    ];

    aggregateTokens.forEach(t => eventManager.handleEvent(9, JSON.stringify(t)));
    eventManager.handleEvent(10, JSON.stringify({ success: 1 }));

    assert(viz.parseTokens.some(t => t.token === 'COUNT'), 'COUNT function parsed');
    assert(viz.parseTokens.some(t => t.token === 'AVG'), 'AVG function parsed');
    assert(viz.parseTokens.some(t => t.token === 'MAX'), 'MAX function parsed');
    assert(viz.parseTokens.some(t => t.token === 'MIN'), 'MIN function parsed');

    console.log('\n### Scenario 4: Transaction with Multiple Updates ###');

    console.log('\n--- Begin Transaction ---');
    viz.setViewMode('parse');
    eventManager.handleEvent(8, JSON.stringify({ sql: 'BEGIN TRANSACTION' }));
    eventManager.handleEvent(9, JSON.stringify({ token: 'BEGIN', type: 62 }));
    eventManager.handleEvent(9, JSON.stringify({ token: 'TRANSACTION', type: 65 }));
    eventManager.handleEvent(10, JSON.stringify({ success: 1 }));

    console.log('\n--- Update Stock Levels ---');
    viz.setViewMode('btree');
    eventManager.handleEvent(6, JSON.stringify({ page: 3, type: 1 })); // Updated products page

    // Simulate updates (delete old, insert new)
    for (let i = 0; i < 5; i++) {
        eventManager.handleEvent(2, JSON.stringify({ page: 3, cell: i * 2, keyLen: 50 }));
        eventManager.handleEvent(3, JSON.stringify({ page: 3, cell: i * 2 + 1, keyLen: 50 }));
        eventManager.handleEvent(2, JSON.stringify({ page: 3, cell: i * 2, keyLen: 55 }));
    }

    assert(viz.nodes.get(3).cells.length > 0, 'Update operations performed');

    console.log('\n--- Commit Transaction ---');
    viz.setViewMode('parse');
    eventManager.handleEvent(8, JSON.stringify({ sql: 'COMMIT' }));
    eventManager.handleEvent(9, JSON.stringify({ token: 'COMMIT', type: 66 }));
    eventManager.handleEvent(10, JSON.stringify({ success: 1 }));

    console.log('\n### Scenario 5: Subquery ###');

    console.log('\n--- Parse Subquery ---');
    const subqueryQuery = 'SELECT name FROM products WHERE price > (SELECT AVG(price) FROM products)';
    eventManager.handleEvent(8, JSON.stringify({ sql: subqueryQuery }));

    const subqueryTokens = [
        { token: 'SELECT', type: 38 },
        { token: 'name', type: 1 },
        { token: 'FROM', type: 41 },
        { token: 'products', type: 1 },
        { token: 'WHERE', type: 48 },
        { token: 'price', type: 1 },
        { token: '>', type: 22 },
        { token: '(', type: 39 },
        { token: 'SELECT', type: 38 },
        { token: 'AVG', type: 1 },
        { token: '(', type: 39 },
        { token: 'price', type: 1 },
        { token: ')', type: 40 },
        { token: 'FROM', type: 41 },
        { token: 'products', type: 1 },
        { token: ')', type: 40 }
    ];

    subqueryTokens.forEach(t => eventManager.handleEvent(9, JSON.stringify(t)));
    eventManager.handleEvent(10, JSON.stringify({ success: 1 }));

    assert(viz.parseTokens.some(t => t.token === 'SELECT'), 'Subquery SELECT parsed');
    assert(viz.parseTokens.some(t => t.token === 'AVG'), 'Subquery AVG parsed');

    console.log('\n### Scenario 6: Page Splitting Under Load ###');

    console.log('\n--- Simulate Page Splits ---');
    viz.clear();
    viz.setViewMode('btree');

    // Start with one page
    eventManager.handleEvent(6, JSON.stringify({ page: 1, type: 1 }));

    // Fill page until it splits
    for (let i = 0; i < 50; i++) {
        eventManager.handleEvent(2, JSON.stringify({ page: 1, cell: i, keyLen: 100 }));

        // Simulate split every 10 cells
        if (i > 0 && i % 10 === 0) {
            const newPage = i / 10 + 1;
            eventManager.handleEvent(4, JSON.stringify({
                originalPage: 1,
                newPage: newPage,
                splitCell: i / 2
            }));
        }
    }

    assert(viz.nodes.size > 1, 'Page splits created new pages');
    assert(viz.nodes.size >= 6, 'Multiple pages created from splits');

    console.log('\n### Scenario 7: GROUP BY and HAVING ###');

    console.log('\n--- Parse GROUP BY Query ---');
    viz.setViewMode('parse');
    const groupByQuery = 'SELECT category, COUNT(*), AVG(price) FROM products GROUP BY category HAVING COUNT(*) > 5';
    eventManager.handleEvent(8, JSON.stringify({ sql: groupByQuery }));

    const groupByTokens = [
        { token: 'SELECT', type: 38 },
        { token: 'category', type: 1 },
        { token: ',', type: 53 },
        { token: 'COUNT', type: 1 },
        { token: '(', type: 39 },
        { token: '*', type: 103 },
        { token: ')', type: 40 },
        { token: 'FROM', type: 41 },
        { token: 'products', type: 1 },
        { token: 'GROUP', type: 45 },
        { token: 'BY', type: 73 },
        { token: 'category', type: 1 },
        { token: 'HAVING', type: 46 },
        { token: 'COUNT', type: 1 },
        { token: '(', type: 39 },
        { token: '*', type: 103 },
        { token: ')', type: 40 },
        { token: '>', type: 22 },
        { token: '5', type: 40 }
    ];

    groupByTokens.forEach(t => eventManager.handleEvent(9, JSON.stringify(t)));
    eventManager.handleEvent(10, JSON.stringify({ success: 1 }));

    assert(viz.parseTokens.some(t => t.token === 'GROUP'), 'GROUP BY parsed');
    assert(viz.parseTokens.some(t => t.token === 'HAVING'), 'HAVING clause parsed');

    console.log('\n### Scenario 8: UNION Query ###');

    console.log('\n--- Parse UNION Query ---');
    const unionQuery = 'SELECT name FROM products WHERE price < 10 UNION SELECT name FROM discontinued_products';
    eventManager.handleEvent(8, JSON.stringify({ sql: unionQuery }));

    const unionTokens = [
        { token: 'SELECT', type: 38 },
        { token: 'name', type: 1 },
        { token: 'FROM', type: 41 },
        { token: 'products', type: 1 },
        { token: 'WHERE', type: 48 },
        { token: 'price', type: 1 },
        { token: '<', type: 24 },
        { token: '10', type: 40 },
        { token: 'UNION', type: 1 },
        { token: 'SELECT', type: 38 },
        { token: 'name', type: 1 },
        { token: 'FROM', type: 41 },
        { token: 'discontinued_products', type: 1 }
    ];

    unionTokens.forEach(t => eventManager.handleEvent(9, JSON.stringify(t)));
    eventManager.handleEvent(10, JSON.stringify({ success: 1 }));

    assert(viz.parseTokens.some(t => t.token === 'UNION'), 'UNION parsed');

} catch (error) {
    console.error('\n❌ Error during scenario testing:', error.message);
    console.error(error.stack);
    scenarioTestsFailed++;
}

console.log('\n' + '='.repeat(70));
console.log(`Scenario Tests Complete: ${scenarioTestsPassed} passed, ${scenarioTestsFailed} failed`);
console.log('='.repeat(70));

process.exit(scenarioTestsFailed > 0 ? 1 : 0);
