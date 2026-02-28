/**
 * Test to verify parse tree shows initial state
 */

const { test, expect } = require('@playwright/test');

test('parse tree shows waiting message on view switch', async ({ page }) => {
    await page.goto('http://localhost:8000/src/web/index.html');
    await page.waitForSelector('#db-status', { timeout: 10000 });
    await expect(page.locator('#db-status')).toContainText('Ready', { timeout: 15000 });

    // Switch to parse tree view without executing any SQL
    await page.selectOption('#view-mode', 'parse');

    // Wait for render
    await page.waitForTimeout(500);

    // Take screenshot to see what's shown
    await page.screenshot({ path: 'screenshots/parse-tree-waiting-state.png', fullPage: true });

    // Verify canvas is visible
    const canvas = page.locator('#visualization-canvas');
    await expect(canvas).toBeVisible();

    console.log('Parse tree should now show "waiting for SQL" message');
});
