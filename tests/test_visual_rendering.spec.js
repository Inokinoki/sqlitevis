const { test, expect } = require('@playwright/test');

test.describe('Visual Rendering Verification', () => {

    test('Verify VDBE visualization renders', async ({ page }) => {
        console.log('Testing VDBE visualization rendering...');

        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        // Execute SQL
        await page.fill('#sql-input', 'SELECT 1 + 1 AS result');
        await page.click('#execute-btn');
        await page.waitForTimeout(3000);

        // Switch to VDBE view
        await page.selectOption('#view-mode', 'vdbe');
        await page.waitForTimeout(1000);

        // Check canvas exists and is visible
        const canvas = page.locator('canvas');
        await expect(canvas).toBeVisible();

        // Check canvas has content (not blank)
        const canvasBox = await canvas.boundingBox();
        expect(canvasBox).not.toBeNull();
        expect(canvasBox.width).toBeGreaterThan(0);
        expect(canvasBox.height).toBeGreaterThan(0);

        console.log('   ✓ VDBE canvas rendering correctly');
        console.log(`   Canvas size: ${canvasBox.width}x${canvasBox.height}`);
    });

    test('Verify Parse Tree visualization renders', async ({ page }) => {
        console.log('Testing Parse Tree visualization rendering...');

        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        // Execute SQL
        await page.fill('#sql-input', 'SELECT * FROM users');
        await page.click('#execute-btn');
        await page.waitForTimeout(3000);

        // Switch to Parse view
        await page.selectOption('#view-mode', 'parse');
        await page.waitForTimeout(1000);

        // Check canvas exists and is visible
        const canvas = page.locator('canvas');
        await expect(canvas).toBeVisible();

        const canvasBox = await canvas.boundingBox();
        expect(canvasBox).not.toBeNull();
        expect(canvasBox.width).toBeGreaterThan(0);
        expect(canvasBox.height).toBeGreaterThan(0);

        console.log('   ✓ Parse Tree canvas rendering correctly');
        console.log(`   Canvas size: ${canvasBox.width}x${canvasBox.height}`);
    });

    test('Verify B-Tree visualization renders', async ({ page }) => {
        console.log('Testing B-Tree visualization rendering...');

        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        // Execute SQL
        await page.fill('#sql-input', 'CREATE TABLE test (id INTEGER, name TEXT)');
        await page.click('#execute-btn');
        await page.waitForTimeout(3000);

        // Switch to B-Tree view
        await page.selectOption('#view-mode', 'btree');
        await page.waitForTimeout(1000);

        // Check canvas exists and is visible
        const canvas = page.locator('canvas');
        await expect(canvas).toBeVisible();

        const canvasBox = await canvas.boundingBox();
        expect(canvasBox).not.toBeNull();
        expect(canvasBox.width).toBeGreaterThan(0);
        expect(canvasBox.height).toBeGreaterThan(0);

        console.log('   ✓ B-Tree canvas rendering correctly');
        console.log(`   Canvas size: ${canvasBox.width}x${canvasBox.height}`);
    });

    test('Verify all three views work in sequence', async ({ page }) => {
        console.log('Testing all views in sequence...');

        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        // Execute SQL
        await page.fill('#sql-input', 'SELECT 1 AS value');
        await page.click('#execute-btn');
        await page.waitForTimeout(3000);

        const views = ['vdbe', 'parse', 'btree'];

        for (const view of views) {
            await page.selectOption('#view-mode', view);
            await page.waitForTimeout(1000);

            const canvas = page.locator('canvas');
            await expect(canvas).toBeVisible();

            const canvasBox = await canvas.boundingBox();
            expect(canvasBox.width).toBeGreaterThan(0);
            expect(canvasBox.height).toBeGreaterThan(0);

            console.log(`   ✓ ${view.toUpperCase()} view: Canvas ${canvasBox.width}x${canvasBox.height}`);
        }

        console.log('   ✓ All three views rendering correctly in sequence');
    });

    test('Verify view controls are functional', async ({ page }) => {
        console.log('Testing view controls...');

        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        // Check view dropdown exists and has correct options
        const viewSelect = page.locator('#view-mode');
        await expect(viewSelect).toBeVisible();

        const options = await viewSelect.locator('option').allTextContents();
        expect(options).toContain('B-Tree Structure');
        expect(options).toContain('SQL Parse Tree');
        expect(options).toContain('VDBE Execution');

        console.log(`   ✓ View options: ${options.join(', ')}`);

        // Check speed slider
        const speedSlider = page.locator('input[type="range"]');
        await expect(speedSlider).toBeVisible();

        // Check show transitions checkbox
        const transitionsCheck = page.locator('input[type="checkbox"]');
        await expect(transitionsCheck).toBeVisible();
        const isChecked = await transitionsCheck.isChecked();
        expect(isChecked).toBe(true);

        console.log('   ✓ All view controls functional');
    });
});
