const { test, expect } = require('@playwright/test');

test('Debug Parse Events', async ({ page }) => {
    // Capture console messages
    const consoleMessages = [];
    page.on('console', msg => {
        const text = msg.text();
        consoleMessages.push(text);
        // Print debug messages in real-time
        if (text.includes('[DEBUG]') || text.includes('parse')) {
            console.log(`[CONSOLE] ${text}`);
        }
    });

    // Navigate using file:// protocol like the working tests
    await page.goto('file:///home/ubuntu/Builds/sqlitevis/sqlitevis/src/web/index.html');

    // Wait for page load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Check if WASM loaded
    const wasmLoaded = await page.evaluate(() => {
        return typeof window.sqlite3 !== 'undefined';
    });

    console.log(`WASM loaded: ${wasmLoaded}`);

    if (!wasmLoaded) {
        console.log('WASM not loaded, waiting...');
        await page.waitForTimeout(3000);
    }

    // Execute SQL using the working approach
    await page.evaluate(async () => {
        const result = await window.sqlite3.exec(`
            SELECT 1 + 1 AS result;
        `);
        return result;
    });

    // Wait for events to propagate
    await page.waitForTimeout(3000);

    // Print all console messages
    console.log('\n=== ALL CONSOLE MESSAGES ===');
    consoleMessages.forEach(msg => {
        console.log(msg);
    });
    console.log('=== END ===\n');

    // Check for parse_complete_event debug message
    const hasParseComplete = consoleMessages.some(msg =>
        msg.includes('[DEBUG] Found parse_complete_event')
    );

    console.log(`\n✓ Parse complete event detected: ${hasParseComplete}`);

    // Count events by type
    const debugEvents = consoleMessages.filter(msg => msg.includes('[DEBUG] Event type'));
    console.log(`\nTotal events logged: ${debugEvents.length}`);
});
