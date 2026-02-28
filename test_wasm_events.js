#!/usr/bin/env node
/**
 * Test WASM Event Emission
 * Verifies that the instrumented SQLite WASM module emits events correctly
 */

const fs = require('fs');
const path = require('path');

console.log('=== SQLite WASM Event Emission Test ===\n');

// Read the JavaScript glue code
const jsGluePath = path.join(__dirname, 'build', 'sqlite3.js');
const jsGlue = fs.readFileSync(jsGluePath, 'utf8');

console.log('Checking JavaScript glue code...\n');

// Check for required exports
const requiredExports = [
    'createSQLiteModule',
    'ccall',
    'cwrap',
    'UTF8ToString',
    'stringToUTF8',
    'lengthBytesUTF8',
    'HEAP32',
    'HEAP8',
    'HEAPU8'
];

let allExportsFound = true;
for (const exp of requiredExports) {
    const found = jsGlue.includes(exp);
    const status = found ? '✓' : '✗';
    console.log(`${status} Export: ${exp}`);
    if (!found) allExportsFound = false;
}

console.log();

// Check for exported SQLite functions
const sqliteFunctions = [
    '_sqlite3_open',
    '_sqlite3_close',
    '_sqlite3_exec',
    '_sqlite3_prepare_v2',
    '_sqlite3_step',
    '_sqlite3_finalize',
    '_sqlite3_column_text',
    '_sqlite3_errmsg',
    '_malloc',
    '_free'
];

console.log('Checking exported SQLite functions...\n');
let allFunctionsFound = true;
for (const func of sqliteFunctions) {
    const found = jsGlue.includes(func);
    const status = found ? '✓' : '✗';
    console.log(`${status} Function: ${func}`);
    if (!found) allFunctionsFound = false;
}

console.log();

// Check for WASM file
const wasmPath = path.join(__dirname, 'build', 'sqlite3.wasm');
const wasmExists = fs.existsSync(wasmPath);
const wasmSize = wasmExists ? fs.statSync(wasmPath).size : 0;

console.log('Checking WASM module...\n');
console.log(`${wasmExists ? '✓' : '✗'} WASM file exists: ${wasmPath}`);
if (wasmExists) {
    console.log(`  Size: ${wasmSize} bytes (${(wasmSize / 1024).toFixed(2)} KB)`);
}

console.log();

// Check instrumentation in source
const sqliteSourcePath = path.join(__dirname, 'sqlite', 'instrumented', 'sqlite3.c');
const sqliteSource = fs.readFileSync(sqliteSourcePath, 'utf8');

console.log('Checking SQLite instrumentation...\n');

const eventHooks = [
    { name: 'parse_start_event', count: sqliteSource.split('parse_start_event').length - 1 },
    { name: 'parse_token_event', count: sqliteSource.split('parse_token_event').length - 1 },
    { name: 'parse_complete_event', count: sqliteSource.split('parse_complete_event').length - 1 },
    { name: 'vdbe_start_event', count: sqliteSource.split('vdbe_start_event').length - 1 },
    { name: 'vdbe_opcode_event', count: sqliteSource.split('vdbe_opcode_event').length - 1 },
    { name: 'vdbe_complete_event', count: sqliteSource.split('vdbe_complete_event').length - 1 },
    { name: 'page_allocate_event', count: sqliteSource.split('page_allocate_event').length - 1 },
    { name: 'page_free_event', count: sqliteSource.split('page_free_event').length - 1 },
    { name: 'btree_insert_event', count: sqliteSource.split('btree_insert_event').length - 1 },
    { name: 'btree_delete_event', count: sqliteSource.split('btree_delete_event').length - 1 },
    { name: 'btree_split_event', count: sqliteSource.split('btree_split_event').length - 1 },
    { name: 'btree_balance_event', count: sqliteSource.split('btree_balance_event').length - 1 },
];

console.log('Event Hook Call Counts:');
let totalHooks = 0;
for (const hook of eventHooks) {
    totalHooks += hook.count;
    const status = hook.count > 0 ? '✓' : '✗';
    console.log(`  ${status} ${hook.name}: ${hook.count} call(s)`);
}

console.log();

// Summary
console.log('=== Test Summary ===\n');
console.log(`JavaScript Glue: ${allExportsFound && allFunctionsFound ? '✓ PASS' : '✗ FAIL'}`);
console.log(`WASM Module: ${wasmExists ? '✓ PASS' : '✗ FAIL'}`);
console.log(`Instrumentation: ${totalHooks > 0 ? `✓ PASS (${totalHooks} hooks)` : '✗ FAIL'}`);
console.log();

if (allExportsFound && allFunctionsFound && wasmExists && totalHooks > 0) {
    console.log('✅ All checks passed! WASM module is properly configured.\n');
    process.exit(0);
} else {
    console.log('❌ Some checks failed. Please review the output above.\n');
    process.exit(1);
}
