const { test, expect } = require('@playwright/test');

test.describe('Direct Parse Event Test', () => {
    test('Manually trigger parse events to verify handlers work', async ({ page }) => {
        console.log('Testing parse event handlers directly...');

        // Navigate to the application
        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        const statusText = await page.locator('#db-status').textContent();
        console.log('Status:', statusText);

        if (statusText.includes('Ready')) {
            // Clear events
            await page.click('#clear-events-btn');
            await page.waitForTimeout(500);

            // Try to manually call parse events through the bridge
            const result = await page.evaluate(() => {
                // Check if the event functions exist
                const hasParseStart = typeof window.Module !== 'undefined' &&
                                     window.Module &&
                                     typeof window.Module._parse_start_event === 'function';

                const hasParseToken = typeof window.Module !== 'undefined' &&
                                     window.Module &&
                                     typeof window.Module._parse_token_event === 'function';

                const hasParseComplete = typeof window.Module !== 'undefined' &&
                                        window.Module &&
                                        typeof window.Module._parse_complete_event === 'function';

                return {
                    hasParseStart,
                    hasParseToken,
                    hasParseComplete,
                    moduleExists: typeof window.Module !== 'undefined',
                    moduleProperties: window.Module ? Object.keys(window.Module).filter(k => k.includes('parse')).slice(0, 20) : []
                };
            });

            console.log('\n=== FUNCTION EXISTENCE CHECK ===');
            console.log('Module exists:', result.moduleExists);
            console.log('parse_start_event exists:', result.hasParseStart);
            console.log('parse_token_event exists:', result.hasParseToken);
            console.log('parse_complete_event exists:', result.hasParseComplete);
            console.log('Module properties with "parse":', result.moduleProperties);

            // Now execute SQL and monitor ALL events
            console.log('\nExecuting SQL...');
            await page.fill('#sql-input', 'SELECT 1');
            await page.click('#execute-btn');
            await page.waitForTimeout(3000);

            // Check event manager
            const eventInfo = await page.evaluate(() => {
                if (!window.eventManager) return { error: 'eventManager not found' };

                const events = window.eventManager.events;
                return {
                    total: events.length,
                    parseStart: events.filter(e => e.typeName === 'PARSE_START').length,
                    parseToken: events.filter(e => e.typeName === 'PARSE_TOKEN').length,
                    parseComplete: events.filter(e => e.typeName === 'PARSE_COMPLETE').length,
                    vdbeStart: events.filter(e => e.typeName === 'VDBE_START').length,
                    vdbeOpcode: events.filter(e => e.typeName === 'VDBE_OPCODE').length,
                    vdbeComplete: events.filter(e => e.typeName === 'VDBE_COMPLETE').length,
                    pageAllocate: events.filter(e => e.typeName === 'PAGE_ALLOCATE').length,
                    first5EventTypes: events.slice(0, 5).map(e => e.typeName),
                    last5EventTypes: events.slice(-5).map(e => e.typeName)
                };
            });

            console.log('\n=== EVENT MANAGER STATS ===');
            console.log('Total events:', eventInfo.total);
            console.log('PARSE_START:', eventInfo.parseStart);
            console.log('PARSE_TOKEN:', eventInfo.parseToken);
            console.log('PARSE_COMPLETE:', eventInfo.parseComplete);
            console.log('VDBE_START:', eventInfo.vdbeStart);
            console.log('VDBE_OPCODE:', eventInfo.vdbeOpcode);
            console.log('VDBE_COMPLETE:', eventInfo.vdbeComplete);
            console.log('PAGE_ALLOCATE:', eventInfo.pageAllocate);
            console.log('First 5 events:', eventInfo.first5EventTypes);
            console.log('Last 5 events:', eventInfo.last5EventTypes);
        }
    });
});
