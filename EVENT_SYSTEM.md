# SQLite B-Tree Visualization - Event System Documentation

## Overview

This document describes the complete event injection and visualization system implemented for the SQLite B-Tree Visualization project. All fake execution has been removed and replaced with real SQLite WebAssembly execution with comprehensive event instrumentation.

## Event Types (13 Total)

The system implements 13 different event types across three categories:

### B-Tree Events (8 events)
1. **BTREE_OPEN** (0) - Emitted when a B-tree is opened
   - Data: `{pageSize: number, numPages: number}`

2. **BTREE_CLOSE** (1) - Emitted when a B-tree is closed
   - Data: `{}`

3. **BTREE_INSERT** (2) - Emitted when a cell is inserted into a B-tree page
   - Data: `{page: number, cell: number, keyLen: number}`

4. **BTREE_DELETE** (3) - Emitted when a cell is deleted from a B-tree page
   - Data: `{page: number, cell: number}`

5. **BTREE_SPLIT** (4) - Emitted when a page splits
   - Data: `{originalPage: number, newPage: number, splitCell: number}`

6. **BTREE_BALANCE** (5) - Emitted when B-tree is rebalanced
   - Data: `{page: number, numCells: number}`

7. **PAGE_ALLOCATE** (6) - Emitted when a new page is allocated
   - Data: `{page: number, type: number}`

8. **PAGE_FREE** (7) - Emitted when a page is freed
   - Data: `{page: number}`

### Parser Events (3 events)
9. **PARSE_START** (8) - Emitted when SQL parsing begins
   - Data: `{sql: string}`

10. **PARSE_TOKEN** (9) - Emitted for each token recognized
    - Data: `{token: string, type: number}`

11. **PARSE_COMPLETE** (10) - Emitted when parsing completes
    - Data: `{success: number}`

### VDBE Events (3 events)
12. **VDBE_START** (11) - Emitted when VDBE execution starts
    - Data: `{numOpcodes: number}`

13. **VDBE_OPCODE** (12) - Emitted for each opcode executed
    - Data: `{pc: number, opcode: string, p1: number, p2: number, p3: number}`

14. **VDBE_COMPLETE** (13) - Emitted when VDBE execution completes
    - Data: `{resultCode: number}`

## Implementation

### 1. SQLite Instrumentation

Location: `sqlite/instrumented/sqlite3.c`

The SQLite source code has been instrumented with event hooks at strategic locations:

- **Parse events**: Added to `sqlite3RunParser` function
- **B-tree events**: Added to page allocation and cell manipulation functions
- **VDBE events**: Added to `sqlite3VdbeExec` function

Example instrumentation:
```c
#ifdef EMSCRIPTEN
  if( zSql ) parse_start_event(zSql);
#endif
```

### 2. C Bridge Layer

Location: `src/wasm/sqlite_bridge.c`

This file provides the bridge between SQLite and JavaScript:

- Defines all event hook functions
- Implements JSON serialization for event data
- Provides JavaScript callback mechanism via `EM_JS`
- Emits events using `emit_vis_event()`

Key function:
```c
void emit_vis_event(EventType type, const char* format, ...) {
    char buffer[1024];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    js_emit_event(type, buffer);
}
```

### 3. JavaScript Event Manager

Location: `src/web/js/events.js`

The EventManager class:

- Receives events from WASM via `window.sqliteVisEventHandler`
- Parses JSON event data
- Logs events to the UI with timestamps
- Maintains event statistics
- Provides event filtering by type/category

Key features:
- Real-time event logging with auto-scroll
- Event type categorization (btree, parse, vdbe)
- Configurable log size limit (1000 events)
- Event listener registration system

### 4. Main Application

Location: `src/web/js/main.js`

Changes made:

**Removed:**
- All mock execution code (`useMockMode()`, `executeMockSQL()`, `simulateEvents()`)
- Fallback to fake execution when WASM not available

**Added:**
- Proper event handler registration before WASM initialization
- Direct SQLite execution via `sqlite3_exec`
- Real-time event emission from instrumented SQLite

Key initialization code:
```javascript
window.sqliteVisEventHandler = (eventType, eventData) => {
    eventManager.handleEvent(eventType, eventData);
};
```

### 5. HTML Updates

Location: `src/web/index.html`

- Updated WASM module path to `../../build/sqlite3.js`
- All scripts load in correct order
- Loading overlay shows during WASM initialization

## Build Process

### 1. Download SQLite Source
```bash
make download-sqlite
```
Downloads SQLite 3.45.0 amalgamation source.

### 2. Apply Instrumentation
```bash
make instrument
```
Runs Python scripts to inject event hooks into SQLite source:
- `scripts/instrument_sqlite.py` - Base instrumentation
- `scripts/add_manual_instrumentation.py` - Additional hooks

### 3. Build WebAssembly
```bash
make build-wasm
```
Compiles instrumented SQLite + bridge code to WASM using Emscripten.

Output files:
- `build/sqlite3.wasm` (1.1 MB)
- `build/sqlite3.js` (69 KB)

### 4. Serve Application
```bash
make serve
# or
npm run serve
```
Starts HTTP server on http://localhost:8000

## Visualization Features

### Event Log
- Real-time display of all events
- Color-coded by category (blue=btree, orange=parse, yellow=vdbe)
- Timestamps with millisecond precision
- Auto-scroll to latest events
- Event counter in footer

### B-Tree Visualization
- Canvas-based rendering
- Interactive nodes (hover for details)
- Animated operations (insert, delete, split)
- Configurable animation speed
- Multiple view modes

### Controls
- **View Mode**: Switch between B-Tree, Parse Tree, VDBE views
- **Show Transitions**: Toggle animation effects
- **Animation Speed**: Adjust playback speed (0.1x - 2.0x)
- **Auto-scroll**: Toggle event log auto-scroll
- **Clear Events**: Reset event log

## Testing

### Manual Testing

A test page is provided at `test_events.html`:
- Tests all 13 event types
- Verifies event handler registration
- Shows real-time event log
- Provides SQL execution test buttons

### Automated Testing

Playwright test suite in `tests/events.spec.js`:
- 20+ end-to-end tests
- Tests all event types
- Validates UI functionality
- Checks error handling
- Runs on Chromium, Firefox, WebKit

Run tests:
```bash
npm test              # Run all tests
npm run test:headed   # See browser
npm run test:debug    # Debug mode
npm run test:ui       # Interactive UI
```

## Event Flow Example

When executing `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);`:

1. **PARSE_START** - SQL string received
2. **PARSE_TOKEN** - "CREATE" token
3. **PARSE_TOKEN** - "TABLE" token
4. **PARSE_TOKEN** - "users" token
5. ... (more tokens)
6. **PARSE_COMPLETE** - Parsing successful
7. **PAGE_ALLOCATE** - Page 1 allocated for table
8. **BTREE_INSERT** - Root page created
9. **VDBE_START** - VDBE program starts
10. **VDBE_OPCODE** - Multiple opcodes execute
11. **VDBE_COMPLETE** - Execution complete

All events are:
- Logged to the event log panel
- Passed to the visualizer for canvas rendering
- Stored in memory for filtering/statistics

## Architecture

```
User Input (SQL)
    ↓
[main.js] executeRealSQL()
    ↓
[sqlite3.wasm] sqlite3_exec()
    ↓
[sqlite3.c] Instrumented functions execute
    ↓
[sqlite_bridge.c] emit_vis_event()
    ↓
[events.js] window.sqliteVisEventHandler
    ↓
    ├─→ Event Log UI
    ├─→ Event Statistics
    └─→ [visualizer.js] Canvas Rendering
```

## Status Summary

✅ **Completed:**
- SQLite WASM module built and instrumented
- All 13 event types implemented
- Fake execution completely removed
- Real SQLite execution connected
- Event visualization working
- Comprehensive test suite (Playwright)
- Full documentation

✅ **Event Injection:**
- Parse events: ✅ Instrumentation applied
- B-tree events: ✅ Instrumentation applied
- VDBE events: ✅ Instrumentation applied

✅ **Visualization:**
- Event logging: ✅ Real-time with timestamps
- B-tree canvas: ✅ Interactive rendering
- Event statistics: ✅ Live updates
- Multiple views: ✅ B-tree/Parse/VDBE modes

## Future Enhancements

Potential improvements:
1. More detailed B-tree structure visualization
2. Step-through execution mode
3. Export visualization as image/PDF
4. VDBE opcode detailed view
5. Parse tree syntax diagram
6. Performance profiling dashboard
7. Event filtering and search
8. Multiple database connection support

## Files Modified

1. `sqlite/instrumented/sqlite3.c` - Instrumented SQLite source
2. `src/wasm/sqlite_bridge.c` - Event bridge (already existed)
3. `src/web/js/main.js` - Removed fake execution, connected real WASM
4. `src/web/js/events.js` - Event manager (already existed)
5. `src/web/index.html` - Updated WASM path
6. `package.json` - Added test scripts
7. `Makefile` - Build system (already existed)

## Files Created

1. `scripts/add_manual_instrumentation.py` - Additional instrumentation
2. `test_events.html` - Manual testing page
3. `tests/events.spec.js` - Playwright test suite
4. `tests/README.md` - Test documentation
5. `playwright.config.js` - Playwright configuration
6. `EVENT_SYSTEM.md` - This document

## Verification

To verify the event system is working:

1. Start the server: `make serve`
2. Open http://localhost:8000/src/web/index.html
3. Wait for "Ready" status
4. Execute SQL: `CREATE TABLE test (id INTEGER PRIMARY KEY);`
5. Observe events in the event log
6. Check visualization canvas for updates

All events should appear in real-time as SQLite executes the SQL.
