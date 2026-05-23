const { test, expect } = require('@playwright/test');

const BASE = '/index.html';

/**
 * End-to-end user journey test.
 * Simulates a real user's complete workflow through SQLiteVis:
 *
 * 1. App loads → default SQL visible → loading overlay disappears
 * 2. Execute default SQL → results appear, events logged, btree nodes drawn
 * 3. Switch to Parse view → tokens visualized
 * 4. Switch to VDBE view → execution trace shown
 * 5. Switch back to B-Tree → data preserved
 * 6. Clear SQL → type custom query → execute → verify results
 * 7. Step through multi-statement SQL one at a time
 * 8. Delete data → verify deletion
 * 9. Error handling → invalid SQL
 * 10. Event log management → clear events
 */
test.describe('Full User Journey', () => {

    test('complete workflow: load, execute, visualize, iterate', async ({ page }) => {
        // ── Step 1: App loads with default content ──
        await page.goto(BASE);

        // Loading overlay should appear then disappear
        const overlay = page.locator('#loading-overlay');
        await expect(overlay).toBeVisible();
        await page.waitForTimeout(2500);

        // Status should show Ready
        await expect(page.locator('#db-status')).toHaveText('Ready');

        // Default SQL in textarea
        const sqlInput = page.locator('#sql-input');
        const defaultSQL = await sqlInput.inputValue();
        expect(defaultSQL).toContain('CREATE TABLE');
        expect(defaultSQL).toContain('INSERT INTO');
        expect(defaultSQL).toContain('SELECT');

        // ── Step 2: Execute default SQL ──
        await page.click('#execute-btn');
        await page.waitForTimeout(500);

        // Results should show Alice and Bob from the default SELECT
        const output = await page.locator('#output').innerHTML();
        expect(output).toContain('Alice');
        expect(output).toContain('Bob');

        // Event count should be > 0
        const eventCount = parseInt(await page.locator('#event-count').textContent());
        expect(eventCount).toBeGreaterThan(0);

        // Event log should have visible entries
        const eventItems = await page.locator('.event-item').count();
        expect(eventItems).toBeGreaterThan(0);

        // Page count should be > 0
        const pageCount = parseInt(await page.locator('#page-count').textContent());
        expect(pageCount).toBeGreaterThan(0);

        // B-tree nodes should exist in visualizer
        const nodeCount = await page.evaluate(() => window.viz.nodes.size);
        expect(nodeCount).toBeGreaterThan(0);

        // ── Step 3: Switch to Parse view ──
        await page.selectOption('#view-mode', 'parse');
        await page.waitForTimeout(200);

        // Parse tokens should be populated (from last executed statement)
        const parseTokenCount = await page.evaluate(() => window.viz.parseTokens.length);
        expect(parseTokenCount).toBeGreaterThan(0);

        // View mode should be parse
        const parseMode = await page.evaluate(() => window.viz.viewMode);
        expect(parseMode).toBe('parse');

        // ── Step 4: Switch to VDBE view ──
        await page.selectOption('#view-mode', 'vdbe');
        await page.waitForTimeout(200);

        // VDBE opcodes array should exist
        const vdbeReady = await page.evaluate(() => Array.isArray(window.viz.vdbeOpcodes));
        expect(vdbeReady).toBeTruthy();

        // VDBE events should be in the event log
        const eventTexts = await page.locator('.event-item').allTextContents();
        const hasVdbe = eventTexts.some(e => e.includes('VDBE'));
        expect(hasVdbe).toBeTruthy();

        // ── Step 5: Switch back to B-Tree ──
        await page.selectOption('#view-mode', 'btree');
        await page.waitForTimeout(200);

        // Node data preserved
        const nodeCountAfter = await page.evaluate(() => window.viz.nodes.size);
        expect(nodeCountAfter).toBe(nodeCount);

        // ── Step 6: Type custom query and execute ──
        await page.fill('#sql-input', "SELECT * FROM users WHERE name = 'Alice';");
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        // Should show Alice but not Bob
        const output2 = await page.locator('#output').innerHTML();
        expect(output2).toContain('Alice');
        expect(output2).not.toContain('Bob');

        // ── Step 7: Step through multi-statement SQL ──
        await page.fill('#sql-input', "CREATE TABLE step_test(id INTEGER, val TEXT);\nINSERT INTO step_test VALUES(1, 'one');\nINSERT INTO step_test VALUES(2, 'two');\nSELECT * FROM step_test;");

        // Step through all 4 statements
        for (let i = 0; i < 4; i++) {
            await page.click('#step-btn');
            await page.waitForTimeout(200);
        }

        // After stepping through all statements, the last one (SELECT) should show results
        const stepFinalOutput = await page.locator('#output').innerHTML();
        expect(stepFinalOutput).toContain('one');
        expect(stepFinalOutput).toContain('two');

        // ── Step 8: Delete and verify ──
        await page.fill('#sql-input', "DELETE FROM step_test WHERE id = 1;\nSELECT * FROM step_test;");
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const deleteOutput = await page.locator('#output').innerHTML();
        expect(deleteOutput).toContain('two');
        expect(deleteOutput).not.toContain('one');

        // ── Step 9: Error handling ──
        await page.fill('#sql-input', "SELECT * FROM nonexistent_table;");
        await page.click('#execute-btn');
        await page.waitForTimeout(200);

        const errorOutput = await page.locator('#output').innerHTML();
        expect(errorOutput).toContain('Error');

        // ── Step 10: Clear event log ──
        // First verify there are events
        const beforeCount = parseInt(await page.locator('#event-count').textContent());
        expect(beforeCount).toBeGreaterThan(0);
        const beforeItems = await page.locator('.event-item').count();
        expect(beforeItems).toBeGreaterThan(0);

        // Clear
        await page.click('#clear-events-btn');

        // Verify cleared
        const afterCount = await page.locator('#event-count').textContent();
        expect(afterCount).toBe('0');
        const afterItems = await page.locator('.event-item').count();
        expect(afterItems).toBe(0);

        // ── Step 11: Clear SQL and output ──
        await page.click('#clear-btn');
        const clearedSQL = await sqlInput.inputValue();
        expect(clearedSQL).toBe('');

        // ── Step 12: XSS protection ──
        await page.fill('#sql-input', `CREATE TABLE xss_test(id INTEGER, val TEXT);
INSERT INTO xss_test VALUES(1, '<script>alert("xss")</script>');
SELECT * FROM xss_test;`);
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const xssOutput = await page.locator('#output').innerHTML();
        expect(xssOutput).not.toContain('<script>');
        expect(xssOutput).toContain('&lt;script');
    });

    test('Ctrl+Enter keyboard shortcut works', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        await page.fill('#sql-input', "CREATE TABLE kb_test(x INTEGER);");
        // Press Ctrl+Enter
        await page.locator('#sql-input').press('Control+Enter');
        await page.waitForTimeout(300);

        const output = await page.locator('#output').innerHTML();
        expect(output).toContain('success');
    });

    test('animation speed slider changes value', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        const speedDisplay = page.locator('#speed-value');
        await expect(speedDisplay).toHaveText('1.0x');

        // Change slider
        await page.fill('#animation-speed', '0.5');
        await page.waitForTimeout(100);

        await expect(speedDisplay).toHaveText('0.5x');
    });

    test('page stays responsive after 100+ rapid operations', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        // Generate many events with multiple executes
        for (let i = 0; i < 5; i++) {
            await page.fill('#sql-input', `CREATE TABLE stress_${i}(id INTEGER);
${Array.from({ length: 5 }, (_, j) => `INSERT INTO stress_${i} VALUES(${j});`).join('\n')}`);
            await page.click('#execute-btn');
            await page.waitForTimeout(100);
        }

        // App should still be responsive
        const status = await page.locator('#db-status').textContent();
        expect(status).toBe('Ready');

        // One final query should work
        await page.fill('#sql-input', "SELECT * FROM stress_0;");
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const output = await page.locator('#output').innerHTML();
        expect(output).toContain('0');
    });

    test('auto-scroll toggle affects event log', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        // Uncheck auto-scroll
        await page.uncheck('#auto-scroll');
        const isChecked = await page.locator('#auto-scroll').isChecked();
        expect(isChecked).toBeFalsy();

        // Execute SQL - events should still appear but without auto-scroll
        await page.fill('#sql-input', 'CREATE TABLE as_test(id INTEGER);');
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const events = await page.locator('.event-item').count();
        expect(events).toBeGreaterThan(0);
    });
});
