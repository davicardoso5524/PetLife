const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { startServer } = require('./server');
const { checkLicenseOnStartup, validateLicense, getStoredLicense } = require('./services/licenseService');
const { getHashedMachineId } = require('./utils/machineId');
const { checkForUpdates, downloadUpdate, installUpdate, setupAutoUpdater } = require('./services/updateService');


let mainWindow;
let activationWindow;
let serverInstance;
let serverPort;

async function createWindow() {
    // 1. Start the Express server
    serverInstance = await startServer(0);
    serverPort = serverInstance.address().port;
    console.log(`Electron started. Internal server running on port: ${serverPort}`);

    // 2. Check license before creating main window
    const licenseCheck = await checkLicenseOnStartup();

    if (!licenseCheck.valid) {
        // Show activation window
        createActivationWindow();
    } else {
        // License is valid, create main window
        createMainWindow(licenseCheck);
    }
}

function createMainWindow(licenseInfo) {
    mainWindow = new BrowserWindow({
        width: 500,
        height: 700,
        icon: path.join(__dirname, 'public', 'icon.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        autoHideMenuBar: true,
        center: true,
        resizable: true
    });

    mainWindow.loadURL(`http://localhost:${serverPort}`);

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Open DevTools in development mode (comment out for production)
    // mainWindow.webContents.openDevTools();

    // Show license info in console
    if (licenseInfo.offline) {
        console.log('⚠️  Usando licença em modo offline');
    } else {
        console.log('✓ Licença válida');
    }

    // Setup auto-updater
    setupAutoUpdater(mainWindow);

    // Check for updates after window is ready
    mainWindow.webContents.once('did-finish-load', () => {
        // Wait 3 seconds before checking for updates
        setTimeout(() => {
            checkForUpdates(mainWindow);
        }, 3000);
    });

    // Prevent new windows from opening
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith(`http://localhost:${serverPort}`)) {
            mainWindow.loadURL(url);
            return { action: 'deny' };
        }
        require('electron').shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

function createActivationWindow() {
    activationWindow = new BrowserWindow({
        width: 600,
        height: 700,
        icon: path.join(__dirname, 'public', 'icon.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        autoHideMenuBar: true,
        center: true,
        resizable: false,
        frame: true
    });

    activationWindow.loadFile(path.join(__dirname, 'public', 'license-activation.html'));

    activationWindow.on('closed', function () {
        activationWindow = null;
        // If activation window is closed without activating, quit the app
        if (!mainWindow) {
            app.quit();
        }
    });
}

// IPC Handlers

// Get machine ID
ipcMain.handle('get-machine-id', async () => {
    return getHashedMachineId();
});

// Get license info
ipcMain.handle('get-license-info', async () => {
    return getStoredLicense();
});

// Maximize window (called after login)
ipcMain.handle('maximize-window', () => {
    if (mainWindow) {
        mainWindow.maximize();
    }
});

// Validate license
ipcMain.handle('validate-license', async (event, licenseKey) => {
    try {
        const result = await validateLicense(licenseKey);
        return result;
    } catch (error) {
        return {
            valid: false,
            error: error.error || 'unknown_error',
            message: error.message || 'Erro ao validar licença',
            offline: error.offline || false
        };
    }
});

// License activated successfully
ipcMain.on('license-activated', () => {
    if (activationWindow) {
        activationWindow.close();
        activationWindow = null;
    }

    const licenseInfo = getStoredLicense();
    createMainWindow({ valid: true, license: licenseInfo });
});

// Use offline mode (temporary)
ipcMain.on('use-offline-mode', () => {
    const storedLicense = getStoredLicense();
    const { isWithinOfflineGracePeriod } = require('./services/licenseService');

    if (storedLicense && isWithinOfflineGracePeriod()) {
        console.log('⚠️  Usando modo offline temporário');

        if (activationWindow) {
            activationWindow.close();
            activationWindow = null;
        }
        createMainWindow({ valid: true, license: storedLicense, offline: true });
    } else {
        // Cannot use offline mode
        const errorMsg = !storedLicense
            ? 'Não há licença armazenada para usar em modo offline.'
            : 'Período de graça offline expirado. Conexão à internet necessária.';

        console.error('❌ Modo offline não disponível:', errorMsg);

        if (activationWindow) {
            activationWindow.webContents.send('offline-mode-error', errorMsg);
        }
    }
});

// Open help
ipcMain.on('open-help', () => {
    require('electron').shell.openExternal('mailto:suporte@petlife.com?subject=Ajuda com Licença');
});

// Maximize window on login
ipcMain.on('maximize-window', () => {
    if (mainWindow) {
        mainWindow.maximize();
    }
});

// Update IPC Handlers
ipcMain.on('check-for-updates', () => {
    if (mainWindow) {
        checkForUpdates(mainWindow);
    }
});

ipcMain.on('download-update', () => {
    if (mainWindow) {
        downloadUpdate(mainWindow);
    }
});

ipcMain.on('install-update', () => {
    installUpdate();
});

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});


app.on('ready', createWindow);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
    if (mainWindow === null && activationWindow === null) {
        createWindow();
    }
});
