#!/bin/bash
# SQLiteVis Setup Script

set -e

echo "========================================="
echo "  SQLiteVis Setup"
echo "========================================="
echo ""

# Check for required tools
echo "Checking prerequisites..."

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not found"
    echo "   Please install Python 3 and try again"
    exit 1
fi
echo "✅ Python 3 found"

# Check for Make
if ! command -v make &> /dev/null; then
    echo "❌ Make is required but not found"
    echo "   Please install Make and try again"
    exit 1
fi
echo "✅ Make found"

# Check for curl or wget
if command -v curl &> /dev/null; then
    DOWNLOAD_CMD="curl -O"
    echo "✅ curl found"
elif command -v wget &> /dev/null; then
    DOWNLOAD_CMD="wget"
    echo "✅ wget found"
else
    echo "❌ curl or wget is required but not found"
    echo "   Please install curl or wget and try again"
    exit 1
fi

# Check for Emscripten (optional for mock mode)
if command -v emcc &> /dev/null; then
    echo "✅ Emscripten found - Full WASM build available"
    EMSCRIPTEN_AVAILABLE=1
else
    echo "⚠️  Emscripten not found - Only mock mode available"
    echo "   To enable full WASM build, install Emscripten:"
    echo "   https://emscripten.org/docs/getting_started/downloads.html"
    EMSCRIPTEN_AVAILABLE=0
fi

echo ""
echo "Setting up project structure..."
make setup

echo ""
echo "========================================="
echo "  Setup Complete!"
echo "========================================="
echo ""

if [ $EMSCRIPTEN_AVAILABLE -eq 1 ]; then
    echo "Next steps:"
    echo "  1. Download SQLite:  make download-sqlite"
    echo "  2. Build WASM:       make build-wasm"
    echo "  3. Start server:     make serve"
else
    echo "Next steps (Mock Mode):"
    echo "  1. Start server:     make serve"
    echo "  2. Open http://localhost:8000 in browser"
    echo ""
    echo "For full functionality:"
    echo "  1. Install Emscripten SDK"
    echo "  2. Run: make download-sqlite && make build-wasm"
fi

echo ""
echo "For help: make help"
echo "========================================="
