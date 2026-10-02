const { app, BrowserWindow, session, desktopCapturer } = require('electron');
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
    // hang forever waiting for a picker that never appears. For now this
    // grabs the primary screen automatically; swapping in a real picker
    // (own-window vs. full screen) is a quick follow-up once this baseline works.
    session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
        const sources = await desktopCapturer.getSources({ types: ['screen'] });
        callback({ video: sources[0], audio: 'loopback' });
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
