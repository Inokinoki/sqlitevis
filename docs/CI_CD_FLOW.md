# CI/CD Flow Diagram

This document visualizes the complete CI/CD pipeline for SQLiteVis deployment to GitHub Pages.

## Overview

```
Developer → Git Push → GitHub Actions → Build → Deploy → Live Site
```

## Detailed Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Developer Workflow                       │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 │ git push origin main
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                          GitHub Repository                      │
│  • Code updated on main/master branch                           │
│  • Workflow trigger activated                                   │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 │ Workflow starts
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                       GitHub Actions Runner                     │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Step 1: Checkout Repository                               │ │
│  │  • actions/checkout@v4                                    │ │
│  │  • Clone repository code                                  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                 │                               │
│                                 ▼                               │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Step 2: Setup Emscripten                                  │ │
│  │  • mymindstorm/setup-emsdk@v14                           │ │
│  │  • Install Emscripten 3.1.50                             │ │
│  │  • Configure environment                                  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                 │                               │
│                                 ▼                               │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Step 3: Create Project Structure                          │ │
│  │  • make setup                                             │ │
│  │  • Create directories                                     │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                 │                               │
│                                 ▼                               │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Step 4: Download SQLite                                   │ │
│  │  • make download-sqlite                                   │ │
│  │  • Fetch SQLite 3.45.0 amalgamation                      │ │
│  │  • Extract source files                                   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                 │                               │
│                                 ▼                               │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Step 5: Copy for Instrumentation                          │ │
│  │  • cp sqlite/original/* sqlite/instrumented/             │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                 │                               │
│                                 ▼                               │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Step 6: Build WebAssembly                                 │ │
│  │  • make build-wasm                                        │ │
│  │  • Compile SQLite to WASM                                │ │
│  │  • Generate sqlite3.js and sqlite3.wasm                  │ │
│  │  • Continue on error (fallback to mock mode)             │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                 │                               │
│                                 ▼                               │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Step 7: Create Deployment Structure                       │ │
│  │                                                           │ │
│  │  dist/                                                    │ │
│  │  ├── index.html          (from src/web/)                │ │
│  │  ├── 404.html            (copy of index.html)           │ │
│  │  ├── css/                (from src/web/css/)            │ │
│  │  │   └── style.css                                       │ │
│  │  ├── js/                 (from src/web/js/)             │ │
│  │  │   ├── main.js                                         │ │
│  │  │   ├── events.js                                       │ │
│  │  │   └── visualizer.js                                   │ │
│  │  └── build/              (if WASM build succeeded)      │ │
│  │      ├── sqlite3.js                                      │ │
│  │      └── sqlite3.wasm                                    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                 │                               │
│                                 ▼                               │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Step 8: Upload Pages Artifact                             │ │
│  │  • actions/upload-pages-artifact@v3                      │ │
│  │  • Package dist/ directory                               │ │
│  │  • Create deployment artifact                            │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 │ If push to main/master
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Deployment Job (Separate)                  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Deploy to GitHub Pages                                    │ │
│  │  • actions/deploy-pages@v4                               │ │
│  │  • Upload to GitHub Pages                                │ │
│  │  • Activate new deployment                               │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 │ Deployment complete
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                         GitHub Pages CDN                        │
│  • Fastly CDN distribution                                      │
│  • HTTPS enabled automatically                                  │
│  • Global edge network                                          │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 │ HTTPS request
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Live Site (Browser)                        │
│  • https://username.github.io/sqlitevis/                       │
│  • Fully functional web app                                     │
│  • Running in mock mode or with WASM                           │
└─────────────────────────────────────────────────────────────────┘
```

## Workflow Triggers

### Automatic Triggers

```yaml
on:
  push:
    branches: [main, master]    # Deploy on push
  pull_request:
    branches: [main, master]    # Build only (no deploy)
  workflow_dispatch:            # Manual trigger
```

### Trigger Behavior

| Event | Build | Deploy | Purpose |
|-------|-------|--------|---------|
| Push to main | ✅ | ✅ | Automatic deployment |
| Push to PR | ✅ | ❌ | Preview build only |
| Manual dispatch | ✅ | ✅ | On-demand deployment |

## Build Stages

### Stage 1: Environment Setup (30s)

```
┌─────────────────┐
│ Ubuntu Latest   │
│ Node.js 18.x    │
│ Emscripten 3.1  │
│ Python 3.x      │
└─────────────────┘
```

### Stage 2: Dependency Resolution (1-2min)

```
┌─────────────────┐
│ SQLite Source   │ ← Download from sqlite.org
│ 3.45.0          │
└─────────────────┘
```

### Stage 3: Compilation (1-2min)

```
┌─────────────────┐      ┌─────────────────┐
│ SQLite C Code   │ ───→ │  Emscripten     │
│ sqlite3.c       │      │  Compiler       │
└─────────────────┘      └─────────────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │ WebAssembly     │
                         │ sqlite3.wasm    │
                         │ sqlite3.js      │
                         └─────────────────┘
```

### Stage 4: Packaging (10s)

```
┌─────────────────┐      ┌─────────────────┐
│ Source Files    │ ───→ │  dist/          │
│ HTML/CSS/JS     │      │  Organized      │
│ WASM Binaries   │      │  Structure      │
└─────────────────┘      └─────────────────┘
```

### Stage 5: Deployment (30s)

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ Artifact        │ ───→ │  GitHub Pages   │ ───→ │  CDN            │
│ Upload          │      │  Processing     │      │  Distribution   │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

## Conditional Logic

### WASM Build Success

```
if WASM build succeeds:
    ✅ Include sqlite3.wasm and sqlite3.js in dist/build/
    ✅ Full SQLite functionality available
    ✅ Real database operations work

if WASM build fails:
    ⚠️  Create empty build/ directory
    ⚠️  Add mock sqlite3.js with comment
    ⚠️  Site still deploys (mock mode)
    ⚠️  UI works, but simulated operations only
```

### Deployment Decision

```
if event == "push" AND branch IN ["main", "master"]:
    ✅ Run deployment job
    ✅ Publish to GitHub Pages
    ✅ Site goes live

if event == "pull_request":
    ✅ Run build job
    ❌ Skip deployment job
    ✅ Verify changes don't break build
```

## Performance Metrics

### Typical Build Times

| Stage | Time | Can Fail? |
|-------|------|-----------|
| Checkout | 5s | No |
| Setup Emscripten | 30s | No |
| Download SQLite | 10s | Yes (retry) |
| Build WASM | 60-120s | Yes (continue) |
| Package | 10s | No |
| Deploy | 30s | No |
| **Total** | **3-5 min** | - |

### Resource Usage

- **Disk**: ~500MB (Emscripten + SQLite source + build output)
- **Memory**: ~2GB peak during compilation
- **CPU**: 2 cores (GitHub Actions standard)

## Error Handling

### Retry Logic

```
Download SQLite:
  ├─ Attempt 1: curl
  ├─ On fail: retry with wget
  └─ On fail: error (build stops)

WASM Build:
  ├─ Attempt 1: make build-wasm
  └─ On fail: continue-on-error (deploy mock mode)
```

### Failure Scenarios

1. **SQLite Download Fails**
   - Workflow stops
   - No deployment
   - Manual retry needed

2. **WASM Build Fails**
   - Build continues
   - Mock mode deployed
   - Site still works (limited functionality)

3. **Deployment Fails**
   - Previous version remains live
   - Workflow marked as failed
   - Check GitHub Pages settings

## Caching Strategy

### What's Cached

```yaml
- Emscripten SDK: ~/.emsdk
- SQLite source: (not cached, always fresh)
- Build output: (not cached, always fresh)
```

### Cache Benefits

- Faster Emscripten setup (30s → 10s with cache hit)
- Consistent build environment
- Reduced external dependency fetches

## Security Considerations

### Permissions

```yaml
permissions:
  contents: read        # Read repository
  pages: write         # Write to GitHub Pages
  id-token: write      # OIDC token for deployment
```

### Secrets

- No secrets required for basic deployment
- GitHub token automatically provided
- HTTPS enforced by GitHub Pages

## Monitoring

### What to Watch

1. **Actions Tab**: Workflow status and logs
2. **Pages Settings**: Deployment history
3. **Site**: Live functionality check
4. **Console**: Browser errors (if any)

### Success Indicators

- ✅ Green checkmark in Actions
- ✅ Deployment shown in Settings → Pages
- ✅ Site loads at `username.github.io/sqlitevis`
- ✅ No console errors
- ✅ Visualizations work

## Rollback

If deployment breaks the site:

1. **Revert commit**:
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Manual rollback**:
   - Previous deployment remains cached
   - Push a known-good commit
   - Wait for redeployment

3. **Emergency fix**:
   - Disable GitHub Pages temporarily
   - Fix issue
   - Re-enable and redeploy

## Future Enhancements

Potential improvements:

- **Multi-environment**: dev, staging, production
- **Preview deployments**: PR previews via Netlify/Vercel
- **Automated testing**: E2E tests before deployment
- **Performance monitoring**: Lighthouse CI
- **Cache WASM builds**: Speed up subsequent builds
- **Versioned releases**: Deploy tagged versions

---

This flow ensures reliable, automated deployments with minimal manual intervention.
