import { test, expect } from '@playwright/test';

test('directly call parse_start_event from JS', async ({ page }) => {
  page.on('console', msg => console.log('[' + msg.type() + ']', msg.text()));

  await page.goto('http://localhost:8000/src/web/index.html');
  await page.waitForTimeout(3000);

  // Try to directly call the event function
  await page.evaluate(() => {
    if (window.sqliteApp && window.sqliteApp.sqliteModule) {
      const mod = window.sqliteApp.sqliteModule;
      console.log('Module available, calling parse_start_event');
      // Allocate memory for the string
      const sql = 'SELECT 1;';
      const sqlLen = mod.lengthBytesUTF8(sql) + 1;
      const sqlPtr = mod._malloc(sqlLen);
      mod.stringToUTF8(sql, sqlPtr, sqlLen);
      // Call the function
      mod._parse_start_event(sqlPtr);
      // Free memory
      mod._free(sqlPtr);
    }
  });

  await page.waitForTimeout(1000);

  const eventCount = await page.locator('#event-count').textContent();
  console.log('Event count after direct call:', eventCount);
});
