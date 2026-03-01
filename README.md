# SQLite Web

**Fast. Simple. Powerful.**

A lightweight, instant SQL interface that runs entirely in your browser. No server required.

## 🚀 Quick Start

```bash
# Install dependencies (optional - only for testing)
npm install

# Start the server
npm run serve

# Open in browser
# Visit: http://localhost:8000
```

That's it! The page loads instantly (<50ms) and you can start running SQL immediately.

## ✨ Features

### Instant SQL Engine
- **CREATE TABLE** - Define table structure
- **INSERT** - Add data to tables
- **SELECT** - Query data with WHERE, ORDER BY, LIMIT
- **UPDATE** - Modify existing data
- **DELETE** - Remove data
- **DROP TABLE** - Remove tables

### Power User Features
- **Query History** - Re-run previous queries instantly
- **Auto-Run Mode** - See results as you type
- **Keyboard Shortcuts** - Ctrl+Enter to run, Ctrl+K to clear, Ctrl+H for history
- **SQL Formatter** - Prettify your SQL queries
- **Export CSV** - Save query results
- **Schema Viewer** - Inspect database structure

### Performance
- **Load time**: <50ms (instant!)
- **Query execution**: <1ms
- **File size**: 11KB (ultra-lightweight)
- **Dependencies**: Zero (pure JavaScript)

## 💡 Usage Examples

### Basic Operations
```sql
CREATE TABLE users(id INTEGER PRIMARY KEY, name TEXT, age INTEGER);
INSERT INTO users VALUES(1, 'Alice', 30);
INSERT INTO users VALUES(2, 'Bob', 25);
SELECT * FROM users ORDER BY age DESC;
```

### Filtering & Sorting
```sql
SELECT * FROM users WHERE age > 25 ORDER BY name ASC;
SELECT * FROM users WHERE city = 'NYC' LIMIT 5;
```

### Data Modification
```sql
UPDATE users SET age = 31 WHERE name = 'Alice';
DELETE FROM users WHERE age < 25;
```

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Run SQL |
| `Ctrl+K` | Clear editor |
| `Ctrl+H` | Toggle history |
| `Ctrl+Space` | Format SQL |

## 🎯 Why SQLite Web?

### For Learning
- Practice SQL without installing anything
- Test queries instantly
- Learn SQL syntax with immediate feedback
- No server setup required

### For Development
- Quick data prototyping
- Ad-hoc data analysis
- CSV export for Excel/Sheets
- Schema inspection

### For Production
- Embed in documentation
- Demo SQL features
- Lightweight database viewer
- No backend required

## 📊 SQL Support Matrix

| Feature | Status |
|---------|--------|
| CREATE TABLE | ✅ Full support |
| INSERT VALUES | ✅ Full support |
| SELECT | ✅ WHERE, ORDER BY, LIMIT |
| UPDATE | ✅ With WHERE clause |
| DELETE | ✅ With WHERE clause |
| DROP TABLE | ✅ Full support |
| DISTINCT | ⚠️ Planned |
| JOIN | ⚠️ Planned |
| GROUP BY | ⚠️ Planned |
| Aggregate functions | ⚠️ Planned |

## 🛠️ Development

```bash
# Run tests
npm test

# Build WASM (optional - for full SQLite)
npm run build

# Clean build artifacts
npm run clean
```

## 📝 Technical Details

- **Pure JavaScript SQL engine** - No WebAssembly required for basic operations
- **In-memory database** - Fast, ephemeral storage
- **Event-driven architecture** - Responsive UI
- **Progressive enhancement** - Can add WASM for full SQLite support

## 🤝 Contributing

Contributions welcome! Please read our code of conduct and submit pull requests to the repository.

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- SQLite team for the amazing database
- Original B-tree visualization project that this evolved from
- All contributors and users of this tool

---

**Note**: This project evolved from a B-tree visualization tool. For the original visualization features, check the git history.
