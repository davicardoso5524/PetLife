// ===== BILLS MODULE (Contas a Pagar) =====

const API_BASE = 'http://localhost:3000/api';

// State
let currentMonth = new Date().getMonth() + 1;
let currentYear = new Date().getFullYear();
let currentBills = [];
let editingBillId = null;

// Month names
const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    initializeFromURL();
    initializeMonthSelector();
    setupEventListeners();
    loadMonthlyData();
});

// ===== URL PARAMETERS =====
function initializeFromURL() {
    const params = new URLSearchParams(window.location.search);
    const urlMonth = params.get('month');
    const urlYear = params.get('year');

    if (urlMonth) currentMonth = parseInt(urlMonth);
    if (urlYear) currentYear = parseInt(urlYear);
}

function updateURL() {
    const url = new URL(window.location);
    url.searchParams.set('month', currentMonth);
    url.searchParams.set('year', currentYear);
    window.history.pushState({}, '', url);
}

// ===== MONTH SELECTOR =====
function initializeMonthSelector() {
    const monthSelect = document.getElementById('month-select');
    const yearSelect = document.getElementById('year-select');

    // Set current month
    monthSelect.value = currentMonth;

    // Populate years (current year ± 5 years)
    for (let i = currentYear - 5; i <= currentYear + 5; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        if (i === currentYear) option.selected = true;
        yearSelect.appendChild(option);
    }

    updateSubtitle();
}

function updateSubtitle() {
    const subtitle = document.getElementById('month-subtitle');
    const breadcrumb = document.getElementById('breadcrumb-month');
    const monthYear = `${monthNames[currentMonth - 1]} ${currentYear}`;

    subtitle.textContent = monthYear;
    if (breadcrumb) breadcrumb.textContent = monthYear;
}

function navigateMonth(direction) {
    currentMonth += direction;

    if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
    } else if (currentMonth < 1) {
        currentMonth = 12;
        currentYear--;
    }

    document.getElementById('month-select').value = currentMonth;
    document.getElementById('year-select').value = currentYear;

    updateSubtitle();
    updateURL();
    loadMonthlyData();
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Month navigation
    document.getElementById('prev-month').addEventListener('click', () => navigateMonth(-1));
    document.getElementById('next-month').addEventListener('click', () => navigateMonth(1));

    document.getElementById('month-select').addEventListener('change', (e) => {
        currentMonth = parseInt(e.target.value);
        updateSubtitle();
        updateURL();
        loadMonthlyData();
    });

    document.getElementById('year-select').addEventListener('change', (e) => {
        currentYear = parseInt(e.target.value);
        updateSubtitle();
        updateURL();
        loadMonthlyData();
    });

    // New bill button
    document.getElementById('btn-new-bill').addEventListener('click', openNewBillModal);

    // Bill form
    document.getElementById('bill-form').addEventListener('submit', saveBillForm);

    // Installment checkbox
    document.getElementById('bill-installment-check').addEventListener('change', (e) => {
        const installmentRow = document.getElementById('installment-row');
        installmentRow.style.display = e.target.checked ? 'block' : 'none';
    });

    // Filters
    document.getElementById('search-input').addEventListener('input', debounce(loadMonthlyData, 300));
    document.getElementById('status-filter').addEventListener('change', loadMonthlyData);
    document.getElementById('category-filter').addEventListener('change', loadMonthlyData);
}

// ===== DATA LOADING =====
async function loadMonthlyData() {
    try {
        const search = document.getElementById('search-input').value;
        const status = document.getElementById('status-filter').value;

        let url = `${API_BASE}/bills?year=${currentYear}&month=${currentMonth}`;
        if (status !== 'all') url += `&status=${status}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;

        const response = await fetch(url);
        const data = await response.json();
        currentBills = data.data;

        renderBills(currentBills);
        loadSummary();
    } catch (error) {
        console.error('Error loading bills:', error);
        showToast('Erro ao carregar contas', 'error');
    }
}

async function loadSummary() {
    try {
        const response = await fetch(`${API_BASE}/bills/summary?year=${currentYear}&month=${currentMonth}`);
        const data = await response.json();

        // Update summary cards
        document.getElementById('summary-pending').textContent = formatCurrency(data.pending);
        document.getElementById('summary-pending-count').textContent = `${data.counts.pending} contas`;

        document.getElementById('summary-overdue').textContent = formatCurrency(data.overdue);
        document.getElementById('summary-overdue-count').textContent = `${data.counts.overdue} contas`;

        document.getElementById('summary-paid').textContent = formatCurrency(data.paid);
        document.getElementById('summary-paid-count').textContent = `${data.counts.paid} contas`;

        // Calculate upcoming (next 7 days)
        const today = new Date();
        const next7Days = new Date(today);
        next7Days.setDate(next7Days.getDate() + 7);

        const upcomingBills = currentBills.filter(bill => {
            if (bill.status !== 'pending') return false;
            const dueDate = new Date(bill.due_date);
            return dueDate >= today && dueDate <= next7Days;
        });

        const upcomingTotal = upcomingBills.reduce((sum, bill) => sum + bill.amount, 0);
        document.getElementById('summary-upcoming').textContent = formatCurrency(upcomingTotal);
        document.getElementById('summary-upcoming-count').textContent = `${upcomingBills.length} contas`;

    } catch (error) {
        console.error('Error loading summary:', error);
    }
}

// ===== RENDERING =====
function renderBills(bills) {
    const container = document.getElementById('bills-container');

    if (!bills || bills.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-inbox"></i>
                <p>Nenhuma conta encontrada para este mês.</p>
                <button class="btn-primary" onclick="openNewBillModal()">
                    <i class="fa-solid fa-plus"></i> Adicionar Conta
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="bills-list">
            ${bills.map(bill => createBillCard(bill)).join('')}
        </div>
    `;

    attachBillCardListeners();
}

function createBillCard(bill) {
    const dueDate = new Date(bill.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    const isOverdue = bill.status === 'pending' && dueDate < today;
    const isPaid = bill.status === 'paid';

    const statusClass = isPaid ? 'paid' : (isOverdue ? 'overdue' : 'pending');
    const statusIcon = isPaid ? 'check-circle' : (isOverdue ? 'triangle-exclamation' : 'clock');
    const statusText = isPaid ? 'Paga' : (isOverdue ? 'Vencida' : 'Pendente');

    const categoryIcons = {
        'fornecedores': '📦',
        'servicos': '⚙️',
        'aluguel': '🏠',
        'outros': '📋'
    };

    const icon = categoryIcons[bill.category] || '💰';

    return `
        <div class="bill-card ${statusClass}" data-bill-id="${bill.id}">
            <div class="bill-header">
                <div class="bill-info">
                    <span class="bill-icon">${icon}</span>
                    <div>
                        <h3>${bill.description}</h3>
                        ${bill.supplier ? `<span class="bill-supplier"><i class="fa-solid fa-building"></i> ${bill.supplier}</span>` : ''}
                        ${bill.is_installment ? `<span class="installment-badge"><i class="fa-solid fa-credit-card"></i> Parcela ${bill.installment_number}/${bill.total_installments}</span>` : ''}
                    </div>
                </div>
                <div class="bill-actions">
                    <button class="btn-icon" onclick="editBill(${bill.id})" title="Editar">
                        <i class="fa-solid fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-danger" onclick="deleteBill(${bill.id})" title="Excluir">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>

            <div class="bill-body">
                <div class="bill-details">
                    <div class="bill-detail">
                        <i class="fa-solid fa-calendar"></i>
                        <span>Vence dia ${dueDate.getDate().toString().padStart(2, '0')} de ${monthNames[dueDate.getMonth()]}</span>
                    </div>
                    ${bill.category ? `
                        <div class="bill-detail">
                            <i class="fa-solid fa-tag"></i>
                            <span>${bill.category}</span>
                        </div>
                    ` : ''}
                </div>

                <div class="bill-amount-section">
                    <span class="bill-amount">${formatCurrency(bill.amount)}</span>
                    <span class="bill-status status-${statusClass}">
                        <i class="fa-solid fa-${statusIcon}"></i> ${statusText}
                    </span>
                </div>
            </div>

            ${bill.status === 'pending' ? `
                <div class="bill-footer">
                    <button class="btn-mark-paid" data-bill-id="${bill.id}">
                        <i class="fa-solid fa-check"></i> Marcar como Pago
                    </button>
                </div>
            ` : ''}

            ${bill.status === 'paid' ? `
                <div class="bill-footer">
                    <button class="btn-mark-pending" data-bill-id="${bill.id}">
                        <i class="fa-solid fa-rotate-left"></i> Marcar como Pendente
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

function attachBillCardListeners() {
    // Mark as paid buttons
    document.querySelectorAll('.btn-mark-paid').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const billId = e.currentTarget.dataset.billId;
            await updateBillStatus(billId, 'paid');
        });
    });

    // Mark as pending buttons
    document.querySelectorAll('.btn-mark-pending').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const billId = e.currentTarget.dataset.billId;
            await updateBillStatus(billId, 'pending');
        });
    });
}

// ===== BILL OPERATIONS =====
function openNewBillModal() {
    editingBillId = null;
    document.getElementById('bill-modal-title').textContent = 'Nova Conta';
    document.getElementById('bill-form').reset();
    document.getElementById('bill-id').value = '';
    document.getElementById('bill-installment-check').checked = false;
    document.getElementById('installment-row').style.display = 'none';

    const modal = document.getElementById('bill-modal');
    modal.style.display = 'flex';
    modal.classList.add('active');
    modal.classList.add('show');

    // Animate modal content
    setTimeout(() => {
        const content = modal.querySelector('.modal-content');
        if (content) content.classList.add('animate-in');
    }, 10);
}

function closeBillModal() {
    const modal = document.getElementById('bill-modal');
    const content = modal.querySelector('.modal-content');

    if (content) content.classList.remove('animate-in');
    modal.classList.remove('show');
    modal.classList.remove('active');

    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);

    editingBillId = null;
}

async function editBill(id) {
    const bill = currentBills.find(b => b.id === id);
    if (!bill) return;

    editingBillId = id;
    document.getElementById('bill-modal-title').textContent = 'Editar Conta';
    document.getElementById('bill-id').value = id;
    document.getElementById('bill-description').value = bill.description;
    document.getElementById('bill-amount').value = bill.amount;
    document.getElementById('bill-due-date').value = bill.due_date;
    document.getElementById('bill-category').value = bill.category || '';
    document.getElementById('bill-supplier').value = bill.supplier || '';
    document.getElementById('bill-notes').value = bill.notes || '';

    const modal = document.getElementById('bill-modal');
    modal.style.display = 'flex';
    modal.classList.add('active');
    modal.classList.add('show');

    // Animate modal content
    setTimeout(() => {
        const content = modal.querySelector('.modal-content');
        if (content) content.classList.add('animate-in');
    }, 10);
}

async function saveBillForm(e) {
    e.preventDefault();

    const id = document.getElementById('bill-id').value;
    const description = document.getElementById('bill-description').value;
    const amount = parseFloat(document.getElementById('bill-amount').value);
    const due_date = document.getElementById('bill-due-date').value;
    const category = document.getElementById('bill-category').value;
    const supplier = document.getElementById('bill-supplier').value;
    const notes = document.getElementById('bill-notes').value;
    const isInstallment = document.getElementById('bill-installment-check').checked;
    const total_installments = isInstallment ? parseInt(document.getElementById('bill-installments').value) : 1;

    const data = { description, amount, due_date, category, supplier, notes, total_installments };

    try {
        const url = id ? `${API_BASE}/bills/${id}` : `${API_BASE}/bills`;
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            showToast(result.message);
            closeBillModal();
            loadMonthlyData();
        } else {
            throw new Error(result.error || 'Erro ao salvar');
        }
    } catch (error) {
        console.error('Error saving bill:', error);
        showToast('Erro ao salvar conta', 'error');
    }
}

async function updateBillStatus(id, status) {
    try {
        const response = await fetch(`${API_BASE}/bills/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        if (response.ok) {
            showToast(status === 'paid' ? 'Conta marcada como paga!' : 'Conta marcada como pendente!');
            loadMonthlyData();
        } else {
            throw new Error('Failed to update status');
        }
    } catch (error) {
        console.error('Error updating status:', error);
        showToast('Erro ao atualizar status', 'error');
    }
}

async function deleteBill(id) {
    openConfirmModal(
        'Confirmar Exclusão',
        'Tem certeza que deseja excluir esta conta?',
        async () => {
            try {
                const response = await fetch(`${API_BASE}/bills/${id}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    showToast('Conta excluída com sucesso!');
                    loadMonthlyData();
                } else {
                    throw new Error('Failed to delete');
                }
            } catch (error) {
                console.error('Error deleting bill:', error);
                showToast('Erro ao excluir conta', 'error');
            }
        }
    );
}

// ===== CONFIRMATION MODAL =====
function openConfirmModal(title, message, onConfirm) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;

    const modal = document.getElementById('confirm-modal');
    const confirmBtn = document.getElementById('confirm-action-btn');

    // Remove previous listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    // Add new listener
    newConfirmBtn.addEventListener('click', () => {
        closeConfirmModal();
        onConfirm();
    });

    modal.style.display = 'flex';
    modal.classList.add('active');
    modal.classList.add('show');

    setTimeout(() => {
        const content = modal.querySelector('.modal-content');
        if (content) content.classList.add('animate-in');
    }, 10);
}

function closeConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    const content = modal.querySelector('.modal-content');

    if (content) content.classList.remove('animate-in');
    modal.classList.remove('show');
    modal.classList.remove('active');

    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

// ===== UTILITIES =====
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
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

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Sidebar toggle (reuse from app.js)
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}
