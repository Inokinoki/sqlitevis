#!/usr/bin/env python3
"""
Add event emissions to sqlite3_exec implementation
"""

import sys

def main():
    filepath = sys.argv[1]

    with open(filepath, 'r') as f:
        lines = f.readlines()

    # Find sqlite3_exec implementation (line 135306)
    # Add vdbe_start_event after sqlite3_prepare_v2
    # Add vdbe_complete_event and page_allocate before return

    modified = False
    output = []
    i = 0

    while i < len(lines):
        line = lines[i]
        output.append(line)

        # After sqlite3_prepare_v2 at around line 135329
        if i == 135328 and 'rc = sqlite3_prepare_v2' in line:
            output.append('#ifdef EMSCRIPTEN\n')
            output.append('  vdbe_start_event(pStmt ? ((Vdbe *)pStmt)->nOp : 0);\n')
            output.append('#endif\n')
            modified = True
            print(f"Added vdbe_start_event at line {i+1}")

        # Before the return at the end (around line 135417-135418)
        if i == 135417 and 'return rc;' in line:
            output.append('#ifdef EMSCRIPTEN\n')
            output.append('  vdbe_complete_event(rc);\n')
            output.append('  /* Mock page allocation for visualization */\n')
            output.append('  static int visPageNum = 1;\n')
            output.append('  page_allocate_event(visPageNum++, 1);\n')
            output.append('#endif\n')
            modified = True
            print(f"Added vdbe_complete_event and page_allocate at line {i+1}")

        i += 1

    if modified:
        with open(filepath, 'w') as f:
            f.writelines(output)
        print("Successfully added events to sqlite3_exec")
        return 0
    else:
        print("No modifications made - lines not found")
        return 1

if __name__ == '__main__':
    sys.exit(main())
