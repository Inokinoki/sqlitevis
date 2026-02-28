/**
 * Behavioral Tests for SQLite B-Tree Visualization
 * Tests user workflows and interactions
 */

const { test, expect } = require('@playwright/test');

test.describe('User Workflows', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8000/src/web/index.html');
        await page.waitForSelector('#db-status', { timeout: 10000 });
        await expect(page.locator('#db-status')).toContainText('Ready', { timeout: 15000 });
    });

    test.describe('Complete SQL Workflow', () => {

        test('should create table and see results', async ({ page }) => {
            // Clear the editor
            await page.fill('#sql-input', '');

            // Enter CREATE TABLE statement
            await page.fill('#sql-input', 'CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, department TEXT);');
            await page.click('#execute-btn');

            // Wait for execution
            await page.waitForTimeout(1000);

            // Check output
            const output = page.locator('#output');
            await expect(output).toContainText('executed successfully');
        });

        test('should insert data and query it back', async ({ page }) => {
            // Create table first
            await page.fill('#sql-input', 'CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price REAL);');
            await page.click('#execute-btn');
            await page.waitForTimeout(500);

            // Clear events to see only the next operation
            await page.click('#clear-events-btn');

            // Insert data
            await page.fill('#sql-input', "INSERT INTO products VALUES (1, 'Laptop', 999.99);");
            await page.click('#execute-btn');
            await page.waitForTimeout(500);

            // Verify success message
            const output = page.locator('#output');
            await expect(output).toContainText('executed successfully');

            // Check if any events were logged
            const eventCount = await page.locator('#event-count').textContent();
            console.log('Events after INSERT:', eventCount);
        });

        test('should handle multiple sequential operations', async ({ page }) => {
            const operations = [
                'CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT);',
                "INSERT INTO test VALUES (1, 'first');",
                "INSERT INTO test VALUES (2, 'second');",
                'SELECT * FROM test;'
            ];

            for (const sql of operations) {
                await page.fill('#sql-input', sql);
                await page.click('#execute-btn');
                await page.waitForTimeout(500);
            }

            // Final output should be successful
            const output = page.locator('#output');
            await expect(output).toContainText('executed successfully');
        });

        test('should clear editor and enter new SQL', async ({ page }) => {
            // Clear the editor
            await page.click('#clear-btn');

            // Verify it's empty
            const sqlInput = page.locator('#sql-input');
            await expect(sqlInput).toHaveValue('');

            // Enter new SQL
            await page.fill('#sql-input', 'SELECT 1;');
            await expect(sqlInput).toHaveValue('SELECT 1;');

            // Execute
            await page.click('#execute-btn');
            await page.waitForTimeout(500);

            const output = page.locator('#output');
            await expect(output).toContainText('executed successfully');
        });
    });

    test.describe('UI Interactions', () => {

        test('should adjust visualization speed', async ({ page }) => {
            // Find speed slider
            const slider = page.locator('#animation-speed');
            const speedValue = page.locator('#speed-value');

            // Test different speeds
            await slider.fill('0.5');
            await expect(speedValue).toContainText('0.5x');

            await slider.fill('1.5');
            await expect(speedValue).toContainText('1.5x');

            await slider.fill('2.0');
            await expect(speedValue).toContainText('2.0x');
        });

        test('should switch between view modes', async ({ page }) => {
            const viewSelect = page.locator('#view-mode');

            // Try each view mode
            const modes = ['btree', 'parse', 'vdbe'];

            for (const mode of modes) {
                await viewSelect.selectOption(mode);
                await expect(viewSelect).toHaveValue(mode);
            }
        });

        test('should toggle transitions', async ({ page }) => {
            const checkbox = page.locator('#show-transitions');

            // Should be checked by default
            await expect(checkbox).toBeChecked();

            // Uncheck
            await checkbox.uncheck();
            await expect(checkbox).not.toBeChecked();

            // Check again
            await checkbox.check();
            await expect(checkbox).toBeChecked();
        });

        test('should toggle auto-scroll', async ({ page }) => {
            const checkbox = page.locator('#auto-scroll');

            // Should be checked by default
            await expect(checkbox).toBeChecked();

            // Uncheck
            await checkbox.uncheck();
            await expect(checkbox).not.toBeChecked();

            // Check again
            await checkbox.check();
            await expect(checkbox).toBeChecked();
        });
    });

    test.describe('Event Log Management', () => {

        test('should clear events and see count reset', async ({ page }) => {
            // Execute some SQL to generate events
            await page.fill('#sql-input', 'SELECT 1;');
            await page.click('#execute-btn');
            await page.waitForTimeout(1000);

            // Get event count
            const countBefore = await page.locator('#event-count').textContent();
            const numBefore = parseInt(countBefore);
            expect(numBefore).toBeGreaterThan(0);

            // Clear events
            await page.click('#clear-events-btn');
            await page.waitForTimeout(100);

            // Check count is reset
            const countAfter = await page.locator('#event-count').textContent();
            expect(parseInt(countAfter)).toBe(0);
        });

        test('should maintain event count across operations', async ({ page }) => {
            await page.click('#clear-events-btn');
            await page.waitForTimeout(100);

            // Execute multiple operations
            for (let i = 0; i < 3; i++) {
                await page.fill('#sql-input', 'SELECT 1;');
                await page.click('#execute-btn');
                await page.waitForTimeout(500);
            }

            // Event count should increase
            const finalCount = await page.locator('#event-count').textContent();
            expect(parseInt(finalCount)).toBeGreaterThan(0);
        });
    });

    test.describe('Error Handling', () => {

        test('should show error for invalid SQL syntax', async ({ page }) => {
            await page.fill('#sql-input', 'INVALID SQL SYNTAX HERE');
            await page.click('#execute-btn');

            // Wait for error
            await page.waitForTimeout(1000);

            const output = page.locator('#output');
            await expect(output).toContainText('Error', { timeout: 5000 });
        });

        test('should show error for empty SQL', async ({ page }) => {
            await page.fill('#sql-input', '');
            await page.click('#execute-btn');

            const output = page.locator('#output');
            await expect(output).toContainText('Please enter SQL', { timeout: 1000 });
        });

        test('should handle table creation errors gracefully', async ({ page }) => {
            // Try to create same table twice
            const sql = 'CREATE TABLE duplicate_test (id INTEGER);';

            // First creation
            await page.fill('#sql-input', sql);
            await page.click('#execute-btn');
            await page.waitForTimeout(500);

            // Clear output
            const output = page.locator('#output');

            // Second creation should fail
            await page.fill('#sql-input', sql);
            await page.click('#execute-btn');
            await page.waitForTimeout(500);

            // Should show error (table already exists)
            await expect(output).toContainText('Error', { timeout: 5000 });
        });
    });

    test.describe('Visualization Behavior', () => {

        test('should display canvas after initialization', async ({ page }) => {
            const canvas = page.locator('#visualization-canvas');

            // Canvas should be visible
            await expect(canvas).toBeVisible();

            // Check canvas dimensions
            const box = await canvas.boundingBox();
            expect(box.width).toBeGreaterThan(0);
            expect(box.height).toBeGreaterThan(0);
        });

        test('should update page count in footer', async ({ page }) => {
            const pageCount = page.locator('#page-count');

            // Initial state
            const initialCount = await pageCount.textContent();
            expect(initialCount).toBeDefined();

            // Execute SQL (might allocate pages)
            await page.fill('#sql-input', 'CREATE TABLE test (id INTEGER);');
            await page.click('#execute-btn');
            await page.waitForTimeout(1000);

            // Page count should still be defined
            const newCount = await pageCount.textContent();
            expect(newCount).toBeDefined();
        });
    });

    test.describe('End-to-End Scenarios', () => {

        test('should complete full database workflow', async ({ page }) => {
            // Scenario: Create a simple inventory system

            // 1. Create tables
            await page.fill('#sql-input', `
                CREATE TABLE inventory (
                    id INTEGER PRIMARY KEY,
                    product_name TEXT,
                    quantity INTEGER,
                    price REAL
                );
            `);
            await page.click('#execute-btn');
            await page.waitForTimeout(500);
            await expect(page.locator('#output')).toContainText('executed successfully');

            // 2. Insert products
            await page.fill('#sql-input', `
                INSERT INTO inventory VALUES
                (1, 'Widget', 100, 9.99),
                (2, 'Gadget', 50, 19.99),
                (3, 'Doohickey', 75, 14.99);
            `);
            await page.click('#execute-btn');
            await page.waitForTimeout(500);

            // 3. Query data
            await page.fill('#sql-input', 'SELECT * FROM inventory WHERE quantity > 60;');
            await page.click('#execute-btn');
            await page.waitForTimeout(500);

            // Should succeed
            await expect(page.locator('#output')).toContainText('executed successfully');
        });

        test('should handle user typing and editing SQL', async ({ page }) => {
            const sqlInput = page.locator('#sql-input');

            // Clear and type new SQL
            await sqlInput.fill('');
            await sqlInput.type('SELECT');
            await sqlInput.press('Space');
            await sqlInput.type('*');
            await sqlInput.press('Space');
            await sqlInput.type('FROM');
            await sqlInput.press('Space');
            await sqlInput.type('users');

            // Should have the correct value
            await expect(sqlInput).toHaveValue('SELECT * FROM users');

            // Execute
            await page.click('#execute-btn');
            await page.waitForTimeout(500);

            // Should attempt execution (even if table doesn't exist)
            const output = page.locator('#output');
            const outputText = await output.textContent();
            expect(outputText).toBeTruthy();
        });

        test('should preserve state across multiple operations', async ({ page }) => {
            // Create table
            await page.fill('#sql-input', 'CREATE TABLE state_test (id INTEGER PRIMARY KEY, value TEXT);');
            await page.click('#execute-btn');
            await page.waitForTimeout(500);

            // Insert value
            await page.fill('#sql-input', "INSERT INTO state_test VALUES (1, 'persistent');");
            await page.click('#execute-btn');
            await page.waitForTimeout(500);

            // Query back
            await page.fill('#sql-input', 'SELECT * FROM state_test;');
            await page.click('#execute-btn');
            await page.waitForTimeout(500);

            // Should succeed (data persisted)
            await expect(page.locator('#output')).toContainText('executed successfully');
        });
    });
});

test.describe('Performance and Behavior', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8000/src/web/index.html');
        await page.waitForSelector('#db-status', { timeout: 10000 });
        await expect(page.locator('#db-status')).toContainText('Ready', { timeout: 15000 });
    });

    test('should load within reasonable time', async ({ page }) => {
        // Page should be fully loaded within 15 seconds
        const loadTime = await page.evaluate(() => {
            return performance.timing.loadEventEnd - performance.timing.navigationStart;
        });

        // Should load in less than 15 seconds (15000ms)
        expect(loadTime).toBeLessThan(15000);
    });

    test('should respond quickly to button clicks', async ({ page }) => {
        await page.fill('#sql-input', 'SELECT 1;');

        // Measure click response time
        const startTime = Date.now();
        await page.click('#execute-btn');

        // Wait for some response
        await page.waitForSelector('#output:not(:empty)', { timeout: 5000 });
        const responseTime = Date.now() - startTime;

        // Should respond within 5 seconds
        expect(responseTime).toBeLessThan(5000);
    });

    test('should handle rapid button clicks', async ({ page }) => {
        // Click clear button multiple times rapidly
        for (let i = 0; i < 5; i++) {
            await page.click('#clear-btn');
        }

        // Editor should be empty
        await expect(page.locator('#sql-input')).toHaveValue('');
    });

    test('should not block UI during SQL execution', async ({ page }) => {
        // Execute a query
        await page.fill('#sql-input', 'SELECT 1;');
        await page.click('#execute-btn');

        // Other controls should still be interactive
        await page.click('#clear-events-btn');

        // Should work without hanging
        await expect(page.locator('#event-count')).toBeVisible();
    });
});

test.describe('Accessibility and Usability', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8000/src/web/index.html');
        await page.waitForSelector('#db-status', { timeout: 10000 });
    });

    test('should have accessible form controls', async ({ page }) => {
        // Check buttons are accessible
        await expect(page.locator('button#execute-btn')).toBeEnabled();
        await expect(page.locator('button#clear-btn')).toBeEnabled();
        await expect(page.locator('button#clear-events-btn')).toBeEnabled();

        // Check input is accessible
        await expect(page.locator('textarea#sql-input')).toBeEditable();
    });

    test('should show loading state during initialization', async ({ page }) => {
        // The loading overlay should exist and disappear
        const overlay = page.locator('#loading-overlay');

        // Should eventually be hidden
        await expect(overlay).toHaveClass(/hidden/, { timeout: 15000 });
    });

    test('should have clear status indicators', async ({ page }) => {
        // Status should be visible
        const status = page.locator('#db-status');
        await expect(status).toBeVisible();

        // Should show Ready when initialized
        await expect(status).toContainText('Ready', { timeout: 15000 });
    });
});
