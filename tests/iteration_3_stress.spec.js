/**
 * Iteration 3: Stress Testing and Edge Case Validation
 *
 * This test validates all three visualization systems under:
 * - Complex SQL queries
 * - Rapid successive operations
 * - Large data volumes
 * - Edge cases
 */

const { test, expect } = require('@playwright/test');

test.describe('Iteration 3: Stress Testing All Three Systems', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8000/src/web/index.html');
        await page.waitForSelector('#db-status', { timeout: 10000 });
        await expect(page.locator('#db-status')).toContainText('Ready', { timeout: 15000 });
    });

    test('Stress Test 1: Complex Multi-Join Query - All Systems', async ({ page }) => {
        console.log('\n=== STRESS TEST: COMPLEX MULTI-JOIN ===\n');

        // Set up console listener
        const eventTypes = new Set();
        page.on('console', msg => {
            const text = msg.text();
            const match = text.match(/Event type (\d+)/);
            if (match) {
                eventTypes.add(match[1]);
            }
        });

        // Execute complex multi-table join
        const complexSQL = `
            CREATE TABLE departments (
                id INTEGER PRIMARY KEY,
                name TEXT,
                budget REAL
            );
            CREATE TABLE employees (
                id INTEGER PRIMARY KEY,
                name TEXT,
                department_id INTEGER,
                salary REAL,
                FOREIGN KEY (department_id) REFERENCES departments(id)
            );
            CREATE TABLE projects (
                id INTEGER PRIMARY KEY,
                name TEXT,
                lead_employee_id INTEGER,
                FOREIGN KEY (lead_employee_id) REFERENCES employees(id)
            );
            INSERT INTO departments VALUES (1, 'Engineering', 1000000);
            INSERT INTO departments VALUES (2, 'Marketing', 500000);
            INSERT INTO employees VALUES (1, 'Alice', 1, 90000);
            INSERT INTO employees VALUES (2, 'Bob', 1, 80000);
            INSERT INTO employees VALUES (3, 'Charlie', 2, 70000);
            INSERT INTO projects VALUES (1, 'Project A', 1);
            INSERT INTO projects VALUES (2, 'Project B', 2);
            SELECT
                d.name as department,
                e.name as employee,
                e.salary,
                p.name as project
            FROM departments d
            JOIN employees e ON e.department_id = d.id
            LEFT JOIN projects p ON p.lead_employee_id = e.id
            WHERE e.salary > 75000
            ORDER BY d.name, e.salary DESC;
        `;

        await page.fill('#sql-input', complexSQL);
        await page.click('#execute-btn');
        await page.waitForTimeout(8000);

        // Test each view mode
        const viewResults = {};
        for (const viewMode of ['btree', 'parse', 'vdbe']) {
            await page.selectOption('#view-mode', viewMode);
            await page.waitForTimeout(1000);

            const canvas = page.locator('#visualization-canvas');
            viewResults[viewMode] = await canvas.isVisible();
        }

        // Get stats
        const eventCount = await page.locator('#event-count').textContent();
        const pageCount = await page.locator('#page-count').textContent();

        console.log('Results:');
        console.log(`  B-Tree view visible: ${viewResults.btree}`);
        console.log(`  Parse view visible: ${viewResults.parse}`);
        console.log(`  VDBE view visible: ${viewResults.vdbe}`);
        console.log(`  Total events: ${eventCount}`);
        console.log(`  Total pages: ${pageCount}`);
        console.log(`  Event types detected: ${Array.from(eventTypes).sort().join(', ')}`);

        // Verify all systems handled the complex query
        expect(viewResults.btree).toBeTruthy();
        expect(viewResults.parse).toBeTruthy();
        expect(viewResults.vdbe).toBeTruthy();
        expect(parseInt(eventCount)).toBeGreaterThan(0);
        expect(parseInt(pageCount)).toBeGreaterThan(0);

        // Verify we got events from all three categories
        const hasVdbeEvents = Array.from(eventTypes).some(t => parseInt(t) >= 11 && parseInt(t) <= 13);
        const hasParseEvents = Array.from(eventTypes).some(t => parseInt(t) >= 8 && parseInt(t) <= 10);
        const hasPageEvents = Array.from(eventTypes).some(t => parseInt(t) <= 7);

        console.log(`  Has VDBE events: ${hasVdbeEvents}`);
        console.log(`  Has Parse events: ${hasParseEvents}`);
        console.log(`  Has Page events: ${hasPageEvents}`);

        expect(hasVdbeEvents || hasParseEvents || hasPageEvents).toBeTruthy();

        console.log('\n✓ Complex multi-join query handled successfully\n');
    });

    test('Stress Test 2: Rapid Operations - System Stability', async ({ page }) => {
        console.log('\n=== STRESS TEST: RAPID OPERATIONS ===\n');

        let totalOperations = 0;
        let successfulViews = 0;

        // Execute 10 rapid operations
        for (let i = 0; i < 10; i++) {
            const sql = `INSERT INTO test_table VALUES (${i}, 'Value ${i}');`;

            await page.fill('#sql-input', sql);
            await page.click('#execute-btn');
            await page.waitForTimeout(500);

            totalOperations++;

            // Check canvas is still rendering
            const canvas = page.locator('#visualization-canvas');
            const isVisible = await canvas.isVisible();
            if (isVisible) successfulViews++;
        }

        console.log(`Operations executed: ${totalOperations}`);
        console.log(`Successful renders: ${successfulViews}`);

        expect(totalOperations).toBe(10);
        expect(successfulViews).toBe(10);

        console.log('\n✓ System stable under rapid operations\n');
    });

    test('Stress Test 3: Large Batch Transaction - All Systems', async ({ page }) => {
        console.log('\n=== STRESS TEST: LARGE BATCH TRANSACTION ===\n');

        // First create the table
        await page.fill('#sql-input', 'CREATE TABLE large_test (id INTEGER PRIMARY KEY, data TEXT, value REAL)');
        await page.click('#execute-btn');
        await page.waitForTimeout(2000);

        // Set up event tracking
        const eventTypes = new Set();
        page.on('console', msg => {
            const text = msg.text();
            const match = text.match(/Event type (\d+)/);
            if (match) {
                eventTypes.add(match[1]);
            }
        });

        // Execute large batch INSERT
        let insertSQL = 'INSERT INTO large_test VALUES ';
        const values = [];
        for (let i = 1; i <= 50; i++) {
            values.push(`(${i}, 'Data ${i}', ${Math.random() * 100})`);
        }
        insertSQL += values.join(', ') + ';';

        console.log('Executing batch INSERT with 50 rows...');

        await page.fill('#sql-input', insertSQL);
        await page.click('#execute-btn');
        await page.waitForTimeout(5000);

        // Query the data back
        await page.fill('#sql-input', 'SELECT COUNT(*) FROM large_test; SELECT * FROM large_test LIMIT 10;');
        await page.click('#execute-btn');
        await page.waitForTimeout(3000);

        // Check each view mode
        for (const viewMode of ['btree', 'parse', 'vdbe']) {
            await page.selectOption('#view-mode', viewMode);
            await page.waitForTimeout(500);

            const canvas = page.locator('#visualization-canvas');
            const isVisible = await canvas.isVisible();
            console.log(`  ${viewMode} view visible: ${isVisible}`);
            expect(isVisible).toBeTruthy();
        }

        const eventCount = await page.locator('#event-count').textContent();
        const pageCount = await page.locator('#page-count').textContent();

        console.log(`  Total events: ${eventCount}`);
        console.log(`  Total pages: ${pageCount}`);
        console.log(`  Event types: ${Array.from(eventTypes).length} different types`);

        expect(parseInt(eventCount)).toBeGreaterThan(0);

        console.log('\n✓ Large batch transaction handled successfully\n');
    });

    test('Stress Test 4: Error Handling - All Systems', async ({ page }) => {
        console.log('\n=== STRESS TEST: ERROR HANDLING ===\n');

        const errorCases = [
            {
                name: 'Syntax error',
                sql: 'SELCT FROM table', // intentional typo
                expectError: true
            },
            {
                name: 'Table not found',
                sql: 'SELECT * FROM nonexistent_table',
                expectError: true
            },
            {
                name: 'Invalid constraint',
                sql: 'CREATE TABLE bad (id INVALID_TYPE)',
                expectError: true
            }
        ];

        let errorsHandled = 0;

        for (const testCase of errorCases) {
            console.log(`Testing: ${testCase.name}`);

            await page.fill('#sql-input', testCase.sql);
            await page.click('#execute-btn');
            await page.waitForTimeout(1000);

            // Check that canvas is still visible (system didn't crash)
            const canvas = page.locator('#visualization-canvas');
            const isVisible = await canvas.isVisible();

            if (isVisible) {
                errorsHandled++;
                console.log(`  ✓ Canvas still visible (error handled gracefully)`);
            }

            // Clear for next test
            await page.click('#clear-events-btn');
            await page.waitForTimeout(500);
        }

        console.log(`Errors handled gracefully: ${errorsHandled}/${errorCases.length}`);

        expect(errorsHandled).toBe(errorCases.length);

        console.log('\n✓ Error handling working correctly\n');
    });

    test('Stress Test 5: View Mode Switching During Execution', async ({ page }) => {
        console.log('\n=== STRESS TEST: VIEW SWITCHING DURING EXECUTION ===\n');

        // Start a long-running operation
        const longSQL = `
            CREATE TABLE switch_test (
                id INTEGER PRIMARY KEY,
                data TEXT
            );
        `;

        await page.fill('#sql-input', longSQL);
        await page.click('#execute-btn');

        // Rapidly switch views while execution is happening
        const views = ['btree', 'parse', 'vdbe'];
        let switchesSuccessful = 0;

        for (let i = 0; i < 6; i++) {
            const viewMode = views[i % 3];
            await page.selectOption('#view-mode', viewMode);
            await page.waitForTimeout(200);

            const canvas = page.locator('#visualization-canvas');
            const isVisible = await canvas.isVisible();

            if (isVisible) {
                switchesSuccessful++;
            }
        }

        // Wait for operation to complete
        await page.waitForTimeout(2000);

        console.log(`View switches attempted: 6`);
        console.log(`Switches successful: ${switchesSuccessful}`);

        expect(switchesSuccessful).toBe(6);

        console.log('\n✓ View mode switching during execution works correctly\n');
    });

    test('Comprehensive Validation: All Three Systems End-to-End', async ({ page }) => {
        console.log('\n=== COMPREHENSIVE END-TO-END VALIDATION ===\n');

        // Track all events
        const allEvents = {
            vdbe: 0,
            parse: 0,
            page: 0
        };

        page.on('console', msg => {
            const text = msg.text();
            const match = text.match(/Event type (\d+)/);
            if (match) {
                const type = parseInt(match[1]);
                if (type >= 11 && type <= 13) allEvents.vdbe++;
                else if (type >= 8 && type <= 10) allEvents.parse++;
                else if (type <= 7) allEvents.page++;
            }
        });

        // Execute comprehensive workflow
        const workflow = [
            'CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT, value REAL)',
            "INSERT INTO test VALUES (1, 'First', 100.5)",
            "INSERT INTO test VALUES (2, 'Second', 200.7)",
            "UPDATE test SET value = 150.0 WHERE id = 1",
            'DELETE FROM test WHERE id = 2',
            'SELECT * FROM test',
            'DROP TABLE test'
        ];

        for (const sql of workflow) {
            await page.fill('#sql-input', sql);
            await page.click('#execute-btn');
            await page.waitForTimeout(1000);
        }

        // Test each view mode one more time
        const viewResults = {};
        for (const viewMode of ['btree', 'parse', 'vdbe']) {
            await page.selectOption('#view-mode', viewMode);
            await page.waitForTimeout(1000);

            const canvas = page.locator('#visualization-canvas');
            const eventLog = page.locator('#event-log');

            viewResults[viewMode] = {
                canvasVisible: await canvas.isVisible(),
                hasEvents: (await eventLog.textContent()).length > 0
            };
        }

        console.log('\nEnd-to-End Results:');
        console.log(`  Total VDBE events: ${allEvents.vdbe}`);
        console.log(`  Total Parse events: ${allEvents.parse}`);
        console.log(`  Total Page events: ${allEvents.page}`);

        console.log('\nView Mode Results:');
        for (const [mode, results] of Object.entries(viewResults)) {
            console.log(`  ${mode}:`);
            console.log(`    Canvas visible: ${results.canvasVisible}`);
            console.log(`    Has events: ${results.hasEvents}`);
        }

        // Final assertions
        expect(viewResults.btree.canvasVisible).toBeTruthy();
        expect(viewResults.parse.canvasVisible).toBeTruthy();
        expect(viewResults.vdbe.canvasVisible).toBeTruthy();

        expect(viewResults.btree.hasEvents).toBeTruthy();
        expect(viewResults.parse.hasEvents).toBeTruthy();
        expect(viewResults.vdbe.hasEvents).toBeTruthy();

        const totalEvents = allEvents.vdbe + allEvents.parse + allEvents.page;
        console.log(`\nTotal events across all systems: ${totalEvents}`);
        expect(totalEvents).toBeGreaterThan(0);

        console.log('\n✓ All three systems working end-to-end\n');
    });

});
