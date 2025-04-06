# Electron App Release Process (Automated)

This document outlines the automated process used to build, version, and release the Logomaker Electron application to GitHub Releases.

## Overview

The goal is to automatically create new releases with platform-specific installers/packages (`.exe`, `.dmg`, `.AppImage`) whenever significant changes (`feat`, `fix`, `BREAKING CHANGE`) are pushed to the main branch (`master` or `main`). This process relies on **Conventional Commits** for intelligent version bumping and **GitHub Actions** for automation.

## Prerequisites & Setup

1.  **Conventional Commits:** All developers should follow the [Conventional Commits specification](https://www.conventionalcommits.org/) for their commit messages. This format allows tools to automatically determine the semantic version bump (patch, minor, major) and generate changelogs. Examples:
    * `feat: add border radius control` (results in a MINOR version bump)
    * `fix: correct PNG export transparency issue` (results in a PATCH version bump)
    * `perf: optimize font loading` (results in a PATCH version bump)
    * `refactor!: change core rendering engine` (The `!` or `BREAKING CHANGE:` footer indicates a MAJOR version bump)
    * `chore: update dependencies` (Does NOT trigger a release)
    * `docs: update README` (Does NOT trigger a release)
2.  **Install Dev Dependencies:** Ensure all development dependencies are installed:
    ```bash
    npm install
    ```
    This includes `electron`, `electron-builder`, `electron-updater`, `standard-version`, `commitizen`, `cz-conventional-changelog`.
3.  **Commitizen (Optional but Recommended):** To make writing conventional commits easier, you can use Commitizen:
    * Run `npm run commit` (or `git cz`) instead of `git commit`.
    * It will prompt you through creating a correctly formatted commit message.
    * No extra global install is needed if configured in `package.json` (which we did).

## The `standard-version` Tool

We use the `standard-version` npm package to handle the versioning and changelog workflow. When run (typically by the GitHub Action), it performs these steps based on commits since the last Git tag:

1.  **Version Bump:** Determines the next version (e.g., 3.1.0 -> 3.2.0 if a `feat:` commit is found) based on Conventional Commits.
2.  **Update Files:** Modifies `package.json` and `package-lock.json` with the new version number.
3.  **Update Changelog:** Generates or updates `CHANGELOG.md` based on the new commits.
4.  **Commit:** Creates a new Git commit containing these file changes (e.g., `chore(release): 3.2.0`).
5.  **Tag:** Creates a new Git tag matching the version (e.g., `v3.2.0`).

## GitHub Actions Workflow (`.github/workflows/release.yml`)

This workflow automates the entire process when code is pushed to the main branch:

1.  **Trigger:** Starts on push to `master`/`main` or manual trigger.
2.  **`release` Job (Runs on Ubuntu):**
    * Checks out the full Git history.
    * Sets up Node.js and installs dependencies (`npm ci`).
    * Configures Git credentials for committing.
    * Runs `npx standard-version`: Performs the version bump, changelog update, commit, and tagging steps described above. **Important:** If no `feat`, `fix`, or `BREAKING CHANGE` commits are found, this step does nothing, and the workflow likely stops here.
    * Pushes the new commit and tag back to the GitHub repository using the default `GITHUB_TOKEN`.
3.  **`build_and_publish` Job (Runs on Windows, macOS, Linux in parallel):**
    * Runs only *after* the `release` job succeeds (meaning a version bump occurred).
    * Checks out the code again (now including the version bump commit).
    * Sets up Node.js and installs dependencies (`npm ci`).
    * Runs `npm run build:portable` to generate the necessary web content for Electron (`dist/portable/`).
    * Runs `npm run release:electron` which executes `electron-builder --publish always`.
        * `electron-builder` reads the **newly bumped version** from `package.json`.
        * It packages the app for the specific OS the job is running on (Win, Mac, Linux).
        * It uses the `GH_TOKEN` environment variable (`secrets.GITHUB_TOKEN`) to authenticate with GitHub.
        * It finds the Git tag created by `standard-version`.
        * It creates a **Draft GitHub Release** associated with that tag.
        * It uploads the packaged application (`.exe`, `.dmg`, `.AppImage`) as an asset to the draft release.

## Outcome & Final Steps

* After the workflow runs successfully following relevant commits, a new commit and tag appear in your repository history.
* A **Draft Release** is created on your repository's "Releases" page, containing the built application packages for Windows, macOS, and Linux.
* **Manual Step:** You need to navigate to the Draft Release, review the automatically generated changelog notes (if desired), add any extra information, and manually click **"Publish release"**.

## Auto-Updates

Once a release is **published** on GitHub (not just drafted), the `electron-updater` module configured in `electron.js` can detect it. When users launch their installed application:

1.  `autoUpdater.checkForUpdatesAndNotify()` runs.
2.  It checks the GitHub Releases feed configured in `package.json` (`build.publish` section).
3.  If a newer compatible version is found, it downloads the update package silently in the background.
4.  Once downloaded, the update is automatically applied the next time the user quits and restarts the application.

This provides a seamless update experience for your users.