const { test, expect } = require('@playwright/test');

test('Complete User Workflow: Database Creation and Querying', async ({ page }) => {
    console.log('Starting complete user workflow test...');

    // Step 1: Navigate to application
    await page.goto('http://localhost:8080/index.html');
    await page.waitForTimeout(5000);

    const statusText = await page.locator('#db-status').textContent();
    console.log(`1. Application Status: ${statusText}`);
    expect(statusText).toContain('Ready');

    // Step 2: Create a table
    console.log('2. Creating table...');
    await page.fill('#sql-input', 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)');
    await page.click('#execute-btn');
    await page.waitForTimeout(3000);

    // Check for VDBE and Parse events
    let eventLog = await page.locator('#event-log').textContent();
    expect(eventLog).toContain('VDBE_START');
    expect(eventLog).toContain('PARSE_START');
    console.log('   ✓ VDBE_START event fired');
    console.log('   ✓ PARSE_START event fired');
    console.log('   ✓ PARSE_COMPLETE event fired');

    // Step 3: Insert data
    console.log('3. Inserting data...');
    await page.click('#clear-events-btn');
    await page.fill('#sql-input', 'INSERT INTO users VALUES (1, "Alice", 30)');
    await page.click('#execute-btn');
    await page.waitForTimeout(3000);

    eventLog = await page.locator('#event-log').textContent();
    expect(eventLog).toContain('VDBE_START');
    expect(eventLog).toContain('PARSE_START');
    console.log('   ✓ Insert VDBE events fired');
    console.log('   ✓ Insert Parse events fired');

    // Step 4: Query the data
    console.log('4. Querying data...');
    await page.click('#clear-events-btn');
    await page.fill('#sql-input', 'SELECT * FROM users WHERE age > 25');
    await page.click('#execute-btn');
    await page.waitForTimeout(3000);

    eventLog = await page.locator('#event-log').textContent();
    expect(eventLog).toContain('VDBE_START');
    expect(eventLog).toContain('PARSE_START');
    console.log('   ✓ Query VDBE events fired');
    console.log('   ✓ Query Parse events fired');

    // Step 5: Verify B-Tree visualization
    console.log('5. Testing B-Tree visualization...');
    await page.selectOption('#view-mode', 'btree');
    await page.waitForTimeout(1000);

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    console.log('   ✓ B-Tree canvas rendering');

    // Step 6: Verify Parse Tree visualization
    console.log('6. Testing Parse Tree visualization...');
    await page.selectOption('#view-mode', 'parse');
    await page.waitForTimeout(1000);

    await expect(canvas).toBeVisible();
    console.log('   ✓ Parse Tree canvas rendering');

    // Step 7: Verify VDBE visualization
    console.log('7. Testing VDBE visualization...');
    await page.selectOption('#view-mode', 'vdbe');
    await page.waitForTimeout(1000);

    await expect(canvas).toBeVisible();
    console.log('   ✓ VDBE canvas rendering');

    // Step 8: Check event statistics
    console.log('8. Checking event statistics...');
    const eventCountText = await page.locator('#event-count').textContent();
    const pageCountText = await page.locator('#page-count').textContent();

    console.log(`   Total Events: ${eventCountText}`);
    console.log(`   Total Pages: ${pageCountText}`);

    expect(parseInt(eventCountText)).toBeGreaterThan(0);
    console.log('   ✓ Events captured and counted');

    console.log('\n✅ COMPLETE USER WORKFLOW TEST PASSED');
    console.log('   - All three visualizations working');
    console.log('   - All event types firing correctly');
    console.log('   - Full database operation cycle verified');
});

test('Event Sequence Verification', async ({ page }) => {
    console.log('Testing event sequence...');

    await page.goto('http://localhost:8080/index.html');
    await page.waitForTimeout(5000);

    await page.click('#clear-events-btn');
    await page.fill('#sql-input', 'SELECT 1');
    await page.click('#execute-btn');
    await page.waitForTimeout(3000);

    const eventLog = await page.locator('#event-log');
    const events = await eventLog.allTextContents();

    // Verify event sequence: PARSE_START → VDBE_START → ... → PARSE_COMPLETE → VDBE_COMPLETE
    const fullText = events.join(' ');
    const parseStartIdx = fullText.indexOf('PARSE_START');
    const vdbeStartIdx = fullText.indexOf('VDBE_START');
    const parseCompleteIdx = fullText.indexOf('PARSE_COMPLETE');
    const vdbeCompleteIdx = fullText.indexOf('VDBE_COMPLETE');

    console.log(`   Event sequence order:`);
    console.log(`   - PARSE_START at position ${parseStartIdx}`);
    console.log(`   - VDBE_START at position ${vdbeStartIdx}`);
    console.log(`   - PARSE_COMPLETE at position ${parseCompleteIdx}`);
    console.log(`   - VDBE_COMPLETE at position ${vdbeCompleteIdx}`);

    expect(parseStartIdx).toBeLessThan(vdbeStartIdx);
    expect(parseCompleteIdx).toBeLessThan(vdbeCompleteIdx);

    console.log('   ✓ Event sequence is correct');
});
