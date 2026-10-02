const { contextBridge } = require('electron');

// Empty for now — step 1 is just the window itself. Once remote control
// (nut.js) is added, this is where a minimal, explicit API gets exposed to
// the renderer via contextBridge (never nodeIntegration: true — that would
// hand the whole Node API to whatever runs in the window).
contextBridge.exposeInMainWorld('replicaDesktop', {
    isDesktop: true,
});
