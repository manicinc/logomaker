// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// specified Electron features without exposing the entire object.
contextBridge.exposeInMainWorld('electronAPI', {
    // Example: If you need to send messages from renderer to main
    // send: (channel, data) => {
    //     // Whitelist channels
    //     let validChannels = ['toMain'];
    //     if (validChannels.includes(channel)) {
    //         ipcRenderer.send(channel, data);
    //     }
    // },
    // Example: If you need to receive messages from main in renderer
    // receive: (channel, func) => {
    //     let validChannels = ['fromMain', 'update-status', 'update-progress', 'update-downloaded'];
    //     if (validChannels.includes(channel)) {
    //         // Deliberately strip event as it includes `sender`
    //         ipcRenderer.on(channel, (event, ...args) => func(...args));
    //     }
    // }
    // Add other APIs you NEED to expose here, otherwise keep it minimal.
    // For simply loading the portable build, you might not need any initially.
});

console.log('Preload script executed.');