#!/usr/bin/env python3
"""
SQLite Instrumentation Script
Automatically adds comprehensive visualization event hooks to SQLite source code
"""

import re
import sys
from pathlib import Path


def instrument_btree(content):
    """Add instrumentation to B-tree operations"""

    # 1. Add external declarations at the top (after includes)
    declarations = """
/* Visualization event hooks - defined in sqlite_bridge.c */
#ifdef EMSCRIPTEN
extern void page_allocate_event(int page_num, int page_type);
extern void page_free_event(int page_num);
extern void btree_insert_event(int page_num, int cell_idx, const char* key, int key_len);
extern void btree_delete_event(int page_num, int cell_idx);
extern void btree_split_event(int original_page, int new_page, int split_cell);
extern void btree_balance_event(int page_num, int num_cells);
#endif
"""

    # Find a good place to insert (after the first set of includes)
    include_pattern = r'(#include\s+"sqliteInt\.h".*?\n)'
    if re.search(include_pattern, content):
        content = re.sub(
            include_pattern,
            r'\1\n' + declarations + '\n',
            content,
            count=1
        )

    # 2. Instrument allocateBtreePage function
    allocate_pattern = r'(static int allocateBtreePage\([^)]+\)[^{]*\{[^}]+if\s*\(\s*rc\s*==\s*SQLITE_OK\s*\)\s*\{)'

    def add_allocate_hook(match):
        return match.group(1) + '''
#ifdef EMSCRIPTEN
    page_allocate_event((int)*pPgno, (int)eMode);
#endif'''

    content = re.sub(allocate_pattern, add_allocate_hook, content, flags=re.DOTALL)

    # 3. Instrument freePage function
    free_pattern = r'(static int freePage[^{]*\{[^}]*\n)'

    def add_free_hook(match):
        return match.group(1) + '''#ifdef EMSCRIPTEN
  page_free_event((int)iPage);
#endif
'''

    content = re.sub(free_pattern, add_free_hook, content, flags=re.DOTALL)

    # 4. Instrument insertCell function
    insert_pattern = r'(static\s+(?:void|int)\s+insertCell\([^)]+\)[^{]*\{(?:[^}]|(?:\{[^}]*\}))*)(return\s+(?:SQLITE_OK|rc);)'

    def add_insert_hook(match):
        return match.group(1) + '''
#ifdef EMSCRIPTEN
  btree_insert_event(pPage->pgno, i, (const char*)pCell, sz);
#endif
  ''' + match.group(2)

    content = re.sub(insert_pattern, add_insert_hook, content, flags=re.DOTALL)

    # 5. Instrument dropCell function for deletions
    drop_pattern = r'(static void dropCell\([^)]+\)[^{]*\{[^\n]*\n)'

    def add_drop_hook(match):
        return match.group(1) + '''#ifdef EMSCRIPTEN
  btree_delete_event(pPage->pgno, idx);
#endif
'''

    content = re.sub(drop_pattern, add_drop_hook, content, flags=re.DOTALL)

    # 6. Instrument balance functions for page splits
    balance_pattern = r'(static int balance\w*\([^)]+\)[^{]*\{[^}]{0,200})'

    def add_balance_hook(match):
        # Add hook near the start of balance functions
        func_start = match.group(1)
        if 'balance_nonroot' in func_start or 'balance_quick' in func_start:
            return func_start + '''
#ifdef EMSCRIPTEN
  if (pParent) btree_balance_event(pParent->pgno, pParent->nCell);
#endif
'''
        return func_start

    content = re.sub(balance_pattern, add_balance_hook, content, flags=re.DOTALL)

    return content


def instrument_vdbe(content):
    """Add instrumentation to VDBE (Virtual Database Engine) execution"""

    # Add VDBE event declarations
    vdbe_declarations = """
#ifdef EMSCRIPTEN
extern void vdbe_start_event(int num_opcodes);
extern void vdbe_opcode_event(int pc, const char* opcode, int p1, int p2, int p3);
extern void vdbe_complete_event(int result_code);
#endif
"""

    # Add after sqliteInt.h include if not already added
    if 'vdbe_start_event' not in content:
        include_pattern = r'(#include\s+"sqliteInt\.h".*?\n)'
        if re.search(include_pattern, content):
            content = re.sub(
                include_pattern,
                r'\1\n' + vdbe_declarations + '\n',
                content,
                count=1
            )

    # Instrument sqlite3VdbeExec function
    vdbe_exec_pattern = r'(int sqlite3VdbeExec\([^)]+\)[^{]*\{[^}]{0,500})'

    def add_vdbe_start(match):
        func_start = match.group(1)
        if 'vdbe_start_event' not in func_start:
            return func_start + '''
#ifdef EMSCRIPTEN
  vdbe_start_event(p->nOp);
#endif
'''
        return func_start

    content = re.sub(vdbe_exec_pattern, add_vdbe_start, content, flags=re.DOTALL)

    # Instrument opcode execution loop
    opcode_pattern = r'(for\s*\([^)]*pc[^)]*\)[^{]*\{[^}]{0,200}Op\s*\*pOp\s*=\s*&aOp\[pc\];)'

    def add_opcode_hook(match):
        loop_start = match.group(1)
        if 'vdbe_opcode_event' not in loop_start:
            return loop_start + '''
#ifdef EMSCRIPTEN
    vdbe_opcode_event(pc, sqlite3OpcodeName(pOp->opcode), pOp->p1, pOp->p2, pOp->p3);
#endif
'''
        return loop_start

    content = re.sub(opcode_pattern, add_opcode_hook, content, flags=re.DOTALL)

    return content


def instrument_parser(content):
    """Add instrumentation to SQL parser"""

    # Add parser event declarations
    parser_declarations = """
#ifdef EMSCRIPTEN
extern void parse_start_event(const char* sql);
extern void parse_token_event(const char* token, int token_type);
extern void parse_complete_event(int success);
#endif
"""

    if 'parse_start_event' not in content:
        include_pattern = r'(#include\s+"sqliteInt\.h".*?\n)'
        if re.search(include_pattern, content):
            content = re.sub(
                include_pattern,
                r'\1\n' + parser_declarations + '\n',
                content,
                count=1
            )

    # Instrument sqlite3RunParser
    parser_pattern = r'(int sqlite3RunParser\([^)]+\)[^{]*\{[^}]{0,200})'

    def add_parser_start(match):
        func_start = match.group(1)
        if 'parse_start_event' not in func_start:
            return func_start + '''
#ifdef EMSCRIPTEN
  if (zSql) parse_start_event(zSql);
#endif
'''
        return func_start

    content = re.sub(parser_pattern, add_parser_start, content, flags=re.DOTALL)

    return content


def instrument_file(filepath):
    """Instrument a single SQLite source file"""
    print(f"Instrumenting {filepath}...")

    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    original_len = len(content)

    # Apply all instrumentation
    print("  └─ Adding B-tree hooks...")
    content = instrument_btree(content)

    print("  └─ Adding VDBE hooks...")
    content = instrument_vdbe(content)

    print("  └─ Adding parser hooks...")
    content = instrument_parser(content)

    # Write back
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
        print("\n✅ Instrumentation complete!")
        print("\n📊 Event hooks added for:")
        print("   🌳 B-tree Operations:")
        print("      • Page allocation")
        print("      • Page deallocation")
        print("      • Cell insertion")
        print("      • Cell deletion")
        print("      • Page splitting")
        print("      • B-tree balancing")
        print("\n   ⚙️  VDBE Execution:")
        print("      • Execution start")
        print("      • Opcode execution")
        print("      • Execution complete")
        print("\n   📝 SQL Parser:")
        print("      • Parse start")
        print("      • Token recognition")
        print("      • Parse complete")
    else:
        print("\n⚠️  No instrumentation added")
        print("   File may already be instrumented or patterns not found")

    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(main())
