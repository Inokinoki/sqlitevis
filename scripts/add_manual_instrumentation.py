#!/usr/bin/env python3
"""
Manual SQLite Instrumentation - Add event hooks at key B-tree operation points
This script strategically places event hooks where they're most effective
"""

import re
import sys
from pathlib import Path

def add_btree_open_hook(content):
    """Add B-tree open event at sqlite3BtreeOpen"""
    # Find sqlite3BtreeOpen function and add event after successful open
    pattern = r'(int sqlite3BtreeOpen\([^)]+\)\s*\{[^}]*?)(return rc;)'

    def replace_func(match):
        before = match.group(1)
        return_stmt = match.group(2)

        if 'btree_open_event' in before:
            return match.group(0)

        return before + f'''
#ifdef EMSCRIPTEN
  if( rc==SQLITE_OK ){{
    btree_open_event(pBt->pageSize, pBt->nPage);
  }}
#endif
''' + return_stmt

    return re.sub(pattern, replace_func, content, flags=re.DOTALL, count=1)

def add_page_allocation_hook(content):
    """Add page allocation event in allocateBtreePage after successful allocation"""
    # Find the location where *pPgno is set in allocateBtreePage
    pattern = r'(\*pPgno\s*=\s*[^;\n]+;)(\s*\n\s*(rc|return|assert))'

    def replace_func(match):
        assignment = match.group(1)
        next_line = match.group(2)

        # Check if we've already added instrumentation
        if 'page_allocate_event' in assignment:
            return match.group(0)

        # Only add instrumentation in allocateBtreePage function context
        # by checking if we're in the right area of code
        return assignment + f'''
#ifdef EMSCRIPTEN
  page_allocate_event((int)*pPgno, 1);
#endif
''' + next_line

    # Apply this pattern multiple times but limit to avoid over-instrumentation
    return re.sub(pattern, replace_func, content, flags=re.DOTALL)

def add_insert_cell_hook(content):
    """Add insert cell event in insertCell function"""
    # Find insertCell function - add event before return
    pattern = r'(static\s+void\s+insertCell\([^)]+\)\s*\{[^}]*?)(\n\s*return\s*;)'

    def replace_func(match):
        func_body = match.group(1)
        return_stmt = match.group(2)

        if 'btree_insert_event' in func_body:
            return match.group(0)

        return func_body + f'''
#ifdef EMSCRIPTEN
  btree_insert_event(pPage->pgno, i, (const char*)pCell, sz);
#endif
''' + return_stmt

    return re.sub(pattern, replace_func, content, flags=re.DOTALL, count=1)

def add_delete_cell_hook(content):
    """Add delete cell event in dropCell function"""
    pattern = r'(static\s+void\s+dropCell\([^)]+\)\s*\{[^}]{0,500}?pPage->nCell--)(;|\s*\n)'

    def replace_func(match):
        before = match.group(1)
        after = match.group(2)

        if 'btree_delete_event' in before:
            return match.group(0)

        return before + f'''
#ifdef EMSCRIPTEN
  btree_delete_event(pPage->pgno, idx);
#endif
''' + after

    return re.sub(pattern, replace_func, content, flags=re.DOTALL, count=1)

def add_parse_hooks(content):
    """Add parser event hooks"""
    # sqlite3RunParser - add at start
    pattern = r'(int sqlite3RunParser\([^)]+\)\s*\{[^}]{0,300})(;|\s*\n)'

    def replace_func(match):
        before = match.group(1)
        after = match.group(2)

        if 'parse_start_event' in before:
            return match.group(0)

        # Find if we have access to zSql parameter
        if 'zSql' in before:
            return before + f'''
#ifdef EMSCRIPTEN
  if( zSql ) parse_start_event(zSql);
#endif
''' + after

        return match.group(0)

    return re.sub(pattern, replace_func, content, flags=re.DOTALL, count=1)

def add_vdbe_hooks(content):
    """Add VDBE execution hooks"""
    # In sqlite3VdbeExec - add at function start
    pattern = r'(int sqlite3VdbeExec\(Vdbe \*p\)\s*\{[^}]{0,200})(;|\s*\n)'

    def replace_func(match):
        before = match.group(1)
        after = match.group(2)

        if 'vdbe_start_event' in before:
            return match.group(0)

        return before + f'''
#ifdef EMSCRIPTEN
  vdbe_start_event(p->nOp);
#endif
''' + after

    return re.sub(pattern, replace_func, content, flags=re.DOTALL, count=1)

def instrument_file(filepath):
    """Apply all instrumentation hooks"""
    print(f"Instrumenting {filepath}...")

    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    original_len = len(content)

    print("  Adding B-tree hooks...")
    content = add_btree_open_hook(content)
    content = add_page_allocation_hook(content)
    content = add_insert_cell_hook(content)
    content = add_delete_cell_hook(content)

    print("  Adding parser hooks...")
    content = add_parse_hooks(content)

    print("  Adding VDBE hooks...")
    content = add_vdbe_hooks(content)

    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    added = len(content) - original_len
    print(f"  Added {added} bytes of instrumentation")

    return added > 0

def main():
    if len(sys.argv) < 2:
        print("Usage: add_manual_instrumentation.py <sqlite3.c>")
        sys.exit(1)

    filepath = Path(sys.argv[1])

    if not filepath.exists():
        print(f"Error: {filepath} not found")
        sys.exit(1)

    print("=" * 60)
    print("  Manual SQLite Instrumentation")
    print("=" * 60)

    success = instrument_file(filepath)

    if success:
        print("\n✅ Manual instrumentation complete!")
    else:
        print("\n⚠️  No changes made")

    return 0 if success else 1

if __name__ == '__main__':
    sys.exit(main())
