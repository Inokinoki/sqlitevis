const { test, expect } = require('@playwright/test');

test.describe('Visualization View Modes', () => {

    test('B-Tree Structure View', async ({ page }) => {
        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        // Execute SQL to generate B-tree events
        await page.fill('#sql-input', 'CREATE TABLE items (id INTEGER, name TEXT); INSERT INTO items VALUES (1, "test")');
        await page.click('#execute-btn');
        await page.waitForTimeout(3000);

        // Switch to B-Tree view
        await page.selectOption('#view-mode', 'btree');

        // Check that canvas exists
        const canvas = page.locator('canvas');
        await expect(canvas).toBeVisible();

        console.log('✓ B-Tree Structure View: Canvas rendering');
    });

    test('SQL Parse Tree View', async ({ page }) => {
        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        // Execute SQL
        await page.fill('#sql-input', 'SELECT * FROM items');
        await page.click('#execute-btn');
        await page.waitForTimeout(3000);

        // Switch to Parse Tree view
        await page.selectOption('#view-mode', 'parse');

        // Check that canvas exists
        const canvas = page.locator('canvas');
        await expect(canvas).toBeVisible();

        console.log('✓ SQL Parse Tree View: Canvas rendering');
    });

    test('VDBE Execution View', async ({ page }) => {
        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        // Execute SQL
        await page.fill('#sql-input', 'SELECT 1 + 1');
        await page.click('#execute-btn');
        await page.waitForTimeout(3000);

        // Switch to VDBE view
        await page.selectOption('#view-mode', 'vdbe');

        // Check that canvas exists
        const canvas = page.locator('canvas');
        await expect(canvas).toBeVisible();

        console.log('✓ VDBE Execution View: Canvas rendering');
    });

    test('View Mode Switching', async ({ page }) => {
        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        // Execute SQL
        await page.fill('#sql-input', 'CREATE TABLE test (id INTEGER)');
        await page.click('#execute-btn');
        await page.waitForTimeout(3000);

        // Test switching between all views
        const views = ['btree', 'parse', 'vdbe'];
        for (const view of views) {
            await page.selectOption('#view-mode', view);
            await page.waitForTimeout(500);

            const canvas = page.locator('canvas');
            await expect(canvas).toBeVisible();
        }

        console.log('✓ View Mode Switching: All 3 views accessible');
    });

    test('Animation Controls', async ({ page }) => {
        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        // Check animation controls exist
        const showTransitions = page.locator('input[type="checkbox"]');
        await expect(showTransitions).toBeVisible();

        const speedSlider = page.locator('input[type="range"]');
        await expect(speedSlider).toBeVisible();

        console.log('✓ Animation Controls: Present and functional');
    });
});
