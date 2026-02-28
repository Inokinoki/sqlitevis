const { test, expect } = require('@playwright/test');

test.describe('Manual Parse Event Test', () => {
    test('Manually call parse event bridge functions', async ({ page }) => {
        console.log('=== Testing Manual Parse Event Invocation ===\n');

        // Navigate to application
        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        const status = await page.locator('#db-status').textContent();
        console.log('Status:', status);

        if (status.includes('Ready')) {
            // Clear events
            await page.click('#clear-events-btn');
            await page.waitForTimeout(500);

            // Try to manually call parse events through Module
            const result = await page.evaluate(() => {
                // Check if we can access the Module
                if (!window.Module || !window.Module._parse_start_event) {
                    return { error: 'parse_start_event not accessible', moduleExists: !!window.Module };
                }

                // Try calling parse_start_event directly
                try {
                    window.Module._parse_start_event('SELECT 1');
                    return { success: true, message: 'parse_start_event called' };
                } catch (e) {
                    return { error: e.message };
                }
            });

            console.log('Manual call result:', result);

            await page.waitForTimeout(1000);

            // Check DOM for events
            const eventLogHTML = await page.locator('#event-log').innerHTML();
            const hasParseStart = eventLogHTML.includes('PARSE_START');

            console.log('PARSE_START in DOM after manual call:', hasParseStart);

            if (!hasParseStart) {
                console.log('\n=== Checking Module properties ===');
                const moduleInfo = await page.evaluate(() => {
                    return {
                        moduleExists: typeof window.Module !== 'undefined',
                        moduleKeys: window.Module ? Object.keys(window.Module).filter(k => k.includes('parse')).slice(0, 10) : [],
                        has_cwrap: window.Module && typeof window.Module.cwrap === 'function',
                        has_ccall: window.Module && typeof window.Module.ccall === 'function'
                    };
                });
                console.log(JSON.stringify(moduleInfo, null, 2));
            }
        }
    });
});
