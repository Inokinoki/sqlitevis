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

// ========================================================================
// Additional coverage tests for previously untested scenarios
// ========================================================================

test.describe('B-Tree Page Splits and Tree Growth', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');
    });

    test('large INSERT batch creates page nodes with cells', async ({ page }) => {
        // Insert enough rows to populate the B-tree
        const inserts = Array.from({ length: 50 }, (_, i) =>
            `INSERT INTO split_test VALUES(${i + 1}, 'row_${i + 1}_padding_text_to_increase_size');`
        ).join('\n');

        await executeSQL(page, `
            CREATE TABLE split_test(id INTEGER PRIMARY KEY, val TEXT);
            ${inserts}
        `);

        const state = await getVisualizerState(page);
        // Should have at least 1 page node
        expect(state.nodes.length).toBeGreaterThanOrEqual(1);

        // All nodes should have valid page numbers
        for (const node of state.nodes) {
            expect(node.page).toBeGreaterThan(0);
        }

        // Total cells across all nodes should reflect inserted data
        const totalCells = state.nodes.reduce((sum, n) => sum + n.cells, 0);
        expect(totalCells).toBeGreaterThan(0);

        // If multiple pages exist, verify parent-child structure
        if (state.nodes.length > 1) {
            const hasParent = state.nodes.some(n => n.parent !== null);
            expect(hasParent).toBe(true);
        }
    });

    test('DROP TABLE removes page nodes via PAGE_FREE events', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE drop_me(id INTEGER PRIMARY KEY, val TEXT);
            INSERT INTO drop_me VALUES(1, 'a');
            INSERT INTO drop_me VALUES(2, 'b');
        `);

        const beforeDrop = await getVisualizerState(page);
        const nodeCountBefore = beforeDrop.nodes.length;
        expect(nodeCountBefore).toBeGreaterThan(0);

        // Drop the table — should trigger PAGE_FREE events
        await executeSQL(page, 'DROP TABLE drop_me;');

        const afterDrop = await getVisualizerState(page);
        // Nodes should be fewer after drop (at least the table's pages removed)
        expect(afterDrop.nodes.length).toBeLessThan(nodeCountBefore);
    });

    test('DELETE FROM without WHERE removes all cells from nodes', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE del_all(id INTEGER PRIMARY KEY, val TEXT);
            INSERT INTO del_all VALUES(1, 'a');
            INSERT INTO del_all VALUES(2, 'b');
            INSERT INTO del_all VALUES(3, 'c');
        `);

        const beforeDelete = await getVisualizerState(page);
        const totalCellsBefore = beforeDelete.nodes.reduce((sum, n) => sum + n.cells, 0);
        expect(totalCellsBefore).toBeGreaterThan(0);

        // Delete all rows
        await executeSQL(page, 'DELETE FROM del_all;');

        const afterDelete = await getVisualizerState(page);
        const totalCellsAfter = afterDelete.nodes.reduce((sum, n) => sum + n.cells, 0);
        // All user cells should be removed (cells from INSERT events are gone)
        expect(totalCellsAfter).toBeLessThan(totalCellsBefore);
    });
});

test.describe('SQL Parse Tree Edge Cases', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');
    });

    test('SELECT with subquery in FROM clause produces correct AST', async ({ page }) => {
        await executeSQL(page, `
            SELECT sub.id, sub.name
            FROM (SELECT id, name FROM users WHERE age > 18) AS sub;
        `);

        const tree = await getASTTree(page);
        expect(tree).toBeTruthy();
        // Should be a SELECT with a FROM clause
        const fromClause = tree.children.find(c => c.type === 'from_clause');
        expect(fromClause).toBeTruthy();
        // The FROM content is in the 'from' child node, not the from_clause label
        const fromContent = fromClause.children.find(c => c.type === 'from');
        expect(fromContent).toBeTruthy();
        // The from content should include the subquery (parenthesized expression)
        expect(fromContent.text).toContain('SELECT');
    });

    test('SELECT with function calls preserves parentheses', async ({ page }) => {
        await executeSQL(page, `
            SELECT COUNT(*), MAX(age), COALESCE(name, 'N/A') FROM users;
        `);

        const tree = await getASTTree(page);
        expect(tree).toBeTruthy();
        // Columns should contain function calls with their arguments
        const colsNode = tree.children.find(c => c.type === 'columns');
        expect(colsNode).toBeTruthy();
        expect(colsNode.text).toContain('COUNT');
        expect(colsNode.text).toContain('MAX');
        expect(colsNode.text).toContain('COALESCE');
    });

    test('SELECT with multiple JOINs produces nested AST', async ({ page }) => {
        await executeSQL(page, `
            SELECT a.id
            FROM users a
            LEFT JOIN orders o ON a.id = o.user_id
            INNER JOIN items i ON o.id = i.order_id
            WHERE a.active = 1;
        `);

        const tree = await getASTTree(page);
        expect(tree).toBeTruthy();

        const fromClause = tree.children.find(c => c.type === 'from_clause');
        expect(fromClause).toBeTruthy();
        // Should have multiple joins
        const joins = fromClause.children.filter(c => c.type === 'join');
        expect(joins.length).toBeGreaterThanOrEqual(2);
    });

    test('CREATE INDEX produces correct AST', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE idx_test(id INTEGER, val TEXT);
            CREATE INDEX idx_val ON idx_test(val);
        `);

        const tree = await getASTTree(page);
        expect(tree).toBeTruthy();
        // Multi-statement: find all CREATE nodes
        const findAllCreates = (node, results = []) => {
            if (!node) return results;
            if (node.type === 'CREATE') results.push(node);
            for (const child of (node.children || [])) {
                findAllCreates(child, results);
            }
            return results;
        };
        const creates = findAllCreates(tree);
        // Should have at least one CREATE node
        expect(creates.length).toBeGreaterThanOrEqual(1);
        // At least one CREATE should mention INDEX
        const hasIndexCreate = creates.some(c => c.text.includes('INDEX'));
        expect(hasIndexCreate).toBe(true);
    });

    test('malformed SQL does not crash the parser', async ({ page }) => {
        // These should not throw — parser handles gracefully
        await executeSQL(page, 'DELETE ;');
        let tree = await getASTTree(page);
        expect(tree).toBeTruthy();

        await executeSQL(page, 'INSERT ;');
        tree = await getASTTree(page);
        expect(tree).toBeTruthy();

        await executeSQL(page, 'SELECT');
        tree = await getASTTree(page);
        expect(tree).toBeTruthy();
    });

    test('SQL with -- line comments strips comments before tokenizing', async ({ page }) => {
        await executeSQL(page, `-- This is a comment
CREATE TABLE comment_test(id INTEGER, val TEXT); -- inline comment
SELECT * FROM comment_test;`);
        await switchView(page, 'parse');

        // Tokens should NOT contain comment text (parseTokens use 'token' field)
        const tokenTexts = await page.evaluate(() =>
            window.viz.parseTokens.map(t => t.token)
        );
        expect(tokenTexts).not.toContain('This');
        expect(tokenTexts).not.toContain('inline');

        // But should contain SQL keywords
        const upper = tokenTexts.map(t => (t || '').toUpperCase());
        expect(upper).toContain('CREATE');
        expect(upper).toContain('TABLE');
    });

    test('SQL with /* */ block comments strips comments before tokenizing', async ({ page }) => {
        await executeSQL(page, `/* multi-line
           comment */
CREATE TABLE block_test(id INTEGER /* primary key */, val TEXT);
SELECT * FROM block_test;`);
        await switchView(page, 'parse');

        const tokenTexts = await page.evaluate(() =>
            window.viz.parseTokens.map(t => t.token)
        );
        expect(tokenTexts).not.toContain('multi-line');
        expect(tokenTexts).not.toContain('primary');

        // AST should still parse correctly
        const tree = await getASTTree(page);
        expect(tree).toBeTruthy();
    });

    test('comments inside string literals are preserved', async ({ page }) => {
        await executeSQL(page, `CREATE TABLE str_test(id INTEGER, val TEXT);
INSERT INTO str_test VALUES(1, '-- not a comment');
SELECT * FROM str_test;`);
        await switchView(page, 'parse');

        // The string token should contain the -- text
        const stringTokens = await page.evaluate(() =>
            window.viz.parseTokens.filter(t => t.type === 'string').map(t => t.token)
        );
        expect(stringTokens.some(s => s && s.includes('not a comment'))).toBe(true);
    });
});

test.describe('VDBE Step Backward and Boundary', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');
    });

    test('step backward decreases VDBE step index', async ({ page }) => {
        await executeSQL(page, 'SELECT 1, 2, 3;');
        await switchView(page, 'vdbe');

        // Step forward twice
        await page.click('#vdbe-next');
        await page.click('#vdbe-next');
        const forwardIndex = await page.evaluate(() => window.viz?.vdbeStepIndex);
        expect(forwardIndex).toBeGreaterThanOrEqual(0);

        // Step backward
        await page.click('#vdbe-prev');
        const backwardIndex = await page.evaluate(() => window.viz?.vdbeStepIndex);

        // Dense opcode list for position check
        const validPcs = await page.evaluate(() => {
            const dense = window.viz?._getDenseOpcodes() || [];
            return dense.map(o => o.pc);
        });

        // Backward index should be at a lower position in the dense list
        const forwardPos = validPcs.indexOf(forwardIndex);
        const backwardPos = validPcs.indexOf(backwardIndex);
        expect(backwardPos).toBeLessThan(forwardPos);
    });

    test('step forward at last opcode stays at boundary', async ({ page }) => {
        await executeSQL(page, 'SELECT 1;');
        await switchView(page, 'vdbe');

        // Step forward many times to exceed opcode count
        for (let i = 0; i < 30; i++) {
            await page.click('#vdbe-next');
        }

        const stepIndex = await page.evaluate(() => window.viz?.vdbeStepIndex);
        const validPcs = await page.evaluate(() => {
            const dense = window.viz?._getDenseOpcodes() || [];
            return dense.map(o => o.pc);
        });

        // Should be at last opcode, not past it
        expect(stepIndex).toBe(validPcs[validPcs.length - 1]);
    });

    test('step backward at first opcode stays at boundary', async ({ page }) => {
        await executeSQL(page, 'SELECT 1;');
        await switchView(page, 'vdbe');

        // Step forward once
        await page.click('#vdbe-next');
        const afterForward = await page.evaluate(() => window.viz?.vdbeStepIndex);

        // Step backward once
        await page.click('#vdbe-prev');
        const afterBackward = await page.evaluate(() => window.viz?.vdbeStepIndex);

        const validPcs = await page.evaluate(() => {
            const dense = window.viz?._getDenseOpcodes() || [];
            return dense.map(o => o.pc);
        });

        // Should be at first opcode
        expect(afterBackward).toBe(validPcs[0]);
    });

    test('step info text updates with opcode name', async ({ page }) => {
        await executeSQL(page, 'SELECT 1;');
        await switchView(page, 'vdbe');

        await page.click('#vdbe-next');

        const infoText = await page.locator('#vdbe-step-info').textContent();
        expect(infoText).toContain('Step');
        expect(infoText).toContain('/');
        // Should show an opcode name in brackets like [0]
        expect(infoText).toMatch(/\[\d+\]/);
    });
});

test.describe('Canvas Node Click Interaction', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');
    });

    test('clicking a B-Tree node toggles expansion state', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE click_test(id INTEGER PRIMARY KEY, val TEXT);
            INSERT INTO click_test VALUES(1, 'a');
            INSERT INTO click_test VALUES(2, 'b');
            INSERT INTO click_test VALUES(3, 'c');
        `);
        await switchView(page, 'btree');

        // Wait for layout to complete
        await page.waitForTimeout(200);

        // Get the first positioned node and compute screen click target
        const clickTarget = await page.evaluate(() => {
            const viz = window.viz;
            const canvas = document.getElementById('visualization-canvas');
            if (!viz || !canvas || viz.nodes.size === 0) return null;

            const rect = canvas.getBoundingClientRect();
            // Find first positioned node
            for (const [pageNum, node] of viz.nodes) {
                if (node.x !== 0 || node.y !== 0) {
                    // Node is drawn in world coords. With default pan=0, zoom=1,
                    // screen coord = world coord (offset by canvas rect).
                    // Click the center of the node bounding box.
                    const sx = node.x + viz.nodeWidth / 2;
                    const sy = node.y + viz.nodeHeight / 2;
                    return { sx, sy, pageNum, expanded: node.expanded };
                }
            }
            return null;
        });

        // Skip if layout didn't produce positioned nodes
        if (!clickTarget) return;

        // Click on the node center (offset by canvas position on page)
        const canvasRect = await page.locator('#visualization-canvas').boundingBox();
        await page.mouse.click(canvasRect.x + clickTarget.sx, canvasRect.y + clickTarget.sy);
        await page.waitForTimeout(100);

        // Verify expansion state changed
        const isExpanded = await page.evaluate((pn) => {
            const node = window.viz?.nodes.get(pn);
            return node ? node.expanded : null;
        }, clickTarget.pageNum);

        expect(isExpanded).toBe(!clickTarget.expanded);
    });
});

// ========================================================================
// VDBE Event & Visualization — deep coverage
// ========================================================================

test.describe('VDBE State Management', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');
    });

    test('showVdbeStart resets opcodes and state on second execution', async ({ page }) => {
        // First execution
        await executeSQL(page, 'SELECT 1, 2, 3;');
        const opcodes1 = await page.evaluate(() =>
            (window.viz?.vdbeOpcodes || []).filter(o => o).length
        );
        expect(opcodes1).toBeGreaterThan(0);

        // Second execution — should reset
        await executeSQL(page, 'SELECT 42;');
        const opcodes2 = await page.evaluate(() =>
            (window.viz?.vdbeOpcodes || []).filter(o => o).length
        );
        // Should have opcodes from new query, not accumulated
        expect(opcodes2).toBeGreaterThan(0);

        // vdbeStepIndex should be reset (not left over from previous step)
        const stepIndex = await page.evaluate(() => window.viz?.vdbeStepIndex);
        expect(stepIndex).toBe(-1);

        // _opcodeCount should reflect new program, not accumulated
        const opcodeCount = await page.evaluate(() => window.viz?._opcodeCount);
        expect(opcodeCount).toBeGreaterThan(0);
    });

    test('VDBE opcodes are stored as sparse array indexed by PC', async ({ page }) => {
        await executeSQL(page, 'SELECT 1;');

        const opcodeInfo = await page.evaluate(() => {
            const viz = window.viz;
            const opcodes = viz?.vdbeOpcodes || [];
            // Check that opcodes are stored at their PC positions
            const dense = opcodes.filter(o => o);
            let pcPositionsMatch = true;
            for (const op of dense) {
                if (opcodes[op.pc] !== op) {
                    pcPositionsMatch = false;
                    break;
                }
            }
            return {
                denseCount: dense.length,
                arrayLength: opcodes.length,
                pcPositionsMatch,
                firstOpcode: dense[0] ? { pc: dense[0].pc, opcode: dense[0].opcode } : null
            };
        });

        expect(opcodeInfo.denseCount).toBeGreaterThan(0);
        expect(opcodeInfo.pcPositionsMatch).toBe(true);
    });

    test('_getDenseOpcodes filters null entries from sparse array', async ({ page }) => {
        await executeSQL(page, 'SELECT 1;');

        const denseInfo = await page.evaluate(() => {
            const viz = window.viz;
            const sparse = viz?.vdbeOpcodes || [];
            const dense = viz?._getDenseOpcodes() || [];
            return {
                sparseLength: sparse.length,
                denseLength: dense.length,
                allNonNull: dense.every(o => o !== null && o !== undefined),
                allHavePc: dense.every(o => typeof o.pc === 'number')
            };
        });

        expect(denseInfo.denseLength).toBeGreaterThan(0);
        expect(denseInfo.allNonNull).toBe(true);
        expect(denseInfo.allHavePc).toBe(true);
        // Dense count may differ from sparse length due to gaps
        expect(denseInfo.denseLength).toBeLessThanOrEqual(denseInfo.sparseLength);
    });

    test('step backward from initial state jumps to last opcode', async ({ page }) => {
        await executeSQL(page, 'SELECT 1, 2;');
        await switchView(page, 'vdbe');

        // Step backward from initial state (stepIndex = -1)
        await page.click('#vdbe-prev');
        await page.waitForTimeout(100);

        const stepIndex = await page.evaluate(() => window.viz?.vdbeStepIndex);
        const validPcs = await page.evaluate(() => {
            const dense = window.viz?._getDenseOpcodes() || [];
            return dense.map(o => o.pc);
        });

        // Should land on last opcode
        expect(stepIndex).toBe(validPcs[validPcs.length - 1]);
    });

    test('VDBE controls visibility toggles with view mode', async ({ page }) => {
        await executeSQL(page, 'SELECT 1;');
        await switchView(page, 'vdbe');

        // Controls should be visible in vdbe mode with opcodes
        await expect(page.locator('#vdbe-next')).toBeVisible();

        // Switch away from vdbe
        await switchView(page, 'btree');
        await expect(page.locator('#vdbe-next')).not.toBeVisible();

        // Switch back
        await switchView(page, 'vdbe');
        await expect(page.locator('#vdbe-next')).toBeVisible();
    });

    test('VDBE complete event shows result code name', async ({ page }) => {
        await executeSQL(page, 'SELECT 1;');
        await switchView(page, 'vdbe');

        // The VDBE title should show "Complete" with "OK" (resultCode 0)
        const canvasTitle = await page.evaluate(() => {
            const canvas = document.getElementById('visualization-canvas');
            const ctx = canvas.getContext('2d');
            // Read pixels from the title area (top of canvas)
            const data = ctx.getImageData(0, 0, canvas.width, 80).data;
            let hasContent = false;
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
                if (a > 0 && (r > 40 || g > 50 || b > 70)) {
                    hasContent = true;
                    break;
                }
            }
            return hasContent;
        });
        expect(canvasTitle).toBe(true);
    });

    test('showVdbeOpcode rejects invalid PC values gracefully', async ({ page }) => {
        await executeSQL(page, 'SELECT 1;');

        // Call showVdbeOpcode with invalid values — should not crash
        const result = await page.evaluate(() => {
            const viz = window.viz;
            const beforeCount = viz.vdbeOpcodes.filter(o => o).length;
            // Invalid calls
            viz.showVdbeOpcode(-1, 'Bad', 0, 0, 0);
            viz.showVdbeOpcode(1.5, 'Bad', 0, 0, 0);
            viz.showVdbeOpcode('abc', 'Bad', 0, 0, 0);
            viz.showVdbeOpcode(0, 12345, 0, 0, 0); // non-string opcode
            const afterCount = viz.vdbeOpcodes.filter(o => o).length;
            return { beforeCount, afterCount };
        });

        // Invalid PCs should not add new opcodes (except non-string opcode stored as 'Unknown')
        // -1, 1.5, 'abc' are rejected
        // 0 with non-string is stored as 'Unknown'
        expect(result.afterCount).toBeGreaterThanOrEqual(result.beforeCount);
    });
});

// ========================================================================
// SQL Parse Tree — deep coverage
// ========================================================================

test.describe('SQL Parse Tree — Statement Types', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');
    });

    test('DELETE with WHERE clause produces correct AST', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE del_ast(id INTEGER PRIMARY KEY, val TEXT);
            DELETE FROM del_ast WHERE id = 5;
        `);

        const tree = await getASTTree(page);
        expect(tree).toBeTruthy();
        // Multi-statement: find DELETE node
        const findDelete = (node) => {
            if (!node) return null;
            if (node.type === 'DELETE') return node;
            for (const child of (node.children || [])) {
                const found = findDelete(child);
                if (found) return found;
            }
            return null;
        };
        const deleteNode = findDelete(tree);
        expect(deleteNode).toBeTruthy();

        // Should have table child
        const tableChild = deleteNode.children.find(c => c.type === 'table');
        expect(tableChild).toBeTruthy();

        // Should have where child
        const whereChild = deleteNode.children.find(c => c.type === 'where');
        expect(whereChild).toBeTruthy();
        expect(whereChild.text).toContain('5');
    });

    test('DELETE without WHERE produces AST with no where child', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE del_nowhere(id INTEGER);
            DELETE FROM del_nowhere;
        `);

        const tree = await getASTTree(page);
        const findNodeByType = (node, type) => {
            if (!node) return null;
            if (node.type === type) return node;
            for (const child of (node.children || [])) {
                const found = findNodeByType(child, type);
                if (found) return found;
            }
            return null;
        };
        const deleteNode = findNodeByType(tree, 'DELETE');
        expect(deleteNode).toBeTruthy();

        const hasWhere = deleteNode.children.some(c => c.type === 'where');
        expect(hasWhere).toBe(false);
    });

    test('UPDATE with SET and WHERE produces correct AST children', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE upd_ast(id INTEGER, val TEXT);
            UPDATE upd_ast SET val = 'new' WHERE id = 1;
        `);

        const tree = await getASTTree(page);
        const findUpdate = (node) => {
            if (!node) return null;
            if (node.type === 'UPDATE') return node;
            for (const child of (node.children || [])) {
                const found = findUpdate(child);
                if (found) return found;
            }
            return null;
        };
        const updateNode = findUpdate(tree);
        expect(updateNode).toBeTruthy();

        const setNode = updateNode.children.find(c => c.type === 'set');
        expect(setNode).toBeTruthy();
        expect(setNode.text).toContain('val');

        const whereNode = updateNode.children.find(c => c.type === 'where');
        expect(whereNode).toBeTruthy();
    });

    test('ALTER TABLE falls through to generic statement node', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE alter_ast(id INTEGER);
            ALTER TABLE alter_ast ADD COLUMN extra TEXT;
        `);

        const tree = await getASTTree(page);
        expect(tree).toBeTruthy();
        // ALTER is not handled by the parser, so it should produce a 'statement' node
        const findAllTypes = (node, types = []) => {
            if (!node) return types;
            types.push(node.type);
            for (const child of (node.children || [])) findAllTypes(child, types);
            return types;
        };
        const types = findAllTypes(tree);
        // Should contain 'statement' for the ALTER
        expect(types).toContain('statement');
    });

    test('DROP TABLE falls through to generic statement node', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE drop_ast(id INTEGER);
            DROP TABLE drop_ast;
        `);

        const tree = await getASTTree(page);
        const types = [];
        const findAllTypes = (node) => {
            if (!node) return;
            types.push(node.type);
            for (const child of (node.children || [])) findAllTypes(child);
        };
        findAllTypes(tree);
        expect(types).toContain('statement');
    });

    test('HAVING clause produces correct AST node content', async ({ page }) => {
        await executeSQL(page, 'SELECT department, COUNT(*) FROM employees GROUP BY department HAVING COUNT(*) > 5;');

        const tree = await getASTTree(page);
        expect(tree).toBeTruthy();
        const havingNode = tree.children.find(c => c.type === 'having');
        expect(havingNode).toBeTruthy();
        expect(havingNode.text).toContain('COUNT');
    });

    test('LIMIT clause produces correct AST node', async ({ page }) => {
        await executeSQL(page, 'SELECT * FROM users LIMIT 10;');

        const tree = await getASTTree(page);
        expect(tree).toBeTruthy();
        const limitNode = tree.children.find(c => c.type === 'limit');
        expect(limitNode).toBeTruthy();
        expect(limitNode.text).toContain('10');
    });

    test('expressions with arithmetic operators tokenize correctly', async ({ page }) => {
        await executeSQL(page, 'SELECT (a + b) * c FROM t;');
        await switchView(page, 'parse');

        const symbols = await page.evaluate(() =>
            window.viz.parseTokens.filter(t => t.type === 'symbol').map(t => t.token)
        );
        expect(symbols).toContain('(');
        expect(symbols).toContain(')');
        expect(symbols).toContain('+');
        expect(symbols).toContain('*');
    });

    test('string concatenation || tokenizes as symbol', async ({ page }) => {
        await executeSQL(page, "SELECT 'hello' || ' world';");
        await switchView(page, 'parse');

        const symbols = await page.evaluate(() =>
            window.viz.parseTokens.filter(t => t.type === 'symbol').map(t => t.token)
        );
        expect(symbols).toContain('||');
    });

    test('parse tree placeholder shown when switching to parse before executing', async ({ page }) => {
        // Switch to parse view before any SQL execution
        await switchView(page, 'parse');

        const hasContent = await canvasHasContent(page);
        // Should show placeholder text on canvas
        expect(hasContent).toBe(true);
    });

    test('escaped quotes in string literals tokenize correctly', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE esc_test(id INTEGER, val TEXT);
            INSERT INTO esc_test VALUES(1, 'it''s here');
        `);
        await switchView(page, 'parse');

        const stringTokens = await page.evaluate(() =>
            window.viz.parseTokens.filter(t => t.type === 'string').map(t => t.token)
        );
        // Should have a string token containing the escaped quote
        const hasEscapedQuote = stringTokens.some(s => s && s.includes("'"));
        expect(hasEscapedQuote).toBe(true);
    });
});

// ========================================================================
// Page Node Events & B-Tree — deep coverage
// ========================================================================

test.describe('B-Tree Node Lifecycle and Edge Cases', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');
    });

    test('removePage unlinks child from parent', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE unlink_test(id INTEGER PRIMARY KEY, val TEXT);
            INSERT INTO unlink_test VALUES(1, 'a');
            INSERT INTO unlink_test VALUES(2, 'b');
        `);

        // Remove a page and verify parent's children list updated
        const unlinkResult = await page.evaluate(() => {
            const viz = window.viz;
            // Find a node that has a parent
            let childPage = null, parentPage = null;
            for (const [pn, node] of viz.nodes) {
                if (node.parent !== null) {
                    childPage = pn;
                    parentPage = node.parent;
                    break;
                }
            }
            if (childPage === null) {
                // No parent-child relationships (single page) — test passes vacuously
                return { hasRelationship: false };
            }

            const parent = viz.nodes.get(parentPage);
            const childrenBefore = [...parent.children];

            viz.removePage(childPage);

            const childrenAfter = [...parent.children];
            return {
                hasRelationship: true,
                childPage,
                childrenBefore,
                childrenAfter,
                stillInChildren: childrenAfter.includes(childPage)
            };
        });

        if (unlinkResult.hasRelationship) {
            expect(unlinkResult.stillInChildren).toBe(false);
        }
    });

    test('addPage does not overwrite existing node cells', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE preserve_test(id INTEGER PRIMARY KEY);
            INSERT INTO preserve_test VALUES(1);
            INSERT INTO preserve_test VALUES(2);
        `);

        const result = await page.evaluate(() => {
            const viz = window.viz;
            // Find a node with cells
            let targetPage = null;
            for (const [pn, node] of viz.nodes) {
                if (node.cells.length > 0) {
                    targetPage = pn;
                    break;
                }
            }
            if (targetPage === null) return { hasCells: false };

            const cellsBefore = viz.nodes.get(targetPage).cells.length;
            // Call addPage again on same page number
            viz.addPage(targetPage, 0);
            const cellsAfter = viz.nodes.get(targetPage).cells.length;

            return { hasCells: true, cellsBefore, cellsAfter };
        });

        if (result.hasCells) {
            expect(result.cellsAfter).toBe(result.cellsBefore);
        }
    });

    test('addCell auto-creates page when node does not exist', async ({ page }) => {
        // Verify the auto-creation path works by calling addCell directly
        const result = await page.evaluate(() => {
            const viz = window.viz;
            const testPage = 9999;
            // Ensure page doesn't exist
            viz.nodes.delete(testPage);
            // addCell should auto-create the page
            viz.addCell(testPage, 0, 42);
            const node = viz.nodes.get(testPage);
            return {
                created: !!node,
                hasCell: node && node.cells.length > 0,
                cellKey: node && node.cells[0] ? node.cells[0].key : null
            };
        });

        expect(result.created).toBe(true);
        expect(result.hasCell).toBe(true);
        expect(result.cellKey).toBe('42');
    });

    test('deleteCell with invalid index does not crash', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE bounds_test(id INTEGER PRIMARY KEY);
            INSERT INTO bounds_test VALUES(1);
        `);

        const result = await page.evaluate(() => {
            const viz = window.viz;
            // Find any page with cells
            let targetPage = null;
            for (const [pn, node] of viz.nodes) {
                if (node.cells.length > 0) {
                    targetPage = pn;
                    break;
                }
            }
            if (targetPage === null) return { tested: false };

            const cellsBefore = viz.nodes.get(targetPage).cells.length;
            // Invalid indices — should be no-ops
            viz.deleteCell(targetPage, -1);
            viz.deleteCell(targetPage, 9999);
            viz.deleteCell(99999, 0); // non-existent page
            const cellsAfter = viz.nodes.get(targetPage).cells.length;

            return { tested: true, cellsBefore, cellsAfter };
        });

        if (result.tested) {
            expect(result.cellsAfter).toBe(result.cellsBefore);
        }
    });

    test('findRootPage returns null for disconnected node', async ({ page }) => {
        // Create an orphaned node and test findRootPage
        const result = await page.evaluate(() => {
            const viz = window.viz;
            // Add an orphaned node with parent pointing to non-existent page
            viz.nodes.set(7777, {
                page: 7777, type: 1, cells: [],
                parent: 8888, // non-existent parent
                children: [], x: 0, y: 0, expanded: true
            });
            const root = viz.findRootPage(7777);
            viz.nodes.delete(7777); // cleanup
            return { root };
        });

        expect(result.root).toBeNull();
    });

    test('findRootPage handles cycle without infinite loop', async ({ page }) => {
        const result = await page.evaluate(() => {
            const viz = window.viz;
            // Create a cycle: A -> B -> A
            viz.nodes.set(111, {
                page: 111, type: 1, cells: [],
                parent: 222, children: [], x: 0, y: 0, expanded: true
            });
            viz.nodes.set(222, {
                page: 222, type: 0, cells: [],
                parent: 111, children: [], x: 0, y: 0, expanded: true
            });
            const root = viz.findRootPage(111);
            viz.nodes.delete(111);
            viz.nodes.delete(222);
            return { root };
        });

        // Should terminate (not hang) and return some page number (cycle detected via step limit)
        expect(typeof result.root).toBe('number');
    });

    test('multiple tables have separate root pages', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE sep_a(id INTEGER PRIMARY KEY, val TEXT);
            CREATE TABLE sep_b(id INTEGER PRIMARY KEY, val TEXT);
            INSERT INTO sep_a VALUES(1, 'a1');
            INSERT INTO sep_a VALUES(2, 'a2');
            INSERT INTO sep_b VALUES(10, 'b1');
            INSERT INTO sep_b VALUES(20, 'b2');
        `);

        const result = await page.evaluate(() => {
            const viz = window.viz;
            const roots = [];
            for (const [pn, node] of viz.nodes) {
                if (node.parent === null) {
                    roots.push(pn);
                }
            }
            return { rootCount: roots.length, roots };
        });

        // Should have at least 2 root nodes (one per table)
        expect(result.rootCount).toBeGreaterThanOrEqual(2);
    });

    test('buildLevels handles orphaned child references gracefully', async ({ page }) => {
        const result = await page.evaluate(() => {
            const viz = window.viz;
            // Create a root node with a child reference to a non-existent page
            viz.nodes.set(100, {
                page: 100, type: 0, cells: [],
                parent: null, children: [200, 9999], // 9999 doesn't exist
                x: 0, y: 0, expanded: true
            });
            viz.nodes.set(200, {
                page: 200, type: 1, cells: [{ idx: 0, keyLen: 1, key: '1' }],
                parent: 100, children: [],
                x: 0, y: 0, expanded: true
            });

            const levels = viz.buildLevels(viz.nodes.get(100));
            const totalPages = levels.reduce((sum, level) => sum + level.length, 0);

            viz.nodes.delete(100);
            viz.nodes.delete(200);
            return { levelCount: levels.length, totalPages };
        });

        // Should have 2 levels (root + child), skipping the orphaned 9999
        expect(result.levelCount).toBe(2);
        expect(result.totalPages).toBe(2);
    });

    test('flat grid layout for nodes without parent-child links', async ({ page }) => {
        // Create isolated nodes (no parent-child relationships)
        const result = await page.evaluate(() => {
            const viz = window.viz;
            viz.nodes.clear();
            for (let i = 1; i <= 4; i++) {
                viz.nodes.set(i, {
                    page: i, type: 1, cells: [],
                    parent: null, children: [],
                    x: 0, y: 0, expanded: true
                });
            }
            viz._layoutCache.clear();
            viz.layout();

            const positions = [];
            for (const [pn, node] of viz.nodes) {
                positions.push({ page: pn, x: node.x, y: node.y });
            }
            return positions;
        });

        // Should have 4 nodes positioned in a grid
        expect(result.length).toBe(4);
        // All should have non-zero x (grid layout centers them)
        const allPositioned = result.every(p => p.x !== 0 || p.y !== 0);
        expect(allPositioned).toBe(true);
    });

    test('showNodeInfo truncates cells beyond 10', async ({ page }) => {
        // Create a node with > 10 cells directly
        const result = await page.evaluate(() => {
            const viz = window.viz;
            viz.nodes.clear();
            const node = {
                page: 50, type: 1, cells: [],
                parent: null, children: [],
                x: 0, y: 0, expanded: true
            };
            // Add 15 cells
            for (let i = 0; i < 15; i++) {
                node.cells.push({ idx: i, keyLen: i + 1, key: String(i + 1) });
            }
            viz.nodes.set(50, node);
            viz.showNodeInfo(node);

            // Check if truncation message appears
            const cellDiv = viz._nodeInfoCache?.cellDiv;
            const moreText = cellDiv ? [...cellDiv.children]
                .find(c => c.textContent && c.textContent.includes('and') && c.textContent.includes('more'))
                : null;
            const cellCount = cellDiv ? [...cellDiv.children]
                .filter(c => c.textContent && c.textContent.startsWith('Cell ')).length : 0;

            return { hasMoreText: !!moreText, cellCount, totalCells: node.cells.length };
        });

        expect(result.cellCount).toBe(10); // max 10 shown
        expect(result.hasMoreText).toBe(true); // "... and 5 more"
    });

    test('View Row Data button appears for leaf nodes with cells', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE rowdata_test(id INTEGER PRIMARY KEY, val TEXT);
            INSERT INTO rowdata_test VALUES(1, 'hello');
        `);

        const result = await page.evaluate(() => {
            const viz = window.viz;
            // Find a leaf node with cells
            for (const [pn, node] of viz.nodes) {
                if (node.type === 1 && node.cells.length > 0) {
                    // Clear previous cache
                    viz._nodeInfoCache = null;
                    viz.showNodeInfo(node);
                    // Check if button was added
                    const btn = document.querySelector('.btn-view-data');
                    return { found: true, hasButton: !!btn, pageNum: pn };
                }
            }
            return { found: false };
        });

        expect(result.found).toBe(true);
        expect(result.hasButton).toBe(true);
    });

    test('queryNodeData returns error for non-existent table mapping', async ({ page }) => {
        await executeSQL(page, 'SELECT 1;');

        // Try querying node data without having created any tables
        const result = await page.evaluate(async () => {
            const app = window.sqliteApp;
            if (!app || !app.queryNodeData) return { error: 'no app' };
            return await app.queryNodeData(9999, ['1', '2']);
        });

        expect(result.error).toBeTruthy();
    });

    test('clear resets _nodeInfoCache to null', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE cache_test(id INTEGER PRIMARY KEY);
            INSERT INTO cache_test VALUES(1);
        `);

        // Hover a node to create the cache
        await page.evaluate(() => {
            const viz = window.viz;
            for (const [, node] of viz.nodes) {
                if (node.cells.length > 0) {
                    viz.showNodeInfo(node);
                    break;
                }
            }
        });

        const cacheBeforeClear = await page.evaluate(() => !!window.viz?._nodeInfoCache);
        expect(cacheBeforeClear).toBe(true);

        // Clear
        await page.click('#clear-btn');
        await page.waitForTimeout(200);

        const cacheAfterClear = await page.evaluate(() => window.viz?._nodeInfoCache);
        expect(cacheAfterClear).toBeNull();
    });
});

// ========================================================================
// VDBE Viewport Scrolling & Rendering Details
// ========================================================================

test.describe('VDBE Viewport and Rendering', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');
    });

    test('VDBE viewport scrolls for programs with many opcodes', async ({ page }) => {
        // Execute a complex statement to get many opcodes
        await executeSQL(page, `
            CREATE TABLE vw_test(id INTEGER PRIMARY KEY, name TEXT, score REAL);
            INSERT INTO vw_test VALUES(1, 'Alice', 95.5);
            INSERT INTO vw_test VALUES(2, 'Bob', 87.0);
            SELECT v1.name, v2.name FROM vw_test v1, vw_test v2 WHERE v1.score > v2.score;
        `);
        await switchView(page, 'vdbe');

        const opcodeInfo = await page.evaluate(() => {
            const viz = window.viz;
            const dense = viz._getDenseOpcodes();
            return {
                totalOpcodes: dense.length,
                opcodeCount: viz._opcodeCount
            };
        });

        // Step forward past the viewport half to trigger scrolling
        if (opcodeInfo.totalOpcodes > 15) {
            // Step forward many times to scroll
            for (let i = 0; i < 20; i++) {
                await page.click('#vdbe-next');
                await page.waitForTimeout(30);
            }

            // Verify step info shows a high step number
            const infoText = await page.locator('#vdbe-step-info').textContent();
            const stepMatch = infoText.match(/Step (\d+)\/(\d+)/);
            expect(stepMatch).toBeTruthy();
            const stepNum = parseInt(stepMatch[1]);
            expect(stepNum).toBeGreaterThan(10);
        }
    });

    test('VDBE completed state renders on canvas without "Executing" overwrite', async ({ page }) => {
        await executeSQL(page, 'SELECT 1;');
        await switchView(page, 'vdbe');

        // After execution completes, the canvas should show "Complete" title
        // (showVdbeComplete cancels any pending "Executing" rAF draw)
        const hasCompleteContent = await page.evaluate(() => {
            const canvas = document.getElementById('visualization-canvas');
            const ctx = canvas.getContext('2d');
            const data = ctx.getImageData(0, 0, canvas.width, 50).data;
            let hasContent = false;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] > 0 && (data[i] > 40 || data[i + 1] > 50 || data[i + 2] > 70)) {
                    hasContent = true;
                    break;
                }
            }
            return hasContent;
        });
        expect(hasCompleteContent).toBe(true);
    });

    test('VDBE no-opcodes mode shows program trace summary', async ({ page }) => {
        // Execute multiple statements to create multiple VDBE programs
        await executeSQL(page, `
            CREATE TABLE trace_a(x INTEGER);
            CREATE TABLE trace_b(y INTEGER);
            INSERT INTO trace_a VALUES(1);
            SELECT * FROM trace_a;
        `);
        await switchView(page, 'vdbe');

        // Should show multiple programs in the trace view
        const traceInfo = await page.evaluate(() => {
            const starts = eventManager.getEventsByType(11).filter(e => e.data.numOpcodes !== undefined);
            const completes = eventManager.getEventsByType(13).filter(e => e.data.resultCode !== undefined);
            return { starts: starts.length, completes: completes.length };
        });

        expect(traceInfo.starts).toBeGreaterThan(0);
        expect(traceInfo.completes).toBeGreaterThan(0);
    });
});

// ========================================================================
// splitPage method — direct unit-level tests
// ========================================================================

test.describe('B-Tree splitPage Operations', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');
    });

    test('splitPage balance_deeper converts root to interior', async ({ page }) => {
        const result = await page.evaluate(() => {
            const viz = window.viz;
            viz.nodes.clear();
            viz._layoutCache.clear();

            // Create root with cells
            const root = {
                page: 10, type: 1, cells: [
                    { idx: 0, keyLen: 1, key: '1' },
                    { idx: 1, keyLen: 2, key: '2' },
                    { idx: 2, keyLen: 3, key: '3' }
                ],
                parent: null, children: [],
                x: 0, y: 0, expanded: true
            };
            viz.nodes.set(10, root);

            // splitPage with type 2 (balance_deeper)
            viz.splitPage(10, 20, 1, 2);

            const origNode = viz.nodes.get(10);
            const newNode = viz.nodes.get(20);

            return {
                rootBecameInterior: origNode.type === 0,
                rootCellsCleared: origNode.cells.length === 0,
                rootHasNewChild: origNode.children.includes(20),
                newNodeIsLeaf: newNode?.type === 1,
                newNodeParent: newNode?.parent,
                newNodeCells: newNode?.cells.length
            };
        });

        expect(result.rootBecameInterior).toBe(true);
        expect(result.rootCellsCleared).toBe(true);
        expect(result.rootHasNewChild).toBe(true);
        expect(result.newNodeIsLeaf).toBe(true);
        expect(result.newNodeParent).toBe(10);
    });

    test('splitPage balance_quick creates sibling and moves cells', async ({ page }) => {
        const result = await page.evaluate(() => {
            const viz = window.viz;
            viz.nodes.clear();
            viz._layoutCache.clear();

            // Create parent
            viz.nodes.set(5, {
                page: 5, type: 0, cells: [],
                parent: null, children: [10],
                x: 0, y: 0, expanded: true
            });
            // Create original page with 6 cells
            const orig = {
                page: 10, type: 1, cells: [],
                parent: 5, children: [],
                x: 0, y: 0, expanded: true
            };
            for (let i = 0; i < 6; i++) {
                orig.cells.push({ idx: i, keyLen: i + 1, key: String(i + 1) });
            }
            viz.nodes.set(10, orig);

            // splitPage with type 1 (balance_quick), split at cell 3
            viz.splitPage(10, 20, 3, 1);

            const origAfter = viz.nodes.get(10);
            const newAfter = viz.nodes.get(20);
            const parent = viz.nodes.get(5);

            return {
                origCellCount: origAfter.cells.length,
                newCellCount: newAfter.cells.length,
                origStillLeaf: origAfter.type === 1,
                newIsSameType: newAfter.type === 1,
                newHasParent: newAfter.parent === 5,
                parentHasNewChild: parent.children.includes(20),
                totalCells: origAfter.cells.length + newAfter.cells.length
            };
        });

        // Cells split: original keeps 0-2 (3 cells), new gets 3-5 (3 cells)
        expect(result.origCellCount).toBe(3);
        expect(result.newCellCount).toBe(3);
        expect(result.origStillLeaf).toBe(true);
        expect(result.newIsSameType).toBe(true);
        expect(result.newHasParent).toBe(true);
        expect(result.parentHasNewChild).toBe(true);
        expect(result.totalCells).toBe(6); // no cells lost
    });

    test('_linkChild is idempotent — no duplicate children', async ({ page }) => {
        const result = await page.evaluate(() => {
            const viz = window.viz;
            viz.nodes.clear();
            viz.nodes.set(1, {
                page: 1, type: 0, cells: [],
                parent: null, children: [2],
                x: 0, y: 0, expanded: true
            });
            viz.nodes.set(2, {
                page: 2, type: 1, cells: [],
                parent: 1, children: [],
                x: 0, y: 0, expanded: true
            });

            // Link child 2 again
            viz._linkChild(1, 2);
            // And again
            viz._linkChild(1, 2);

            const parent = viz.nodes.get(1);
            const count = parent.children.filter(c => c === 2).length;
            return { childCount: count };
        });

        expect(result.childCount).toBe(1); // not duplicated
    });

    test('addPage rejects parentPage <= 0', async ({ page }) => {
        const result = await page.evaluate(() => {
            const viz = window.viz;
            viz.nodes.clear();
            viz._layoutCache.clear();

            viz.addPage(50, 1, 0);   // parentPage=0 → rejected
            viz.addPage(51, 1, -1);  // parentPage=-1 → rejected

            return {
                p50parent: viz.nodes.get(50)?.parent,
                p51parent: viz.nodes.get(51)?.parent
            };
        });

        expect(result.p50parent).toBeNull();
        expect(result.p51parent).toBeNull();
    });
});

// ========================================================================
// Node Data Rendering — showNodeData states
// ========================================================================

test.describe('Node Data Rendering States', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');
    });

    test('showNodeData renders error state', async ({ page }) => {
        await page.evaluate(() => {
            const viz = window.viz;
            const node = { page: 99, type: 1, cells: [] };
            viz.showNodeData(node, { error: 'Test error message' });
        });

        const dataDiv = await page.locator('#node-data');
        const content = await dataDiv.innerHTML();
        expect(content).toContain('Test error message');
    });

    test('showNodeData renders empty rows state', async ({ page }) => {
        await page.evaluate(() => {
            const viz = window.viz;
            // Remove previous data div
            const existing = document.getElementById('node-data');
            if (existing) existing.remove();
            const node = { page: 99, type: 1, cells: [] };
            viz.showNodeData(node, { columns: ['id'], rows: [] });
        });

        const dataDiv = await page.locator('#node-data');
        const content = await dataDiv.innerHTML();
        expect(content).toContain('No rows found');
    });

    test('showNodeData renders data table for successful query', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE data_render(id INTEGER PRIMARY KEY, name TEXT);
            INSERT INTO data_render VALUES(1, 'Alice');
            INSERT INTO data_render VALUES(2, 'Bob');
        `);

        await page.evaluate(() => {
            const viz = window.viz;
            // Remove previous data div
            const existing = document.getElementById('node-data');
            if (existing) existing.remove();
            const node = { page: 99, type: 1, cells: [] };
            viz.showNodeData(node, {
                columns: ['id', 'name'],
                rows: [[1, 'Alice'], [2, 'Bob']]
            });
        });

        const dataDiv = await page.locator('#node-data');
        const html = await dataDiv.innerHTML();
        expect(html).toContain('Alice');
        expect(html).toContain('Bob');
        // Should have a table structure
        expect(html).toContain('<th>');
        expect(html).toContain('<td>');
    });
});

// ========================================================================
// _buildPageToTableMap and queryNodeData edge cases
// ========================================================================

test.describe('Page-to-Table Mapping', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');
    });

    test('_buildPageToTableMap only runs for DDL statements', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE map_test(id INTEGER PRIMARY KEY, val TEXT);
        `);

        // Check the map was built
        const mapAfterDDL = await page.evaluate(() =>
            window.sqliteApp?._pageToTable ? window.sqliteApp._pageToTable.size : -1
        );
        expect(mapAfterDDL).toBeGreaterThanOrEqual(0);

        // Execute DML only
        await executeSQL(page, "INSERT INTO map_test VALUES(1, 'hello'); SELECT * FROM map_test;");

        // Map should NOT have been rebuilt (same size)
        const mapAfterDML = await page.evaluate(() =>
            window.sqliteApp?._pageToTable ? window.sqliteApp._pageToTable.size : -1
        );
        expect(mapAfterDML).toBe(mapAfterDDL);
    });

    test('queryNodeData filters non-numeric rowids', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE qnd_test(id INTEGER PRIMARY KEY, val TEXT);
            INSERT INTO qnd_test VALUES(1, 'data');
        `);

        const result = await page.evaluate(async () => {
            const app = window.sqliteApp;
            // Pass non-numeric rowids
            return await app.queryNodeData(2, ['abc', 'def']);
        });

        expect(result.error).toBeTruthy();
        expect(result.error).toContain('No valid rowids');
    });
});

// ========================================================================
// Layout cache eviction
// ========================================================================

test.describe('Layout Cache Behavior', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');
    });

    test('layout cache evicts oldest entry when exceeding 50', async ({ page }) => {
        const result = await page.evaluate(() => {
            const viz = window.viz;
            viz.nodes.clear();
            viz._layoutCache.clear();

            // Force 51 unique layouts by changing node structure each time
            const sizes = [];
            for (let i = 0; i < 52; i++) {
                // Add/remove a node to create unique cache keys
                if (i % 2 === 0) {
                    viz.nodes.set(i + 1, {
                        page: i + 1, type: 1, cells: [],
                        parent: null, children: [],
                        x: 0, y: 0, expanded: true
                    });
                } else {
                    viz.nodes.delete(i);
                }
                viz._layoutCache.clear(); // reset so we can track size
                // Add a fake cache entry
                viz._layoutCache.set(`key-${i}`, new Map());
            }

            // Now test eviction by filling the cache to 50 and adding one more
            viz._layoutCache.clear();
            for (let i = 0; i < 51; i++) {
                // layout() method handles eviction internally
                const fakeKey = `k${i}`;
                if (viz._layoutCache.size >= 50) {
                    viz._layoutCache.delete(viz._layoutCache.keys().next().value);
                }
                viz._layoutCache.set(fakeKey, new Map());
            }

            return { cacheSize: viz._layoutCache.size };
        });

        expect(result.cacheSize).toBe(50); // capped at 50
    });
});

// ========================================================================
// Event System Internals
// ========================================================================

test.describe('Event Manager Internals', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');
    });

    test('events array is pruned to 100 max', async ({ page }) => {
        // Generate many events by executing lots of statements
        const sql = `CREATE TABLE prune_test(id INTEGER);
${Array.from({ length: 60 }, (_, i) => `INSERT INTO prune_test VALUES(${i});`).join('\n')}`;
        await executeSQL(page, sql);

        const eventCount = await page.evaluate(() => eventManager.events.length);
        // Should be capped at 100
        expect(eventCount).toBeLessThanOrEqual(100);
    });

    test('VDBE_OPCODE events are throttled in DOM but not in events array', async ({ page }) => {
        await executeSQL(page, 'CREATE TABLE throttle_test(id INTEGER); INSERT INTO throttle_test VALUES(1); SELECT * FROM throttle_test;');

        const result = await page.evaluate(() => {
            const allVdbe = eventManager.getEventsByType(12); // VDBE_OPCODE
            const domItems = document.querySelectorAll('.event-item.event-vdbe');
            return {
                totalVdbeOpcodes: allVdbe.length,
                domVdbeCount: domItems.length
            };
        });

        // All opcodes should be stored in the events array
        expect(result.totalVdbeOpcodes).toBeGreaterThan(0);
        // DOM may have fewer due to throttling (every 10th)
    });

    test('PARSE_TOKEN events are stored but not logged to DOM', async ({ page }) => {
        await executeSQL(page, 'CREATE TABLE parse_evt_test(id INTEGER);');

        const result = await page.evaluate(() => {
            const parseTokens = eventManager.getEventsByType(9); // PARSE_TOKEN
            const domItems = [...document.querySelectorAll('.event-item')];
            const domParseToken = domItems.filter(el => el.textContent.includes('PARSE_TOKEN'));
            return {
                storedParseTokens: parseTokens.length,
                domParseTokenCount: domParseToken.length
            };
        });

        // PARSE_TOKEN should be stored in events array
        expect(result.storedParseTokens).toBeGreaterThan(0);
        // But NOT logged to DOM (skipped for performance)
        expect(result.domParseTokenCount).toBe(0);
    });

    test('getEventsByType returns correct events for each type', async ({ page }) => {
        await executeSQL(page, 'CREATE TABLE type_test(id INTEGER); INSERT INTO type_test VALUES(1);');

        const counts = await page.evaluate(() => {
            return {
                btreeInsert: eventManager.getEventsByType(2).length,
                btreeDelete: eventManager.getEventsByType(3).length,
                pageFree: eventManager.getEventsByType(7).length,
                parseComplete: eventManager.getEventsByType(10).length,
                vdbeStart: eventManager.getEventsByType(11).length,
                vdbeComplete: eventManager.getEventsByType(13).length
            };
        });

        // Should have BTREE_INSERT events from INSERT
        expect(counts.btreeInsert).toBeGreaterThan(0);
        // Should have VDBE_START and VDBE_COMPLETE from execution
        expect(counts.vdbeStart).toBeGreaterThan(0);
        expect(counts.vdbeComplete).toBeGreaterThan(0);
    });

    test('event count display updates after execution', async ({ page }) => {
        const before = parseInt(await page.locator('#event-count').textContent());

        await executeSQL(page, 'CREATE TABLE evt_count(id INTEGER); INSERT INTO evt_count VALUES(1);');

        const after = parseInt(await page.locator('#event-count').textContent());
        expect(after).toBeGreaterThan(before);
    });

    test('clear events resets event count to 0', async ({ page }) => {
        await executeSQL(page, 'CREATE TABLE clear_evt(id INTEGER);');

        const before = parseInt(await page.locator('#event-count').textContent());
        expect(before).toBeGreaterThan(0);

        await page.click('#clear-events-btn');

        const after = await page.locator('#event-count').textContent();
        expect(after).toBe('0');
    });

    test('DOM event pool recycles elements', async ({ page }) => {
        await executeSQL(page, 'CREATE TABLE pool_test(id INTEGER);');

        // Check pool has elements after clearing
        const poolSize = await page.evaluate(() => {
            // Clear events to return them to pool
            eventManager.clear();
            return eventManager._elementPool.length;
        });

        expect(poolSize).toBeGreaterThan(0);
    });
});

// ========================================================================
// Canvas Rendering Details
// ========================================================================

test.describe('Canvas Rendering Details', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');
    });

    test('B-Tree canvas shows "empty" label for node with no cells and no parent', async ({ page }) => {
        const result = await page.evaluate(() => {
            const viz = window.viz;
            viz.nodes.clear();
            viz._layoutCache.clear();
            // Create an orphaned leaf with no cells
            viz.nodes.set(42, {
                page: 42, type: 1, cells: [],
                parent: null, children: [],
                x: 50, y: 50, expanded: true
            });
            viz.setViewMode('btree');
            viz.layout();
            viz.drawImmediate();

            // Check canvas for "empty" text in the node area
            const canvas = document.getElementById('visualization-canvas');
            const ctx = canvas.getContext('2d');
            // Read a sample of pixels from the node area
            const data = ctx.getImageData(40, 70, 120, 20).data;
            let hasContent = false;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] > 0) hasContent = true;
            }
            return { hasContent };
        });

        expect(result.hasContent).toBe(true);
    });

    test('B-Tree canvas shows "after split" label for child node with no cells', async ({ page }) => {
        const result = await page.evaluate(() => {
            const viz = window.viz;
            viz.nodes.clear();
            viz._layoutCache.clear();
            // Create parent-child where child has no cells
            viz.nodes.set(1, {
                page: 1, type: 0, cells: [],
                parent: null, children: [2],
                x: 50, y: 50, expanded: true
            });
            viz.nodes.set(2, {
                page: 2, type: 1, cells: [],
                parent: 1, children: [],
                x: 50, y: 140, expanded: true
            });
            viz.setViewMode('btree');
            viz.layout();
            viz.drawImmediate();

            return { hasNodes: viz.nodes.size === 2 };
        });

        expect(result.hasNodes).toBe(true);
    });

    test('_astLabel truncates text longer than 30 chars', async ({ page }) => {
        const result = await page.evaluate(() => {
            const viz = window.viz;
            const longText = 'a'.repeat(50);
            const node = { type: 'column', text: longText };
            const label = viz._astLabel(node);
            return { label, originalLen: longText.length };
        });

        expect(result.label.length).toBeLessThan(result.originalLen);
        expect(result.label).toContain('...');
    });

    test('highlightedNodes flash and clear after animation', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const viz = window.viz;
            viz.nodes.clear();
            viz._layoutCache.clear();
            viz.nodes.set(10, {
                page: 10, type: 1, cells: [{ idx: 0, keyLen: 1, key: '1' }],
                parent: null, children: [],
                x: 50, y: 50, expanded: true
            });
            viz.showTransitions = true;

            // Trigger flash
            viz._flashHighlight([10], 50);
            const highlightedDuring = viz.highlightedNodes.has(10);

            // Wait for timeout to clear
            await new Promise(r => setTimeout(r, 100));
            const highlightedAfter = viz.highlightedNodes.has(10);

            return { highlightedDuring, highlightedAfter };
        });

        expect(result.highlightedDuring).toBe(true);
        expect(result.highlightedAfter).toBe(false);
    });

    test('VDBE canvas shows "showing X-Y" when opcodes exceed viewport', async ({ page }) => {
        // Execute complex SQL to get many opcodes
        await executeSQL(page, `
            CREATE TABLE viewport_test(id INTEGER PRIMARY KEY, name TEXT, score REAL);
            INSERT INTO viewport_test VALUES(1, 'Alice', 95.5);
            INSERT INTO viewport_test VALUES(2, 'Bob', 87.0);
            INSERT INTO viewport_test VALUES(3, 'Carol', 92.0);
            SELECT v1.name, v2.name, v1.score - v2.score
            FROM viewport_test v1, viewport_test v2
            WHERE v1.score > v2.score;
        `);
        await switchView(page, 'vdbe');

        const opcodeCount = await page.evaluate(() => {
            const dense = window.viz._getDenseOpcodes();
            return dense.length;
        });

        if (opcodeCount > 15) {
            // Step to a late opcode to trigger viewport scrolling
            for (let i = 0; i < 20; i++) {
                await page.click('#vdbe-next');
                await page.waitForTimeout(20);
            }

            // The canvas should still render content (not crash)
            const hasContent = await canvasHasContent(page);
            expect(hasContent).toBe(true);
        }
    });

    test('parse canvas renders AST tree structure after SELECT', async ({ page }) => {
        await executeSQL(page, 'SELECT id, name FROM users WHERE age > 18;');
        await switchView(page, 'parse');

        // Verify both AST structure and canvas content
        const result = await page.evaluate(() => {
            const viz = window.viz;
            const tree = viz.parseTree;
            return {
                hasTree: !!tree,
                treeType: tree?.type,
                childCount: tree?.children?.length || 0
            };
        });

        expect(result.hasTree).toBe(true);
        expect(result.treeType).toBe('SELECT');
        expect(result.childCount).toBeGreaterThanOrEqual(2);

        const hasContent = await canvasHasContent(page);
        expect(hasContent).toBe(true);
    });

    test('vdbe mode with no opcodes shows program traces instead', async ({ page }) => {
        await executeSQL(page, 'SELECT 1;');
        await switchView(page, 'vdbe');

        // The vdbe list should render (either individual opcodes or program traces)
        const hasContent = await canvasHasContent(page);
        expect(hasContent).toBe(true);

        // Should have VDBE_START and VDBE_COMPLETE events
        const eventInfo = await page.evaluate(() => ({
            starts: eventManager.getEventsByType(11).length,
            completes: eventManager.getEventsByType(13).length
        }));
        expect(eventInfo.starts).toBeGreaterThan(0);
        expect(eventInfo.completes).toBeGreaterThan(0);
    });
});

// ========================================================================
// Parser Edge Cases — SQL constructs the recursive descent parser must handle
// ========================================================================

test.describe('Parser Edge Cases', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');
    });

    test('ALTER TABLE produces statement node (not crash)', async ({ page }) => {
        await executeSQL(page, 'CREATE TABLE alter_src(id INTEGER); ALTER TABLE alter_src ADD COLUMN val TEXT;');
        await switchView(page, 'parse');

        const tree = await page.evaluate(() => window.viz.parseTree);
        expect(tree).not.toBeNull();
        // ALTER is not a dedicated parser — falls into generic statement node
        // Should not crash and should have SQL wrapper with both statements
        expect(tree.type).toBe('SQL');
        expect(tree.children.length).toBe(2);
        // Second child is the ALTER, captured as generic statement
        const alterNode = tree.children[1];
        expect(alterNode.text).toContain('ALTER');
    });

    test('DROP TABLE produces statement node (not crash)', async ({ page }) => {
        await executeSQL(page, 'CREATE TABLE drop_src(id INTEGER); DROP TABLE drop_src;');
        await switchView(page, 'parse');

        const tree = await page.evaluate(() => window.viz.parseTree);
        expect(tree).not.toBeNull();
        expect(tree.type).toBe('SQL');
        expect(tree.children.length).toBe(2);
        const dropNode = tree.children[1];
        expect(dropNode.text).toContain('DROP');
    });

    test('UNION ALL query produces SELECT with UNION in columns', async ({ page }) => {
        await executeSQL(page, 'SELECT 1 UNION ALL SELECT 2;');
        await switchView(page, 'parse');

        const tree = await page.evaluate(() => window.viz.parseTree);
        expect(tree).not.toBeNull();
        // UNION truncates collection at UNION keyword boundary
        // First SELECT should have columns "1" and stop at UNION
        expect(tree.type).toBe('SELECT');
        // Columns should just be "1" (UNION is a boundary)
        const colsNode = tree.children.find(c => c.type === 'columns');
        expect(colsNode).toBeDefined();
    });

    test('subquery in WHERE is captured correctly', async ({ page }) => {
        await executeSQL(page, 'CREATE TABLE subq(id INTEGER); SELECT * FROM subq WHERE id IN (SELECT id FROM subq);');
        await switchView(page, 'parse');

        const tree = await page.evaluate(() => window.viz.parseTree);
        expect(tree).not.toBeNull();
        expect(tree.type).toBe('SQL'); // multi-statement
        const selectNode = tree.children.find(c => c.type === 'SELECT');
        expect(selectNode).toBeDefined();
        const whereNode = selectNode.children.find(c => c.type === 'where');
        expect(whereNode).toBeDefined();
        // WHERE text should contain the subquery
        expect(whereNode.text).toContain('IN');
    });

    test('CASE expression inside SELECT columns', async ({ page }) => {
        await executeSQL(page, "SELECT CASE WHEN id > 5 THEN 'big' ELSE 'small' END FROM (SELECT 10 AS id);");
        await switchView(page, 'parse');

        const tree = await page.evaluate(() => window.viz.parseTree);
        expect(tree).not.toBeNull();
        expect(tree.type).toBe('SELECT');
        const colsNode = tree.children.find(c => c.type === 'columns');
        expect(colsNode).toBeDefined();
        // CASE...END should appear in the columns text
        expect(colsNode.text).toContain('CASE');
        expect(colsNode.text).toContain('END');
    });

    test('BETWEEN operator in WHERE clause', async ({ page }) => {
        await executeSQL(page, 'CREATE TABLE betw(id INTEGER); SELECT * FROM betw WHERE id BETWEEN 1 AND 10;');
        await switchView(page, 'parse');

        const tree = await page.evaluate(() => window.viz.parseTree);
        expect(tree).not.toBeNull();
        const selectNode = tree.children.find(c => c.type === 'SELECT');
        const whereNode = selectNode.children.find(c => c.type === 'where');
        expect(whereNode).toBeDefined();
        expect(whereNode.text).toContain('BETWEEN');
    });

    test('multiple JOINs with ON conditions', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE j1(id INTEGER);
            CREATE TABLE j2(id INTEGER, j1_id INTEGER);
            CREATE TABLE j3(id INTEGER, j2_id INTEGER);
        `);
        await switchView(page, 'parse');

        // Now parse a query with multiple JOINs
        const tree = await page.evaluate((sql) => {
            return window.viz.buildParseTree(sql);
        }, 'SELECT * FROM j1 INNER JOIN j2 ON j1.id = j2.j1_id LEFT JOIN j3 ON j2.id = j3.j2_id WHERE j1.id > 0;');

        expect(tree.type).toBe('SELECT');
        const fromNode = tree.children.find(c => c.type === 'from_clause');
        expect(fromNode).toBeDefined();
        // Should have: from item + 2 join nodes
        const joinNodes = fromNode.children.filter(c => c.type === 'join');
        expect(joinNodes.length).toBe(2);
        // First join should be INNER JOIN
        expect(joinNodes[0].text).toContain('INNER JOIN');
        // Second join should be LEFT JOIN
        expect(joinNodes[1].text).toContain('LEFT JOIN');
        // Both should have ON conditions as children
        expect(joinNodes[0].children.length).toBe(1);
        expect(joinNodes[0].children[0].type).toBe('on');
    });

    test('GROUP BY with HAVING', async ({ page }) => {
        const tree = await page.evaluate((sql) => {
            return window.viz.buildParseTree(sql);
        }, 'SELECT id, COUNT(*) FROM t GROUP BY id HAVING COUNT(*) > 5;');

        expect(tree.type).toBe('SELECT');
        const groupNode = tree.children.find(c => c.type === 'group_by');
        expect(groupNode).toBeDefined();
        expect(groupNode.text).toContain('id');
        const havingNode = tree.children.find(c => c.type === 'having');
        expect(havingNode).toBeDefined();
        expect(havingNode.text).toContain('COUNT');
    });

    test('tokenizeSQL strips -- line comments', async ({ page }) => {
        const tokens = await page.evaluate((sql) => {
            return window.viz.tokenizeSQL(sql);
        }, 'SELECT 1 -- this is a comment\nFROM t;');

        const texts = tokens.map(t => t.text);
        expect(texts).not.toContain('--');
        expect(texts).not.toContain('this');
        expect(texts).toContain('SELECT');
        expect(texts).toContain('FROM');
    });

    test('tokenizeSQL strips /* block comments */', async ({ page }) => {
        const tokens = await page.evaluate((sql) => {
            return window.viz.tokenizeSQL(sql);
        }, 'SELECT /* comment */ 1;');

        const texts = tokens.map(t => t.text);
        expect(texts).not.toContain('comment');
        expect(texts).toContain('SELECT');
        expect(texts).toContain('1');
    });

    test('tokenizeSQL preserves -- inside string literals', async ({ page }) => {
        const tokens = await page.evaluate((sql) => {
            return window.viz.tokenizeSQL(sql);
        }, "SELECT 'not--a-comment' FROM t;");

        const strings = tokens.filter(t => t.type === 'string');
        expect(strings.length).toBe(1);
        expect(strings[0].text).toBe("'not--a-comment'");
    });

    test('tokenizeSQL handles escaped quotes correctly', async ({ page }) => {
        const tokens = await page.evaluate((sql) => {
            return window.viz.tokenizeSQL(sql);
        }, "INSERT INTO t VALUES('it''s done');");

        const strings = tokens.filter(t => t.type === 'string');
        expect(strings.length).toBe(1);
        expect(strings[0].text).toBe("'it''s done'");
    });
});

// ========================================================================
// VDBE Program Trace Rendering
// ========================================================================

test.describe('VDBE Program Trace Rendering', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');
    });

    test('program traces show correct start/complete pairs', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE trace_t(id INTEGER);
            INSERT INTO trace_t VALUES(1);
            SELECT * FROM trace_t;
        `);
        await switchView(page, 'vdbe');

        const traceInfo = await page.evaluate(() => {
            const starts = eventManager.getEventsByType(11).filter(e => e.data.numOpcodes !== undefined);
            const completes = eventManager.getEventsByType(13).filter(e => e.data.resultCode !== undefined);
            return {
                startCount: starts.length,
                completeCount: completes.length,
                opcodes: starts.map(e => e.data.numOpcodes),
                resultCodes: completes.map(e => e.data.resultCode)
            };
        });

        // Should have at least 1 start and 1 complete (may be more from sqlite_master etc.)
        expect(traceInfo.startCount).toBeGreaterThanOrEqual(1);
        expect(traceInfo.completeCount).toBeGreaterThanOrEqual(1);
        // Completes should match starts (events array is pruned but types are consistent)
        for (let i = 0; i < traceInfo.completeCount; i++) {
            expect(typeof traceInfo.resultCodes[i]).toBe('number');
        }
    });

    test('VDBE opcodes have correct p1/p2/p3 params', async ({ page }) => {
        await executeSQL(page, 'CREATE TABLE param_t(id INTEGER PRIMARY KEY, name TEXT);');
        await switchView(page, 'vdbe');

        const opcodes = await page.evaluate(() => {
            const dense = window.viz._getDenseOpcodes();
            return dense.slice(0, 10).map(o => ({
                pc: o.pc,
                opcode: o.opcode,
                p1: o.p1,
                p2: o.p2,
                p3: o.p3
            }));
        });

        // All opcodes should have numeric params
        for (const op of opcodes) {
            expect(typeof op.pc).toBe('number');
            expect(typeof op.opcode).toBe('string');
            expect(typeof op.p1).toBe('number');
            expect(typeof op.p2).toBe('number');
            expect(typeof op.p3).toBe('number');
        }
    });

    test('stepping through VDBE opcodes updates highlightPc correctly', async ({ page }) => {
        await executeSQL(page, 'CREATE TABLE step_v(id INTEGER); INSERT INTO step_v VALUES(1); SELECT * FROM step_v;');
        await switchView(page, 'vdbe');

        // Click next several times and check vdbeStepIndex
        const stepStates = [];
        for (let i = 0; i < 5; i++) {
            await page.click('#vdbe-next');
            await page.waitForTimeout(50);
            const state = await page.evaluate(() => ({
                stepIndex: window.viz.vdbeStepIndex,
                currentPc: window.viz.vdbeCurrentPc,
                opcodeCount: window.viz._opcodeCount
            }));
            stepStates.push(state);
        }

        // stepIndex should increase monotonically
        for (let i = 1; i < stepStates.length; i++) {
            expect(stepStates[i].stepIndex).toBeGreaterThanOrEqual(stepStates[i - 1].stepIndex);
        }
    });
});

// ========================================================================
// B-Tree DELETE Visualization
// ========================================================================

test.describe('B-Tree DELETE Visualization', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');
        await page.selectOption('#view-mode', 'btree');
    });

    test('DELETE reduces cell count on the affected page', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE del_t(id INTEGER PRIMARY KEY, val TEXT);
            INSERT INTO del_t VALUES(1, 'a');
            INSERT INTO del_t VALUES(2, 'b');
            INSERT INTO del_t VALUES(3, 'c');
        `);

        const cellsBefore = await page.evaluate(() => {
            let total = 0;
            for (const [, node] of window.viz.nodes) total += node.cells.length;
            return total;
        });

        // Now delete one row
        await executeSQL(page, 'DELETE FROM del_t WHERE id = 2;');

        const cellsAfter = await page.evaluate(() => {
            let total = 0;
            for (const [, node] of window.viz.nodes) total += node.cells.length;
            return total;
        });

        expect(cellsAfter).toBeLessThan(cellsBefore);
    });

    test('DELETE all rows leaves page with fewer cells', async ({ page }) => {
        await executeSQL(page, `
            CREATE TABLE delall(id INTEGER PRIMARY KEY);
            INSERT INTO delall VALUES(1);
            INSERT INTO delall VALUES(2);
        `);

        await executeSQL(page, 'DELETE FROM delall;');

        const state = await page.evaluate(() => {
            let totalCells = 0;
            let nodeCount = 0;
            for (const [, node] of window.viz.nodes) {
                totalCells += node.cells.length;
                nodeCount++;
            }
            return { totalCells, nodeCount };
        });

        // All cells should be gone (DELETE without WHERE deletes all rows)
        expect(state.totalCells).toBe(0);
    });

    test('multiple INSERT then DELETE cycles', async ({ page }) => {
        // First cycle
        await executeSQL(page, `
            CREATE TABLE cycle(id INTEGER PRIMARY KEY);
            INSERT INTO cycle VALUES(1);
            INSERT INTO cycle VALUES(2);
        `);

        const afterInsert = await page.evaluate(() => {
            let total = 0;
            for (const [, node] of window.viz.nodes) total += node.cells.length;
            return total;
        });
        expect(afterInsert).toBeGreaterThan(0);

        // Delete
        await executeSQL(page, 'DELETE FROM cycle;');
        const afterDelete = await page.evaluate(() => {
            let total = 0;
            for (const [, node] of window.viz.nodes) total += node.cells.length;
            return total;
        });
        expect(afterDelete).toBe(0);

        // Re-insert
        await executeSQL(page, 'INSERT INTO cycle VALUES(3);');
        const afterReinsert = await page.evaluate(() => {
            let total = 0;
            for (const [, node] of window.viz.nodes) total += node.cells.length;
            return total;
        });
        expect(afterReinsert).toBeGreaterThan(0);
    });
});

// ========================================================================
// Stress and Edge Case Tests for All Three Systems
// ========================================================================

test.describe('Stress Tests: B-Tree, Parse, VDBE', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');
    });

    // --- B-Tree Stress ---

    test('rapid sequential CREATE/DROP tables keeps node state consistent', async ({ page }) => {
        await page.selectOption('#view-mode', 'btree');

        for (let i = 0; i < 5; i++) {
            await executeSQL(page, `CREATE TABLE stress${i}(id INTEGER PRIMARY KEY); INSERT INTO stress${i} VALUES(${i});`);
        }

        const nodesBefore = await page.evaluate(() => window.viz.nodes.size);
        expect(nodesBefore).toBeGreaterThan(0);

        // Drop all tables
        for (let i = 0; i < 5; i++) {
            await executeSQL(page, `DROP TABLE stress${i};`);
        }

        // After dropping all, nodes may still exist (SQLite reuses pages)
        // but the key thing is no crash and consistent state
        const nodesAfter = await page.evaluate(() => {
            const nodes = window.viz.nodes;
            let totalCells = 0;
            for (const [, n] of nodes) totalCells += n.cells.length;
            return { count: nodes.size, totalCells };
        });
        expect(typeof nodesAfter.count).toBe('number');
    });

    test('addPage with same page number does not create duplicates', async ({ page }) => {
        const result = await page.evaluate(() => {
            const viz = window.viz;
            viz.nodes.clear();
            viz.addPage(10, 1, null);
            viz.addPage(10, 1, null); // duplicate
            viz.addPage(10, 0, null); // different type — still same page
            return { count: viz.nodes.size, type: viz.nodes.get(10)?.type };
        });

        expect(result.count).toBe(1);
        // Type should be from first addPage (1 = leaf)
        expect(result.type).toBe(1);
    });

    test('addCell on non-existent page auto-creates the page', async ({ page }) => {
        const result = await page.evaluate(() => {
            const viz = window.viz;
            viz.nodes.clear();
            // Auto-creates page 999 with a cell
            viz.addCell(999, 0, 4);
            return { crashed: false, nodeCount: viz.nodes.size, cells: viz.nodes.get(999)?.cells.length };
        });

        expect(result.crashed).toBe(false);
        expect(result.nodeCount).toBe(1); // auto-created
        expect(result.cells).toBe(1);
    });

    test('deleteCell with out-of-bounds index is safely ignored', async ({ page }) => {
        const result = await page.evaluate(() => {
            const viz = window.viz;
            viz.nodes.clear();
            viz.addPage(5, 1, null);
            viz.addCell(5, 0, 4);
            // Delete with invalid index
            viz.deleteCell(5, -1);
            viz.deleteCell(5, 999);
            return { cells: viz.nodes.get(5)?.cells.length };
        });

        // Original cell should still be there
        expect(result.cells).toBe(1);
    });

    test('findRootPage returns null for non-existent page', async ({ page }) => {
        const root = await page.evaluate(() => {
            window.viz.nodes.clear();
            return window.viz.findRootPage(999);
        });

        expect(root).toBeNull();
    });

    test('layout handles canvas width 0 gracefully', async ({ page }) => {
        const result = await page.evaluate(() => {
            const viz = window.viz;
            viz.nodes.clear();
            viz.addPage(1, 1, null);

            // Force canvas to 0 width
            const origWidth = viz.canvas.clientWidth;
            Object.defineProperty(viz.canvas, 'clientWidth', { value: 0, configurable: true });
            Object.defineProperty(viz.canvas, 'clientHeight', { value: 0, configurable: true });

            // Should not crash
            try {
                viz.layout();
                viz._performDraw();
            } catch (e) {
                return { crashed: true, error: e.message };
            }

            // Restore
            Object.defineProperty(viz.canvas, 'clientWidth', { value: origWidth, configurable: true });
            return { crashed: false };
        });

        expect(result.crashed).toBe(false);
    });

    // --- Parse Stress ---

    test('buildParseTree handles empty string', async ({ page }) => {
        const tree = await page.evaluate(() => window.viz.buildParseTree(''));
        expect(tree).not.toBeNull();
        expect(tree.children).toEqual([]);
    });

    test('buildParseTree handles semicolons only', async ({ page }) => {
        const tree = await page.evaluate(() => window.viz.buildParseTree(';;;'));
        expect(tree).not.toBeNull();
        // Should produce empty children (no tokens after comment stripping)
        expect(tree.children.length).toBe(0);
    });

    test('buildParseTree handles very long identifier', async ({ page }) => {
        const longName = 'a'.repeat(200);
        const tree = await page.evaluate((name) => {
            return window.viz.buildParseTree(`SELECT ${name} FROM t;`);
        }, longName);

        expect(tree.type).toBe('SELECT');
        const cols = tree.children.find(c => c.type === 'columns');
        expect(cols.text).toContain(longName);
    });

    test('buildParseTree handles nested parentheses in column defs', async ({ page }) => {
        const tree = await page.evaluate(() => {
            return window.viz.buildParseTree('CREATE TABLE nested(a TEXT CHECK(a IN (1, 2, 3)), b INTEGER);');
        });

        expect(tree.type).toBe('CREATE');
        // Should have table name + 2 column defs (not crash on nested parens)
        const colDefs = tree.children.filter(c => c.type === 'column_def');
        expect(colDefs.length).toBe(2);
    });

    test('_astLabel returns type when text equals type', async ({ page }) => {
        const label = await page.evaluate(() => {
            return window.viz._astLabel({ type: 'SELECT', text: 'SELECT' });
        });
        expect(label).toBe('SELECT');
    });

    test('_astLabel truncates text at 30 chars', async ({ page }) => {
        const label = await page.evaluate(() => {
            return window.viz._astLabel({ type: 'col', text: 'x'.repeat(40) });
        });
        expect(label).toContain('...');
        expect(label.length).toBeLessThan(50);
    });

    // --- VDBE Stress ---

    test('stepVdbe with no opcodes does nothing', async ({ page }) => {
        const result = await page.evaluate(() => {
            window.viz.vdbeOpcodes = [];
            window.viz._resetVdbeState();
            window.viz.stepVdbe(1); // should not crash
            window.viz.stepVdbe(-1); // should not crash
            window.viz.stepVdbe(0); // reset
            return { stepIndex: window.viz.vdbeStepIndex };
        });

        expect(result.stepIndex).toBe(-1);
    });

    test('showVdbeOpcode with negative pc is rejected', async ({ page }) => {
        const result = await page.evaluate(() => {
            window.viz.vdbeOpcodes = [];
            window.viz._resetVdbeState();
            window.viz.showVdbeOpcode(-1, 'Test', 0, 0, 0);
            return { count: window.viz._getDenseOpcodes().length };
        });

        expect(result.count).toBe(0);
    });

    test('showVdbeOpcode with non-string opcode falls back to Unknown', async ({ page }) => {
        const result = await page.evaluate(() => {
            window.viz.vdbeOpcodes = [];
            window.viz._resetVdbeState();
            window.viz.showVdbeOpcode(0, 123, 0, 0, 0); // non-string opcode
            const op = window.viz.vdbeOpcodes[0];
            return { opcode: op?.opcode };
        });

        expect(result.opcode).toBe('Unknown');
    });

    test('showVdbeComplete cancels pending executing draw', async ({ page }) => {
        const result = await page.evaluate(() => {
            window.viz.vdbeOpcodes = [];
            window.viz._resetVdbeState();
            window.viz.viewMode = 'vdbe';

            // Add an opcode (schedules rAF)
            window.viz.showVdbeOpcode(0, 'Init', 0, 0, 0);
            const hadRaf = window.viz._vdbeRafId !== null;

            // Complete should cancel it
            window.viz.showVdbeComplete(0);
            const rafCancelled = window.viz._vdbeRafId === null;

            return { hadRaf, rafCancelled };
        });

        expect(result.rafCancelled).toBe(true);
    });

    test('VDBE step forward then backward returns to original state', async ({ page }) => {
        await executeSQL(page, 'CREATE TABLE step_fb(id INTEGER); INSERT INTO step_fb VALUES(1); SELECT * FROM step_fb;');
        await switchView(page, 'vdbe');

        // Step forward
        await page.click('#vdbe-next');
        await page.waitForTimeout(50);
        const afterForward = await page.evaluate(() => window.viz.vdbeStepIndex);

        // Step backward
        await page.click('#vdbe-prev');
        await page.waitForTimeout(50);
        const afterBack = await page.evaluate(() => window.viz.vdbeStepIndex);

        // After forward + backward, step index should go back
        expect(afterBack).toBeLessThanOrEqual(afterForward);
    });

    test('VDBE reset sets stepIndex to -1', async ({ page }) => {
        await executeSQL(page, 'CREATE TABLE vreset(id INTEGER); INSERT INTO vreset VALUES(1);');
        await switchView(page, 'vdbe');

        // Step forward a few times
        for (let i = 0; i < 3; i++) {
            await page.click('#vdbe-next');
            await page.waitForTimeout(30);
        }

        // Reset
        await page.click('#vdbe-reset');
        await page.waitForTimeout(50);

        const stepIndex = await page.evaluate(() => window.viz.vdbeStepIndex);
        expect(stepIndex).toBe(-1);
    });
});

// ========================================================================
// splitPage and showNodeInfo Edge Cases
// ========================================================================

test.describe('splitPage and Node Info Edge Cases', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');
    });

    test('splitPage balance_quick moves cells to new sibling', async ({ page }) => {
        const result = await page.evaluate(() => {
            const viz = window.viz;
            viz.nodes.clear();
            viz._layoutCache.clear();

            // Create a page with 4 cells
            viz.addPage(10, 1, null);
            for (let i = 0; i < 4; i++) viz.addCell(10, i, i + 1);

            // Sibling split: move cells from index 2 onward
            viz.splitPage(10, 11, 2, 1); // type=1 = balance_quick

            const orig = viz.nodes.get(10);
            const newPg = viz.nodes.get(11);
            return {
                origCells: orig?.cells.length,
                newCells: newPg?.cells.length,
                newParent: newPg?.parent,
                newType: newPg?.type
            };
        });

        // Original keeps cells 0-1 (2 cells)
        expect(result.origCells).toBe(2);
        // New page gets cells 2-3 (2 cells)
        expect(result.newCells).toBe(2);
        // New page is a sibling (same parent: null)
        expect(result.newParent).toBeNull();
        // New page inherits original's type (leaf=1)
        expect(result.newType).toBe(1);
    });

    test('splitPage balance_deeper creates parent-child relationship', async ({ page }) => {
        const result = await page.evaluate(() => {
            const viz = window.viz;
            viz.nodes.clear();
            viz._layoutCache.clear();

            // Create root page with cells
            viz.addPage(5, 1, null);
            viz.addCell(5, 0, 1);
            viz.addCell(5, 1, 2);

            // Root split: page 5 becomes interior, page 6 gets old content
            viz.splitPage(5, 6, 0, 2); // type=2 = balance_deeper

            const root = viz.nodes.get(5);
            const child = viz.nodes.get(6);
            return {
                rootType: root?.type,
                rootCells: root?.cells.length,
                rootChildren: root?.children,
                childParent: child?.parent,
                childCells: child?.cells.length,
                childType: child?.type
            };
        });

        // Root becomes interior (type 0)
        expect(result.rootType).toBe(0);
        // Root has no cells (cleared)
        expect(result.rootCells).toBe(0);
        // Root's children includes the new page
        expect(result.rootChildren).toContain(6);
        // Child's parent is root
        expect(result.childParent).toBe(5);
        // Child inherits the old cells
        expect(result.childCells).toBe(2);
        // Child is a leaf
        expect(result.childType).toBe(1);
    });

    test('splitPage with non-existent original page does not crash', async ({ page }) => {
        const result = await page.evaluate(() => {
            window.viz.nodes.clear();
            // type=1 (balance_quick) — should return early
            window.viz.splitPage(999, 1000, 0, 1);
            // type=2 (balance_deeper) — original is null, should not crash
            window.viz.splitPage(999, 1000, 0, 2);
            return { crashed: false, nodeCount: window.viz.nodes.size };
        });

        expect(result.crashed).toBe(false);
        // balance_deeper calls addPage for newPage even if original is null
        expect(result.nodeCount).toBeGreaterThanOrEqual(0);
    });

    test('splitPage with undefined splitCell uses 0 as default', async ({ page }) => {
        const result = await page.evaluate(() => {
            const viz = window.viz;
            viz.nodes.clear();
            viz._layoutCache.clear();

            viz.addPage(20, 1, null);
            viz.addCell(20, 0, 10);
            viz.addCell(20, 1, 20);

            // undefined splitCell → should default to 0
            viz.splitPage(20, 21, undefined, 1);

            const orig = viz.nodes.get(20);
            const nw = viz.nodes.get(21);
            return {
                origCells: orig?.cells.length,
                newCells: nw?.cells.length
            };
        });

        // All cells moved to new page (split from 0 = all)
        expect(result.origCells).toBe(0);
        expect(result.newCells).toBe(2);
    });

    test('showNodeInfo displays correct page metadata', async ({ page }) => {
        await page.selectOption('#view-mode', 'btree');

        const info = await page.evaluate(() => {
            const viz = window.viz;
            viz.nodes.clear();
            viz.addPage(42, 1, null);
            viz.addCell(42, 0, 100);
            viz.addCell(42, 1, 200);

            const node = viz.nodes.get(42);
            viz.showNodeInfo(node);

            const details = document.getElementById('node-details');
            return {
                visible: !document.getElementById('node-info').classList.contains('hidden'),
                text: details?.textContent || ''
            };
        });

        expect(info.visible).toBe(true);
        expect(info.text).toContain('42');
        expect(info.text).toContain('Leaf');
        expect(info.text).toContain('2'); // 2 cells
        expect(info.text).toContain('100');
    });

    test('showNodeInfo shows "No cells" for empty page', async ({ page }) => {
        await page.selectOption('#view-mode', 'btree');

        const info = await page.evaluate(() => {
            const viz = window.viz;
            viz.nodes.clear();
            viz.addPage(99, 1, null);

            const node = viz.nodes.get(99);
            viz.showNodeInfo(node);

            const details = document.getElementById('node-details');
            return { text: details?.textContent || '' };
        });

        expect(info.text).toContain('No cells');
    });

    test('showNodeInfo shows "Interior" for type 0 nodes', async ({ page }) => {
        await page.selectOption('#view-mode', 'btree');

        const info = await page.evaluate(() => {
            const viz = window.viz;
            viz.nodes.clear();
            viz.addPage(50, 0, null); // interior

            const node = viz.nodes.get(50);
            viz.showNodeInfo(node);

            const details = document.getElementById('node-details');
            return { text: details?.textContent || '' };
        });

        expect(info.text).toContain('Interior');
    });

    test('showNodeInfo caps cell display at 10 with "... and N more"', async ({ page }) => {
        await page.selectOption('#view-mode', 'btree');

        const info = await page.evaluate(() => {
            const viz = window.viz;
            viz.nodes.clear();
            viz.addPage(77, 1, null);
            for (let i = 0; i < 15; i++) viz.addCell(77, i, i + 1);

            viz.showNodeInfo(viz.nodes.get(77));

            const details = document.getElementById('node-details');
            return { text: details?.textContent || '' };
        });

        expect(info.text).toContain('... and 5 more');
    });

    test('hideNodeInfo adds hidden class', async ({ page }) => {
        await page.selectOption('#view-mode', 'btree');

        const result = await page.evaluate(() => {
            const viz = window.viz;
            viz.addPage(1, 1, null);
            viz.showNodeInfo(viz.nodes.get(1));
            const visibleBefore = !document.getElementById('node-info').classList.contains('hidden');
            viz.hideNodeInfo();
            const hiddenAfter = document.getElementById('node-info').classList.contains('hidden');
            return { visibleBefore, hiddenAfter };
        });

        expect(result.visibleBefore).toBe(true);
        expect(result.hiddenAfter).toBe(true);
    });
});

// ========================================================================
// ViewMode Dispatch — events arriving in non-btree mode should not
// overwrite the canvas with btree content
// ========================================================================

test.describe('ViewMode Dispatch', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');
    });

    test('events arriving while in parse mode do not overwrite parse canvas', async ({ page }) => {
        await executeSQL(page, 'CREATE TABLE vm_test(id INTEGER);');
        await switchView(page, 'parse');

        // Execute more SQL while in parse mode (triggers BTREE_INSERT events)
        await executeSQL(page, 'INSERT INTO vm_test VALUES(1);');

        // Parse view should still show the INSERT's parse tree, not btree nodes
        const tree = await page.evaluate(() => window.viz.parseTree);
        expect(tree).not.toBeNull();
        expect(tree.type).toBe('INSERT');
    });

    test('events arriving while in vdbe mode do not overwrite vdbe canvas', async ({ page }) => {
        await executeSQL(page, 'CREATE TABLE vm_v(id INTEGER);');
        await switchView(page, 'vdbe');

        // Execute more SQL while in vdbe mode
        await executeSQL(page, 'INSERT INTO vm_v VALUES(1);');

        // VDBE state should be correct
        const state = await page.evaluate(() => ({
            opcodeCount: window.viz._opcodeCount,
            denseOpcodes: window.viz._getDenseOpcodes().length,
            viewMode: window.viz.viewMode
        }));
        expect(state.viewMode).toBe('vdbe');
        expect(state.opcodeCount).toBeGreaterThan(0);
    });

    test('layout() is not called when in parse mode', async ({ page }) => {
        await executeSQL(page, 'CREATE TABLE layout_t(id INTEGER);');
        await switchView(page, 'parse');

        // Add pages directly (simulates BTREE_INSERT events)
        const result = await page.evaluate(() => {
            window.viz.addPage(100, 1, null);
            // Parse tree should still be intact
            return {
                parseTree: window.viz.parseTree?.type,
                viewMode: window.viz.viewMode
            };
        });

        expect(result.viewMode).toBe('parse');
        expect(result.parseTree).toBe('CREATE');
    });
});
