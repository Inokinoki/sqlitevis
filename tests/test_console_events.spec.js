const { test, expect } = require('@playwright/test');

test.describe('Console Events Test', () => {
    test('Capture console logs to see all events received from WASM', async ({ page }) => {
        console.log('=== Testing with Console Event Capture ===\n');

        // Capture all console messages
        const consoleMessages = [];
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('[EVENT RECEIVED]')) {
                consoleMessages.push(text);
            }
        });

        // Navigate to application
        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        const status = await page.locator('#db-status').textContent();
        console.log('Status:', status);

        if (status.includes('Ready')) {
            // Clear events
            await page.click('#clear-events-btn');
            await page.waitForTimeout(500);

            // Execute SQL
            console.log('Executing: CREATE TABLE test (id INTEGER)');
            await page.fill('#sql-input', 'CREATE TABLE test (id INTEGER)');
            await page.click('#execute-btn');
            await page.waitForTimeout(3000);

            // Print all console messages
            console.log('\n=== CONSOLE EVENT LOG ===');
            consoleMessages.forEach(msg => console.log(msg));
            console.log('=== END CONSOLE LOG ===\n');

            // Count events by type
            const eventCounts = {};
            consoleMessages.forEach(msg => {
                const match = msg.match(/\[EVENT RECEIVED\] (\w+)/);
                if (match) {
                    eventCounts[match[1]] = (eventCounts[match[1]] || 0) + 1;
                }
            });

            console.log('\n=== EVENT COUNTS ===');
            console.log('PARSE_START:', eventCounts.PARSE_START || 0);
            console.log('PARSE_TOKEN:', eventCounts.PARSE_TOKEN || 0);
            console.log('PARSE_COMPLETE:', eventCounts.PARSE_COMPLETE || 0);
            console.log('VDBE_START:', eventCounts.VDBE_START || 0);
            console.log('VDBE_OPCODE:', eventCounts.VDBE_OPCODE || 0);
            console.log('VDBE_COMPLETE:', eventCounts.VDBE_COMPLETE || 0);
            console.log('PAGE_ALLOCATE:', eventCounts.PAGE_ALLOCATE || 0);
        }
    });
});
