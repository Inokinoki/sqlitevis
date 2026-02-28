const { test, expect } = require('@playwright/test');

test.describe('Data Volume and Complexity Testing', () => {

    test('Small dataset (10 records)', async ({ page }) => {
        console.log('Testing small dataset...');

        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        await page.click('#clear-events-btn');

        // Create table and insert 10 records
        let sql = 'CREATE TABLE small_test (id INTEGER, value TEXT);\n';
        for (let i = 1; i <= 10; i++) {
            sql += `INSERT INTO small_test VALUES (${i}, 'Record${i}');\n`;
        }

        await page.fill('#sql-input', sql);
        await page.click('#execute-btn');
        await page.waitForTimeout(5000);

        const eventLog = await page.locator('#event-log').textContent();
        const parseCount = (eventLog.match(/PARSE_START/g) || []).length;
        const vdbeCount = (eventLog.match(/VDBE_START/g) || []).length;

        console.log(`   PARSE_START events: ${parseCount}`);
        console.log(`   VDBE_START events: ${vdbeCount}`);

        expect(parseCount).toBeGreaterThanOrEqual(10);
        expect(vdbeCount).toBeGreaterThanOrEqual(10);

        console.log('   ✓ Small dataset handled correctly');
    });

    test('Medium dataset (50 records)', async ({ page }) => {
        console.log('Testing medium dataset...');

        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        await page.click('#clear-events-btn');

        // Create and insert 50 records
        let sql = 'CREATE TABLE medium_test (id INTEGER, data TEXT);\n';
        for (let i = 1; i <= 50; i++) {
            sql += `INSERT INTO medium_test VALUES (${i}, 'Data${i}');\n`;
        }

        await page.fill('#sql-input', sql);
        await page.click('#execute-btn');
        await page.waitForTimeout(10000);

        const eventLog = await page.locator('#event-log').textContent();
        const parseCount = (eventLog.match(/PARSE_START/g) || []).length;
        const vdbeCount = (eventLog.match(/VDBE_START/g) || []).length;

        console.log(`   PARSE_START events: ${parseCount}`);
        console.log(`   VDBE_START events: ${vdbeCount}`);

        expect(parseCount).toBeGreaterThanOrEqual(50);
        expect(vdbeCount).toBeGreaterThanOrEqual(50);

        console.log('   ✓ Medium dataset handled correctly');
    });

    test('Complex JOIN operations', async ({ page }) => {
        console.log('Testing complex JOIN...');

        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        await page.click('#clear-events-btn');

        const sql = `
            CREATE TABLE users (id INTEGER, name TEXT, dept_id INTEGER);
            CREATE TABLE departments (id INTEGER, name TEXT);
            INSERT INTO users VALUES (1, 'Alice', 1);
            INSERT INTO users VALUES (2, 'Bob', 2);
            INSERT INTO departments VALUES (1, 'Engineering');
            INSERT INTO departments VALUES (2, 'Sales');
            SELECT users.name, departments.name
            FROM users
            JOIN departments ON users.dept_id = departments.id;
        `;

        await page.fill('#sql-input', sql);
        await page.click('#execute-btn');
        await page.waitForTimeout(5000);

        const eventLog = await page.locator('#event-log').textContent();

        expect(eventLog).toContain('PARSE_START');
        expect(eventLog).toContain('VDBE_START');
        expect(eventLog).toContain('PARSE_COMPLETE');
        expect(eventLog).toContain('PAGE_ALLOCATE');

        console.log('   ✓ Complex JOIN handled correctly');
    });

    test('Transaction handling', async ({ page }) => {
        console.log('Testing transaction...');

        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        await page.click('#clear-events-btn');

        const sql = `
            CREATE TABLE trans_test (id INTEGER, value TEXT);
            BEGIN TRANSACTION;
            INSERT INTO trans_test VALUES (1, 'A');
            INSERT INTO trans_test VALUES (2, 'B');
            INSERT INTO trans_test VALUES (3, 'C');
            COMMIT;
        `;

        await page.fill('#sql-input', sql);
        await page.click('#execute-btn');
        await page.waitForTimeout(5000);

        const eventLog = await page.locator('#event-log').textContent();

        expect(eventLog).toContain('PARSE_START');
        expect(eventLog).toContain('VDBE_START');

        console.log('   ✓ Transaction handled correctly');
    });

    test('Aggregate functions', async ({ page }) => {
        console.log('Testing aggregate functions...');

        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        await page.click('#clear-events-btn');

        const sql = `
            CREATE TABLE sales (id INTEGER, amount INTEGER);
            INSERT INTO sales VALUES (1, 100);
            INSERT INTO sales VALUES (2, 200);
            INSERT INTO sales VALUES (3, 300);
            SELECT COUNT(*), SUM(amount), AVG(amount), MAX(amount), MIN(amount) FROM sales;
        `;

        await page.fill('#sql-input', sql);
        await page.click('#execute-btn');
        await page.waitForTimeout(5000);

        const eventLog = await page.locator('#event-log').textContent();

        expect(eventLog).toContain('PARSE_START');
        expect(eventLog).toContain('PARSE_COMPLETE');
        expect(eventLog).toContain('VDBE_START');

        console.log('   ✓ Aggregate functions handled correctly');
    });

    test('Subquery testing', async ({ page }) => {
        console.log('Testing subqueries...');

        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        await page.click('#clear-events-btn');

        const sql = `
            CREATE TABLE products (id INTEGER, price INTEGER, category INTEGER);
            INSERT INTO products VALUES (1, 100, 1);
            INSERT INTO products VALUES (2, 200, 1);
            INSERT INTO products VALUES (3, 150, 2);
            SELECT * FROM products WHERE price > (SELECT AVG(price) FROM products);
        `;

        await page.fill('#sql-input', sql);
        await page.click('#execute-btn');
        await page.waitForTimeout(5000);

        const eventLog = await page.locator('#event-log').textContent();

        expect(eventLog).toContain('PARSE_START');
        expect(eventLog).toContain('VDBE_START');

        const parseCount = (eventLog.match(/PARSE_START/g) || []).length;
        console.log(`   PARSE_START events: ${parseCount}`);

        console.log('   ✓ Subquery handled correctly');
    });
});
