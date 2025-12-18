# Deployment Guide

This document explains how the SQLiteVis project is deployed to GitHub Pages and how to set it up for your own fork.

## GitHub Pages Deployment

The project uses GitHub Actions to automatically build and deploy to GitHub Pages on every push to the main/master branch.

### How It Works

1. **Trigger**: Push to main/master branch or manual workflow dispatch
2. **Build**: GitHub Actions workflow runs
3. **Compile**: Emscripten compiles SQLite to WebAssembly
4. **Package**: Files are organized for deployment
5. **Deploy**: Artifacts are uploaded to GitHub Pages
6. **Live**: Site is available at `https://username.github.io/sqlitevis/`

### Workflow Steps

The deployment workflow (`.github/workflows/deploy.yml`) performs:

1. **Checkout**: Gets the repository code
2. **Setup Emscripten**: Installs Emscripten SDK v3.1.50
3. **Download SQLite**: Fetches SQLite 3.45.0 source
4. **Build WASM**: Compiles SQLite to WebAssembly
5. **Create Dist**: Organizes files for deployment
6. **Upload**: Packages and uploads to GitHub Pages
7. **Deploy**: Publishes to GitHub Pages (on main branch only)

### File Structure (Deployment)

```
dist/
├── index.html
├── 404.html (copy of index.html)
├── css/
│   └── style.css
├── js/
│   ├── main.js
│   ├── events.js
│   └── visualizer.js
└── build/
    ├── sqlite3.js
    └── sqlite3.wasm
```

## Setting Up for Your Fork

### 1. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages**
3. Under "Build and deployment":
   - **Source**: GitHub Actions
4. Save changes

### 2. Configure Repository Settings

No additional configuration needed! The workflow handles everything.

### 3. Push to Main Branch

```bash
git push origin main
```

The workflow automatically triggers and deploys.

### 4. Check Deployment Status

- Go to **Actions** tab in your repository
- Watch the "Build and Deploy to GitHub Pages" workflow
- Once complete, visit `https://yourusername.github.io/sqlitevis/`

## Manual Deployment

To deploy manually:

1. Go to **Actions** tab
2. Select "Build and Deploy to GitHub Pages"
3. Click "Run workflow"
4. Select branch and run

## Deployment Modes

### Mock Mode (Default for GitHub Pages)

The GitHub Pages deployment runs in mock mode by default:
- No real SQLite operations
- Simulated events for demonstration
- Instant page load
- Works without WASM

This is intentional to ensure:
- Fast loading times
- Demonstration of UI/UX
- No build failures blocking deployment

### Full WASM Mode (Local)

For full functionality:
1. Clone the repository
2. Install Emscripten
3. Run `make build-wasm`
4. Run `make serve`
5. Open `http://localhost:8000`

## Troubleshooting

### Workflow Fails

**Issue**: Emscripten build fails

**Solution**: The workflow has `continue-on-error: true` for the WASM build step. The site will deploy in mock mode even if WASM compilation fails.

### Pages Not Updating

**Issue**: Changes don't appear after deployment

**Solution**:
1. Check Actions tab for workflow status
2. Clear browser cache (Ctrl+Shift+R)
3. Wait a few minutes for CDN propagation
4. Check the deployment URL matches your username

### 404 Error

**Issue**: Page shows 404

**Solution**:
1. Verify GitHub Pages is enabled in Settings
2. Check the source is set to "GitHub Actions"
3. Ensure at least one workflow has completed successfully
4. Check repository is public (or GitHub Pro for private repos)

### WASM Not Loading

**Issue**: "SQLite WASM not found, using mock mode" message

**Expected**: This is normal for GitHub Pages deployment. For full WASM, build locally.

## Custom Domain

To use a custom domain:

1. Add a `CNAME` file to the repository root:
   ```
   www.yourdomain.com
   ```

2. Update DNS records:
   ```
   Type: CNAME
   Name: www
   Value: yourusername.github.io
   ```

3. In GitHub Settings → Pages:
   - Enter your custom domain
   - Enable "Enforce HTTPS"

4. Update workflow to include CNAME:
   ```yaml
   - name: Create CNAME
     run: echo "www.yourdomain.com" > dist/CNAME
   ```

## Performance Optimization

### CDN Caching

GitHub Pages uses Fastly CDN:
- Static assets are cached
- First visit may be slow
- Subsequent visits are fast

### Build Optimization

Current build settings:
- Emscripten `-O2` optimization
- WASM enabled
- Memory growth allowed
- Minimal exported functions

To optimize further:
- Use `-O3` for maximum optimization
- Enable `-flto` for link-time optimization
- Minimize exported API surface

### Asset Optimization

Consider:
- Minifying JavaScript
- Compressing CSS
- Lazy loading WASM module
- Service Worker for offline support

## CI/CD Best Practices

### Branch Protection

Protect main branch:
1. Settings → Branches → Add rule
2. Require status checks before merging
3. Require workflow to pass

### Deployment Preview

For pull requests:
- Workflow runs but doesn't deploy
- Review build logs in Actions tab
- Ensures changes don't break build

### Versioning

Consider adding version tags:
```bash
git tag v1.0.0
git push --tags
```

Modify workflow to deploy tagged releases to specific URLs.

## Monitoring

### GitHub Actions

Monitor deployments:
- **Actions tab**: View workflow runs
- **Insights → Traffic**: See visitor stats
- **Insights → Deployments**: View deployment history

### Analytics

Add analytics (optional):

1. Google Analytics:
   ```html
   <!-- Add to index.html <head> -->
   <script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
   ```

2. Simple Analytics (privacy-friendly):
   ```html
   <script async defer src="https://scripts.simpleanalyticscdn.com/latest.js"></script>
   ```

## Security

### Secrets Management

The workflow doesn't require secrets for basic deployment.

For advanced features:
- Store secrets in Settings → Secrets
- Reference as `${{ secrets.SECRET_NAME }}`

### HTTPS

GitHub Pages enforces HTTPS:
- Automatic SSL certificates
- HTTP redirects to HTTPS
- Safe for user data

## Cost

GitHub Pages is free for:
- Public repositories (unlimited)
- Private repositories (GitHub Pro/Team)

Limits:
- 100GB bandwidth/month
- 1GB storage
- 10 builds/hour

## Support

For deployment issues:
- Check [GitHub Actions docs](https://docs.github.com/en/actions)
- Review [GitHub Pages docs](https://docs.github.com/en/pages)
- Open an issue in the repository

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [Emscripten Documentation](https://emscripten.org/docs/)
- [Custom Domain Setup](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)
