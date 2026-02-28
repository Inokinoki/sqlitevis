# SQLite Visualization - Quick Start Guide

**Welcome!** This guide will help you get started with visualizing SQLite's internal operations.

---

## 🚀 Getting Started (3 Steps)

### Step 1: Start the Application

```bash
# Navigate to the sqlitevis directory
cd sqlitevis

# Start the web server
python3 -m http.server 8000
```

### Step 2: Open in Browser

```
http://localhost:8000/src/web/index.html
```

Wait for "Ready" status to appear in the bottom left corner.

### Step 3: Execute SQL!

Type or paste SQL into the editor and click "Execute SQL"

```sql
SELECT 1;
```

---

## 📖 What You'll See

### The Interface

```
┌─────────────────────────────────────────────────────────┐
│  SQL Editor                             Event Log        │
│  ┌──────────────────────────────┐      ┌─────────────┐ │
│  │ SELECT * FROM users;         │      │ [10:23:45]  │ │
│  │                              │      │ PARSE_START │ │
│  │ [Execute] [Clear]            │      │ [10:23:45]  │ │
│  └──────────────────────────────┘      │ PARSE_TOKEN │ │
│                                      └─────────────┘ │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Visualization Canvas                       │  │
│  │                                                   │  │
│  │  (B-tree nodes / Parse tree / VDBE opcodes)      │  │
│  │                                                   │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Three Visualization Modes

**1. B-Tree Structure** (Default)
- Shows database pages as nodes
- Displays parent-child relationships
- Visualizes insertions and deletions

**2. SQL Parse Tree**
- Shows how SQL is tokenized
- Displays token types (SELECT, FROM, etc.)
- Reveals parser structure

**3. VDBE Execution**
- Shows SQLite's bytecode program
- Lists all opcodes with parameters
- Reveals execution plan

---

## 🎯 Common Tasks

### View 1: Simple Query

**SQL:**
```sql
SELECT * FROM users;
```

**What to do:**
1. Select "B-Tree Structure" view mode
2. Click "Execute SQL"
3. Watch pages appear
4. Switch to "VDBE Execution" to see the bytecode

**Expected:**
- Pages allocate (green nodes)
- Event log shows PARSE_START, VDBE_START, opcodes
- VDBE view shows program listing

---

### View 2: Create Table

**SQL:**
```sql
CREATE TABLE employees (
    id INTEGER PRIMARY KEY,
    name TEXT,
    salary INTEGER
);
```

**What to do:**
1. Select "B-Tree Structure" view mode
2. Click "Execute SQL"
3. Check the event log

**Expected:**
- 1 page allocated
- Multiple VDBE opcodes (15-20)
- Parse tokens: CREATE, TABLE, employees, (, id, ...

---

### View 3: Insert Data

**SQL:**
```sql
INSERT INTO employees VALUES (1, 'Alice', 50000);
```

**What to do:**
1. Keep "B-Tree Structure" view mode
2. Click "Execute SQL"
3. Watch the visualization

**Expected:**
- New page may be allocated
- VDBE shows data insertion opcodes
- Parse shows INSERT, VALUES, tokens

---

### View 4: Complex Query

**SQL:**
```sql
SELECT name, salary
FROM employees
WHERE salary > 40000;
```

**What to do:**
1. Select "SQL Parse Tree" view mode
2. Click "Execute SQL"
3. Check token stream
4. Switch to "VDBE Execution" view mode
5. See the comparison opcodes

**Expected:**
- Parse shows: SELECT, name, ,, salary, FROM, ...
- VDBE shows: Init, Transaction, Rewind, Column, Ge, IfNot, ...

---

## 🛠️ Tips and Tricks

### Enable Debug Mode

Want to see what's happening under the hood?

**Open browser console (F12) and type:**
```javascript
app.setDebugMode(true)
```

Now all events will be logged to the console with full details!

**Disable when done:**
```javascript
app.setDebugMode(false)
```

### Clear the Event Log

Event log getting too long? Click "Clear Log" button.

### Change Animation Speed

Use the speed slider:
- **0.1x** - Slow motion (good for learning)
- **1.0x** - Normal speed (default)
- **2.0x** - Fast (good for quick tests)

### Disable Transitions

Don't want animations? Uncheck "Show Transitions"

Updates will be instant.

---

## 🎨 Understanding the Visualizations

### B-Tree Nodes

```
┌─────────────┐
│  Page 1     │  ← Green = Leaf page
│  [1, 2, 3]  │  ← Blue = Interior page
└─────────────┘
     │
     └─ Connected pages
```

- **Green nodes:** Leaf pages (contain data)
- **Blue nodes:** Interior pages (index pages)
- **Lines:** Parent-child relationships
- **Hover:** See page details

### Parse Tree

```
SQL: SELECT * FROM users;

Token Stream:
[SELECT] TK_SELECT
[*] TK_STAR
[FROM] TK_FROM
[users] TK_ID
[;] TK_SEMI
```

- **Tokens:** Show each word/symbol
- **Types:** TK_* format (TK_SELECT, TK_FROM, etc.)
- **Colors:** Different types have different colors

### VDBE Program

```
[0] Init         P1=0  P2=0  P3=0
[1] Transaction  P1=0  P2=1  P3=0
[2] TableLock    P1=0  P2=1  P3=0
[3] OpenRead     P1=0  P2=2  P3=0
```

- **PC:** Program counter (instruction number)
- **Opcode:** Instruction name (Init, Transaction, etc.)
- **P1, P2, P3:** Instruction parameters
- **Highlight:** Current instruction (orange)

---

## 🔍 Troubleshooting

### "Database not initialized"

**Wait a few seconds** for the WASM module to load.
Status should change from "Initializing..." to "Ready"

### No events appearing

1. **Check debug mode:** `app.setDebugMode(true)`
2. **Check console:** Look for errors
3. **Try simple SQL:** Start with `SELECT 1;`
4. **Clear event log** and try again

### Visualization not updating

1. **Check view mode:** Make sure correct mode is selected
2. **Switch modes:** Change to another mode and back
3. **Refresh page:** Sometimes helps

### Slow performance

1. **Reduce animation speed:** Set to 2.0x
2. **Disable transitions:** Uncheck "Show Transitions"
3. **Clear event log:** Click "Clear Log"
4. **Use simpler SQL:** Break complex queries into parts

---

## 📚 Example SQL Statements

### Basic Operations

```sql
-- Select
SELECT 1;

-- Create table
CREATE TABLE test (id INTEGER, name TEXT);

-- Insert
INSERT INTO test VALUES (1, 'Alice');

-- Query
SELECT * FROM test;
```

### Advanced Operations

```sql
-- Create with multiple columns
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT,
    age INTEGER,
    email TEXT
);

-- Multiple inserts
INSERT INTO users VALUES (1, 'Bob', 25, 'bob@example.com');
INSERT INTO users VALUES (2, 'Carol', 30, 'carol@example.com');

-- Query with WHERE
SELECT * FROM users WHERE age > 25;

-- Update
UPDATE users SET age = 26 WHERE id = 1;

-- Delete
DELETE FROM users WHERE id = 2;
```

### Complex Queries

```sql
-- Join
SELECT u.name, o.order_id
FROM users u
JOIN orders o ON u.id = o.user_id;

-- Aggregate
SELECT age, COUNT(*)
FROM users
GROUP BY age;

-- Subquery
SELECT * FROM users
WHERE id IN (SELECT user_id FROM orders WHERE total > 100);
```

---

## 🎓 Learning Path

### Beginner (Start Here)

1. **Execute:** `SELECT 1;`
2. **Watch:** Event log populate
3. **Switch:** To VDBE view mode
4. **See:** Bytecode program

### Intermediate

1. **Create:** A table with columns
2. **Insert:** Multiple rows
3. **Query:** With WHERE clause
4. **Compare:** Parse tree vs VDBE

### Advanced

1. **Create:** Multiple related tables
2. **Insert:** Many rows
3. **Query:** With JOINs and aggregations
4. **Analyze:** VDBE execution plan

---

## 🔧 Advanced Features

### Step Mode (When Available)

Some versions support stepping through SQL:
1. Write SQL in editor
2. Click "Step Through" button
3. Watch execution step-by-step

### Event Filtering

The event log shows all events, but you can filter by type:
- **Parse events** (blue)
- **VDBE events** (purple)
- **B-tree events** (green)

### Export Events

Want to save events? Open browser console:
```javascript
// Copy all events to clipboard
copy(JSON.stringify(eventManager.events, null, 2))
```

---

## 📊 Event Reference

### Parse Events

| Event | Description |
|-------|-------------|
| PARSE_START | Parsing begins |
| PARSE_TOKEN | Token recognized |
| PARSE_COMPLETE | Parsing finished |

### VDBE Events

| Event | Description |
|-------|-------------|
| VDBE_START | Program starts |
| VDBE_OPCODE | Instruction executes |
| VDBE_COMPLETE | Program finishes |

### B-Tree Events

| Event | Description |
|-------|-------------|
| BTREE_OPEN | Database opened |
| BTREE_INSERT | Data inserted |
| BTREE_DELETE | Data deleted |
| BTREE_SPLIT | Page split |
| PAGE_ALLOCATE | Page created |
| PAGE_FREE | Page deleted |

---

## 💡 Pro Tips

1. **Start Simple** - Begin with `SELECT 1;` to learn the interface
2. **Use Debug Mode** - See everything that happens
3. **Experiment** - Try different SQL statements
4. **Switch Views** - Each view shows different aspects
5. **Read Event Log** - Shows the execution timeline
6. **Hover Nodes** - See additional information
7. **Adjust Speed** - Find animation speed that works for you
8. **Clear Often** - Keep event log manageable

---

## 🆘 Getting Help

### Console Errors

Open browser console (F12) and look for red errors. These usually indicate:
- WASM loading failed
- SQL syntax error
- JavaScript error

### SQL Errors

If SQL has errors:
1. Check syntax carefully
2. Look for error message in output box
3. Try simpler SQL first
4. Check event log for clues

### Visualization Issues

If visualization doesn't appear:
1. Check view mode is correct
2. Switch to another mode and back
3. Refresh the page
4. Check browser console for errors

---

## 🎉 Next Steps

Now that you know the basics:

1. **Try the test scenarios** - See `TEST_SQL_SCENARIOS.md`
2. **Read the full docs** - See `README.md` and `EVENT_SYSTEM.md`
3. **Experiment** - Try complex SQL and see what happens
4. **Learn** - Understand SQLite internals through visualization

---

## 📖 Additional Documentation

- **README.md** - Project overview and setup
- **EVENT_SYSTEM.md** - Complete event reference
- **DEBUG_MODE_GUIDE.md** - Debug mode usage
- **TEST_PLAN_AFTER_BUILD.md** - Comprehensive test suite
- **TEST_SQL_SCENARIOS.md** - 25 test scenarios

---

**Happy Visualizing! 🎨**

Remember: This tool shows you **exactly what SQLite does** internally. Every event is real. Every visualization is accurate. It's like having X-ray vision into the database engine!

**Questions?** Check the documentation or open an issue on GitHub.
