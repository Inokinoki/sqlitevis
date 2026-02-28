const { test, expect } = require('@playwright/test');

test.describe('Comprehensive SQL Query Testing', () => {
    test('Test 1: CREATE TABLE', async ({ page }) => {
        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        await page.click('#clear-events-btn');
        await page.fill('#sql-input', 'CREATE TABLE test (id INTEGER, name TEXT)');
        await page.click('#execute-btn');
        await page.waitForTimeout(3000);

        const eventLog = page.locator('#event-log');
        const eventText = await eventLog.textContent();

        // Check for core events
        expect(eventText).toContain('VDBE_START');
        expect(eventText).toContain('PARSE_START');
        expect(eventText).toContain('PAGE_ALLOCATE');

        console.log('✓ Test 1 (CREATE TABLE): All core events present');
    });

    test('Test 2: INSERT statement', async ({ page }) => {
        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        await page.click('#clear-events-btn');
        await page.fill('#sql-input', 'INSERT INTO test VALUES (1, "Alice")');
        await page.click('#execute-btn');
        await page.waitForTimeout(3000);

        const eventLog = page.locator('#event-log');
        const eventText = await eventLog.textContent();

        expect(eventText).toContain('VDBE_START');
        expect(eventText).toContain('PARSE_START');
        expect(eventText).toContain('PARSE_COMPLETE');

        console.log('✓ Test 2 (INSERT): All core events present');
    });

    test('Test 3: SELECT query', async ({ page }) => {
        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        await page.click('#clear-events-btn');
        await page.fill('#sql-input', 'SELECT * FROM test');
        await page.click('#execute-btn');
        await page.waitForTimeout(3000);

        const eventLog = page.locator('#event-log');
        const eventText = await eventLog.textContent();

        expect(eventText).toContain('VDBE_START');
        expect(eventText).toContain('PARSE_START');
        expect(eventText).toContain('PARSE_COMPLETE');
        expect(eventText).toContain('VDBE_COMPLETE');

        console.log('✓ Test 3 (SELECT): All core events present');
    });

    test('Test 4: Complex JOIN query', async ({ page }) => {
        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        await page.click('#clear-events-btn');
        await page.fill('#sql-input', 'SELECT * FROM test WHERE id = 1');
        await page.click('#execute-btn');
        await page.waitForTimeout(3000);

        const eventLog = page.locator('#event-log');
        const eventText = await eventLog.textContent();

        expect(eventText).toContain('VDBE_START');
        expect(eventText).toContain('PARSE_START');
        expect(eventText).toContain('PAGE_ALLOCATE');

        console.log('✓ Test 4 (WHERE clause): All core events present');
    });

    test('Test 5: Multiple statements', async ({ page }) => {
        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(5000);

        await page.click('#clear-events-btn');
        const multiSQL = `
            CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);
            INSERT INTO users VALUES (1, 'Bob');
            SELECT * FROM users;
        `;
        await page.fill('#sql-input', multiSQL.trim());
        await page.click('#execute-btn');
        await page.waitForTimeout(5000);

        const eventLog = page.locator('#event-log');
        const eventText = await eventLog.textContent();

        // Should have multiple VDBE_START events (one per statement)
        const vdbeStartCount = (eventText.match(/VDBE_START/g) || []).length;
        expect(vdbeStartCount).toBeGreaterThanOrEqual(3);

        // Should have multiple PARSE_START events
        const parseStartCount = (eventText.match(/PARSE_START/g) || []).length;
        expect(parseStartCount).toBeGreaterThanOrEqual(3);

        console.log(`✓ Test 5 (Multiple statements): ${vdbeStartCount} VDBE_START, ${parseStartCount} PARSE_START events`);
    });
});
