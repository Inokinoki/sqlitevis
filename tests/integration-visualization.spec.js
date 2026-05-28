/**
 * Integration tests: verify each visualization-canvas system works end-to-end
 * - VDBE: events captured, opcodes rendered, step playback works
 * - Parse tree: AST structure correct, JOIN nesting, multi-statement
 * - B-Tree: page hierarchy, parent-child, cell data, canvas rendering
 */
const { test, expect } = require('@playwright/test');
const BASE = '/index.html'; // Relative to baseURL

// Helper: execute SQL and wait for results
async function executeSQL(page, sql) {
    await page.fill('#sql-input', sql);
    await page.click('#execute-btn');
    await page.waitForTimeout(500); // wait for WASM events to flow
}

// Helper: switch to a view mode
async function switchView(page, mode) {
    await page.selectOption('#view-mode', mode);
    await page.waitForTimeout(300);
}

// Helper: get visualizer state from page
async function getVisualizerState(page) {
    return await page.evaluate(() => {
        const viz = window.viz;
        if (!viz) return null;
        return {
            viewMode: viz.viewMode,
            nodes: Array.from(viz.nodes.entries()).map(([k, v]) => ({
                page: v.page,
                type: v.type,
                cells: v.cells ? v.cells.length : 0,
                parent: v.parent,
                children: v.children
            })),
            parseTree: viz.parseTree,
            parseTokens: viz.parseTokens?.length || 0,
            vdbeOpcodes: viz.vdbeOpcodes?.filter(o => o).length || 0,
            vdbeCurrentPc: viz.vdbeCurrentPc,
            currentSQL: viz.currentSQL,
            rootPage: viz.rootPage
        };
    });
}

// Helper: check canvas has actual drawn content (not just background)
async function canvasHasContent(page) {
    return await page.evaluate(() => {
        const canvas = document.getElementById('visualization-canvas');
        if (!canvas) return false;
        const ctx = canvas.getContext('2d');
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        // Check that not all pixels are the same (background-only would be uniform)
        let differentPixels = 0;
        const sampleStep = 20; // sample every 20th pixel
        for (let i = 0; i < data.length; i += 4 * sampleStep) {
            const a = data[i + 3];
            if (a > 0) { // any non-transparent pixel counts
                // Check if it's not just a dark background color (R<30, G<40, B<60)
                const r = data[i], g = data[i + 1], b = data[i + 2];
                if (r > 40 || g > 50 || b > 70) {
                    differentPixels++;
                }
            }
        }
        return differentPixels > 3; // at least a few non-background colored pixels
    });
}

// Helper: get AST node tree structure
async function getASTTree(page) {
    return await page.evaluate(() => {
        const viz = window.viz;
        if (!viz?.parseTree) return null;
        const simplify = (node) => {
            if (!node) return null;
            return {
                type: node.type,
                text: node.text,
                children: (node.children || []).map(simplify)
            };
        };
        return simplify(viz.parseTree);
    });
}

test.describe('B-Tree Page Node Visualization', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');
    });

    test('single table creates page nodes with correct hierarchy', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER);
            INSERT INTO users VALUES (1, 'Alice', 30);
            INSERT INTO users VALUES (2, 'Bob', 25);
            INSERT INTO users VALUES (3, 'Charlie', 35);
        `);

        const state = await getVisualizerState(page);
        expect(state.nodes.length).toBeGreaterThanOrEqual(1); // at least one page for the table

        // Verify root page exists
        const rootNodes = state.nodes.filter(n => n.parent === null || n.parent === 0);
        expect(rootNodes.length).toBeGreaterThan(0);
    });

    test('cells contain inserted data', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE test (id INTEGER PRIMARY KEY, val TEXT);
            INSERT INTO test VALUES (1, 'hello');
            INSERT INTO test VALUES (2, 'world');
            INSERT INTO test VALUES (3, 'foo');
        `);

        const state = await getVisualizerState(page);
        const totalCells = state.nodes.reduce((sum, n) => sum + n.cells, 0);
        expect(totalCells).toBeGreaterThanOrEqual(3); // at least 3 cells from 3 inserts
    });

    test('page nodes render on canvas in btree mode', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE t (id INTEGER PRIMARY KEY);
            INSERT INTO t VALUES (1);
            INSERT INTO t VALUES (2);
        `);
        await switchView(page, 'btree');

        const hasContent = await canvasHasContent(page);
        expect(hasContent).toBe(true);
    });

    test('rootPage is set to a valid page number', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE t (id INTEGER PRIMARY KEY);
            INSERT INTO t VALUES (1);
        `);

        const state = await getVisualizerState(page);
        expect(state.rootPage).toBeTruthy();
        expect(typeof state.rootPage).toBe('number');
    });

    test('multiple tables create separate page hierarchies', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE t1 (id INTEGER PRIMARY KEY);
            CREATE TABLE t2 (id INTEGER PRIMARY KEY);
            INSERT INTO t1 VALUES (1);
            INSERT INTO t2 VALUES (2);
        `);

        const state = await getVisualizerState(page);
        // Should have at least 2 pages (one per table, at minimum)
        expect(state.nodes.length).toBeGreaterThanOrEqual(2);
    });

    test('DELETE removes cells from page nodes', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE t (id INTEGER PRIMARY KEY, val TEXT);
            INSERT INTO t VALUES (1, 'a');
            INSERT INTO t VALUES (2, 'b');
        `);

        const beforeDelete = await getVisualizerState(page);
        const cellsBefore = beforeDelete.nodes.reduce((s, n) => s + n.cells, 0);

        await executeSQL(page, 'DELETE FROM t WHERE id = 1;');

        const afterDelete = await getVisualizerState(page);
        const cellsAfter = afterDelete.nodes.reduce((s, n) => s + n.cells, 0);
        expect(cellsAfter).toBeLessThan(cellsBefore);
    });
});

test.describe('SQL Parse Tree Visualization', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');
    });

    test('simple SELECT produces correct AST', async ({ page }) => {
        await executeSQL(page, 'SELECT id, name FROM users WHERE age > 18;');

        const tree = await getASTTree(page);
        expect(tree).toBeTruthy();
        expect(tree.type).toBe('SELECT');
        expect(tree.children.length).toBeGreaterThanOrEqual(2); // at least columns + FROM
    });

    test('SELECT with JOIN nests join under FROM clause', async ({ page }) => {
        await executeSQL(page, `
            SELECT u.id, o.total
            FROM users u
            LEFT JOIN orders o ON u.id = o.user_id
            WHERE o.total > 100;
        `);

        const tree = await getASTTree(page);
        expect(tree).toBeTruthy();

        // Find the FROM clause
        const fromClause = tree.children.find(c => c.type === 'from_clause');
        expect(fromClause).toBeTruthy();
        expect(fromClause.children.length).toBeGreaterThanOrEqual(2); // from table + join

        // Verify join is a child of from_clause
        const joinNode = fromClause.children.find(c => c.type === 'join');
        expect(joinNode).toBeTruthy();
        expect(joinNode.text).toContain('LEFT JOIN');

        // ON condition should be child of join
        const onNode = joinNode.children.find(c => c.type === 'on');
        expect(onNode).toBeTruthy();
    });

    test('SELECT with GROUP BY and HAVING', async ({ page }) => {
        await executeSQL(page, 'SELECT department, COUNT(*) FROM employees GROUP BY department HAVING COUNT(*) > 5;');

        const tree = await getASTTree(page);
        expect(tree).toBeTruthy();

        const groupBy = tree.children.find(c => c.type === 'group_by');
        expect(groupBy).toBeTruthy();

        const having = tree.children.find(c => c.type === 'having');
        expect(having).toBeTruthy();
    });

    test('INSERT produces correct AST structure', async ({ page }) => {
        await executeSQL(page, "INSERT INTO users (id, name) VALUES (1, 'Alice');");

        const tree = await getASTTree(page);
        expect(tree).toBeTruthy();
        expect(tree.type).toBe('INSERT');

        const tableNode = tree.children.find(c => c.type === 'table');
        expect(tableNode).toBeTruthy();
        expect(tableNode.text).toContain('users');

        // Should have either columns or values child
        const hasContent = tree.children.some(c =>
            c.type === 'columns' || c.type === 'values'
        );
        expect(hasContent).toBe(true);
    });

    test('CREATE TABLE produces column definitions', async ({ page }) => {
        await executeSQL(page, 'CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT NOT NULL);');

        const tree = await getASTTree(page);
        expect(tree.type).toBe('CREATE');

        const columnDefs = tree.children.filter(c => c.type === 'column_def');
        expect(columnDefs.length).toBeGreaterThanOrEqual(2); // id and name
    });

    test('UPDATE with SET and WHERE', async ({ page }) => {
        await executeSQL(page, "UPDATE users SET name = 'Bob' WHERE id = 1;");

        const tree = await getASTTree(page);
        expect(tree.type).toBe('UPDATE');

        const setNode = tree.children.find(c => c.type === 'set');
        expect(setNode).toBeTruthy();

        const whereNode = tree.children.find(c => c.type === 'where');
        expect(whereNode).toBeTruthy();
    });

    test('multi-statement SQL produces SQL root wrapper', async ({ page }) => {
        await executeSQL(page, 'CREATE TABLE t (id INTEGER); INSERT INTO t VALUES (1);');

        const tree = await getASTTree(page);
        // Multi-statement should have SQL root with children
        expect(tree).toBeTruthy();
        // Either SQL root with multiple children, or the last statement
        expect(tree.type).toMatch(/^(SQL|INSERT|CREATE)$/);
    });

    test('parse canvas renders content for SELECT', async ({ page }) => {
        await executeSQL(page, 'SELECT id FROM users WHERE active = 1;');
        await switchView(page, 'parse');

        const hasContent = await canvasHasContent(page);
        expect(hasContent).toBe(true);
    });

    test('parseTokens are populated with correct types', async ({ page }) => {
        await executeSQL(page, 'SELECT id FROM users;');

        const tokens = await page.evaluate(() => {
            const viz = window.viz;
            return viz?.parseTokens || [];
        });

        expect(tokens.length).toBeGreaterThan(0);

        // Should have keywords
        const keywords = tokens.filter(t => t.type === 'keyword');
        expect(keywords.length).toBeGreaterThan(0);

        // SELECT and FROM should be keyword tokens
        const tokenTexts = tokens.map(t => t.token.toUpperCase());
        expect(tokenTexts).toContain('SELECT');
        expect(tokenTexts).toContain('FROM');
    });

    test('parse tree resets between executions', async ({ page }) => {
        await executeSQL(page, 'SELECT id FROM users;');
        const tree1 = await getASTTree(page);

        await executeSQL(page, 'CREATE TABLE t (x INTEGER);');
        const tree2 = await getASTTree(page);

        expect(tree2.type).not.toBe(tree1.type);
    });
});

test.describe('VDBE Execution Visualization', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');
    });

    test('SELECT captures VDBE opcodes with correct structure', async ({ page }) => {
        await executeSQL(page, 'SELECT 1 + 1;');

        const opcodes = await page.evaluate(() => {
            const viz = window.viz;
            return (viz?.vdbeOpcodes || []).filter(o => o).map(o => ({
                pc: o.pc,
                opcode: o.opcode,
                p1: o.p1,
                p2: o.p2,
                p3: o.p3
            }));
        });

        expect(opcodes.length).toBeGreaterThan(0);

        // Each opcode should have required fields
        for (const op of opcodes) {
            expect(op).toHaveProperty('pc');
            expect(op).toHaveProperty('opcode');
            expect(typeof op.pc).toBe('number');
            expect(typeof op.opcode).toBe('string');
        }
    });

    test('common SQLite opcodes appear in SELECT', async ({ page }) => {
        await executeSQL(page, 'SELECT 42;');

        const opcodes = await page.evaluate(() => {
            const viz = window.viz;
            return (viz?.vdbeOpcodes || []).filter(o => o).map(o => o.opcode);
        });

        // SQLite should always have Init and Halt at minimum
        expect(opcodes.length).toBeGreaterThan(0);
        // Some common opcode should appear
        const commonOpcodes = ['Init', 'Integer', 'ResultRow', 'Halt', 'Goto'];
        const hasCommonOpcode = opcodes.some(op => commonOpcodes.includes(op));
        expect(hasCommonOpcode).toBe(true);
    });

    test('VDBE canvas renders content after execution', async ({ page }) => {
        await executeSQL(page, 'SELECT 1;');
        await switchView(page, 'vdbe');

        const hasContent = await canvasHasContent(page);
        expect(hasContent).toBe(true);
    });

    test('step-by-step controls are present in vdbe mode', async ({ page }) => {
        await executeSQL(page, 'SELECT 1;');
        await switchView(page, 'vdbe');

        const nextBtn = page.locator('#vdbe-next');
        const prevBtn = page.locator('#vdbe-prev');
        const resetBtn = page.locator('#vdbe-reset');

        await expect(nextBtn).toBeVisible();
        await expect(prevBtn).toBeVisible();
        await expect(resetBtn).toBeVisible();
    });

    test('step next advances VDBE step index', async ({ page }) => {
        await executeSQL(page, 'SELECT 1, 2, 3;');
        await switchView(page, 'vdbe');

        // Click step next
        await page.click('#vdbe-next');

        const stepIndex = await page.evaluate(() => {
            return window.viz?.vdbeStepIndex;
        });
        expect(stepIndex).toBeGreaterThanOrEqual(0);
    });

    test('step reset sets index back to start', async ({ page }) => {
        await executeSQL(page, 'SELECT 1;');
        await switchView(page, 'vdbe');

        // Step forward first
        await page.click('#vdbe-next');
        await page.click('#vdbe-next');

        // Reset
        await page.click('#vdbe-reset');

        const stepIndex = await page.evaluate(() => {
            return window.viz?.vdbeStepIndex;
        });
        expect(stepIndex).toBe(-1); // reset state
    });

    test('vdbeCurrentPc tracks execution', async ({ page }) => {
        await executeSQL(page, 'SELECT 1;');

        const pc = await page.evaluate(() => {
            return window.viz?.vdbeCurrentPc;
        });
        // Should be a number (possibly -1 if execution completed)
        expect(typeof pc).toBe('number');
    });

    test('different SQL produces different opcode counts', async ({ page }) => {
        await executeSQL(page, 'SELECT 1;');
        const count1 = await page.evaluate(() => {
            return (window.viz?.vdbeOpcodes || []).filter(o => o).length;
        });

        await executeSQL(page, 'SELECT 1, 2, 3, 4, 5;');
        const count2 = await page.evaluate(() => {
            return (window.viz?.vdbeOpcodes || []).filter(o => o).length;
        });

        // More columns should generally produce more opcodes
        expect(count2).toBeGreaterThanOrEqual(count1);
    });
});

test.describe('Cross-System Integration', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');
    });

    test('all three visualization-canvass have data after complex SQL', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price REAL);
            INSERT INTO products VALUES (1, 'Widget', 9.99);
            INSERT INTO products VALUES (2, 'Gadget', 19.99);
            SELECT * FROM products WHERE price > 10;
        `);

        const state = await getVisualizerState(page);

        // B-Tree: should have page nodes
        expect(state.nodes.length).toBeGreaterThan(0);

        // Parse: should have tokens and tree
        expect(state.parseTokens).toBeGreaterThan(0);
        expect(state.parseTree).toBeTruthy();

        // VDBE: should have opcodes
        expect(state.vdbeOpcodes).toBeGreaterThan(0);
    });

    test('view switching preserves data in all modes', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE t (id INTEGER PRIMARY KEY);
            INSERT INTO t VALUES (1);
            SELECT * FROM t;
        `);

        // Switch between all modes and verify data persists
        await switchView(page, 'parse');
        const parseState = await getVisualizerState(page);
        expect(parseState.parseTree).toBeTruthy();

        await switchView(page, 'vdbe');
        const vdbeState = await getVisualizerState(page);
        expect(vdbeState.vdbeOpcodes).toBeGreaterThan(0);

        await switchView(page, 'btree');
        const btreeState = await getVisualizerState(page);
        expect(btreeState.nodes.length).toBeGreaterThan(0);
    });

    test('clearing SQL resets all visualization-canvas data', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE t (id INTEGER PRIMARY KEY);
            INSERT INTO t VALUES (1);
        `);

        // Click clear button to reset
        await page.click('#clear-btn');
        await page.waitForTimeout(300);

        const state = await getVisualizerState(page);
        expect(state.nodes.length).toBe(0);
    });

    test('pan/zoom state resets on new SQL execution', async ({ page }) => {
        await executeSQL(page, 'SELECT 1;');

        // Zoom in via wheel on canvas
        const canvas = page.locator('#visualization-canvas');
        await canvas.hover();
        await page.mouse.wheel(0, -100); // zoom in
        await page.waitForTimeout(100);

        const zoomBefore = await page.evaluate(() => window.viz?._zoom);
        expect(zoomBefore).toBeGreaterThan(1);

        // Execute new SQL — should reset pan/zoom via clearOutput → clear()
        await executeSQL(page, 'SELECT 2;');

        const zoomAfter = await page.evaluate(() => window.viz?._zoom);
        expect(zoomAfter).toBe(1); // reset to default
    });
});
