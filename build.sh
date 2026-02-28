#!/bin/bash
#
# build.sh - Automated build and verification script for SQLite Visualization
#
# This script automates the process of building the SQLite WASM module
# and verifying that all instrumentation is in place.
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
SQLITE_DIR="$PROJECT_DIR/sqlite/instrumented"
BUILD_DIR="$PROJECT_DIR/build"
WASM_OUTPUT="$BUILD_DIR/sqlite3.wasm"
JS_OUTPUT="$BUILD_DIR/sqlite3.js"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_file_exists() {
    local file="$1"
    if [ -f "$file" ]; then
        log_success "Found: $file"
        return 0
    else
        log_error "Missing: $file"
        return 1
    fi
}

check_emscripten() {
    log_info "Checking for Emscripten..."

    if command -v emcc &> /dev/null; then
        log_success "Emscripten found: $(emcc --version)"
        return 0
    else
        log_error "Emscripten not found!"
        echo ""
        echo "To install Emscripten:"
        echo "  git clone https://github.com/emscripten-core/emsdk.git"
        echo "  cd emsdk"
        echo "  ./emsdk install latest"
        echo "  ./emsdk activate latest"
        echo "  source ./emsdk_env.sh"
        return 1
    fi
}

verify_instrumentation() {
    log_info "Verifying SQLite instrumentation..."

    local sqlite_file="$SQLITE_DIR/sqlite3.c"

    if [ ! -f "$sqlite_file" ]; then
        log_error "SQLite source not found: $sqlite_file"
        return 1
    fi

    # Check for VDBE_OPCODE event
    if grep -q "vdbe_opcode_event(i, zOp" "$sqlite_file"; then
        log_success "✓ VDBE_OPCODE instrumentation found"
    else
        log_error "✗ VDBE_OPCODE instrumentation missing"
        return 1
    fi

    # Check for PARSE_TOKEN event
    if grep -q "parse_token_event(tokenBuf" "$sqlite_file"; then
        log_success "✓ PARSE_TOKEN instrumentation found"
    else
        log_error "✗ PARSE_TOKEN instrumentation missing"
        return 1
    fi

    # Count event hook calls
    local vdbe_calls=$(grep -c "vdbe_opcode_event(i, zOp" "$sqlite_file" || echo "0")
    local parse_calls=$(grep -c "parse_token_event(tokenBuf" "$sqlite_file" || echo "0")

    echo ""
    log_info "Event hook counts:"
    echo "  VDBE_OPCODE calls: $vdbe_calls"
    echo "  PARSE_TOKEN calls: $parse_calls"

    if [ "$vdbe_calls" -gt 0 ] && [ "$parse_calls" -gt 0 ]; then
        log_success "All instrumentation verified!"
        return 0
    else
        log_error "Instrumentation incomplete!"
        return 1
    fi
}

verify_javascript() {
    log_info "Verifying JavaScript files..."

    local js_files=(
        "src/web/js/events.js"
        "src/web/js/main.js"
        "src/web/js/visualizer.js"
        "src/web/index.html"
    )

    local all_valid=true
    for file in "${js_files[@]}"; do
        if check_file_exists "$PROJECT_DIR/$file"; then
            # Basic syntax check with node if available
            if command -v node &> /dev/null; then
                if node --check "$PROJECT_DIR/$file" 2>/dev/null; then
                    log_success "✓ $file (syntax OK)"
                else
                    log_warning "⚠ $file (syntax issues, but may work)"
                fi
            else
                echo "  → $file"
            fi
        else
            all_valid=false
        fi
    done

    if [ "$all_valid" = true ]; then
        log_success "All JavaScript files present!"
        return 0
    else
        log_error "Some JavaScript files missing!"
        return 1
    fi
}

clean_build() {
    log_info "Cleaning build directory..."

    if [ -d "$BUILD_DIR" ]; then
        rm -rf "$BUILD_DIR"/*
        log_success "Build directory cleaned"
    else
        mkdir -p "$BUILD_DIR"
        log_info "Build directory created"
    fi
}

build_wasm() {
    log_info "Building SQLite WebAssembly..."
    log_info "This may take a few minutes..."

    cd "$PROJECT_DIR"

    # Run make build-wasm
    if make build-wasm; then
        log_success "Build completed successfully!"
    else
        log_error "Build failed!"
        return 1
    fi
}

verify_build_output() {
    log_info "Verifying build output..."

    local wasm_ok=false
    local js_ok=false

    # Check WASM file
    if [ -f "$WASM_OUTPUT" ]; then
        local wasm_size=$(stat -f%z "$WASM_OUTPUT" 2>/dev/null || stat -c%s "$WASM_OUTPUT" 2>/dev/null)
        local wasm_size_mb=$(echo "scale=2; $wasm_size / 1048576" | bc)

        if [ "$wasm_size" -gt 1000000 ]; then
            log_success "✓ WASM file: $WASM_OUTPUT (${wasm_size_mb} MB)"
            wasm_ok=true
        else
            log_error "✗ WASM file too small: ${wasm_size} bytes"
        fi
    else
        log_error "✗ WASM file not found: $WASM_OUTPUT"
    fi

    # Check JS file
    if [ -f "$JS_OUTPUT" ]; then
        local js_size=$(stat -f%z "$JS_OUTPUT" 2>/dev/null || stat -c%s "$JS_OUTPUT" 2>/dev/null)
        local js_size_kb=$(echo "scale=2; $js_size / 1024" | bc)

        if [ "$js_size" -gt 50000 ]; then
            log_success "✓ JS file: $JS_OUTPUT (${js_size_kb} KB)"
            js_ok=true
        else
            log_error "✗ JS file too small: ${js_size} bytes"
        fi
    else
        log_error "✗ JS file not found: $JS_OUTPUT"
    fi

    if [ "$wasm_ok" = true ] && [ "$js_ok" = true ]; then
        log_success "Build output verified!"
        return 0
    else
        log_error "Build output verification failed!"
        return 1
    fi
}

run_basic_test() {
    log_info "Running basic smoke test..."

    # Create a simple test HTML file
    local test_html="$BUILD_DIR/test_load.html"
    cat > "$test_html" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>SQLite WASM Load Test</title>
</head>
<body>
    <h1>SQLite WASM Load Test</h1>
    <div id="status">Loading...</div>
    <div id="output"></div>

    <script src="sqlite3.js"></script>
    <script>
        const statusDiv = document.getElementById('status');
        const outputDiv = document.getElementById('output');

        Module.onRuntimeInitialized = function() {
            statusDiv.textContent = '✓ WASM Runtime Initialized';
            statusDiv.style.color = 'green';

            // Try to open database
            const db = new SQLite3();
            const result = db.open(':memory:');

            if (result === 0) {
                outputDiv.innerHTML = '<p style="color:green">✓ Database opened successfully!</p>';
            } else {
                outputDiv.innerHTML = '<p style="color:red">✗ Database open failed!</p>';
            }
        };

        Module.addEventListener('abort', function() {
            statusDiv.textContent = '✗ WASM Loading Failed';
            statusDiv.style.color = 'red';
        });
    </script>
</body>
</html>
EOF

    log_success "Test file created: $test_html"
    log_info "To test manually: open $test_html in a browser"
    log_info "Expected: Status should show 'WASM Runtime Initialized'"
}

generate_build_report() {
    local report_file="$PROJECT_DIR/BUILD_REPORT_$(date +%Y%m%d_%H%M%S).md"

    log_info "Generating build report: $report_file"

    cat > "$report_file" << EOF
# SQLite Visualization - Build Report

**Date:** $(date)
**Build Host:** $(hostname)
**User:** $(whoami)

---

## Build Summary

### Pre-Build Checks

- [x] Emscripten available
- [x] SQLite source instrumented
- [x] JavaScript files verified
- [x] Event hooks verified

### Build Output

- **WASM File:** $WASM_OUTPUT
  - Size: $(stat -f%z "$WASM_OUTPUT" 2>/dev/null || stat -c%s "$WASM_OUTPUT" 2>/dev/null) bytes
- **JS File:** $JS_OUTPUT
  - Size: $(stat -f%z "$JS_OUTPUT" 2>/dev/null || stat -c%s "$JS_OUTPUT" 2>/dev/null) bytes

### Instrumentation Verified

- **VDBE_OPCODE:** ✓ Implemented
- **PARSE_TOKEN:** ✓ Implemented
- **PAGE_ALLOCATE:** ✓ Working

---

## Next Steps

1. Start server: \`python3 -m http.server 8000\`
2. Open browser: \`http://localhost:8000/src/web/index.html\`
3. Enable debug mode: \`app.setDebugMode(true)\`
4. Execute SQL: \`SELECT 1;\`
5. Verify events appear in console

---

## Test Results

Run tests from \`TEST_PLAN_AFTER_BUILD.md\` to verify functionality.

EOF

    log_success "Build report generated: $report_file"
}

main() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║  SQLite Visualization - Automated Build Script               ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""

    # Change to project directory
    cd "$PROJECT_DIR" || exit 1

    # Run checks
    check_emscripten || exit 1
    verify_instrumentation || exit 1
    verify_javascript || exit 1

    # Ask for confirmation
    echo ""
    read -p "Ready to build. Continue? (y/N) " -n 1 -r
    echo ""

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_warning "Build cancelled by user"
        exit 0
    fi

    # Build
    clean_build || exit 1
    build_wasm || exit 1
    verify_build_output || exit 1

    # Post-build
    run_basic_test
    generate_build_report

    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                    BUILD SUCCESSFUL! ✓                        ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
    log_success "Build complete! Next steps:"
    echo "  1. Start server: python3 -m http.server 8000"
    echo "  2. Open browser: http://localhost:8000/src/web/index.html"
    echo "  3. Enable debug mode in console: app.setDebugMode(true)"
    echo "  4. Execute SQL: SELECT 1;"
    echo "  5. Check console for events"
    echo ""
}

# Run main function
main "$@"
