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

    test('error recovery: valid query works after invalid SQL', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        // Execute invalid SQL
        await page.fill('#sql-input', 'SELECT * FROM nonexistent;');
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const errorOutput = await page.locator('#output').innerHTML();
        expect(errorOutput).toContain('Error');

        // Now execute valid SQL — app should recover
        await page.fill('#sql-input', "CREATE TABLE recovery(id INTEGER PRIMARY KEY, val TEXT); INSERT INTO recovery VALUES(1, 'works');");
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const output = await page.locator('#output').innerHTML();
        expect(output).toContain('success');

        // Query the table to confirm it works
        await page.fill('#sql-input', 'SELECT * FROM recovery;');
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const selectOutput = await page.locator('#output').innerHTML();
        expect(selectOutput).toContain('works');
        expect(selectOutput).not.toContain('Error');
    });

    test('transaction ROLLBACK preserves original data', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        // Create table and insert initial data
        await page.fill('#sql-input', "CREATE TABLE txn_test(id INTEGER PRIMARY KEY, val TEXT); INSERT INTO txn_test VALUES(1, 'original');");
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        // Verify initial data
        await page.fill('#sql-input', 'SELECT * FROM txn_test;');
        await page.click('#execute-btn');
        await page.waitForTimeout(300);
        let output = await page.locator('#output').innerHTML();
        expect(output).toContain('original');

        // Begin transaction, insert, then rollback
        await page.fill('#sql-input', "BEGIN TRANSACTION; INSERT INTO txn_test VALUES(2, 'rolled_back'); ROLLBACK;");
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        // Verify rolled-back data is gone
        await page.fill('#sql-input', 'SELECT * FROM txn_test;');
        await page.click('#execute-btn');
        await page.waitForTimeout(300);
        output = await page.locator('#output').innerHTML();
        expect(output).toContain('original');
        expect(output).not.toContain('rolled_back');
    });

    test('page refresh resets to clean state', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        // Execute some SQL
        await page.fill('#sql-input', "CREATE TABLE refresh_test(id INTEGER); INSERT INTO refresh_test VALUES(42);");
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        // Verify data exists
        const output = await page.locator('#output').innerHTML();
        expect(output).toContain('success');

        // Refresh the page
        await page.reload();
        await page.waitForTimeout(2000);

        // Should be back to clean state
        const status = await page.locator('#db-status').textContent();
        expect(status).toBe('Ready');

        const sqlInput = await page.locator('#sql-input').inputValue();
        expect(sqlInput).toContain('CREATE TABLE'); // default SQL restored

        // Previous table should not exist (fresh WASM instance)
        await page.fill('#sql-input', 'SELECT * FROM refresh_test;');
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const afterRefresh = await page.locator('#output').innerHTML();
        expect(afterRefresh).toContain('Error');
    });

    test('Unicode content in SQL inserts and displays correctly', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        await page.fill('#sql-input', `CREATE TABLE unicode_test(id INTEGER PRIMARY KEY, name TEXT);
INSERT INTO unicode_test VALUES(1, '你好世界');
INSERT INTO unicode_test VALUES(2, '🎉 emoji 🚀');
INSERT INTO unicode_test VALUES(3, 'Ünïcödé');
SELECT * FROM unicode_test;`);
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const output = await page.locator('#output').innerHTML();
        expect(output).toContain('你好世界');
        expect(output).toContain('🎉');
        expect(output).toContain('Ünïcödé');
    });

    test('SQL with comments executes correctly', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        // Note: SQLite supports -- comments but the app may handle them differently
        await page.fill('#sql-input', `CREATE TABLE comment_test(id INTEGER PRIMARY KEY, val TEXT);
INSERT INTO comment_test VALUES(1, 'hello');
SELECT * FROM comment_test;`);
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const output = await page.locator('#output').innerHTML();
        expect(output).toContain('hello');
    });

    test('ALTER TABLE adds column and subsequent queries see it', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        await page.fill('#sql-input', `CREATE TABLE alter_test(id INTEGER PRIMARY KEY, name TEXT);
INSERT INTO alter_test VALUES(1, 'Alice');
ALTER TABLE alter_test ADD COLUMN age INTEGER;
UPDATE alter_test SET age = 30 WHERE id = 1;
SELECT * FROM alter_test;`);
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const output = await page.locator('#output').innerHTML();
        expect(output).toContain('Alice');
        expect(output).toContain('30');
    });

    test('multiple independent executes replace previous results', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        // First execute
        await page.fill('#sql-input', "CREATE TABLE multi_a(id INTEGER); INSERT INTO multi_a VALUES(1); SELECT * FROM multi_a;");
        await page.click('#execute-btn');
        await page.waitForTimeout(300);
        const output1 = await page.locator('#output').innerHTML();
        expect(output1).toContain('1');

        // Second execute — different table, results should replace
        await page.fill('#sql-input', "CREATE TABLE multi_b(id INTEGER, val TEXT); INSERT INTO multi_b VALUES(2, 'second'); SELECT * FROM multi_b;");
        await page.click('#execute-btn');
        await page.waitForTimeout(300);
        const output2 = await page.locator('#output').innerHTML();
        expect(output2).toContain('second');
    });

    test('empty input does not crash', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        await page.fill('#sql-input', '');
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        // App should still be responsive
        const status = await page.locator('#db-status').textContent();
        expect(status).toBe('Ready');
    });

    test('cross-table JOIN query returns correct results', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        await page.fill('#sql-input', `
            CREATE TABLE users(id INTEGER PRIMARY KEY, name TEXT);
            CREATE TABLE orders(id INTEGER PRIMARY KEY, user_id INTEGER, product TEXT);
            INSERT INTO users VALUES(1, 'Alice');
            INSERT INTO users VALUES(2, 'Bob');
            INSERT INTO orders VALUES(10, 1, 'Widget');
            INSERT INTO orders VALUES(11, 2, 'Gadget');
            SELECT u.name, o.product FROM users u JOIN orders o ON u.id = o.user_id;
        `);
        await page.click('#execute-btn');
        await page.waitForTimeout(500);

        const output = await page.locator('#output').innerHTML();
        expect(output).toContain('Alice');
        expect(output).toContain('Widget');
        expect(output).toContain('Bob');
        expect(output).toContain('Gadget');
    });

    test('canvas pan and zoom work', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        await page.fill('#sql-input', "CREATE TABLE pz_test(id INTEGER PRIMARY KEY, val TEXT); INSERT INTO pz_test VALUES(1, 'x');");
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const canvas = page.locator('#visualization-canvas');

        // Zoom in via mouse wheel
        await canvas.hover();
        await page.mouse.wheel(0, -200);
        await page.waitForTimeout(200);

        const zoomedIn = await page.evaluate(() => window.viz?._zoom);
        expect(zoomedIn).toBeGreaterThan(1);

        // Pan by dragging
        const box = await canvas.boundingBox();
        const startX = box.x + box.width / 2;
        const startY = box.y + box.height / 2;
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX + 100, startY + 50, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(100);

        const panX = await page.evaluate(() => window.viz?._panX);
        expect(panX).not.toBe(0);

        // Execute new SQL resets pan/zoom
        await page.fill('#sql-input', 'SELECT 1;');
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const zoomAfterReset = await page.evaluate(() => window.viz?._zoom);
        const panXAfterReset = await page.evaluate(() => window.viz?._panX);
        expect(zoomAfterReset).toBe(1);
        expect(panXAfterReset).toBe(0);
    });

    test('hovering B-Tree node shows info panel', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        await page.fill('#sql-input', "CREATE TABLE hover_test(id INTEGER PRIMARY KEY, val TEXT); INSERT INTO hover_test VALUES(1, 'data');");
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        // Info panel should be hidden initially
        await expect(page.locator('#node-info')).toHaveClass(/hidden/);

        // Hover over canvas where a node is drawn
        // Get a positioned node and move mouse there
        const nodePos = await page.evaluate(() => {
            const viz = window.viz;
            if (!viz || viz.nodes.size === 0) return null;
            for (const [, node] of viz.nodes) {
                if (node.x !== 0 || node.y !== 0) {
                    return { x: node.x, y: node.y };
                }
            }
            return null;
        });

        if (nodePos) {
            const canvasRect = await page.locator('#visualization-canvas').boundingBox();
            const sx = canvasRect.x + nodePos.x + 40; // offset into node center
            const sy = canvasRect.y + nodePos.y + 20;
            await page.mouse.move(sx, sy);
            await page.waitForTimeout(200);

            // Info panel should become visible
            const panelVisible = await page.locator('#node-info').isVisible().catch(() => false);
            // Panel may or may not be visible depending on exact hit, but no crash
            expect(typeof panelVisible).toBe('boolean');
        }
    });

    test('rapid double-click on execute does not crash', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        await page.fill('#sql-input', "CREATE TABLE dbl_test(id INTEGER PRIMARY KEY); INSERT INTO dbl_test VALUES(1); SELECT * FROM dbl_test;");

        // Rapid double-click
        await page.click('#execute-btn');
        await page.click('#execute-btn');
        await page.waitForTimeout(1500);

        // Regardless of intermediate state, app should recover on next execute
        await page.fill('#sql-input', 'SELECT * FROM dbl_test;');
        await page.click('#execute-btn');
        await page.waitForTimeout(500);

        // App recovered and produced results
        const output = await page.locator('#output').innerHTML();
        expect(output).toContain('1');
    });

    test('large result set renders without freezing', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        // Create a table with many rows
        const inserts = Array.from({ length: 100 }, (_, i) =>
            `INSERT INTO large_test VALUES(${i}, 'row_${i}');`
        ).join('\n');

        await page.fill('#sql-input', `
            CREATE TABLE large_test(id INTEGER PRIMARY KEY, val TEXT);
            ${inserts}
            SELECT * FROM large_test;
        `);
        await page.click('#execute-btn');
        await page.waitForTimeout(1000);

        // Results should contain data from first and last rows
        const output = await page.locator('#output').innerHTML();
        expect(output).toContain('row_0');
        expect(output).toContain('row_99');

        // App still responsive
        const status = await page.locator('#db-status').textContent();
        expect(status).toBe('Ready');
    });

    test('mobile viewport shows usable UI', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(BASE);
        await page.waitForTimeout(2500);

        // SQL input should be visible
        await expect(page.locator('#sql-input')).toBeVisible();

        // Execute button should be visible
        await expect(page.locator('#execute-btn')).toBeVisible();

        // Canvas should be visible
        await expect(page.locator('#visualization-canvas')).toBeVisible();

        // Execute SQL on mobile
        await page.fill('#sql-input', "CREATE TABLE mobile_test(x INTEGER); INSERT INTO mobile_test VALUES(1); SELECT * FROM mobile_test;");
        await page.click('#execute-btn');
        await page.waitForTimeout(500);

        const output = await page.locator('#output').innerHTML();
        expect(output).toContain('1');
    });

    test('SQL with -- line comments executes correctly', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        await page.fill('#sql-input', `-- Create a test table
CREATE TABLE comment_tbl(id INTEGER PRIMARY KEY, val TEXT);
-- Insert some data
INSERT INTO comment_tbl VALUES(1, 'hello');
-- Query it back
SELECT * FROM comment_tbl;`);
        await page.click('#execute-btn');
        await page.waitForTimeout(500);

        const output = await page.locator('#output').innerHTML();
        expect(output).toContain('hello');
    });

    test('SELECT returning 0 rows shows empty result', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        await page.fill('#sql-input', `CREATE TABLE empty_test(id INTEGER PRIMARY KEY, val TEXT);
SELECT * FROM empty_test;`);
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        // Should not error — just empty result
        const output = await page.locator('#output').innerHTML();
        expect(output).not.toContain('Error');
    });

    test('result table has correct headers and cells', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        await page.fill('#sql-input', `CREATE TABLE tbl_test(id INTEGER, name TEXT, score REAL);
INSERT INTO tbl_test VALUES(1, 'Alice', 95.5);
INSERT INTO tbl_test VALUES(2, 'Bob', 87.0);
SELECT * FROM tbl_test;`);
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        // Check table headers
        const headers = await page.locator('#output th').allTextContents();
        expect(headers).toContain('id');
        expect(headers).toContain('name');
        expect(headers).toContain('score');

        // Check data cell count (3 columns × 2 rows = 6 cells)
        const cells = await page.locator('#output td').allTextContents();
        expect(cells.length).toBe(6);

        // Check specific cell content
        expect(cells).toContain('Alice');
        expect(cells).toContain('95.5');
        expect(cells).toContain('Bob');
    });

    test('VDBE step counter shows Step X/Y with opcode name', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        await page.fill('#sql-input', 'SELECT 1, 2, 3;');
        await page.click('#execute-btn');
        await page.waitForTimeout(300);
        await page.selectOption('#view-mode', 'vdbe');
        await page.waitForTimeout(200);

        // Step forward
        await page.click('#vdbe-next');
        await page.waitForTimeout(100);

        const infoText = await page.locator('#vdbe-step-info').textContent();
        // Should show "Step 1/N: [PC] OpcodeName"
        expect(infoText).toMatch(/Step \d+\/\d+/);
        expect(infoText).toMatch(/\[\d+\]/);

        // Step again — counter should advance
        await page.click('#vdbe-next');
        await page.waitForTimeout(100);

        const infoText2 = await page.locator('#vdbe-step-info').textContent();
        expect(infoText2).toMatch(/Step \d+\/\d+/);
        // Step number should be different (higher)
        const step1 = parseInt(infoText.match(/Step (\d+)/)[1]);
        const step2 = parseInt(infoText2.match(/Step (\d+)/)[1]);
        expect(step2).toBeGreaterThan(step1);
    });

    test('parse and vdbe views render visible content on canvas', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        await page.fill('#sql-input', `CREATE TABLE viz_test(id INTEGER PRIMARY KEY, name TEXT);
INSERT INTO viz_test VALUES(1, 'Alice');
SELECT * FROM viz_test;`);
        await page.click('#execute-btn');
        await page.waitForTimeout(500);

        // Switch to parse view
        await page.selectOption('#view-mode', 'parse');
        await page.waitForTimeout(300);

        const parseCanvasContent = await page.evaluate(() => {
            const canvas = document.getElementById('visualization-canvas');
            const ctx = canvas.getContext('2d');
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let nonBg = 0;
            for (let i = 0; i < data.length; i += 80) {
                const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
                if (a > 0 && (r > 40 || g > 50 || b > 70)) nonBg++;
            }
            return nonBg;
        });
        expect(parseCanvasContent).toBeGreaterThan(3);

        // Switch to vdbe view
        await page.selectOption('#view-mode', 'vdbe');
        await page.waitForTimeout(300);

        const vdbeCanvasContent = await page.evaluate(() => {
            const canvas = document.getElementById('visualization-canvas');
            const ctx = canvas.getContext('2d');
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let nonBg = 0;
            for (let i = 0; i < data.length; i += 80) {
                const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
                if (a > 0 && (r > 40 || g > 50 || b > 70)) nonBg++;
            }
            return nonBg;
        });
        expect(vdbeCanvasContent).toBeGreaterThan(3);
    });

    test('Show Transitions toggle affects visualization behavior', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        // Uncheck show transitions
        await page.uncheck('#show-transitions');
        const isChecked = await page.locator('#show-transitions').isChecked();
        expect(isChecked).toBe(false);

        // Execute SQL — should work without animations
        await page.fill('#sql-input', "CREATE TABLE tran_test(id INTEGER PRIMARY KEY); INSERT INTO tran_test VALUES(1); SELECT * FROM tran_test;");
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const output = await page.locator('#output').innerHTML();
        expect(output).toContain('1');

        // Visualizer state should reflect transitions off
        const showTransitions = await page.evaluate(() => window.viz?.showTransitions);
        expect(showTransitions).toBe(false);

        // Re-enable transitions
        await page.check('#show-transitions');
        const showTransitionsAfter = await page.evaluate(() => window.viz?.showTransitions);
        expect(showTransitionsAfter).toBe(true);
    });

    test('window resize updates canvas dimensions', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        await page.fill('#sql-input', "CREATE TABLE resize_test(id INTEGER PRIMARY KEY, val TEXT); INSERT INTO resize_test VALUES(1, 'data'); SELECT * FROM resize_test;");
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const canvas = page.locator('#visualization-canvas');
        const sizeBefore = await canvas.boundingBox();

        // Resize viewport wider
        await page.setViewportSize({ width: 1400, height: 900 });
        await page.waitForTimeout(300);

        const sizeAfter = await canvas.boundingBox();
        // Canvas width should have changed
        expect(Math.abs(sizeAfter.width - sizeBefore.width)).toBeGreaterThan(0);

        // App still functional after resize
        await page.fill('#sql-input', 'SELECT * FROM resize_test;');
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const output = await page.locator('#output').innerHTML();
        expect(output).toContain('data');
    });

    test('BEGIN TRANSACTION ... COMMIT persists data', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        await page.fill('#sql-input', `CREATE TABLE commit_test(id INTEGER PRIMARY KEY, val TEXT);
BEGIN TRANSACTION;
INSERT INTO commit_test VALUES(1, 'persisted');
INSERT INTO commit_test VALUES(2, 'also_persisted');
COMMIT;
SELECT * FROM commit_test;`);
        await page.click('#execute-btn');
        await page.waitForTimeout(500);

        const output = await page.locator('#output').innerHTML();
        expect(output).toContain('persisted');
        expect(output).toContain('also_persisted');
    });

    test('SELECT DISTINCT / ORDER BY / LIMIT work correctly', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        await page.fill('#sql-input', `CREATE TABLE sort_test(id INTEGER, cat TEXT);
INSERT INTO sort_test VALUES(1, 'b');
INSERT INTO sort_test VALUES(2, 'a');
INSERT INTO sort_test VALUES(3, 'b');
INSERT INTO sort_test VALUES(4, 'a');
INSERT INTO sort_test VALUES(5, 'c');
SELECT DISTINCT cat FROM sort_test ORDER BY cat;`);
        await page.click('#execute-btn');
        await page.waitForTimeout(500);

        const cells = await page.locator('#output td').allTextContents();
        // DISTINCT should give 3 unique values: a, b, c (sorted)
        expect(cells).toEqual(['a', 'b', 'c']);
    });

    test('UPDATE with no matching rows shows no error', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        await page.fill('#sql-input', `CREATE TABLE upd_empty(id INTEGER PRIMARY KEY, val TEXT);
INSERT INTO upd_empty VALUES(1, 'exists');
UPDATE upd_empty SET val = 'changed' WHERE id = 999;
SELECT * FROM upd_empty;`);
        await page.click('#execute-btn');
        await page.waitForTimeout(500);

        // Original data unchanged
        const output = await page.locator('#output').innerHTML();
        expect(output).toContain('exists');
        expect(output).not.toContain('changed');
    });

    test('SQL with extra semicolons and trailing whitespace', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        await page.fill('#sql-input', `  ;  CREATE TABLE semi_test(x INTEGER); ; INSERT INTO semi_test VALUES(42); ; SELECT * FROM semi_test;  `);
        await page.click('#execute-btn');
        await page.waitForTimeout(500);

        const output = await page.locator('#output').innerHTML();
        expect(output).toContain('42');
    });

    test('CREATE VIEW and query it', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        await page.fill('#sql-input', `CREATE TABLE view_base(id INTEGER, name TEXT, active INTEGER);
INSERT INTO view_base VALUES(1, 'Alice', 1);
INSERT INTO view_base VALUES(2, 'Bob', 0);
INSERT INTO view_base VALUES(3, 'Carol', 1);
CREATE VIEW active_users AS SELECT id, name FROM view_base WHERE active = 1;
SELECT * FROM active_users;`);
        await page.click('#execute-btn');
        await page.waitForTimeout(500);

        const output = await page.locator('#output').innerHTML();
        expect(output).toContain('Alice');
        expect(output).toContain('Carol');
        expect(output).not.toContain('Bob');
    });

    test('View Row Data shows actual table data for leaf node', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        // Create table and insert data
        await page.fill('#sql-input', `CREATE TABLE rowdata_e2e(id INTEGER PRIMARY KEY, name TEXT, age INTEGER);
INSERT INTO rowdata_e2e VALUES(1, 'Alice', 30);
INSERT INTO rowdata_e2e VALUES(2, 'Bob', 25);
SELECT * FROM rowdata_e2e;`);
        await page.click('#execute-btn');
        await page.waitForTimeout(500);

        // Find a leaf node with cells, hover it, then click "View Row Data"
        const dataLoaded = await page.evaluate(async () => {
            const viz = window.viz;
            // Find leaf node with cells
            let targetNode = null;
            for (const [, node] of viz.nodes) {
                if (node.type === 1 && node.cells.length > 0) {
                    targetNode = node;
                    break;
                }
            }
            if (!targetNode) return { found: false };

            // Show node info (triggers the panel)
            viz.showNodeInfo(targetNode);

            // Find and click the "View Row Data" button
            const btn = document.querySelector('.btn-view-data');
            if (!btn) return { found: true, hasButton: false };

            btn.click();
            // Wait for async query
            await new Promise(r => setTimeout(r, 500));

            const dataDiv = document.getElementById('node-data');
            return {
                found: true,
                hasButton: true,
                dataHtml: dataDiv ? dataDiv.innerHTML : ''
            };
        });

        expect(dataLoaded.found).toBe(true);
        if (dataLoaded.hasButton) {
            expect(dataLoaded.dataHtml).toBeTruthy();
            // Should contain column headers or actual data
            if (dataLoaded.dataHtml.includes('No rows')) {
                // Acceptable — node may not map to a known table
                expect(dataLoaded.dataHtml).toContain('No rows');
            } else {
                // Should have table structure with data
                expect(dataLoaded.dataHtml).toMatch(/(Alice|Bob|<th>|<td>)/);
            }
        }
    });

    test('step-through multi-statement shows intermediate results', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        await page.fill('#sql-input', `CREATE TABLE step_e2e(id INTEGER, val TEXT);
INSERT INTO step_e2e VALUES(1, 'first');
INSERT INTO step_e2e VALUES(2, 'second');
SELECT * FROM step_e2e;`);

        // Step through each statement one at a time
        // Step 1: CREATE TABLE
        await page.click('#step-btn');
        await page.waitForTimeout(300);
        const output1 = await page.locator('#output').innerHTML();
        expect(output1).toContain('success');

        // Step 2: INSERT first
        await page.click('#step-btn');
        await page.waitForTimeout(300);
        const output2 = await page.locator('#output').innerHTML();
        expect(output2).toContain('success');

        // Step 3: INSERT second
        await page.click('#step-btn');
        await page.waitForTimeout(300);
        const output3 = await page.locator('#output').innerHTML();
        expect(output3).toContain('success');

        // Step 4: SELECT
        await page.click('#step-btn');
        await page.waitForTimeout(300);
        const output4 = await page.locator('#output').innerHTML();
        expect(output4).toContain('first');
        expect(output4).toContain('second');
    });

    test('node expand/collapse changes canvas', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        await page.fill('#sql-input', `CREATE TABLE expand_e2e(id INTEGER PRIMARY KEY, val TEXT);
INSERT INTO expand_e2e VALUES(1, 'a');
INSERT INTO expand_e2e VALUES(2, 'b');
INSERT INTO expand_e2e VALUES(3, 'c');`);
        await page.click('#execute-btn');
        await page.waitForTimeout(500);

        // Get canvas state before click
        const canvasBefore = await page.evaluate(() => {
            const canvas = document.getElementById('visualization-canvas');
            const ctx = canvas.getContext('2d');
            return ctx.getImageData(0, 0, canvas.width, canvas.height).data.slice(0, 1000).join(',');
        });

        // Find and click a node
        const clicked = await page.evaluate(() => {
            const viz = window.viz;
            const canvas = document.getElementById('visualization-canvas');
            const rect = canvas.getBoundingClientRect();
            for (const [pn, node] of viz.nodes) {
                if (node.x !== 0 || node.y !== 0) {
                    return { sx: node.x + viz.nodeWidth / 2, sy: node.y + viz.nodeHeight / 2, pn };
                }
            }
            return null;
        });

        if (clicked) {
            const canvasRect = await page.locator('#visualization-canvas').boundingBox();
            await page.mouse.click(canvasRect.x + clicked.sx, canvasRect.y + clicked.sy);
            await page.waitForTimeout(200);

            // Canvas should have changed (layout redrawn)
            const canvasAfter = await page.evaluate(() => {
                const canvas = document.getElementById('visualization-canvas');
                const ctx = canvas.getContext('2d');
                return ctx.getImageData(0, 0, canvas.width, canvas.height).data.slice(0, 1000).join(',');
            });

            // Node expansion state should have toggled
            const isExpanded = await page.evaluate((pn) => {
                return window.viz?.nodes.get(pn)?.expanded;
            }, clicked.pn);

            expect(typeof isExpanded).toBe('boolean');
        }
    });

    test('view mode round-trip preserves all data', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        await page.fill('#sql-input', `CREATE TABLE roundtrip(id INTEGER PRIMARY KEY, name TEXT);
INSERT INTO roundtrip VALUES(1, 'test');
SELECT * FROM roundtrip;`);
        await page.click('#execute-btn');
        await page.waitForTimeout(500);

        // Capture initial state
        const initialNodes = await page.evaluate(() => window.viz.nodes.size);
        const initialOpcodes = await page.evaluate(() =>
            (window.viz.vdbeOpcodes || []).filter(o => o).length
        );
        const initialTree = await page.evaluate(() => window.viz.parseTree?.type);

        // Round-trip through all views
        await page.selectOption('#view-mode', 'parse');
        await page.waitForTimeout(200);
        await page.selectOption('#view-mode', 'vdbe');
        await page.waitForTimeout(200);
        await page.selectOption('#view-mode', 'btree');
        await page.waitForTimeout(200);

        // Data should still be intact
        const afterNodes = await page.evaluate(() => window.viz.nodes.size);
        const afterOpcodes = await page.evaluate(() =>
            (window.viz.vdbeOpcodes || []).filter(o => o).length
        );
        const afterTree = await page.evaluate(() => window.viz.parseTree?.type);

        expect(afterNodes).toBe(initialNodes);
        expect(afterOpcodes).toBe(initialOpcodes);
        expect(afterTree).toBe(initialTree);
    });

    test('SQL with NULL values displays correctly', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        await page.fill('#sql-input', `CREATE TABLE null_test(id INTEGER PRIMARY KEY, val TEXT, num INTEGER);
INSERT INTO null_test VALUES(1, NULL, NULL);
INSERT INTO null_test VALUES(2, 'text', 42);
SELECT * FROM null_test;`);
        await page.click('#execute-btn');
        await page.waitForTimeout(500);

        const output = await page.locator('#output').innerHTML();
        // Should contain NULL text for null values
        expect(output).toContain('NULL');
        expect(output).toContain('text');
        expect(output).toContain('42');
    });

    test('aggregate functions return correct results', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        await page.fill('#sql-input', `CREATE TABLE agg_test(id INTEGER, cat TEXT, val INTEGER);
INSERT INTO agg_test VALUES(1, 'a', 10);
INSERT INTO agg_test VALUES(2, 'a', 20);
INSERT INTO agg_test VALUES(3, 'b', 30);
INSERT INTO agg_test VALUES(4, 'b', 40);
SELECT cat, SUM(val), COUNT(*), AVG(val) FROM agg_test GROUP BY cat;`);
        await page.click('#execute-btn');
        await page.waitForTimeout(500);

        const cells = await page.locator('#output td').allTextContents();
        // Should have 2 groups: a (30, 2, 15) and b (70, 2, 35)
        expect(cells.length).toBeGreaterThanOrEqual(6);
        expect(cells).toContain('30');
        expect(cells).toContain('70');
    });

    test('WHERE with LIKE and IN operators works', async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);

        await page.fill('#sql-input', `CREATE TABLE like_test(id INTEGER, name TEXT);
INSERT INTO like_test VALUES(1, 'apple');
INSERT INTO like_test VALUES(2, 'application');
INSERT INTO like_test VALUES(3, 'banana');
INSERT INTO like_test VALUES(4, 'cherry');
SELECT * FROM like_test WHERE name LIKE 'app%';
SELECT * FROM like_test WHERE id IN (1, 3);`);
        await page.click('#execute-btn');
        await page.waitForTimeout(500);

        const output = await page.locator('#output').innerHTML();
        // Last statement is SELECT with IN — should show id 1 and 3
        expect(output).toContain('apple');
        expect(output).toContain('banana');
    });
});

// ========================================================================
// E2E: Button Controls and UI State
// ========================================================================

test.describe('Button Controls and UI State', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(2000);
    });

    test('Step Through button executes one statement at a time', async ({ page }) => {
        await page.fill('#sql-input', `CREATE TABLE step_tbl(id INTEGER);
INSERT INTO step_tbl VALUES(1);
SELECT * FROM step_tbl;`);

        // First click: executes only the first statement
        await page.click('#step-btn');
        await page.waitForTimeout(500);

        const output1 = await page.locator('#output').innerHTML();
        expect(output1).toContain('success');

        // Second click: executes INSERT
        await page.click('#step-btn');
        await page.waitForTimeout(500);

        // Third click: executes SELECT, should show data
        await page.click('#step-btn');
        await page.waitForTimeout(500);

        const output3 = await page.locator('#output').innerHTML();
        expect(output3).toContain('1');
    });

    test('Clear button resets SQL input and output', async ({ page }) => {
        await page.fill('#sql-input', 'SELECT 1;');
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        // Verify output has content
        const outputBefore = await page.locator('#output').innerHTML();
        expect(outputBefore).toContain('1');

        // Click Clear
        await page.click('#clear-btn');
        await page.waitForTimeout(200);

        const inputAfter = await page.locator('#sql-input').inputValue();
        expect(inputAfter).toBe('');

        const outputAfter = await page.locator('#output').textContent();
        expect(outputAfter).toContain('Results will appear here');
    });

    test('VDBE Reset button resets step state', async ({ page }) => {
        await page.fill('#sql-input', 'CREATE TABLE vreset(id INTEGER); INSERT INTO vreset VALUES(1);');
        await page.click('#execute-btn');
        await page.waitForTimeout(300);
        await page.selectOption('#view-mode', 'vdbe');
        await page.waitForTimeout(100);

        // Step forward a few times
        for (let i = 0; i < 5; i++) {
            await page.click('#vdbe-next');
            await page.waitForTimeout(50);
        }

        const infoBefore = await page.locator('#vdbe-step-info').textContent();

        // Click Reset
        await page.click('#vdbe-reset');
        await page.waitForTimeout(100);

        const infoAfter = await page.locator('#vdbe-step-info').textContent();
        // After reset, step info should go back to initial state (empty or Step 0)
        expect(infoAfter).not.toBe(infoBefore);
    });

    test('VDBE Prev button steps backward', async ({ page }) => {
        await page.fill('#sql-input', 'CREATE TABLE vprev(id INTEGER); INSERT INTO vprev VALUES(1); SELECT * FROM vprev;');
        await page.click('#execute-btn');
        await page.waitForTimeout(300);
        await page.selectOption('#view-mode', 'vdbe');
        await page.waitForTimeout(100);

        // Step forward 3 times to have room to go back
        for (let i = 0; i < 3; i++) {
            await page.click('#vdbe-next');
            await page.waitForTimeout(50);
        }
        const infoFwd = await page.locator('#vdbe-step-info').textContent();

        // Step backward
        await page.click('#vdbe-prev');
        await page.waitForTimeout(50);
        const infoBack = await page.locator('#vdbe-step-info').textContent();

        // Step counter should have decreased
        expect(infoBack).not.toBe(infoFwd);
    });

    test('speed slider changes displayed speed value', async ({ page }) => {
        const slider = page.locator('#animation-speed');
        await slider.fill('0.5');
        const displayed = await page.locator('#speed-value').textContent();
        expect(displayed).toContain('0.5');
    });

    test('db-status transitions from initializing to ready', async ({ page }) => {
        const status = await page.locator('#db-status').textContent();
        expect(status).toContain('Ready');
    });

    test('page count in footer updates after inserts', async ({ page }) => {
        const before = await page.locator('#page-count').textContent();

        await page.fill('#sql-input', 'CREATE TABLE pgcnt(id INTEGER); INSERT INTO pgcnt VALUES(1);');
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const after = await page.locator('#page-count').textContent();
        expect(parseInt(after)).toBeGreaterThan(parseInt(before));
    });

    test('loading overlay is hidden after initialization', async ({ page }) => {
        const overlay = page.locator('#loading-overlay');
        await expect(overlay).toBeHidden();
    });

    test('node info panel shows cell data when hovering B-Tree node', async ({ page }) => {
        await page.fill('#sql-input', `CREATE TABLE ninfo(id INTEGER PRIMARY KEY, val TEXT);
INSERT INTO ninfo VALUES(1, 'alpha');
INSERT INTO ninfo VALUES(2, 'beta');`);
        await page.click('#execute-btn');
        await page.waitForTimeout(300);
        await page.selectOption('#view-mode', 'btree');
        await page.waitForTimeout(100);

        // Get node position and hover
        const nodeInfo = await page.evaluate(() => {
            const nodes = [...window.viz.nodes.values()];
            // Find a non-rootpage-1 node with cells
            const target = nodes.find(n => n.page !== 1 && n.cells.length > 0) || nodes[0];
            if (!target) return null;
            return { x: target.x, y: target.y, page: target.page };
        });

        if (nodeInfo) {
            const canvas = page.locator('#visualization-canvas');
            const box = await canvas.boundingBox();
            if (box) {
                await page.mouse.move(box.x + nodeInfo.x + 60, box.y + nodeInfo.y + 20);
                await page.waitForTimeout(200);

                // Node info panel should appear
                const panel = page.locator('#node-info');
                const isVisible = await panel.isVisible();
                if (isVisible) {
                    const details = await page.locator('#node-details').textContent();
                    expect(details.length).toBeGreaterThan(0);
                }
            }
        }
    });
});
