# SQLiteVis Code Analysis - Iteration 1

## Overview
Analyzing the visualization system for VDBE events, SQL parsing, and page node events.

## 1. VDBE Events and Visualization

### Current Implementation
- Event handlers in `main.js` lines 200-213
- Visualization in `visualizer.js` lines 763-829

### Issues Found

#### Issue 1: VDBE Opcode Visualization Doesn't Persist
**File:** `src/web/js/visualizer.js` line 813-829
**Problem:** `drawVdbeOpcode()` only draws the current opcode without clearing or managing previous opcodes. Each new opcode overwrites the previous one without maintaining a list.

**Current Code:**
```javascript
drawVdbeOpcode(pc, opcode, p1, p2, p3) {
    const rect = this.canvas.getBoundingClientRect();
    const y = 100 + pc * 25;

    // Highlight current instruction
    this.ctx.fillStyle = this.colors.nodeHighlight;
    this.ctx.fillRect(50, y, 400, 22);

    this.ctx.fillStyle = 'white';
    this.ctx.font = '12px monospace';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(
        `[${pc}] ${opcode.padEnd(12)} P1=${p1} P2=${p2} P3=${p3}`,
        60,
        y + 15
    );
}
```

**Problem:** This function doesn't clear the canvas or redraw previous opcodes. Only the current instruction is drawn, and it doesn't maintain state for all opcodes.

**Fix Needed:** Store all opcodes and redraw the entire list with current one highlighted.

#### Issue 2: Missing Canvas Clear Before Drawing Opcodes
The VDBE visualization should clear and redraw the background before adding new opcodes, similar to how `drawVdbeState()` and `drawParseTree()` work.

## 2. SQL Parsing and Visualization

### Current Implementation
- Event handlers in `main.js` lines 184-197
- Visualization in `visualizer.js` lines 536-761

### Issues Found

#### Issue 3: Token Type Display
The `showParseToken()` function receives token types as numeric codes from SQLite's C code (TK_SELECT, TK_FROM, etc.) but may not properly map them to readable names.

**File:** `src/web/js/visualizer.js` lines 549-555
```javascript
showParseToken(token, type) {
    if (this.viewMode !== 'parse') return;

    // Add token to list
    this.parseTokens.push({ token, type });
    this.drawParseTree(false);
}
```

The `type` parameter comes from SQLite's tokenizer and is numeric. It needs to be mapped to readable names for display.

#### Issue 4: Draw Parse Tokens Doesn't Handle Overflow
**File:** `src/web/js/visualizer.js` lines 727-761
**Problem:** If there are many tokens, they will overflow the canvas area. There's no scrolling or pagination.

## 3. Page Node Events and Visualization

### Current Implementation
- Event handlers in `main.js` lines 137-181
- Visualization in `visualizer.js` lines 129-208

### Issues Found

#### Issue 5: No Parent-Child Link Management
**File:** `src/web/js/visualizer.js` lines 129-144
**Problem:** `addPage()` creates a page with empty `children` array but doesn't establish parent-child relationships. When a page is allocated, we need to know which page is its parent.

**Current Code:**
```javascript
addPage(pageNum, pageType) {
    const node = {
        page: pageNum,
        type: pageType, // 0: interior, 1: leaf
        cells: [],
        parent: null,
        children: [],
        x: 0,
        y: 0,
        expanded: true
    };

    this.nodes.set(pageNum, node);
    this.layout();
    this.draw();
}
```

**Problem:** The `parent` is always null. There's no mechanism to link child pages to parent pages when they're allocated.

**Fix Needed:** Need to track page hierarchy. When a new page is allocated in response to a split, the parent should be tracked.

#### Issue 6: B-Tree Split Doesn't Create Parent Links
**File:** `src/web/js/visualizer.js` lines 189-208
**Problem:** When a page splits, the new page is created but not linked to the original as a child or sibling.

```javascript
splitPage(originalPage, newPage, splitCell) {
    const original = this.nodes.get(originalPage);
    if (!original) return;

    // Create new page
    this.addPage(newPage, original.type);
    const newNode = this.nodes.get(newPage);

    // Move cells
    const cellsToMove = original.cells.splice(splitCell);
    newNode.cells = cellsToMove;

    // Animation
    if (this.showTransitions) {
        this.animateSplit(originalPage, newPage, splitCell);
    }

    this.layout();
    this.draw();
}
```

**Problem:** No parent-child relationship is established between the original page and new page.

## Summary of Critical Issues

| # | Component | Issue | Severity |
|---|-----------|-------|----------|
| 1 | VDBE | Opcode visualization doesn't persist all opcodes | HIGH |
| 2 | VDBE | No canvas clear/redraw for opcode display | HIGH |
| 3 | Parse | Token type mapping from numeric to readable names | MEDIUM |
| 4 | Parse | Token list overflow on canvas | LOW |
| 5 | B-Tree | No parent-child page hierarchy | HIGH |
| 6 | B-Tree | Split doesn't establish page relationships | HIGH |

## Next Steps

1. Fix VDBE opcode visualization to store and display all opcodes
2. Add token type name mapping for parse tree
3. Implement parent-child page tracking for B-tree
4. Test all three visualization modes with real SQLite events
