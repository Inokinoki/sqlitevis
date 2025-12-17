# Quick Start Guide

Get SQLiteVis up and running in 5 minutes!

## Prerequisites

- **Emscripten SDK**: Required for compiling C to WebAssembly
  ```bash
  # Install Emscripten
  git clone https://github.com/emscripten-core/emsdk.git
  cd emsdk
  ./emsdk install latest
  ./emsdk activate latest
  source ./emsdk_env.sh
  ```

- **Python 3**: For the development server (usually pre-installed)
- **Make**: Build automation (usually pre-installed on Linux/Mac)
- **curl/wget**: For downloading SQLite source

## Installation

### 1. Clone and Setup

```bash
cd sqlitevis
make setup
```

### 2. Download SQLite

```bash
make download-sqlite
```

This downloads SQLite 3.45.0 amalgamation source.

### 3. Try Mock Mode (No WASM needed)

You can test the visualization interface immediately:

```bash
make serve
# Open http://localhost:8000 in your browser
```

The app will run in "mock mode" without actual SQLite, but you can see the visualization working!

### 4. Build Full Version with WASM

To get the full SQLite WASM experience:

```bash
# Apply instrumentation (currently manual - see INSTRUMENTATION.md)
make instrument

# Compile to WebAssembly
make build-wasm

# Run the server
make serve
```

Visit `http://localhost:8000` and start visualizing!

## Usage

### Basic Example

1. Open the app in your browser
2. The SQL editor is pre-filled with example SQL:
   ```sql
   CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER);
   INSERT INTO users VALUES (1, 'Alice', 30);
   INSERT INTO users VALUES (2, 'Bob', 25);
   SELECT * FROM users;
   ```

3. Click **Execute SQL**
4. Watch the B-tree visualization update in real-time!

### Features to Try

- **Event Log**: See every internal operation SQLite performs
- **B-Tree View**: Watch pages split as you insert data
- **Transitions**: Enable/disable animations
- **Speed Control**: Slow down or speed up animations
- **Node Inspection**: Click on nodes to see details

### Example Queries to Visualize

#### See Page Splits

```sql
CREATE TABLE numbers (id INTEGER PRIMARY KEY, value INTEGER);
INSERT INTO numbers SELECT NULL, random() FROM (
  WITH RECURSIVE cnt(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM cnt WHERE x<100)
  SELECT x FROM cnt
);
```

#### Observe Indexing

```sql
CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price REAL);
CREATE INDEX idx_price ON products(price);
INSERT INTO products VALUES (1, 'Widget', 9.99);
INSERT INTO products VALUES (2, 'Gadget', 19.99);
```

#### Query Execution

```sql
SELECT * FROM products WHERE price > 10;
```

Watch the VDBE (Virtual Database Engine) execute each opcode!

## Troubleshooting

### "SQLite WASM not found, using mock mode"

This is normal if you haven't built the WASM module yet. The app works in mock mode for testing the UI.

To get full functionality:
1. Install Emscripten
2. Run `make build-wasm`
3. Refresh the browser

### Build Errors

**Error**: `emcc: command not found`

**Solution**: Install and activate Emscripten SDK:
```bash
source /path/to/emsdk/emsdk_env.sh
```

**Error**: `sqlite3.c: No such file or directory`

**Solution**: Download SQLite first:
```bash
make download-sqlite
```

### Can't See Visualization

1. Check browser console for errors (F12)
2. Verify the canvas element is visible
3. Try a simple query like `CREATE TABLE test (id INTEGER);`

## Next Steps

- Read [INSTRUMENTATION.md](docs/INSTRUMENTATION.md) to understand how events work
- Customize the visualization in `src/web/js/visualizer.js`
- Add more event types in `src/wasm/sqlite_bridge.c`
- Contribute improvements!

## Development

### Project Structure

```
sqlitevis/
├── src/
│   ├── web/           # Frontend HTML/CSS/JS
│   ├── wasm/          # C bridge code
│   └── instrumentation/  # SQLite patches
├── sqlite/
│   ├── original/      # Unmodified SQLite
│   └── instrumented/  # SQLite with hooks
├── build/            # Compiled WASM output
└── docs/             # Documentation
```

### Making Changes

1. **UI Changes**: Edit files in `src/web/`, refresh browser
2. **Visualization**: Modify `src/web/js/visualizer.js`
3. **Events**: Update `src/wasm/sqlite_bridge.c`, then `make build-wasm`
4. **SQLite Hooks**: Edit `sqlite/instrumented/*.c`, then `make build-wasm`

### Rebuilding

```bash
make clean      # Clean build files
make build-wasm # Rebuild WASM
make serve      # Start server
```

## Resources

- [SQLite Architecture](https://www.sqlite.org/arch.html)
- [SQLite File Format](https://www.sqlite.org/fileformat.html)
- [Emscripten Documentation](https://emscripten.org/docs/)
- [B-Tree Visualization Article](https://mrsuh.com/articles/2024/sqlite-index-visualization-structure/)

## Support

- GitHub Issues: Report bugs and request features
- Documentation: See `docs/` folder
- Examples: Check `examples/` (coming soon)

Happy visualizing! 🎉
