const { test, expect } = require('@playwright/test');

test.describe('Parse Events with Debug', () => {
    test('Should capture parse events with debug mode enabled', async ({ page }) => {
        console.log('Testing Parse Events with Debug Mode...');

        // Enable console logging
        page.on('console', msg => {
            if (msg.text().includes('PARSE') || msg.text().includes('[PARSE_START]') || msg.text().includes('[PARSE_TOKEN]') || msg.text().includes('[PARSE_COMPLETE]')) {
                console.log('BROWSER:', msg.text());
            }
        });

        // Navigate to the application
        await page.goto('http://localhost:8080/index.html');

        // Wait for initialization
        await page.waitForTimeout(5000);

        // Check current status
        const statusElement = page.locator('#db-status');
        const statusText = await statusElement.textContent();
        console.log('Current status:', statusText);

        if (statusText.includes('Ready')) {
            // Enable debug mode in the app
            await page.evaluate(() => {
                if (window.app) {
                    window.app.setDebugMode(true);
                    console.log('Debug mode enabled');
                }
            });

            // Clear events first
            await page.click('#clear-events-btn');
            await page.waitForTimeout(500);

            // Execute a simple SQL command
            console.log('Executing: SELECT 1');
            await page.fill('#sql-input', 'SELECT 1');
            await page.click('#execute-btn');

            // Wait for events to be processed
            await page.waitForTimeout(3000);

            // Get the entire event log
            const eventLog = page.locator('#event-log');
            const eventText = await eventLog.textContent();

            console.log('\n=== EVENT LOG ===');
            console.log(eventText || '(empty)');
            console.log('=== END LOG ===\n');

            // Check for parse events
            const hasParseStart = eventText.includes('PARSE_START');
            const hasParseToken = eventText.includes('PARSE_TOKEN');
            const hasParseComplete = eventText.includes('PARSE_COMPLETE');

            console.log(`PARSE_START: ${hasParseStart ? '✓' : '✗'}`);
            console.log(`PARSE_TOKEN: ${hasParseToken ? '✓' : '✗'}`);
            console.log(`PARSE_COMPLETE: ${hasParseComplete ? '✓' : '✗'}`);

            // Also check event manager directly
            const eventCount = await page.evaluate(() => {
                if (window.eventManager) {
                    return {
                        total: window.eventManager.events.length,
                        parseStart: window.eventManager.events.filter(e => e.typeName === 'PARSE_START').length,
                        parseToken: window.eventManager.events.filter(e => e.typeName === 'PARSE_TOKEN').length,
                        parseComplete: window.eventManager.events.filter(e => e.typeName === 'PARSE_COMPLETE').length
                    };
                }
                return null;
            });

            if (eventCount) {
                console.log('\n=== EVENT MANAGER COUNTS ===');
                console.log(`Total events: ${eventCount.total}`);
                console.log(`PARSE_START: ${eventCount.parseStart}`);
                console.log(`PARSE_TOKEN: ${eventCount.parseToken}`);
                console.log(`PARSE_COMPLETE: ${eventCount.parseComplete}`);
            }
        }
    });
});
