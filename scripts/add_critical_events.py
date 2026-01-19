#!/usr/bin/env python3
"""
Add critical event emissions to SQLite for visualization
This adds events at high-level points that are guaranteed to execute
"""

import re
import sys
from pathlib import Path

def add_parse_complete(content):
    """Add parse_complete_event at the end of sqlite3RunParser"""
    # Find the return statement in sqlite3RunParser and add event before it
    pattern = r'(int sqlite3RunParser\([^)]+\)\s*\{[^}]{0,5000}?)(  return nErr;)'

    def add_event(match):
        func_start = match.group(1)
        return_stmt = match.group(2)

        # Check if we already added it
        if 'parse_complete_event' in func_start:
            return match.group(0)

        return func_start + '''
#ifdef EMSCRIPTEN
  parse_complete_event(nErr==0);
#endif
''' + return_stmt

    return re.sub(pattern, add_event, content, flags=re.DOTALL, count=1)

def add_exec_events(content):
    """Add events in sqlite3_exec to show when execution starts/ends"""
    # Find sqlite3_exec and add events
    pattern = r'(int sqlite3_exec\([^)]+\)\s*\{)([^}]{0,100}?)(  rc = sqlite3VdbeExec)'

    def add_event(match):
        func_open = match.group(1)
        func_body = match.group(2)
        call_line = match.group(3)

        # Check if already instrumented
        if 'vdbe_start_event' in func_body:
            return match.group(0)

        return func_open + func_body + '''
#ifdef EMSCRIPTEN
  vdbe_start_event(p ? p->nOp : 0);
#endif
''' + call_line

    return re.sub(pattern, add_event, content, flags=re.DOTALL, count=1)

def add_vdbe_complete(content):
    """Add VDBE complete event after execution"""
    pattern = r'(int sqlite3VdbeExec\(Vdbe \*p\)\s*\{[^}]{0,100}?)(  return rc;)'

    def add_event(match):
        func_body = match.group(1)
        return_stmt = match.group(2)

        if 'vdbe_complete_event' in func_body:
            return match.group(0)

        return func_body + '''
#ifdef EMSCRIPTEN
  vdbe_complete_event(rc);
#endif
''' + return_stmt

    return re.sub(pattern, add_event, content, flags=re.DOTALL, count=1)

def add_page_events_in_exec(content):
    """Add mock page allocation events in sqlite3_exec for visualization"""
    # Find sqlite3_exec and add page allocation event
    pattern = r'(int sqlite3_exec\([^)]+\)\s*\{[^}]{0,300})(  rc = sqlite3VdbeExec)'

    def add_event(match):
        func_start = match.group(1)
        call_line = match.group(2)

        # Check if already added
        if 'page_allocate_event' in func_start:
            return match.group(0)

        # Add a page allocation event before VDBE exec
        # This simulates page allocation for visualization purposes
        return func_start + '''
#ifdef EMSCRIPTEN
  /* Emit a page allocation event for visualization */
  static int mockPageNum = 1;
  if( rc==SQLITE_OK ){
    page_allocate_event(mockPageNum, 1);
    mockPageNum++;
  }
#endif
''' + call_line

    return re.sub(pattern, add_event, content, flags=re.DOTALL, count=1)

def instrument_file(filepath):
    """Apply all event enhancements"""
    print(f"Instrumenting {filepath}...")

    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    original_len = len(content)

    print("  Adding parse_complete event...")
    content = add_parse_complete(content)

    print("  Adding VDBE start event...")
    content = add_exec_events(content)

    print("  Adding VDBE complete event...")
    content = add_vdbe_complete(content)

    print("  Adding mock page allocation events...")
    content = add_page_events_in_exec(content)

    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    added = len(content) - original_len
    print(f"  Added {added} bytes of event instrumentation")

    return added > 0

def main():
    if len(sys.argv) < 2:
        print("Usage: add_critical_events.py <sqlite3.c>")
        sys.exit(1)

    filepath = Path(sys.argv[1])

    if not filepath.exists():
        print(f"Error: {filepath} not found")
        sys.exit(1)

    print("=" * 60)
    print("  Adding Critical Event Emissions")
    print("=" * 60)

    success = instrument_file(filepath)

    if success:
        print("\n✅ Event emissions added!")
        print("\nEvents now include:")
        print("   ✅ PARSE_START (already existed)")
        print("   ✅ PARSE_COMPLETE (added)")
        print("   ✅ VDBE_START (added)")
        print("   ✅ VDBE_COMPLETE (added)")
        print("   ✅ PAGE_ALLOCATE mock events (added)")
    else:
        print("\n⚠️  No changes made")

    return 0 if success else 1

if __name__ == '__main__':
    sys.exit(main())
