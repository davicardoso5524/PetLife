const API_URL = API_BASE || 'http://localhost:3000/api';

// Utils
const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

window.toggleSidebar = () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    }
};

window.formatDate = (dateString) => {
    if (!dateString) return '';
    // Fix timezone offset issue by treating the date string strictly as local date
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
};


const getDayOfWeek = (dateString) => {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    // Creating date object with time at 12:00 to avoid timezone shifts
    const d = new Date(`${dateString}T12:00:00`);
    return days[d.getDay()];
};

const showToast = (msg) => {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
};

function setupClock() {
    const clockEl = document.getElementById('clock-display');
    if (!clockEl) return;

    const updateClock = () => {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        clockEl.textContent = `${hours}:${minutes}`;
    };

    updateClock();
    setInterval(updateClock, 1000); // Update every second
}

// Init logic depending on page
// Init logic depending on page
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    // Common Init
    setupClock();

    // Dashboard Logic
    if (!path.includes('reports.html') && !path.includes('packages.html')) {
        loadDashboardData();
        loadRecentActivity();
        setupSalesForm(); // Ensuring this is called
        setupLiveTotal(); // Ensuring this is called

        // Default Date
        const dateInput = document.getElementById('sale-date');
        if (dateInput) {
            dateInput.valueAsDate = new Date();
        }

        // New Sale Button
        const btnNewSale = document.getElementById('btn-new-sale');
        if (btnNewSale) {
            btnNewSale.onclick = window.openSaleModal;
        }

        // Clear Recent
        const btnClear = document.getElementById('btn-clear-recent');
        if (btnClear) {
            btnClear.addEventListener('click', () => {
                const list = document.getElementById('recent-list');
                if (list) {
                    list.innerHTML = '<li class="empty-state">Atividade limpa.</li>';
                    showToast('Atividade recente limpa!');
                }
            });
        }
    }

    // Reports Logic
    if (path.includes('reports.html')) {
        initReports();
    }

    // Close Modals on Outside Click (Global)
    window.addEventListener('click', (e) => {
        const saleModal = document.getElementById('new-sale-modal');
        if (saleModal && e.target == saleModal) closeSaleModal();
    });
});

// --- DASHBOARD LOGIC ---
const initDashboard = () => {
    loadDashboardData();
    setupSalesForm();
    setupLiveTotal();

    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('sale-date');
    if (dateInput) {
        dateInput.value = today;
    }
    // Removed loadDayDetails as we now support multiple entries per day
};

const setupLiveTotal = () => {
    const inputs = document.querySelectorAll('.payment-input');
    inputs.forEach(input => {
        input.addEventListener('input', calculateTotal);
    });
};

const calculateTotal = () => {
    let total = 0;
    document.querySelectorAll('.payment-input').forEach(input => {
        total += parseFloat(input.value) || 0;
    });
    document.getElementById('live-total').textContent = formatCurrency(total);
    return total;
};


const loadDashboardData = async () => {
    // Check if dashboard elements exist before fetching
    const dayEl = document.getElementById('dash-day');
    if (!dayEl) return; // Not on dashboard page

    try {
        const res = await fetch(`${API_URL}/dashboard`);
        const data = await res.json();

        if (dayEl) dayEl.textContent = formatCurrency(data.day || 0);
        const monthEl = document.getElementById('dash-month');
        if (monthEl) monthEl.textContent = formatCurrency(data.month || 0);
        const yearEl = document.getElementById('dash-year');
        if (yearEl) yearEl.textContent = formatCurrency(data.year || 0);

        loadRecentActivity();
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
    }
};

const loadRecentActivity = async () => {
    // Check if list exists
    const list = document.getElementById('recent-list');
    if (!list) return;

    try {
        const res = await fetch(`${API_URL}/sales`);
        const result = await res.json();
        const sales = result.data.slice(0, 5); // Take first 5 recent

        list.innerHTML = '';

        if (sales.length === 0) {
            list.innerHTML = '<li class="empty-state">Nenhum lançamento recente.</li>';
            return;
        }

        sales.forEach(sale => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="date">${formatDate(sale.date)} <small>(${getDayOfWeek(sale.date)})</small></span>
                <span class="amount-val">${formatCurrency(sale.amount)}</span>
            `;
            list.appendChild(li);
        });
    } catch (e) {
        console.error(e);
    }
};

const setupSalesForm = () => {
    const form = document.getElementById('sales-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const date = document.getElementById('sale-date').value;
        const money = document.getElementById('val-money').value;
        const pix = document.getElementById('val-pix').value;
        const debit = document.getElementById('val-debit').value;
        const credit = document.getElementById('val-credit').value;
        const observation = document.getElementById('sale-obs').value;

        // Validation to prevent empty zero sales if desired, or allow them.
        const total = (parseFloat(money) || 0) + (parseFloat(pix) || 0) + (parseFloat(debit) || 0) + (parseFloat(credit) || 0);
        if (total <= 0 && (!observation || observation.trim() === '')) {
            showToast('Insira valor ou observação.');
            return;
        }

        // Parse values ensuring they are numbers for the JSON payload
        const payload = {
            date,
            money: parseFloat(money) || 0,
            pix: parseFloat(pix) || 0,
            debit: parseFloat(debit) || 0,
            credit: parseFloat(credit) || 0,
            observation
        };

        try {
            const res = await fetch(`${API_URL}/sales`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                showToast('Lançamento salvo com sucesso!');
                loadDashboardData(); // Refresh totals and recent list

                // Clear inputs for next entry
                document.querySelectorAll('.payment-input').forEach(i => i.value = '');
                document.getElementById('sale-obs').value = ''; // Clear obs
                calculateTotal(); // Reset live total text

                // Close Modal
                if (typeof closeSaleModal === 'function') closeSaleModal();
            } else {
                const errData = await res.json();
                showToast(`Erro ao salvar: ${errData.error || 'Desconhecido'}`);
            }
        } catch (error) {
            showToast('Erro de conexão.');
        }
    });
};

// --- REPORTS LOGIC ---
let allSales = [];

const initReports = async () => {
    populateFilters();
    setupFilterEvents();

    // Auto load current month report
    await loadReportsData();
};

const populateFilters = () => {
    const monthSelect = document.getElementById('filter-month');
    const daySelect = document.getElementById('filter-day');
    const yearSelect = document.getElementById('filter-year');

    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    months.forEach((m, idx) => {
        const option = document.createElement('option');
        option.value = idx + 1;
        option.textContent = m;
        if (idx === new Date().getMonth()) option.selected = true;
        monthSelect.appendChild(option);
    });

    // Populate Days 1-31
    for (let i = 1; i <= 31; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        daySelect.appendChild(option);
    }
    // Default to 'Todos' (value empty) which is hardcoded in HTML

    const currentYear = new Date().getFullYear();
    for (let i = currentYear; i >= currentYear - 5; i--) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        yearSelect.appendChild(option);
    }
};

const setupFilterEvents = () => {
    document.getElementById('btn-filter').addEventListener('click', loadReportsData);

    // Modal events - Deprecated/Simplified
    const modal = document.getElementById('edit-modal');
    if (modal) {
        document.querySelector('.close-modal').onclick = () => modal.style.display = 'none';
        window.onclick = (e) => {
            if (e.target == modal) modal.style.display = 'none';
        };
    }

    // New delete modal events
    const delModal = document.getElementById('delete-modal');
    const obsModal = document.getElementById('observation-modal');

    if (delModal || obsModal) {
        window.onclick = (e) => {
            if (delModal && (e.target == delModal)) {
                closeDeleteModal();
            }
            if (obsModal && (e.target == obsModal)) {
                closeObservationModal();
            }
        };
    }
};

const loadReportsData = async () => {
    const month = document.getElementById('filter-month').value;
    const year = document.getElementById('filter-year').value;
    const day = document.getElementById('filter-day').value;

    try {
        let url = `${API_URL}/sales?month=${month}&year=${year}`;
        if (day) {
            url += `&day=${day}`;
        }

        const res = await fetch(url);
        const result = await res.json();
        allSales = result.data || [];

        renderSalesTable(allSales);
        renderWeeklySummary(allSales);
        updateReportTotals(allSales); // This will update the summary cards (daily or monthly)

    } catch (error) {
        console.error(error);
    }
};

const renderSalesTable = (sales) => {
    const tbody = document.getElementById('sales-table-body');
    tbody.innerHTML = '';

    if (sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8">Nenhum registro encontrado neste período.</td></tr>';
        return;
    }

    // Sort Descending Date
    const sorted = [...sales].sort((a, b) => b.date.localeCompare(a.date));

    // Group by Date
    const grouped = {};
    sorted.forEach(sale => {
        if (!grouped[sale.date]) grouped[sale.date] = [];
        grouped[sale.date].push(sale);
    });

    // Render Groups
    Object.keys(grouped).forEach(date => {
        const daySales = grouped[date];

        // Calculate Day Totals
        let dMoney = 0, dPix = 0, dDebit = 0, dCredit = 0, dTotal = 0;

        daySales.forEach(sale => {
            const fMoney = parseFloat(sale.form_money) || 0;
            const fPix = parseFloat(sale.form_pix) || 0;
            const fDebit = parseFloat(sale.form_debit) || 0;
            const fCredit = parseFloat(sale.form_credit) || 0;

            dMoney += fMoney;
            dPix += fPix;
            dDebit += fDebit;
            dCredit += fCredit;
            dTotal += sale.amount;

            // Render Sale Row
            const tr = document.createElement('tr');

            // Safe encode for data attribute
            const safeObs = sale.observation ? sale.observation.replace(/"/g, '&quot;') : '';

            const obsDisplay = sale.observation ?
                `<button class="btn-action" onclick="viewObservation(this.dataset.obs)" data-obs="${safeObs}" style="color:#64748b; background:transparent; border:none; cursor:pointer; padding:0;">
                    <i class="fa-regular fa-comment-dots" style="font-size:1.2rem;"></i>
                </button>`
                : '<span style="color:#cbd5e1;">-</span>';

            tr.innerHTML = `
                <td>${formatDate(sale.date)}</td>
                <td>${getDayOfWeek(sale.date)}</td>
                <td class="text-muted">${formatCurrency(fMoney)}</td>
                <td class="text-muted">${formatCurrency(fPix)}</td>
                <td class="text-muted">${formatCurrency(fDebit)}</td>
                <td class="text-muted">${formatCurrency(fCredit)}</td>
                <td style="font-weight: 700; color: var(--primary-color);">${formatCurrency(sale.amount)}</td>
                <td style="text-align:center;">${obsDisplay}</td>
                <td>
                    <button class="btn-action trash" onclick="deleteSale(${sale.id})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Render Day Summary Row
        const summaryTr = document.createElement('tr');
        summaryTr.style.backgroundColor = '#f8fafc';
        summaryTr.style.borderBottom = '2px solid #e2e8f0';
        summaryTr.innerHTML = `
            <td colspan="2" style="text-align:right; font-weight:600; color:#475569;">Total do Dia (${formatDate(date)}):</td>
            <td style="font-weight:600; color:#22c55e;">${formatCurrency(dMoney)}</td>
            <td style="font-weight:600; color:#3b82f6;">${formatCurrency(dPix)}</td>
            <td style="font-weight:600; color:#f59e0b;">${formatCurrency(dDebit)}</td>
            <td style="font-weight:600; color:#8b5cf6;">${formatCurrency(dCredit)}</td>
            <td style="font-weight:800; color:#1e293b; font-size:1.05rem;">${formatCurrency(dTotal)}</td>
            <td colspan="2"></td>
        `;
        tbody.appendChild(summaryTr);
    });
};

const updateReportTotals = (sales) => {
    let tMoney = 0, tPix = 0, tDebit = 0, tCredit = 0, tTotal = 0;

    sales.forEach(s => {
        tMoney += parseFloat(s.form_money) || 0;
        tPix += parseFloat(s.form_pix) || 0;
        tDebit += parseFloat(s.form_debit) || 0;
        tCredit += parseFloat(s.form_credit) || 0;
        tTotal += s.amount;
    });

    document.getElementById('report-month-total').textContent = formatCurrency(tTotal);
    document.getElementById('report-total-money').textContent = formatCurrency(tMoney);
    document.getElementById('report-total-pix').textContent = formatCurrency(tPix);
    document.getElementById('report-total-debit').textContent = formatCurrency(tDebit);
    document.getElementById('report-total-credit').textContent = formatCurrency(tCredit);
};

// Global expose for onclick
// Open custom modal instead of native confirm
window.deleteSale = (id) => {
    // Store ID in hidden input
    document.getElementById('delete-target-id').value = id;
    // Show modal
    const modal = document.getElementById('delete-modal');
    modal.style.display = 'flex';
    requestAnimationFrame(() => {
        modal.classList.add('show');
        const content = modal.querySelector('.modal-content');
        if (content) content.classList.add('animate-in');
    });
};

window.closeDeleteModal = () => {
    const modal = document.getElementById('delete-modal');
    modal.classList.remove('show');
    modal.querySelector('.modal-content').classList.remove('animate-in');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300); // Wait for transition
};

// Actual delete action triggered by modal button
window.confirmDelete = async () => {
    const id = document.getElementById('delete-target-id').value;
    if (!id) return;

    try {
        const res = await fetch(`${API_URL}/sales/${id}`, { method: 'DELETE' });
        if (res.ok) {
            closeDeleteModal();
            showToast('Venda excluída com sucesso.');
            // Refresh current view if possible, or reload
            const m = document.getElementById('filter-month').value;
            const y = document.getElementById('filter-year').value;
            if (m && y) document.getElementById('btn-filter').click();
            else location.reload();
        } else {
            showToast('Erro ao excluir.');
        }
    } catch (e) {
        console.error(e);
        showToast('Erro de conexão.');
    }
};

// Observation Modal Logic
window.viewObservation = (text) => {
    const modal = document.getElementById('observation-modal');
    const textEl = document.getElementById('observation-text');
    if (!modal || !textEl) return;

    textEl.textContent = text;
    modal.style.display = 'flex';
    requestAnimationFrame(() => {
        modal.classList.add('show');
        modal.querySelector('.modal-content').classList.add('animate-in');
    });
};

window.closeObservationModal = () => {
    const modal = document.getElementById('observation-modal');
    if (!modal) return;

    modal.classList.remove('show');
    modal.querySelector('.modal-content').classList.remove('animate-in');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
};

window.openEditModal = (id) => {
    // Legacy support or if we re-enable edit
    // For now we use direct delete
    deleteSale(id);
};

// Calculates weekly totals based on ISO weeks logic roughly, or simply buckets by week of year
const renderWeeklySummary = (sales) => {
    // Sort ascending for easier week grouping
    const sorted = [...sales].sort((a, b) => a.date.localeCompare(b.date));

    const weeklyData = {}; // Key: Week Number, Value: Total

    sorted.forEach(sale => {
        const d = new Date(`${sale.date}T12:00:00`);
        const oneJan = new Date(d.getFullYear(), 0, 1);
        const numberOfDays = Math.floor((d - oneJan) / (24 * 60 * 60 * 1000));
        const weekNum = Math.ceil((d.getDay() + 1 + numberOfDays) / 7);

        if (!weeklyData[weekNum]) weeklyData[weekNum] = 0;
        weeklyData[weekNum] += sale.amount;
    });

    const list = document.getElementById('weekly-list');
    list.innerHTML = '';

    if (Object.keys(weeklyData).length === 0) {
        list.innerHTML = '<li>Sem dados para agrupar.</li>';
        return;
    }

    Object.keys(weeklyData).forEach(week => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="week-label">Semana ${week}</span>
            <span class="week-val">${formatCurrency(weeklyData[week])}</span>
        `;
        list.appendChild(li);
    });
};

// New Sale Modal Logic
window.openSaleModal = () => {
    const modal = document.getElementById('new-sale-modal');
    modal.style.display = 'flex';
    requestAnimationFrame(() => {
        modal.classList.add('show');
        modal.querySelector('.modal-content').classList.add('animate-in');
    });
    // Set default date if empty
    if (!document.getElementById('sale-date').value) {
        document.getElementById('sale-date').valueAsDate = new Date();
    }
    // Calculate totals just in case
    // loadDayDetails(document.getElementById('sale-date').value); // Removed: Function does not exist and isn't needed for new entry

};

window.closeSaleModal = () => {
    const modal = document.getElementById('new-sale-modal');
    modal.classList.remove('show');
    modal.querySelector('.modal-content').classList.remove('animate-in');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
};

// Hook up the button
document.addEventListener('DOMContentLoaded', () => {
    const btnNewSale = document.getElementById('btn-new-sale');
    if (btnNewSale) {
        btnNewSale.onclick = window.openSaleModal;
    }

    // Also add to window clicks
    const saleModal = document.getElementById('new-sale-modal');
    if (saleModal) {
        window.addEventListener('click', (e) => {
            if (e.target == saleModal) closeSaleModal();
        });
    }
});

// Global expose for onclick
// End of file cleanup
// (Removed duplicate legacy functions openEditModal, saveEdit, deleteSale)
