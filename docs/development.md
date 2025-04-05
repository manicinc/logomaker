## 💻 Development Mode (Live Reload)

For easier development, a live-reloading environment is available. This mode automatically rebuilds the application and refreshes your browser when you make changes to the source code.

**How it Works:**

1.  **Initial Setup:** When you run the script, it performs a full initial build (using `node scripts/build.js`), generating all necessary assets (HTML, CSS, JS, font metadata, etc.) for the web-optimized (`deploy`) target.
2.  **Web Server:** It starts a local web server (using `npx http-server`) to serve the built files (from the `dist/github-pages` directory).
3.  **Browser Launch:** The *first time* it starts, it automatically opens the application in your default web browser.
4.  **File Watching:** The script continuously watches your source files (`index.html`, `js/`, `css/`, and significantly, `fonts/`).
5.  **Automatic Rebuild & Refresh:**
    * When a change is detected in `index.html`, `js/`, or `css/`, the script triggers a quick rebuild (skipping the time-consuming font regeneration) and restarts the local web server. Your browser should reflect the changes (you might need to manually refresh if hot-reloading isn't configured, but the server *will* have the latest code).
    * When a change is detected specifically within the `fonts/` directory, the script performs a *full* rebuild, including regenerating all font metadata and CSS, before restarting the server.
6.  **No More New Tabs:** After the initial launch, subsequent server restarts (due to file changes) will *not* open new browser tabs.

**How to Run:**

1.  Make sure you have run `npm install` at least once in the project root to install development dependencies like `http-server`.
2.  Open your terminal, navigate to the project's root directory (`logomaker/`).
3.  Run the command:
    ```bash
    node scripts/dev.js
    ```
4.  The script will output logs showing the build process and server status. Look for a line indicating the server is running (e.g., `Access at http://localhost:3000`).
5.  Develop! Edit your code, save files, and watch the terminal for rebuild messages. Check the browser (refresh if needed) to see your changes.

**How to Stop:**

* Go back to the terminal window where `node scripts/dev.js` is running.
* Press `CTRL+C`. The script will shut down the build process and the web server gracefully.