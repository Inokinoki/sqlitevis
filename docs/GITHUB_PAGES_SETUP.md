# GitHub Pages Setup Guide

Quick guide to enable GitHub Pages deployment for your fork of SQLiteVis.

## Prerequisites

- Repository pushed to GitHub
- Main or master branch with the code
- GitHub account (free tier works!)

## Step-by-Step Setup

### 1. Go to Repository Settings

1. Navigate to your repository on GitHub
2. Click the **Settings** tab (⚙️ icon)
3. Scroll down to find **Pages** in the left sidebar

### 2. Configure GitHub Pages

1. Under **Build and deployment**:
   - **Source**: Select **GitHub Actions**

   ![GitHub Actions Source](https://docs.github.com/assets/cb-47295/images/help/pages/github-actions-source.png)

2. Click **Save** (if available)

That's it! No other configuration needed.

### 3. Merge or Push to Main Branch

The workflow triggers automatically on push to main/master:

```bash
# If you're on a feature branch
git checkout main
git merge your-feature-branch
git push origin main

# Or push directly
git push origin main
```

### 4. Watch the Deployment

1. Go to the **Actions** tab in your repository
2. You'll see "Build and Deploy to GitHub Pages" workflow running
3. Click on it to see progress
4. Wait for the green checkmark ✅

Typical build time: 3-5 minutes

### 5. Access Your Site

Once deployed, visit:
```
https://YOUR_USERNAME.github.io/sqlitevis/
```

Replace `YOUR_USERNAME` with your GitHub username.

Example:
- Username: `alice`
- URL: `https://alice.github.io/sqlitevis/`

## Verification Checklist

- [ ] GitHub Pages enabled in Settings
- [ ] Source set to "GitHub Actions"
- [ ] Workflow completed successfully in Actions tab
- [ ] Site accessible at `https://username.github.io/sqlitevis/`
- [ ] No 404 errors
- [ ] UI loads and visualizations work

## Common Issues

### Issue: "GitHub Pages is not enabled"

**Solution**:
- Go to Settings → Pages
- Enable GitHub Pages by selecting "GitHub Actions" as source

### Issue: "404 - There isn't a GitHub Pages site here"

**Solution**:
- Wait 2-3 minutes after first deployment
- Clear browser cache
- Check workflow completed successfully
- Verify repository is public (or you have GitHub Pro)

### Issue: "Workflow doesn't run"

**Solution**:
- Check you pushed to main or master branch
- Verify `.github/workflows/deploy.yml` exists in repository
- Check Actions are enabled in Settings → Actions

### Issue: "Build fails"

**Solution**:
- Check Actions tab for error logs
- WASM build failure is OK - site will deploy in mock mode
- Open an issue if persistent failures occur

## Updating the Site

Every push to main/master automatically rebuilds and redeploys:

```bash
# Make changes
git add .
git commit -m "Update visualization"
git push origin main

# Site updates automatically in 3-5 minutes
```

## Custom Domain (Optional)

Want to use your own domain like `sqlitevis.yourdomain.com`?

1. **Add CNAME file** to repository root:
   ```bash
   echo "sqlitevis.yourdomain.com" > CNAME
   git add CNAME
   git commit -m "Add custom domain"
   git push
   ```

2. **Update DNS records** with your domain provider:
   ```
   Type: CNAME
   Name: sqlitevis
   Value: yourusername.github.io
   TTL: 3600
   ```

3. **Configure in GitHub**:
   - Settings → Pages
   - Custom domain: `sqlitevis.yourdomain.com`
   - Save and wait for DNS check ✅
   - Enable "Enforce HTTPS"

## Private Repository

GitHub Pages on private repos requires:
- GitHub Pro, Team, or Enterprise
- Same setup process
- Site is still public (not private)

For truly private deployment, consider:
- Self-hosting
- Netlify
- Vercel
- AWS S3 + CloudFront

## Next Steps

After deployment:

1. **Share your live demo**:
   - Add badge to your README
   - Share the URL on social media
   - Show it in your portfolio

2. **Monitor usage**:
   - Settings → Insights → Traffic
   - See visitor stats
   - Track popular pages

3. **Keep it updated**:
   - Push regularly to main
   - Automatic deployments keep it fresh

## Need Help?

- 📖 Read [DEPLOYMENT.md](DEPLOYMENT.md) for advanced topics
- 🐛 Open an issue if something's wrong
- 💬 Ask in GitHub Discussions
- 📧 Contact maintainers

## Resources

- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Custom Domain Guide](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)

---

Congratulations! Your SQLite visualization is now live! 🎉
