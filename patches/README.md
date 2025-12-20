# SQLite Instrumentation Patches

This directory contains modular patches for instrumenting SQLite with visualization event hooks.

## 📂 Patch Files

### B-Tree Operations

#### `btree-page-ops.patch`
**Component**: B-Tree Page Management
**Operations**: Allocation, Deallocation
**Functions Instrumented**:
- `allocateBtreePage()` - Page allocation
- `freePage()` - Page deallocation

**Events Emitted**:
- `page_allocate_event(page_num, page_type)`
- `page_free_event(page_num)`

---

#### `btree-cell-ops.patch`
**Component**: B-Tree Cell Management
**Operations**: Insert, Delete
**Functions Instrumented**:
- `insertCell()` - Cell insertion
- `dropCell()` - Cell deletion

**Events Emitted**:
- `btree_insert_event(page_num, cell_idx, key, key_len)`
- `btree_delete_event(page_num, cell_idx)`

---

#### `btree-balance-ops.patch`
**Component**: B-Tree Balancing
**Operations**: Split, Balance
**Functions Instrumented**:
- `balance_nonroot()` - Page balancing
- `balance_quick()` - Quick balancing
- Split logic within balance operations

**Events Emitted**:
- `btree_split_event(original_page, new_page, split_cell)`
- `btree_balance_event(page_num, num_cells)`

---

### VDBE (Virtual Database Engine)

#### `vdbe-execution.patch`
**Component**: VDBE Execution
**Operations**: Opcode execution, Query lifecycle
**Functions Instrumented**:
- `sqlite3VdbeExec()` - Main execution function
- Opcode execution loop

**Events Emitted**:
- `vdbe_start_event(num_opcodes)`
- `vdbe_opcode_event(pc, opcode, p1, p2, p3)`
- `vdbe_complete_event(result_code)`

---

### SQL Parser

#### `parser-events.patch`
**Component**: SQL Parser
**Operations**: Parsing, Tokenization
**Functions Instrumented**:
- `sqlite3RunParser()` - Main parser
- `sqlite3GetToken()` - Tokenizer

**Events Emitted**:
- `parse_start_event(sql)`
- `parse_token_event(token, token_type)`
- `parse_complete_event(success)`

---

## 🔧 Usage

### Automatic Application

The patches are automatically applied by the instrumentation script:

```bash
python3 scripts/instrument_sqlite.py sqlite/instrumented/sqlite3.c
```

### Manual Application

To apply individual patches manually:

```bash
cd sqlite/instrumented
patch -p0 < ../../patches/btree-page-ops.patch
patch -p0 < ../../patches/btree-cell-ops.patch
patch -p0 < ../../patches/btree-balance-ops.patch
patch -p0 < ../../patches/vdbe-execution.patch
patch -p0 < ../../patches/parser-events.patch
```

### Selective Instrumentation

To apply only specific patches:

```bash
# Only B-tree page operations
patch -p0 < patches/btree-page-ops.patch

# Only VDBE execution
patch -p0 < patches/vdbe-execution.patch
```

---

## 📊 Event Coverage

| Component | Operations | Events | Patch File |
|-----------|-----------|--------|------------|
| **B-Tree Pages** | Allocate, Free | 2 | `btree-page-ops.patch` |
| **B-Tree Cells** | Insert, Delete | 2 | `btree-cell-ops.patch` |
| **B-Tree Balance** | Split, Balance | 2 | `btree-balance-ops.patch` |
| **VDBE** | Execute opcodes | 3 | `vdbe-execution.patch` |
| **Parser** | Parse SQL | 3 | `parser-events.patch` |
| **TOTAL** | | **12 events** | |

---

## 🏗️ Architecture

All patches follow the same pattern:

1. **Declaration Section**
   ```c
   #ifdef EMSCRIPTEN
   extern void event_function(...);
   #endif
   ```

2. **Hook Injection**
   ```c
   #ifdef EMSCRIPTEN
     event_function(parameters);
   #endif
   ```

3. **Conditional Compilation**
   - Only active when compiled with `-DEMSCRIPTEN`
   - Zero overhead when not instrumented

---

## 🔍 Debugging

To verify patch application:

```bash
# Check if patch is applied
grep -n "EMSCRIPTEN" sqlite/instrumented/sqlite3.c | wc -l

# Should show 24 lines (12 events × 2 lines each)
```

To see which events are instrumented:

```bash
# List all event calls
grep -o "..._event(" sqlite/instrumented/sqlite3.c | sort | uniq
```

---

## 🛠️ Creating New Patches

To add new instrumentation:

1. **Identify the function** to instrument in SQLite source
2. **Create patch file** following the naming convention:
   - `component-operation.patch`
   - Example: `btree-search-ops.patch`

3. **Follow the template**:
   ```patch
   --- Description: Brief description
   --- Instruments: What operations
   --- Functions: Which functions

   --- a/sqlite3.c
   +++ b/sqlite3.c
   @@ -line,count +line,count @@
   +#ifdef EMSCRIPTEN
   +extern void new_event(...);
   +#endif

   /* In the function */
   +#ifdef EMSCRIPTEN
   +  new_event(params);
   +#endif
   ```

4. **Update** `scripts/instrument_sqlite.py` to apply the new patch

5. **Add event handler** in `src/wasm/sqlite_bridge.c`

6. **Test** the instrumentation

---

## 📝 Notes

- Patches are **order-independent** - they can be applied in any sequence
- All patches use `#ifdef EMSCRIPTEN` for conditional compilation
- Events are emitted from actual SQLite operations, not simulated
- Patch format is compatible with standard `patch` utility
- Documentation format follows unified diff format

---

## 🔗 Related Files

- **Event Bridge**: `src/wasm/sqlite_bridge.c`
- **Event Handler**: `src/web/js/events.js`
- **Instrumentation Script**: `scripts/instrument_sqlite.py`
- **Build System**: `Makefile`

---

For more information, see:
- [INSTRUMENTATION.md](../docs/INSTRUMENTATION.md)
- [DEVELOPMENT.md](../docs/DEVELOPMENT.md)
