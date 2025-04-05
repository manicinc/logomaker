# 💻 Development Mode

For easier development, Logomaker provides a development server environment powered by Node.js and managed via npm scripts. This mode automatically rebuilds the application when you save changes to source code.

## Prerequisites

* [Git](https://git-scm.com/downloads) & [Git LFS](https://git-lfs.com)
* [Node.js](https://nodejs.org/) (v18+) & npm
* Run `npm install` in the project root directory once to install necessary development tools (`chokidar` for file watching, `http-server` for serving). Note: These are **devDependencies** only and not required for the built application to run.

## How It Works (`npm run dev`)

1.  **Initial Build:** When you run `npm run dev`, the `scripts/dev.js` script first triggers a full, clean build using `scripts/build.js --target=deploy`.
    * This cleans `dist/github-pages/`.
    * It runs `scripts/generate-fonts-json.js` (without Base64).
    * It runs `scripts/split-fonts.js` (which cleans `font-chunks/` and creates the index/chunks).
    * It copies all necessary assets (`index.html`, `js/`, `css/`, `font-chunks/`, `fonts/`, `fonts.json`) to `dist/github-pages/`.
2.  **Web Server:** Once the initial build succeeds, `scripts/dev.js` starts a local web server using the `http-server` development dependency.
    * It serves files from the `dist/github-pages` directory.
    * It typically runs on port 3000 (`http://localhost:3000`).
    * It automatically opens your default browser to the correct address (`-o` flag).
3.  **File Watching:** The script uses `chokidar` (a reliable file watcher) to monitor your source files (`index.html`, `js/`, `css/`, `fonts/`).
4.  **Automatic Rebuild:**
    * When you **save a change** to a watched source file:
        * `chokidar` detects the change.
        * After a brief delay (debouncing), `scripts/dev.js` automatically triggers a new build (`scripts/build.js --target=deploy`).
        * If a non-font file (`js/`, `css/`, `index.html`) changed, the build will use the `--skip-font-regen` flag for speed.
        * If a file inside the `fonts/` directory changed, the build will run *without* the skip flag, ensuring font metadata (`fonts.json`, `inline-fonts-data.js`, chunks) and CSS (`css/generated-font-classes.css`) are fully regenerated.
5.  **Automatic Server Restart:**
    * If the automatic rebuild **completes successfully**, `scripts/dev.js` automatically stops the old `http-server` instance and starts a new one serving the updated files from `dist/github-pages`.
6.  **Viewing Changes:**
    * After the server restarts (check the terminal logs), you need to **manually refresh your browser** (F5 or Ctrl+R / Cmd+R) to load the latest changes. *There is no automatic browser injection/refresh.*

## Usage

The primary command for development is:

```bash
npm run dev