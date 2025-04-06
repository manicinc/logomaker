# Electron App Release Process (Manual Trigger)

This document outlines the process used to build and release the Logomaker Electron application to GitHub Releases using a manual trigger in GitHub Actions.

## Overview

The goal is to create new releases with platform-specific installers/packages (`.exe`, `.dmg`, `.AppImage`) when **manually triggered** via GitHub Actions. This process uses the version number currently specified in `package.json` at the time the workflow is run.

While **not strictly required** for this manual workflow, using **Conventional Commits** for your commit messages is still recommended as good practice and will make it easier if you decide to implement fully automated version bumping (`standard-version`) in the future.

## Prerequisites & Setup

1.  **Conventional Commits (Recommended):** Following the [Conventional Commits specification](https://www.conventionalcommits.org/) makes your Git history clearer.
    * Examples: `feat: add border controls`, `fix: SVG export alignment`, `docs: update usage`, `chore: cleanup build script`.
2.  **Install Dev Dependencies:** Ensure all development dependencies are installed:
    ```bash
    npm install
    ```
    This includes `electron`, `electron-builder`, `electron-updater`, and potentially `commitizen` if you use it locally. (`standard-version` is not strictly needed for *this specific manual workflow* but might be installed).
3.  **Commitizen (Optional):** To help write conventional commits locally:
    * Run `npm run commit` (or `git cz`) instead of `git commit`.

## Release Steps

This process involves manually setting the version and then triggering the workflow:

1.  **Finalize Code:** Ensure the branch you want to release from (typically `master` or `main`) contains all the code ready for the new release.
2.  **Manually Update Version:** Edit the `package.json` file and change the `"version"` field to the desired new release number (e.g., `"version": "0.1.0"` or `"version": "3.1.1"`).
3.  **Commit & Push Version Bump:** Commit the change to `package.json` (and `package-lock.json`) and push it to your main branch:
    ```bash
    git add package.json package-lock.json
    # Use 'chore' for version bumps
    git commit -m "chore: set version to X.Y.Z for release"
    git push origin master # Or main
    ```
    *(Wait for the separate GitHub Pages deployment (`deploy-pages.yml`) triggered by this push to finish if needed)*.
4.  **Manually Trigger Workflow:**
    * Go to your repository on GitHub -> "Actions" tab.
    * Find the "Build & Release Electron App (Manual Trigger)" workflow in the list (or whatever you named `release.yml`).
    * Click the "Run workflow" dropdown button.
    * Ensure the correct branch (`master` or `main` - the one containing the version bump commit) is selected.
    * Click the green "Run workflow" button.
5.  **GitHub Actions Workflow Runs (`.github/workflows/release.yml`):**
    * **Trigger:** Starts only because you manually triggered it (`workflow_dispatch`).
    * **Checkout:** Checks out the code from the branch you selected (which includes your manually updated `package.json`).
    * **Setup & Install:** Sets up Node.js and runs `npm ci`.
    * **Build Portable Content:** Runs `npm run build:portable` to generate the necessary web content (`dist/portable/`).
    * **Build & Publish Electron App:** Runs `npm run release:electron` (which executes `electron-builder --publish always`) across Windows, macOS, and Linux runners.
        * `electron-builder` reads the version **you manually set** from `package.json`.
        * It packages the app for each OS.
        * It uses the `GH_TOKEN` to authenticate with GitHub.
        * It creates a **Git tag** matching the version (e.g., `v0.1.0`).
        * It creates a **Draft GitHub Release** titled with the version (e.g., `v0.1.0`) associated with that tag.
        * It uploads the packaged application files (`.exe`, `.dmg`, `.AppImage`) as assets to that Draft Release.
6.  **Publish Draft Release:**
    * After the workflow completes successfully on all OS types, go to your repository's "Releases" page.
    * Find the **Draft** release named after your version.
    * Review the assets, add any release notes you want (you could manually copy relevant sections from `CHANGELOG.md` if you maintain one).
    * Click **"Publish release"**.

## Outcome

* The specified branch (`master`/`main`) contains a commit updating the version in `package.json`.
* A Git tag corresponding to that version exists in the repository (created by `electron-builder`).
* A published GitHub Release exists for that version, containing the downloadable application packages for Windows, macOS, and Linux.

## Auto-Updates

Once a release is **published** on GitHub (not just drafted), the `electron-updater` module configured in `electron.js` can detect it. When users launch their installed application:

1.  `autoUpdater.checkForUpdates()` runs in the background (if not in dev mode).
2.  The `update-available` event checks if the user previously skipped this version. If not skipped, `autoUpdater.downloadUpdate()` is called.
3.  If an update is successfully downloaded, the `update-downloaded` event fires, prompting the user with "Restart Now", "Later", or "Skip This Version".
4.  If the user selects "Restart Now", the app quits and installs. If "Later" or "Skip", the update installs on the next normal restart (unless skipped).

This provides users with control over when updates are applied while ensuring the app remains functional offline.