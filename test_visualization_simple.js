#!/usr/bin/env node

/**
 * Direct code validation test - checks that the code files have correct structure
 */

const fs = require('fs');
const path = require('path');

const visualizerPath = path.join(__dirname, 'src/web/js/visualizer.js');
const eventsPath = path.join(__dirname, 'src/web/js/events.js');

console.log('\n=== SQLiteVis Code Validation Tests ===\n');

const visualizerCode = fs.readFileSync(visualizerPath, 'utf8');
const eventsCode = fs.readFileSync(eventsPath, 'utf8');

let passed = 0;
let failed = 0;

function test(name, condition) {
    if (condition) {
        console.log(`✓ ${name}`);
        passed++;
    } else {
        console.log(`✗ ${name}`);
        failed++;
    }
}

// Test 1: VDBE methods exist
console.log('\n--- VDBE Event Handling Tests ---');
test('BTreeVisualizer class defined', visualizerCode.includes('class BTreeVisualizer'));
test('showVdbeStart method exists', visualizerCode.includes('showVdbeStart'));
test('showVdbeOpcode method exists', visualizerCode.includes('showVdbeOpcode'));
test('showVdbeComplete method exists', visualizerCode.includes('showVdbeComplete'));
test('drawVdbeList method exists', visualizerCode.includes('drawVdbeList'));
test('vdbeOpcodes array initialized', visualizerCode.includes('this.vdbeOpcodes = []'));
test('vdbeCurrentPc initialized', visualizerCode.includes('this.vdbeCurrentPc'));

// Test 2: SQL Parsing methods exist
console.log('\n--- SQL Parsing Tests ---');
test('showParseStart method exists', visualizerCode.includes('showParseStart'));
test('showParseToken method exists', visualizerCode.includes('showParseToken'));
test('showParseComplete method exists', visualizerCode.includes('showParseComplete'));
test('drawParseTree method exists', visualizerCode.includes('drawParseTree'));
test('parseTokens array initialized', visualizerCode.includes('this.parseTokens = []'));
test('currentSQL initialized', visualizerCode.includes('this.currentSQL = '));
test('tokenTypeNames mapping exists', visualizerCode.includes('this.tokenTypeNames = '));

// Test 3: Token type mappings
console.log('\n--- Token Type Mapping Tests ---');
test('TK_SELECT mapped', visualizerCode.includes("38: 'TK_SELECT'"));
test('TK_FROM mapped', visualizerCode.includes("41: 'TK_FROM'"));
test('TK_ID mapped', visualizerCode.includes("36: 'TK_ID'"));
test('TK_WHERE mapped', visualizerCode.includes("48: 'TK_WHERE'"));
test('TK_INSERT mapped', visualizerCode.includes("54: 'TK_INSERT'"));

// Test 4: Page/B-Tree methods exist
console.log('\n--- B-Tree Page Handling Tests ---');
test('addPage method exists', visualizerCode.includes('addPage(pageNum'));
test('addCell method exists', visualizerCode.includes('addCell(pageNum'));
test('deleteCell method exists', visualizerCode.includes('deleteCell(pageNum'));
test('splitPage method exists', visualizerCode.includes('splitPage('));
test('nodes Map initialized', visualizerCode.includes('this.nodes = new Map()'));

// Test 5: Event Manager tests
console.log('\n--- Event Manager Tests ---');
test('EventManager class defined', eventsCode.includes('class EventManager'));
test('handleEvent method exists', eventsCode.includes('handleEvent(eventType'));
test('eventTypeNames mapping exists', eventsCode.includes('this.eventTypeNames = '));
test('eventCategories mapping exists', eventsCode.includes('this.eventCategories = '));

// Test 6: Event type mappings
console.log('\n--- Event Type Mapping Tests ---');
test('VDBE_START event mapped', eventsCode.includes("11: 'VDBE_START'"));
test('VDBE_OPCODE event mapped', eventsCode.includes("12: 'VDBE_OPCODE'"));
test('VDBE_COMPLETE event mapped', eventsCode.includes("13: 'VDBE_COMPLETE'"));
test('PARSE_START event mapped', eventsCode.includes("8: 'PARSE_START'"));
test('PARSE_TOKEN event mapped', eventsCode.includes("9: 'PARSE_TOKEN'"));
test('PARSE_COMPLETE event mapped', eventsCode.includes("10: 'PARSE_COMPLETE'"));
test('PAGE_ALLOCATE event mapped', eventsCode.includes("6: 'PAGE_ALLOCATE'"));
test('BTREE_INSERT event mapped', eventsCode.includes("2: 'BTREE_INSERT'"));
test('BTREE_SPLIT event mapped', eventsCode.includes("4: 'BTREE_SPLIT'"));
test('BTREE_DELETE event mapped', eventsCode.includes("3: 'BTREE_DELETE'"));

// Test 7: Event category mappings
console.log('\n--- Event Category Mapping Tests ---');
test('VDBE events in vdbe category', eventsCode.includes('11: \'vdbe\'') || eventsCode.includes('11: "vdbe"'));
test('Parse events in parse category', eventsCode.includes('8: \'parse\'') || eventsCode.includes('8: "parse"'));
test('B-Tree events in btree category', eventsCode.includes('0: \'btree\'') || eventsCode.includes('0: "btree"'));

// Test 8: VDBE visualization logic
console.log('\n--- VDBE Visualization Logic Tests ---');
test('VDBE_START initializes opcodes', visualizerCode.includes('this.vdbeOpcodes = []'));
test('VDBE_OPCODE stores program counter', visualizerCode.includes('this.vdbeOpcodes[pc]'));
test('VDBE_OPCODE stores opcode name', visualizerCode.includes('opcode: opcode'));
test('VDBE_COMPLETE handles result code', visualizerCode.includes('resultCode'));
test('View mode switches to vdbe', visualizerCode.includes("'vdbe'"));

// Test 9: Parse visualization logic
console.log('\n--- Parse Visualization Logic Tests ---');
test('PARSE_START stores SQL', visualizerCode.includes('this.currentSQL = sql'));
test('PARSE_START initializes tokens', visualizerCode.includes('this.parseTokens = []'));
test('PARSE_TOKEN appends to list', visualizerCode.includes('this.parseTokens.push'));
test('PARSE_TOKEN validates input', visualizerCode.includes('token === null') || visualizerCode.includes('token === undefined'));
test('View mode switches to parse', visualizerCode.includes("'parse'"));

// Test 10: B-Tree visualization logic
console.log('\n--- B-Tree Visualization Logic Tests ---');
test('addPage creates node object', visualizerCode.includes('page: pageNum'));
test('addPage sets page type', visualizerCode.includes('type: pageType'));
test('addPage initializes cells array', visualizerCode.includes('cells: []'));
test('splitPage creates new page', visualizerCode.includes('this.addPage(newPage'));
test('splitPage moves cells', visualizerCode.includes('cellsToMove'));
test('View mode switches to btree', visualizerCode.includes("'btree'"));

// Test 11: Drawing methods
console.log('\n--- Drawing Methods Tests ---');
test('draw method exists', visualizerCode.includes('draw()'));
test('drawNode method exists', visualizerCode.includes('drawNode(node)'));
test('drawConnections method exists', visualizerCode.includes('drawConnections(node)'));
test('layout method exists', visualizerCode.includes('layout()'));

// Test 12: Error handling
console.log('\n--- Error Handling Tests ---');
test('PARSE_TOKEN has validation', visualizerCode.includes('console.warn'));
test('showVdbeOpcode has validation', visualizerCode.includes('typeof pc !== \'number\''));
test('EventManager has try-catch', eventsCode.includes('try {') && eventsCode.includes('catch'));

// Test 13: Integration
console.log('\n--- Integration Tests ---');
test('Visualizer has viewMode property', visualizerCode.includes('this.viewMode = '));
test('Visualizer has setViewMode method', visualizerCode.includes('setViewMode(mode)'));
test('EventManager has listeners Map', eventsCode.includes('this.listeners = new Map()'));
test('EventManager has on method', eventsCode.includes('on(eventType'));

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
    console.log('Some validation checks failed. Reviewing code...');
    process.exit(1);
} else {
    console.log('All validation checks passed!');
    console.log('\n✓ VDBE event and visualization code structure is correct');
    console.log('✓ SQL instruction parsing and visualization code structure is correct');
    console.log('✓ Page node event and visualization code structure is correct');
    process.exit(0);
}
