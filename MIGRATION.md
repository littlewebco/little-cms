# Migration from GitShow to LittleCMS

This document outlines the migration from GitShow to LittleCMS.

## What Changed

### Branding
- All references to "GitShow" have been updated to "LittleCMS"
- Error messages and console logs updated
- Package name: `@little/little-cms`

### Architecture
- Migrated from JavaScript to TypeScript
- Restructured into modular handlers and utilities
- Added proper TypeScript types throughout
- Set up modern build tooling (esbuild, Vite)

### File Structure
- `gitshow_worker.js` → `src/worker/index.ts` (migrated and refactored)
- Old worker code moved to `archive/gitshow_worker.js` for reference
- New modular structure: `src/worker/handlers/` and `src/worker/utils/`

### Features Preserved
- GitHub file embedding functionality (fully migrated)
- Markdown rendering (migrated to TypeScript)
- HTML escaping (migrated to TypeScript)
- File type detection (migrated to TypeScript)

### New Features (Coming Soon)
- Admin UI (React + Vite)
- GitHub OAuth integration
- Content CRUD API
- Multi-repo support

## Migration Steps

1. **Update Dependencies**
   ```bash
   npm install
   ```

2. **Update Configuration**
   - Rename `gitshow.config.js` to `little-cms.config.js` (if exists)
   - Update `wrangler.toml` with new worker name

3. **Rebuild**
   ```bash
   npm run build
   ```

4. **Redeploy**
   ```bash
   npm run deploy
   ```

## Breaking Changes

- Worker file path changed: `gitshow_worker.js` → `dist/worker.js`
- Configuration file name: `gitshow.config.js` → `little-cms.config.js`
- Error messages now say "LittleCMS" instead of "GitShow"

## Backward Compatibility

The embed functionality (`/?githubUrl=...`) remains fully compatible. Existing embed scripts will continue to work.

