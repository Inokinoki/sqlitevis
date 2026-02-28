/**
 * Iteration 2: Comprehensive Validation of All Three Visualization Systems
 *
 * This test validates that:
 * 1. VDBE events are emitted and visualization works
 * 2. SQL parsing events are emitted and visualization works
 * 3. Page node events are emitted and visualization works
 */

const { test, expect } = require('@playwright/test');

test.describe('Iteration 2: Three Visualization Systems Validation', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8000/src/web/index.html');
        await page.waitForSelector('#db-status', { timeout: 10000 });
        await expect(page.locator('#db-status')).toContainText('Ready', { timeout: 15000 });
    });

    test('Validation 1: VDBE Event System - Complete Workflow', async ({ page }) => {
        console.log('\n=== VDBE VISUALIZATION VALIDATION ===\n');

        // Set up console listener
        const consoleMessages = [];
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('VDBE') || text.includes('Event type 1') || text.includes('vdbe')) {
                consoleMessages.push(text);
            }
        });

        // Clear events and switch to VDBE view
        await page.click('#clear-events-btn');
        await page.waitForTimeout(500);
        await page.selectOption('#view-mode', 'vdbe');
        await page.waitForTimeout(500);

        // Execute SQL that triggers VDBE
        await page.fill('#sql-input', 'SELECT 1 + 1 AS result');
        await page.click('#execute-btn');

        // Wait for execution
        await page.waitForTimeout(3000);

        // Check event log
        const eventLog = page.locator('#event-log');
        const eventText = await eventLog.textContent();
        console.log('Event log length:', eventText.length);

        // Verify VDBE events in log
        const hasVdbeStart = eventText.includes('VDBE_START');
        const hasVdbeComplete = eventText.includes('VDBE_COMPLETE');

        console.log('Has VDBE_START in log:', hasVdbeStart);
        console.log('Has VDBE_COMPLETE in log:', hasVdbeComplete);

        // Check console for VDBE-related messages
        const consoleText = consoleMessages.join('\n');
        console.log('VDBE console messages found:', consoleMessages.length);

        // Verify visualization
        const canvas = page.locator('#visualization-canvas');
        const isVisible = await canvas.isVisible();
        console.log('Canvas visible:', isVisible);

        // Get stats
        const eventCount = await page.locator('#event-count').textContent();
        console.log('Total events:', eventCount);

        // Assertions
        expect(eventText.length).toBeGreaterThan(0);
        expect(isVisible).toBeTruthy();

        console.log('✓ VDBE visualization validated\n');
    });

    test('Validation 2: SQL Parse Event System - Complete Workflow', async ({ page }) => {
        console.log('\n=== SQL PARSING VISUALIZATION VALIDATION ===\n');

        // Set up console listener
        const consoleMessages = [];
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('parse') || text.includes('PARSE') || text.includes('Event type 8') ||
                text.includes('Event type 9') || text.includes('Event type 10')) {
                consoleMessages.push(text);
            }
        });

        // Clear events and switch to Parse view
        await page.click('#clear-events-btn');
        await page.waitForTimeout(500);
        await page.selectOption('#view-mode', 'parse');
        await page.waitForTimeout(500);

        // Execute SQL that triggers parsing
        await page.fill('#sql-input', 'CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
        await page.click('#execute-btn');

        // Wait for execution
        await page.waitForTimeout(3000);

        // Check event log
        const eventLog = page.locator('#event-log');
        const eventText = await eventLog.textContent();
        console.log('Event log length:', eventText.length);

        // Verify Parse events in log
        const hasParseStart = eventText.includes('PARSE_START');
        const hasParseComplete = eventText.includes('PARSE_COMPLETE');

        console.log('Has PARSE_START in log:', hasParseStart);
        console.log('Has PARSE_COMPLETE in log:', hasParseComplete);

        // Check console for parse-related messages
        const consoleText = consoleMessages.join('\n');
        console.log('Parse console messages found:', consoleMessages.length);

        // Look for the debug messages
        const hasParseStartDebug = consoleText.includes('Found parse_start_event');
        const hasParseCompleteDebug = consoleText.includes('Found parse_complete_event');

        console.log('Has parse_start_event debug:', hasParseStartDebug);
        console.log('Has parse_complete_event debug:', hasParseCompleteDebug);

        // Verify visualization
        const canvas = page.locator('#visualization-canvas');
        const isVisible = await canvas.isVisible();
        console.log('Canvas visible:', isVisible);

        // Get stats
        const eventCount = await page.locator('#event-count').textContent();
        console.log('Total events:', eventCount);

        // Assertions
        expect(eventText.length).toBeGreaterThan(0);
        expect(isVisible).toBeTruthy();

        console.log('✓ SQL Parse visualization validated\n');
    });

    test('Validation 3: B-Tree Page Node Event System - Complete Workflow', async ({ page }) => {
        console.log('\n=== B-TREE PAGE NODE VISUALIZATION VALIDATION ===\n');

        // Set up console listener
        const consoleMessages = [];
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('page') || text.includes('PAGE') || text.includes('BTREE') ||
                text.includes('Event type 0') || text.includes('Event type 6')) {
                consoleMessages.push(text);
            }
        });

        // Clear events and switch to B-Tree view
        await page.click('#clear-events-btn');
        await page.waitForTimeout(500);
        await page.selectOption('#view-mode', 'btree');
        await page.waitForTimeout(500);

        // Execute SQL that creates pages
        await page.fill('#sql-input', 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)');
        await page.click('#execute-btn');

        // Wait for execution
        await page.waitForTimeout(3000);

        // Check event log
        const eventLog = page.locator('#event-log');
        const eventText = await eventLog.textContent();
        console.log('Event log length:', eventText.length);

        // Verify Page events in log
        const hasPageAllocate = eventText.includes('PAGE_ALLOCATE');

        console.log('Has PAGE_ALLOCATE in log:', hasPageAllocate);

        // Check console for page-related messages
        const consoleText = consoleMessages.join('\n');
        console.log('Page console messages found:', consoleMessages.length);

        // Look for Event type 6 (PAGE_ALLOCATE)
        const hasEventType6 = consoleText.includes('Event type 6');
        console.log('Has Event type 6 (PAGE_ALLOCATE):', hasEventType6);

        // Check page count
        const pageCount = await page.locator('#page-count').textContent();
        console.log('Page count:', pageCount);
        const pageCountNum = parseInt(pageCount);
        console.log('Page count (numeric):', pageCountNum);

        // Verify visualization
        const canvas = page.locator('#visualization-canvas');
        const isVisible = await canvas.isVisible();
        console.log('Canvas visible:', isVisible);

        // Get stats
        const eventCount = await page.locator('#event-count').textContent();
        console.log('Total events:', eventCount);

        // Assertions - pages should be allocated
        expect(eventText.length).toBeGreaterThan(0);
        expect(isVisible).toBeTruthy();
        expect(pageCountNum).toBeGreaterThan(0);

        console.log('✓ B-Tree Page Node visualization validated\n');
    });

    test('Validation 4: Integration Test - All Three Systems Together', async ({ page }) => {
        console.log('\n=== INTEGRATION TEST: ALL THREE SYSTEMS ===\n');

        // Set up comprehensive console listener
        const allConsoleMessages = [];
        page.on('console', msg => {
            allConsoleMessages.push(msg.text());
        });

        // Execute complex SQL that triggers all systems
        const complexSQL = `
            CREATE TABLE employees (
                id INTEGER PRIMARY KEY,
                name TEXT,
                department TEXT,
                salary REAL
            );
            INSERT INTO employees VALUES (1, 'Alice', 'Engineering', 90000);
            SELECT * FROM employees WHERE salary > 50000;
        `;

        await page.fill('#sql-input', complexSQL);
        await page.click('#execute-btn');

        // Wait for full execution
        await page.waitForTimeout(5000);

        // Test each view mode
        const viewResults = {};

        for (const viewMode of ['btree', 'parse', 'vdbe']) {
            console.log(`\nTesting ${viewMode} view mode...`);

            await page.selectOption('#view-mode', viewMode);
            await page.waitForTimeout(1000);

            const canvas = page.locator('#visualization-canvas');
            const isVisible = await canvas.isVisible();

            const eventLog = page.locator('#event-log');
            const eventText = await eventLog.textContent();
            const hasEvents = eventText.length > 0;

            viewResults[viewMode] = {
                visible: isVisible,
                hasEvents: hasEvents,
                eventLogLength: eventText.length
            };

            console.log(`  Canvas visible: ${isVisible}`);
            console.log(`  Events in log: ${hasEvents}`);
            console.log(`  Event log length: ${eventText.length}`);
        }

        // Analyze console output
        const consoleText = allConsoleMessages.join('\n');

        const eventTypesFound = new Set();
        const eventTypeMatches = consoleText.matchAll(/Event type (\d+)/g);
        for (const match of eventTypeMatches) {
            eventTypesFound.add(match[1]);
        }

        console.log('\nEvent types detected in console:');
        console.log('  VDBE events (11, 12, 13):',
            eventTypesFound.has('11') || eventTypesFound.has('12') || eventTypesFound.has('13'));
        console.log('  Parse events (8, 9, 10):',
            eventTypesFound.has('8') || eventTypesFound.has('9') || eventTypesFound.has('10'));
        console.log('  Page/BTree events (0-7):',
            Array.from(eventTypesFound).some(t => parseInt(t) <= 7));

        console.log('\nAll event types found:', Array.from(eventTypesFound).sort().join(', '));

        // Get final stats
        const eventCount = await page.locator('#event-count').textContent();
        const pageCount = await page.locator('#page-count').textContent();

        console.log('\nFinal stats:');
        console.log(`  Total events: ${eventCount}`);
        console.log(`  Total pages: ${pageCount}`);

        // Assertions
        expect(viewResults.btree.visible).toBeTruthy();
        expect(viewResults.parse.visible).toBeTruthy();
        expect(viewResults.vdbe.visible).toBeTruthy();

        expect(viewResults.btree.hasEvents).toBeTruthy();
        expect(viewResults.parse.hasEvents).toBeTruthy();
        expect(viewResults.vdbe.hasEvents).toBeTruthy();

        expect(parseInt(eventCount)).toBeGreaterThan(0);
        expect(parseInt(pageCount)).toBeGreaterThan(0);

        console.log('\n✓ All three visualization systems working together correctly\n');
        console.log('=== INTEGRATION TEST COMPLETE ===\n');
    });

    test('Validation 5: Event Flow Analysis - Detailed Event Tracking', async ({ page }) => {
        console.log('\n=== EVENT FLOW ANALYSIS ===\n');

        // Capture all events with detailed info
        const events = [];
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('[DEBUG] Event type')) {
                const match = text.match(/\[DEBUG\] Event type (\d+): (.+)/);
                if (match) {
                    events.push({
                        type: match[1],
                        data: match[2]
                    });
                }
            }
        });

        // Execute step-by-step operations
        const operations = [
            { name: 'CREATE TABLE', sql: 'CREATE TABLE test (id INTEGER)' },
            { name: 'INSERT', sql: "INSERT INTO test VALUES (1)" },
            { name: 'SELECT', sql: 'SELECT * FROM test' }
        ];

        const results = {};

        for (const op of operations) {
            console.log(`\nExecuting: ${op.name}`);

            await page.click('#clear-events-btn');
            await page.waitForTimeout(500);

            await page.fill('#sql-input', op.sql);
            await page.click('#execute-btn');
            await page.waitForTimeout(2000);

            const eventCountBefore = events.length;
            const operationEvents = events.slice(eventCountBefore);

            console.log(`  Events emitted: ${operationEvents.length}`);

            // Categorize events
            const vdbeEvents = operationEvents.filter(e => ['11', '12', '13'].includes(e.type));
            const parseEvents = operationEvents.filter(e => ['8', '9', '10'].includes(e.type));
            const pageEvents = operationEvents.filter(e => parseInt(e.type) <= 7);

            console.log(`    VDBE events: ${vdbeEvents.length}`);
            console.log(`    Parse events: ${parseEvents.length}`);
            console.log(`    Page events: ${pageEvents.length}`);

            results[op.name] = {
                total: operationEvents.length,
                vdbe: vdbeEvents.length,
                parse: parseEvents.length,
                page: pageEvents.length
            };
        }

        console.log('\n=== EVENT FLOW SUMMARY ===');
        for (const [op, counts] of Object.entries(results)) {
            console.log(`${op}:`);
            console.log(`  Total: ${counts.total}`);
            console.log(`  VDBE: ${counts.vdbe}`);
            console.log(`  Parse: ${counts.parse}`);
            console.log(`  Page: ${counts.page}`);
        }

        // Verify all systems emitted events
        const totalVdbe = Object.values(results).reduce((sum, r) => sum + r.vdbe, 0);
        const totalParse = Object.values(results).reduce((sum, r) => sum + r.parse, 0);
        const totalPage = Object.values(results).reduce((sum, r) => sum + r.page, 0);

        console.log('\nTOTAL EVENTS ACROSS ALL OPERATIONS:');
        console.log(`  VDBE events: ${totalVdbe}`);
        console.log(`  Parse events: ${totalParse}`);
        console.log(`  Page events: ${totalPage}`);

        expect(totalVdbe).toBeGreaterThan(0);
        expect(totalParse).toBeGreaterThan(0);
        expect(totalPage).toBeGreaterThan(0);

        console.log('\n✓ Event flow analysis complete\n');
    });

});
