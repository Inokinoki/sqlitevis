const { test, expect } = require('@playwright/test');

test.describe('Parse Events Without Clear', () => {
    test('Check for parse events without clearing log', async ({ page }) => {
        console.log('=== Testing Parse Events (No Clear) ===\n');

        // Navigate to application
        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        const status = await page.locator('#db-status').textContent();
        console.log('Status:', status);

        if (status.includes('Ready')) {
            // DO NOT clear events - check what's already there
            const eventLogHTML = await page.locator('#event-log').innerHTML();

            // Count ALL events
            const hasParseStart = eventLogHTML.includes('PARSE_START');
            const hasParseToken = eventLogHTML.includes('PARSE_TOKEN');
            const hasParseComplete = eventLogHTML.includes('PARSE_COMPLETE');

            console.log('PARSE_START in DOM (before execution):', hasParseStart);
            console.log('PARSE_TOKEN in DOM (before execution):', hasParseToken);
            console.log('PARSE_COMPLETE in DOM (before execution):', hasParseComplete);

            const eventCount = await page.locator('#event-log .event-item').count();
            console.log('Total events in DOM (before execution):', eventCount);

            // Now execute SQL
            console.log('\nExecuting: SELECT 1');
            await page.fill('#sql-input', 'SELECT 1');
            await page.click('#execute-btn');
            await page.waitForTimeout(3000);

            // Check again
            const eventLogHTML2 = await page.locator('#event-log').innerHTML();
            const hasParseStart2 = eventLogHTML2.includes('PARSE_START');
            const hasParseToken2 = eventLogHTML2.includes('PARSE_TOKEN');
            const hasParseComplete2 = eventLogHTML2.includes('PARSE_COMPLETE');

            console.log('\nAfter execution:');
            console.log('PARSE_START in DOM:', hasParseStart2);
            console.log('PARSE_TOKEN in DOM:', hasParseToken2);
            console.log('PARSE_COMPLETE in DOM:', hasParseComplete2);

            const eventCount2 = await page.locator('#event-log .event-item').count();
            console.log('Total events in DOM:', eventCount2);

            // Get all event types
            const allEventTypes = await page.locator('#event-log .event-type').allTextContents();
            console.log('\n=== ALL EVENT TYPES IN DOM ===');
            const uniqueTypes = [...new Set(allEventTypes)];
            uniqueTypes.forEach(type => console.log(`  - ${type}`));
            console.log(`\nTotal unique event types: ${uniqueTypes.length}`);
        }
    });
});
