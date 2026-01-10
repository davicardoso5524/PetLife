// ===== AUTHENTICATION PROTECTION =====
// This script should be included in all protected pages

(async function () {
    // Skip auth check for login page (now index.html)
    if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
        return;
    }

    const token = localStorage.getItem('petlife_token');

    if (!token) {
        window.location.href = '/index.html';
        return;
    }

    try {
        const response = await fetch(`${window.location.origin}/api/auth/check`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            localStorage.removeItem('petlife_token');
            localStorage.removeItem('petlife_user');
            window.location.href = '/index.html';
        } else {
            // Update user data in localStorage
            const data = await response.json();
            localStorage.setItem('petlife_user', JSON.stringify(data.user));

            // Show admin menu if user is admin
            if (data.user.role === 'admin') {
                showAdminMenu();
            }
        }
    } catch (error) {
        console.error('Auth check error:', error);
        // Don't redirect on network error, allow offline usage
    }
})();

// Function to show admin menu for admin users
function showAdminMenu() {
    // Early return if admin menu item already exists to prevent unnecessary DOM updates
    if (document.querySelector('.admin-menu-item')) {
        return;
    }

    const navLinks = document.querySelector('.nav-links');
    if (navLinks) {
        const adminLink = document.createElement('li');
        adminLink.className = 'admin-menu-item';
        if (window.location.pathname.includes('admin.html')) {
            adminLink.className += ' active';
        }
        adminLink.innerHTML = '<a href="admin.html"><i class="fa-solid fa-user-shield"></i> Admin</a>';
        navLinks.appendChild(adminLink);
    }
}

// Global logout function
function logout() {
    // Show logout modal
    const modal = document.getElementById('logout-modal');
    if (modal) {
        modal.classList.add('active');
        modal.classList.add('show');
        setTimeout(() => {
            const content = modal.querySelector('.modal-content');
            if (content) content.classList.add('animate-in');
        }, 10);
    }
}

function confirmLogout() {
    const token = localStorage.getItem('petlife_token');

    // Add loading state to button
    const confirmBtn = document.getElementById('btn-confirm-logout');
    if (confirmBtn) {
        confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saindo...';
        confirmBtn.disabled = true;
    }

    fetch(`${window.location.origin}/api/auth/logout`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    }).finally(() => {
        localStorage.removeItem('petlife_token');
        localStorage.removeItem('petlife_user');
        localStorage.removeItem('petlife_login_time');
        window.location.href = '/index.html';
    });
}

function cancelLogout() {
    const modal = document.getElementById('logout-modal');
    if (modal) {
        const content = modal.querySelector('.modal-content');
        if (content) content.classList.remove('animate-in');
        modal.classList.remove('show');
        setTimeout(() => {
            modal.classList.remove('active');
        }, 300);
    }
}

// Keyboard shortcut to access admin panel (Ctrl+Shift+A)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        const userStr = localStorage.getItem('petlife_user');
        if (userStr) {
            const user = JSON.parse(userStr);
            if (user.role === 'admin') {
                window.location.href = '/admin.html';
            } else {
                alert('Acesso negado. Apenas administradores.');
            }
        }
    }
});
