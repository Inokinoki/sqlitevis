# 🚀 Quick Start Guide

## Build & Run

```bash
# 1. Build WASM (one-time setup)
make build-wasm

# 2. Start server
make serve

# 3. Open browser
open http://localhost:8000/src/web/index.html
```

## Test Events

```bash
# Manual testing
open http://localhost:8000/test_events.html

# Automated testing
npm install
npm run install:playwright
npm test
```

## Try It Out

**In the SQL editor, run:**

```sql
-- 1. Create a table (watch for PAGE_ALLOCATE event)
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT,
  age INTEGER
);

-- 2. Insert data (watch for BTREE_INSERT events)
INSERT INTO users VALUES (1, 'Alice', 30);
INSERT INTO users VALUES (2, 'Bob', 25);

-- 3. Query data (watch for VDBE events)
SELECT * FROM users;

-- 4. Delete data (watch for BTREE_DELETE event)
DELETE FROM users WHERE id = 1;
```

**What you'll see:**
- ✅ Event log showing all operations
- ✅ B-tree visualization on canvas
- ✅ Page count updates
- ✅ Real-time event streaming

## Event Categories

**Blue events** - B-tree operations:
- Page allocation/deallocation
- Cell insertion/deletion
- Page splits and balancing

**Orange events** - SQL parsing:
- Parse start/complete
- Token recognition

**Yellow events** - VDBE execution:
- Program start/complete
- Opcode execution

## Controls

- **Execute SQL** - Run the SQL statement
- **Step Through** - Coming soon
- **Clear** - Clear SQL editor
- **Clear Events** - Reset event log
- **View Mode** - Switch between B-tree/Parse/VDBE views
- **Show Transitions** - Toggle animations
- **Speed** - Adjust animation speed (0.1x - 2.0x)
- **Auto-scroll** - Toggle event log auto-scroll

## Files

| File | Purpose |
|------|---------|
| `EVENT_SYSTEM.md` | Complete event documentation |
| `COMPLETION_SUMMARY.md` | Project completion summary |
| `tests/README.md` | Testing documentation |
| `test_events.html` | Manual event testing |

## Architecture

```
SQL Input
  → SQLite WASM (instrumented)
  → Event Hooks
  → JavaScript Bridge
  → Event Manager
  → Visualizer
```

## Status

✅ **All 13 events implemented**
✅ **Real SQLite execution**
✅ **No fake/mock code**
✅ **Full visualization**
✅ **Comprehensive tests**

---

**Enjoy exploring SQLite internals! 🎉**
