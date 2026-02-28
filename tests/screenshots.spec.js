/**
 * Screenshot Tests - Visual Verification
 * Captures screenshots to verify event system behavior
 */

const { test, expect } = require('@playwright/test');

test.describe('Screenshot Tests for Event Verification', () => {

  test('capture screenshot at startup', async ({ page }) => {
    await page.goto('http://localhost:8000/src/web/index.html');
    await page.waitForSelector('#db-status', { timeout: 10000 });
    await expect(page.locator('#db-status')).toContainText('Ready', { timeout: 15000 });

    // Wait a bit more to see if any events appear
    await page.waitForTimeout(2000);

    // Capture screenshot
    await page.screenshot({ path: 'screenshots/01-startup.png', fullPage: true });

    // Check event count
    const eventCount = await page.locator('#event-count').textContent();
    console.log(`Events at startup: ${eventCount}`);

    // Get event log content
    const eventLog = await page.locator('#event-log').textContent();
    console.log('Event log content:', eventLog.substring(0, 200));
  });

  test('capture screenshot after SELECT 1', async ({ page }) => {
    await page.goto('http://localhost:8000/src/web/index.html');
    await page.waitForSelector('#db-status', { timeout: 10000 });
    await expect(page.locator('#db-status')).toContainText('Ready', { timeout: 15000 });

    // Clear events
    await page.click('#clear-events-btn');
    await page.waitForTimeout(500);

    // Execute SQL
    await page.fill('#sql-input', 'SELECT 1;');
    await page.click('#execute-btn');
    await page.waitForTimeout(2000);

    // Capture screenshot
    await page.screenshot({ path: 'screenshots/02-after-select-1.png', fullPage: true });

    // Get event count and log
    const eventCount = await page.locator('#event-count').textContent();
    const eventLog = await page.locator('#event-log').textContent();

    console.log(`Events after SELECT 1: ${eventCount}`);
    console.log('Event log:', eventLog.substring(0, 500));
  });

  test('capture screenshot after CREATE TABLE', async ({ page }) => {
    await page.goto('http://localhost:8000/src/web/index.html');
    await page.waitForSelector('#db-status', { timeout: 10000 });
    await expect(page.locator('#db-status')).toContainText('Ready', { timeout: 15000 });

    // Clear events
    await page.click('#clear-events-btn');
    await page.waitForTimeout(500);

    // Execute CREATE TABLE
    await page.fill('#sql-input', 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);');
    await page.click('#execute-btn');
    await page.waitForTimeout(2000);

    // Capture screenshot
    await page.screenshot({ path: 'screenshots/03-after-create-table.png', fullPage: true });

    // Get event count and log
    const eventCount = await page.locator('#event-count').textContent();
    const eventLog = await page.locator('#event-log').textContent();

    console.log(`Events after CREATE TABLE: ${eventCount}`);
    console.log('Event log:', eventLog.substring(0, 500));
  });

  test('capture screenshot after INSERT', async ({ page }) => {
    await page.goto('http://localhost:8000/src/web/index.html');
    await page.waitForSelector('#db-status', { timeout: 10000 });
    await expect(page.locator('#db-status')).toContainText('Ready', { timeout: 15000 });

    // Create table first
    await page.fill('#sql-input', 'CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT);');
    await page.click('#execute-btn');
    await page.waitForTimeout(1000);

    // Clear events
    await page.click('#clear-events-btn');
    await page.waitForTimeout(500);

    // Execute INSERT
    await page.fill('#sql-input', "INSERT INTO test VALUES (1, 'hello');");
    await page.click('#execute-btn');
    await page.waitForTimeout(2000);

    // Capture screenshot
    await page.screenshot({ path: 'screenshots/04-after-insert.png', fullPage: true });

    // Get event count and log
    const eventCount = await page.locator('#event-count').textContent();
    const eventLog = await page.locator('#event-log').textContent();

    console.log(`Events after INSERT: ${eventCount}`);
    console.log('Event log:', eventLog.substring(0, 500));
  });

  test('capture screenshot showing event types', async ({ page }) => {
    await page.goto('http://localhost:8000/src/web/index.html');
    await page.waitForSelector('#db-status', { timeout: 10000 });
    await expect(page.locator('#db-status')).toContainText('Ready', { timeout: 15000 });

    // Clear events
    await page.click('#clear-events-btn');

    // Execute multiple SQL statements
    const statements = [
      'SELECT 1;',
      'CREATE TABLE demo (id INTEGER);',
      'INSERT INTO demo VALUES (1);',
      'SELECT * FROM demo;'
    ];

    for (const sql of statements) {
      await page.fill('#sql-input', sql);
      await page.click('#execute-btn');
      await page.waitForTimeout(1000);
    }

    await page.waitForTimeout(1000);

    // Capture screenshot
    await page.screenshot({ path: 'screenshots/05-multiple-statements.png', fullPage: true });

    // Analyze events
    const eventLog = await page.locator('#event-log').textContent();
    const eventCount = await page.locator('#event-count').textContent();

    console.log(`Total events: ${eventCount}`);

    // Count different event types
    const vdbeStart = (eventLog.match(/VDBE_START/g) || []).length;
    const vdbeComplete = (eventLog.match(/VDBE_COMPLETE/g) || []).length;
    const pageAllocate = (eventLog.match(/PAGE_ALLOCATE/g) || []).length;
    const parseStart = (eventLog.match(/PARSE_START/g) || []).length;

    console.log('Event breakdown:');
    console.log(`  VDBE_START: ${vdbeStart}`);
    console.log(`  VDBE_COMPLETE: ${vdbeComplete}`);
    console.log(`  PAGE_ALLOCATE: ${pageAllocate}`);
    console.log(`  PARSE_START: ${parseStart}`);
  });

  test('capture console logs', async ({ page }) => {
    const logs = [];

    page.on('console', msg => {
      logs.push(msg.text());
    });

    await page.goto('http://localhost:8000/src/web/index.html');
    await page.waitForSelector('#db-status', { timeout: 10000 });
    await expect(page.locator('#db-status')).toContainText('Ready', { timeout: 15000 });

    await page.waitForTimeout(1000);

    // Execute SQL
    await page.fill('#sql-input', 'SELECT 1;');
    await page.click('#execute-btn');
    await page.waitForTimeout(1000);

    // Print console logs
    console.log('\n=== CONSOLE LOGS ===');
    logs.forEach(log => console.log(log));
    console.log('=====================\n');

    // Save logs to file
    const fs = require('fs');
    fs.writeFileSync('screenshots/console-logs.txt', logs.join('\n'));
  });
});
