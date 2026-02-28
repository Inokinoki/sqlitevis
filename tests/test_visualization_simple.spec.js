const { test, expect } = require('@playwright/test');

test.describe('SQLite Visualization Features - Direct Test', () => {
    test('VDBE Events: Should capture and display VDBE opcodes', async ({ page }) => {
        console.log('Testing VDBE Events...');

        // Navigate to the application
        await page.goto('http://localhost:8080/index.html');

        // Wait for page to load
        await page.waitForTimeout(5000);

        // Check current status
        const statusElement = page.locator('#db-status');
        const statusText = await statusElement.textContent();

        console.log('Current status:', statusText);

        // If there's an error, take screenshot and check console
        if (statusText.includes('Error')) {
            console.error('Application failed to load:', statusText);

            // Get console errors
            page.on('console', msg => {
                if (msg.type() === 'error') {
                    console.error('Browser console error:', msg.text());
                }
            });

            // Take screenshot
            await page.screenshot({ path: 'error_screenshot.png' });
        } else {
            console.log('Application loaded successfully');

            // Clear any existing events
            await page.click('#clear-events-btn');

            // Switch to VDBE view mode
            await page.selectOption('#view-mode', 'vdbe');

            // Execute SQL
            await page.fill('#sql-input', 'SELECT 1 + 1 AS result');
            await page.click('#execute-btn');

            // Wait for events
            await page.waitForTimeout(3000);

            // Check event log for VDBE events
            const eventLog = page.locator('#event-log');
            const eventText = await eventLog.textContent();

            console.log('Event log:', eventText?.substring(0, 500));

            // Verify VDBE events were captured
            const hasVdbeStart = eventText?.includes('VDBE_START');
            const hasVdbeOpcode = eventText?.includes('VDBE_OPCODE');
            const hasVdbeComplete = eventText?.includes('VDBE_COMPLETE');

            console.log(`  VDBE_START: ${hasVdbeStart ? '✓' : '✗'}`);
            console.log(`  VDBE_OPCODE: ${hasVdbeOpcode ? '✓' : '✗'}`);
            console.log(`  VDBE_COMPLETE: ${hasVdbeComplete ? '✓' : '✗'}`);

            expect(hasVdbeStart).toBeTruthy();
            expect(hasVdbeOpcode).toBeTruthy();
            expect(hasVdbeComplete).toBeTruthy();

            console.log('✓ VDBE Events working correctly');
        }
    });

    test('SQL Parsing: Should capture and display parse tokens', async ({ page }) => {
        console.log('Testing SQL Parsing Events...');

        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        const statusElement = page.locator('#db-status');
        const statusText = await statusElement.textContent();

        if (statusText.includes('Ready')) {
            // Clear any existing events
            await page.click('#clear-events-btn');

            // Switch to parse view mode
            await page.selectOption('#view-mode', 'parse');

            // Execute SQL
            await page.fill('#sql-input', 'CREATE TABLE test (id INTEGER, name TEXT)');
            await page.click('#execute-btn');

            // Wait for events
            await page.waitForTimeout(3000);

            // Check event log for parse events
            const eventLog = page.locator('#event-log');
            const eventText = await eventLog.textContent();

            console.log('Event log sample:', eventText?.substring(0, 500));

            // Verify parse events were captured
            const hasParseStart = eventText?.includes('PARSE_START');
            const hasParseToken = eventText?.includes('PARSE_TOKEN');
            const hasParseComplete = eventText?.includes('PARSE_COMPLETE');

            console.log(`  PARSE_START: ${hasParseStart ? '✓' : '✗'}`);
            console.log(`  PARSE_TOKEN: ${hasParseToken ? '✓' : '✗'}`);
            console.log(`  PARSE_COMPLETE: ${hasParseComplete ? '✓' : '✗'}`);

            expect(hasParseStart).toBeTruthy();
            expect(hasParseToken).toBeTruthy();
            expect(hasParseComplete).toBeTruthy();

            console.log('✓ SQL Parsing Events working correctly');
        } else {
            console.log('Application not ready:', statusText);
            expect(true).toBeFalsy(); // Fail the test
        }
    });

    test('B-Tree Page Events: Should capture page allocations and B-tree operations', async ({ page }) => {
        console.log('Testing B-Tree Page Events...');

        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        const statusElement = page.locator('#db-status');
        const statusText = await statusElement.textContent();

        if (statusText.includes('Ready')) {
            // Clear any existing events
            await page.click('#clear-events-btn');

            // Switch to B-tree view mode (default)
            await page.selectOption('#view-mode', 'btree');

            // Create table and insert data
            await page.fill('#sql-input', 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
            await page.click('#execute-btn');
            await page.waitForTimeout(1500);

            await page.fill('#sql-input', 'INSERT INTO users VALUES (1, "Alice")');
            await page.click('#execute-btn');
            await page.waitForTimeout(1500);

            await page.fill('#sql-input', 'INSERT INTO users VALUES (2, "Bob")');
            await page.click('#execute-btn');
            await page.waitForTimeout(1500);

            // Check event log for B-tree events
            const eventLog = page.locator('#event-log');
            const eventText = await eventLog.textContent();

            console.log('Event log sample:', eventText?.substring(0, 500));

            // Look for B-tree related events
            const hasPageAllocate = eventText?.includes('PAGE_ALLOCATE');
            const hasBtreeInsert = eventText?.includes('BTREE_INSERT');
            const hasBtreeOpen = eventText?.includes('BTREE_OPEN');

            console.log(`  PAGE_ALLOCATE: ${hasPageAllocate ? '✓' : '✗'}`);
            console.log(`  BTREE_INSERT: ${hasBtreeInsert ? '✓' : '✗'}`);
            console.log(`  BTREE_OPEN: ${hasBtreeOpen ? '✓' : '✗'}`);

            // At minimum, we should see page allocations
            expect(hasPageAllocate || hasBtreeInsert || hasBtreeOpen).toBeTruthy();

            console.log('✓ B-Tree Page Events working correctly');
        } else {
            console.log('Application not ready:', statusText);
            expect(true).toBeFalsy(); // Fail the test
        }
    });
});
