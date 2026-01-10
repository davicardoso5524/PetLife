// ===== ADMIN PANEL MODULE =====
let currentUsers = [];
let editingUserId = null;

document.addEventListener('DOMContentLoaded', () => {
    checkAdminAccess();
    setupEventListeners();
    loadUsers();
});

// Check if user is admin
async function checkAdminAccess() {
    const token = localStorage.getItem('petlife_token');
    const userStr = localStorage.getItem('petlife_user');

    if (!token || !userStr) {
        window.location.href = '/login.html';
        return;
    }

    try {
        const user = JSON.parse(userStr);
        if (user.role !== 'admin') {
            alert('Acesso negado. Apenas administradores podem acessar esta página.');
            window.location.href = '/index.html';
            return;
        }

        // Verify token is still valid
        const response = await fetch(`${API_BASE}/auth/check`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            localStorage.removeItem('petlife_token');
            localStorage.removeItem('petlife_user');
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Error checking admin access:', error);
        window.location.href = '/login.html';
    }
}

function setupEventListeners() {
    document.getElementById('btn-new-user').addEventListener('click', openNewUserModal);
    document.getElementById('user-form').addEventListener('submit', saveUser);

    // Keyboard shortcut: Ctrl+Shift+A to access admin (from other pages)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'A') {
            e.preventDefault();
            window.location.href = '/admin.html';
        }
    });
}

async function loadUsers() {
    const token = localStorage.getItem('petlife_token');
    const tbody = document.getElementById('users-tbody');

    try {
        const response = await fetch(`${API_BASE}/admin/users`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load users');
        }

        const data = await response.json();
        currentUsers = data.users;

        renderUsersTable(currentUsers);
    } catch (error) {
        console.error('Error loading users:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding:2rem; color:#dc2626;">
                    <i class="fa-solid fa-exclamation-triangle" style="font-size:2rem;"></i>
                    <p style="margin-top:1rem;">Erro ao carregar usuários</p>
                </td>
            </tr>
        `;
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('users-tbody');

    if (!users || users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding:2rem;">
                    <i class="fa-solid fa-users" style="font-size:2rem; color:#9ca3af;"></i>
                    <p style="margin-top:1rem; color:#6b7280;">Nenhum usuário cadastrado</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = users.map(user => `
        <tr>
            <td><strong>${user.username}</strong></td>
            <td>${user.full_name || '-'}</td>
            <td>
                <span class="badge badge-${user.role === 'admin' ? 'admin' : 'user'}">
                    ${user.role === 'admin' ? 'Admin' : 'Usuário'}
                </span>
            </td>
            <td>
                <span class="badge badge-${user.is_active ? 'active' : 'inactive'}">
                    ${user.is_active ? 'Ativo' : 'Inativo'}
                </span>
            </td>
            <td>${user.last_login ? formatDate(user.last_login) : 'Nunca'}</td>
            <td>
                <div style="display:flex; gap:0.5rem;">
                    <button class="btn-icon" onclick="editUser(${user.id})" title="Editar">
                        <i class="fa-solid fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-danger" onclick="deleteUser(${user.id})" title="Excluir">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openNewUserModal() {
    editingUserId = null;
    document.getElementById('user-modal-title').textContent = 'Novo Usuário';
    document.getElementById('user-form').reset();
    document.getElementById('user-id').value = '';
    document.getElementById('user-password').placeholder = 'Digite a senha';
    document.getElementById('user-password').required = true;

    const modal = document.getElementById('user-modal');
    modal.classList.add('active');
    modal.classList.add('show');

    setTimeout(() => {
        const content = modal.querySelector('.modal-content');
        if (content) content.classList.add('animate-in');
    }, 10);
}

function editUser(id) {
    const user = currentUsers.find(u => u.id === id);
    if (!user) return;

    editingUserId = id;
    document.getElementById('user-modal-title').textContent = 'Editar Usuário';
    document.getElementById('user-id').value = id;
    document.getElementById('user-username').value = user.username;
    document.getElementById('user-fullname').value = user.full_name || '';
    document.getElementById('user-role').value = user.role;
    document.getElementById('user-active').checked = user.is_active === 1;
    document.getElementById('user-password').value = '';
    document.getElementById('user-password').placeholder = 'Deixe em branco para manter a atual';
    document.getElementById('user-password').required = false;

    const modal = document.getElementById('user-modal');
    modal.classList.add('active');
    modal.classList.add('show');

    setTimeout(() => {
        const content = modal.querySelector('.modal-content');
        if (content) content.classList.add('animate-in');
    }, 10);
}

function closeUserModal() {
    const modal = document.getElementById('user-modal');
    const content = modal.querySelector('.modal-content');

    if (content) content.classList.remove('animate-in');
    modal.classList.remove('show');

    setTimeout(() => {
        modal.classList.remove('active');
    }, 300);

    editingUserId = null;
}

async function saveUser(e) {
    e.preventDefault();

    const token = localStorage.getItem('petlife_token');
    const id = document.getElementById('user-id').value;
    const username = document.getElementById('user-username').value.trim();
    const full_name = document.getElementById('user-fullname').value.trim();
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role').value;
    const is_active = document.getElementById('user-active').checked;

    // Validate password for new users
    if (!id && (!password || password.length < 6)) {
        showToast('A senha deve ter no mínimo 6 caracteres', 'error');
        return;
    }

    const data = {
        username,
        full_name: full_name || null,
        role,
        is_active: is_active ? 1 : 0
    };

    if (password) {
        data.password = password;
    }

    try {
        const url = id
            ? `${API_BASE}/admin/users/${id}`
            : `${API_BASE}/admin/users`;
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            showToast(id ? 'Usuário atualizado!' : 'Usuário criado!');
            closeUserModal();
            loadUsers();
        } else {
            showToast(result.error || 'Erro ao salvar usuário', 'error');
        }
    } catch (error) {
        console.error('Error saving user:', error);
        showToast('Erro ao salvar usuário', 'error');
    }
}

let userToDelete = null;

async function deleteUser(id) {
    const user = currentUsers.find(u => u.id === id);
    if (!user) return;

    // Store the user to delete
    userToDelete = user;

    // Update modal content with user information
    const userInfoDiv = document.getElementById('delete-user-info');
    userInfoDiv.innerHTML = `
        <p><strong>Usuário:</strong> ${user.username}</p>
        <p><strong>Nome:</strong> ${user.full_name || 'Não informado'}</p>
        <p><strong>Função:</strong> ${user.role === 'admin' ? 'Administrador' : 'Usuário'}</p>
    `;

    // Show delete modal
    const modal = document.getElementById('delete-modal');
    modal.classList.add('active');
    modal.classList.add('show');
    setTimeout(() => {
        const content = modal.querySelector('.modal-content');
        if (content) content.classList.add('animate-in');
    }, 10);
}

async function confirmDelete() {
    if (!userToDelete) return;

    const token = localStorage.getItem('petlife_token');

    // Add loading state to button
    const confirmBtn = document.getElementById('btn-confirm-delete');
    if (confirmBtn) {
        confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Excluindo...';
        confirmBtn.disabled = true;
    }

    try {
        const response = await fetch(`${API_BASE}/admin/users/${userToDelete.id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (response.ok) {
            showToast('Usuário excluído!');
            closeDeleteModal();
            loadUsers();
        } else {
            showToast(result.error || 'Erro ao excluir usuário', 'error');
            // Reset button state
            if (confirmBtn) {
                confirmBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Excluir';
                confirmBtn.disabled = false;
            }
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('Erro ao excluir usuário', 'error');
        // Reset button state
        if (confirmBtn) {
            confirmBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Excluir';
            confirmBtn.disabled = false;
        }
    }
}

function cancelDelete() {
    closeDeleteModal();
}

function closeDeleteModal() {
    const modal = document.getElementById('delete-modal');
    if (modal) {
        const content = modal.querySelector('.modal-content');
        if (content) content.classList.remove('animate-in');
        modal.classList.remove('show');
        setTimeout(() => {
            modal.classList.remove('active');
            userToDelete = null;
            // Reset button state
            const confirmBtn = document.getElementById('btn-confirm-delete');
            if (confirmBtn) {
                confirmBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Excluir';
                confirmBtn.disabled = false;
            }
        }, 300);
    }
}


function logout() {
    // Abrir o modal de logout ao invés de usar confirm()
    const modal = document.getElementById('logout-modal');
    modal.classList.add('active');
    modal.classList.add('show');
    setTimeout(() => {
        const content = modal.querySelector('.modal-content');
        if (content) content.classList.add('animate-in');
    }, 10);
}

function cancelLogout() {
    const modal = document.getElementById('logout-modal');
    const content = modal.querySelector('.modal-content');
    if (content) content.classList.remove('animate-in');
    modal.classList.remove('show');
    setTimeout(() => {
        modal.classList.remove('active');
    }, 300);
}

function confirmLogout() {
    const token = localStorage.getItem('petlife_token');
    fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    }).finally(() => {
        localStorage.removeItem('petlife_token');
        localStorage.removeItem('petlife_user');
        window.location.href = '/';
    });
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}
