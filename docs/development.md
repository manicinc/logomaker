# 💻 Development Mode

For easier development, Logomaker provides a development server environment powered by Node.js and managed via npm scripts. This mode automatically rebuilds the application when you save changes to source code.

## Contributing

Please follow our [contributing.md](./docs/contributing.md) guidelines, and follow the [code-of-conduct.md](./docs/code-of-conduct.md).

## Prerequisites

* [Git](https://git-scm.com/downloads) & [Git LFS](https://git-lfs.com)
* [Node.js](https://nodejs.org/) (v18+) & npm
* Run `npm install` in the project root directory once to install necessary development tools (`chokidar` for file watching, `http-server` for serving). Note: These are **devDependencies** only and not required for the built application to run.

## How It Works (`npm run dev`)

1.  **Initial Build (`deploy` target):** When you run `npm run dev`, the `scripts/dev.js` script first triggers a full, clean build using `scripts/build.js --target=deploy`.
    * This cleans `dist/github-pages/`.
    * It runs `scripts/generate-fonts-json.js` (without Base64).
    * It runs `scripts/split-fonts.js` (which cleans `font-chunks/` and creates the index/chunks).
    * It copies the necessary assets (`js/` including `ui-init.js`, `css/`, `assets/`, `font-chunks/`, `fonts.json`) to `dist/github-pages/`.
    * It copies the **`index.template.html`** source file to `dist/github-pages/index.html`.
2.  **Web Server:** Once the initial build succeeds, `scripts/dev.js` starts a local web server using the `http-server` development dependency.
    * It serves files from the **`dist/github-pages`** directory.
    * It typically runs on port 3000 (`http://localhost:3000`). Check the console output for the exact URL.
    * It does **not** automatically open your browser.
3.  **File Watching:** The script uses `chokidar` (a reliable file watcher) to monitor your source files:
    * `index.template.html` (the source HTML for the deploy target)
    * `js/**/*.js` (all JavaScript files, including `ui-init.js`)
    * `css/**/*.css` (all CSS files)
    * `fonts/**/*.*` (all files within the source fonts directory)
4.  **Automatic Rebuild:**
    * When you **save a change** to a watched source file:
        * `chokidar` detects the change.
        * After a brief delay (debouncing), `scripts/dev.js` automatically triggers a new build using `scripts/build.js --target=deploy`.
        * If a non-font file (`js/`, `css/`, `index.template.html`) changed, the build will typically use the `--skip-font-regen` flag for speed (check `dev.js` logic).
        * If a file inside the `fonts/` directory changed, the build will run *without* the skip flag, ensuring font metadata (`fonts.json`, chunks) and CSS (`css/generated-font-classes.css`) are fully regenerated.
5.  **Automatic Server Restart:**
    * If the automatic rebuild **completes successfully**, `scripts/dev.js` automatically stops the old `http-server` instance and starts a new one serving the updated files from `dist/github-pages`.
6.  **Viewing Changes:**
    * After the server restarts (check the terminal logs for "[DEV] ✅ Build #... OK: deploy." and ">>> Starting http-server..."), you need to **manually refresh your browser** (F5 or Ctrl+R / Cmd+R) to load the latest changes. *There is no automatic browser injection/refresh.*

## Important Limitation

The default `npm run dev` command **only builds and serves the `deploy` target**. This means:

* It uses `index.template.html`.
* It uses the font chunking mechanism.
* It **does not** load or use `inline-fonts-data.js`.
* It **cannot** be used to directly test the specific behavior or features of the `portable` build (like verifying that `inline-fonts-data.js` loads correctly before `main.js`).

## Testing the Portable Build

To test the `portable` version (e.g., for Electron or offline use):

1.  Run the specific build command:
    ```bash
    npm run build:portable
    ```
2.  Load the output:
    * **For Electron:** Simply run the Electron app, as `electron.js` is configured to load from `dist/portable/index.html`.
        ```bash
        npm start
        ```
    * **In Browser (Option 1):** Open the generated `dist/portable/index.html` file directly using the `file:///` protocol in your browser.
    * **In Browser (Option 2):** Serve the directory using a simple HTTP server:
        ```bash
        npx http-server dist/portable -p 8080
        ```
        Then open `http://localhost:8080` in your browser.

## Usage

The primary command for developing the **deploy** target is:

```bash
npm run dev
```

The repository is set up to automatically build and deploy on GitHub Pages with only the required assets for running the web app and no other dev dependencies through the `.github/workflows/deploy-gh-pages.yml`. We also have auto-tagging / drafting of Electron releases. The GitHub Pages files will always live here: [https://github.com/manicinc/logomaker/tree/gh-pages](https://github.com/manicinc/logomaker/tree/gh-pages).