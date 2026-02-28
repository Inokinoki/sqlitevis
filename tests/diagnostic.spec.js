/**
 * Diagnostic test to understand event flow
 */

const { test, expect } = require('@playwright/test');

test('diagnostic - trace exact event sequence', async ({ page }) => {
  const logs = [];

  // Capture console logs
  page.on('console', msg => {
    logs.push(msg.text());
  });

  await page.goto('http://localhost:8000/src/web/index.html');
  await page.waitForSelector('#db-status', { timeout: 10000 });
  await expect(page.locator('#db-status')).toContainText('Ready', { timeout: 15000 });

  // Wait for initialization to complete
  await page.waitForTimeout(2000);

  // Clear events
  await page.click('#clear-events-btn');
  await page.waitForTimeout(500);

  // Get initial state
  const initialCount = parseInt(await page.locator('#event-count').textContent());
  console.log(`Initial event count: ${initialCount}`);

  // Execute simple SQL
  await page.fill('#sql-input', 'SELECT 1;');
  await page.click('#execute-btn');
  await page.waitForTimeout(2000);

  // Get final state
  const finalCount = parseInt(await page.locator('#event-count').textContent());
  const eventLog = await page.locator('#event-log').textContent();

  console.log(`\nFinal event count: ${finalCount}`);
  console.log(`Events generated: ${finalCount - initialCount}`);

  // Print full event log
  console.log('\n=== FULL EVENT LOG ===');
  console.log(eventLog);
  console.log('=== END EVENT LOG ===\n');

  // Print console logs
  console.log('\n=== CONSOLE LOGS ===');
  logs.forEach(log => console.log(log));
  console.log('=== END CONSOLE ===\n');

  // Analyze event types
  const vdbeStart = (eventLog.match(/VDBE_START/g) || []).length;
  const vdbeComplete = (eventLog.match(/VDBE_COMPLETE/g) || []).length;
  const pageAllocate = (eventLog.match(/PAGE_ALLOCATE/g) || []).length;

  console.log('Event breakdown:');
  console.log(`  VDBE_START: ${vdbeStart}`);
  console.log(`  VDBE_COMPLETE: ${vdbeComplete}`);
  console.log(`  PAGE_ALLOCATE: ${pageAllocate}`);
  console.log(`  Ratio (Complete/Start): ${vdbeComplete / (vdbeStart || 1)}`);

  // Save to file
  const fs = require('fs');
  const report = {
    initialEvents: initialCount,
    finalEvents: finalCount,
    generatedEvents: finalCount - initialCount,
    eventLog: eventLog,
    consoleLogs: logs,
    breakdown: {
      vdbeStart,
      vdbeComplete,
      pageAllocate
    }
  };

  fs.writeFileSync('screenshots/diagnostic-report.json', JSON.stringify(report, null, 2));
  console.log('\nDiagnostic report saved to screenshots/diagnostic-report.json');
});
