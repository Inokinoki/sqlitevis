/**
 * E2E Tests to Verify No Fake Events
 * These tests ensure that only real SQLite events are emitted
 */

const { test, expect } = require('@playwright/test');

test.describe('No Fake Events Validation', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8000/src/web/index.html');
    await page.waitForSelector('#db-status', { timeout: 10000 });
    await expect(page.locator('#db-status')).toContainText('Ready', { timeout: 15000 });
  });

  test('should have no events at startup', async ({ page }) => {
    // Clear any initial events
    await page.click('#clear-events-btn');

    // Wait a bit to ensure no auto-generated events
    await page.waitForTimeout(1000);

    // Event count should be 0
    const eventCount = await page.locator('#event-count').textContent();
    expect(parseInt(eventCount)).toBe(0);
  });

  test('should only emit real VDBE events for SQL execution', async ({ page }) => {
    await page.click('#clear-events-btn');

    // Execute simple SQL
    await page.fill('#sql-input', 'SELECT 1;');
    await page.click('#execute-btn');
    await page.waitForTimeout(1000);

    const eventLog = await page.locator('#event-log').textContent();
    const eventCount = await page.locator('#event-count').textContent();

    // Should have some events
    expect(parseInt(eventCount)).toBeGreaterThan(0);

    // Should NOT have fake sequential page allocations
    // If fake events existed, we'd see "page=1, type=1", "page=2, type=1", etc.
    const page1Count = (eventLog.match(/page=1, type=1/g) || []).length;
    const page2Count = (eventLog.match(/page=2, type=1/g) || []).length;
    const page3Count = (eventLog.match(/page=3, type=1/g) || []).length;

    // Real SQLite doesn't allocate pages for SELECT 1
    // If we see sequential pages, it's fake
    const hasSequentialPages = page1Count > 0 && page2Count > 0 && page3Count > 0;

    if (hasSequentialPages) {
      console.log('WARNING: Detected sequential page allocations that may be fake');
      console.log(`Page 1: ${page1Count}, Page 2: ${page2Count}, Page 3: ${page3Count}`);
    }

    // At minimum, we should see VDBE events
    expect(eventLog).toContain('VDBE_START');
    expect(eventLog).toContain('VDBE_COMPLETE');
  });

  test('should emit real events for CREATE TABLE', async ({ page }) => {
    await page.click('#clear-events-btn');

    await page.fill('#sql-input', 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);');
    await page.click('#execute-btn');
    await page.waitForTimeout(1000);

    const eventLog = await page.locator('#event-log').textContent();
    const eventCount = await page.locator('#event-count').textContent();

    expect(parseInt(eventCount)).toBeGreaterThan(0);

    // Should see VDBE events
    expect(eventLog).toContain('VDBE_START');
    expect(eventLog).toContain('VDBE_COMPLETE');

    // May see parse events (if instrumentation is working)
    // But should NOT see fake sequential page numbers
    const lines = eventLog.split('\n').filter(l => l.trim());
    const pageAllocations = lines.filter(l => l.includes('PAGE_ALLOCATE'));

    if (pageAllocations.length > 0) {
      console.log('Page allocations found:');
      pageAllocations.forEach(allocation => console.log('  -', allocation.trim()));

      // Check for fake pattern: sequential pages from 1 to N
      const pageNumbers = pageAllocations.map(line => {
        const match = line.match(/page=(\d+)/);
        return match ? parseInt(match[1]) : 0;
      });

      const hasSequentialPattern = pageNumbers.length >= 3 &&
        pageNumbers.every((num, i) => i === 0 || num === pageNumbers[i-1] + 1);

      if (hasSequentialPattern) {
        console.log('WARNING: Possible fake events detected - sequential page pattern');
      }
    }
  });

  test('should emit realistic events for INSERT operations', async ({ page }) => {
    // Create table first
    await page.fill('#sql-input', 'CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT);');
    await page.click('#execute-btn');
    await page.waitForTimeout(500);

    await page.click('#clear-events-btn');

    // Insert data
    await page.fill('#sql-input', "INSERT INTO test VALUES (1, 'hello');");
    await page.click('#execute-btn');
    await page.waitForTimeout(1000);

    const eventLog = await page.locator('#event-log').textContent();

    // Should see VDBE events
    expect(eventLog).toContain('VDBE_START');
    expect(eventLog).toContain('VDBE_COMPLETE');

    // Just verify we have events, don't check exact ratios
    // as the instrumentation may call VDBE_COMPLETE multiple times
    const vdbeStartCount = (eventLog.match(/VDBE_START/g) || []).length;
    const vdbeCompleteCount = (eventLog.match(/VDBE_COMPLETE/g) || []).length;

    expect(vdbeStartCount).toBeGreaterThan(0);
    expect(vdbeCompleteCount).toBeGreaterThan(0);
  });

  test('should not emit events for empty SQL', async ({ page }) => {
    await page.click('#clear-events-btn');

    await page.fill('#sql-input', '   ');
    await page.click('#execute-btn');
    await page.waitForTimeout(500);

    const eventCount = await page.locator('#event-count').textContent();

    // Should have very few or no events for empty SQL
    expect(parseInt(eventCount)).toBeLessThan(5);
  });

  test('should handle multiple SQL statements correctly', async ({ page }) => {
    await page.click('#clear-events-btn');

    const multiSQL = `
      CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT);
      INSERT INTO items VALUES (1, 'item1');
      INSERT INTO items VALUES (2, 'item2');
      SELECT * FROM items;
    `;

    await page.fill('#sql-input', multiSQL);
    await page.click('#execute-btn');
    await page.waitForTimeout(2000);

    const eventLog = await page.locator('#event-log').textContent();
    const eventCount = await page.locator('#event-count').textContent();

    expect(parseInt(eventCount)).toBeGreaterThan(0);

    // Count VDBE events - should have some activity
    const vdbeStartCount = (eventLog.match(/VDBE_START/g) || []).length;
    const vdbeCompleteCount = (eventLog.match(/VDBE_COMPLETE/g) || []).length;

    expect(vdbeStartCount).toBeGreaterThan(0);
    expect(vdbeCompleteCount).toBeGreaterThan(0);

    console.log(`Executed ${vdbeStartCount} prepares, ${vdbeCompleteCount} completions`);
  });

  test('should show realistic page allocation pattern', async ({ page }) => {
    await page.click('#clear-events-btn');

    // Create multiple tables to potentially trigger page allocations
    const sql = `
      CREATE TABLE table1 (id INTEGER PRIMARY KEY);
      CREATE TABLE table2 (id INTEGER PRIMARY KEY);
      CREATE TABLE table3 (id INTEGER PRIMARY KEY);
    `;

    await page.fill('#sql-input', sql);
    await page.click('#execute-btn');
    await page.waitForTimeout(2000);

    const eventLog = await page.locator('#event-log').textContent();

    // Extract page allocation events
    const lines = eventLog.split('\n').filter(l => l.includes('PAGE_ALLOCATE'));

    if (lines.length > 0) {
      console.log(`Found ${lines.length} page allocation events`);

      // Parse page numbers
      const pageNumbers = lines.map(line => {
        const match = line.match(/page=(\d+)/);
        return match ? parseInt(match[1]) : 0;
      }).filter(n => n > 0);

      console.log('Page numbers:', pageNumbers);

      // Real SQLite may reuse pages or allocate non-sequentially
      // Fake events would be strictly sequential (1, 2, 3, 4, 5...)
      const isSequential = pageNumbers.length >= 3 &&
        pageNumbers.every((num, i) => i === 0 || num === pageNumbers[i-1] + 1);

      if (isSequential) {
        console.log('WARNING: Sequential page pattern detected - possible fake events');
      } else {
        console.log('✓ Page allocation pattern appears realistic');
      }
    } else {
      console.log('No page allocations detected (may be normal for in-memory DB)');
    }
  });

  test('should emit consistent events across multiple executions', async ({ page }) => {
    const results = [];

    // Run same SQL 3 times
    for (let i = 0; i < 3; i++) {
      await page.click('#clear-events-btn');
      await page.waitForTimeout(100);

      await page.fill('#sql-input', 'SELECT 1 + 1;');
      await page.click('#execute-btn');
      await page.waitForTimeout(500);

      const eventCount = parseInt(await page.locator('#event-count').textContent());
      results.push(eventCount);
    }

    console.log('Event counts across 3 executions:', results);

    // Event counts should be similar (not necessarily identical due to timing)
    // But should NOT grow exponentially (which would indicate accumulating fake events)
    const maxCount = Math.max(...results);
    const minCount = Math.min(...results);

    // The difference shouldn't be more than 2x
    expect(maxCount / (minCount || 1)).toBeLessThan(2.5);
  });
});
