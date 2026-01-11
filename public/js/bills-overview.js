// ===== BILLS OVERVIEW PAGE - ANNUAL VIEW =====

(function () {
    'use strict';

    const API_URL = API_BASE || 'http://localhost:3000/api';
    let currentYear = new Date().getFullYear();

    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        initializeOverview();
        setupEventListeners();
    }

    function initializeOverview() {
        const yearElement = document.getElementById('current-year');
        if (yearElement) {
            yearElement.textContent = currentYear;
        }
        loadAnnualSummary();
    }

    function setupEventListeners() {
        const prevBtn = document.getElementById('prev-year');
        const nextBtn = document.getElementById('next-year');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => navigateYear(-1));
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => navigateYear(1));
        }
    }

    function navigateYear(direction) {
        currentYear += direction;
        const yearElement = document.getElementById('current-year');
        if (yearElement) {
            yearElement.textContent = currentYear;
        }
        loadAnnualSummary();
    }

    async function loadAnnualSummary() {
        try {
            const response = await fetch(`${API_URL}/bills/annual-summary?year=${currentYear}`);
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
            updateElement('year-total', formatCurrency(yearTotal));
            updateElement('year-count', `${totalCount} contas`);
            updateElement('year-pending', formatCurrency(yearPending));
            updateElement('year-pending-count', `${pendingCount} contas`);
            updateElement('year-paid', formatCurrency(yearPaid));

            // Render monthly grid
            renderMonthGrid(data.data);

        } catch (error) {
            console.error('Error loading bills annual summary:', error);
        }
    }

    function updateElement(id, text) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = text;
        }
    }

    function renderMonthGrid(monthlyData) {
        const grid = document.getElementById('bills-monthly-grid');
        if (!grid) {
            console.error('Grid element not found');
            return;
        }

        const html = monthlyData.map((month, index) => {
            const monthName = monthNames[index];
            const isCurrentMonth = (index + 1) === new Date().getMonth() + 1 && currentYear === new Date().getFullYear();

            // Determine status message
            let statusHtml;
            if (month.total === 0) {
                // No bills at all
                statusHtml = '<div class="month-stat-small" style="color: var(--text-muted);"><i class="fa-solid fa-inbox"></i> <span>Sem contas</span></div>';
            } else if (month.pending_count > 0) {
                // Has pending bills
                statusHtml = `
                    <div class="month-stat-small pending">
                        <i class="fa-solid fa-clock"></i>
                        <span>${month.pending_count} pendentes</span>
                    </div>
                `;
            } else {
                // All paid
                statusHtml = '<div class="month-stat-small success"><i class="fa-solid fa-check"></i> <span>Tudo pago</span></div>';
            }

            return `
                <a href="bills.html?month=${index + 1}&year=${currentYear}" class="month-bill-card ${isCurrentMonth ? 'current' : ''}">
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
                            ${statusHtml}
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
})();
