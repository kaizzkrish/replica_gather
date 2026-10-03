const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('picker', {
    onSources: (callback) => ipcRenderer.on('sources', (_e, sources) => callback(sources)),
    select: (id) => ipcRenderer.send('picker-selected', id),
    cancel: () => ipcRenderer.send('picker-selected', null),
});
