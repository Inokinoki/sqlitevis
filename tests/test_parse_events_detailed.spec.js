const { test, expect } = require('@playwright/test');

test.describe('Parse Events Detailed Test', () => {
    test('Should capture PARSE_START, PARSE_TOKEN, and PARSE_COMPLETE events', async ({ page }) => {
        console.log('Testing Parse Events in Detail...');

        // Navigate to the application
        await page.goto('http://localhost:8080/index.html');

        // Wait for initialization
        await page.waitForTimeout(5000);

        // Check current status
        const statusElement = page.locator('#db-status');
        const statusText = await statusElement.textContent();
        console.log('Current status:', statusText);

        if (statusText.includes('Ready')) {
            // Clear events first
            await page.click('#clear-events-btn');
            await page.waitForTimeout(500);

            // Execute a simple SQL command
            console.log('Executing: SELECT 1');
            await page.fill('#sql-input', 'SELECT 1');
            await page.click('#execute-btn');

            // Wait for events to be processed
            await page.waitForTimeout(5000);

            // Get the entire event log HTML
            const eventLog = page.locator('#event-log');
            const eventHTML = await eventLog.innerHTML();
            const eventText = await eventLog.textContent();

            console.log('\n=== EVENT LOG START ===');
            console.log(eventText);
            console.log('\n=== EVENT LOG END ===\n');

            // Save event log to file
            const fs = require('fs');
            fs.writeFileSync('event_log_output.txt', eventText);
            fs.writeFileSync('event_log_html.html', eventHTML);

            // Check for all event types
            const hasVdbeStart = eventText.includes('VDBE_START');
            const hasVdbeOpcode = eventText.includes('VDBE_OPCODE');
            const hasVdbeComplete = eventText.includes('VDBE_COMPLETE');
            const hasParseStart = eventText.includes('PARSE_START');
            const hasParseToken = eventText.includes('PARSE_TOKEN');
            const hasParseComplete = eventText.includes('PARSE_COMPLETE');
            const hasPageAllocate = eventText.includes('PAGE_ALLOCATE');

            console.log('\n=== EVENT DETECTION RESULTS ===');
            console.log(`VDBE_START: ${hasVdbeStart ? '✓' : '✗'}`);
            console.log(`VDBE_OPCODE: ${hasVdbeOpcode ? '✓' : '✗'}`);
            console.log(`VDBE_COMPLETE: ${hasVdbeComplete ? '✓' : '✗'}`);
            console.log(`PARSE_START: ${hasParseStart ? '✓' : '✗'}`);
            console.log(`PARSE_TOKEN: ${hasParseToken ? '✓' : '✗'}`);
            console.log(`PARSE_COMPLETE: ${hasParseComplete ? '✓' : '✗'}`);
            console.log(`PAGE_ALLOCATE: ${hasPageAllocate ? '✓' : '✗'}`);

            // Count events
            const countVdbeStart = (eventText.match(/VDBE_START/g) || []).length;
            const countVdbeOpcode = (eventText.match(/VDBE_OPCODE/g) || []).length;
            const countParseStart = (eventText.match(/PARSE_START/g) || []).length;
            const countParseToken = (eventText.match(/PARSE_TOKEN/g) || []).length;
            const countParseComplete = (eventText.match(/PARSE_COMPLETE/g) || []).length;

            console.log('\n=== EVENT COUNTS ===');
            console.log(`VDBE_START: ${countVdbeStart}`);
            console.log(`VDBE_OPCODE: ${countVdbeOpcode}`);
            console.log(`PARSE_START: ${countParseStart}`);
            console.log(`PARSE_TOKEN: ${countParseToken}`);
            console.log(`PARSE_COMPLETE: ${countParseComplete}`);

            // Take screenshot
            await page.screenshot({ path: 'parse_events_test_screenshot.png' });
            console.log('\nScreenshot saved to parse_events_test_screenshot.png');
            console.log('Event log saved to event_log_output.txt');

        } else {
            console.log('Application not ready:', statusText);
        }
    });
});
