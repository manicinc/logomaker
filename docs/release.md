# Logomaker Deployment & Release Process

This document explains the deployment and release process for the Logomaker application, covering both the web application deployment to GitHub Pages and the Electron application releases.

## Overview

Logomaker has two primary deployment workflows:

1. **GitHub Pages Deployment** - Deploys the web application automatically when code is pushed to `master`
2. **Electron App Release** - Creates desktop application installers for Windows, macOS, and Linux

## GitHub Pages Deployment

The GitHub Pages deployment is handled by the `deploy-gh-pages.yml` workflow file.

### Trigger Methods:
- **Automatic**: Runs whenever code is pushed to the `master` branch
- **Manual**: Can be triggered from the Actions tab in GitHub

### Workflow File:
See the complete workflow in: [.github/workflows/deploy-gh-pages.yml](deploy-gh-pages.yml)

## Electron App Release

There are two available workflows for releasing the Electron application:

### 1. Manual Trigger Release

This workflow is triggered manually and uses the version already in `package.json`.

#### Workflow File:
See the complete workflow in: [.github/workflows/release.yml](release.yml)

### 2. Automated Versioning Release

This workflow runs on push to `master` and uses `standard-version` to automatically bump the version.

#### Workflow File:
See the complete workflow in: [.github/workflows/deploy.yml](deploy.yml)

## Build Process

The build process for both web and desktop applications is handled by `build.js`, which supports two different build targets:

1. **deploy**: For GitHub Pages deployment
   - Output directory: `./dist/github-pages/`
   - Fonts are referenced by URL (not embedded)
   - Includes all necessary font files
   - Uses `index.template.html`

2. **portable**: For Electron application
   - Output directory: `./dist/portable/`
   - Fonts are Base64 embedded
   - Uses `index-portable.template.html`

See the complete build script in: [scripts/build.js](build.js)

## Release Process

### Semantic Versioning

The project uses `standard-version` for semantic versioning with the following npm scripts:

```bash
# For standard releases (auto-increments version based on commit types)
npm run release

# For first release
npm run release:first

# For dry run
npm run release:dryrun
```

### Package Configuration

The Electron application build configuration is defined in `package.json` under the `build` field:

```json
"build": {
    "appId": "agency.manic.logomaker",
    "productName": "Logomaker",
    "directories": {
        "output": "release/",
        "buildResources": "assets"
    },
    "files": [
        "dist/portable/**/*",
        "electron.js",
        "preload.js",
        "node_modules/electron-updater/**/*",
        "node_modules/electron-log/**/*"
    ],
    "win": {
        "target": "nsis",
        "icon": "assets/icon.ico"
    },
    "mac": {
        "target": "dmg",
        "category": "public.app-category.graphics-design",
        "icon": "assets/icon.icns"
    },
    "linux": {
        "target": "AppImage",
        "category": "Graphics",
        "icon": "assets/icons"
    },
    "publish": {
        "provider": "github",
        "owner": "manicinc",
        "repo": "logomaker"
    }
}
```

See the complete package configuration in: [package.json](package.json)