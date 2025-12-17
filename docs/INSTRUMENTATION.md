# SQLite Instrumentation Guide

This document describes how to add visualization hooks to SQLite source code.

## Overview

To visualize SQLite's internal operations, we need to insert event emission calls at key points in the SQLite codebase. These events are then captured by JavaScript and rendered in the visualization.

## Event Emission Functions

All event emission functions are defined in `src/wasm/sqlite_bridge.c`:

```c
void btree_open_event(int page_size, int num_pages);
void btree_insert_event(int page_num, int cell_idx, const char* key, int key_len);
void btree_delete_event(int page_num, int cell_idx);
void btree_split_event(int original_page, int new_page, int split_cell);
void page_allocate_event(int page_num, int page_type);
void page_free_event(int page_num);
void parse_start_event(const char* sql);
void parse_token_event(const char* token, int token_type);
void parse_complete_event(int success);
void vdbe_start_event(int num_opcodes);
void vdbe_opcode_event(int pc, const char* opcode, int p1, int p2, int p3);
void vdbe_complete_event(int result_code);
```

## Instrumentation Points

### 1. B-Tree Operations (btree.c)

#### Page Allocation

Find the `allocateBtreePage` function and add:

```c
int allocateBtreePage(BtShared *pBt, MemPage **ppPage, Pgno *pPgno, Pgno nearby, u8 eMode) {
    int rc;
    Pgno pgno;

    // ... existing code ...

    // After successful allocation
    if( rc==SQLITE_OK ){
        #ifdef SQLITE_ENABLE_VISUALIZATION
        page_allocate_event((int)*pPgno, (int)(*ppPage)->leaf);
        #endif
    }

    return rc;
}
```

#### Cell Insertion

Find `insertCell` in btree.c:

```c
static int insertCell(
  MemPage *pPage,   /* Page into which we are inserting */
  int i,            /* Index of cell to insert */
  u8 *pCell,        /* Content of the cell */
  int sz,           /* Bytes of content in pCell */
  u8 *pTemp,        /* Temporary storage */
  Pgno iChild       /* If non-zero, replace first 4 bytes with this */
){
    // ... existing code ...

    #ifdef SQLITE_ENABLE_VISUALIZATION
    if( rc==SQLITE_OK ){
        btree_insert_event(pPage->pgno, i, (const char*)pCell, sz);
    }
    #endif

    return rc;
}
```

#### Page Split

Find `balance_nonroot` or `balance` in btree.c:

```c
static int balance_nonroot(
  MemPage *pParent,               /* Parent page */
  int iParentIdx,                 /* Index in parent of left sibling */
  u8 *aOvfl,                      /* Overflow cell from pParent */
  int iOvflIdx,                   /* Index in pParent of aOvfl[] */
  int bBulk                       /* True if doing bulk insert */
){
    // ... existing code ...

    // When creating a new page
    #ifdef SQLITE_ENABLE_VISUALIZATION
    if( nNew > nOld ){
        btree_split_event(apOld[0]->pgno, apNew[nOld]->pgno, iOvflIdx);
    }
    #endif

    // ... rest of code ...
}
```

### 2. SQL Parser (parse.y or tokenize.c)

#### Parse Start

Find `sqlite3RunParser` in parse.c (generated from parse.y):

```c
int sqlite3RunParser(Parse *pParse, const char *zSql, char **pzErrMsg){
    #ifdef SQLITE_ENABLE_VISUALIZATION
    parse_start_event(zSql);
    #endif

    // ... existing parsing code ...

    #ifdef SQLITE_ENABLE_VISUALIZATION
    parse_complete_event(pParse->nErr == 0);
    #endif

    return pParse->nErr;
}
```

#### Token Recognition

Find `sqlite3GetToken` in tokenize.c:

```c
int sqlite3GetToken(const unsigned char *z, int *tokenType){
    // ... existing code ...

    #ifdef SQLITE_ENABLE_VISUALIZATION
    if( *tokenType != TK_SPACE ){
        char token[256];
        int len = (z - zStart < 255) ? (z - zStart) : 255;
        memcpy(token, zStart, len);
        token[len] = 0;
        parse_token_event(token, *tokenType);
    }
    #endif

    return (int)(z - zStart);
}
```

### 3. Virtual Machine (vdbe.c)

#### VDBE Execution Start

Find `sqlite3VdbeExec` in vdbe.c:

```c
int sqlite3VdbeExec(Vdbe *p){
    #ifdef SQLITE_ENABLE_VISUALIZATION
    vdbe_start_event(p->nOp);
    #endif

    // ... main execution loop ...

    for(pc=p->pc; pc>=0 && pc<p->nOp; pc++){
        Op *pOp = &aOp[pc];

        #ifdef SQLITE_ENABLE_VISUALIZATION
        vdbe_opcode_event(pc, sqlite3OpcodeName(pOp->opcode),
                         pOp->p1, pOp->p2, pOp->p3);
        #endif

        // ... opcode execution ...
    }

    #ifdef SQLITE_ENABLE_VISUALIZATION
    vdbe_complete_event(rc);
    #endif

    return rc;
}
```

## Compilation Flags

To enable instrumentation, compile SQLite with:

```bash
-DSQLITE_ENABLE_VISUALIZATION
```

This allows us to conditionally include instrumentation code without affecting normal SQLite builds.

## Testing Instrumentation

After adding hooks, compile and test:

```bash
make instrument
make build-wasm
make serve
```

Then open the browser console and check for event emissions when executing SQL.

## Performance Considerations

- Events are only emitted when `SQLITE_ENABLE_VISUALIZATION` is defined
- Event emission has minimal overhead (string formatting and function call)
- For production use, compile without the flag to remove all instrumentation

## Debugging Tips

1. **Missing Events**: Check if the instrumentation code is being reached with console.log
2. **WASM Compilation Errors**: Ensure all event functions are declared in a header
3. **JavaScript Not Receiving Events**: Verify `window.sqliteVisEventHandler` is defined
4. **Event Data Malformed**: Check JSON formatting in event emission strings

## Next Steps

1. Download SQLite source: `make download-sqlite`
2. Apply patches manually or create a patch file
3. Test each instrumentation point individually
4. Compile to WASM: `make build-wasm`
5. Test in browser

## Automatic Patching (Future)

We can create patch files to automate instrumentation:

```bash
# Create patch after manual instrumentation
cd sqlite/instrumented
diff -Naur ../original/btree.c btree.c > ../../patches/btree.patch
```

Then apply automatically:

```bash
patch sqlite/instrumented/btree.c < patches/btree.patch
```
