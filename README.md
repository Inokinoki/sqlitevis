# SQLiteVis

Interactive SQLite B-Tree visualization powered by WebAssembly. Watch how SQLite stores data, parses SQL, and executes VDBE opcodes — all in real-time in your browser.

## What It Does

SQLiteVis instruments the SQLite source code with visualization hooks, compiles it to WebAssembly via Emscripten, and renders B-Tree page structures, SQL parse trees, and VDBE execution traces on an HTML5 Canvas.

**Three visualization modes:**

| Mode | Shows |
|------|-------|
| **B-Tree** | Page allocation, cell insert/delete, page splits, balancing |
| **Parse Tree** | SQL tokenization — keywords, identifiers, strings, numbers |
| **VDBE** | Virtual Database Engine opcode execution step-by-step |

**14 event types** are captured from the instrumented SQLite engine:

- B-Tree: OPEN, CLOSE, INSERT, DELETE, SPLIT, BALANCE
- Page: ALLOCATE, FREE
- Parser: START, TOKEN, COMPLETE
- VDBE: START, OPCODE, COMPLETE

## Quick Start

### Option A: Pre-built (fastest)

```bash
python3 -m http.server 8000
# Open http://localhost:8000/src/web/index.html
```

The `src/web/build/` directory contains a pre-built WASM module that works out of the box.

### Option B: Build from source

Prerequisites: [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html), Python 3, Make

```bash
make setup
make download-sqlite
make instrument
make build-wasm
make serve
```

## Usage

1. Open the app in your browser
2. Write SQL in the editor (pre-filled with examples)
3. Click **Execute SQL** or press **Ctrl+Enter**
4. Watch events appear in the log and visualizations update

Example SQL:
```sql
CREATE TABLE users(id INTEGER PRIMARY KEY, name TEXT, email TEXT);
INSERT INTO users VALUES(1, 'Alice', 'alice@example.com');
INSERT INTO users VALUES(2, 'Bob', 'bob@example.com');
INSERT INTO users VALUES(3, 'Charlie', 'charlie@example.com');
SELECT * FROM users;
```

## Project Structure

```
sqlitevis/
├── src/
│   ├── web/                    # Frontend
│   │   ├── index.html          # Main HTML (loads modular JS + WASM)
│   │   ├── css/style.css       # Styles
│   │   ├── js/
│   │   │   ├── main.js         # App controller, WASM init, SQL execution
│   │   │   ├── events.js       # Event manager (C bridge → JS)
│   │   │   ├── visualizer.js   # Canvas renderer (B-Tree, Parse, VDBE)
│   │   │   └── performance-monitor.js
│   │   └── build/              # Pre-built WASM module
│   │       ├── sqlite3.js
│   │       └── sqlite3.wasm
│   ├── wasm/
│   │   └── sqlite_bridge.c     # C event hooks (EMSCRIPTEN_KEEPALIVE)
│   └── instrumentation/        # (empty — patches applied by script)
├── sqlite/original/            # Unmodified SQLite amalgamation
├── scripts/
│   ├── instrument_sqlite.py    # Patches SQLite source with hooks
│   └── setup.sh
├── patches/                    # Instrumentation patches
├── tests/                      # Playwright E2E tests
├── Makefile                    # Build system
└── .github/workflows/deploy.yml  # CI → GitHub Pages
```

## Architecture

```
SQL Input → sqlite3_exec() (WASM)
              ↓
         Instrumented SQLite C code
              ↓
     sqlite_bridge.c event hooks
     (btree_insert_event, parse_token_event, vdbe_opcode_event, ...)
              ↓
     window.sqliteVisEventHandler()  (C → JS boundary)
              ↓
     events.js (EventManager)
              ↓
     visualizer.js (Canvas rendering)
```

## Development

```bash
# Web-only development (no rebuild needed)
python3 -m http.server 8000

# After modifying C bridge or instrumentation
make build-wasm

# Run tests
npm install
npx playwright install chromium
npm test
```

## Testing

End-to-end tests use [Playwright](https://playwright.dev/):

```bash
npm test           # Headless
npm run test:headed  # With browser visible
```

## Deployment

Pushes to `main` automatically deploy to GitHub Pages via `.github/workflows/deploy.yml`. The CI pipeline:

1. Sets up Emscripten
2. Downloads and instruments SQLite source
3. Builds WASM module
4. Deploys `src/web/` to GitHub Pages

## License

MIT
