# Development Guide

This guide is for developers who want to contribute to or modify SQLiteVis.

## Architecture Overview

### Component Layers

```
┌─────────────────────────────────────────────────────┐
│              Browser (User Interface)               │
│                                                     │
│  ┌────────────┐  ┌────────────┐  ┌──────────────┐ │
│  │   HTML     │  │    CSS     │  │  JavaScript  │ │
│  │ index.html │  │ style.css  │  │  main.js     │ │
│  │            │  │            │  │  events.js   │ │
│  │            │  │            │  │visualizer.js │ │
│  └────────────┘  └────────────┘  └──────────────┘ │
└──────────────────────┬──────────────────────────────┘
                       │
                       │ WebAssembly Calls
                       │ Event Callbacks
                       ▼
┌─────────────────────────────────────────────────────┐
│            WebAssembly Module (WASM)                │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │         SQLite C Code (Instrumented)         │  │
│  │  • btree.c    - B-tree operations            │  │
│  │  • vdbe.c     - Virtual machine              │  │
│  │  • parse.y    - SQL parser                   │  │
│  │  • tokenize.c - Lexer                        │  │
│  └──────────────────────────────────────────────┘  │
│                       ▲                             │
│  ┌────────────────────┴──────────────────────────┐ │
│  │       sqlite_bridge.c (Event Emitters)       │ │
│  │  Converts C events → JavaScript callbacks    │ │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Key Files and Their Roles

### Frontend (src/web/)

#### `index.html`
- Main application UI
- Split-panel layout: SQL editor + visualization
- Event log display
- Control panels

#### `css/style.css`
- Modern, responsive design
- CSS custom properties for theming
- Canvas styling and layout
- Animation definitions

#### `js/main.js`
- Application initialization
- SQLite WASM module loading
- SQL execution controller
- UI event handlers
- Mock mode for testing

#### `js/events.js`
- Event manager singleton
- Event type definitions
- Event logging and filtering
- Listener pattern implementation
- Statistics tracking

#### `js/visualizer.js`
- Canvas-based rendering engine
- B-tree layout algorithm
- Node drawing and animations
- Mouse interaction handling
- Multiple view modes

### Backend (src/wasm/)

#### `sqlite_bridge.c`
- C-to-JavaScript bridge
- Event emission functions
- EM_JS macros for callbacks
- JSON formatting utilities

### Documentation (docs/)

- `INSTRUMENTATION.md` - How to add hooks to SQLite
- `DEVELOPMENT.md` - This file

## Development Workflow

### 1. Making Frontend Changes

For HTML/CSS/JS changes, no compilation is needed:

```bash
# Edit files in src/web/
vim src/web/js/visualizer.js

# Refresh browser to see changes
# (or use live-reload tools)
```

### 2. Modifying Event Handlers

When adding new event types:

1. **Add to bridge** (`src/wasm/sqlite_bridge.c`):
   ```c
   EMSCRIPTEN_KEEPALIVE
   void my_new_event(int param1, int param2) {
       emit_vis_event(EVENT_MY_NEW_TYPE,
           "{\"param1\":%d,\"param2\":%d}",
           param1, param2);
   }
   ```

2. **Update event manager** (`src/web/js/events.js`):
   ```javascript
   this.eventTypeNames = {
       // ... existing types ...
       14: 'MY_NEW_TYPE'
   };
   ```

3. **Add visualization** (`src/web/js/visualizer.js`):
   ```javascript
   eventManager.on(14, (e) => {
       // Handle the event
       console.log('New event:', e.data);
   });
   ```

4. **Rebuild WASM**:
   ```bash
   make build-wasm
   ```

### 3. Instrumenting SQLite

See [INSTRUMENTATION.md](INSTRUMENTATION.md) for details.

Quick workflow:

1. Edit `sqlite/instrumented/sqlite3.c`
2. Add event calls at key points
3. Rebuild: `make build-wasm`
4. Test in browser

### 4. Testing

#### Manual Testing

```bash
make serve
# Open http://localhost:8000
# Open browser DevTools (F12)
# Execute SQL and watch events
```

#### Mock Mode Testing

Without building WASM, you can test the UI:

```javascript
// In browser console
eventManager.handleEvent(6, '{"page":1,"type":1}');
eventManager.handleEvent(2, '{"page":1,"cell":0,"keyLen":16}');
```

## Code Style

### JavaScript

- Use ES6+ features
- Class-based architecture
- Descriptive variable names
- Comments for complex logic

```javascript
// Good
class BTreeVisualizer {
    /**
     * Draw a node with proper styling
     */
    drawNode(node) {
        // Implementation
    }
}

// Avoid
function dn(n) {
    // What does this do?
}
```

### C Code

- Follow SQLite style for instrumented files
- Use `#ifdef SQLITE_ENABLE_VISUALIZATION` for all hooks
- Minimize overhead in event emission

```c
// Good
#ifdef SQLITE_ENABLE_VISUALIZATION
if( rc==SQLITE_OK ){
    btree_insert_event(pPage->pgno, i, (const char*)pCell, sz);
}
#endif

// Avoid - always-on instrumentation
btree_insert_event(pPage->pgno, i, (const char*)pCell, sz);
```

## Adding New Visualization Modes

### 1. Parse Tree Visualization

To add SQL parse tree visualization:

1. **Instrument parser** (parse.y or parse.c):
   ```c
   parse_node_event("SELECT", parent_id, node_id);
   ```

2. **Create parser visualizer** (visualizer-parse.js):
   ```javascript
   class ParseTreeVisualizer {
       drawParseTree(rootNode) {
           // Tree layout and rendering
       }
   }
   ```

3. **Integrate with main app**:
   ```javascript
   if (viewMode === 'parse') {
       parseVisualizer.draw();
   }
   ```

### 2. VDBE Opcode Visualization

Show virtual machine execution:

1. **Instrument VDBE** (vdbe.c):
   ```c
   vdbe_opcode_event(pc, pOp->opcode, p1, p2, p3);
   ```

2. **Create opcode visualizer**:
   ```javascript
   class VDBEVisualizer {
       showOpcode(pc, opcode, operands) {
           // Display opcode execution
       }
   }
   ```

## Build System Details

### Makefile Targets

- `make setup` - Create directories
- `make download-sqlite` - Fetch SQLite source
- `make instrument` - Copy and patch SQLite
- `make build-wasm` - Compile to WebAssembly
- `make serve` - Start dev server
- `make clean` - Remove build files
- `make clean-all` - Remove everything including SQLite

### Emscripten Flags

Key compilation flags in Makefile:

```makefile
-s WASM=1                    # Enable WebAssembly
-s MODULARIZE=1              # Create module function
-s EXPORT_NAME='createSQLiteModule'  # Module name
-s ALLOW_MEMORY_GROWTH=1     # Dynamic memory
-s EXPORTED_FUNCTIONS='[...]' # SQLite API exports
```

## Debugging

### JavaScript Debugging

```javascript
// Enable verbose logging
window.DEBUG = true;

// Inspect state
console.log(sqliteApp.visualizer.nodes);
console.log(eventManager.events);

// Pause animations
sqliteApp.visualizer.animationSpeed = 0;
```

### WASM Debugging

Compile with debug symbols:

```bash
emcc -g4 -O0 ...  # Full debug info
```

Use browser DevTools to debug WASM:
- Chrome: Sources → wasm://
- Firefox: Debugger → WASM

### Common Issues

**Events not firing:**
- Check `SQLITE_ENABLE_VISUALIZATION` is defined
- Verify function is called (add console.log)
- Check `window.sqliteVisEventHandler` exists

**Visualization not updating:**
- Check event listeners are registered
- Verify `draw()` is called
- Check canvas size and visibility

**Build failures:**
- Ensure Emscripten is activated
- Check SQLite source is downloaded
- Verify all source files exist

## Performance Optimization

### Event Throttling

For high-frequency events:

```javascript
class EventManager {
    constructor() {
        this.throttle = 16; // Max 60 events/sec
        this.lastEmit = 0;
    }

    handleEvent(type, data) {
        const now = Date.now();
        if (now - this.lastEmit < this.throttle) {
            return; // Skip event
        }
        // Process event
        this.lastEmit = now;
    }
}
```

### Canvas Optimization

```javascript
// Use off-screen canvas for complex rendering
const offscreen = document.createElement('canvas');
const ctx = offscreen.getContext('2d');
// Draw to offscreen
// Copy to main canvas
mainCtx.drawImage(offscreen, 0, 0);
```

### WASM Optimization

Build with optimizations:

```bash
emcc -O3 -flto ...  # Maximum optimization + LTO
```

## Contributing

### Pull Request Process

1. Fork the repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Make changes and test
4. Commit with descriptive message
5. Push and create PR

### Commit Messages

Follow conventional commits:

```
feat: Add VDBE visualization mode
fix: Correct B-tree split animation
docs: Update instrumentation guide
perf: Optimize canvas rendering
```

## Resources

- [SQLite Source Code](https://sqlite.org/src)
- [Emscripten API Reference](https://emscripten.org/docs/api_reference/)
- [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [WebAssembly](https://webassembly.org/)

## Questions?

- Check existing issues on GitHub
- Read the documentation
- Ask in discussions

Happy coding! 🚀
