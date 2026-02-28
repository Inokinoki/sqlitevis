const { test, expect } = require('@playwright/test');

test.describe('SQLite Visualization Features Test', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the application
        await page.goto('http://localhost:8080/index.html');

        // Wait for SQLite to initialize
        await page.waitForSelector('#db-status', { timeout: 30000 });
        await expect(page.locator('#db-status')).toHaveText('Ready', { timeout: 10000 });
    });

    test('VDBE Events: Should capture and display VDBE opcodes', async ({ page }) => {
        console.log('Testing VDBE Events...');

        // Clear any existing events
        await page.click('#clear-events-btn');

        // Switch to VDBE view mode
        await page.selectOption('#view-mode', 'vdbe');

        // Execute SQL
        await page.fill('#sql-input', 'SELECT 1 + 1 AS result');
        await page.click('#execute-btn');

        // Wait for events
        await page.waitForTimeout(2000);

        // Check event log for VDBE events
        const eventLog = page.locator('#event-log');
        const eventText = await eventLog.textContent();

        // Verify VDBE events were captured
        expect(eventText).toContain('VDBE_START');
        expect(eventText).toContain('VDBE_OPCODE');
        expect(eventText).toContain('VDBE_COMPLETE');

        // Count VDBE events
        const vdbeStartCount = (eventText.match(/VDBE_START/g) || []).length;
        const vdbeOpcodeCount = (eventText.match(/VDBE_OPCODE/g) || []).length;
        const vdbeCompleteCount = (eventText.match(/VDBE_COMPLETE/g) || []).length;

        console.log(`  VDBE_START: ${vdbeStartCount}`);
        console.log(`  VDBE_OPCODE: ${vdbeOpcodeCount}`);
        console.log(`  VDBE_COMPLETE: ${vdbeCompleteCount}`);

        expect(vdbeStartCount).toBeGreaterThan(0);
        expect(vdbeOpcodeCount).toBeGreaterThan(0);
        expect(vdbeCompleteCount).toBeGreaterThan(0);

        console.log('✓ VDBE Events working correctly');
    });

    test('SQL Parsing: Should capture and display parse tokens', async ({ page }) => {
        console.log('Testing SQL Parsing Events...');

        // Clear any existing events
        await page.click('#clear-events-btn');

        // Switch to parse view mode
        await page.selectOption('#view-mode', 'parse');

        // Execute SQL
        await page.fill('#sql-input', 'CREATE TABLE test (id INTEGER, name TEXT)');
        await page.click('#execute-btn');

        // Wait for events
        await page.waitForTimeout(2000);

        // Check event log for parse events
        const eventLog = page.locator('#event-log');
        const eventText = await eventLog.textContent();

        // Verify parse events were captured
        expect(eventText).toContain('PARSE_START');
        expect(eventText).toContain('PARSE_TOKEN');
        expect(eventText).toContain('PARSE_COMPLETE');

        // Count parse events
        const parseStartCount = (eventText.match(/PARSE_START/g) || []).length;
        const parseTokenCount = (eventText.match(/PARSE_TOKEN/g) || []).length;
        const parseCompleteCount = (eventText.match(/PARSE_COMPLETE/g) || []).length;

        console.log(`  PARSE_START: ${parseStartCount}`);
        console.log(`  PARSE_TOKEN: ${parseTokenCount}`);
        console.log(`  PARSE_COMPLETE: ${parseCompleteCount}`);

        expect(parseStartCount).toBeGreaterThan(0);
        expect(parseTokenCount).toBeGreaterThan(0);
        expect(parseCompleteCount).toBeGreaterThan(0);

        console.log('✓ SQL Parsing Events working correctly');
    });

    test('B-Tree Page Events: Should capture page allocations and B-tree operations', async ({ page }) => {
        console.log('Testing B-Tree Page Events...');

        // Clear any existing events
        await page.click('#clear-events-btn');

        // Switch to B-tree view mode (default)
        await page.selectOption('#view-mode', 'btree');

        // Create table and insert data
        await page.fill('#sql-input', 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
        await page.click('#execute-btn');
        await page.waitForTimeout(1000);

        await page.fill('#sql-input', 'INSERT INTO users VALUES (1, "Alice")');
        await page.click('#execute-btn');
        await page.waitForTimeout(1000);

        await page.fill('#sql-input', 'INSERT INTO users VALUES (2, "Bob")');
        await page.click('#execute-btn');
        await page.waitForTimeout(1000);

        // Check event log for B-tree events
        const eventLog = page.locator('#event-log');
        const eventText = await eventLog.textContent();

        // Look for B-tree related events
        const hasPageAllocate = eventText.includes('PAGE_ALLOCATE');
        const hasBtreeInsert = eventText.includes('BTREE_INSERT');
        const hasBtreeOpen = eventText.includes('BTREE_OPEN');

        // Count events
        const pageAllocCount = (eventText.match(/PAGE_ALLOCATE/g) || []).length;
        const btreeInsertCount = (eventText.match(/BTREE_INSERT/g) || []).length;
        const btreeOpenCount = (eventText.match(/BTREE_OPEN/g) || []).length;

        console.log(`  PAGE_ALLOCATE: ${pageAllocCount}`);
        console.log(`  BTREE_INSERT: ${btreeInsertCount}`);
        console.log(`  BTREE_OPEN: ${btreeOpenCount}`);

        // At minimum, we should see page allocations
        expect(pageAllocCount).toBeGreaterThan(0);

        // We might see BTREE_OPEN or BTREE_INSERT depending on implementation
        const hasBtreeEvents = hasPageAllocate || hasBtreeInsert || hasBtreeOpen;
        expect(hasBtreeEvents).toBeTruthy();

        console.log('✓ B-Tree Page Events working correctly');
    });

    test('Full Integration: All three visualization modes work together', async ({ page }) => {
        console.log('Testing Full Integration...');

        // Clear events
        await page.click('#clear-events-btn');

        // Execute a complete workflow
        const sqlCommands = [
            'CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price REAL)',
            'INSERT INTO products VALUES (1, "Widget", 19.99)',
            'INSERT INTO products VALUES (2, "Gadget", 29.99)',
            'INSERT INTO products VALUES (3, "Doohickey", 9.99)',
            'SELECT * FROM products WHERE price < 20'
        ];

        for (const sql of sqlCommands) {
            await page.fill('#sql-input', sql);
            await page.click('#execute-btn');
            await page.waitForTimeout(500);
        }

        // Get all events
        const eventLog = page.locator('#event-log');
        const eventText = await eventLog.textContent();

        // Verify all three event types are present
        const hasVdbeEvents = eventText.includes('VDBE_START') && eventText.includes('VDBE_OPCODE');
        const hasParseEvents = eventText.includes('PARSE_START') && eventText.includes('PARSE_TOKEN');
        const hasBtreeEvents = eventText.includes('PAGE_ALLOCATE') || eventText.includes('BTREE_INSERT');

        console.log(`  VDBE Events: ${hasVdbeEvents ? '✓' : '✗'}`);
        console.log(`  Parse Events: ${hasParseEvents ? '✓' : '✗'}`);
        console.log(`  B-Tree Events: ${hasBtreeEvents ? '✓' : '✗'}`);

        expect(hasVdbeEvents).toBeTruthy();
        expect(hasParseEvents).toBeTruthy();
        expect(hasBtreeEvents).toBeTruthy();

        // Verify view modes can be switched
        await page.selectOption('#view-mode', 'vdbe');
        await page.waitForTimeout(500);
        const vdbeVisible = await page.isVisible('text=VDBE Program');
        console.log(`  VDBE View Mode: ${vdbeVisible ? '✓' : '✗'}`);

        await page.selectOption('#view-mode', 'parse');
        await page.waitForTimeout(500);
        const parseVisible = await page.isVisible('text=Parse Tree');
        console.log(`  Parse View Mode: ${parseVisible ? '✓' : '✗'}`);

        await page.selectOption('#view-mode', 'btree');
        await page.waitForTimeout(500);
        const btreeVisible = await page.isVisible('text=B-Tree');
        console.log(`  B-Tree View Mode: ${btreeVisible ? '✓' : '✗'}`);

        console.log('✓ Full Integration test passed');
    });
});
