#!/usr/bin/env python3
"""
SQLite Instrumentation Script
Automatically adds visualization event hooks to SQLite source code
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
extern void btree_insert_event(int page_num, int cell_idx, const char* key, int key_len);
extern void btree_split_event(int original_page, int new_page, int split_cell);
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
    # Find: if( rc==SQLITE_OK ){
    #   Add after: page_allocate_event(...)
    allocate_pattern = r'(static int allocateBtreePage\([^)]+\)[^{]*\{[^}]+if\s*\(\s*rc\s*==\s*SQLITE_OK\s*\)\s*\{)'

    def add_allocate_hook(match):
        return match.group(1) + '''
#ifdef EMSCRIPTEN
    page_allocate_event((int)*pPgno, (int)eMode);
#endif'''

    content = re.sub(allocate_pattern, add_allocate_hook, content, flags=re.DOTALL)

    # 3. Instrument insertCell function
    # Find the end of insertCell before return
    insert_pattern = r'(static\s+(?:void|int)\s+insertCell\([^)]+\)[^{]*\{(?:[^}]|(?:\{[^}]*\}))*)(return\s+(?:SQLITE_OK|rc);)'

    def add_insert_hook(match):
        return match.group(1) + '''
#ifdef EMSCRIPTEN
  btree_insert_event(pPage->pgno, i, (const char*)pCell, sz);
#endif
  ''' + match.group(2)

    content = re.sub(insert_pattern, add_insert_hook, content, flags=re.DOTALL)

    return content


def instrument_file(filepath):
    """Instrument a single SQLite source file"""
    print(f"Instrumenting {filepath}...")

    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    original_len = len(content)

    # Apply instrumentation
    content = instrument_btree(content)

    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    added = len(content) - original_len
    print(f"  Added {added} bytes of instrumentation")

    return added > 0


def main():
    if len(sys.argv) < 2:
        print("Usage: instrument_sqlite.py <sqlite3.c>")
        sys.exit(1)

    filepath = Path(sys.argv[1])

    if not filepath.exists():
        print(f"Error: {filepath} not found")
        sys.exit(1)

    print("SQLite Instrumentation Tool")
    print("=" * 50)

    success = instrument_file(filepath)

    if success:
        print("\n✅ Instrumentation complete!")
        print("   Event hooks added for:")
        print("   - Page allocation")
        print("   - Cell insertion")
        print("   - Page splits (coming soon)")
    else:
        print("\n⚠️  No instrumentation added")
        print("   File may already be instrumented or pattern not found")

    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(main())
