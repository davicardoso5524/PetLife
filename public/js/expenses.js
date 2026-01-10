// ===== EXPENSES MODULE =====
// Modern expense management system

// State
let currentMonth = new Date().getMonth() + 1;
let currentYear = new Date().getFullYear();
let currentCategories = [];
let currentExpenses = [];
let editingCategoryId = null;

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
    const subtitle = document.querySelector('.subtitle');
    if (subtitle) {
        subtitle.textContent = `${monthNames[currentMonth - 1]} ${currentYear}`;
    }
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

    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Category modal
    document.getElementById('btn-new-category').addEventListener('click', openNewCategoryModal);
    document.getElementById('category-form').addEventListener('submit', saveCategoryForm);

    // Copy previous month button (if exists)
    const copyBtn = document.getElementById('btn-copy-previous');
    if (copyBtn) {
        copyBtn.addEventListener('click', copyFromPreviousMonth);
    }
}

// ===== TAB SWITCHING =====
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');

    // Load data for specific tabs
    if (tabName === 'categories') {
        loadCategories();
    } else if (tabName === 'monthly') {
        loadMonthlyData();
    }
}

// ===== COPY PREVIOUS MONTH =====
async function copyFromPreviousMonth() {
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    try {
        // Get previous month expenses
        const response = await fetch(`${API_BASE}/expenses/entries?year=${prevYear}&month=${prevMonth}`);
        const data = await response.json();
        const previousExpenses = data.data;

        if (!previousExpenses || previousExpenses.length === 0) {
            showToast('Não há despesas no mês anterior para copiar', 'error');
            return;
        }

        // Create new entries for current month
        let copiedCount = 0;
        for (const exp of previousExpenses) {
            if (exp.category_id) {
                await fetch(`${API_BASE}/expenses/entries`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        category_id: exp.category_id,
                        year: currentYear,
                        month: currentMonth,
                        value: exp.value || 0,
                        status: 'pending',
                        payment_date: null
                    })
                });
                copiedCount++;
            }
        }

        showToast(`${copiedCount} despesas copiadas com sucesso!`);
        loadMonthlyData();
    } catch (error) {
        console.error('Error copying previous month:', error);
        showToast('Erro ao copiar despesas', 'error');
    }
}

// ===== DATA LOADING =====
async function loadMonthlyData() {
    try {
        // Load expenses for the month
        const response = await fetch(`${API_BASE}/expenses/entries?year=${currentYear}&month=${currentMonth}`);
        const data = await response.json();
        currentExpenses = data.data;

        renderExpenseCards(currentExpenses);
        loadSummary();
        loadCashFlow(); // Load cash flow data
    } catch (error) {
        console.error('Error loading monthly data:', error);
        showToast('Erro ao carregar despesas', 'error');
    }
}

async function loadSummary() {
    try {
        const response = await fetch(`${API_BASE}/expenses/summary?year=${currentYear}&month=${currentMonth}`);
        const data = await response.json();

        // Update summary cards
        document.getElementById('summary-total').textContent = formatCurrency(data.current_month.total);
        document.getElementById('summary-pending').textContent = formatCurrency(data.current_month.pending);

        // Comparison with visual indicators
        const diff = data.comparison.difference;
        const percent = data.comparison.percent_change;
        const comparisonEl = document.getElementById('summary-comparison');

        if (diff === 0) {
            comparisonEl.innerHTML = '<i class="fa-solid fa-minus"></i> Sem alteração';
            comparisonEl.style.color = '#9ca3af';
        } else {
            const arrow = diff > 0 ? '<i class="fa-solid fa-arrow-trend-up"></i>' : '<i class="fa-solid fa-arrow-trend-down"></i>';
            const color = diff > 0 ? '#ef4444' : '#10b981';
            comparisonEl.innerHTML = `${arrow} ${formatCurrency(Math.abs(diff))} (${Math.abs(percent).toFixed(1)}%)`;
            comparisonEl.style.color = color;
        }
    } catch (error) {
        console.error('Error loading summary:', error);
    }
}

async function loadCashFlow() {
    try {
        const response = await fetch(`${API_BASE}/cash-flow/${currentYear}/${currentMonth}`);
        const data = await response.json();

        // Update period label
        document.getElementById('cf-period').textContent = `${monthNames[currentMonth - 1]} ${currentYear}`;

        // Update revenue
        document.getElementById('cf-revenue').textContent = formatCurrency(data.revenue);

        // Update expenses
        document.getElementById('cf-expenses').textContent = formatCurrency(data.expenses);

        // Update balance with color indicator
        const balanceCard = document.getElementById('cf-balance-card');
        const balanceValue = document.getElementById('cf-balance');
        const balanceStatus = document.getElementById('cf-balance-status');

        balanceValue.textContent = formatCurrency(data.balance);

        // Remove previous classes
        balanceCard.classList.remove('positive', 'negative');

        // Add appropriate class and status text
        if (data.balance > 0) {
            balanceCard.classList.add('positive');
            balanceStatus.textContent = 'Saldo positivo';
            balanceStatus.style.color = '#10b981';
        } else if (data.balance < 0) {
            balanceCard.classList.add('negative');
            balanceStatus.textContent = 'Saldo negativo';
            balanceStatus.style.color = '#ef4444';
        } else {
            balanceStatus.textContent = 'Equilibrado';
            balanceStatus.style.color = '#9ca3af';
        }
    } catch (error) {
        console.error('Error loading cash flow:', error);
        // Don't show toast to avoid annoying the user
    }
}

async function loadCategories() {
    try {
        const response = await fetch(`${API_BASE}/expenses/categories`);
        const data = await response.json();
        currentCategories = data.data;
        renderCategoriesList(currentCategories);
    } catch (error) {
        console.error('Error loading categories:', error);
        showToast('Erro ao carregar categorias', 'error');
    }
}

// ===== RENDERING =====
function renderExpenseCards(expenses) {
    const grid = document.getElementById('expenses-grid');

    if (!expenses || expenses.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-inbox"></i>
                <p>Nenhuma categoria cadastrada ainda.</p>
                <p class="subtitle">Vá para a aba "Cadastro" para criar suas categorias de despesas.</p>
                <button class="btn-primary" onclick="copyFromPreviousMonth()" style="margin-top:1rem;">
                    <i class="fa-solid fa-copy"></i> Copiar Mês Anterior
                </button>
            </div>
        `;
        return;
    }

    grid.innerHTML = expenses.map(exp => createExpenseCard(exp)).join('');

    // Add event listeners to cards
    attachExpenseCardListeners();
}

function createExpenseCard(expense) {
    const hasEntry = expense.entry_id !== null;
    const budgeted = expense.default_value || 0;
    const actual = hasEntry ? expense.value : budgeted;
    const status = hasEntry ? expense.status : 'pending';
    const isPaid = status === 'paid';

    // Calculate variance
    const variance = isPaid ? actual - budgeted : 0;
    const variancePercent = budgeted > 0 ? ((variance / budgeted) * 100).toFixed(0) : 0;

    const categoryIcons = {
        'fixa': '📌',
        'variavel': '📊',
        'pessoal': '👤',
        'operacional': '⚙️'
    };

    const icon = categoryIcons[expense.category_type] || '💰';
    const prevValueText = expense.prev_value ? `Mês anterior: ${formatCurrency(expense.prev_value)}` : '';

    return `
        <div class="expense-card ${isPaid ? 'paid' : ''}" data-category-id="${expense.category_id}" data-entry-id="${expense.entry_id || ''}" data-status="${status}">
            <div class="expense-header">
                <div class="expense-info">
                    <span class="expense-icon">${icon}</span>
                    <div>
                        <h3>${expense.name}</h3>
                        <span class="expense-category">${expense.category_type}</span>
                        ${expense.supplier ? `<span class="expense-supplier"><i class="fa-solid fa-building"></i> ${expense.supplier}</span>` : ''}
                    </div>
                </div>
                <button class="btn-history" data-category-id="${expense.category_id}" title="Ver histórico">
                    <i class="fa-solid fa-chart-line"></i>
                </button>
            </div>
            
            <div class="expense-body">
                <div class="expense-values">
                    <div class="value-row">
                        <span class="value-label">Orçado</span>
                        <span class="value-amount">R$ ${budgeted.toFixed(2)}</span>
                    </div>
                    ${isPaid ? `
                        <div class="value-row">
                            <span class="value-label">Real</span>
                            <span class="value-amount ${variance > 0 ? 'text-danger' : variance < 0 ? 'text-success' : ''}">
                                R$ ${actual.toFixed(2)}
                            </span>
                        </div>
                        ${variance !== 0 ? `
                            <div class="variance-indicator ${variance > 0 ? 'negative' : 'positive'}">
                                <i class="fa-solid fa-${variance > 0 ? 'arrow-trend-up' : 'arrow-trend-down'}"></i>
                                <span>${variance > 0 ? '+' : ''}${variancePercent}%</span>
                            </div>
                        ` : ''}
                    ` : `
                        <div class="value-input-wrapper">
                            <span class="currency">R$</span>
                            <input type="number" 
                                   class="expense-value" 
                                   value="${actual.toFixed(2)}" 
                                   step="0.01" 
                                   min="0"
                                   data-category-id="${expense.category_id}">
                        </div>
                        ${prevValueText ? `<span class="previous-value">${prevValueText}</span>` : ''}
                    `}
                </div>
            </div>
            
            <div class="expense-footer">
                <div class="status-toggle">
                    ${!isPaid ? `
                        <button class="status-btn btn-mark-paid" data-status="paid">
                            <i class="fa-solid fa-check-circle"></i> Marcar como Pago
                        </button>
                    ` : `
                        <button class="status-btn btn-mark-pending" data-status="pending">
                            <i class="fa-solid fa-circle"></i> Marcar como Pendente
                        </button>
                    `}
                </div>
            </div>
        </div>
    `;
}

function attachExpenseCardListeners() {
    // Value input blur (auto-save)
    document.querySelectorAll('.expense-value').forEach(input => {
        input.addEventListener('blur', async (e) => {
            const categoryId = e.target.dataset.categoryId;
            const value = parseFloat(e.target.value) || 0;
            await saveExpenseEntry(categoryId, value, 'pending');
        });
    });

    // Mark as paid buttons
    document.querySelectorAll('.btn-mark-paid').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const card = e.currentTarget.closest('.expense-card');
            const categoryId = card.dataset.categoryId;
            const valueInput = card.querySelector('.expense-value');
            const value = valueInput ? parseFloat(valueInput.value) || 0 : 0;

            await saveExpenseEntry(categoryId, value, 'paid');
            loadMonthlyData(); // Refresh to show variance
        });
    });

    // Mark as pending buttons
    document.querySelectorAll('.btn-mark-pending').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const card = e.currentTarget.closest('.expense-card');
            const categoryId = card.dataset.categoryId;

            await saveExpenseEntry(categoryId, 0, 'pending');
            loadMonthlyData(); // Refresh
        });
    });

    // History buttons
    document.querySelectorAll('.btn-history').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const categoryId = e.currentTarget.dataset.categoryId;
            showHistory(categoryId);
        });
    });
}

function renderCategoriesList(categories) {
    const list = document.getElementById('categories-list');

    if (!categories || categories.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-folder-open"></i>
                <p>Nenhuma categoria cadastrada.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = categories.map(cat => `
        <div class="category-item ${cat.is_active ? '' : 'archived'}">
            <div class="category-info">
                <h3>${cat.name}</h3>
                <span class="badge badge-${cat.category_type}">${cat.category_type}</span>
                ${cat.default_value > 0 ? `<span class="default-value">Padrão: ${formatCurrency(cat.default_value)}</span>` : ''}
            </div>
            <div class="category-actions">
                <button class="btn-icon" onclick="editCategory(${cat.id})" title="Editar">
                    <i class="fa-solid fa-edit"></i>
                </button>
                <button class="btn-icon" onclick="toggleArchiveCategory(${cat.id}, ${cat.is_active})" title="${cat.is_active ? 'Arquivar' : 'Ativar'}">
                    <i class="fa-solid fa-${cat.is_active ? 'archive' : 'box-open'}"></i>
                </button>
                <button class="btn-icon btn-danger" onclick="deleteCategory(${cat.id})" title="Excluir">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// ===== EXPENSE OPERATIONS =====
async function saveExpenseEntry(categoryId, value, status) {
    try {
        const response = await fetch(`${API_BASE}/expenses/entries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category_id: categoryId,
                year: currentYear,
                month: currentMonth,
                value: value,
                status: status,
                payment_date: status === 'paid' ? new Date().toISOString().split('T')[0] : null
            })
        });

        if (response.ok) {
            showToast('Salvo!');
            loadSummary(); // Refresh summary
        } else {
            throw new Error('Failed to save');
        }
    } catch (error) {
        console.error('Error saving expense:', error);
        showToast('Erro ao salvar', 'error');
    }
}

// ===== CATEGORY OPERATIONS =====
function openNewCategoryModal() {
    editingCategoryId = null;
    document.getElementById('category-modal-title').textContent = 'Nova Categoria';
    document.getElementById('category-form').reset();
    document.getElementById('category-id').value = '';

    const modal = document.getElementById('category-modal');
    modal.classList.add('active');
    modal.classList.add('show');

    // Animate modal content
    setTimeout(() => {
        const content = modal.querySelector('.modal-content');
        if (content) content.classList.add('animate-in');
    }, 10);
}

function closeCategoryModal() {
    const modal = document.getElementById('category-modal');
    const content = modal.querySelector('.modal-content');

    if (content) content.classList.remove('animate-in');
    modal.classList.remove('show');

    setTimeout(() => {
        modal.classList.remove('active');
    }, 300);

    editingCategoryId = null;
}

async function editCategory(id) {
    const category = currentCategories.find(c => c.id === id);
    if (!category) return;

    editingCategoryId = id;
    document.getElementById('category-modal-title').textContent = 'Editar Categoria';
    document.getElementById('category-id').value = id;
    document.getElementById('category-name').value = category.name;
    document.getElementById('category-type').value = category.category_type;
    document.getElementById('category-default-value').value = category.default_value || '';

    const modal = document.getElementById('category-modal');
    modal.classList.add('active');
    modal.classList.add('show');

    // Animate modal content
    setTimeout(() => {
        const content = modal.querySelector('.modal-content');
        if (content) content.classList.add('animate-in');
    }, 10);
}

async function saveCategoryForm(e) {
    e.preventDefault();

    const id = document.getElementById('category-id').value;
    const name = document.getElementById('category-name').value;
    const category_type = document.getElementById('category-type').value;
    const default_value = parseFloat(document.getElementById('category-default-value').value) || 0;

    const data = { name, category_type, default_value, frequency: 'monthly' };

    try {
        const url = id ? `${API_BASE}/expenses/categories/${id}` : `${API_BASE}/expenses/categories`;
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            showToast(id ? 'Categoria atualizada!' : 'Categoria criada!');
            closeCategoryModal();
            loadCategories();
            loadMonthlyData(); // Refresh monthly view
        } else {
            throw new Error('Failed to save category');
        }
    } catch (error) {
        console.error('Error saving category:', error);
        showToast('Erro ao salvar categoria', 'error');
    }
}

async function deleteCategory(id) {
    if (!confirm('Tem certeza que deseja excluir esta categoria?')) return;

    try {
        const response = await fetch(`${API_BASE}/expenses/categories/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Categoria excluída!');
            loadCategories();
            loadMonthlyData();
        } else {
            const error = await response.json();
            showToast(error.error || 'Erro ao excluir', 'error');
        }
    } catch (error) {
        console.error('Error deleting category:', error);
        showToast('Erro ao excluir categoria', 'error');
    }
}

async function toggleArchiveCategory(id, currentlyActive) {
    try {
        const response = await fetch(`${API_BASE}/expenses/categories/${id}/archive`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: currentlyActive ? 0 : 1 })
        });

        if (response.ok) {
            showToast(currentlyActive ? 'Categoria arquivada!' : 'Categoria ativada!');
            loadCategories();
            loadMonthlyData();
        }
    } catch (error) {
        console.error('Error toggling archive:', error);
        showToast('Erro ao arquivar/ativar', 'error');
    }
}

// ===== HISTORY =====
async function showHistory(categoryId) {
    try {
        const response = await fetch(`${API_BASE}/expenses/history/${categoryId}?months=12`);
        const data = await response.json();

        // Find category name from currentExpenses or fetch it
        let categoryName = 'Despesa';
        const expense = currentExpenses.find(e => e.category_id == categoryId);
        if (expense && expense.name) {
            categoryName = expense.name;
        }

        document.getElementById('history-modal-title').textContent = `Histórico: ${categoryName}`;

        const content = document.getElementById('history-content');

        if (!data.data || data.data.length === 0) {
            content.innerHTML = '<p class="subtitle">Nenhum histórico disponível ainda.</p>';
        } else {
            content.innerHTML = `
                <table class="history-table">
                    <thead>
                        <tr>
                            <th>Mês/Ano</th>
                            <th>Valor</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.data.map(entry => `
                            <tr>
                                <td>${entry.month.toString().padStart(2, '0')}/${entry.year}</td>
                                <td>${formatCurrency(entry.value)}</td>
                                <td><span class="badge badge-${entry.status}">${translateStatus(entry.status)}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        // Show modal with proper classes for visibility
        const modal = document.getElementById('history-modal');
        modal.classList.add('active');
        modal.classList.add('show');
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) modalContent.classList.add('animate-in');
    } catch (error) {
        console.error('Error loading history:', error);
        showToast('Erro ao carregar histórico', 'error');
    }
}

function closeHistoryModal() {
    const modal = document.getElementById('history-modal');
    modal.classList.remove('show');
    modal.classList.remove('active');
    const content = modal.querySelector('.modal-content');
    if (content) content.classList.remove('animate-in');
}

// ===== UTILITIES =====
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function translateStatus(status) {
    const translations = {
        'pending': 'Pendente',
        'paid': 'Pago',
        'skipped': 'Não houve'
    };
    return translations[status] || status;
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

// Sidebar toggle (reuse from app.js)
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}
