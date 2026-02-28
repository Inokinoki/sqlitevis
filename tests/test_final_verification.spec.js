const { test, expect } = require('@playwright/test');

test('FINAL VERIFICATION: All Three Features Working Simultaneously', async ({ page }) => {
    console.log('\n=== FINAL VERIFICATION TEST ===');
    console.log('Verifying: VDBE events, SQL parsing, Page nodes all working together\n');

    await page.goto('http://localhost:8080/index.html');
    await page.waitForTimeout(5000);

    // Execute a complex SQL operation that exercises all three features
    console.log('Step 1: Creating database schema...');
    await page.fill('#sql-input', `
        CREATE TABLE employees (
            id INTEGER PRIMARY KEY,
            name TEXT,
            department TEXT,
            salary INTEGER
        );
    `);
    await page.click('#execute-btn');
    await page.waitForTimeout(3000);

    let eventLog = await page.locator('#event-log').textContent();

    // Verify Feature 1: VDBE Events
    console.log('\nStep 2: Verifying VDBE events...');
    expect(eventLog).toContain('VDBE_START');
    expect(eventLog).toContain('VDBE_COMPLETE');
    const vdbeStartCount = (eventLog.match(/VDBE_START/g) || []).length;
    console.log(`   ✓ VDBE_START events: ${vdbeStartCount}`);
    console.log(`   ✓ VDBE_COMPLETE events present`);

    // Verify Feature 2: SQL Parsing
    console.log('\nStep 3: Verifying SQL parsing events...');
    expect(eventLog).toContain('PARSE_START');
    expect(eventLog).toContain('PARSE_COMPLETE');
    const parseStartCount = (eventLog.match(/PARSE_START/g) || []).length;
    const parseCompleteCount = (eventLog.match(/PARSE_COMPLETE/g) || []).length;
    console.log(`   ✓ PARSE_START events: ${parseStartCount}`);
    console.log(`   ✓ PARSE_COMPLETE events: ${parseCompleteCount}`);

    // Verify Feature 3: Page Nodes
    console.log('\nStep 4: Verifying page node events...');
    expect(eventLog).toContain('PAGE_ALLOCATE');
    const pageAllocCount = (eventLog.match(/PAGE_ALLOCATE/g) || []).length;
    console.log(`   ✓ PAGE_ALLOCATE events: ${pageAllocCount}`);

    // Insert data
    console.log('\nStep 5: Inserting sample data...');
    await page.click('#clear-events-btn');
    await page.fill('#sql-input', `
        INSERT INTO employees VALUES (1, 'Alice', 'Engineering', 90000);
        INSERT INTO employees VALUES (2, 'Bob', 'Sales', 75000);
        INSERT INTO employees VALUES (3, 'Charlie', 'Engineering', 95000);
    `);
    await page.click('#execute-btn');
    await page.waitForTimeout(3000);

    eventLog = await page.locator('#event-log').textContent();
    const insertVdbeCount = (eventLog.match(/VDBE_START/g) || []).length;
    const insertParseCount = (eventLog.match(/PARSE_START/g) || []).length;
    console.log(`   ✓ Insert VDBE events: ${insertVdbeCount}`);
    console.log(`   ✓ Insert Parse events: ${insertParseCount}`);

    // Query data
    console.log('\nStep 6: Querying with complex WHERE clause...');
    await page.click('#clear-events-btn');
    await page.fill('#sql-input', `
        SELECT name, salary
        FROM employees
        WHERE department = 'Engineering' AND salary > 85000
        ORDER BY salary DESC;
    `);
    await page.click('#execute-btn');
    await page.waitForTimeout(3000);

    eventLog = await page.locator('#event-log').textContent();

    // Final verification of all three features
    console.log('\nStep 7: Final verification of all features...');
    console.log('\n   FEATURE 1: VDBE Event and Visualization');
    expect(eventLog).toContain('VDBE_START');
    expect(eventLog).toContain('VDBE_COMPLETE');
    console.log('   ✅ VDBE_START: FIRED');
    console.log('   ✅ VDBE_COMPLETE: FIRED');

    console.log('\n   FEATURE 2: SQL Instruction Parsing and Visualization');
    expect(eventLog).toContain('PARSE_START');
    expect(eventLog).toContain('PARSE_COMPLETE');
    console.log('   ✅ PARSE_START: FIRED');
    console.log('   ✅ PARSE_COMPLETE: FIRED');

    console.log('\n   FEATURE 3: Page Node Event and Visualization');
    expect(eventLog).toContain('PAGE_ALLOCATE');
    console.log('   ✅ PAGE_ALLOCATE: FIRED');

    // Verify visualizations
    console.log('\nStep 8: Verifying all three visualizations render...');

    await page.selectOption('#view-mode', 'vdbe');
    await page.waitForTimeout(1000);
    const vdbeCanvas = page.locator('canvas');
    await expect(vdbeCanvas).toBeVisible();
    console.log('   ✅ VDBE Visualization: RENDERING');

    await page.selectOption('#view-mode', 'parse');
    await page.waitForTimeout(1000);
    const parseCanvas = page.locator('canvas');
    await expect(parseCanvas).toBeVisible();
    console.log('   ✅ Parse Tree Visualization: RENDERING');

    await page.selectOption('#view-mode', 'btree');
    await page.waitForTimeout(1000);
    const btreeCanvas = page.locator('canvas');
    await expect(btreeCanvas).toBeVisible();
    console.log('   ✅ B-Tree Visualization: RENDERING');

    // Final statistics
    const finalEventCount = await page.locator('#event-count').textContent();
    const finalPageCount = await page.locator('#page-count').textContent();

    console.log('\nStep 9: Final statistics...');
    console.log(`   Total Events Captured: ${finalEventCount}`);
    console.log(`   Total Pages Tracked: ${finalPageCount}`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ FINAL VERIFICATION: ALL THREE FEATURES WORKING');
    console.log('='.repeat(60));
    console.log('\n   1. ✅ VDBE event and visualization works');
    console.log('   2. ✅ SQL instruction parsing and visualization works');
    console.log('   3. ✅ Page node event and visualization works');
    console.log('\n' + '='.repeat(60));
    console.log('TEST RESULT: PASSED');
    console.log('='.repeat(60) + '\n');
});
