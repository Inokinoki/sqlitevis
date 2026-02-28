-- Test SQL Scenarios for SQLite Visualization
-- Copy and paste each scenario into the SQL editor
-- Enable debug mode first: app.setDebugMode(true)

-- ============================================
-- SCENARIO 1: Simple SELECT (VDBE + Parse)
-- ============================================
SELECT 1;

-- Expected: ~5-8 VDBE opcodes, ~5 parse tokens
-- VDBE should show: Init, Transaction, TableLock, Integer, ResultRow
-- Parse should show: SELECT, 1, ;


-- ============================================
-- SCENARIO 2: CREATE TABLE (VDBE + Parse + Pages)
-- ============================================
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT,
    age INTEGER
);

-- Expected: ~15-25 VDBE opcodes, ~15 parse tokens, 1 page allocation
-- VDBE should show: Init, Transaction, OpenWrite, NewRowid, MakeRecord, Insert
-- Parse should show: CREATE, TABLE, users, (, id, INTEGER, PRIMARY, KEY, ...
-- Pages should show: Page 1 allocated


-- ============================================
-- SCENARIO 3: INSERT Statement (VDBE + Parse)
-- ============================================
INSERT INTO users VALUES (1, 'Alice', 30);

-- Expected: ~10-15 VDBE opcodes, ~12 parse tokens
-- VDBE should show: Init, Transaction, OpenWrite, Integer, String8, Integer, MakeRecord, Insert
-- Parse should show: INSERT, INTO, users, VALUES, (, 1, ,, 'Alice', ,, 30, )


-- ============================================
-- SCENARIO 4: Multiple INSERTs (VDBE + Parse + Pages)
-- ============================================
INSERT INTO users VALUES (2, 'Bob', 25);
INSERT INTO users VALUES (3, 'Charlie', 35);

-- Expected: Multiple VDBE executions, multiple page allocations
-- Each INSERT should generate its own VDBE_START/COMPLETE cycle


-- ============================================
-- SCENARIO 5: SELECT with WHERE (VDBE + Parse)
-- ============================================
SELECT * FROM users WHERE age > 25;

-- Expected: ~15-20 VDBE opcodes, ~10 parse tokens
-- VDBE should show: Init, Transaction, Rewind, Column, Ge, IfNot, ResultRow, Next
-- Parse should show: SELECT, *, FROM, users, WHERE, age, >, 25, ;


-- ============================================
-- SCENARIO 6: SELECT Multiple Columns (Parse)
-- ============================================
SELECT id, name, age FROM users;

-- Expected: ~10-15 VDBE opcodes, ~10 parse tokens
-- Parse should show: SELECT, id, ,, name, ,, age, FROM, users, ;


-- ============================================
-- SCENARIO 7: Complex Query with JOIN (Parse)
-- ============================================
SELECT u.name, o.order_id
FROM users u
JOIN orders o ON u.id = o.user_id
WHERE o.total > 100;

-- Expected: ~25-35 VDBE opcodes, ~25+ parse tokens
-- Parse should show: SELECT, u, ., name, ,, o, ., order_id, FROM, ...
-- VDBE should show complex join logic


-- ============================================
-- SCENARIO 8: CREATE Multiple Tables (Pages)
-- ============================================
CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    total INTEGER
);

CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    name TEXT,
    price INTEGER
);

-- Expected: Multiple page allocations
-- Each CREATE should allocate a new page


-- ============================================
-- SCENARIO 9: UPDATE Statement (VDBE + Parse)
-- ============================================
UPDATE users SET age = 31 WHERE id = 1;

-- Expected: ~15-20 VDBE opcodes, ~12 parse tokens
-- VDBE should show: Init, Transaction, OpenWrite, Seek, IdxGE, Column, IfNoop, MustBeInt, NotExists, ...
-- Parse should show: UPDATE, users, SET, age, =, 31, WHERE, id, =, 1, ;


-- ============================================
-- SCENARIO 10: DELETE Statement (VDBE + Parse)
-- ============================================
DELETE FROM users WHERE id = 2;

-- Expected: ~10-15 VDBE opcodes, ~8 parse tokens
-- VDBE should show: Init, Transaction, OpenWrite, Seek, IdxGE, IfNoop, MustBeInt, NotExists, Delete, ...
-- Parse should show: DELETE, FROM, users, WHERE, id, =, 2, ;


-- ============================================
-- SCENARIO 11: Error Handling - Syntax Error
-- ============================================
SELCT * FROM users;

-- Expected: Parse error
-- PARSE_COMPLETE with success: 0
-- Error message in output
-- No VDBE execution


-- ============================================
-- SCENARIO 12: Error Handling - Runtime Error
-- ============================================
INSERT INTO nonexistent_table VALUES (1, 'test');

-- Expected: Parse succeeds, execution fails
-- PARSE_COMPLETE with success: 1
-- VDBE_START fires
-- VDBE_COMPLETE with error code
-- Error message in output


-- ============================================
-- SCENARIO 13: String Literals (Parse)
-- ============================================
SELECT 'hello', 'world', 'test with "quotes"';

-- Expected: String tokens shown
-- Parse should show: SELECT, 'hello', ,, 'world', ,, 'test with "quotes"',


-- ============================================
-- SCENARIO 14: Numeric Literals (Parse)
-- ============================================
SELECT 123, 45.67, -89;

-- Expected: Numeric tokens shown
-- Parse should show: SELECT, 123, ,, 45.67, ,, -, 89,


-- ============================================
-- SCENARIO 15: Complex Data Types (Parse)
-- ============================================
CREATE TABLE complex_types (
    id INTEGER,
    name TEXT,
    score REAL,
    data BLOB,
    active BOOLEAN
);

-- Expected: All data type keywords recognized
-- Parse should show: CREATE, TABLE, complex_types, (, id, INTEGER, ,, name, TEXT, ,, ...


-- ============================================
-- SCENARIO 16: Transaction Control (VDBE + Parse)
-- ============================================
BEGIN;
INSERT INTO users VALUES (4, 'David', 40);
COMMIT;

-- Expected: Multiple VDBE executions
-- Each statement generates its own VDBE program


-- ============================================
-- SCENARIO 17: Subquery (Parse + VDBE)
-- ============================================
SELECT * FROM users WHERE id IN (SELECT user_id FROM orders WHERE total > 100);

-- Expected: Complex VDBE program
-- Nested query structure in parse tokens


-- ============================================
-- SCENARIO 18: ORDER BY and LIMIT (VDBE + Parse)
-- ============================================
SELECT * FROM users ORDER BY age DESC LIMIT 10;

-- Expected: VDBE shows sorting logic
-- Parse shows ORDER BY, DESC, LIMIT keywords


-- ============================================
-- SCENARIO 19: GROUP BY and HAVING (VDBE + Parse)
-- ============================================
SELECT age, COUNT(*) FROM users GROUP BY age HAVING age > 20;

-- Expected: VDBE shows aggregation logic
-- Parse shows GROUP BY, HAVING keywords


-- ============================================
-- SCENARIO 20: CREATE INDEX (VDBE + Parse)
-- ============================================
CREATE INDEX idx_users_age ON users(age);

-- Expected: ~10-15 VDBE opcodes
-- Parse shows CREATE, INDEX, idx_users_age, ON, users, (, age, )


-- ============================================
-- SCENARIO 21: DROP TABLE (VDBE + Parse)
-- ============================================
DROP TABLE IF EXISTS test_table;

-- Expected: ~5-10 VDBE opcodes
-- Parse shows DROP, TABLE, IF, EXISTS, test_table


-- ============================================
-- SCENARIO 22: ALTER TABLE (Parse)
-- ============================================
ALTER TABLE users ADD COLUMN email TEXT;

-- Expected: Parse shows ALTER, TABLE, users, ADD, COLUMN, email, TEXT


-- ============================================
-- SCENARIO 23: View Mode Test - VDBE
-- ============================================
-- Switch to VDBE Execution view mode
-- Execute: SELECT 1;
-- Check: Opcode listing appears


-- ============================================
-- SCENARIO 24: View Mode Test - Parse Tree
-- ============================================
-- Switch to SQL Parse Tree view mode
-- Execute: SELECT * FROM users;
-- Check: Parse tree appears with tokens


-- ============================================
-- SCENARIO 25: View Mode Test - B-Tree
-- ============================================
-- Switch to B-Tree Structure view mode
-- Execute: CREATE TABLE test (id INTEGER);
-- Check: Page node appears on canvas


-- ============================================
-- TEST EXECUTION INSTRUCTIONS
-- ============================================

/*
1. Start server: python3 -m http.server 8000
2. Open browser to: http://localhost:8000/src/web/index.html
3. Open browser console (F12)
4. Enable debug mode: app.setDebugMode(true)
5. Clear event log
6. Copy each SQL scenario
7. Paste into SQL editor
8. Click "Execute SQL"
9. Check console for events
10. Check event log for formatted output
11. Check visualization canvas
12. Verify expected results

For View Mode Tests:
1. Change view mode dropdown
2. Execute SQL
3. Check canvas updates correctly

For Error Tests:
1. Execute invalid SQL
2. Check error message appears
3. Check no crash occurs
4. Check event log shows error
*/
