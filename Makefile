.PHONY: all clean download-sqlite instrument build-wasm serve setup

# Configuration
SQLITE_VERSION = 3450000
SQLITE_YEAR = 2024
SQLITE_URL = https://www.sqlite.org/$(SQLITE_YEAR)/sqlite-amalgamation-$(SQLITE_VERSION).zip
EMCC = emcc

# Directories
SQLITE_DIR = sqlite
SQLITE_ORIGINAL = $(SQLITE_DIR)/original
SQLITE_INSTRUMENTED = $(SQLITE_DIR)/instrumented
SRC_DIR = src
BUILD_DIR = build
WASM_DIR = $(SRC_DIR)/wasm
INSTRUMENT_DIR = $(SRC_DIR)/instrumentation

# Output files
WASM_OUTPUT = $(BUILD_DIR)/sqlite3.wasm
JS_OUTPUT = $(BUILD_DIR)/sqlite3.js

# Emscripten flags
EMCC_FLAGS = \
	-O2 \
	-s WASM=1 \
	-s EXPORTED_FUNCTIONS='["_sqlite3_open","_sqlite3_close","_sqlite3_exec","_sqlite3_prepare_v2","_sqlite3_step","_sqlite3_finalize","_sqlite3_column_text","_sqlite3_errmsg","_malloc","_free"]' \
	-s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","UTF8ToString","stringToUTF8","lengthBytesUTF8"]' \
	-s ALLOW_MEMORY_GROWTH=1 \
	-s MODULARIZE=1 \
	-s EXPORT_NAME='createSQLiteModule' \
	-s ENVIRONMENT='web' \
	-s INVOKE_RUN=0 \
	-I$(SQLITE_INSTRUMENTED) \
	-DSQLITE_OMIT_LOAD_EXTENSION \
	-DSQLITE_ENABLE_FTS5 \
	-DSQLITE_ENABLE_RTREE \
	-DSQLITE_THREADSAFE=0 \
	-DEMSCRIPTEN

all: build-wasm

setup:
	@mkdir -p $(SQLITE_DIR) $(SQLITE_ORIGINAL) $(SQLITE_INSTRUMENTED) $(BUILD_DIR) $(WASM_DIR) $(INSTRUMENT_DIR)
	@echo "Project structure created"

download-sqlite: setup
	@echo "Downloading SQLite $(SQLITE_VERSION)..."
	@cd $(SQLITE_ORIGINAL) && \
	if [ ! -f sqlite3.c ]; then \
		curl -O $(SQLITE_URL) && \
		unzip -o sqlite-amalgamation-$(SQLITE_VERSION).zip && \
		mv sqlite-amalgamation-$(SQLITE_VERSION)/* . && \
		rm -rf sqlite-amalgamation-$(SQLITE_VERSION) sqlite-amalgamation-$(SQLITE_VERSION).zip; \
	fi
	@echo "SQLite source downloaded"

instrument: download-sqlite
	@echo "Copying SQLite source for instrumentation..."
	@cp -r $(SQLITE_ORIGINAL)/* $(SQLITE_INSTRUMENTED)/
	@echo "Applying instrumentation patches..."
	@python3 scripts/instrument_sqlite.py $(SQLITE_INSTRUMENTED)/sqlite3.c
	@echo "Instrumentation complete"

build-wasm: instrument
	@echo "Compiling SQLite to WebAssembly..."
	@mkdir -p $(BUILD_DIR)
	$(EMCC) $(EMCC_FLAGS) \
		$(SQLITE_INSTRUMENTED)/sqlite3.c \
		$(WASM_DIR)/sqlite_bridge.c \
		-o $(JS_OUTPUT)
	@echo "Build complete: $(WASM_OUTPUT)"
	@echo "JavaScript glue: $(JS_OUTPUT)"

serve:
	@echo "Starting development server on http://localhost:8000"
	@python3 -m http.server 8000

clean:
	@rm -rf $(BUILD_DIR)/*
	@echo "Build directory cleaned"

clean-all: clean
	@rm -rf $(SQLITE_DIR) $(BUILD_DIR)
	@echo "All generated files removed"

help:
	@echo "SQLite WebAssembly Build System"
	@echo ""
	@echo "Targets:"
	@echo "  make setup          - Create project directories"
	@echo "  make download-sqlite - Download SQLite source"
	@echo "  make instrument     - Apply instrumentation to SQLite"
	@echo "  make build-wasm     - Compile to WebAssembly"
	@echo "  make serve          - Run development server"
	@echo "  make clean          - Clean build files"
	@echo "  make clean-all      - Remove all generated files"
	@echo "  make help           - Show this help"
