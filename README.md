# SQLite B-Tree Visualization

An interactive web-based visualization tool that compiles SQLite to WebAssembly with custom instrumentation to visualize internal operations including B-tree structures, transitions, and SQL parsing.

## Features

- **B-Tree Visualization**: Real-time visualization of SQLite's B-tree data structures
- **Operation Transitions**: Animated transitions showing how operations modify the tree
- **SQL Parsing**: Visual representation of SQL query parsing
- **WebAssembly-based**: SQLite compiled to WASM runs entirely in the browser
- **Event-driven Architecture**: Custom hooks emit events for every internal operation

## Architecture

```
┌─────────────────────────────────────────────┐
│           Web Interface (Browser)           │
│  ┌─────────────┐      ┌──────────────────┐ │
│  │ SQL Editor  │      │  Visualization   │ │
│  └─────────────┘      │     Canvas       │ │
│         │             └──────────────────┘ │
│         ▼                      ▲           │
│  ┌─────────────────────────────┴─────────┐ │
│  │      Event Listener & Router          │ │
│  └─────────────────────────────┬─────────┘ │
└────────────────────────────────┼───────────┘
                                 │
                          ┌──────▼──────┐
                          │   Events    │
                          └──────▲──────┘
                                 │
┌────────────────────────────────┴───────────┐
│         SQLite WASM Module                 │
│  ┌──────────────────────────────────────┐  │
│  │  Instrumented SQLite C Code          │  │
│  │  • btree.c - B-tree operations       │  │
│  │  • vdbe.c - Virtual machine          │  │
│  │  • parse.y - SQL parser              │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

## Project Structure

```
sqlitevis/
├── sqlite/                 # SQLite source with instrumentation
│   ├── original/          # Unmodified SQLite amalgamation
│   └── instrumented/      # Modified SQLite with event hooks
├── src/
│   ├── wasm/              # WASM build configuration
│   ├── web/               # Web interface
│   │   ├── index.html
│   │   ├── js/
│   │   │   ├── main.js
│   │   │   ├── visualizer.js
│   │   │   └── events.js
│   │   └── css/
│   │       └── style.css
│   └── instrumentation/   # C code for SQLite hooks
├── build/                 # Build output
├── scripts/               # Build and setup scripts
└── docs/                  # Documentation
```

## Getting Started

### Prerequisites

- Emscripten SDK (for compiling C to WebAssembly)
- Node.js (for development server)
- Make

### Build Instructions

1. **Download SQLite source**:
   ```bash
   make download-sqlite
   ```

2. **Apply instrumentation**:
   ```bash
   make instrument
   ```

3. **Compile to WebAssembly**:
   ```bash
   make build-wasm
   ```

4. **Run development server**:
   ```bash
   make serve
   ```

Visit `http://localhost:8000` to see the visualization.

## Event Types

The instrumented SQLite emits the following event types:

### B-Tree Events
- `btree_open` - B-tree opened
- `btree_close` - B-tree closed
- `btree_insert` - Key/value inserted
- `btree_delete` - Key deleted
- `btree_split` - Page split occurred
- `btree_balance` - B-tree rebalanced
- `page_allocate` - New page allocated
- `page_free` - Page freed

### SQL Parsing Events
- `parse_start` - Parsing begins
- `parse_token` - Token identified
- `parse_rule` - Grammar rule applied
- `parse_complete` - Parsing complete

### Execution Events
- `vdbe_start` - Virtual machine starts
- `vdbe_opcode` - Opcode executed
- `vdbe_complete` - Execution complete

## References

- [SQLite Internals](https://www.sqlite.org/arch.html)
- [SQLite B-Tree Structure](https://mrsuh.com/articles/2024/sqlite-index-visualization-structure/)
- [Emscripten Documentation](https://emscripten.org/docs/)

## License

MIT License - See LICENSE file for details
