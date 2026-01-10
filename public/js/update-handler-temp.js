// Update Handler - Manages auto-update UI and communication with main process
// Only works in Electron environment
let ipcRenderer = null;

// Check if running in Electron
try {
    if (typeof require !== 'undefined') {
        const electron = require('electron');
        ipcRenderer = electron.ipcRenderer;
    }
} catch (error) {
    console.log('Not running in Electron, update handler disabled');
}

class UpdateHandler {
    constructor() {`r`n        // Don't initialize if not in Electron`r`n        if (!ipcRenderer) {`r`n            console.log('Update handler skipped (not in Electron)');`r`n            return;`r`n        }`r`n
        this.modal = null;
        this.currentVersion = null;
        this.newVersion = null;
        this.isDownloading = false;
        this.skippedVersions = this.getSkippedVersions();

        this.init();
    }

    async init() {
        // Get current app version
        this.currentVersion = await ipcRenderer.invoke('get-app-version');

        // Setup IPC listeners
        this.setupListeners();

        // Create modal HTML
        this.createModal();
    }

    setupListeners() {
        // Checking for updates
        ipcRenderer.on('update-checking', () => {
            console.log('🔍 Verificando atualizações...');
        });

        // Update available
        ipcRenderer.on('update-available', (event, info) => {
            console.log('✨ Atualização disponível:', info.version);
            this.newVersion = info.version;

            // Check if user skipped this version
            if (this.skippedVersions.includes(info.version)) {
                console.log('⏭️ Versão ignorada pelo usuário');
                return;
            }

            this.showUpdateModal(info);
        });

        // Update not available
        ipcRenderer.on('update-not-available', () => {
            console.log('✓ Aplicativo está atualizado');
        });

        // Download progress
        ipcRenderer.on('update-download-progress', (event, progress) => {
            this.updateProgress(progress);
        });

        // Update downloaded
        ipcRenderer.on('update-downloaded', (event, info) => {
            console.log('✓ Atualização baixada:', info.version);
            this.showInstallPrompt();
        });

        // Update error
        ipcRenderer.on('update-error', (event, error) => {
            console.error('❌ Erro na atualização:', error);
            this.showError(error);
        });

        // Downloading
        ipcRenderer.on('update-downloading', () => {
            console.log('⬇️ Baixando atualização...');
        });
    }

    createModal() {
        const modalHTML = `
            <div id="update-modal" class="update-modal hidden">
                <div class="update-overlay"></div>
                <div class="update-content">
                    <div class="update-header">
                        <div class="update-icon">🚀</div>
                        <h2>Nova Atualização Disponível!</h2>
                    </div>
                    
                    <div class="update-body">
                        <div class="version-info">
                            <div class="version-badge">
                                <span class="version-label">Versão Atual</span>
                                <span class="version-number" id="current-version">${this.currentVersion}</span>
                            </div>
                            <div class="version-arrow">→</div>
                            <div class="version-badge new">
                                <span class="version-label">Nova Versão</span>
                                <span class="version-number" id="new-version">-</span>
                            </div>
                        </div>
                        
                        <div class="update-notes" id="update-notes">
                            <h3>Novidades:</h3>
                            <div id="release-notes"></div>
                        </div>
                        
                        <div class="download-progress hidden" id="download-progress">
                            <div class="progress-info">
                                <span>Baixando atualização...</span>
                                <span id="progress-percent">0%</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill" id="progress-fill"></div>
                            </div>
                            <div class="progress-details">
                                <span id="progress-speed">0 KB/s</span>
                                <span id="progress-size">0 MB / 0 MB</span>
                            </div>
                        </div>
                        
                        <div class="update-message hidden" id="update-message"></div>
                    </div>
                    
                    <div class="update-footer" id="update-actions">
                        <button class="btn-secondary" id="btn-skip">Pular Esta Versão</button>
                        <button class="btn-secondary" id="btn-later">Lembrar Depois</button>
                        <button class="btn-primary" id="btn-update">Atualizar Agora</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('update-modal');

        // Setup button handlers
        document.getElementById('btn-skip').addEventListener('click', () => this.skipVersion());
        document.getElementById('btn-later').addEventListener('click', () => this.remindLater());
        document.getElementById('btn-update').addEventListener('click', () => this.startUpdate());
    }

    showUpdateModal(info) {
        // Update version display
        document.getElementById('new-version').textContent = info.version;

        // Update release notes
        const notesContainer = document.getElementById('release-notes');
        if (info.releaseNotes) {
            notesContainer.innerHTML = this.formatReleaseNotes(info.releaseNotes);
        } else {
            notesContainer.innerHTML = '<p>Melhorias e correções de bugs.</p>';
        }

        // Show modal
        this.modal.classList.remove('hidden');
    }

    formatReleaseNotes(notes) {
        if (typeof notes === 'string') {
            return `<p>${notes}</p>`;
        }

        if (Array.isArray(notes)) {
            return notes.map(note => {
                if (typeof note === 'string') {
                    return `<p>${note}</p>`;
                }
                return `<p>${note.note || ''}</p>`;
            }).join('');
        }

        return '<p>Melhorias e correções de bugs.</p>';
    }

    startUpdate() {
        this.isDownloading = true;

        // Hide action buttons
        document.getElementById('update-actions').classList.add('hidden');

        // Show progress
        document.getElementById('download-progress').classList.remove('hidden');

        // Start download
        ipcRenderer.send('download-update');
    }

    updateProgress(progress) {
        const percent = Math.round(progress.percent);
        const transferred = this.formatBytes(progress.transferred);
        const total = this.formatBytes(progress.total);
        const speed = this.formatBytes(progress.bytesPerSecond);

        document.getElementById('progress-percent').textContent = `${percent}%`;
        document.getElementById('progress-fill').style.width = `${percent}%`;
        document.getElementById('progress-speed').textContent = `${speed}/s`;
        document.getElementById('progress-size').textContent = `${transferred} / ${total}`;
    }

    showInstallPrompt() {
        // Hide progress
        document.getElementById('download-progress').classList.add('hidden');

        // Show install message
        const messageEl = document.getElementById('update-message');
        messageEl.innerHTML = `
            <div class="success-message">
                <div class="success-icon">✓</div>
                <p>Atualização baixada com sucesso!</p>
                <p class="small">O aplicativo será reiniciado para instalar a atualização.</p>
            </div>
        `;
        messageEl.classList.remove('hidden');

        // Show install button
        const actionsEl = document.getElementById('update-actions');
        actionsEl.innerHTML = `
            <button class="btn-primary btn-large" id="btn-install">Instalar e Reiniciar</button>
        `;
        actionsEl.classList.remove('hidden');

        document.getElementById('btn-install').addEventListener('click', () => {
            ipcRenderer.send('install-update');
        });
    }

    showError(error) {
        // Hide progress
        document.getElementById('download-progress').classList.add('hidden');

        // Show error message
        const messageEl = document.getElementById('update-message');
        messageEl.innerHTML = `
            <div class="error-message">
                <div class="error-icon">⚠️</div>
                <p>Erro ao baixar atualização</p>
                <p class="small">${error}</p>
            </div>
        `;
        messageEl.classList.remove('hidden');

        // Show retry button
        const actionsEl = document.getElementById('update-actions');
        actionsEl.innerHTML = `
            <button class="btn-secondary" id="btn-close">Fechar</button>
            <button class="btn-primary" id="btn-retry">Tentar Novamente</button>
        `;
        actionsEl.classList.remove('hidden');

        document.getElementById('btn-close').addEventListener('click', () => this.closeModal());
        document.getElementById('btn-retry').addEventListener('click', () => {
            this.closeModal();
            setTimeout(() => ipcRenderer.send('check-for-updates'), 1000);
        });
    }

    skipVersion() {
        if (this.newVersion) {
            this.skippedVersions.push(this.newVersion);
            this.saveSkippedVersions();
        }
        this.closeModal();
    }

    remindLater() {
        this.closeModal();
    }

    closeModal() {
        this.modal.classList.add('hidden');
        this.isDownloading = false;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    getSkippedVersions() {
        const stored = localStorage.getItem('skippedVersions');
        return stored ? JSON.parse(stored) : [];
    }

    saveSkippedVersions() {
        localStorage.setItem('skippedVersions', JSON.stringify(this.skippedVersions));
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.updateHandler = new UpdateHandler();
    });
} else {
    window.updateHandler = new UpdateHandler();
}
