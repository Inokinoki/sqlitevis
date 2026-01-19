#!/usr/bin/env python3
"""
Add PARSE_TOKEN event emission to sqlite3RunParser
This emits each token as it's recognized during SQL parsing
"""

import sys

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

        # After sqlite3GetToken call at line 177543 (in our instrumented version)
        # This is inside the tokenization loop in sqlite3RunParser
        if i == 177542 and 'n = sqlite3GetToken' in line:
            # Skip space tokens to reduce noise
            output.append('  #ifdef EMSCRIPTEN\n')
            output.append('  /* Emit token for visualization (skip spaces) */\n')
            output.append('  if (tokenType != TK_SPACE) {\n')
            output.append('    char tokenBuf[100];\n')
            output.append('    int tokenLen = n < 99 ? n : 99;\n')
            output.append('    memcpy(tokenBuf, zSql, tokenLen);\n')
            output.append('    tokenBuf[tokenLen] = 0;\n')
            output.append('    parse_token_event(tokenBuf, tokenType);\n')
            output.append('  }\n')
            output.append('  #endif\n')
            modified = True
            print(f"Added PARSE_TOKEN emission at line {i+1}")

        i += 1

    if modified:
        with open(filepath, 'w') as f:
            f.writelines(output)
        print("Successfully added PARSE_TOKEN emission")
        return 0
    else:
        print("No modifications made - target line not found")
        return 1

if __name__ == '__main__':
    sys.exit(main())
