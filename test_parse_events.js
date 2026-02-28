#!/usr/bin/env node

/**
 * Comprehensive test for SQL Parse events and visualization
 * Tests:
 * 1. PARSE_START event handling
 * 2. PARSE_TOKEN event processing
 * 3. PARSE_COMPLETE event handling
 * 4. Parse tree visualization
 * 5. Token stream rendering
 * 6. SQL tokenization
 */

const fs = require('fs');

// Setup mocks
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = () => {};
global.ResizeObserver = class { constructor() {} observe() {} unobserve() {} disconnect() {} };

let parseTestsPassed = 0;
let parseTestsFailed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`✓ ${message}`);
        parseTestsPassed++;
    } else {
        console.error(`✗ ${message}`);
        parseTestsFailed++;
    }
}

console.log('='.repeat(60));
console.log('SQL Parse Event and Visualization Tests');
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

    console.log('\n--- Test 1: Parse Initialization ---');
    const viz = new BTreeVisualizer('visualization-canvas');
    viz.setViewMode('parse');
    assert(viz.viewMode === 'parse', 'View mode set to parse');

    console.log('\n--- Test 2: Connect Event Manager to Visualizer ---');
    // Simulate main.js connection for parse events
    eventManager.on(8, (e) => { // PARSE_START
        viz.showParseStart(e.data.sql);
    });
    eventManager.on(9, (e) => { // PARSE_TOKEN
        viz.showParseToken(e.data.token, e.data.type);
    });
    eventManager.on(10, (e) => { // PARSE_COMPLETE
        viz.showParseComplete(e.data.success);
    });
    assert(true, 'Event manager connected to visualizer for parse events');

    console.log('\n--- Test 3: PARSE_START Event (Event Type 8) ---');
    const testSQL = 'SELECT id, name FROM users WHERE age > 18';
    eventManager.handleEvent(8, JSON.stringify({ sql: testSQL }));
    assert(viz.currentSQL === testSQL, 'SQL stored correctly');
    assert(viz.parseTokens.length === 0, 'Parse tokens array initialized empty');
    assert(viz.parseTree !== null, 'Parse tree created');

    console.log('\n--- Test 4: PARSE_TOKEN Events (Event Type 9) ---');
    // Simulate token stream from SQLite parser
    const tokens = [
        { token: 'SELECT', type: 38 },
        { token: 'id', type: 1 },
        { token: ',', type: 53 },
        { token: 'name', type: 1 },
        { token: 'FROM', type: 41 },
        { token: 'users', type: 1 },
        { token: 'WHERE', type: 48 },
        { token: 'age', type: 1 },
        { token: '>', type: 22 },
        { token: '18', type: 40 }
    ];

    tokens.forEach(t => {
        eventManager.handleEvent(9, JSON.stringify(t));
    });

    assert(viz.parseTokens.length === tokens.length, `All ${tokens.length} tokens recorded`);
    assert(viz.parseTokens[0].token === 'SELECT', 'First token is SELECT');
    assert(viz.parseTokens[0].type === 'TK_SELECT', 'First token type is TK_SELECT');

    console.log('\n--- Test 5: Token Type Mapping ---');
    // Test that numeric types are converted to names
    const keywordToken = viz.parseTokens.find(t => t.token === 'FROM');
    assert(keywordToken !== undefined, 'FROM token found');
    assert(keywordToken.type === 'TK_FROM', 'FROM token type mapped correctly');

    console.log('\n--- Test 6: PARSE_COMPLETE Event (Event Type 10) ---');
    eventManager.handleEvent(10, JSON.stringify({ success: 1 }));
    assert(true, 'PARSE_COMPLETE event processed without error');

    console.log('\n--- Test 7: Parse Tree Structure ---');
    const tree = viz.parseTree;
    assert(tree !== null, 'Parse tree exists');
    assert(tree.type === 'statement', 'Parse tree root is a statement');
    assert(tree.text === testSQL, 'Parse tree contains original SQL');
    assert(Array.isArray(tree.children), 'Parse tree has children array');

    console.log('\n--- Test 8: Parse Tree Command Node ---');
    // The tree should have a SELECT command node
    const commandNode = tree.children.find(c => c.type === 'command');
    assert(commandNode !== undefined, 'Command node exists in parse tree');
    if (commandNode) {
        assert(commandNode.text === 'SELECT', 'Command node is SELECT');
        assert(Array.isArray(commandNode.children), 'Command node has children');
    }

    console.log('\n--- Test 9: Multiple SQL Statements ---');
    viz.clear();
    viz.setViewMode('parse');

    const insertSQL = 'INSERT INTO users VALUES (1, "Alice", 30)';
    eventManager.handleEvent(8, JSON.stringify({ sql: insertSQL }));

    const insertTokens = [
        { token: 'INSERT', type: 54 },
        { token: 'INTO', type: 67 },
        { token: 'users', type: 1 },
        { token: 'VALUES', type: 58 },
        { token: '(', type: 39 },
        { token: '1', type: 40 },
        { token: ',', type: 53 },
        { token: '"Alice"', type: 112 },
        { token: ',', type: 53 },
        { token: '30', type: 40 },
        { token: ')', type: 40 }
    ];

    insertTokens.forEach(t => {
        eventManager.handleEvent(9, JSON.stringify(t));
    });

    eventManager.handleEvent(10, JSON.stringify({ success: 1 }));

    assert(viz.currentSQL === insertSQL, 'INSERT SQL stored');
    assert(viz.parseTokens.length === insertTokens.length, 'All INSERT tokens recorded');

    console.log('\n--- Test 10: SQL Tokenization ---');
    const testSQL2 = 'CREATE TABLE users (id INTEGER, name TEXT)';
    const tokenized = viz.tokenizeSQL(testSQL2);

    assert(Array.isArray(tokenized), 'Tokenize returns array');
    assert(tokenized.length > 0, 'Tokenization produces tokens');

    const createToken = tokenized.find(t => t.text === 'CREATE');
    const tableToken = tokenized.find(t => t.text === 'TABLE');
    assert(createToken !== undefined, 'CREATE keyword found');
    assert(createToken.type === 'keyword', 'CREATE is a keyword');
    assert(tableToken !== undefined, 'TABLE keyword found');
    assert(tableToken.type === 'keyword', 'TABLE is a keyword');

    console.log('\n--- Test 11: Parse Methods Exist ---');
    assert(typeof viz.showParseStart === 'function', 'showParseStart method exists');
    assert(typeof viz.showParseToken === 'function', 'showParseToken method exists');
    assert(typeof viz.showParseComplete === 'function', 'showParseComplete method exists');
    assert(typeof viz.buildParseTree === 'function', 'buildParseTree method exists');
    assert(typeof viz.tokenizeSQL === 'function', 'tokenizeSQL method exists');
    assert(typeof viz.drawParseTree === 'function', 'drawParseTree method exists');

    console.log('\n--- Test 12: Edge Cases - Special Characters ---');
    viz.clear();
    viz.setViewMode('parse');

    const specialSQL = 'SELECT * FROM "table-with-dash"';
    eventManager.handleEvent(8, JSON.stringify({ sql: specialSQL }));

    eventManager.handleEvent(9, JSON.stringify({ token: 'SELECT', type: 38 }));
    eventManager.handleEvent(9, JSON.stringify({ token: '*', type: 103 }));
    eventManager.handleEvent(9, JSON.stringify({ token: 'FROM', type: 41 }));
    eventManager.handleEvent(9, JSON.stringify({ token: '"table-with-dash"', type: 112 }));

    assert(viz.parseTokens.length === 4, 'Special character tokens recorded');
    assert(viz.parseTokens[1].token === '*', 'Wildcard token recorded');

    console.log('\n--- Test 13: Long Token Handling ---');
    viz.clear();
    viz.setViewMode('parse');

    const longToken = 'a'.repeat(150);
    eventManager.handleEvent(9, JSON.stringify({ token: longToken, type: 1 }));

    assert(viz.parseTokens.length === 1, 'Long token recorded');
    assert(viz.parseTokens[0].token.length <= 103, 'Long token truncated (100 chars + "...")');

    console.log('\n--- Test 14: Direct Visualizer Method Calls ---');
    viz.clear();
    viz.setViewMode('parse');

    viz.showParseStart('DELETE FROM users WHERE id = 1');
    assert(viz.currentSQL === 'DELETE FROM users WHERE id = 1', 'Direct showParseStart works');

    viz.showParseToken('DELETE', 54);
    assert(viz.parseTokens.length === 1, 'Direct showParseToken adds token');
    assert(viz.parseTokens[0].token === 'DELETE', 'Direct token is DELETE');

    viz.showParseComplete(1);
    assert(true, 'Direct showParseComplete executes');

    console.log('\n--- Test 15: Token Type Coverage ---');
    // Test various token type mappings
    const typeTests = [
        { token: 'SELECT', type: 38, expected: 'TK_SELECT' },
        { token: 'FROM', type: 41, expected: 'TK_FROM' },
        { token: 'WHERE', type: 48, expected: 'TK_WHERE' },
        { token: 'INSERT', type: 54, expected: 'TK_INSERT' },
        { token: 'UPDATE', type: 56, expected: 'TK_UPDATE' },
        { token: 'DELETE', type: 55, expected: 'TK_DELETE' },
        { token: 'CREATE', type: 17, expected: 'TK_CREATE' }
    ];

    let typeTestsPassed = 0;
    typeTests.forEach(test => {
        viz.clear();
        viz.setViewMode('parse');
        viz.showParseToken(test.token, test.type);
        if (viz.parseTokens[0].type === test.expected) {
            typeTestsPassed++;
        }
    });

    assert(typeTestsPassed === typeTests.length, `All ${typeTests.length} token types mapped correctly`);

    console.log('\n--- Test 16: Parse Tree Building ---');
    const complexSQL = 'SELECT id, name, age FROM users WHERE age > 18 ORDER BY name';
    const tree2 = viz.buildParseTree(complexSQL);

    assert(tree2.type === 'statement', 'Complex parse tree root is statement');
    assert(tree2.children.length > 0, 'Complex parse tree has children');

    // Find SELECT command
    const selectCmd = tree2.children.find(c => c.type === 'command' && c.text === 'SELECT');
    assert(selectCmd !== undefined, 'SELECT command found in complex tree');

} catch (error) {
    console.error('\n❌ Error during Parse testing:', error.message);
    console.error(error.stack);
    parseTestsFailed++;
}

console.log('\n' + '='.repeat(60));
console.log(`Parse Tests Complete: ${parseTestsPassed} passed, ${parseTestsFailed} failed`);
console.log('='.repeat(60));

process.exit(parseTestsFailed > 0 ? 1 : 0);
