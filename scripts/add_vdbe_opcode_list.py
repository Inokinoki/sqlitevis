#!/usr/bin/env python3
"""
Add VDBE opcode list emission to sqlite3_step
This emits all opcodes at once for visualization (simpler than per-opcode hooks)
"""

import sys

def main():
    filepath = sys.argv[1]

    with open(filepath, 'r') as f:
        lines = f.readlines()

    modified = False
    output = []
    i = 0

    # We want to add opcode list emission after VDBE_START but before execution
    # Look for the vdbe_start_event call around line 135350

    while i < len(lines):
        line = lines[i]
        output.append(line)

        # After vdbe_start_event at line 135350 (in our instrumented version)
        # Add code to emit all opcodes in the program
        if i == 135349 and 'vdbe_start_event' in line:
            output.append('#ifdef EMSCRIPTEN\n')
            output.append('  /* Emit all opcodes for visualization */\n')
            output.append('  if (pStmt) {\n')
            output.append('    Vdbe *p = (Vdbe *)pStmt;\n')
            output.append('    int nOp = p->nOp;\n')
            output.append('    for (int i = 0; i < nOp; i++) {\n')
            output.append('      Op *pOp = &p->aOp[i];\n')
            output.append('      const char *zOp = sqlite3OpcodeName(pOp->opcode);\n')
            output.append('      vdbe_opcode_event(i, zOp, pOp->p1, pOp->p2, pOp->p3);\n')
            output.append('    }\n')
            output.append('  }\n')
            output.append('#endif\n')
            modified = True
            print(f"Added VDBE opcode list emission at line {i+1}")

        i += 1

    if modified:
        with open(filepath, 'w') as f:
            f.writelines(output)
        print("Successfully added VDBE opcode list emission")
        return 0
    else:
        print("No modifications made - target line not found")
        return 1

if __name__ == '__main__':
    sys.exit(main())
