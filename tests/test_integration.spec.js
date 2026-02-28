const { test, expect } = require('@playwright/test');

test.describe('Cross-Feature Integration Testing', () => {

    test('Integration 1: All three features with complex SQL', async ({ page }) => {
        console.log('Testing all features with complex SQL...');

        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        await page.click('#clear-events-btn');

        // Complex SQL that exercises all features
        const complexSQL = `
            CREATE TABLE products (
                id INTEGER PRIMARY KEY,
                name TEXT,
                category TEXT,
                price INTEGER
            );
            INSERT INTO products VALUES (1, 'Laptop', 'Electronics', 1000);
            INSERT INTO products VALUES (2, 'Mouse', 'Electronics', 25);
            INSERT INTO products VALUES (3, 'Desk', 'Furniture', 500);
            INSERT INTO products VALUES (4, 'Chair', 'Furniture', 200);

            CREATE TABLE orders (
                id INTEGER PRIMARY KEY,
                product_id INTEGER,
                quantity INTEGER,
                date TEXT
            );
            INSERT INTO orders VALUES (1, 1, 2, '2024-01-01');
            INSERT INTO orders VALUES (2, 3, 1, '2024-01-02');

            SELECT
                p.name,
                p.category,
                p.price,
                o.quantity,
                (p.price * o.quantity) as total
            FROM products p
            LEFT JOIN orders o ON p.id = o.product_id
            WHERE p.price > 100
            ORDER BY p.category, p.price DESC;
        `;

        await page.fill('#sql-input', complexSQL);
        await page.click('#execute-btn');
        await page.waitForTimeout(8000);

        const eventLog = await page.locator('#event-log').textContent();

        // Verify all three feature types
        expect(eventLog).toContain('VDBE_START');
        expect(eventLog).toContain('PARSE_START');
        expect(eventLog).toContain('PARSE_COMPLETE');
        expect(eventLog).toContain('PAGE_ALLOCATE');

        const vdbeCount = (eventLog.match(/VDBE_START/g) || []).length;
        const parseCount = (eventLog.match(/PARSE_START/g) || []).length;
        const pageCount = (eventLog.match(/PAGE_ALLOCATE/g) || []).length;

        console.log(`   VDBE_START events: ${vdbeCount}`);
        console.log(`   PARSE_START events: ${parseCount}`);
        console.log(`   PAGE_ALLOCATE events: ${pageCount}`);

        // Verify all visualizations
        await page.selectOption('#view-mode', 'vdbe');
        await page.waitForTimeout(1000);
        await expect(page.locator('canvas')).toBeVisible();
        console.log('   ✓ VDBE visualization working');

        await page.selectOption('#view-mode', 'parse');
        await page.waitForTimeout(1000);
        await expect(page.locator('canvas')).toBeVisible();
        console.log('   ✓ Parse visualization working');

        await page.selectOption('#view-mode', 'btree');
        await page.waitForTimeout(1000);
        await expect(page.locator('canvas')).toBeVisible();
        console.log('   ✓ B-Tree visualization working');

        console.log('   ✓ Integration test passed: All features working together');
    });

    test('Integration 2: Rapid feature switching', async ({ page }) => {
        console.log('Testing rapid feature switching...');

        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        await page.click('#clear-events-btn');

        // Execute multiple queries while rapidly switching views
        const queries = [
            'CREATE TABLE test1 (id INTEGER)',
            'INSERT INTO test1 VALUES (1)',
            'SELECT * FROM test1'
        ];

        for (const sql of queries) {
            await page.fill('#sql-input', sql);
            await page.click('#execute-btn');
            await page.waitForTimeout(500);

            // Switch views during execution
            await page.selectOption('#view-mode', 'vdbe');
            await page.waitForTimeout(200);
            await page.selectOption('#view-mode', 'parse');
            await page.waitForTimeout(200);
            await page.selectOption('#view-mode', 'btree');
            await page.waitForTimeout(1000);
        }

        const eventLog = await page.locator('#event-log').textContent();

        expect(eventLog).toContain('VDBE_START');
        expect(eventLog).toContain('PARSE_START');
        expect(eventLog).toContain('PAGE_ALLOCATE');

        console.log('   ✓ Rapid feature switching: No event loss');
    });

    test('Integration 3: Feature stress test', async ({ page }) => {
        console.log('Testing feature stress...');

        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        await page.click('#clear-events-btn');

        // Execute 20 queries rapidly
        for (let i = 1; i <= 20; i++) {
            await page.fill('#sql-input', `SELECT ${i} AS value`);
            await page.click('#execute-btn');
            await page.waitForTimeout(300);
        }

        await page.waitForTimeout(2000);

        const eventLog = await page.locator('#event-log').textContent();
        const eventCount = await page.locator('#event-count').textContent();

        const vdbeCount = (eventLog.match(/VDBE_START/g) || []).length;
        const parseCount = (eventLog.match(/PARSE_START/g) || []).length;

        console.log(`   Total events logged: ${eventCount}`);
        console.log(`   VDBE_START events: ${vdbeCount}`);
        console.log(`   PARSE_START events: ${parseCount}`);

        expect(vdbeCount).toBeGreaterThanOrEqual(20);
        expect(parseCount).toBeGreaterThanOrEqual(20);

        console.log('   ✓ Feature stress test: All 20 queries processed');
    });

    test('Integration 4: Concurrent feature operation', async ({ page }) => {
        console.log('Testing concurrent feature operation...');

        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        await page.click('#clear-events-btn');

        // Execute complex query while monitoring all features
        const sql = `
            BEGIN;
            CREATE TABLE concurrent_test (id INTEGER, value TEXT);
            INSERT INTO concurrent_test VALUES (1, 'A');
            INSERT INTO concurrent_test VALUES (2, 'B');
            SELECT * FROM concurrent_test;
            COMMIT;
        `;

        await page.fill('#sql-input', sql);
        await page.click('#execute-btn');

        // Switch views during execution
        await page.waitForTimeout(500);
        await page.selectOption('#view-mode', 'vdbe');
        await page.waitForTimeout(500);
        await page.selectOption('#view-mode', 'parse');
        await page.waitForTimeout(500);
        await page.selectOption('#view-mode', 'btree');
        await page.waitForTimeout(3000);

        const eventLog = await page.locator('#event-log').textContent();

        expect(eventLog).toContain('VDBE_START');
        expect(eventLog).toContain('PARSE_START');
        expect(eventLog).toContain('PARSE_COMPLETE');
        expect(eventLog).toContain('PAGE_ALLOCATE');

        console.log('   ✓ Concurrent operation: All features maintained');
    });

    test('Integration 5: Feature reliability over time', async ({ page }) => {
        console.log('Testing feature reliability over time...');

        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        // Execute queries over time and check for degradation
        const cycles = 10;
        const results = [];

        for (let i = 0; i < cycles; i++) {
            await page.click('#clear-events-btn');

            await page.fill('#sql-input', `
                CREATE TABLE cycle_${i} (id INTEGER);
                INSERT INTO cycle_${i} VALUES (${i});
                SELECT * FROM cycle_${i};
            `);
            await page.click('#execute-btn');
            await page.waitForTimeout(2000);

            const eventLog = await page.locator('#event-log').textContent();
            const hasVdbe = eventLog.includes('VDBE_START');
            const hasParse = eventLog.includes('PARSE_START');
            const hasPage = eventLog.includes('PAGE_ALLOCATE');

            results.push({ cycle: i + 1, vdbe: hasVdbe, parse: hasParse, page: hasPage });

            await page.waitForTimeout(1000);
        }

        // Verify no degradation
        const allWorking = results.every(r => r.vdbe && r.parse && r.page);

        console.log(`   Cycles tested: ${cycles}`);
        console.log(`   All cycles working: ${allWorking ? 'Yes' : 'No'}`);

        expect(allWorking).toBe(true);

        console.log('   ✓ Reliability test: No degradation over 10 cycles');
    });
});
