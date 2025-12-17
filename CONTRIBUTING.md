# Contributing to SQLiteVis

Thank you for your interest in contributing to SQLiteVis! This document provides guidelines and instructions for contributing.

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue with:

- **Clear title** describing the problem
- **Steps to reproduce** the issue
- **Expected behavior** vs actual behavior
- **Environment details** (browser, OS, versions)
- **Screenshots** if applicable

### Suggesting Features

Feature requests are welcome! Please:

- Check if the feature already exists
- Describe the use case clearly
- Explain why it would be valuable
- Consider providing mockups or examples

### Code Contributions

We love pull requests! Here's how to contribute code:

#### 1. Setup Development Environment

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/sqlitevis.git
cd sqlitevis

# Run setup
./scripts/setup.sh

# Create a branch
git checkout -b feature/my-awesome-feature
```

#### 2. Make Your Changes

Follow the project structure and coding style:

- **JavaScript**: ES6+, descriptive names, JSDoc comments
- **C**: SQLite style, use `#ifdef SQLITE_ENABLE_VISUALIZATION`
- **CSS**: Use CSS custom properties, maintain consistency
- **Documentation**: Update docs for new features

#### 3. Test Your Changes

```bash
# For UI changes
make serve
# Test in browser

# For WASM changes
make build-wasm
make serve
# Test functionality
```

Test cases to verify:

- [ ] Feature works in mock mode (if applicable)
- [ ] Feature works with full WASM build
- [ ] No console errors
- [ ] Visualizations render correctly
- [ ] Events are logged properly
- [ ] Documentation is updated

#### 4. Commit Your Changes

Use conventional commit messages:

```bash
git commit -m "feat: add VDBE opcode visualization"
git commit -m "fix: correct B-tree split animation timing"
git commit -m "docs: add example for custom events"
```

Commit types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style/formatting
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding tests
- `chore`: Maintenance tasks

#### 5. Submit Pull Request

1. Push your branch to your fork
2. Create a PR against the main repository
3. Fill out the PR template
4. Wait for review

PR checklist:
- [ ] Code follows project style
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No merge conflicts
- [ ] Clear description of changes

## Development Areas

Here are some areas where contributions are particularly welcome:

### High Priority

- **SQLite Instrumentation**: Adding more hooks to SQLite
- **Visualization Modes**: Parse tree, query planner visualization
- **Testing**: Unit tests, integration tests
- **Documentation**: Examples, tutorials, guides

### Medium Priority

- **UI Improvements**: Better controls, responsive design
- **Performance**: Optimize rendering for large B-trees
- **Features**: Export visualizations, step-through debugging
- **Accessibility**: Keyboard navigation, screen reader support

### Nice to Have

- **Themes**: Dark mode, custom color schemes
- **Export**: Save visualization as image/video
- **Sharing**: Share database state via URL
- **Examples**: Gallery of interesting queries

## Code Review Process

1. **Automated checks** run on PR creation
2. **Manual review** by maintainers
3. **Feedback** provided via PR comments
4. **Revisions** if needed
5. **Merge** once approved

## Coding Standards

### JavaScript

```javascript
// Use descriptive names
class BTreeVisualizer {
    // Document complex functions
    /**
     * Calculate layout positions for all nodes
     * Uses a level-order traversal algorithm
     */
    layout() {
        // Clear comments for tricky code
        // This adjusts spacing based on node count
        const spacing = Math.max(40, (canvasWidth / nodeCount) - nodeWidth);
    }
}

// Avoid magic numbers
const NODE_WIDTH = 120; // Not just: 120
const ANIMATION_DURATION = 500; // Not just: 500
```

### C Code

```c
#ifdef SQLITE_ENABLE_VISUALIZATION
/* Keep instrumentation minimal and fast */
if( rc==SQLITE_OK ){
    btree_insert_event(pPage->pgno, i, (const char*)pCell, sz);
}
#endif

/* Don't instrument hot paths without good reason */
/* Don't allocate memory in event handlers */
/* Keep JSON formatting simple and safe */
```

### CSS

```css
/* Use CSS custom properties */
:root {
    --primary-color: #2563eb;
}

/* Descriptive class names */
.event-log-container { }  /* Good */
.el { }                   /* Bad */

/* Consistent spacing */
.button {
    padding: 0.6rem 1.2rem;  /* rem units */
    margin-bottom: 1rem;
}
```

## Documentation Standards

- Keep README.md up to date
- Document all public APIs
- Include code examples
- Update QUICKSTART.md for new features
- Add comments for complex algorithms

## Getting Help

- **Documentation**: Check docs/ folder
- **Issues**: Search existing issues
- **Discussions**: Start a discussion for questions
- **Email**: Contact maintainers (see README)

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Credited in the project

## License

By contributing, you agree that your contributions will be licensed under the project's MIT License.

---

Thank you for making SQLiteVis better! 🎉
