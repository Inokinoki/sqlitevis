const { test, expect } = require('@playwright/test');

test('Parse Event Debug - Simple Test', async ({ page }) => {
    // Capture all console messages
    const consoleLogs = [];
    page.on('console', msg => {
        const text = msg.text();
        consoleLogs.push(text);
        // Print in real-time
        console.log(`[BROWSER] ${text}`);
    });

    // Navigate to the application (using the working URL from other tests)
    await page.goto('http://localhost:8080/index.html');

    // Wait for page to load
    await page.waitForTimeout(5000);

    // Check status
    const statusText = await page.locator('#db-status').textContent();
    console.log('Status:', statusText);

    if (!statusText.includes('Ready')) {
        console.log('Application not ready, waiting...');
        await page.waitForTimeout(3000);
    }

    // Clear events
    await page.click('#clear-events-btn');

    // Execute a simple SQL query
    await page.fill('#sql-input', 'SELECT 1');
    await page.click('#execute-btn');

    // Wait for events
    await page.waitForTimeout(3000);

    // Filter for C-level logs
    const cLogs = consoleLogs.filter(log => log.includes('[C]'));
    console.log('\n=== C-LEVEL LOGS ===');
    cLogs.forEach(log => console.log(log));
    console.log('=== END C-LEVEL LOGS ===\n');

    // Check if parse_complete_event was called
    const parseCompleteCalled = consoleLogs.some(log =>
        log.includes('[C] parse_complete_event')
    );

    console.log(`✓ parse_complete_event called: ${parseCompleteCalled}`);

    // This test is just for debugging, always passes
    expect(true).toBe(true);
});
