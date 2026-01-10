const { autoUpdater } = require('electron-updater');
const { app, dialog } = require('electron');
const log = require('electron-log');

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;

// Configure autoUpdater
autoUpdater.autoDownload = false; // Don't auto-download, ask user first
autoUpdater.autoInstallOnAppQuit = true; // Install when app quits

let updateCheckInProgress = false;
let updateDownloadInProgress = false;

/**
 * Check for updates
 * @param {BrowserWindow} mainWindow - The main window to send events to
 */
function checkForUpdates(mainWindow) {
    if (updateCheckInProgress) {
        log.info('Update check already in progress');
        return;
    }

    updateCheckInProgress = true;
    log.info('Checking for updates...');
    
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-checking');
    }

    autoUpdater.checkForUpdates()
        .catch(err => {
            log.error('Error checking for updates:', err);
            updateCheckInProgress = false;
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('update-error', err.message);
            }
        });
}

/**
 * Download update
 */
function downloadUpdate(mainWindow) {
    if (updateDownloadInProgress) {
        log.info('Update download already in progress');
        return;
    }

    updateDownloadInProgress = true;
    log.info('Starting update download...');
    
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-downloading');
    }

    autoUpdater.downloadUpdate()
        .catch(err => {
            log.error('Error downloading update:', err);
            updateDownloadInProgress = false;
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('update-error', err.message);
            }
        });
}

/**
 * Install update and restart app
 */
function installUpdate() {
    log.info('Installing update and restarting...');
    autoUpdater.quitAndInstall(false, true);
}

/**
 * Setup auto-updater event listeners
 * @param {BrowserWindow} mainWindow - The main window to send events to
 */
function setupAutoUpdater(mainWindow) {
    // Checking for updates
    autoUpdater.on('checking-for-update', () => {
        log.info('Checking for update...');
    });

    // Update available
    autoUpdater.on('update-available', (info) => {
        log.info('Update available:', info);
        updateCheckInProgress = false;
        
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-available', {
                version: info.version,
                releaseNotes: info.releaseNotes,
                releaseDate: info.releaseDate
            });
        }
    });

    // No update available
    autoUpdater.on('update-not-available', (info) => {
        log.info('Update not available:', info);
        updateCheckInProgress = false;
        
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-not-available');
        }
    });

    // Download progress
    autoUpdater.on('download-progress', (progressObj) => {
        const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
        log.info(logMessage);
        
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-download-progress', {
                percent: progressObj.percent,
                transferred: progressObj.transferred,
                total: progressObj.total,
                bytesPerSecond: progressObj.bytesPerSecond
            });
        }
    });

    // Update downloaded
    autoUpdater.on('update-downloaded', (info) => {
        log.info('Update downloaded:', info);
        updateDownloadInProgress = false;
        
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-downloaded', {
                version: info.version
            });
        }
    });

    // Error
    autoUpdater.on('error', (err) => {
        log.error('AutoUpdater error:', err);
        updateCheckInProgress = false;
        updateDownloadInProgress = false;
        
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-error', err.message);
        }
    });
}

module.exports = {
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    setupAutoUpdater
};
