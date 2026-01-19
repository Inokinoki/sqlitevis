#!/usr/bin/env python3
"""
Add missing event emissions to SQLite source code
"""
import sys
import re

def main():
    filepath = sys.argv[1]

    with open(filepath, 'r') as f:
        lines = f.readlines()

    modified = False
    output = []
    i = 0

    while i < len(lines):
        line = lines[i]
        output.append(line)

        # Add vdbe_start_event after sqlite3_prepare_v2 in sqlite3_exec
        # Pattern: rc = sqlite3_prepare_v2(...)
        if 'rc = sqlite3_prepare_v2' in line and 'sqlite3_exec' in ''.join(lines[max(0, i-20):i]):
            # Check if next lines have the assert
            if i + 1 < len(lines) and 'assert( rc==SQLITE_OK' in lines[i + 1]:
                # Check if vdbe_start_event is not already added
                if i + 2 < len(lines) and 'vdbe_start_event' not in lines[i + 2]:
                    output.append('#ifdef EMSCRIPTEN\n')
                    output.append('  vdbe_start_event(pStmt ? ((Vdbe *)pStmt)->nOp : 0);\n')
                    output.append('#endif\n')
                    modified = True
                    print(f"Added vdbe_start_event at line {i+1}")

        # Add vdbe_complete_event and page_allocate_event before return in sqlite3_exec
        # Pattern: "assert( (rc&db->errMask)==rc );"
        if 'assert( (rc&db->errMask)==rc );' in line:
            # Check if this is in sqlite3_exec context
            context = ''.join(lines[max(0, i-5):i])
            if 'sqlite3_exec' in context or 'sqlite3LockAndPrepare' in ''.join(lines[max(0, i-100):i]):
                # Look ahead for the return
                for j in range(i, min(i + 10, len(lines))):
                    if 'return rc;' in lines[j] and 'vdbe_complete_event' not in ''.join(lines[i:j]):
                        # Add events before the return
                        # We need to insert before the return, not after the assert
                        # So we'll add them when we see "sqlite3_mutex_leave"
                        pass

        # Check for sqlite3_mutex_leave followed by return
        if 'sqlite3_mutex_leave(db->mutex);' in line:
            # Look ahead for return
            for j in range(i+1, min(i + 5, len(lines))):
                if 'return rc;' in lines[j]:
                    # Check if events are not already added
                    if 'vdbe_complete_event' not in ''.join(lines[i+1:j]):
                        # Add events before return
                        output.append('#ifdef EMSCRIPTEN\n')
                        output.append('  vdbe_complete_event(rc);\n')
                        output.append('  /* Mock page allocation for visualization */\n')
                        output.append('  static int visPageNum = 1;\n')
                        output.append('  page_allocate_event(visPageNum++, 1);\n')
                        output.append('#endif\n')
                        modified = True
                        print(f"Added vdbe_complete_event and page_allocate_event before return at line {j+1}")
                    break

        i += 1

    if modified:
        with open(filepath, 'w') as f:
            f.writelines(output)
        print("Successfully added missing events")
        return 0
    else:
        print("No modifications made - events may already be present")
        return 0

if __name__ == '__main__':
    sys.exit(main())
