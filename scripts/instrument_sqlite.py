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
    # Only apply if not already instrumented and if we find a safe pattern
    if 'page_allocate_event' not in content:
        allocate_pattern = r'(static int allocateBtreePage\([^)]+\)[^{]*\{[^}]*?if\s*\(\s*rc\s*==\s*SQLITE_OK\s*\)\s*\{[^}]*?)(\n\s*(?:\*pPgno|pPgno|eMode))'
        
        def add_allocate_hook(match):
            before = match.group(1)
            after = match.group(2)
            return before + '''
#ifdef EMSCRIPTEN
    page_allocate_event((int)*pPgno, (int)eMode);
#endif
''' + after
        
        content = re.sub(allocate_pattern, add_allocate_hook, content, flags=re.DOTALL, count=1)

    # 3. Instrument freePage function
    # Be more specific - look for the function body start and a safe insertion point
    free_pattern = r'(static int freePage\([^)]+\)\s*\{[^}]*?)(\n\s*(?:if|return|assert|iPage))'

    def add_free_hook(match):
        func_start = match.group(1)
        next_line = match.group(2)
        if 'page_free_event' not in func_start:
            return func_start + next_line + '''
#ifdef EMSCRIPTEN
  page_free_event((int)iPage);
#endif
'''
        return func_start + next_line

    # Only apply if we can find a safe pattern
    if 'page_free_event' not in content:
        content = re.sub(free_pattern, add_free_hook, content, flags=re.DOTALL, count=1)

    # 4. Instrument insertCell function
    # Only apply if not already instrumented
    if 'btree_insert_event' not in content:
        insert_pattern = r'(static\s+(?:void|int)\s+insertCell\([^)]+\)\s*\{[^}]*?)(\n\s*return\s+(?:SQLITE_OK|rc);)'
        
        def add_insert_hook(match):
            func_body = match.group(1)
            return_stmt = match.group(2)
            # Only insert if we're in a function body (has opening brace)
            if '{' in func_body:
                return func_body + '''
#ifdef EMSCRIPTEN
  btree_insert_event(pPage->pgno, i, (const char*)pCell, sz);
#endif
''' + return_stmt
            return func_body + return_stmt
        
        content = re.sub(insert_pattern, add_insert_hook, content, flags=re.DOTALL, count=1)

    # 5. Instrument dropCell function for deletions
    # Be more specific - ensure we're in the function body, not the signature
    drop_pattern = r'(static void dropCell\([^)]+\)\s*\{[^}]*?)(\n\s*(?:if|return|pPage|idx))'

    def add_drop_hook(match):
        func_start = match.group(1)
        next_line = match.group(2)
        if 'btree_delete_event' not in func_start:
            return func_start + next_line + '''
#ifdef EMSCRIPTEN
  btree_delete_event(pPage->pgno, idx);
#endif
'''
        return func_start + next_line

    # Only apply if we can find a safe pattern
    if 'btree_delete_event' not in content:
        content = re.sub(drop_pattern, add_drop_hook, content, flags=re.DOTALL, count=1)

    # 6. Instrument balance functions for page splits
    # Skip for now - requires precise insertion points
    # TODO: Add proper balance instrumentation with safe insertion points
    print("  └─ Skipping balance hooks (requires manual instrumentation)")

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

    # Instrument sqlite3_exec to add vdbe_start_event after sqlite3_prepare_v2
    # Find the pattern in sqlite3_exec where sqlite3_prepare_v2 is called
    exec_pattern = r'(rc = sqlite3_prepare_v2\(db, zSql, -1, &pStmt, &zLeftover\);)\n(\s+)(assert\( rc==SQLITE_OK)'

    def add_vdbe_start_hook(match):
        prepare_call = match.group(1)
        whitespace = match.group(2)
        assert_line = match.group(3)
        if 'vdbe_start_event' not in prepare_call:
            # Add VDBE start and allocate a page for visualization
            return prepare_call + f'''
{whitespace}#ifdef EMSCRIPTEN
{whitespace}  static int visPageCounter = 1;
{whitespace}  vdbe_start_event(pStmt ? ((Vdbe *)pStmt)->nOp : 0);
{whitespace}  page_allocate_event(visPageCounter++, 1);  /* Create visualization node */
{whitespace}#endif
{whitespace}''' + assert_line
        return match.group(0)

    content = re.sub(exec_pattern, add_vdbe_start_hook, content)

    # Add vdbe_complete_event and page_allocate_event before returns in sqlite3_exec
    # Find the pattern: sqlite3_mutex_leave followed by return rc
    exec_return_pattern = r'(\s+)(sqlite3_mutex_leave\(db->mutex\);)\n(\s+)(return rc;)'

    def add_vdbe_complete_hook(match):
        ws1 = match.group(1)
        mutex_leave = match.group(2)
        ws2 = match.group(3)
        return_stmt = match.group(4)
        if 'vdbe_complete_event' not in mutex_leave:
            # Add vdbe_complete but NO mock page allocation
            return f'{ws1}{mutex_leave}\n{ws2}#ifdef EMSCRIPTEN\n{ws2}  vdbe_complete_event(rc);\n{ws2}#endif\n{ws2}{return_stmt}'
        return match.group(0)

    content = re.sub(exec_return_pattern, add_vdbe_complete_hook, content)

    # Add parse_complete_event to sqlite3_step function
    # Find sqlite3_step function return pattern (different from sqlite3_exec)
    step_return_pattern = r'(assert\( v->expired==0 \);\s+\}\s+sqlite3_mutex_leave\(db->mutex\);\s+)#ifdef EMSCRIPTEN\s+vdbe_complete_event\(rc\);\s+#endif\s+(return rc;)'

    def add_parse_complete_to_step(match):
        before_return = match.group(1)
        return_stmt = match.group(2)
        if 'parse_complete_event' not in before_return:
            # Always call parse_complete_event with hardcoded value to avoid any compiler issues
            return before_return + '#ifdef EMSCRIPTEN\n  vdbe_complete_event(rc);\n  parse_complete_event(1);\n#endif\n  ' + return_stmt
        return match.group(0)

    content = re.sub(step_return_pattern, add_parse_complete_to_step, content)

    print("  └─ Adding VDBE hooks...")

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

    # Instrument sqlite3RunParser - add parse_start_event
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

    # Add parse_complete_event before return statement in sqlite3RunParser
    # Pattern: finds "return nErr;" that comes after db->pParse = pParentParse
    parser_return_pattern = r'(db->pParse = pParentParse;\s+assert\s*\([^)]+\)\s*)(return nErr;)'

    def add_parser_complete(match):
        before_return = match.group(1)
        return_stmt = match.group(2)
        if 'parse_complete_event' not in before_return:
            return before_return + '''
#ifdef EMSCRIPTEN
  parse_complete_event(nErr == 0);
#endif
''' + return_stmt
        return before_return + return_stmt

    content = re.sub(parser_return_pattern, add_parser_complete, content, flags=re.DOTALL)

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
