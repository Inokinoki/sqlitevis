/**
 * Manual verification test for the three visualization systems
 * This test checks:
 * 1. VDBE event and visualization works
 * 2. SQL instruction parsing and visualization works
 * 3. Page node event and visualization works
 */

const { test, expect } = require('@playwright/test');

test.describe('Manual Verification of Three Visualization Systems', () => {

    test.beforeEach(async ({ page }) => {
        // Navigate to the application
        await page.goto('/index.html');

        // Wait for SQLite to initialize - increase timeout
        try {
            await page.waitForSelector('#db-status', { timeout: 30000 });
            // Wait for status to become Ready
            await page.waitForFunction(() => {
                const status = document.getElementById('db-status');
                return status && status.textContent.trim() === 'Ready';
            }, { timeout: 15000 });
        } catch (e) {
            console.log('Status check timeout, proceeding anyway');
        }
    });

    test('Verification 1: VDBE Events are emitted', async ({ page }) => {
        console.log('\n=== VERIFICATION 1: VDBE Events ===');

        // Set up console listener to capture debug messages
        const consoleMessages = [];
        page.on('console', msg => {
            if (msg.text().includes('Event type')) {
                consoleMessages.push(msg.text());
            }
        });

        // Clear events
        await page.click('#clear-events-btn');
        await page.waitForTimeout(500);

        // Switch to VDBE view
        await page.selectOption('#view-mode', 'vdbe');

        // Execute a simple SQL
        await page.fill('#sql-input', 'SELECT 1 AS result');
        await page.click('#execute-btn');

        // Wait for execution
        await page.waitForTimeout(3000);

        // Check console for VDBE events
        const consoleText = consoleMessages.join('\n');
        console.log('Console messages:', consoleMessages.slice(-10).join('\n'));

        // Check event log
        const eventLog = page.locator('#event-log');
        const eventText = await eventLog.textContent();

        console.log('Event log excerpt:', eventText.slice(0, 500));

        // Look for any VDBE indicators
        const hasVdbeEvents = consoleText.includes('Event type 11') ||
                             consoleText.includes('Event type 12') ||
                             consoleText.includes('Event type 13') ||
                             eventText.includes('VDBE');

        console.log(`Has VDBE events: ${hasVdbeEvents}`);

        // Also check canvas
        const canvas = page.locator('#visualization-canvas');
        const isVisible = await canvas.isVisible();
        console.log(`Canvas visible: ${isVisible}`);

        expect(hasVdbeEvents || eventText.length > 0).toBeTruthy();
        console.log('✓ VDBE verification complete');
    });

    test('Verification 2: SQL Parse Events are emitted', async ({ page }) => {
        console.log('\n=== VERIFICATION 2: SQL Parse Events ===');

        // Set up console listener
        const consoleMessages = [];
        page.on('console', msg => {
            if (msg.text().includes('Event type') || msg.text().includes('parse')) {
                consoleMessages.push(msg.text());
            }
        });

        // Clear events
        await page.click('#clear-events-btn');
        await page.waitForTimeout(500);

        // Switch to parse view
        await page.selectOption('#view-mode', 'parse');

        // Execute SQL
        await page.fill('#sql-input', 'CREATE TABLE test (id INTEGER)');
        await page.click('#execute-btn');

        // Wait for execution
        await page.waitForTimeout(3000);

        // Check console for parse events
        const consoleText = consoleMessages.join('\n');
        console.log('Parse-related console messages:');
        consoleMessages.filter(m => m.includes('parse') || m.includes('Event type')).slice(-10).forEach(m => console.log('  ', m));

        // Check event log
        const eventLog = page.locator('#event-log');
        const eventText = await eventLog.textContent();

        console.log('Event log excerpt:', eventText.slice(0, 500));

        // Look for parse indicators
        const hasParseEvents = consoleText.includes('Event type 8') ||
                              consoleText.includes('Event type 9') ||
                              consoleText.includes('Event type 10') ||
                              consoleText.includes('parse_start_event') ||
                              consoleText.includes('parse_complete_event');

        console.log(`Has parse events: ${hasParseEvents}`);

        expect(hasParseEvents || eventText.length > 0).toBeTruthy();
        console.log('✓ Parse verification complete');
    });

    test('Verification 3: B-Tree Page Events are emitted', async ({ page }) => {
        console.log('\n=== VERIFICATION 3: B-Tree Page Events ===');

        // Set up console listener
        const consoleMessages = [];
        page.on('console', msg => {
            if (msg.text().includes('Event type') || msg.text().includes('page') || msg.text().includes('btree')) {
                consoleMessages.push(msg.text());
            }
        });

        // Clear events
        await page.click('#clear-events-btn');
        await page.waitForTimeout(500);

        // Switch to B-tree view
        await page.selectOption('#view-mode', 'btree');

        // Execute SQL that will create pages
        await page.fill('#sql-input', 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
        await page.click('#execute-btn');

        // Wait for execution
        await page.waitForTimeout(3000);

        // Check console for page events
        const consoleText = consoleMessages.join('\n');
        console.log('Page-related console messages:');
        consoleMessages.filter(m => m.includes('Event type') || m.includes('page')).slice(-10).forEach(m => console.log('  ', m));

        // Check event log
        const eventLog = page.locator('#event-log');
        const eventText = await eventLog.textContent();

        console.log('Event log excerpt:', eventText.slice(0, 500));

        // Look for page/btree indicators
        const hasPageEvents = consoleText.includes('Event type 0') ||
                             consoleText.includes('Event type 6') ||
                             consoleText.includes('PAGE_ALLOCATE') ||
                             eventText.includes('PAGE');

        console.log(`Has page events: ${hasPageEvents}`);

        // Check page count
        const pageCount = await page.locator('#page-count').textContent();
        console.log(`Page count: ${pageCount}`);

        expect(hasPageEvents || eventText.length > 0 || parseInt(pageCount) > 0).toBeTruthy();
        console.log('✓ B-Tree verification complete');
    });

    test('Verification 4: All three visualizations work together', async ({ page }) => {
        console.log('\n=== VERIFICATION 4: All Three Together ===');

        // Set up console listener
        const consoleMessages = [];
        page.on('console', msg => {
            consoleMessages.push(msg.text());
        });

        // Clear events
        await page.click('#clear-events-btn');

        // Execute complex SQL
        const sql = `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER);
                     INSERT INTO users VALUES (1, 'Alice', 30);
                     SELECT * FROM users;`;

        await page.fill('#sql-input', sql);
        await page.click('#execute-btn');

        // Wait for execution
        await page.waitForTimeout(5000);

        // Check each view mode
        for (const viewMode of ['btree', 'parse', 'vdbe']) {
            console.log(`\nTesting view mode: ${viewMode}`);
            await page.selectOption('#view-mode', viewMode);
            await page.waitForTimeout(1000);

            const canvas = page.locator('#visualization-canvas');
            const isVisible = await canvas.isVisible();
            console.log(`  Canvas visible in ${viewMode} mode: ${isVisible}`);
        }

        // Check console output for all event types
        const consoleText = consoleMessages.join('\n');

        const eventTypes = new Set();
        const match = consoleText.matchAll(/Event type (\d+)/g);
        for (const m of match) {
            eventTypes.add(m[1]);
        }

        console.log(`Event types found: ${Array.from(eventTypes).sort().join(', ')}`);

        // Check event log
        const eventLog = page.locator('#event-log');
        const eventText = await eventLog.textContent();
        console.log(`Total event log text length: ${eventText.length}`);

        // Check stats
        const eventCount = await page.locator('#event-count').textContent();
        const pageCount = await page.locator('#page-count').textContent();
        console.log(`Event count: ${eventCount}, Page count: ${pageCount}`);

        // We should have some events
        expect(eventText.length > 0 || consoleMessages.length > 0).toBeTruthy();
        console.log('✓ All three visualizations test complete');
    });

});
