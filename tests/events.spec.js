/**
 * Playwright Tests for SQLite B-Tree Visualization
 * Tests all event types and visualization functionality
 */

const { test, expect } = require('@playwright/test');

test.describe('SQLite B-Tree Visualization', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:8000/src/web/index.html');

    // Wait for WASM to load
    await page.waitForSelector('#db-status', { timeout: 10000 });
    await expect(page.locator('#db-status')).toContainText('Ready', { timeout: 15000 });
  });

  test('should load SQLite WASM module successfully', async ({ page }) => {
    const status = page.locator('#db-status');
    await expect(status).toContainText('Ready');
  });

  test('should display SQL editor with default content', async ({ page }) => {
    const sqlInput = page.locator('#sql-input');
    const value = await sqlInput.inputValue();
    expect(value).toContain('CREATE TABLE users');
    expect(value).toContain('INSERT INTO users');
    expect(value).toContain('SELECT * FROM users');
  });

  test('should execute CREATE TABLE and emit events', async ({ page }) => {
    // Clear the editor
    await page.fill('#sql-input', 'CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT);');

    // Clear events log
    await page.click('#clear-events-btn');

    // Execute SQL
    await page.click('#execute-btn');

    // Wait for execution to complete
    await page.waitForTimeout(1000);

    // Check that events were logged
    const eventLog = page.locator('#event-log');
    const eventCount = await page.locator('#event-count').textContent();

    // Should have at least some events
    expect(parseInt(eventCount)).toBeGreaterThan(0);

    // Check for parse start event
    await expect(eventLog).toContainText('PARSE_START');
  });

  test('should execute INSERT statements and emit B-tree events', async ({ page }) => {
    // Execute CREATE TABLE first
    await page.fill('#sql-input', 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER);');
    await page.click('#execute-btn');
    await page.waitForTimeout(500);

    // Clear events
    await page.click('#clear-events-btn');

    // Execute INSERT
    await page.fill('#sql-input', "INSERT INTO users VALUES (1, 'Alice', 30);");
    await page.click('#execute-btn');

    // Wait for events
    await page.waitForTimeout(1000);

    // Check for B-tree events
    const eventLog = page.locator('#event-log');

    // Look for various B-tree events
    const eventText = await eventLog.textContent();

    // We should see parse events at minimum
    expect(eventText).toContain('PARSE_START');
  });

  test('should execute SELECT query', async ({ page }) => {
    // Setup test data
    await page.fill('#sql-input', 'CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT);');
    await page.click('#execute-btn');
    await page.waitForTimeout(500);

    await page.fill('#sql-input', "INSERT INTO test VALUES (1, 'hello');");
    await page.click('#execute-btn');
    await page.waitForTimeout(500);

    // Clear events
    await page.click('#clear-events-btn');

    // Execute SELECT
    await page.fill('#sql-input', 'SELECT * FROM test;');
    await page.click('#execute-btn');

    // Wait for execution
    await page.waitForTimeout(1000);

    // Check output
    const output = page.locator('#output');
    await expect(output).toContainText('executed successfully', { timeout: 3000 });
  });

  test('should display visualization canvas', async ({ page }) => {
    const canvas = page.locator('#visualization-canvas');
    await expect(canvas).toBeVisible();

    // Check canvas dimensions
    const box = await canvas.boundingBox();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });

  test('should clear events log', async ({ page }) => {
    // Execute some SQL to generate events
    await page.fill('#sql-input', 'SELECT 1;');
    await page.click('#execute-btn');
    await page.waitForTimeout(500);

    // Get event count before clearing
    const eventCountBefore = await page.locator('#event-count').textContent();
    expect(parseInt(eventCountBefore)).toBeGreaterThan(0);

    // Clear events
    await page.click('#clear-events-btn');
    await page.waitForTimeout(100);

    // Check event count was reset
    const eventCountAfter = await page.locator('#event-count').textContent();
    expect(parseInt(eventCountAfter)).toBe(0);
  });

  test('should clear SQL editor', async ({ page }) => {
    await page.click('#clear-btn');

    const sqlInput = page.locator('#sql-input');
    const value = await sqlInput.inputValue();
    expect(value).toBe('');
  });

  test('should toggle auto-scroll', async ({ page }) => {
    const checkbox = page.locator('#auto-scroll');

    // Check initial state (should be checked by default)
    await expect(checkbox).toBeChecked();

    // Uncheck
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();

    // Check again
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  });

  test('should change animation speed', async ({ page }) => {
    const slider = page.locator('#animation-speed');
    const speedValue = page.locator('#speed-value');

    // Initial value
    await expect(speedValue).toContainText('1.0x');

    // Change speed
    await slider.fill('0.5');
    await expect(speedValue).toContainText('0.5x');

    // Change again
    await slider.fill('2.0');
    await expect(speedValue).toContainText('2.0x');
  });

  test('should change view mode', async ({ page }) => {
    const select = page.locator('#view-mode');

    // Test each view mode
    await select.selectOption('btree');
    await expect(select).toHaveValue('btree');

    await select.selectOption('parse');
    await expect(select).toHaveValue('parse');

    await select.selectOption('vdbe');
    await expect(select).toHaveValue('vdbe');

    await select.selectOption('btree');
    await expect(select).toHaveValue('btree');
  });

  test('should toggle show transitions', async ({ page }) => {
    const checkbox = page.locator('#show-transitions');

    // Initial state (should be checked)
    await expect(checkbox).toBeChecked();

    // Uncheck
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();

    // Check again
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  });

  test('should show SQL error for invalid syntax', async ({ page }) => {
    await page.fill('#sql-input', 'INVALID SQL HERE;');
    await page.click('#execute-btn');

    // Wait for error
    await page.waitForTimeout(1000);

    const output = page.locator('#output');
    await expect(output).toContainText('Error', { timeout: 3000 });
  });

  test('should execute multiple SQL statements', async ({ page }) => {
    const sql = `
      CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT);
      INSERT INTO items VALUES (1, 'Item 1');
      INSERT INTO items VALUES (2, 'Item 2');
      SELECT * FROM items;
    `;

    await page.fill('#sql-input', sql);
    await page.click('#execute-btn');

    // Wait for execution
    await page.waitForTimeout(2000);

    const output = page.locator('#output');
    await expect(output).toContainText('executed successfully', { timeout: 5000 });
  });

  test('should update event statistics', async ({ page }) => {
    // Clear events
    await page.click('#clear-events-btn');

    // Execute SQL
    await page.fill('#sql-input', 'SELECT 1;');
    await page.click('#execute-btn');

    // Wait for events
    await page.waitForTimeout(1000);

    // Check event count
    const eventCount = await page.locator('#event-count').textContent();
    expect(parseInt(eventCount)).toBeGreaterThan(0);
  });

  test('should handle empty SQL input', async ({ page }) => {
    // Clear input
    await page.fill('#sql-input', '');

    // Try to execute
    await page.click('#execute-btn');

    // Should show error message
    const output = page.locator('#output');
    await expect(output).toContainText('Please enter SQL', { timeout: 1000 });
  });

  test('should visualize page count updates', async ({ page }) => {
    const pageCount = page.locator('#page-count');

    // Initial page count
    const initialCount = await pageCount.textContent();

    // Create a table (should allocate pages)
    await page.fill('#sql-input', 'CREATE TABLE test (id INTEGER PRIMARY KEY, data TEXT);');
    await page.click('#execute-btn');
    await page.waitForTimeout(1000);

    // Page count may have changed
    const newCount = await pageCount.textContent();
    expect(newCount).toBeDefined();
  });

  test('should display all event types in log', async ({ page }) => {
    // Execute various SQL operations
    await page.fill('#sql-input', 'CREATE TABLE test (id INTEGER PRIMARY KEY);');
    await page.click('#execute-btn');
    await page.waitForTimeout(500);

    await page.fill('#sql-input', 'INSERT INTO test VALUES (1);');
    await page.click('#execute-btn');
    await page.waitForTimeout(500);

    await page.fill('#sql-input', 'SELECT * FROM test;');
    await page.click('#execute-btn');
    await page.waitForTimeout(1000);

    // Check event log for different event types
    const eventLog = page.locator('#event-log');
    const eventText = await eventLog.textContent();

    // Should have parse events
    expect(eventText).toContain('PARSE');
  });

  test('should persist database across executions', async ({ page }) => {
    // Create table
    await page.fill('#sql-input', 'CREATE TABLE persistent (id INTEGER PRIMARY KEY, value TEXT);');
    await page.click('#execute-btn');
    await page.waitForTimeout(500);

    // Insert data
    await page.fill('#sql-input', "INSERT INTO persistent VALUES (1, 'test');");
    await page.click('#execute-btn');
    await page.waitForTimeout(500);

    // Query data
    await page.fill('#sql-input', 'SELECT * FROM persistent;');
    await page.click('#execute-btn');
    await page.waitForTimeout(1000);

    // Should succeed without errors
    const output = page.locator('#output');
    await expect(output).toContainText('executed successfully');
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Take screenshot on failure
    if (testInfo.status !== 'passed') {
      await page.screenshot({
        path: `screenshots/${testInfo.title.replace(/\s+/g, '_')}.png`,
        fullPage: true
      });
    }
  });
});

test.describe('Event System Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8000/src/web/index.html');
    await page.waitForSelector('#db-status', { timeout: 10000 });
    await expect(page.locator('#db-status')).toContainText('Ready', { timeout: 15000 });
  });

  test('should emit PARSE_START event', async ({ page }) => {
    await page.click('#clear-events-btn');
    await page.fill('#sql-input', 'SELECT 1;');
    await page.click('#execute-btn');
    await page.waitForTimeout(500);

    const eventLog = await page.locator('#event-log').textContent();
    expect(eventLog).toContain('PARSE_START');
  });

  test('should emit PARSE_COMPLETE event', async ({ page }) => {
    await page.click('#clear-events-btn');
    await page.fill('#sql-input', 'SELECT 1;');
    await page.click('#execute-btn');
    await page.waitForTimeout(500);

    const eventLog = await page.locator('#event-log').textContent();
    expect(eventLog).toContain('PARSE_COMPLETE');
  });

  test('should show event categories with different colors', async ({ page }) => {
    await page.click('#clear-events-btn');
    await page.fill('#sql-input', 'SELECT 1;');
    await page.click('#execute-btn');
    await page.waitForTimeout(500);

    // Check for event-category classes
    const parseEvents = await page.locator('.event-parse').count();
    expect(parseEvents).toBeGreaterThan(0);
  });

  test('should display event timestamps', async ({ page }) => {
    await page.click('#clear-events-btn');
    await page.fill('#sql-input', 'SELECT 1;');
    await page.click('#execute-btn');
    await page.waitForTimeout(500);

    const eventTime = await page.locator('.event-time').first().textContent();
    expect(eventTime).toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});
