const { app, BrowserWindow, session, desktopCapturer, ipcMain } = require('electron');
const path = require('path');

// Step 1 scope: just get the existing web client running as a native window.
// Remote control (nut.js, input injection) is a separate, later step — see
// the plan in conversation / project notes before extending this file.
const DEV_URL = process.env.REPLICA_DEV_URL;
const PROD_INDEX = path.join(__dirname, '..', 'client', 'dist', 'index.html');

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 860,
        minWidth: 960,
        minHeight: 640,
        title: 'Replica Gather',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    if (DEV_URL) {
        win.loadURL(DEV_URL);
        win.webContents.openDevTools({ mode: 'detach' });
    } else {
        win.loadFile(PROD_INDEX);
    }
}

// Opens picker.html as a small modal, sends it the available sources
// (thumbnails included), and resolves with whichever source id the user
// clicked — or null if they closed the window/clicked Cancel either way.
function showSourcePicker(sources) {
    return new Promise((resolve) => {
        let resolved = false;
        const resolveOnce = (id) => {
            if (resolved) return;
            resolved = true;
            resolve(id);
        };

        const pickerWindow = new BrowserWindow({
            width: 720,
            height: 480,
            resizable: false,
            modal: true,
            parent: BrowserWindow.getFocusedWindow() || undefined,
            autoHideMenuBar: true,
            webPreferences: {
                preload: path.join(__dirname, 'picker-preload.js'),
                contextIsolation: true,
                nodeIntegration: false,
            },
        });
        pickerWindow.loadFile(path.join(__dirname, 'picker.html'));

        const serialized = sources.map((s) => ({
            id: s.id,
            name: s.name,
            thumbnail: s.thumbnail.toDataURL(),
        }));
        pickerWindow.webContents.once('did-finish-load', () => {
            pickerWindow.webContents.send('sources', serialized);
        });

        const handleSelection = (_e, id) => {
            resolveOnce(id);
            if (!pickerWindow.isDestroyed()) pickerWindow.close();
        };
        ipcMain.once('picker-selected', handleSelection);

        pickerWindow.on('closed', () => {
            ipcMain.removeListener('picker-selected', handleSelection);
            resolveOnce(null);
        });
    });
}

app.whenReady().then(() => {
    // session.defaultSession only exists once the app is ready — registering
    // these handlers at module-load time (before whenReady) crashes with
    // "Cannot read properties of undefined (reading 'defaultSession')".

    // Electron denies getUserMedia/getDisplayMedia by default — a regular
    // browser's native permission prompt doesn't exist here, so the app
    // itself has to decide. Auto-approving mic/camera matches what a user
    // would click "Allow" to anyway; this is a two-person app the account
    // holder installed themselves, not an untrusted multi-tenant page.
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
        if (permission === 'media' || permission === 'display-capture') {
            callback(true);
            return;
        }
        callback(false);
    });

    // getDisplayMedia() in Electron has no native "choose what to share"
    // dialog (that's browser chrome a renderer doesn't have) — without this
    // handler the existing screen-share code in CallManager.tsx would just
    // hang forever waiting for a picker that never appears. Silently
    // grabbing desktopCapturer's first result (the previous version of this
    // handler) left no way to actually pick "entire screen" vs a specific
    // window, and no guarantee the first source WAS the full screen — this
    // shows a real picker (picker.html) with thumbnails for every screen and
    // window, same idea as Discord/Zoom/Teams's share dialog.
    // audio: 'loopback' is what actually grants system-audio capture in
    // Electron — it only works for a 'screen:' source, not an individual
    // 'window:' source (WASAPI loopback captures everything the system is
    // playing, not just one app), which is a real platform limitation, not
    // a bug: sharing a specific window gets video only.
    session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
        const sources = await desktopCapturer.getSources({
            types: ['screen', 'window'],
            thumbnailSize: { width: 300, height: 180 },
        });

        const selectedId = await showSourcePicker(sources);
        const selected = sources.find((s) => s.id === selectedId);
        if (!selected) {
            callback({}); // user cancelled — caught by CallManager.tsx's try/catch
            return;
        }

        const isScreen = selected.id.startsWith('screen:');
        callback(isScreen ? { video: selected, audio: 'loopback' } : { video: selected });
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
