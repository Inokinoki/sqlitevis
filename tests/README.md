# Testing SQLite B-Tree Visualization

This directory contains Playwright end-to-end tests for the SQLite B-Tree Visualization application.

## Test Coverage

The test suite covers:

### Core Functionality
- WASM module loading and initialization
- SQL execution (CREATE, INSERT, SELECT, DELETE)
- Event emission and logging
- Error handling

### Visualization
- Canvas rendering
- View mode switching (B-Tree, Parse Tree, VDBE)
- Animation controls
- Page count updates

### User Interface
- SQL editor interaction
- Button functionality
- Event log management
- Status updates

### Event System
- All 13 event types:
  - B-Tree operations (OPEN, CLOSE, INSERT, DELETE, SPLIT, BALANCE)
  - Page management (ALLOCATE, FREE)
  - Parser events (START, TOKEN, COMPLETE)
  - VDBE execution (START, OPCODE, COMPLETE)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browsers:
```bash
npm run install:playwright
```

3. Build the WASM module:
```bash
npm run build
# or
make build-wasm
```

## Running Tests

### Run all tests:
```bash
npm test
```

### Run tests in headed mode (see browser):
```bash
npm run test:headed
```

### Debug tests:
```bash
npm run test:debug
```

### Run tests with UI:
```bash
npm run test:ui
```

### View test report:
```bash
npm run test:report
```

## Test Configuration

Tests are configured in `playwright.config.js`:
- Runs on Chromium, Firefox, and WebKit
- Starts development server automatically
- Takes screenshots on failure
- Generates HTML report

## Writing New Tests

Create a new test file in `tests/` directory:

```javascript
const { test, expect } = require('@playwright/test');

test.describe('My Feature', () => {
  test('should do something', async ({ page }) => {
    await page.goto('http://localhost:8000/src/web/index.html');
    await page.waitForSelector('#db-status');

    // Your test code here
  });
});
```

## CI/CD Integration

Tests can be run in CI environments:
```bash
npm test
```

The test configuration automatically adapts to CI environments by:
- Using 1 worker instead of parallel execution
- Retrying failed tests
- Disabling only-mode tests
