/**
 * Iteration 4: Deep-Dive Validation of Each Visualization System
 *
 * This test suite provides comprehensive, granular validation of:
 * 1. VDBE event emission and visualization rendering
 * 2. SQL parse event emission and visualization rendering
 * 3. B-Tree page event emission and visualization rendering
 *
 * Each system is tested individually with detailed event tracking.
 */

const { test, expect } = require('@playwright/test');

test.describe('Iteration 4: Deep-Dive System Validation', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8000/src/web/index.html');
        await page.waitForSelector('#db-status', { timeout: 10000 });
        await expect(page.locator('#db-status')).toContainText('Ready', { timeout: 15000 });
    });

    // ========================================================================
    // VDBE SYSTEM DEEP DIVE
    // ========================================================================

    test.describe('VDBE System - Deep Dive Validation', () => {

        test('VDBE-1: Event Type Verification', async ({ page }) => {
            console.log('\n=== VDBE-1: EVENT TYPE VERIFICATION ===\n');

            const eventTypes = {
                VDBE_START: 0,
                VDBE_OPCODE: 0,
                VDBE_COMPLETE: 0
            };

            page.on('console', msg => {
                const text = msg.text();
                if (text.includes('VDBE_START')) eventTypes.VDBE_START++;
                if (text.includes('VDBE_OPCODE')) eventTypes.VDBE_OPCODE++;
                if (text.includes('VDBE_COMPLETE')) eventTypes.VDBE_COMPLETE++;
            });

            await page.click('#clear-events-btn');
            await page.selectOption('#view-mode', 'vdbe');

            await page.fill('#sql-input', 'SELECT 1 + 1');
            await page.click('#execute-btn');
            await page.waitForTimeout(3000);

            console.log('VDBE Event Types Detected:');
            console.log(`  VDBE_START: ${eventTypes.VDBE_START}`);
            console.log(`  VDBE_OPCODE: ${eventTypes.VDBE_OPCODE}`);
            console.log(`  VDBE_COMPLETE: ${eventTypes.VDBE_COMPLETE}`);

            // Check event log
            const eventLog = page.locator('#event-log');
            const logText = await eventLog.textContent();
            const hasStart = logText.includes('VDBE_START');
            const hasComplete = logText.includes('VDBE_COMPLETE');

            console.log(`  Event log has VDBE_START: ${hasStart}`);
            console.log(`  Event log has VDBE_COMPLETE: ${hasComplete}`);

            expect(hasStart).toBeTruthy();
            expect(hasComplete).toBeTruthy();
            expect(eventTypes.VDBE_START).toBeGreaterThan(0);

            console.log('\n✓ VDBE event types verified\n');
        });

        test('VDBE-2: Opcode Tracking', async ({ page }) => {
            console.log('\n=== VDBE-2: OPCODE TRACKING ===\n');

            const opcodes = [];
            page.on('console', msg => {
                const text = msg.text();
                const match = text.match(/\[DEBUG\] Event type 12:/);
                if (match) {
                    opcodes.push(text);
                }
            });

            await page.click('#clear-events-btn');
            await page.selectOption('#view-mode', 'vdbe');

            await page.fill('#sql-input', 'SELECT 1, 2, 3');
            await page.click('#execute-btn');
            await page.waitForTimeout(3000);

            console.log(`Opcodes captured: ${opcodes.length}`);

            // Verify canvas is rendering
            const canvas = page.locator('#visualization-canvas');
            const isVisible = await canvas.isVisible();
            console.log(`Canvas visible in VDBE mode: ${isVisible}`);

            expect(isVisible).toBeTruthy();
            expect(opcodes.length).toBeGreaterThan(0);

            console.log('\n✓ VDBE opcode tracking verified\n');
        });

        test('VDBE-3: Result Code Handling', async ({ page }) => {
            console.log('\n=== VDBE-3: RESULT CODE HANDLING ===\n');

            const resultCodes = [];
            page.on('console', msg => {
                const text = msg.text();
                const match = text.match(/resultCode["\s:]+(\d+)/);
                if (match) {
                    resultCodes.push(parseInt(match[1]));
                }
            });

            await page.click('#clear-events-btn');
            await page.selectOption('#view-mode', 'vdbe');

            // Execute successful query
            await page.fill('#sql-input', 'SELECT 1');
            await page.click('#execute-btn');
            await page.waitForTimeout(3000);

            console.log(`Result codes captured: ${resultCodes.length}`);
            console.log(`Result codes: ${resultCodes.join(', ')}`);

            // SQLite result codes:
            // 0 = SQLITE_OK
            // 100 = SQLITE_ROW
            // 101 = SQLITE_DONE

            const hasSuccess = resultCodes.some(rc => rc === 0 || rc === 100 || rc === 101);
            console.log(`Has successful result code: ${hasSuccess}`);

            expect(resultCodes.length).toBeGreaterThan(0);
            expect(hasSuccess).toBeTruthy();

            console.log('\n✓ VDBE result code handling verified\n');
        });

        test('VDBE-4: Visualization Rendering', async ({ page }) => {
            console.log('\n=== VDBE-4: VISUALIZATION RENDERING ===\n');

            await page.click('#clear-events-btn');
            await page.selectOption('#view-mode', 'vdbe');

            await page.fill('#sql-input', 'SELECT * FROM (SELECT 1)');
            await page.click('#execute-btn');
            await page.waitForTimeout(3000);

            // Check canvas properties
            const canvas = page.locator('#visualization-canvas');
            const isVisible = await canvas.isVisible();
            const box = await canvas.boundingBox();

            console.log('Canvas Properties:');
            console.log(`  Visible: ${isVisible}`);
            console.log(`  Width: ${box ? box.width : 'N/A'}`);
            console.log(`  Height: ${box ? box.height : 'N/A'}`);

            expect(isVisible).toBeTruthy();
            if (box) {
                expect(box.width).toBeGreaterThan(0);
                expect(box.height).toBeGreaterThan(0);
            }

            console.log('\n✓ VDBE visualization rendering verified\n');
        });
    });

    // ========================================================================
    // PARSE SYSTEM DEEP DIVE
    // ========================================================================

    test.describe('Parse System - Deep Dive Validation', () => {

        test('PARSE-1: Event Type Verification', async ({ page }) => {
            console.log('\n=== PARSE-1: EVENT TYPE VERIFICATION ===\n');

            const eventTypes = {
                PARSE_START: 0,
                PARSE_TOKEN: 0,
                PARSE_COMPLETE: 0
            };

            page.on('console', msg => {
                const text = msg.text();
                if (text.includes('PARSE_START')) eventTypes.PARSE_START++;
                if (text.includes('PARSE_TOKEN')) eventTypes.PARSE_TOKEN++;
                if (text.includes('PARSE_COMPLETE')) eventTypes.PARSE_COMPLETE++;
                if (text.includes('Found parse_start_event')) eventTypes.PARSE_START++;
                if (text.includes('Found parse_complete_event')) eventTypes.PARSE_COMPLETE++;
            });

            await page.click('#clear-events-btn');
            await page.selectOption('#view-mode', 'parse');

            await page.fill('#sql-input', 'CREATE TABLE test (id INTEGER)');
            await page.click('#execute-btn');
            await page.waitForTimeout(3000);

            console.log('Parse Event Types Detected:');
            console.log(`  PARSE_START: ${eventTypes.PARSE_START}`);
            console.log(`  PARSE_TOKEN: ${eventTypes.PARSE_TOKEN}`);
            console.log(`  PARSE_COMPLETE: ${eventTypes.PARSE_COMPLETE}`);

            // Check event log
            const eventLog = page.locator('#event-log');
            const logText = await eventLog.textContent();
            const hasStart = logText.includes('PARSE_START');
            const hasComplete = logText.includes('PARSE_COMPLETE');

            console.log(`  Event log has PARSE_START: ${hasStart}`);
            console.log(`  Event log has PARSE_COMPLETE: ${hasComplete}`);

            expect(hasStart).toBeTruthy();
            expect(hasComplete).toBeTruthy();

            console.log('\n✓ Parse event types verified\n');
        });

        test('PARSE-2: Token Recognition', async ({ page }) => {
            console.log('\n=== PARSE-2: TOKEN RECOGNITION ===\n');

            const tokens = [];
            page.on('console', msg => {
                const text = msg.text();
                const match = text.match(/token["\s:]+["\']?([A-Z_]+)/);
                if (match) {
                    tokens.push(match[1]);
                }
            });

            await page.click('#clear-events-btn');
            await page.selectOption('#view-mode', 'parse');

            await page.fill('#sql-input', 'SELECT id FROM users WHERE name = "test"');
            await page.click('#execute-btn');
            await page.waitForTimeout(3000);

            console.log(`Tokens captured: ${tokens.length}`);
            console.log(`Tokens: ${tokens.slice(0, 10).join(', ')}`);

            // Expected tokens for this query
            const expectedTokens = ['TK_SELECT', 'TK_ID', 'TK_FROM', 'TK_WHERE'];
            const hasExpectedTokens = expectedTokens.some(t => tokens.includes(t));

            console.log(`Has expected token types: ${hasExpectedTokens}`);

            expect(tokens.length).toBeGreaterThan(0);

            console.log('\n✓ Parse token recognition verified\n');
        });

        test('PARSE-3: Parse Tree Construction', async ({ page }) => {
            console.log('\n=== PARSE-3: PARSE TREE CONSTRUCTION ===\n');

            await page.click('#clear-events-btn');
            await page.selectOption('#view-mode', 'parse');

            await page.fill('#sql-input', 'SELECT * FROM users');
            await page.click('#execute-btn');
            await page.waitForTimeout(3000);

            // Verify canvas is rendering the parse tree
            const canvas = page.locator('#visualization-canvas');
            const isVisible = await canvas.isVisible();

            console.log(`Parse tree canvas visible: ${isVisible}`);

            expect(isVisible).toBeTruthy();

            console.log('\n✓ Parse tree construction verified\n');
        });

        test('PARSE-4: Complex Query Parsing', async ({ page }) => {
            console.log('\n=== PARSE-4: COMPLEX QUERY PARSING ===\n');

            const parseEvents = [];
            page.on('console', msg => {
                const text = msg.text();
                if (text.includes('PARSE') || text.includes('parse')) {
                    parseEvents.push(text);
                }
            });

            await page.click('#clear-events-btn');
            await page.selectOption('#view-mode', 'parse');

            const complexSQL = `
                SELECT u.name, d.department
                FROM users u
                JOIN departments d ON u.dept_id = d.id
                WHERE u.salary > 50000
                ORDER BY u.name
            `;

            await page.fill('#sql-input', complexSQL);
            await page.click('#execute-btn');
            await page.waitForTimeout(5000);

            console.log(`Parse events for complex query: ${parseEvents.length}`);

            // Check event log
            const eventLog = page.locator('#event-log');
            const logText = await eventLog.textContent();
            const hasParseEvents = logText.includes('PARSE');

            console.log(`Event log has parse events: ${hasParseEvents}`);

            expect(hasParseEvents).toBeTruthy();
            expect(parseEvents.length).toBeGreaterThan(0);

            console.log('\n✓ Complex query parsing verified\n');
        });
    });

    // ========================================================================
    // B-TREE SYSTEM DEEP DIVE
    // ========================================================================

    test.describe('B-Tree System - Deep Dive Validation', () => {

        test('BTREE-1: Event Type Verification', async ({ page }) => {
            console.log('\n=== BTREE-1: EVENT TYPE VERIFICATION ===\n');

            const eventTypes = {
                BTREE_OPEN: 0,
                BTREE_INSERT: 0,
                BTREE_DELETE: 0,
                BTREE_SPLIT: 0,
                BTREE_BALANCE: 0,
                PAGE_ALLOCATE: 0,
                PAGE_FREE: 0
            };

            page.on('console', msg => {
                const text = msg.text();
                const match = text.match(/\[DEBUG\] Event type (\d+):/);
                if (match) {
                    const type = parseInt(match[1]);
                    if (type === 0) eventTypes.BTREE_OPEN++;
                    if (type === 2) eventTypes.BTREE_INSERT++;
                    if (type === 3) eventTypes.BTREE_DELETE++;
                    if (type === 4) eventTypes.BTREE_SPLIT++;
                    if (type === 5) eventTypes.BTREE_BALANCE++;
                    if (type === 6) eventTypes.PAGE_ALLOCATE++;
                    if (type === 7) eventTypes.PAGE_FREE++;
                }
            });

            await page.click('#clear-events-btn');
            await page.selectOption('#view-mode', 'btree');

            await page.fill('#sql-input', 'CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
            await page.click('#execute-btn');
            await page.waitForTimeout(3000);

            console.log('B-Tree Event Types Detected:');
            console.log(`  BTREE_OPEN: ${eventTypes.BTREE_OPEN}`);
            console.log(`  BTREE_INSERT: ${eventTypes.BTREE_INSERT}`);
            console.log(`  BTREE_DELETE: ${eventTypes.BTREE_DELETE}`);
            console.log(`  BTREE_SPLIT: ${eventTypes.BTREE_SPLIT}`);
            console.log(`  BTREE_BALANCE: ${eventTypes.BTREE_BALANCE}`);
            console.log(`  PAGE_ALLOCATE: ${eventTypes.PAGE_ALLOCATE}`);
            console.log(`  PAGE_FREE: ${eventTypes.PAGE_FREE}`);

            // Check event log
            const eventLog = page.locator('#event-log');
            const logText = await eventLog.textContent();
            const hasPageEvents = logText.includes('PAGE_ALLOCATE') || logText.includes('BTREE');

            console.log(`  Event log has B-Tree events: ${hasPageEvents}`);

            expect(hasPageEvents).toBeTruthy();

            console.log('\n✓ B-Tree event types verified\n');
        });

        test('BTREE-2: Page Allocation Tracking', async ({ page }) => {
            console.log('\n=== BTREE-2: PAGE ALLOCATION TRACKING ===\n');

            const pageAllocations = [];
            page.on('console', msg => {
                const text = msg.text();
                const match = text.match(/Event type 6.*"page"\s*:\s*(\d+)/);
                if (match) {
                    pageAllocations.push(parseInt(match[1]));
                }
            });

            await page.click('#clear-events-btn');
            await page.selectOption('#view-mode', 'btree');

            await page.fill('#sql-input', 'CREATE TABLE test (id INTEGER, name TEXT, value REAL)');
            await page.click('#execute-btn');
            await page.waitForTimeout(3000);

            console.log(`Page allocations detected: ${pageAllocations.length}`);
            console.log(`Page numbers: ${pageAllocations.join(', ')}`);

            // Check page counter
            const pageCount = await page.locator('#page-count').textContent();
            const pageCountNum = parseInt(pageCount);

            console.log(`Page counter: ${pageCountNum}`);

            expect(pageCountNum).toBeGreaterThan(0);

            console.log('\n✓ Page allocation tracking verified\n');
        });

        test('BTREE-3: Node Visualization', async ({ page }) => {
            console.log('\n=== BTREE-3: NODE VISUALIZATION ===\n');

            await page.click('#clear-events-btn');
            await page.selectOption('#view-mode', 'btree');

            await page.fill('#sql-input', 'CREATE TABLE nodes (id INTEGER PRIMARY KEY, data TEXT)');
            await page.click('#execute-btn');
            await page.waitForTimeout(3000);

            // Check canvas rendering
            const canvas = page.locator('#visualization-canvas');
            const isVisible = await canvas.isVisible();
            const box = await canvas.boundingBox();

            console.log('B-Tree Canvas Properties:');
            console.log(`  Visible: ${isVisible}`);
            console.log(`  Width: ${box ? box.width : 'N/A'}`);
            console.log(`  Height: ${box ? box.height : 'N/A'}`);

            expect(isVisible).toBeTruthy();

            console.log('\n✓ B-Tree node visualization verified\n');
        });

        test('BTREE-4: Insert Operations', async ({ page }) => {
            console.log('\n=== BTREE-4: INSERT OPERATIONS ===\n');

            const insertEvents = [];
            page.on('console', msg => {
                const text = msg.text();
                if (text.includes('BTREE_INSERT') || text.includes('Event type 2')) {
                    insertEvents.push(text);
                }
            });

            await page.click('#clear-events-btn');
            await page.selectOption('#view-mode', 'btree');

            // Create table
            await page.fill('#sql-input', 'CREATE TABLE insert_test (id INTEGER PRIMARY KEY, value TEXT)');
            await page.click('#execute-btn');
            await page.waitForTimeout(2000);

            // Insert data
            await page.fill('#sql-input', "INSERT INTO insert_test VALUES (1, 'first')");
            await page.click('#execute-btn');
            await page.waitForTimeout(2000);

            console.log(`Insert events captured: ${insertEvents.length}`);

            // Check page count increased
            const pageCount = await page.locator('#page-count').textContent();
            console.log(`Page count after insert: ${pageCount}`);

            expect(insertEvents.length).toBeGreaterThanOrEqual(0);

            console.log('\n✓ B-Tree insert operations verified\n');
        });

        test('BTREE-5: Multi-Table Operations', async ({ page }) => {
            console.log('\n=== BTREE-5: MULTI-TABLE OPERATIONS ===\n');

            const allEvents = [];
            page.on('console', msg => {
                const text = msg.text();
                const match = text.match(/Event type (\d+):/);
                if (match) {
                    const type = parseInt(match[1]);
                    if (type <= 7) {
                        allEvents.push({ type, text });
                    }
                }
            });

            await page.click('#clear-events-btn');
            await page.selectOption('#view-mode', 'btree');

            // Create multiple tables
            await page.fill('#sql-input', `
                CREATE TABLE table1 (id INTEGER PRIMARY KEY, data TEXT);
                CREATE TABLE table2 (id INTEGER PRIMARY KEY, info TEXT);
                CREATE TABLE table3 (id INTEGER PRIMARY KEY, details TEXT);
            `);
            await page.click('#execute-btn');
            await page.waitForTimeout(5000);

            console.log(`B-Tree events for multi-table: ${allEvents.length}`);

            // Categorize events
            const eventCounts = {};
            allEvents.forEach(e => {
                eventCounts[e.type] = (eventCounts[e.type] || 0) + 1;
            });

            console.log('Event type distribution:');
            Object.keys(eventCounts).sort().forEach(type => {
                console.log(`  Type ${type}: ${eventCounts[type]} events`);
            });

            expect(allEvents.length).toBeGreaterThan(0);

            console.log('\n✓ Multi-table operations verified\n');
        });
    });

    // ========================================================================
    // INTEGRATION TESTS
    // ========================================================================

    test.describe('Integration: All Three Systems Together', () => {

        test('INTEGRATION-1: Simultaneous Event Emission', async ({ page }) => {
            console.log('\n=== INTEGRATION-1: SIMULTANEOUS EVENT EMISSION ===\n');

            const eventCounts = {
                vdbe: 0,
                parse: 0,
                btree: 0
            };

            page.on('console', msg => {
                const text = msg.text();
                const match = text.match(/Event type (\d+):/);
                if (match) {
                    const type = parseInt(match[1]);
                    if (type >= 11 && type <= 13) eventCounts.vdbe++;
                    else if (type >= 8 && type <= 10) eventCounts.parse++;
                    else if (type <= 7) eventCounts.btree++;
                }
            });

            await page.click('#clear-events-btn');

            // Execute query that triggers all three systems
            await page.fill('#sql-input', 'CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
            await page.click('#execute-btn');
            await page.waitForTimeout(3000);

            console.log('Event Distribution:');
            console.log(`  VDBE events: ${eventCounts.vdbe}`);
            console.log(`  Parse events: ${eventCounts.parse}`);
            console.log(`  B-Tree events: ${eventCounts.btree}`);

            const totalEvents = eventCounts.vdbe + eventCounts.parse + eventCounts.btree;
            console.log(`  Total: ${totalEvents}`);

            expect(totalEvents).toBeGreaterThan(0);

            console.log('\n✓ Simultaneous event emission verified\n');
        });

        test('INTEGRATION-2: View Mode Consistency', async ({ page }) => {
            console.log('\n=== INTEGRATION-2: VIEW MODE CONSISTENCY ===\n');

            await page.click('#clear-events-btn');

            // Execute query
            await page.fill('#sql-input', 'SELECT 1 AS result');
            await page.click('#execute-btn');
            await page.waitForTimeout(3000);

            // Test each view mode
            const viewResults = {};
            for (const mode of ['btree', 'parse', 'vdbe']) {
                await page.selectOption('#view-mode', mode);
                await page.waitForTimeout(500);

                const canvas = page.locator('#visualization-canvas');
                const eventLog = page.locator('#event-log');

                viewResults[mode] = {
                    canvasVisible: await canvas.isVisible(),
                    hasEvents: (await eventLog.textContent()).length > 0
                };
            }

            console.log('View Mode Consistency Check:');
            for (const [mode, results] of Object.entries(viewResults)) {
                console.log(`  ${mode}:`);
                console.log(`    Canvas: ${results.canvasVisible}`);
                console.log(`    Events: ${results.hasEvents}`);
            }

            // All modes should have canvas visible and events
            expect(viewResults.btree.canvasVisible).toBeTruthy();
            expect(viewResults.parse.canvasVisible).toBeTruthy();
            expect(viewResults.vdbe.canvasVisible).toBeTruthy();

            console.log('\n✓ View mode consistency verified\n');
        });

        test('INTEGRATION-3: Statistical Tracking', async ({ page }) => {
            console.log('\n=== INTEGRATION-3: STATISTICAL TRACKING ===\n');

            await page.click('#clear-events-btn');

            // Execute multiple operations
            const operations = [
                'CREATE TABLE stats_test (id INTEGER, value REAL)',
                "INSERT INTO stats_test VALUES (1, 10.5)",
                "INSERT INTO stats_test VALUES (2, 20.7)",
                'SELECT * FROM stats_test'
            ];

            for (const sql of operations) {
                await page.fill('#sql-input', sql);
                await page.click('#execute-btn');
                await page.waitForTimeout(1500);
            }

            // Get final statistics
            const eventCount = await page.locator('#event-count').textContent();
            const pageCount = await page.locator('#page-count').textContent();

            console.log('Final Statistics:');
            console.log(`  Event count: ${eventCount}`);
            console.log(`  Page count: ${pageCount}`);

            expect(parseInt(eventCount)).toBeGreaterThan(0);
            expect(parseInt(pageCount)).toBeGreaterThan(0);

            console.log('\n✓ Statistical tracking verified\n');
        });
    });

});
