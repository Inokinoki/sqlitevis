# Debug Mode Quick Reference

## Overview

The SQLite Visualization application now includes a debug mode feature that allows you to control the verbosity of console logging. This helps keep the console clean during normal operation while providing detailed debugging information when needed.

## How to Use

### Enable Debug Mode

Open your browser's developer console (F12) and type:

```javascript
app.setDebugMode(true)
```

You should see: `Debug mode: ENABLED`

### Disable Debug Mode

```javascript
app.setDebugMode(false)
```

You should see: `Debug mode: DISABLED`

## What Gets Logged

### With Debug Mode OFF (default)
- Only errors and important messages
- Clean console output
- Better performance

### With Debug Mode ON
All of the following events are logged:

**B-Tree Events:**
- `[BTREE_OPEN]` - Page size and number of pages
- `[BTREE_CLOSE]` - B-tree closed
- `[BTREE_INSERT]` - Page, cell, and key length
- `[BTREE_DELETE]` - Page and cell
- `[BTREE_SPLIT]` - Original page, new page, split cell
- `[BTREE_BALANCE]` - Page and cell count
- `[PAGE_ALLOCATE]` - Page number and type
- `[PAGE_FREE]` - Page number

**Parse Events:**
- `[PARSE_START]` - SQL string being parsed
- `[PARSE_TOKEN]` - Token and type
- `[PARSE_COMPLETE]` - Success status

**VDBE Events:**
- `[VDBE_START]` - Number of opcodes
- `[VDBE_OPCODE]` - Program counter, opcode name, P1, P2, P3
- `[VDBE_COMPLETE]` - Result code

**Initialization:**
- SQLite WASM module loaded
- Database initialized
- Event handlers registered
- SQL executed

## Example Usage

```javascript
// 1. Load the application
// 2. Enable debug mode
app.setDebugMode(true);

// 3. Execute some SQL
CREATE TABLE test (id INTEGER, name TEXT);

// 4. Watch the console for detailed event logs
// 5. Disable when done
app.setDebugMode(false);
```

## Performance Impact

- **Debug OFF:** Minimal overhead (just a boolean check)
- **Debug ON:** Same overhead as before (string formatting + console I/O)

## Memory Management

The visualizer now includes proper cleanup:

```javascript
// If you need to destroy the visualizer (rarely needed)
visualizer.destroy();
```

This disconnects the ResizeObserver and prevents memory leaks.

## Tips

1. **Keep debug mode off** for normal use to keep console clean
2. **Turn on debug mode** when investigating issues
3. **Use browser filters** to search for specific event types
4. **Check the Event Log panel** in the UI for formatted output

## Troubleshooting

**Q: Debug mode not working?**
A: Make sure the app is fully loaded before calling `app.setDebugMode(true)`

**Q: Too many logs?**
A: Use browser console filters (e.g., `console.log(..., args)` to filter)

**Q: Want to see errors only?**
A: Keep debug mode OFF, errors always show
