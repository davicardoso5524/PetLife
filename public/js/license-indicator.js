// License Indicator Module
// Updates license status display in dashboard header

async function updateLicenseIndicator() {
    try {
        const indicator = document.getElementById('licenseIndicator');
        const text = document.getElementById('licenseIndicatorText');

        if (!indicator || !text) return;

        // Check if we're in Electron context
        if (typeof require === 'undefined') {
            indicator.className = 'license-indicator';
            text.textContent = 'Modo Web';
            indicator.title = 'Licenciamento disponível apenas no app desktop';
            return;
        }

        const { ipcRenderer } = require('electron');
        const licenseInfo = await ipcRenderer.invoke('get-license-info');

        if (!licenseInfo || !licenseInfo.expiresAt) {
            // Perpetual license or no expiration
            indicator.className = 'license-indicator active';
            text.textContent = 'Licença Ativa';
            indicator.title = 'Clique para ver detalhes da licença';
            return;
        }

        const now = new Date();
        const expiry = new Date(licenseInfo.expiresAt);
        const diffTime = expiry - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            // Expired
            indicator.className = 'license-indicator expired';
            text.textContent = 'Licença Expirada';
            indicator.title = 'Clique para ver detalhes e renovar';
        } else if (diffDays === 0) {
            // Expires today
            indicator.className = 'license-indicator warning';
            text.textContent = 'Expira Hoje';
            indicator.title = 'Clique para ver detalhes da licença';
        } else if (diffDays === 1) {
            // Expires tomorrow
            indicator.className = 'license-indicator warning';
            text.textContent = 'Expira Amanhã';
            indicator.title = 'Clique para ver detalhes da licença';
        } else if (diffDays <= 7) {
            // Expires within a week
            indicator.className = 'license-indicator warning';
            text.textContent = `${diffDays} dias restantes`;
            indicator.title = 'Clique para ver detalhes da licença';
        } else if (diffDays <= 30) {
            // Less than a month
            indicator.className = 'license-indicator active';
            text.textContent = `${diffDays} dias`;
            indicator.title = 'Clique para ver detalhes da licença';
        } else {
            // More than a month
            const months = Math.floor(diffDays / 30);
            indicator.className = 'license-indicator active';
            text.textContent = months === 1 ? '1 mês' : `${months} meses`;
            indicator.title = 'Clique para ver detalhes da licença';
        }
    } catch (error) {
        console.error('Erro ao verificar licença:', error);
        const indicator = document.getElementById('licenseIndicator');
        const text = document.getElementById('licenseIndicatorText');
        if (indicator && text) {
            indicator.className = 'license-indicator';
            text.textContent = 'Erro ao verificar';
            indicator.title = 'Não foi possível verificar o status da licença';
        }
    }
}

// Open license details modal
async function openLicenseModal() {
    try {
        if (typeof require === 'undefined') return;

        const { ipcRenderer } = require('electron');
        const licenseInfo = await ipcRenderer.invoke('get-license-info');

        if (!licenseInfo) return;

        const modal = document.getElementById('licenseModal');

        // Populate modal with license info
        const statusEl = document.getElementById('modalLicenseStatus');
        const keyEl = document.getElementById('modalLicenseKey');
        const activatedEl = document.getElementById('modalActivatedAt');
        const expiresEl = document.getElementById('modalExpiresAt');
        const timeRemainingEl = document.getElementById('modalTimeRemaining');
        const durationEl = document.getElementById('modalDuration');

        // Status
        const now = new Date();
        const expiry = licenseInfo.expiresAt ? new Date(licenseInfo.expiresAt) : null;
        const diffDays = expiry ? Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)) : null;

        if (!expiry) {
            statusEl.textContent = 'Ativa (Perpétua)';
            statusEl.style.color = '#10b981';
        } else if (diffDays < 0) {
            statusEl.textContent = 'Expirada';
            statusEl.style.color = '#ef4444';
        } else if (diffDays <= 7) {
            statusEl.textContent = 'Ativa (Expirando em breve)';
            statusEl.style.color = '#f59e0b';
        } else {
            statusEl.textContent = 'Ativa';
            statusEl.style.color = '#10b981';
        }

        // Key
        keyEl.textContent = licenseInfo.key || 'N/A';

        // Activated At
        if (licenseInfo.validatedAt) {
            const activatedDate = new Date(licenseInfo.validatedAt);
            activatedEl.textContent = activatedDate.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } else {
            activatedEl.textContent = 'N/A';
        }

        // Expires At
        if (expiry) {
            expiresEl.textContent = expiry.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });
        } else {
            expiresEl.textContent = 'Nunca';
        }

        // Time Remaining
        if (!expiry) {
            timeRemainingEl.textContent = 'Ilimitado';
        } else if (diffDays < 0) {
            timeRemainingEl.textContent = 'Expirada';
            timeRemainingEl.style.color = '#ef4444';
        } else if (diffDays === 0) {
            timeRemainingEl.textContent = 'Expira hoje';
            timeRemainingEl.style.color = '#f59e0b';
        } else if (diffDays === 1) {
            timeRemainingEl.textContent = '1 dia';
            timeRemainingEl.style.color = '#f59e0b';
        } else if (diffDays < 30) {
            timeRemainingEl.textContent = `${diffDays} dias`;
            timeRemainingEl.style.color = diffDays <= 7 ? '#f59e0b' : '#10b981';
        } else {
            const months = Math.floor(diffDays / 30);
            const days = diffDays % 30;
            timeRemainingEl.textContent = `${months} ${months === 1 ? 'mês' : 'meses'}${days > 0 ? ` e ${days} dias` : ''}`;
            timeRemainingEl.style.color = '#10b981';
        }

        // Duration
        if (licenseInfo.validatedAt && expiry) {
            const activated = new Date(licenseInfo.validatedAt);
            const totalDays = Math.ceil((expiry - activated) / (1000 * 60 * 60 * 24));
            if (totalDays < 30) {
                durationEl.textContent = `${totalDays} dias`;
            } else {
                const months = Math.floor(totalDays / 30);
                durationEl.textContent = `${months} ${months === 1 ? 'mês' : 'meses'}`;
            }
        } else {
            durationEl.textContent = 'Perpétua';
        }

        // Show modal
        modal.classList.add('active');
        setTimeout(() => {
            modal.classList.add('show');
            const content = modal.querySelector('.modal-content');
            if (content) content.classList.add('animate-in');
        }, 10);
    } catch (error) {
        console.error('Erro ao abrir modal de licença:', error);
    }
}

// Close license modal
function closeLicenseModal() {
    const modal = document.getElementById('licenseModal');
    const content = modal.querySelector('.modal-content');

    if (content) content.classList.remove('animate-in');
    modal.classList.remove('show');

    setTimeout(() => {
        modal.classList.remove('active');
    }, 300);
}

// Initialize on page load
if (document.getElementById('licenseIndicator')) {
    updateLicenseIndicator();

    // Add click event to indicator
    document.getElementById('licenseIndicator').addEventListener('click', openLicenseModal);

    // Update every hour
    setInterval(updateLicenseIndicator, 3600000);
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('licenseModal');
    if (modal && e.target === modal) {
        closeLicenseModal();
    }
});
