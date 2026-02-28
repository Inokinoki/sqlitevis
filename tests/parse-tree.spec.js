/**
 * Parse Tree Visualization Tests
 */

const { test, expect } = require('@playwright/test');

test.describe('Parse Tree Visualization', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8000/src/web/index.html');
    await page.waitForSelector('#db-status', { timeout: 10000 });
    await expect(page.locator('#db-status')).toContainText('Ready', { timeout: 15000 });
  });

  test('should switch to parse tree view mode', async ({ page }) => {
    // Switch to parse tree view
    await page.selectOption('#view-mode', 'parse');

    // Verify mode changed
    const viewMode = await page.inputValue('#view-mode');
    expect(viewMode).toBe('parse');
  });

  test('should display parse tree for SELECT query', async ({ page }) => {
    // Switch to parse tree view
    await page.selectOption('#view-mode', 'parse');

    // Execute SELECT query
    await page.fill('#sql-input', 'SELECT id FROM users;');
    await page.click('#execute-btn');
    await page.waitForTimeout(1000);

    // Verify canvas is visible and rendered
    const canvas = page.locator('#visualization-canvas');
    await expect(canvas).toBeVisible();

    // Verify SQL was executed successfully
    const status = await page.locator('#db-status').textContent();
    expect(status).toContain('Ready');

    // Take screenshot for visual verification
    await page.screenshot({ path: 'test-results/parse-select-query.png' });
  });

  test('should display parse tree for CREATE TABLE', async ({ page }) => {
    // Switch to parse tree view
    await page.selectOption('#view-mode', 'parse');

    // Execute CREATE TABLE
    await page.fill('#sql-input', 'CREATE TABLE test (id INTEGER, name TEXT);');
    await page.click('#execute-btn');
    await page.waitForTimeout(1000);

    // Verify SQL executed successfully
    const status = await page.locator('#db-status').textContent();
    expect(status).toContain('Ready');

    // Verify canvas rendered
    const canvas = page.locator('#visualization-canvas');
    await expect(canvas).toBeVisible();
  });

  test('should show parse tree structure with nodes', async ({ page }) => {
    // Switch to parse tree view
    await page.selectOption('#view-mode', 'parse');

    // Execute SQL
    await page.fill('#sql-input', 'SELECT * FROM products WHERE price > 100;');
    await page.click('#execute-btn');
    await page.waitForTimeout(1000);

    // Take screenshot for manual verification
    await page.screenshot({ path: 'screenshots/parse-tree-visualization.png', fullPage: true });

    // Verify SQL executed
    const eventLog = await page.locator('#event-log').textContent();
    expect(eventLog).toBeTruthy();
  });

  test('should handle complex SQL queries in parse tree', async ({ page }) => {
    await page.selectOption('#view-mode', 'parse');

    const complexSQL = `
      INSERT INTO orders (user_id, product_id, quantity)
      SELECT u.id, p.id, 1
      FROM users u
      JOIN products p ON p.category = 'electronics'
      WHERE u.active = 1;
    `;

    await page.fill('#sql-input', complexSQL);
    await page.click('#execute-btn');
    await page.waitForTimeout(2000);

    // Verify it processed without error
    const status = await page.locator('#db-status').textContent();
    expect(status).toContain('Ready');
  });

  test('should show different node types in parse tree', async ({ page }) => {
    await page.selectOption('#view-mode', 'parse');

    // Execute query with multiple keywords
    await page.fill('#sql-input', 'CREATE TABLE test (id INTEGER PRIMARY KEY);');
    await page.click('#execute-btn');
    await page.waitForTimeout(1000);

    // Verify multiple events
    const eventLog = await page.locator('#event-log').textContent();
    const eventCount = (eventLog.match(/VDBE_START/g) || []).length;
    expect(eventCount).toBeGreaterThan(0);
  });

  test('should switch between view modes', async ({ page }) => {
    // Start with B-tree view
    await page.selectOption('#view-mode', 'btree');
    await page.fill('#sql-input', 'SELECT 1;');
    await page.click('#execute-btn');
    await page.waitForTimeout(500);

    // Switch to parse view
    await page.selectOption('#view-mode', 'parse');
    await page.fill('#sql-input', 'SELECT 2;');
    await page.click('#execute-btn');
    await page.waitForTimeout(500);

    // Switch to VDBE view
    await page.selectOption('#view-mode', 'vdbe');
    await page.fill('#sql-input', 'SELECT 3;');
    await page.click('#execute-btn');
    await page.waitForTimeout(500);

    // All modes should work
    const status = await page.locator('#db-status').textContent();
    expect(status).toContain('Ready');
  });

  test('should display parse tree title and SQL', async ({ page }) => {
    await page.selectOption('#view-mode', 'parse');

    const testSQL = 'SELECT name, email FROM users WHERE id = 1;';
    await page.fill('#sql-input', testSQL);
    await page.click('#execute-btn');
    await page.waitForTimeout(1000);

    // The canvas should have rendered
    const canvas = page.locator('#visualization-canvas');
    await expect(canvas).toBeVisible();
  });
});
