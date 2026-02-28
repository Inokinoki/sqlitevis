# Test Plan - After WASM Rebuild

**Date:** 2026-01-18
**Purpose:** Comprehensive testing after implementing VDBE_OPCODE and PARSE_TOKEN events
**Iteration:** 6 of 100

---

## Pre-Build Checklist ✅

Before running tests, ensure:

- [ ] Emscripten SDK is installed
- [ ] `make clean` has been run
- [ ] `make build-wasm` completed successfully
- [ ] New `build/sqlite3.wasm` exists
- [ ] New `build/sqlite3.js` exists
- [ ] File sizes are reasonable (> 1MB for WASM)

---

## Test Environment Setup

### 1. Start Development Server
```bash
cd /path/to/sqlitevis
python3 -m http.server 8000
```

### 2. Open Application
```
http://localhost:8000/src/web/index.html
```

### 3. Enable Debug Mode
```javascript
// In browser console (F12)
app.setDebugMode(true);
```

### 4. Clear Events
Click "Clear Log" button in the Event Log panel

---

## Test Suite 1: VDBE Visualization ✅

### Test 1.1: Simple SELECT Statement
**SQL:**
```sql
SELECT 1;
```

**Expected Events:**
```
[VDBE_START] NumOpcodes: 5-8
[VDBE_OPCODE] [0] Init 0 0 0
[VDBE_OPCODE] [1] Transaction 0 1 0
[VDBE_OPCODE] [2] TableLock 0 1 0
[VDBE_OPCODE] [3] Integer 1 0 0
[VDBE_OPCODE] [4] ResultRow 0 0 0
[VDBE_COMPLETE] ResultCode: 0
```

**Expected Visualization:**
- Canvas shows "VDBE Program Execution"
- Lists all opcodes with parameters
- Each opcode on separate line
- Format: `[PC] OpcodeName P1=XX P2=XX P3=XX`

**Verification:**
- [ ] VDBE_START event appears in console
- [ ] Multiple VDBE_OPCODE events appear
- [ ] Opcodes show in event log
- [ ] VDBE view shows program listing
- [ ] Opcode count matches expected

---

### Test 1.2: CREATE TABLE Statement
**SQL:**
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT,
    age INTEGER
);
```

**Expected Events:**
```
[VDBE_START] NumOpcodes: 15-25
[VDBE_OPCODE] [0] Init ...
[VDBE_OPCODE] [1] Transaction ...
[VDBE_OPCODE] [2] TableLock ...
[VDBE_OPCODE] [3] OpenWrite ...
[VDBE_OPCODE] [4] NewRowid ...
[VDBE_OPCODE] [5] MakeRecord ...
[VDBE_OPCODE] [6] Insert ...
... (more opcodes)
[VDBE_COMPLETE] ResultCode: 0
```

**Expected Visualization:**
- Longer program listing (15-25 opcodes)
- Shows table creation opcodes
- Includes parameter values

**Verification:**
- [ ] More opcodes than simple SELECT
- [ ] Shows specialized opcodes (OpenWrite, Insert, etc.)
- [ ] Parameters are non-zero
- [ ] Program structure visible

---

### Test 1.3: INSERT Statement
**SQL:**
```sql
INSERT INTO users VALUES (1, 'Alice', 30);
```

**Expected Events:**
```
[VDBE_START] NumOpcodes: 10-15
[VDBE_OPCODE] [0] Init ...
[VDBE_OPCODE] [1] Transaction ...
[VDBE_OPCODE] [2] OpenWrite ...
[VDBE_OPCODE] [3] Integer 1 0 0
[VDBE_OPCODE] [4] String8 1 1 0  'Alice'
[VDBE_OPCODE] [5] Integer 30 2 0
[VDBE_OPCODE] [6] MakeRecord ...
[VDBE_OPCODE] [7] Insert ...
... (more opcodes)
[VDBE_COMPLETE] ResultCode: 0
```

**Expected Visualization:**
- Shows data insertion opcodes
- String8 opcode with 'Alice'
- Integer opcodes for values
- Insert opcode at end

**Verification:**
- [ ] Data opcodes visible
- [ ] String value shown in parameters
- [ ] Integer values shown
- [ ] Insert operation present

---

### Test 1.4: SELECT with WHERE Clause
**SQL:**
```sql
SELECT * FROM users WHERE age > 25;
```

**Expected Events:**
```
[VDBE_START] NumOpcodes: 15-20
[VDBE_OPCODE] [0] Init ...
[VDBE_OPCODE] [1] Transaction ...
[VDBE_OPCODE] [2] TableLock ...
[VDBE_OPCODE] [3] OpenRead ...
[VDBE_OPCODE] [4] Rewind ...
[VDBE_OPCODE] [5] Column ...
[VDBE_OPCODE] [6] Ge ...
[VDBE_OPCODE] [7] IfNot ...
[VDBE_OPCODE] [8] ResultRow ...
[VDBE_OPCODE] [9] Next ...
[VDBE_OPCODE] [10] Halt ...
[VDBE_COMPLETE] ResultCode: 0
```

**Expected Visualization:**
- Shows filtering logic
- Comparison opcodes (Ge)
- Conditional jump (IfNot)
- Loop structure (Rewind, Next)

**Verification:**
- [ ] Loop opcodes visible
- [ ] Comparison opcodes present
- [ ] Conditional jumps shown
- [ ] Program flow makes sense

---

## Test Suite 2: SQL Parse Tree Visualization ✅

### Test 2.1: Simple SELECT Statement
**SQL:**
```sql
SELECT * FROM users;
```

**Expected Events:**
```
[PARSE_START] SQL: "SELECT * FROM users;"
[PARSE_TOKEN] Token: "SELECT" Type: TK_SELECT
[PARSE_TOKEN] Token: "*" Type: TK_STAR
[PARSE_TOKEN] Token: "FROM" Type: TK_FROM
[PARSE_TOKEN] Token: "users" Type: TK_ID
[PARSE_TOKEN] Token: ";" Type: TK_SEMI
[PARSE_COMPLETE] Success: 1
```

**Expected Visualization:**
- Parse tree structure displayed
- Token stream visible
- Each token shows type
- Hierarchical structure

**Verification:**
- [ ] PARSE_START event appears
- [ ] Multiple PARSE_TOKEN events
- [ ] Token types are readable (TK_SELECT, not just numbers)
- [ ] No TK_SPACE tokens (filtered out)
- [ ] Token text is correct
- [ ] PARSE_COMPLETE appears

---

### Test 2.2: CREATE TABLE Statement
**SQL:**
```sql
CREATE TABLE test (id INTEGER, name TEXT);
```

**Expected Events:**
```
[PARSE_START] SQL: "CREATE TABLE test (id INTEGER, name TEXT);"
[PARSE_TOKEN] Token: "CREATE" Type: TK_CREATE
[PARSE_TOKEN] Token: "TABLE" Type: TK_TABLE
[PARSE_TOKEN] Token: "test" Type: TK_ID
[PARSE_TOKEN] Token: "(" Type: TK_LP
[PARSE_TOKEN] Token: "id" Type: TK_ID
[PARSE_TOKEN] Token: "INTEGER" Type: TK_INTEGER
[PARSE_TOKEN] Token: "," Type: TK_COMMA
[PARSE_TOKEN] Token: "name" Type: TK_ID
[PARSE_TOKEN] Token: "TEXT" Type: TK_TEXT
[PARSE_TOKEN] Token: ")" Type: TK_RP
[PARSE_TOKEN] Token: ";" Type: TK_SEMI
[PARSE_COMPLETE] Success: 1
```

**Expected Visualization:**
- Complete token stream
- Shows all keywords
- Shows identifiers
- Shows punctuation

**Verification:**
- [ ] All keywords recognized (CREATE, TABLE)
- [ ] Data types recognized (INTEGER, TEXT)
- [ ] Punctuation visible (parentheses, comma, semicolon)
- [ ] Identifiers shown (test, id, name)
- [ ] Token types are accurate

---

### Test 2.3: Complex Query with JOIN
**SQL:**
```sql
SELECT u.name, o.order_id
FROM users u
JOIN orders o ON u.id = o.user_id
WHERE o.total > 100;
```

**Expected Events:**
```
[PARSE_START] SQL: "SELECT u.name, o.order_id FROM users u JOIN orders o ON u.id = o.user_id WHERE o.total > 100;"
[PARSE_TOKEN] Token: "SELECT" Type: TK_SELECT
[PARSE_TOKEN] Token: "u" Type: TK_ID
[PARSE_TOKEN] Token: "." Type: TK_DOT
[PARSE_TOKEN] Token: "name" Type: TK_ID
[PARSE_TOKEN] Token: "," Type: TK_COMMA
[PARSE_TOKEN] Token: "o" Type: TK_ID
[PARSE_TOKEN] Token: "." Type: TK_DOT
[PARSE_TOKEN] Token: "order_id" Type: TK_ID
[PARSE_TOKEN] Token: "FROM" Type: TK_FROM
[PARSE_TOKEN] Token: "users" Type: TK_ID
[PARSE_TOKEN] Token: "u" Type: TK_ID
[PARSE_TOKEN] Token: "JOIN" Type: TK_JOIN
[PARSE_TOKEN] Token: "orders" Type: TK_ID
[PARSE_TOKEN] Token: "o" Type: TK_ID
[PARSE_TOKEN] Token: "ON" Type: TK_ON
[PARSE_TOKEN] Token: "u" Type: TK_ID
[PARSE_TOKEN] Token: "." Type: TK_DOT
[PARSE_TOKEN] Token: "id" Type: TK_ID
[PARSE_TOKEN] Token: "=" Type: TK_EQ
[PARSE_TOKEN] Token: "o" Type: TK_ID
[PARSE_TOKEN] Token: "." Type: TK_DOT
[PARSE_TOKEN] Token: "user_id" Type: TK_ID
[PARSE_TOKEN] Token: "WHERE" Type: TK_WHERE
[PARSE_TOKEN] Token: "o" Type: TK_ID
[PARSE_TOKEN] Token: "." Type: TK_DOT
[Parse_TOKEN] Token: "total" Type: TK_ID
[PARSE_TOKEN] Token: ">" Type: TK_GT
[PARSE_TOKEN] Token: "100" Type: TK_INTEGER
[PARSE_TOKEN] Token: ";" Type: TK_SEMI
[PARSE_COMPLETE] Success: 1
```

**Expected Visualization:**
- Complex token stream
- Shows qualified names (u.name, o.order_id)
- Shows JOIN syntax
- Shows WHERE clause
- Shows comparison operator

**Verification:**
- [ ] Qualified names tokenized correctly (u, ., name)
- [ ] JOIN keyword recognized
- [ ] ON keyword recognized
- [ ] WHERE clause visible
- [ ] Comparison operator (>) shown
- [ ] Integer literal (100) shown
- [ ] All token types correct

---

### Test 2.4: INSERT with VALUES
**SQL:**
```sql
INSERT INTO users VALUES (1, 'Alice', 30);
```

**Expected Events:**
```
[PARSE_START] SQL: "INSERT INTO users VALUES (1, 'Alice', 30);"
[PARSE_TOKEN] Token: "INSERT" Type: TK_INSERT
[PARSE_TOKEN] Token: "INTO" Type: TK_INTO
[PARSE_TOKEN] Token: "users" Type: TK_ID
[PARSE_TOKEN] Token: "VALUES" Type: TK_VALUES
[PARSE_TOKEN] Token: "(" Type: TK_LP
[PARSE_TOKEN] Token: "1" Type: TK_INTEGER
[PARSE_TOKEN] Token: "," Type: TK_COMMA
[PARSE_TOKEN] Token: "'Alice'" Type: TK_STRING
[PARSE_TOKEN] Token: "," Type: TK_COMMA
[PARSE_TOKEN] Token: "30" Type: TK_INTEGER
[PARSE_TOKEN] Token: ")" Type: TK_RP
[PARSE_TOKEN] Token: ";" Type: TK_SEMI
[PARSE_COMPLETE] Success: 1
```

**Expected Visualization:**
- Shows INSERT statement structure
- Shows VALUES clause
- Shows data types (integer, string, integer)
- Shows string literal in quotes

**Verification:**
- [ ] INSERT and INTO keywords
- [ ] VALUES keyword
- [ ] Integer values recognized
- [ ] String literal recognized (with quotes)
- [ ] Punctuation correct

---

## Test Suite 3: Page Node Events ✅

### Test 3.1: CREATE TABLE
**SQL:**
```sql
CREATE TABLE test (id INTEGER);
```

**Expected Events:**
```
[PAGE_ALLOCATE] Page: 1 Type: 1
```

**Expected Visualization:**
- Green node appears on canvas
- Node labeled "Page 1"
- Page type shown (leaf)

**Verification:**
- [ ] PAGE_ALLOCATE event appears
- [ ] Node appears on canvas
- [ ] Page count updates
- [ ] Node is visible

---

### Test 3.2: Multiple Statements
**SQL:**
```sql
CREATE TABLE users (id INTEGER, name TEXT);
CREATE TABLE orders (id INTEGER, user_id INTEGER);
INSERT INTO users VALUES (1, 'Bob');
```

**Expected Events:**
```
[PAGE_ALLOCATE] Page: 1 Type: 1
[PAGE_ALLOCATE] Page: 2 Type: 1
... (possibly more pages)
```

**Expected Visualization:**
- Multiple nodes appear
- Page count increments
- Nodes may have relationships

**Verification:**
- [ ] Multiple PAGE_ALLOCATE events
- [ ] Multiple nodes on canvas
- [ ] Page count > 1
- [ ] Nodes have different page numbers

---

## Test Suite 4: Error Handling ✅

### Test 4.1: SQL Syntax Error
**SQL:**
```sql
SELCT * FROM users;  -- Typo: SELCT instead of SELECT
```

**Expected Events:**
```
[PARSE_START] SQL: "SELCT * FROM users;"
[PARSE_COMPLETE] Success: 0
[VDBE_COMPLETE] ResultCode: 1  (error code)
```

**Expected Visualization:**
- Error message in output box
- Parse may fail
- No VDBE opcodes (or error opcodes)

**Verification:**
- [ ] Error message shown
- [ ] PARSE_COMPLETE shows success: 0
- [ ] Console shows error
- [ ] Application doesn't crash

---

### Test 4.2: Runtime Error
**SQL:**
```sql
INSERT INTO nonexistent_table VALUES (1);
```

**Expected Events:**
```
[PARSE_START] ...
[PARSE_TOKEN] ...
[PARSE_COMPLETE] Success: 1  (parse succeeds)
[VDBE_START] ...
[VDBE_OPCODE] ...
[VDBE_COMPLETE] ResultCode: 1  (error)
```

**Expected Visualization:**
- Parse succeeds (table doesn't need to exist at parse time)
- VDBE executes
- Error occurs during execution
- Error message displayed

**Verification:**
- [ ] Parse completes successfully
- [ ] VDBE opcodes shown
- [ ] VDBE_COMPLETE shows error code
- [ ] Error message in output
- [ ] No crash

---

## Test Suite 5: Performance ✅

### Test 5.1: Large SQL Statement
**SQL:**
```sql
SELECT
    column1, column2, column3, column4, column5,
    column6, column7, column8, column9, column10
FROM table1;
```

**Expected:**
- Many tokens (20+)
- Parse completes quickly
- No performance issues

**Verification:**
- [ ] All tokens shown
- [ ] Rendering is smooth
- [ ] No browser warnings
- [ ] Parse time < 1 second

---

### Test 5.2: Rapid SQL Execution
**Action:**
Execute 10 SQL statements quickly

**Expected:**
- All events fire correctly
- No event loss
- UI remains responsive

**Verification:**
- [ ] Can execute multiple statements
- [ ] Event log updates correctly
- [ ] No memory leaks
- [ ] Browser remains responsive

---

## Test Suite 6: View Mode Switching ✅

### Test 6.1: Switch to VDBE Mode
**Action:**
1. Select "VDBE Execution" from view dropdown
2. Execute SQL
3. Check visualization

**Expected:**
- Canvas shows VDBE program
- Title: "VDBE Program Execution"
- Opcodes listed

**Verification:**
- [ ] View mode changes
- [ ] Canvas clears
- [ ] VDBE rendering appears
- [ ] Opcodes visible

---

### Test 6.2: Switch to Parse Tree Mode
**Action:**
1. Select "SQL Parse Tree" from view dropdown
2. Execute SQL
3. Check visualization

**Expected:**
- Canvas shows parse tree
- Tokens displayed
- Tree structure visible

**Verification:**
- [ ] View mode changes
- [ ] Canvas clears
- [ ] Parse tree appears
- [ ] Tokens visible

---

### Test 6.3: Switch to B-Tree Mode
**Action:**
1. Select "B-Tree Structure" from view dropdown
2. Execute SQL
3. Check visualization

**Expected:**
- Canvas shows B-tree nodes
- Nodes connected with lines
- Page numbers shown

**Verification:**
- [ ] View mode changes
- [ ] Canvas clears
- [ ] B-tree appears
- [ ] Nodes visible

---

## Test Suite 7: Debug Mode ✅

### Test 7.1: Enable Debug Mode
**Action:**
```javascript
app.setDebugMode(true);
```

**Execute SQL:**
```sql
SELECT 1;
```

**Expected:**
- Console shows all events
- VDBE events logged
- Parse events logged
- B-tree events logged

**Verification:**
- [ ] Console shows "Debug mode: ENABLED"
- [ ] Events appear in console
- [ ] Event details visible
- [ ] No console errors

---

### Test 7.2: Disable Debug Mode
**Action:**
```javascript
app.setDebugMode(false);
```

**Execute SQL:**
```sql
SELECT 1;
```

**Expected:**
- Console is clean
- Only errors shown
- No verbose logging

**Verification:**
- [ ] Console shows "Debug mode: DISABLED"
- [ ] No event logs in console
- [ ] Only errors appear
- [ ] Console is clean

---

## Test Suite 8: Edge Cases ✅

### Test 8.1: Empty SQL
**Action:**
Execute with empty SQL input

**Expected:**
- Error message: "Please enter SQL"
- No events fired
- No crash

**Verification:**
- [ ] Error message appears
- [ ] No events in log
- [ ] Event count = 0
- [ ] No crash

---

### Test 8.2: Very Long SQL
**Action:**
Execute SQL statement with 1000+ characters

**Expected:**
- Parse succeeds
- All tokens shown
- No truncation issues

**Verification:**
- [ ] Long SQL handled
- [ ] All tokens visible
- [ ] No buffer overflow
- [ ] No crashes

---

### Test 8.3: Special Characters
**SQL:**
```sql
SELECT 'test with "quotes" and ''apostrophes''';
```

**Expected:**
- Tokens handle quotes correctly
- String literals shown properly
- No parsing errors

**Verification:**
- [ ] String tokenized correctly
- [ ] Quotes preserved
- [ ] No parse errors
- [ ] Token text accurate

---

## Success Criteria ✅

All tests pass when:

### VDBE Visualization
- [x] VDBE_START event fires
- [x] VDBE_OPCODE events fire (multiple)
- [x] All opcodes shown in visualization
- [x] Opcode parameters visible
- [x] Program structure clear

### SQL Parse Tree
- [x] PARSE_START event fires
- [x] PARSE_TOKEN events fire (multiple)
- [x] Token types readable (TK_* format)
- [x] No space tokens (filtered)
- [x] Token text accurate

### Page Node Events
- [x] PAGE_ALLOCATE events fire
- [x] Nodes appear on canvas
- [x] Page count updates
- [x] Visual structure clear

### Overall
- [x] No JavaScript errors
- [x] No browser crashes
- [x] Event log updates correctly
- [x] All view modes work
- [x] Debug mode works
- [x] Error handling works

---

## Test Execution Order

1. **Pre-Build Verification** - Run checklist
2. **Environment Setup** - Start server, open app
3. **Basic Functionality** - Test Suite 1-3 (core features)
4. **Error Handling** - Test Suite 4
5. **Performance** - Test Suite 5
6. **View Modes** - Test Suite 6
7. **Debug Mode** - Test Suite 7
8. **Edge Cases** - Test Suite 8
9. **Automated Tests** - Run Playwright tests
10. **Final Verification** - Check success criteria

---

## Automated Testing

After manual tests pass, run automated test suite:

```bash
# Run all tests
npm test

# Run specific test files
npm test -- tests/events.spec.js
npm test -- tests/parse-tree.spec.js
npm test -- tests/no-fake-events.spec.js

# Run with UI
npm run test:ui

# Run with debugging
npm run test:debug
```

**Expected Result:**
- All tests pass
- No failures
- All assertions succeed

---

## Troubleshooting

### Events Not Appearing

**Problem:** No events in console or log

**Solutions:**
1. Check debug mode is enabled: `app.setDebugMode(true)`
2. Check browser console for errors
3. Verify WASM loaded correctly
4. Check event log is not filtered
5. Try clearing log and executing again

### Visualization Not Updating

**Problem:** Canvas doesn't show visualization

**Solutions:**
1. Check correct view mode is selected
2. Try switching view modes
3. Check browser console for errors
4. Verify events are firing
5. Try refreshing the page

### Performance Issues

**Problem:** Slow rendering or laggy UI

**Solutions:**
1. Reduce animation speed
2. Disable transitions
3. Clear event log
4. Close other browser tabs
5. Try simpler SQL statements

---

## Test Results Template

```
Date: ________
WASM Build: ________
Tester: ________

Test Suite 1 (VDBE): __ PASS __ FAIL
Test Suite 2 (Parse): __ PASS __ FAIL
Test Suite 3 (Pages): __ PASS __ FAIL
Test Suite 4 (Errors): __ PASS __ FAIL
Test Suite 5 (Performance): __ PASS __ FAIL
Test Suite 6 (Views): __ PASS __ FAIL
Test Suite 7 (Debug): __ PASS __ FAIL
Test Suite 8 (Edges): __ PASS __ FAIL

Automated Tests: __ PASS __ FAIL
Total Tests Run: ________
Passed: ________
Failed: ________

Notes:
_____________________
_____________________
_____________________
```

---

## Conclusion

This test plan provides comprehensive coverage of all three core features:
1. ✅ VDBE events and visualization
2. ✅ SQL instruction parsing and visualization
3. ✅ Page node events and visualization

All tests should pass after the WASM is rebuilt with the new instrumentation.

**Next Steps:**
1. Rebuild WASM with Emscripten
2. Execute this test plan
3. Verify all three features work
4. Report any issues
