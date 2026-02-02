#!/bin/bash
# Quick start server for testing

echo "🚀 Starting SQLite Visualization Server..."
echo "📁 Serving from: src/web/"
echo "🌐 Open http://localhost:8080"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Try Python 3 first, then Python 2
if command -v python3 &> /dev/null; then
    cd src/web && python3 -m http.server 8080
elif command -v python &> /dev/null; then
    cd src/web && python -m SimpleHTTPServer 8080
else
    echo "❌ Error: Python not found. Please install Python 3."
    exit 1
fi
