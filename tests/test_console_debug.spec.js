const { test, expect } = require('@playwright/test');

test('Debug: Check console logs for parse events', async ({ page, request }) => {
    // Start the server
    const server = require('child_process').spawn('docker', ['run', '--rm', '-p', '8001:8000', '-v', `${process.cwd()}:/app`, 'sqlitevis']);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Capture console messages
    const consoleMessages = [];
    page.on('console', msg => {
        consoleMessages.push({
            type: msg.type(),
            text: msg.text()
        });
    });

    // Navigate to the application
    await page.goto('http://localhost:8001/src/web/index.html');
    await page.waitForLoadState('networkidle');

    // Wait for WASM to load
    await page.waitForTimeout(2000);

    // Execute a simple query
    const sqlInput = page.locator('textarea').first();
    await sqlInput.fill('SELECT 1 + 1 AS result');
    const executeBtn = page.locator('button:has-text("Execute")').first();
    await executeBtn.click();

    // Wait for events
    await page.waitForTimeout(3000);

    // Print all console messages
    console.log('\n=== CONSOLE MESSAGES ===');
    consoleMessages.forEach(msg => {
        if (msg.text.includes('[DEBUG]') || msg.text.includes('parse')) {
            console.log(`${msg.type}: ${msg.text}`);
        }
    });
    console.log('=== END CONSOLE MESSAGES ===\n');

    // Check if we see parse_complete_event
    const hasParseCompleteDebug = consoleMessages.some(msg =>
        msg.text.includes('[DEBUG] Found parse_complete_event')
    );

    console.log(`Has parse_complete_event debug: ${hasParseCompleteDebug}`);

    // This will fail but we get to see the console output
    expect(true).toBe(true);
});
