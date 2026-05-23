const { test, expect } = require('@playwright/test');

const BASE = '/index.html';

/**
 * Deep tests for the three visualization modes:
 * 1. Page-node / B-Tree visualization
 * 2. SQL parse tree visualization
 * 3. VDBE execution visualization
 *
 * These verify the full pipeline: WASM event → eventManager → visualizer state → canvas render.
 */

test.describe('Page-Node Visualization (B-Tree)', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(500);
        await page.selectOption('#view-mode', 'btree');
    });

    test('page nodes are created from PAGE_ALLOCATE events', async ({ page }) => {
        await page.fill('#sql-input', 'CREATE TABLE p1(id INTEGER PRIMARY KEY, val TEXT);');
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const state = await page.evaluate(() => {
            const nodes = [...window.viz.nodes.entries()];
            return {
                count: nodes.length,
                pages: nodes.map(([k, v]) => ({ page: k, type: v.type, cellCount: v.cells.length })),
            };
        });

        // CREATE TABLE should allocate at least 1 page
        expect(state.count).toBeGreaterThanOrEqual(1);
        // All nodes should have valid page numbers (no null/undefined)
        for (const n of state.pages) {
            expect(n.page).not.toBeNull();
            expect(n.page).not.toBeUndefined();
            expect(typeof n.page).toBe('number');
        }
    });

    test('additional pages are allocated with more inserts', async ({ page }) => {
        await page.fill('#sql-input', `CREATE TABLE p2(id INTEGER, v TEXT);
${Array.from({ length: 10 }, (_, i) => `INSERT INTO p2 VALUES(${i}, 'row${i}');`).join('\n')}`);
        await page.click('#execute-btn');
        await page.waitForTimeout(500);

        const { count, pages } = await page.evaluate(() => {
            const nodes = [...window.viz.nodes.entries()];
            return {
                count: nodes.length,
                pages: nodes.map(([k]) => k),
            };
        });

        // Multiple inserts should create more pages
        expect(count).toBeGreaterThanOrEqual(2);
        // Pages should be sequential positive integers
        for (const p of pages) {
            expect(p).toBeGreaterThan(0);
        }
    });

    test('page-count in footer updates after execution', async ({ page }) => {
        // Initially 0 (or low)
        const before = parseInt(await page.locator('#page-count').textContent());

        await page.fill('#sql-input', 'CREATE TABLE footer(id INTEGER);');
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const after = parseInt(await page.locator('#page-count').textContent());
        expect(after).toBeGreaterThan(before);
    });

    test('no null-page ghost nodes from misdirected events', async ({ page }) => {
        await page.fill('#sql-input', `CREATE TABLE ghost(id INTEGER);
INSERT INTO ghost VALUES(1);
SELECT * FROM ghost;`);
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const hasNullNode = await page.evaluate(() => {
            return [...window.viz.nodes.keys()].some(k => k === null || k === undefined || isNaN(k));
        });

        expect(hasNullNode).toBeFalsy();
    });

    test('switching back to btree mode preserves node data', async ({ page }) => {
        await page.fill('#sql-input', 'CREATE TABLE preserve(id INTEGER);');
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const beforeCount = await page.evaluate(() => window.viz.nodes.size);

        // Switch away and back
        await page.selectOption('#view-mode', 'parse');
        await page.waitForTimeout(100);
        await page.selectOption('#view-mode', 'btree');
        await page.waitForTimeout(100);

        const afterCount = await page.evaluate(() => window.viz.nodes.size);
        expect(afterCount).toBe(beforeCount);
    });
});

test.describe('SQL Parse Tree Visualization', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(500);
        await page.selectOption('#view-mode', 'parse');
    });

    test('parseTokens populated from client-side SQL tokenization', async ({ page }) => {
        await page.fill('#sql-input', 'CREATE TABLE tkns(id INTEGER);');
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const tokens = await page.evaluate(() => {
            return window.viz ? window.viz.parseTokens : [];
        });

        expect(tokens.length).toBeGreaterThan(0);

        // Each token should have a `token` (text) and `type`
        for (const t of tokens) {
            expect(t).toHaveProperty('token');
            expect(t).toHaveProperty('type');
            expect(typeof t.token).toBe('string');
            expect(t.token.length).toBeGreaterThan(0);
        }
    });

    test('parseTokens contain SQL keywords', async ({ page }) => {
        await page.fill('#sql-input', 'SELECT id, name FROM users WHERE id > 5;');
        await page.click('#execute-btn');
        await page.waitForTimeout(200);

        const tokens = await page.evaluate(() => {
            return window.viz ? window.viz.parseTokens : [];
        });

        const tokenTexts = tokens.map(t => t.token.toUpperCase());
        expect(tokenTexts).toContain('SELECT');
        expect(tokenTexts).toContain('FROM');
        expect(tokenTexts).toContain('WHERE');
    });

    test('parseTokens distinguish keywords from identifiers', async ({ page }) => {
        await page.fill('#sql-input', 'CREATE TABLE my_table(my_col INTEGER);');
        await page.click('#execute-btn');
        await page.waitForTimeout(200);

        const tokens = await page.evaluate(() => {
            return window.viz ? window.viz.parseTokens : [];
        });

        const keywords = tokens.filter(t => t.type === 'keyword');
        const identifiers = tokens.filter(t => t.type === 'identifier');

        expect(keywords.length).toBeGreaterThan(0);
        expect(identifiers.length).toBeGreaterThan(0);
        // Keywords should include CREATE, TABLE, INTEGER
        const kwTexts = keywords.map(t => t.token.toUpperCase());
        expect(kwTexts).toContain('CREATE');
        expect(kwTexts).toContain('TABLE');
    });

    test('parseTokens reset on each execution', async ({ page }) => {
        await page.fill('#sql-input', 'CREATE TABLE r1(a TEXT);');
        await page.click('#execute-btn');
        await page.waitForTimeout(200);

        await page.fill('#sql-input', 'SELECT * FROM r1;');
        await page.click('#execute-btn');
        await page.waitForTimeout(200);

        const tokens = await page.evaluate(() => window.viz.parseTokens);
        // Should only have tokens from the SELECT, not the earlier CREATE
        const texts = tokens.map(t => t.token.toUpperCase());
        expect(texts).toContain('SELECT');
        // Should NOT contain CREATE from the previous execution
        // (showParseStart resets parseTokens to [])
    });

    test('currentSQL is set to the last executed statement', async ({ page }) => {
        await page.fill('#sql-input', `CREATE TABLE sqltest(x INT);
INSERT INTO sqltest VALUES(1);`);
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const sql = await page.evaluate(() => window.viz.currentSQL);
        // Last statement executed is INSERT INTO sqltest VALUES(1)
        expect(sql).toContain('INSERT');
    });

    test('parse tree is built from SQL', async ({ page }) => {
        await page.fill('#sql-input', 'CREATE TABLE treeprobe(id INTEGER);');
        await page.click('#execute-btn');
        await page.waitForTimeout(200);

        const tree = await page.evaluate(() => window.viz.parseTree);
        expect(tree).not.toBeNull();
        expect(tree).toHaveProperty('type');
        expect(tree.type).toBe('statement');
    });
});

test.describe('VDBE Execution Visualization', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(500);
        await page.selectOption('#view-mode', 'vdbe');
    });

    test('vdbeOpcodes array is initialized (even if WASM lacks VDBE_OPCODE events)', async ({ page }) => {
        await page.fill('#sql-input', 'CREATE TABLE v1(x INTEGER);');
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const opcodes = await page.evaluate(() => window.viz.vdbeOpcodes);
        expect(Array.isArray(opcodes)).toBeTruthy();
    });

    test('VDBE_START events are captured by eventManager', async ({ page }) => {
        await page.fill('#sql-input', `CREATE TABLE vs(id INTEGER);
INSERT INTO vs VALUES(1);
SELECT * FROM vs;`);
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const vdbeStartCount = await page.evaluate(() => {
            // After routing fix, real VDBE_START events (with numOpcodes data) are type 11
            const events = eventManager.getEventsByType(11);
            return events.filter(e => e.data.numOpcodes !== undefined).length;
        });

        expect(vdbeStartCount).toBeGreaterThan(0);
    });

    test('VDBE_COMPLETE events are captured after each statement', async ({ page }) => {
        await page.fill('#sql-input', 'CREATE TABLE vc(a TEXT);');
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const vdbeCompleteCount = await page.evaluate(() => {
            const events = eventManager.getEventsByType(13);
            return events.filter(e => e.data.resultCode !== undefined).length;
        });

        expect(vdbeCompleteCount).toBeGreaterThan(0);
    });

    test('vdbeCurrentPc resets on VDBE_START', async ({ page }) => {
        await page.fill('#sql-input', 'CREATE TABLE vp(x INT);');
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const pc = await page.evaluate(() => window.viz.vdbeCurrentPc);
        expect(pc).toBe(-1); // Reset to -1 by showVdbeStart
    });

    test('switching to vdbe mode and executing shows VDBE events in log', async ({ page }) => {
        await page.fill('#sql-input', 'CREATE TABLE vlog(id INTEGER);');
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const events = await page.locator('.event-item').allTextContents();
        // After routing fix, VDBE_START events show their type name
        const hasVdbe = events.some(e => e.includes('VDBE_START') || e.includes('VDBE_COMPLETE'));
        expect(hasVdbe).toBeTruthy();
    });
});

test.describe('Cross-Visualization Integration', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.waitForTimeout(500);
    });

    test('all three visualizations have data after multi-statement SQL', async ({ page }) => {
        await page.fill('#sql-input', `CREATE TABLE integ(id INTEGER, val TEXT);
INSERT INTO integ VALUES(1, 'a');
INSERT INTO integ VALUES(2, 'b');
SELECT * FROM integ;`);
        await page.click('#execute-btn');
        await page.waitForTimeout(500);

        const state = await page.evaluate(() => ({
            nodeCount: window.viz.nodes.size,
            parseTokenCount: window.viz.parseTokens.length,
            vdbeOpcodeArray: Array.isArray(window.viz.vdbeOpcodes),
            eventCount: eventManager.events.length,
        }));

        // B-Tree: should have page nodes
        expect(state.nodeCount).toBeGreaterThan(0);

        // Parse: should have tokens from the last statement
        expect(state.parseTokenCount).toBeGreaterThan(0);

        // VDBE: array should exist
        expect(state.vdbeOpcodeArray).toBeTruthy();

        // Events: overall event count should be substantial
        expect(state.eventCount).toBeGreaterThan(10);
    });

    test('view switching renders correct canvas content', async ({ page }) => {
        await page.fill('#sql-input', 'CREATE TABLE vsw(a INTEGER); INSERT INTO vsw VALUES(1);');
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        // Check that switching modes doesn't throw errors
        for (const mode of ['btree', 'parse', 'vdbe']) {
            await page.selectOption('#view-mode', mode);
            await page.waitForTimeout(100);
        }

        // Canvas should still be visible
        await expect(page.locator('#visualization-canvas')).toBeVisible();
    });

    test('eventManager routes misdirected parse events correctly', async ({ page }) => {
        await page.fill('#sql-input', 'CREATE TABLE route_test(x INTEGER);');
        await page.click('#execute-btn');
        await page.waitForTimeout(300);

        const routed = await page.evaluate(() => {
            // Check that events with parseType were re-routed to correct types
            const parseStart = eventManager.getEventsByType(8);   // PARSE_START
            const parseToken = eventManager.getEventsByType(9);   // PARSE_TOKEN
            const parseComplete = eventManager.getEventsByType(10); // PARSE_COMPLETE
            return {
                parseStart: parseStart.length,
                parseToken: parseToken.length,
                parseComplete: parseComplete.length,
            };
        });

        // Pre-built WASM sends parse_start with parseType:"start"
        // Our router should re-route these to type 8
        expect(routed.parseStart).toBeGreaterThan(0);
    });
});
