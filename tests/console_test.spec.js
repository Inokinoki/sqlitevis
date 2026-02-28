import { test, expect } from '@playwright/test';

test('console test for events', async ({ page }) => {
  // Listen to console
  page.on('console', msg => {
    console.log('[' + msg.type() + ']', msg.text());
  });

  // Listen to errors
  page.on('pageerror', err => {
    console.error('[Page Error]', err.message);
  });

  await page.goto('http://localhost:8000/src/web/index.html');
  await page.waitForTimeout(3000);

  console.log('=== Executing SQL ===');
  await page.fill('#sql-input', 'SELECT 1;');
  await page.click('#execute-btn');
  await page.waitForTimeout(2000);

  const eventCount = await page.locator('#event-count').textContent();
  console.log('Event count:', eventCount);

  const eventLog = await page.locator('#event-log').textContent();
  console.log('Event log:', eventLog ? eventLog.substring(0, 200) : '(empty)');
});
