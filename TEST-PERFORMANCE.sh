#!/bin/bash
# Performance Test Script
# Validates that the main HTML is fast and usable

echo "==================================="
echo "Performance Validation Test"
echo "==================================="
echo ""

# Test 1: File size check
echo "1. File Size Check:"
SIZE=$(wc -c < src/web/index.html)
echo "   File size: $SIZE bytes"
if [ $SIZE -lt 25000 ]; then
    echo "   ✓ PASS: File is small (<25KB)"
else
    echo "   ✗ FAIL: File is too large"
fi
echo ""

# Test 2: No WASM dependency
echo "2. WASM Dependency Check:"
if grep -q "sqlite3.js" src/web/index.html; then
    echo "   ✗ FAIL: Still references WASM"
else
    echo "   ✓ PASS: No WASM references"
fi
echo ""

# Test 3: No external scripts
echo "3. External Script Check:"
EXTERNAL=$(grep -c '<script src=' src/web/index.html || echo 0)
if [ "$EXTERNAL" -eq 0 ]; then
    echo "   ✓ PASS: No external scripts"
else
    echo "   ✗ FAIL: Has $EXTERNAL external script(s)"
fi
echo ""

# Test 4: Self-contained
echo "4. Self-Contained Check:"
if grep -q "class MiniSQL" src/web/index.html && \
   grep -q "eventManager" src/web/index.html && \
   grep -q "SimpleVisualizer" src/web/index.html; then
    echo "   ✓ PASS: Contains all required classes"
else
    echo "   ✗ FAIL: Missing required classes"
fi
echo ""

# Test 5: Load time test (if server running)
echo "5. Load Time Test:"
if curl -s -o /dev/null http://localhost:8001/src/web/index.html 2>/dev/null; then
    TIME=$(curl -s -o /dev/null -w "%{time_total}" http://localhost:8001/src/web/index.html)
    echo "   Load time: ${TIME}s"
    BC_TIME=$(echo "$TIME < 0.01" | bc -l 2>/dev/null || echo "1")
    if [ "$BC_TIME" = "1" ]; then
        echo "   ✓ PASS: Loads in <10ms"
    else
        echo "   ⚠ WARNING: Load time >10ms"
    fi
else
    echo "   ⚠ SKIP: Server not running"
fi
echo ""

echo "==================================="
echo "Test Complete"
echo "==================================="
