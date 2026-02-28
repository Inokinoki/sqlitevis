# Quick Performance Testing Guide

## How to Test the Performance Improvements

### Step 1: Serve the Application

```bash
# From the project root
cd src/web
python3 -m http.server 8000
```

### Step 2: Open in Browser

Navigate to: `http://localhost:8000`

You should see the **Performance Monitor** in the top-right corner showing:
- Current FPS
- Average FPS
- Frame render time
- Events per second
- Memory usage (if available)

### Step 3: Run Performance Tests

#### Test 1: Light Load (Baseline)
```sql
CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT);
INSERT INTO test VALUES (1, 'Alice');
INSERT INTO test VALUES (2, 'Bob');
SELECT * FROM test;
```

**Expected Result**: 60 FPS, green color coding

#### Test 2: Medium Load
```sql
CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER);
INSERT INTO users VALUES (1, 'Alice', 30);
INSERT INTO users VALUES (2, 'Bob', 25);
INSERT INTO users VALUES (3, 'Charlie', 35);
-- Repeat INSERT 20 more times
SELECT * FROM users;
```

**Expected Result**: 55-60 FPS, still green

#### Test 3: Heavy Load (Stress Test)
```sql
-- Create a larger table
CREATE TABLE large_table (id INTEGER PRIMARY KEY, data TEXT);

-- Insert many rows (you can copy-paste this multiple times)
INSERT INTO large_table VALUES (1, 'Data row 1');
INSERT INTO large_table VALUES (2, 'Data row 2');
INSERT INTO large_table VALUES (3, 'Data row 3');
-- ... continue to 50+ rows

SELECT * FROM large_table;
```

**Expected Result**: 30-60 FPS, may show yellow but should remain responsive

### Step 4: Check the Performance Monitor

The monitor shows:
- **FPS**: Frames per second (green = good, yellow = OK, red = bad)
- **Render**: Frame time in milliseconds (lower is better)
- **Events**: Number of events processed per second
- **Memory**: Heap memory usage (if browser supports it)
- **Peak**: Highest render time recorded

### Step 5: Verify Different View Modes

1. **B-Tree View** (default): Should show smooth animations
2. **Parse Tree View**: Switch and execute SQL - should parse and display quickly
3. **VDBE View**: Execute SQL and watch opcode execution - should scroll smoothly

### What to Look For

✅ **Good Performance**:
- FPS consistently 55-60
- Render time < 20ms (green)
- No lag when clicking buttons
- Smooth animations

⚠️ **Acceptable Performance**:
- FPS 30-55
- Render time 20-35ms (yellow)
- Minor lag but still usable

❌ **Poor Performance** (needs more work):
- FPS < 30
- Render time > 35ms (red)
- Noticeable lag/stuttering
- UI freezes

### Keyboard Shortcuts & Console Commands

Open browser console (F12) for additional commands:

```javascript
// Get performance report
perfMonitor.getReport()

// Log performance summary
perfMonitor.logSummary()

// Toggle debug mode on visualizer
window.sqliteApp.setDebugMode(true)

// Manually trigger redraw
window.sqliteApp.visualizer.draw()
```

### Browser DevTools Performance Profiling

1. Open Chrome DevTools (F12)
2. Go to **Performance** tab
3. Click **Record**
4. Execute some SQL queries
5. Click **Stop**
6. Look for:
   - Consistent 16ms frames (60 FPS)
   - No long tasks (> 50ms)
   - Minimal layout thrashing

### Known Issues

- The initial SQLite WASM load may take 2-3 seconds (this is expected)
- First few SQL executions may be slower as JIT compiler warms up
- Very complex queries (100+ operations) may temporarily reduce FPS

---

**Expected Results Summary**:
| Load Level | Expected FPS | Expected Frame Time |
|------------|--------------|---------------------|
| Light (5-10 pages) | 60 | < 10ms |
| Medium (20-50 pages) | 55-60 | < 20ms |
| Heavy (100+ pages) | 30-60 | < 35ms |

The application should feel **smooth and responsive** even under heavy load!
