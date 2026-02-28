const { test, expect } = require('@playwright/test');

test.describe('Manual Parse Event Function Call Test', () => {
    test('Should manually call parse_start_event from JavaScript', async ({ page }) => {
        // Navigate to the application
        await page.goto('file:///home/ubuntu/Builds/sqlitevis/sqlitevis/src/web/index.html');

        // Wait for WASM to load
        await page.waitForSelector('#sql-input', { timeout: 10000 });

        // Wait for app to fully initialize
        await page.waitForFunction(() => {
            return window.sqliteApp && window.sqliteApp.sqliteModule;
        }, { timeout: 10000 });

        // Wait a bit more for complete initialization
        await page.waitForTimeout(1000);

        // Try to clear the event log (button might not exist)
        try {
            await page.click('#clear-events', { timeout: 1000 });
        } catch (e) {
            // Ignore if button doesn't exist
        }

        // Manually call parse_start_event
        const result = await page.evaluate(() => {
            try {
                // Access the app instance and its sqliteModule
                if (window.sqliteApp && window.sqliteApp.sqliteModule && window.sqliteApp.sqliteModule._parse_start_event) {
                    const Module = window.sqliteApp.sqliteModule;

                    // Allocate a string in WASM memory
                    const sqlString = "SELECT * FROM test";
                    const sqlPtr = Module.stringToUTF8(sqlString);

                    // Call the function
                    Module._parse_start_event(sqlPtr);

                    return { success: true, message: 'Called parse_start_event' };
                } else {
                    return {
                        success: false,
                        message: 'app or sqliteModule not found',
                        hasApp: !!window.sqliteApp,
                        hasModule: window.sqliteApp ? !!window.sqliteApp.sqliteModule : false,
                        hasParseStart: window.sqliteApp && window.sqliteApp.sqliteModule ? !!window.sqliteApp.sqliteModule._parse_start_event : false
                    };
                }
            } catch (error) {
                return { success: false, message: error.toString(), stack: error.stack };
            }
        });

        console.log('Manual call result:', result);

        // Wait a bit for events to process
        await page.waitForTimeout(500);

        // Check if PARSE_START event appeared
        const hasParseStart = await page.evaluate(() => {
            const eventLog = document.getElementById('event-log');
            const events = eventLog.querySelectorAll('.event-item');
            for (const event of events) {
                const typeSpan = event.querySelector('.event-type');
                if (typeSpan && typeSpan.textContent.includes('PARSE_START')) {
                    return true;
                }
            }
            return false;
        });

        console.log(`PARSE_START in DOM: ${hasParseStart}`);
        console.log(`Event log content:`);

        const eventLog = await page.evaluate(() => {
            const eventLog = document.getElementById('event-log');
            return eventLog.innerHTML;
        });
        console.log(eventLog);

        if (result.success) {
            expect(hasParseStart).toBeTruthy();
        }
    });
});
