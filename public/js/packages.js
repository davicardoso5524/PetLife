// Packages Module Logic

document.addEventListener('DOMContentLoaded', () => {
    initPackages();
});

const initPackages = () => {
    setupPackageModal();
    loadPackages();
    setupSearch();
};

// Global variable to store original photo when editing
let originalPhoto = null;

const setupPackageModal = () => {
    const btnNew = document.getElementById('btn-new-package');
    const modal = document.getElementById('new-package-modal');

    if (btnNew && modal) {
        btnNew.onclick = () => {
            openPackageModal(); // Reset mode
        };
    }

    const form = document.getElementById('package-form');
    if (form) {
        form.addEventListener('submit', savePackage);
    }

    // Photo upload handlers
    const photoPreview = document.getElementById('photo-preview');
    const photoInput = document.getElementById('pkg-photo-input');
    const btnRemovePhoto = document.getElementById('btn-remove-photo');

    if (photoPreview && photoInput) {
        photoPreview.addEventListener('click', () => {
            photoInput.click();
        });

        photoInput.addEventListener('change', handlePhotoUpload);
    }

    if (btnRemovePhoto) {
        btnRemovePhoto.addEventListener('click', removePhoto);
    }
};

const openPackageModal = (pkg = null) => {
    const modal = document.getElementById('new-package-modal');
    const title = document.getElementById('modal-title');
    const form = document.getElementById('package-form');
    const submitBtn = document.getElementById('btn-submit-package');

    // Reset form
    form.reset();
    document.getElementById('pkg-id').value = '';

    // Reset photo
    resetPhotoPreview();

    if (pkg) {
        // Edit Mode
        title.textContent = 'Editar Pacote';
        submitBtn.innerHTML = 'Salvar Edição <i class="fa-solid fa-check"></i>';
        document.getElementById('pkg-id').value = pkg.id;
        document.getElementById('pkg-pet').value = pkg.pet_name;
        document.getElementById('pkg-owner').value = pkg.owner_name;
        document.getElementById('pkg-phone').value = pkg.phone || '';
        document.getElementById('pkg-price').value = pkg.price || '';
        document.getElementById('pkg-created').value = pkg.created_at;
        document.getElementById('pkg-obs').value = pkg.observation || '';

        // Store original photo to preserve it if not changed
        originalPhoto = pkg.pet_photo || null;

        // Load existing photo if available
        if (pkg.pet_photo) {
            displayPhotoPreview(pkg.pet_photo);
        }
    } else {
        // New Mode
        title.textContent = 'Novo Pacote';
        submitBtn.innerHTML = 'Criar Pacote <i class="fa-solid fa-check"></i>';
        originalPhoto = null; // Reset for new package
        const today = new Date();
        document.getElementById('pkg-created').valueAsDate = today;
    }

    modal.style.display = 'flex';
    requestAnimationFrame(() => {
        modal.classList.add('show');
        modal.querySelector('.modal-content').classList.add('animate-in');
    });
};

const closePackageModal = () => {
    const modal = document.getElementById('new-package-modal');
    if (modal) {
        modal.classList.remove('show');
        modal.querySelector('.modal-content').classList.remove('animate-in');
        setTimeout(() => modal.style.display = 'none', 300);
    }
};

// Unified Save (Create/Update)
const savePackage = async (e) => {
    e.preventDefault();
    console.log('📦 savePackage called');

    const id = document.getElementById('pkg-id').value;
    const pet_name = document.getElementById('pkg-pet').value;
    const owner_name = document.getElementById('pkg-owner').value;
    const phone = document.getElementById('pkg-phone').value;
    const price = parseFloat(document.getElementById('pkg-price').value);
    const created_at = document.getElementById('pkg-created').value;
    const observation = document.getElementById('pkg-obs').value;
    const pet_photo_input = document.getElementById('pkg-photo-base64').value;

    console.log('Form data:', { pet_name, owner_name, phone, price, created_at });

    // If editing and no new photo, keep original photo
    const pet_photo = pet_photo_input || originalPhoto || null;

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_BASE}/packages/${id}` : `${API_BASE}/packages`;

    console.log('Request:', { method, url });

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pet_name, owner_name, phone, price, created_at, observation, pet_photo })
        });

        console.log('Response status:', res.status);

        if (res.ok) {
            const data = await res.json();
            console.log('✅ Package saved:', data);
            showToast(id ? 'Pacote atualizado!' : 'Pacote criado com sucesso!');
            closePackageModal();
            loadPackages();
        } else {
            const err = await res.json();
            console.error('❌ Error response:', err);
            showToast(err.error || 'Erro ao salvar pacote');
        }
    } catch (error) {
        console.error('❌ Fetch error:', error);
        showToast('Erro de conexão');
    }
};

// --- Delete Logic ---

const closeDeleteModal = () => {
    const modal = document.getElementById('delete-modal');
    modal.classList.remove('show');
    modal.querySelector('.modal-content').classList.remove('animate-in');
    setTimeout(() => modal.style.display = 'none', 300);
};

window.requestDeletePackage = (id) => {
    document.getElementById('delete-pkg-id').value = id;
    const modal = document.getElementById('delete-modal');
    modal.style.display = 'flex';
    requestAnimationFrame(() => {
        modal.classList.add('show');
        modal.querySelector('.modal-content').classList.add('animate-in');
    });
};

window.confirmDeletePackage = async () => {
    const id = document.getElementById('delete-pkg-id').value;
    if (!id) return;

    try {
        const res = await fetch(`${API_BASE}/packages/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Pacote excluído.');
            closeDeleteModal();
            loadPackages();
        } else {
            showToast('Erro ao excluir.');
        }
    } catch (e) {
        showToast('Erro de conexão');
    }
};

const loadPackages = async (query = '') => {
    const container = document.getElementById('packages-list');
    container.innerHTML = '<div class="empty-state">Carregando...</div>';

    try {
        let url = `${API_BASE}/packages`;
        if (query) url += `?search=${encodeURIComponent(query)}`;

        const res = await fetch(url);

        // Check if response is OK before parsing
        if (!res.ok) {
            throw new Error(`Erro HTTP: ${res.status} - ${res.statusText}`);
        }

        const json = await res.json();
        const packages = json.data || [];

        container.innerHTML = '';
        if (packages.length === 0) {
            container.innerHTML = '<div class="empty-state">Nenhum pacote encontrado.</div>';
            return;
        }

        packages.forEach(pkg => {
            const card = createPackageCard(pkg);
            container.appendChild(card);
        });

    } catch (error) {
        console.error('Erro ao carregar pacotes:', error);
        container.innerHTML = `<div class="empty-state">Erro ao carregar pacotes. ${error.message || 'Verifique se o servidor está rodando.'}</div>`;
    }
};

const createPackageCard = (pkg) => {
    const div = document.createElement('div');
    const isExpired = new Date(pkg.expires_at) < new Date() && pkg.status !== 'completed';
    const finalStatus = isExpired ? 'expired' : pkg.status;

    div.className = `package-card status-${finalStatus}`;
    if (finalStatus === 'completed') {
        div.classList.add('completed');
    }

    const statusLabel = {
        'active': 'Ativo',
        'expired': 'Expirado',
        'completed': 'Concluído'
    }[finalStatus];

    const bathsUsed = pkg.bath_count || 0;
    const groomUsed = pkg.groom_count || 0;
    const isActive = finalStatus === 'active';
    const renewalCount = pkg.renewal_count || 0;

    // Photo HTML
    const photoHtml = pkg.pet_photo
        ? `<img src="${pkg.pet_photo}" alt="${pkg.pet_name}" class="pkg-photo" onclick="openImageViewer('${pkg.pet_photo.replace(/'/g, "\\'")}')">`
        : `<div class="pkg-photo-placeholder"><i class="fa-solid fa-paw"></i></div>`;

    // Bubbles
    let bubblesHtml = '';
    for (let i = 1; i <= 4; i++) {
        const isUsed = i <= bathsUsed;
        const bubbleClass = isUsed ? 'used' : (isActive ? '' : 'disabled');
        const clickAction = (isActive && !isUsed && i === bathsUsed + 1)
            ? `onclick="registerUsage(${pkg.id}, 'bath', this)"`
            : '';
        bubblesHtml += `<div class="bubble ${bubbleClass}" ${clickAction}>${i}</div>`;
    }

    // Groom
    const groomClass = groomUsed > 0 ? 'used' : (isActive ? '' : 'disabled');
    const groomAction = (isActive && groomUsed === 0)
        ? `onclick="registerUsage(${pkg.id}, 'grooming', this)"`
        : '';

    // Pass attributes safely by encoding
    const pkgData = encodeURIComponent(JSON.stringify(pkg));

    // Renewal badge (only show if renewal_count > 0) - inline with pet name
    const renewalBadgeHtml = renewalCount > 0
        ? `<span class="renewal-badge">
               <i class="fa-solid fa-rotate"></i> ${renewalCount}x
           </span>`
        : '';

    // Renewal overlay (only for completed packages)
    const renewalOverlayHtml = finalStatus === 'completed'
        ? `<div class="renewal-overlay">
               <button class="btn-renew" onclick="renewPackage(${pkg.id})">
                   <i class="fa-solid fa-rotate"></i>
                   Renovar Pacote
               </button>
           </div>`
        : '';

    div.innerHTML = `
        ${renewalOverlayHtml}
        <div class="pkg-header">
            <div class="pkg-header-left">
                ${photoHtml}
                <div class="pkg-header-info">
                    <span class="pkg-pet-name">${pkg.pet_name}${renewalBadgeHtml}</span>
                    <span class="pkg-owner-name">${pkg.owner_name}</span>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem;">
                <span class="pkg-badge ${finalStatus}">${statusLabel}</span>
                <div class="pkg-actions-menu">
                    <button class="btn-icon-sm" onclick="editPackageHandler('${pkgData}')"><i class="fa-solid fa-pencil"></i></button>
                    <button class="btn-icon-sm delete" onclick="requestDeletePackage(${pkg.id})"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        </div>
        
        <div class="pkg-body">
            <div class="pkg-info-row">
                <span><i class="fa-regular fa-calendar-plus"></i> Criado: ${window.formatDate(pkg.created_at)}</span>
                 <span><i class="fa-solid fa-phone"></i> ${pkg.phone || '-'}</span>
            </div>
            ${pkg.observation ? `<div class="pkg-info-row" style="font-style:italic; font-size:0.8rem;">"${pkg.observation}"</div>` : ''}
        </div>

        <div class="pkg-progress-section">
            <div class="progress-label">Banhos <small>${bathsUsed}/4</small></div>
            <div class="bath-bubbles">
                ${bubblesHtml}
            </div>

            <div class="groom-check ${groomClass}" ${groomAction}>
                <div class="check-circle"><i class="fa-solid fa-check"></i></div>
                <span>Tosa Higiênica</span>
            </div>
        </div>
    `;

    return div;
};

// decode wrapper
window.editPackageHandler = (pkgData) => {
    const pkg = JSON.parse(decodeURIComponent(pkgData));
    openPackageModal(pkg);
};

window.registerUsage = async (id, type, el) => {
    if (el.classList.contains('disabled') || el.classList.contains('used')) return;
    el.style.opacity = '0.5';

    try {
        const res = await fetch(`${API_BASE}/packages/${id}/usage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ service_type: type })
        });

        if (res.ok) {
            const data = await res.json();
            showToast(data.message);
            if (data.completed) {
                loadPackages();
            } else {
                loadPackages(document.getElementById('search-packages').value);
            }
        } else {
            const err = await res.json();
            showToast(err.error);
            el.style.opacity = '1';
        }
    } catch (e) {
        showToast('Erro ao registrar uso');
        el.style.opacity = '1';
    }
};

const setupSearch = () => {
    const input = document.getElementById('search-packages');
    if (input) {
        let timeout;
        input.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                loadPackages(e.target.value);
            }, 300);
        });
    }
};

// Renew Package Function
window.renewPackage = async (id) => {
    try {
        const res = await fetch(`${API_BASE}/packages/${id}/renew`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (res.ok) {
            const data = await res.json();
            showToast(data.message);
            loadPackages(document.getElementById('search-packages').value);
        } else {
            const err = await res.json();
            showToast(err.error || 'Erro ao renovar pacote');
        }
    } catch (e) {
        console.error(e);
        showToast('Erro de conexão ao renovar pacote');
    }
};

// ===== PHOTO UPLOAD FUNCTIONS =====

function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('Por favor, selecione uma imagem válida', 'error');
        return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('Imagem muito grande. Máximo 5MB', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        resizeImage(event.target.result, 200, 200, (resizedBase64) => {
            displayPhotoPreview(resizedBase64);
            document.getElementById('pkg-photo-base64').value = resizedBase64;
        });
    };
    reader.readAsDataURL(file);
}

function resizeImage(base64, maxWidth, maxHeight, callback) {
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > height) {
            if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
            }
        } else {
            if (height > maxHeight) {
                width *= maxHeight / height;
                height = maxHeight;
            }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        callback(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = base64;
}

function displayPhotoPreview(base64) {
    const preview = document.getElementById('photo-preview');
    const btnRemove = document.getElementById('btn-remove-photo');

    preview.innerHTML = `<img src="${base64}" alt="Pet photo">`;
    preview.classList.add('has-photo');
    btnRemove.style.display = 'flex';
}

function resetPhotoPreview() {
    const preview = document.getElementById('photo-preview');
    const btnRemove = document.getElementById('btn-remove-photo');
    const base64Input = document.getElementById('pkg-photo-base64');
    const fileInput = document.getElementById('pkg-photo-input');

    preview.innerHTML = `
        <i class="fa-solid fa-camera"></i>
        <span>Clique para adicionar foto</span>
    `;
    preview.classList.remove('has-photo');
    btnRemove.style.display = 'none';
    base64Input.value = '';
    fileInput.value = '';
}

function removePhoto() {
    resetPhotoPreview();
    showToast('Foto removida');
}

// ===== IMAGE VIEWER FUNCTIONS =====

window.openImageViewer = function (imageSrc) {
    const modal = document.getElementById('image-viewer-modal');
    const img = document.getElementById('viewer-image');

    img.src = imageSrc;
    modal.style.display = 'flex';

    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
};

window.closeImageViewer = function () {
    const modal = document.getElementById('image-viewer-modal');

    modal.classList.remove('show');

    setTimeout(() => {
        modal.style.display = 'none';
        document.getElementById('viewer-image').src = '';
    }, 300);
};
