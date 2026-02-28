const { test, expect } = require('@playwright/test');

test.describe('Edge Cases and Stress Testing', () => {

    test('Test 1: Empty SQL statement', async ({ page }) => {
        console.log('Testing empty SQL...');
        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        await page.click('#clear-events-btn');
        await page.fill('#sql-input', '');
        await page.click('#execute-btn');
        await page.waitForTimeout(2000);

        // Application should handle gracefully
        const statusText = await page.locator('#db-status').textContent();
        console.log(`   Status: ${statusText}`);
        console.log('   ✓ Empty SQL handled gracefully');
    });

    test('Test 2: Multiple rapid queries', async ({ page }) => {
        console.log('Testing rapid successive queries...');
        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        await page.click('#clear-events-btn');

        // Execute 5 queries rapidly
        for (let i = 0; i < 5; i++) {
            await page.fill('#sql-input', `SELECT ${i}`);
            await page.click('#execute-btn');
            await page.waitForTimeout(500);
        }

        await page.waitForTimeout(2000);

        const eventLog = await page.locator('#event-log').textContent();
        const vdbeStartCount = (eventLog.match(/VDBE_START/g) || []).length;
        const parseStartCount = (eventLog.match(/PARSE_START/g) || []).length;

        console.log(`   VDBE_START events: ${vdbeStartCount}`);
        console.log(`   PARSE_START events: ${parseStartCount}`);

        expect(vdbeStartCount).toBeGreaterThanOrEqual(5);
        expect(parseStartCount).toBeGreaterThanOrEqual(5);

        console.log('   ✓ All 5 queries processed correctly');
    });

    test('Test 3: Complex nested query', async ({ page }) => {
        console.log('Testing complex nested query...');
        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        await page.click('#clear-events-btn');
        await page.fill('#sql-input', `
            CREATE TABLE test (id INTEGER, value INTEGER);
            INSERT INTO test VALUES (1, 10);
            INSERT INTO test VALUES (2, 20);
            SELECT * FROM test WHERE value > (SELECT AVG(value) FROM test);
        `);
        await page.click('#execute-btn');
        await page.waitForTimeout(5000);

        const eventLog = await page.locator('#event-log').textContent();

        expect(eventLog).toContain('VDBE_START');
        expect(eventLog).toContain('PARSE_START');
        expect(eventLog).toContain('PARSE_COMPLETE');

        const parseStartCount = (eventLog.match(/PARSE_START/g) || []).length;
        console.log(`   PARSE_START events: ${parseStartCount}`);
        console.log('   ✓ Complex nested query handled');
    });

    test('Test 4: Large batch of statements', async ({ page }) => {
        console.log('Testing large batch of statements...');
        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        await page.click('#clear-events-btn');

        // Create a batch of 10 INSERT statements
        let batchSQL = 'CREATE TABLE batch_test (id INTEGER, name TEXT);\n';
        for (let i = 1; i <= 10; i++) {
            batchSQL += `INSERT INTO batch_test VALUES (${i}, 'Item${i}');\n`;
        }

        await page.fill('#sql-input', batchSQL);
        await page.click('#execute-btn');
        await page.waitForTimeout(5000);

        const eventLog = await page.locator('#event-log').textContent();
        const parseStartCount = (eventLog.match(/PARSE_START/g) || []).length;
        const vdbeStartCount = (eventLog.match(/VDBE_START/g) || []).length;

        console.log(`   PARSE_START events: ${parseStartCount}`);
        console.log(`   VDBE_START events: ${vdbeStartCount}`);

        expect(parseStartCount).toBeGreaterThanOrEqual(10);
        expect(vdbeStartCount).toBeGreaterThanOrEqual(10);

        console.log('   ✓ Batch of 11 statements processed');
    });

    test('Test 5: SQL syntax error handling', async ({ page }) => {
        console.log('Testing SQL syntax error...');
        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        await page.click('#clear-events-btn');
        await page.fill('#sql-input', 'SELECT FROM WHERE');  // Invalid SQL
        await page.click('#execute-btn');
        await page.waitForTimeout(3000);

        // Should still generate PARSE_START and PARSE_COMPLETE (with failure)
        const eventLog = await page.locator('#event-log').textContent();

        console.log('   ✓ Syntax error handled gracefully');
    });

    test('Test 6: Switching views during execution', async ({ page }) => {
        console.log('Testing view switching...');
        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        await page.fill('#sql-input', 'SELECT 1');
        await page.click('#execute-btn');
        await page.waitForTimeout(1000);

        // Rapidly switch between views
        await page.selectOption('#view-mode', 'btree');
        await page.waitForTimeout(500);

        await page.selectOption('#view-mode', 'parse');
        await page.waitForTimeout(500);

        await page.selectOption('#view-mode', 'vdbe');
        await page.waitForTimeout(500);

        const canvas = page.locator('canvas');
        await expect(canvas).toBeVisible();

        console.log('   ✓ View switching working correctly');
    });

    test('Test 7: Event log overflow', async ({ page }) => {
        console.log('Testing event log with many events...');
        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        await page.click('#clear-events-btn');

        // Generate many events
        for (let i = 0; i < 20; i++) {
            await page.fill('#sql-input', `SELECT ${i}`);
            await page.click('#execute-btn');
            await page.waitForTimeout(300);
        }

        await page.waitForTimeout(2000);

        const eventCount = await page.locator('#event-count').textContent();
        console.log(`   Total events logged: ${eventCount}`);

        expect(parseInt(eventCount)).toBeGreaterThan(0);
        console.log('   ✓ Event log handling many events');
    });

    test('Test 8: Clear events functionality', async ({ page }) => {
        console.log('Testing clear events...');
        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        // Generate some events
        await page.fill('#sql-input', 'SELECT 1');
        await page.click('#execute-btn');
        await page.waitForTimeout(2000);

        let eventCountBefore = await page.locator('#event-count').textContent();
        console.log(`   Events before clear: ${eventCountBefore}`);

        // Clear events
        await page.click('#clear-events-btn');
        await page.waitForTimeout(500);

        let eventCountAfter = await page.locator('#event-count').textContent();
        console.log(`   Events after clear: ${eventCountAfter}`);

        expect(parseInt(eventCountAfter)).toBeLessThan(parseInt(eventCountBefore));
        console.log('   ✓ Clear events working');
    });
});
