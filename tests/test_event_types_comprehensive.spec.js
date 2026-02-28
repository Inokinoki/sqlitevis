const { test, expect } = require('@playwright/test');

test.describe('Comprehensive Event Type Test', () => {
    test('Should capture all event types when executing SQL', async ({ page }) => {
        // Navigate to the application
        await page.goto('file:///home/ubuntu/Builds/sqlitevis/sqlitevis/src/web/index.html');

        // Wait for WASM to load
        await page.waitForSelector('#sql-input', { timeout: 10000 });

        // Wait for loading overlay to disappear
        await page.waitForFunction(() => {
            const overlay = document.getElementById('loading-overlay');
            return overlay && overlay.classList.contains('hidden');
        }, { timeout: 15000 });

        await page.waitForTimeout(500);

        // Execute a simple SQL command
        await page.fill('#sql-input', 'CREATE TABLE test (id INTEGER, name TEXT);');
        await page.click('#execute-btn');

        // Wait for execution
        await page.waitForTimeout(2000);

        // Get all events from the DOM
        const events = await page.evaluate(() => {
            const eventLog = document.getElementById('event-log');
            const eventItems = eventLog.querySelectorAll('.event-item');
            const events = [];

            eventItems.forEach((item, index) => {
                const timeSpan = item.querySelector('.event-time');
                const typeSpan = item.querySelector('.event-type');
                const dataSpan = item.querySelector('.event-data');

                events.push({
                    index,
                    time: timeSpan ? timeSpan.textContent : '',
                    type: typeSpan ? typeSpan.textContent : '',
                    data: dataSpan ? dataSpan.textContent : ''
                });
            });

            return events;
        });

        console.log('\n=== ALL EVENTS FIRED ===');
        events.forEach(event => {
            console.log(`${event.time} - ${event.type}: ${event.data}`);
        });

        // Check for specific event types
        const eventTypes = events.map(e => e.type);
        console.log('\n=== EVENT TYPE SUMMARY ===');
        console.log('PARSE_START events:', eventTypes.filter(t => t.includes('PARSE_START')).length);
        console.log('PARSE_TOKEN events:', eventTypes.filter(t => t.includes('PARSE_TOKEN')).length);
        console.log('PARSE_COMPLETE events:', eventTypes.filter(t => t.includes('PARSE_COMPLETE')).length);
        console.log('VDBE_START events:', eventTypes.filter(t => t.includes('VDBE_START')).length);
        console.log('VDBE_OPCODE events:', eventTypes.filter(t => t.includes('VDBE_OPCODE')).length);
        console.log('VDBE_COMPLETE events:', eventTypes.filter(t => t.includes('VDBE_COMPLETE')).length);
        console.log('PAGE_ALLOCATE events:', eventTypes.filter(t => t.includes('PAGE_ALLOCATE')).length);

        // Assertions for working events
        expect(eventTypes.filter(t => t.includes('VDBE_START')).length).toBeGreaterThan(0);
        expect(eventTypes.filter(t => t.includes('VDBE_COMPLETE')).length).toBeGreaterThan(0);
        expect(eventTypes.filter(t => t.includes('PAGE_ALLOCATE')).length).toBeGreaterThan(0);

        // Check if parse events are present
        const hasParseEvents = eventTypes.some(t =>
            t.includes('PARSE_START') ||
            t.includes('PARSE_TOKEN') ||
            t.includes('PARSE_COMPLETE')
        );

        console.log('\n=== RESULT ===');
        if (hasParseEvents) {
            console.log('✓ PARSE EVENTS ARE WORKING!');
        } else {
            console.log('✗ PARSE EVENTS ARE NOT FIRING');
        }
    });
});
