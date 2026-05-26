#!/usr/bin/env python3
"""
SQLite Instrumentation Script
Automatically adds comprehensive visualization event hooks to SQLite source code.
Uses line-number-based insertion for precision (avoids fragile regex on comments).
"""

import re
import sys
from pathlib import Path


def find_line_number(lines, pattern, start=0):
    """Find the line number (0-indexed) matching a regex pattern."""
    for i in range(start, len(lines)):
        if re.search(pattern, lines[i]):
            return i
    return -1


def insert_after_line(lines, line_num, text):
    """Insert text after the given line number (0-indexed)."""
    lines.insert(line_num + 1, text)
    return lines


def instrument_file(filepath):
    """Instrument a single SQLite source file."""
    print(f"Instrumenting {filepath}...")

    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    lines = content.split('\n')
    original_len = len(content)

    # =========================================================================
    # 1. Add ALL external declarations after #include "sqliteInt.h"
    # =========================================================================
    if 'parse_start_event' not in content:
        decl_idx = find_line_number(lines, r'#include\s+"sqliteInt\.h"')
        if decl_idx >= 0:
            declarations = """
/* Visualization event hooks - defined in sqlite_bridge.c */
#ifdef EMSCRIPTEN
extern void btree_open_event(int page_size, int num_pages);
extern void page_allocate_event(int page_num, int page_type);
extern void page_free_event(int page_num);
extern void btree_insert_event(int page_num, int cell_idx, const char* key, int key_len);
extern void btree_delete_event(int page_num, int cell_idx);
extern void btree_split_event(int original_page, int new_page, int split_cell);
extern void btree_balance_event(int page_num, int num_cells);
extern void vdbe_start_event(int num_opcodes);
extern void vdbe_opcode_event(int pc, const char* opcode, int p1, int p2, int p3);
extern void vdbe_complete_event(int result_code);
extern void parse_start_event(const char* sql);
extern void parse_token_event(const char* token, int token_type);
extern void parse_complete_event(int success);
#endif
"""
            lines.insert(decl_idx + 1, declarations)
            print(f"  └─ Added declarations at line {decl_idx + 1}")
    else:
        print("  └─ Declarations already present")

    # =========================================================================
    # 2. Instrument sqlite3RunParser — parse_start_event
    #    Insert AFTER "assert( zSql!=0 );" and BEFORE "mxSqlLen = ..."
    #    This is safe because zSql is guaranteed non-NULL at this point.
    #    Match on the DEFINITION (contains opening brace).
    # =========================================================================
    run_parser_idx = find_line_number(lines, r'int sqlite3RunParser\(Parse \*pParse')
    if run_parser_idx >= 0 and not any('parse_start_event' in lines[i] for i in range(run_parser_idx, min(run_parser_idx + 50, len(lines)))):
        assert_idx = find_line_number(lines, r'assert\(\s*zSql!=0\s*\)', run_parser_idx)
        if assert_idx >= 0:
            lines.insert(assert_idx + 1, '#ifdef EMSCRIPTEN')
            lines.insert(assert_idx + 2, '  parse_start_event(zSql);')
            lines.insert(assert_idx + 3, '#endif')
            print(f"  └─ Added parse_start_event at line {assert_idx + 1}")
        else:
            print("  └─ WARNING: Could not find assert(zSql!=0) in sqlite3RunParser")
    else:
        if run_parser_idx >= 0:
            print("  └─ parse_start_event already present in sqlite3RunParser")
        else:
            print("  └─ WARNING: Could not find sqlite3RunParser definition")

    # =========================================================================
    # 3. Instrument sqlite3RunParser — parse_token_event
    #    Insert AFTER "n = sqlite3GetToken(...)" in the while(1) loop.
    #    Only emit for non-space tokens to avoid flooding.
    # =========================================================================
    run_parser_idx = find_line_number(lines, r'int sqlite3RunParser\(Parse \*pParse')
    if run_parser_idx >= 0 and not any('parse_token_event' in lines[i] for i in range(run_parser_idx, min(run_parser_idx + 200, len(lines)))):
        gettoken_idx = find_line_number(lines, r'n = sqlite3GetToken\(', run_parser_idx)
        if gettoken_idx >= 0:
            token_hook = """#ifdef EMSCRIPTEN
    if( tokenType!=TK_SPACE && n>0 ){
      char _visTokBuf[128];
      int _visTokLen = n < 127 ? n : 127;
      memcpy(_visTokBuf, zSql, _visTokLen);
      _visTokBuf[_visTokLen] = 0;
      parse_token_event(_visTokBuf, tokenType);
    }
#endif"""
            lines.insert(gettoken_idx + 1, token_hook)
            print(f"  └─ Added parse_token_event at line {gettoken_idx + 1}")
        else:
            print("  └─ WARNING: Could not find sqlite3GetToken in sqlite3RunParser")
    else:
        if run_parser_idx >= 0:
            print("  └─ parse_token_event already present in sqlite3RunParser")

    # =========================================================================
    # 4. Instrument sqlite3RunParser — parse_complete_event
    #    Insert BEFORE "return nErr;" at the end of sqlite3RunParser.
    # =========================================================================
    run_parser_idx = find_line_number(lines, r'int sqlite3RunParser\(Parse \*pParse')
    if run_parser_idx >= 0:
        # Find "db->pParse = pParentParse;" then "return nErr;"
        parent_assign_idx = find_line_number(lines, r'db->pParse = pParentParse;', run_parser_idx)
        if parent_assign_idx >= 0 and 'parse_complete_event' not in ''.join(lines[parent_assign_idx:parent_assign_idx+10]):
            return_idx = find_line_number(lines, r'return nErr;', parent_assign_idx)
            if return_idx >= 0:
                lines.insert(return_idx, '#ifdef EMSCRIPTEN')
                lines.insert(return_idx + 1, '  parse_complete_event(nErr == 0);')
                lines.insert(return_idx + 2, '#endif')
                print(f"  └─ Added parse_complete_event at line {return_idx}")

    # =========================================================================
    # 5. Instrument sqlite3_exec — vdbe_start_event (NO mock page_allocate)
    #    Real page events now come from allocateBtreePage.
    # =========================================================================
    exec_idx = -1
    for i in range(len(lines)):
        if re.search(r'SQLITE_API int sqlite3_exec\(', lines[i]):
            for j in range(i, min(i + 10, len(lines))):
                if '{' in lines[j]:
                    exec_idx = i
                    break
            if exec_idx >= 0:
                break

    if exec_idx >= 0 and not any('vdbe_start_event' in lines[i] for i in range(exec_idx, min(exec_idx + 100, len(lines)))):
        prepare_idx = find_line_number(lines, r'rc = sqlite3_prepare_v2\(db, zSql', exec_idx)
        if prepare_idx >= 0:
            vdbe_hook = """#ifdef EMSCRIPTEN
      vdbe_start_event(pStmt ? ((Vdbe *)pStmt)->nOp : 0);
#endif"""
            lines.insert(prepare_idx + 1, vdbe_hook)
            print(f"  └─ Added vdbe_start_event at line {prepare_idx + 1}")
        else:
            print("  └─ WARNING: Could not find sqlite3_prepare_v2 in sqlite3_exec")

    # =========================================================================
    # 6. Instrument sqlite3_exec — vdbe_complete_event
    #    Insert BEFORE "return rc;" after "sqlite3_mutex_leave(db->mutex);"
    #    Only in the definition of sqlite3_exec (not the declaration).
    # =========================================================================
    if exec_idx >= 0:
        # Find the mutex leave + return rc pattern within sqlite3_exec
        for i in range(exec_idx, min(exec_idx + 120, len(lines))):
            if 'sqlite3_mutex_leave(db->mutex)' in lines[i]:
                # Check if next non-empty line is "return rc;"
                for j in range(i + 1, min(i + 5, len(lines))):
                    if lines[j].strip() == 'return rc;':
                        if 'vdbe_complete_event' not in lines[j-1]:
                            lines.insert(j, '#ifdef EMSCRIPTEN')
                            lines.insert(j + 1, '  vdbe_complete_event(rc);')
                            lines.insert(j + 2, '#endif')
                            print(f"  └─ Added vdbe_complete_event in sqlite3_exec at line {j}")
                        break

    # =========================================================================
    # 7. Instrument sqlite3VdbeExec — vdbe_opcode_event
    #    Insert AFTER "nVmStep++;" in the main VDBE execution loop.
    #    Only emit the first 200 opcodes per statement to avoid overwhelming.
    #    Match on the DEFINITION (has "Vdbe *p" param with body).
    # =========================================================================
    vdbe_exec_idx = find_line_number(lines, r'int sqlite3VdbeExec\(\s*$')
    if vdbe_exec_idx < 0:
        vdbe_exec_idx = find_line_number(lines, r'int sqlite3VdbeExec\(Vdbe')
    if vdbe_exec_idx >= 0:
        # Find nVmStep++ in the loop
        for i in range(vdbe_exec_idx, min(vdbe_exec_idx + 200, len(lines))):
            if 'nVmStep++' in lines[i]:
                # Check if already instrumented nearby
                nearby = ''.join(lines[i:min(i+10, len(lines))])
                if 'vdbe_opcode_event' not in nearby:
                    opcode_hook = """#ifdef EMSCRIPTEN
    { int _visPc = (int)(pOp - aOp);
      static int _visOpcodeCounter = 0;
      if( _visOpcodeCounter < 200 ){
        vdbe_opcode_event(_visPc, sqlite3OpcodeName(pOp->opcode), pOp->p1, pOp->p2, pOp->p3);
        _visOpcodeCounter++;
      }
      if( _visPc == 0 ) _visOpcodeCounter = 0;
    }
#endif"""
                    lines.insert(i + 1, opcode_hook)
                    print(f"  └─ Added vdbe_opcode_event at line {i + 1}")
                break

    # =========================================================================
    # 8. Instrument sqlite3_step — vdbe_complete_event + parse_complete_event
    #    Find the DEFINITION (has "sqlite3_stmt *pStmt" param).
    # =========================================================================
    step_idx = find_line_number(lines, r'SQLITE_API int sqlite3_step\(sqlite3_stmt \*pStmt\)')
    if step_idx < 0:
        # Try alternate form
        for i in range(len(lines)):
            if 'sqlite3_step(sqlite3_stmt *pStmt)' in lines[i] and '{' in lines[i]:
                step_idx = i
                break

    if step_idx >= 0:
        # Find "sqlite3_mutex_leave(db->mutex);" then "return rc;" in sqlite3_step
        for i in range(step_idx, min(step_idx + 100, len(lines))):
            if 'sqlite3_mutex_leave(db->mutex)' in lines[i]:
                # Look for "return rc;" in next few lines
                for j in range(i + 1, min(i + 5, len(lines))):
                    stripped = lines[j].strip()
                    if stripped == 'return rc;':
                        nearby = ''.join(lines[max(0,j-5):j])
                        if 'vdbe_complete_event' not in nearby:
                            lines.insert(j, '#ifdef EMSCRIPTEN')
                            lines.insert(j + 1, '  vdbe_complete_event(rc == SQLITE_DONE ? 101 : (rc & 0xff));')
                            lines.insert(j + 2, '  parse_complete_event(1);')
                            lines.insert(j + 3, '#endif')
                            print(f"  └─ Added vdbe_complete_event + parse_complete_event in sqlite3_step at line {j}")
                        break
                break

    # =========================================================================
    # 9. Instrument sqlite3BtreeOpen — btree_open_event
    #    Insert AFTER successful open: "*ppBtree = p;" (line just before label)
    # =========================================================================
    btree_open_idx = find_line_number(lines, r'SQLITE_PRIVATE int sqlite3BtreeOpen\(')
    if btree_open_idx >= 0 and not any('btree_open_event' in lines[i] for i in range(btree_open_idx, min(btree_open_idx + 400, len(lines)))):
        # Find "*ppBtree = p;" before the btree_open_out label
        ppbtree_idx = find_line_number(lines, r'\*\s*ppBtree\s*=\s*p\s*;', btree_open_idx)
        if ppbtree_idx >= 0:
            lines.insert(ppbtree_idx + 1, '#ifdef EMSCRIPTEN')
            lines.insert(ppbtree_idx + 2, '  btree_open_event(pBt ? (int)pBt->pageSize : 0, 0);')
            lines.insert(ppbtree_idx + 3, '#endif')
            print(f"  └─ Added btree_open_event at line {ppbtree_idx + 1}")
        else:
            print("  └─ WARNING: Could not find *ppBtree = p in sqlite3BtreeOpen")
    else:
        if btree_open_idx >= 0:
            print("  └─ btree_open_event already present")

    # =========================================================================
    # 10. Instrument sqlite3BtreeClose — btree_close_event (use page_free_event)
    #     Insert at the beginning of sqlite3BtreeClose body.
    # =========================================================================
    btree_close_idx = find_line_number(lines, r'SQLITE_PRIVATE int sqlite3BtreeClose\(Btree \*p\)')
    if btree_close_idx >= 0 and not any('btree_close' in lines[i] for i in range(btree_close_idx, min(btree_close_idx + 30, len(lines)))):
        # Find opening brace
        brace_idx = find_line_number(lines, r'\{', btree_close_idx)
        if brace_idx >= 0:
            lines.insert(brace_idx + 1, '#ifdef EMSCRIPTEN')
            lines.insert(brace_idx + 2, '  page_free_event(0);')
            lines.insert(brace_idx + 3, '#endif')
            print(f"  └─ Added btree_close_event at line {brace_idx + 1}")
    else:
        if btree_close_idx >= 0:
            print("  └─ btree_close already instrumented")

    # =========================================================================
    # 11. Instrument allocateBtreePage — real page_allocate_event
    #     Insert AFTER the "end_allocate_page:" label, BEFORE "releasePage(pTrunk);"
    #     Only emit when rc==SQLITE_OK (successful allocation).
    # =========================================================================
    alloc_page_idx = find_line_number(lines, r'static int allocateBtreePage\(')
    if alloc_page_idx >= 0 and not any('page_allocate_event' in lines[i] for i in range(alloc_page_idx, min(alloc_page_idx + 400, len(lines)))):
        end_alloc_idx = find_line_number(lines, r'end_allocate_page:', alloc_page_idx)
        if end_alloc_idx >= 0:
            lines.insert(end_alloc_idx + 1, '#ifdef EMSCRIPTEN')
            lines.insert(end_alloc_idx + 2, '  if( rc==SQLITE_OK && pPgno ){ page_allocate_event((int)*pPgno, 0); }')
            lines.insert(end_alloc_idx + 3, '#endif')
            print(f"  └─ Added page_allocate_event in allocateBtreePage at line {end_alloc_idx + 1}")
        else:
            print("  └─ WARNING: Could not find end_allocate_page label")
    else:
        if alloc_page_idx >= 0:
            print("  └─ page_allocate_event already present in allocateBtreePage")

    # =========================================================================
    # 12. Instrument sqlite3BtreeInsert — btree_insert_event
    #     Insert AFTER "rc = insertCellFast(...)" — the actual insertion point.
    #     Only emit on success (rc==SQLITE_OK).
    # =========================================================================
    btree_insert_idx = find_line_number(lines, r'SQLITE_PRIVATE int sqlite3BtreeInsert\(')
    if btree_insert_idx >= 0 and not any('btree_insert_event' in lines[i] for i in range(btree_insert_idx, min(btree_insert_idx + 400, len(lines)))):
        insert_cell_idx = find_line_number(lines, r'rc = insertCellFast\(', btree_insert_idx)
        if insert_cell_idx >= 0:
            insert_hook = """#ifdef EMSCRIPTEN
    if( rc==SQLITE_OK ){
      btree_insert_event((int)pPage->pgno, idx, (const char*)0, (int)(pX->nKey));
    }
#endif"""
            lines.insert(insert_cell_idx + 1, insert_hook)
            print(f"  └─ Added btree_insert_event at line {insert_cell_idx + 1}")
        else:
            print("  └─ WARNING: Could not find insertCellFast in sqlite3BtreeInsert")
    else:
        if btree_insert_idx >= 0:
            print("  └─ btree_insert_event already present")

    # =========================================================================
    # 13. Instrument sqlite3BtreeDelete — btree_delete_event
    #     Insert AFTER the cell is located, BEFORE the actual delete.
    #     We use pCur->ix and pCur->pPage->pgno.
    # =========================================================================
    btree_delete_idx = find_line_number(lines, r'SQLITE_PRIVATE int sqlite3BtreeDelete\(BtCursor \*pCur, u8 flags\)')
    if btree_delete_idx >= 0 and not any('btree_delete_event' in lines[i] for i in range(btree_delete_idx, min(btree_delete_idx + 200, len(lines)))):
        # Find pCell = findCell(pPage, iCellIdx); — the point where cell is located
        findcell_idx = find_line_number(lines, r'pCell = findCell\(pPage, iCellIdx\)', btree_delete_idx)
        if findcell_idx >= 0:
            lines.insert(findcell_idx + 1, '#ifdef EMSCRIPTEN')
            lines.insert(findcell_idx + 2, '  btree_delete_event((int)pPage->pgno, iCellIdx);')
            lines.insert(findcell_idx + 3, '#endif')
            print(f"  └─ Added btree_delete_event at line {findcell_idx + 1}")
        else:
            print("  └─ WARNING: Could not find findCell in sqlite3BtreeDelete")
    else:
        if btree_delete_idx >= 0:
            print("  └─ btree_delete_event already present")

    # Write back
    content = '\n'.join(lines)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    added = len(content) - original_len
    print(f"  └─ Added {added} bytes of instrumentation")

    return added > 0


def main():
    if len(sys.argv) < 2:
        print("Usage: instrument_sqlite.py <sqlite3.c>")
        sys.exit(1)

    filepath = Path(sys.argv[1])

    if not filepath.exists():
        print(f"Error: {filepath} not found")
        sys.exit(1)

    print("=" * 60)
    print("  SQLite Comprehensive Instrumentation Tool")
    print("=" * 60)

    success = instrument_file(filepath)

    if success:
        print("\nInstrumentation complete!")
        print("\nEvent hooks added for:")
        print("   B-tree Operations:")
        print("      - B-tree open (sqlite3BtreeOpen)")
        print("      - B-tree close (sqlite3BtreeClose)")
        print("      - Page allocation (allocateBtreePage)")
        print("      - Insert (sqlite3BtreeInsert)")
        print("      - Delete (sqlite3BtreeDelete)")
        print("   VDBE Execution:")
        print("      - Execution start")
        print("      - Opcode execution (first 200 per statement)")
        print("      - Execution complete")
        print("   SQL Parser:")
        print("      - Parse start")
        print("      - Token recognition")
        print("      - Parse complete")
    else:
        print("\n⚠️  No instrumentation added")
        print("   File may already be instrumented or patterns not found")

    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(main())
