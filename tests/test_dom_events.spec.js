const { test, expect } = require('@playwright/test');

test.describe('DOM Events Test', () => {
    test('Check DOM directly for parse events', async ({ page }) => {
        console.log('=== Testing DOM Event Log Directly ===\n');

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
            console.log('Executing: SELECT 1');
            await page.fill('#sql-input', 'SELECT 1');
            await page.click('#execute-btn');
            await page.waitForTimeout(3000);

            // Get event log directly from DOM
            const eventLogHTML = await page.locator('#event-log').innerHTML();
            const eventLogText = await page.locator('#event-log').textContent();

            console.log('\n=== EVENT LOG TEXT ===');
            console.log(eventLogText);
            console.log('\n=== EVENT LOG HTML (first 2000 chars) ===');
            console.log(eventLogHTML.substring(0, 2000));

            // Check for specific events
            const hasVdbeStart = eventLogHTML.includes('VDBE_START');
            const hasParseStart = eventLogHTML.includes('PARSE_START');
            const hasParseToken = eventLogHTML.includes('PARSE_TOKEN');
            const hasParseComplete = eventLogHTML.includes('PARSE_COMPLETE');

            console.log('\n=== EVENT DETECTION IN DOM ===');
            console.log('VDBE_START in DOM:', hasVdbeStart);
            console.log('PARSE_START in DOM:', hasParseStart);
            console.log('PARSE_TOKEN in DOM:', hasParseToken);
            console.log('PARSE_COMPLETE in DOM:', hasParseComplete);

            // Count event-item divs
            const eventCount = await page.locator('#event-log .event-item').count();
            console.log('\nTotal event items in DOM:', eventCount);

            // Get first 10 event types
            const first10Types = await page.locator('#event-log .event-item .event-type').allTextContents();
            console.log('\nFirst 10 event types:');
            first10Types.slice(0, 10).forEach((t, i) => console.log(`  ${i+1}. ${t}`));
        }
    });
});
