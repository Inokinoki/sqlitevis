/*
 * SQLite WebAssembly Bridge with Event Instrumentation
 * This file provides the glue code between SQLite and JavaScript
 * and implements event emission for visualization
 */

#include <emscripten.h>
#include <stdio.h>
#include <string.h>
#include <stdarg.h>

// Event types for visualization
typedef enum {
    EVENT_BTREE_OPEN,
    EVENT_BTREE_CLOSE,
    EVENT_BTREE_INSERT,
    EVENT_BTREE_DELETE,
    EVENT_BTREE_SPLIT,
    EVENT_BTREE_BALANCE,
    EVENT_PAGE_ALLOCATE,
    EVENT_PAGE_FREE,
    EVENT_PARSE_START,
    EVENT_PARSE_TOKEN,
    EVENT_PARSE_COMPLETE,
    EVENT_VDBE_START,
    EVENT_VDBE_OPCODE,
    EVENT_VDBE_COMPLETE
} EventType;

// JavaScript callback for events (imported from JS)
EM_JS(void, js_emit_event, (int event_type, const char* data), {
    if (window.sqliteVisEventHandler) {
        const eventData = UTF8ToString(data);
        window.sqliteVisEventHandler(event_type, eventData);
    }
});

// Emit a visualization event
void emit_vis_event(EventType type, const char* format, ...) {
    char buffer[1024];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);

    js_emit_event(type, buffer);
}

// B-Tree event hooks
EMSCRIPTEN_KEEPALIVE
void btree_open_event(int page_size, int num_pages) {
    emit_vis_event(EVENT_BTREE_OPEN,
        "{\"pageSize\":%d,\"numPages\":%d}",
        page_size, num_pages);
}

EMSCRIPTEN_KEEPALIVE
void btree_insert_event(int page_num, int cell_idx, const char* key, int key_len) {
    emit_vis_event(EVENT_BTREE_INSERT,
        "{\"page\":%d,\"cell\":%d,\"keyLen\":%d}",
        page_num, cell_idx, key_len);
}

EMSCRIPTEN_KEEPALIVE
void btree_delete_event(int page_num, int cell_idx) {
    emit_vis_event(EVENT_BTREE_DELETE,
        "{\"page\":%d,\"cell\":%d}",
        page_num, cell_idx);
}

EMSCRIPTEN_KEEPALIVE
void btree_split_event(int original_page, int new_page, int split_cell) {
    emit_vis_event(EVENT_BTREE_SPLIT,
        "{\"originalPage\":%d,\"newPage\":%d,\"splitCell\":%d}",
        original_page, new_page, split_cell);
}

EMSCRIPTEN_KEEPALIVE
void btree_balance_event(int page_num, int num_cells) {
    emit_vis_event(EVENT_BTREE_BALANCE,
        "{\"page\":%d,\"numCells\":%d}",
        page_num, num_cells);
}

EMSCRIPTEN_KEEPALIVE
void page_allocate_event(int page_num, int page_type) {
    emit_vis_event(EVENT_PAGE_ALLOCATE,
        "{\"page\":%d,\"type\":%d}",
        page_num, page_type);
}

EMSCRIPTEN_KEEPALIVE
void page_free_event(int page_num) {
    emit_vis_event(EVENT_PAGE_FREE,
        "{\"page\":%d}",
        page_num);
}

// Parse event hooks
EMSCRIPTEN_KEEPALIVE
void parse_start_event(const char* sql) {
    char escaped_sql[512];
    int i, j = 0;

    // Simple JSON string escape
    for (i = 0; sql[i] && j < sizeof(escaped_sql) - 2; i++) {
        if (sql[i] == '"' || sql[i] == '\\') {
            escaped_sql[j++] = '\\';
        }
        escaped_sql[j++] = sql[i];
    }
    escaped_sql[j] = '\0';

    emit_vis_event(EVENT_PARSE_START,
        "{\"sql\":\"%s\"}",
        escaped_sql);
}

EMSCRIPTEN_KEEPALIVE
void parse_token_event(const char* token, int token_type) {
    emit_vis_event(EVENT_PARSE_TOKEN,
        "{\"token\":\"%s\",\"type\":%d}",
        token, token_type);
}

EMSCRIPTEN_KEEPALIVE
void parse_complete_event(int success) {
    emit_vis_event(EVENT_PARSE_COMPLETE,
        "{\"success\":%d}",
        success);
}

// VDBE (Virtual Database Engine) event hooks
EMSCRIPTEN_KEEPALIVE
void vdbe_start_event(int num_opcodes) {
    emit_vis_event(EVENT_VDBE_START,
        "{\"numOpcodes\":%d}",
        num_opcodes);
}

EMSCRIPTEN_KEEPALIVE
void vdbe_opcode_event(int pc, const char* opcode, int p1, int p2, int p3) {
    emit_vis_event(EVENT_VDBE_OPCODE,
        "{\"pc\":%d,\"opcode\":\"%s\",\"p1\":%d,\"p2\":%d,\"p3\":%d}",
        pc, opcode, p1, p2, p3);
}

EMSCRIPTEN_KEEPALIVE
void vdbe_complete_event(int result_code) {
    emit_vis_event(EVENT_VDBE_COMPLETE,
        "{\"resultCode\":%d}",
        result_code);
}

// Helper function to enable/disable event emission
static int events_enabled = 1;

EMSCRIPTEN_KEEPALIVE
void set_events_enabled(int enabled) {
    events_enabled = enabled;
}

EMSCRIPTEN_KEEPALIVE
int get_events_enabled() {
    return events_enabled;
}
