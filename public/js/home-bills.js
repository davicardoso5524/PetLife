// ===== HOME PAGE - BILLS ANNUAL VIEW =====

const API_BASE = 'http://localhost:3000/api';
let currentYearBills = new Date().getFullYear();

const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeBillsView();
    setupBillsEventListeners();
});

function initializeBillsView() {
    document.getElementById('current-year-bills').textContent = currentYearBills;
    loadBillsAnnualSummary();
}

function setupBillsEventListeners() {
    document.getElementById('prev-year-bills').addEventListener('click', () => navigateYearBills(-1));
    document.getElementById('next-year-bills').addEventListener('click', () => navigateYearBills(1));
}

function navigateYearBills(direction) {
    currentYearBills += direction;
    document.getElementById('current-year-bills').textContent = currentYearBills;
    loadBillsAnnualSummary();
}

async function loadBillsAnnualSummary() {
    try {
        const response = await fetch(`${API_BASE}/bills/annual-summary?year=${currentYearBills}`);
        const data = await response.json();

        // Calculate totals
        let yearTotal = 0;
        let yearPending = 0;
        let yearPaid = 0;
        let totalCount = 0;
        let pendingCount = 0;

        data.data.forEach(month => {
            yearTotal += month.total;
            yearPending += month.pending;
            yearPaid += month.paid;
            totalCount += month.pending_count;
            pendingCount += month.pending_count;
        });

        // Update summary cards
        document.getElementById('bills-year-total').textContent = formatCurrency(yearTotal);
        document.getElementById('bills-year-count').textContent = `${totalCount} contas`;
        document.getElementById('bills-year-pending').textContent = formatCurrency(yearPending);
        document.getElementById('bills-year-pending-count').textContent = `${pendingCount} contas`;
        document.getElementById('bills-year-paid').textContent = formatCurrency(yearPaid);

        // Render monthly grid
        renderMonthlyBillsGrid(data.data);

    } catch (error) {
        console.error('Error loading bills annual summary:', error);
    }
}

function renderMonthlyBillsGrid(monthlyData) {
    const grid = document.getElementById('bills-monthly-grid');

    const html = monthlyData.map((month, index) => {
        const monthName = monthNames[index];
        const isCurrentMonth = (index + 1) === new Date().getMonth() + 1 && currentYearBills === new Date().getFullYear();

        return `
            <a href="bills.html?month=${index + 1}&year=${currentYearBills}" class="month-bill-card ${isCurrentMonth ? 'current' : ''}">
                <div class="month-card-header">
                    <h3>${monthName}</h3>
                    ${isCurrentMonth ? '<span class="current-badge">ATUAL</span>' : ''}
                </div>
                <div class="month-card-body">
                    <div class="month-stat">
                        <span class="stat-label">Total</span>
                        <span class="stat-value">${formatCurrency(month.total)}</span>
                    </div>
                    <div class="month-stats-row">
                        ${month.pending_count > 0 ? `
                            <div class="month-stat-small pending">
                                <i class="fa-solid fa-clock"></i>
                                <span>${month.pending_count} pendentes</span>
                            </div>
                        ` : '<div class="month-stat-small success"><i class="fa-solid fa-check"></i> <span>Tudo pago</span></div>'}
                    </div>
                </div>
            </a>
        `;
    }).join('');

    grid.innerHTML = html;
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}
