// API Configuration for Electron and Web
// Automatically detects the correct API base URL

function getApiBase() {
    // Check if running in Electron
    if (window.location.protocol === 'file:' || window.location.hostname === 'localhost') {
        // Extract port from current URL if available
        const port = window.location.port || '3000';
        return `http://localhost:${port}/api`;
    }
    // Fallback for production or other environments
    return '/api';
}

const API_BASE = getApiBase();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { API_BASE };
}
