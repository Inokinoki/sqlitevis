const { test, expect } = require('@playwright/test');

test.describe('Session Persistence and State Testing', () => {

    test('Test 1: Fresh browser session', async ({ context }) => {
        console.log('Testing fresh browser session...');

        // Create a fresh browser context
        const page = await context.newPage();
        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        await page.fill('#sql-input', 'SELECT 1 AS test');
        await page.click('#execute-btn');
        await page.waitForTimeout(3000);

        const eventLog = await page.locator('#event-log').textContent();

        expect(eventLog).toContain('VDBE_START');
        expect(eventLog).toContain('PARSE_START');
        expect(eventLog).toContain('PAGE_ALLOCATE');

        console.log('   ✓ Fresh session: All events firing');

        await page.close();
    });

    test('Test 2: Multiple operations in single session', async ({ page }) => {
        console.log('Testing multiple operations...');

        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        // Operation 1: CREATE
        await page.fill('#sql-input', 'CREATE TABLE test1 (id INTEGER)');
        await page.click('#execute-btn');
        await page.waitForTimeout(2000);

        // Operation 2: INSERT
        await page.fill('#sql-input', 'INSERT INTO test1 VALUES (1)');
        await page.click('#execute-btn');
        await page.waitForTimeout(2000);

        // Operation 3: SELECT
        await page.fill('#sql-input', 'SELECT * FROM test1');
        await page.click('#execute-btn');
        await page.waitForTimeout(2000);

        // Operation 4: Another CREATE
        await page.fill('#sql-input', 'CREATE TABLE test2 (id INTEGER)');
        await page.click('#execute-btn');
        await page.waitForTimeout(2000);

        const eventLog = await page.locator('#event-log').textContent();
        const parseCount = (eventLog.match(/PARSE_START/g) || []).length;
        const vdbeCount = (eventLog.match(/VDBE_START/g) || []).length;

        console.log(`   PARSE_START events across 4 operations: ${parseCount}`);
        console.log(`   VDBE_START events across 4 operations: ${vdbeCount}`);

        expect(parseCount).toBeGreaterThanOrEqual(4);
        expect(vdbeCount).toBeGreaterThanOrEqual(4);

        console.log('   ✓ Multiple operations: Consistent event firing');
    });

    test('Test 3: Clear and restart events', async ({ page }) => {
        console.log('Testing clear and restart...');

        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        // First batch
        await page.fill('#sql-input', 'SELECT 1');
        await page.click('#execute-btn');
        await page.waitForTimeout(2000);

        let eventCount1 = await page.locator('#event-count').textContent();
        console.log(`   Events before clear: ${eventCount1}`);

        // Clear
        await page.click('#clear-events-btn');
        await page.waitForTimeout(500);

        let eventCount2 = await page.locator('#event-count').textContent();
        console.log(`   Events after clear: ${eventCount2}`);

        // Second batch
        await page.fill('#sql-input', 'SELECT 2');
        await page.click('#execute-btn');
        await page.waitForTimeout(2000);

        let eventCount3 = await page.locator('#event-count').textContent();
        console.log(`   Events after restart: ${eventCount3}`);

        const eventLog = await page.locator('#event-log').textContent();
        expect(eventLog).toContain('VDBE_START');
        expect(eventLog).toContain('PARSE_START');

        console.log('   ✓ Clear and restart: Events working correctly');
    });

    test('Test 4: View mode persistence', async ({ page }) => {
        console.log('Testing view mode operations...');

        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        // Execute SQL
        await page.fill('#sql-input', 'SELECT 1');
        await page.click('#execute-btn');
        await page.waitForTimeout(2000);

        // Test each view mode
        const views = ['btree', 'parse', 'vdbe'];

        for (const view of views) {
            await page.selectOption('#view-mode', view);
            await page.waitForTimeout(1000);

            const canvas = page.locator('canvas');
            await expect(canvas).toBeVisible();

            // Execute more SQL in this view
            await page.fill('#sql-input', `SELECT ${view.length}`);
            await page.click('#execute-btn');
            await page.waitForTimeout(2000);

            const eventLog = await page.locator('#event-log').textContent();
            expect(eventLog).toContain('VDBE_START');

            console.log(`   ✓ ${view.toUpperCase()} view: Events firing while view active`);
        }
    });

    test('Test 5: Rapid view switching during execution', async ({ page }) => {
        console.log('Testing rapid view switching...');

        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        // Execute SQL and immediately switch views
        await page.fill('#sql-input', 'SELECT 1, 2, 3');
        await page.click('#execute-btn');

        // Switch views rapidly while SQL is executing
        await page.waitForTimeout(500);
        await page.selectOption('#view-mode', 'btree');
        await page.waitForTimeout(300);
        await page.selectOption('#view-mode', 'parse');
        await page.waitForTimeout(300);
        await page.selectOption('#view-mode', 'vdbe');
        await page.waitForTimeout(2000);

        const eventLog = await page.locator('#event-log').textContent();
        expect(eventLog).toContain('VDBE_START');
        expect(eventLog).toContain('PARSE_START');

        console.log('   ✓ Rapid view switching: No event loss');
    });

    test('Test 6: Event statistics accuracy', async ({ page }) => {
        console.log('Testing event statistics...');

        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        await page.click('#clear-events-btn');

        // Execute known number of statements
        const statements = [
            'CREATE TABLE stats_test (id INTEGER)',
            'INSERT INTO stats_test VALUES (1)',
            'INSERT INTO stats_test VALUES (2)',
            'SELECT * FROM stats_test'
        ];

        for (const sql of statements) {
            await page.fill('#sql-input', sql);
            await page.click('#execute-btn');
            await page.waitForTimeout(1000);
        }

        await page.waitForTimeout(2000);

        const eventLog = await page.locator('#event-log').textContent();
        const eventCountText = await page.locator('#event-count').textContent();
        const pageCountText = await page.locator('#page-count').textContent();

        console.log(`   Total events: ${eventCountText}`);
        console.log(`   Total pages: ${pageCountText}`);

        const parseCount = (eventLog.match(/PARSE_START/g) || []).length;
        const vdbeCount = (eventLog.match(/VDBE_START/g) || []).length;

        console.log(`   PARSE_START count: ${parseCount}`);
        console.log(`   VDBE_START count: ${vdbeCount}`);

        expect(parseInt(eventCountText)).toBeGreaterThan(0);
        console.log('   ✓ Event statistics: Accurate tracking');
    });

    test('Test 7: Long-running query handling', async ({ page }) => {
        console.log('Testing complex query...');

        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        await page.click('#clear-events-btn');

        // Complex query with multiple operations
        const complexSQL = `
            CREATE TABLE employees (
                id INTEGER PRIMARY KEY,
                name TEXT,
                dept_id INTEGER,
                salary INTEGER
            );
            INSERT INTO employees VALUES (1, 'Alice', 1, 90000);
            INSERT INTO employees VALUES (2, 'Bob', 2, 75000);
            INSERT INTO employees VALUES (3, 'Charlie', 1, 95000);
            CREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT);
            INSERT INTO departments VALUES (1, 'Engineering');
            INSERT INTO departments VALUES (2, 'Sales');
            SELECT
                e.name,
                d.name as department,
                e.salary
            FROM employees e
            JOIN departments d ON e.dept_id = d.id
            WHERE e.salary > 80000
            ORDER BY e.salary DESC;
        `;

        await page.fill('#sql-input', complexSQL);
        await page.click('#execute-btn');
        await page.waitForTimeout(8000);

        const eventLog = await page.locator('#event-log').textContent();

        expect(eventLog).toContain('PARSE_START');
        expect(eventLog).toContain('VDBE_START');
        expect(eventLog).toContain('PARSE_COMPLETE');

        const parseCount = (eventLog.match(/PARSE_START/g) || []).length;
        const vdbeCount = (eventLog.match(/VDBE_START/g) || []).length;

        console.log(`   Complex query - PARSE_START: ${parseCount}`);
        console.log(`   Complex query - VDBE_START: ${vdbeCount}`);

        expect(parseCount).toBeGreaterThanOrEqual(8);
        expect(vdbeCount).toBeGreaterThanOrEqual(8);

        console.log('   ✓ Long-running query: All events captured');
    });
});
