// ===== LOGIN MODULE =====
// Handles user authentication

document.addEventListener('DOMContentLoaded', () => {
    // Check if already logged in
    const token = localStorage.getItem('petlife_token');
    if (token) {
        // Verify token is still valid
        checkSession(token);
    }

    // Load saved credentials if remember me was checked
    loadSavedCredentials();

    // Setup form submission
    const loginForm = document.getElementById('login-form');
    loginForm.addEventListener('submit', handleLogin);
});

async function checkSession(token) {
    try {
        // Check if token is older than 24 hours
        const loginTime = localStorage.getItem('petlife_login_time');
        if (loginTime) {
            const now = Date.now();
            const elapsed = now - parseInt(loginTime);
            const hours24 = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

            if (elapsed > hours24) {
                console.log('ℹ️ Token expired (>24h), clearing session');
                localStorage.removeItem('petlife_token');
                localStorage.removeItem('petlife_user');
                localStorage.removeItem('petlife_login_time');
                return;
            }
        }

        const response = await fetch(`${API_BASE}/auth/check`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Session valid, auto-logging in');
            // Redirect based on user role
            if (data.user.role === 'admin') {
                window.location.href = '/admin.html';
            } else {
                window.location.href = '/dashboard.html';
            }
        } else {
            // Token invalid, clear it
            localStorage.removeItem('petlife_token');
            localStorage.removeItem('petlife_user');
            localStorage.removeItem('petlife_login_time');
        }
    } catch (error) {
        console.error('Error checking session:', error);
        localStorage.removeItem('petlife_token');
        localStorage.removeItem('petlife_user');
        localStorage.removeItem('petlife_login_time');
    }
}

function loadSavedCredentials() {
    try {
        const savedUsername = localStorage.getItem('petlife_saved_username');
        const savedPassword = localStorage.getItem('petlife_saved_password');
        const rememberMe = localStorage.getItem('petlife_remember_me') === 'true';

        console.log('Loading saved credentials:', { savedUsername, hasPassword: !!savedPassword, rememberMe });

        if (rememberMe && savedUsername && savedPassword) {
            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');
            const rememberMeCheckbox = document.getElementById('rememberMe');

            if (usernameInput) usernameInput.value = savedUsername;
            if (passwordInput) passwordInput.value = savedPassword;
            if (rememberMeCheckbox) rememberMeCheckbox.checked = true;

            console.log('✅ Credentials loaded successfully');
        } else {
            console.log('ℹ️ No saved credentials found');
        }
    } catch (error) {
        console.error('❌ Error loading credentials:', error);
    }
}

function saveCredentials(username, password, remember) {
    try {
        console.log('Saving credentials:', { username, hasPassword: !!password, remember });

        if (remember) {
            localStorage.setItem('petlife_saved_username', username);
            localStorage.setItem('petlife_saved_password', password);
            localStorage.setItem('petlife_remember_me', 'true');
            console.log('✅ Credentials saved to localStorage');
        } else {
            localStorage.removeItem('petlife_saved_username');
            localStorage.removeItem('petlife_saved_password');
            localStorage.removeItem('petlife_remember_me');
            console.log('ℹ️ Credentials removed from localStorage');
        }
    } catch (error) {
        console.error('❌ Error saving credentials:', error);
    }
}


async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    const button = document.getElementById('login-button');
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');

    // Hide previous errors
    errorMessage.classList.remove('show');

    // Validate
    if (!username || !password) {
        showError('Por favor, preencha todos os campos');
        return;
    }

    // Disable button
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Login successful
            localStorage.setItem('petlife_token', data.token);
            localStorage.setItem('petlife_user', JSON.stringify(data.user));
            localStorage.setItem('petlife_login_time', Date.now().toString());

            // Save credentials if remember me is checked
            saveCredentials(username, password, rememberMe);

            // Show success feedback
            button.innerHTML = '<i class="fa-solid fa-check"></i> Sucesso!';
            button.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';

            // Maximize window if running in Electron
            if (typeof require !== 'undefined') {
                try {
                    const { ipcRenderer } = require('electron');
                    await ipcRenderer.invoke('maximize-window');
                } catch (error) {
                    console.log('Not running in Electron or error maximizing:', error);
                }
            }

            // Redirect based on user role after short delay
            setTimeout(() => {
                if (data.user.role === 'admin') {
                    window.location.href = '/admin.html';
                } else {
                    window.location.href = '/dashboard.html';
                }
            }, 500);
        } else {
            // Login failed
            showError(data.error || 'Erro ao fazer login');
            button.disabled = false;
            button.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar';
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('Erro de conexão. Verifique sua internet.');
        button.disabled = false;
        button.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar';
    }
}

function showError(message) {
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');

    errorText.textContent = message;
    errorMessage.classList.add('show');

    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorMessage.classList.remove('show');
    }, 5000);
}
