#!/usr/bin/env python3
"""
SQLite Instrumentation Script

This script instruments SQLite source code with visualization event hooks
by using exact string matching patterns from SQLite 3.45.0 amalgamation.

Usage:
    python3 scripts/instrument_sqlite.py sqlite/instrumented/sqlite3.c
"""

import sys
import re

def add_event_declarations(content):
    """Add event function declarations at the top of the file"""

    # Find a safe insertion point after the includes
    insert_point = content.find('#ifndef SQLITE_AMALGAMATION')
    if insert_point == -1:
        # Try alternative insertion point
        insert_point = content.find('/*\n** Internal interface definitions for SQLite.')

    if insert_point == -1:
        print("⚠️  Warning: Could not find safe insertion point for declarations")
        return content, 0

    declarations = '''
/* ============================================================
** Visualization Event Hooks for SQLite B-tree Operations
** ============================================================ */
#ifdef EMSCRIPTEN
extern void page_allocate_event(int page_num, int page_type);
extern void page_free_event(int page_num);
extern void btree_insert_event(int page_num, int cell_idx, const char* key, int key_len);
extern void btree_delete_event(int page_num, int cell_idx);
extern void btree_split_event(int original_page, int new_page, int split_cell);
extern void btree_balance_event(int page_num, int num_cells);
extern void vdbe_start_event(int num_opcodes);
extern void vdbe_opcode_event(int pc, const char* opcode, int p1, int p2, int p3);
extern void vdbe_complete_event(int result_code);
#endif
/* ============================================================ */

'''

    content = content[:insert_point] + declarations + content[insert_point:]
    print("✅ Added event declarations")
    return content, 1


def instrument_page_allocation(content):
    """Instrument allocateBtreePage() - line 76470"""
    count = 0

    # Pattern 1: Hook before returning allocated page (line ~76777)
    old = '''end_allocate_page:
  releasePage(pTrunk);
  releasePage(pPrevTrunk);'''

    new = '''end_allocate_page:
#ifdef EMSCRIPTEN
  if( rc==SQLITE_OK && *pPgno>1 ){
    page_allocate_event((int)*pPgno, 0);
  }
#endif
  releasePage(pTrunk);
  releasePage(pPrevTrunk);'''

    if old in content:
        content = content.replace(old, new, 1)
        count += 1
        print(f"  ✓ Instrumented page allocation (1 hook)")
    else:
        print(f"  ✗ Could not find page allocation pattern")

    return content, count


def instrument_page_free(content):
    """Instrument freePage2() for page deallocation"""
    count = 0

    # Look for freePage2 function signature
    old = '''static int freePage2(BtShared *pBt, MemPage *pMemPage, Pgno iPage){
  MemPage *pTrunk = 0;                /* Free-list trunk page */
  Pgno iTrunk = 0;                    /* Page number of free-list trunk page */
  MemPage *pPage1 = pBt->pPage1;      /* Local reference to page 1 */
  MemPage *pPage;                     /* Page being freed. May be NULL. */
  int rc;                             /* Return Code */
  u32 nFree;                          /* Initial number of pages on free-list */'''

    new = '''static int freePage2(BtShared *pBt, MemPage *pMemPage, Pgno iPage){
  MemPage *pTrunk = 0;                /* Free-list trunk page */
  Pgno iTrunk = 0;                    /* Page number of free-list trunk page */
  MemPage *pPage1 = pBt->pPage1;      /* Local reference to page 1 */
  MemPage *pPage;                     /* Page being freed. May be NULL. */
  int rc;                             /* Return Code */
  u32 nFree;                          /* Initial number of pages on free-list */

#ifdef EMSCRIPTEN
  if( iPage>1 ) page_free_event((int)iPage);
#endif'''

    if old in content:
        content = content.replace(old, new, 1)
        count += 1
        print(f"  ✓ Instrumented page deallocation (1 hook)")
    else:
        print(f"  ✗ Could not find page deallocation pattern")

    return content, count


def instrument_cell_insertion(content):
    """Instrument insertCell() - line 77284"""
    count = 0

    # Pattern: Right after the function assertions, before the overflow check
    old = '''  assert( iChild>0 );
  if( pPage->nOverflow || sz+2>pPage->nFree ){'''

    new = '''  assert( iChild>0 );
#ifdef EMSCRIPTEN
  btree_insert_event(pPage->pgno, i, (const char*)pCell, sz);
#endif
  if( pPage->nOverflow || sz+2>pPage->nFree ){'''

    if old in content:
        content = content.replace(old, new, 1)
        count += 1
        print(f"  ✓ Instrumented cell insertion (1 hook)")
    else:
        print(f"  ✗ Could not find cell insertion pattern")

    return content, count


def instrument_cell_deletion(content):
    """Instrument dropCell() - line 77220"""
    count = 0

    # Pattern: After the initial checks in dropCell
    old = '''  if( *pRC ) return;
  assert( idx>=0 );
  assert( idx<pPage->nCell );'''

    new = '''  if( *pRC ) return;
#ifdef EMSCRIPTEN
  btree_delete_event(pPage->pgno, idx);
#endif
  assert( idx>=0 );
  assert( idx<pPage->nCell );'''

    if old in content:
        content = content.replace(old, new, 1)
        count += 1
        print(f"  ✓ Instrumented cell deletion (1 hook)")
    else:
        print(f"  ✗ Could not find cell deletion pattern")

    return content, count


def instrument_vdbe_execution(content):
    """Instrument sqlite3VdbeExec() - line 93348"""
    count = 0

    # Pattern 1: VDBE start - after the initial checks, before the main loop
    old = '''  sqlite3EndBenignMalloc();
#endif
  for(pOp=&aOp[p->pc]; 1; pOp++){'''

    new = '''  sqlite3EndBenignMalloc();
#endif
#ifdef EMSCRIPTEN
  vdbe_start_event(p->nOp);
#endif
  for(pOp=&aOp[p->pc]; 1; pOp++){'''

    if old in content:
        content = content.replace(old, new, 1)
        count += 1
        print(f"  ✓ Instrumented VDBE start (1 hook)")
    else:
        print(f"  ✗ Could not find VDBE start pattern")

    # Pattern 2: Opcode execution - in the main loop after checks
    old = '''#ifdef SQLITE_DEBUG
    if( db->flags & SQLITE_VdbeTrace ){
      sqlite3VdbePrintOp(stdout, (int)(pOp - aOp), pOp);
      test_trace_breakpoint((int)(pOp - aOp),pOp,p);
    }
#endif'''

    new = '''#ifdef SQLITE_DEBUG
    if( db->flags & SQLITE_VdbeTrace ){
      sqlite3VdbePrintOp(stdout, (int)(pOp - aOp), pOp);
      test_trace_breakpoint((int)(pOp - aOp),pOp,p);
    }
#endif

#ifdef EMSCRIPTEN
    {
      extern const char *sqlite3OpcodeName(int);
      vdbe_opcode_event((int)(pOp - aOp), sqlite3OpcodeName(pOp->opcode),
                        pOp->p1, pOp->p2, pOp->p3);
    }
#endif'''

    if old in content:
        content = content.replace(old, new, 1)
        count += 1
        print(f"  ✓ Instrumented VDBE opcode execution (1 hook)")
    else:
        print(f"  ✗ Could not find VDBE opcode pattern")

    # Pattern 3: VDBE complete - at the error handler near the end
    old = '''abort_due_to_error:
  if( db->mallocFailed ){
    rc = SQLITE_NOMEM_BKPT;'''

    new = '''abort_due_to_error:
#ifdef EMSCRIPTEN
  vdbe_complete_event(rc);
#endif
  if( db->mallocFailed ){
    rc = SQLITE_NOMEM_BKPT;'''

    if old in content:
        content = content.replace(old, new, 1)
        count += 1
        print(f"  ✓ Instrumented VDBE complete (1 hook)")
    else:
        print(f"  ✗ Could not find VDBE complete pattern")

    return content, count


def instrument_balance_operations(content):
    """Instrument balance_nonroot() - line 78190"""
    count = 0

    # Pattern: After the initial setup in balance_nonroot
    old = '''  memset(abDone, 0, sizeof(abDone));
  memset(&b, 0, sizeof(b));
  pBt = pParent->pBt;'''

    new = '''  memset(abDone, 0, sizeof(abDone));
  memset(&b, 0, sizeof(b));
  pBt = pParent->pBt;

#ifdef EMSCRIPTEN
  btree_balance_event(pParent->pgno, pParent->nCell);
#endif'''

    if old in content:
        content = content.replace(old, new, 1)
        count += 1
        print(f"  ✓ Instrumented balance operation (1 hook)")
    else:
        print(f"  ✗ Could not find balance operation pattern")

    return content, count


def instrument_page_split(content):
    """Instrument page split events in balance operations"""
    count = 0

    # Look for where new pages are allocated during balance
    # This is complex as splits happen during balance_nonroot
    # We'll hook into the allocateBtreePage calls within balance operations

    # Pattern: When allocating a new page during balance
    old_pattern = re.compile(
        r'(rc = allocateBtreePage\(pBt, &pNew, &pgno(?:New)?, )'
        r'([^;]+;\s*)'
        r'(if\( rc \) )',
        re.MULTILINE
    )

    def add_split_hook(match):
        # This adds a hook right after successful allocation
        return (match.group(1) + match.group(2) +
                'if( rc==SQLITE_OK ){ \n#ifdef EMSCRIPTEN\n' +
                '      btree_split_event(apOld[0]->pgno, pgnoNew, 0);\n' +
                '#endif\n    }\n    ' +
                match.group(3))

    # Note: This pattern might not match perfectly, so we'll be lenient
    new_content, replacements = old_pattern.subn(add_split_hook, content, count=1)
    if replacements > 0:
        content = new_content
        count += replacements
        print(f"  ✓ Instrumented page split (1 hook)")
    else:
        print(f"  ⚠️  Could not find page split pattern (this is OK, splits are rare)")

    return content, count


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 instrument_sqlite.py <path-to-sqlite3.c>")
        sys.exit(1)

    filepath = sys.argv[1]

    print(f"\n🔧 Instrumenting SQLite source: {filepath}")
    print("=" * 60)

    # Read the original file
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        print(f"📖 Read {len(content)} bytes from {filepath}")
    except Exception as e:
        print(f"❌ Error reading file: {e}")
        sys.exit(1)

    # Apply instrumentation
    total_hooks = 0

    print("\n📝 Adding event declarations...")
    content, count = add_event_declarations(content)
    total_hooks += count

    print("\n🔨 Instrumenting B-tree page operations...")
    content, count = instrument_page_allocation(content)
    total_hooks += count
    content, count = instrument_page_free(content)
    total_hooks += count

    print("\n🔨 Instrumenting B-tree cell operations...")
    content, count = instrument_cell_insertion(content)
    total_hooks += count
    content, count = instrument_cell_deletion(content)
    total_hooks += count

    print("\n🔨 Instrumenting B-tree balance operations...")
    content, count = instrument_balance_operations(content)
    total_hooks += count
    content, count = instrument_page_split(content)
    total_hooks += count

    print("\n🔨 Instrumenting VDBE execution...")
    content, count = instrument_vdbe_execution(content)
    total_hooks += count

    # Write the instrumented file
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"\n✅ Wrote instrumented file: {filepath}")
    except Exception as e:
        print(f"\n❌ Error writing file: {e}")
        sys.exit(1)

    print("\n" + "=" * 60)
    print(f"🎉 Instrumentation complete: {total_hooks} hooks added")
    print("=" * 60)

    if total_hooks < 8:
        print("\n⚠️  WARNING: Expected at least 8 hooks, but only added", total_hooks)
        print("Some patterns may not have matched. Check the output above.")
        sys.exit(1)


if __name__ == '__main__':
    main()
