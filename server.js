const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const db = require('./database/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rota para salvar uma venda (Upsert)
app.post('/api/sales', (req, res) => {
    let { date, money, pix, debit, credit, observation } = req.body;

    // Parse values robustly (handle strings, nulls, undefined)
    const valMoney = parseFloat(money) || 0;
    const valPix = parseFloat(pix) || 0;
    const valDebit = parseFloat(debit) || 0;
    const valCredit = parseFloat(credit) || 0;
    // Sanitize observation slightly (optional, but good practice to trim)
    const obs = observation ? observation.trim() : '';

    if (!date) {
        return res.status(400).json({ error: 'Data é obrigatória.' });
    }

    // Calcula total automaticamente
    const amount = valMoney + valPix + valDebit + valCredit;

    // Changes: INSERT simples, sem ON CONFLICT
    const sql = `INSERT INTO sales (date, amount, form_money, form_pix, form_debit, form_credit, observation) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [date, amount, valMoney, valPix, valDebit, valCredit, obs], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: 'Venda salva com sucesso!', id: this.lastID });
    });
});

// Rota para obter vendas (opcionalmente filtradas por mês, ano e dia)
app.get('/api/sales', (req, res) => {
    const { month, year, day } = req.query;
    let sql = 'SELECT * FROM sales ORDER BY date DESC';
    let params = [];

    if (month && year) {
        const monthStr = month.toString().padStart(2, '0');

        if (day) {
            // Filtro específico por dia (YYYY-MM-DD)
            const dayStr = day.toString().padStart(2, '0');
            sql = 'SELECT * FROM sales WHERE date = ? ORDER BY date DESC'; // No need to sort by date for single day strictly but good for order
            params = [`${year}-${monthStr}-${dayStr}`];
        } else {
            // Filtro por mês (YYYY-MM%)
            sql = 'SELECT * FROM sales WHERE date LIKE ? ORDER BY date ASC';
            params = [`${year}-${monthStr}%`];
        }
    }

    db.all(sql, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ data: rows });
    });
});

// Rota para obter dados do Dashboard
app.get('/api/dashboard', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const currentYear = new Date().getFullYear();
    const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');

    // Total do Dia (Agora pode ter múltiplas linhas, usar SUM)
    const sqlDay = 'SELECT SUM(amount) as total FROM sales WHERE date = ?';

    // Total do Mês
    const sqlMonth = 'SELECT SUM(amount) as total FROM sales WHERE date LIKE ?';

    // Total do Ano
    const sqlYear = 'SELECT SUM(amount) as total FROM sales WHERE date LIKE ?';

    db.get(sqlDay, [today], (err, dayRow) => {
        if (err) return res.status(500).json({ error: err.message });

        db.get(sqlMonth, [`${currentYear}-${currentMonth}%`], (err, monthRow) => {
            if (err) return res.status(500).json({ error: err.message });

            db.get(sqlYear, [`${currentYear}-%`], (err, yearRow) => {
                if (err) return res.status(500).json({ error: err.message });

                res.json({
                    day: dayRow ? dayRow.total : 0,
                    // dayDetailed: Removed single detailed row logic as it's now aggregate
                    month: monthRow ? monthRow.total : 0,
                    year: yearRow ? yearRow.total : 0
                });
            });
        });
    });
});

// Rota para excluir uma venda
app.delete('/api/sales/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM sales WHERE id = ?', id, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Venda excluída com sucesso' });
    });
});


// --- PACKAGES MODULE ---

// 1. Create Package
app.post('/api/packages', (req, res) => {
    const { pet_name, owner_name, phone, price, created_at, observation, pet_photo } = req.body;

    if (!pet_name || !owner_name || !created_at) {
        return res.status(400).json({ error: 'Campos obrigatórios: Nome do Pet, Tutor e Data de Criação.' });
    }

    // Calculate expires_at as 1 month from created_at
    const createdDate = new Date(created_at);
    const expiresDate = new Date(createdDate);
    expiresDate.setMonth(expiresDate.getMonth() + 1);
    const expires_at = expiresDate.toISOString().split('T')[0];

    const status = 'active';

    const sql = `INSERT INTO packages (pet_name, owner_name, phone, price, created_at, expires_at, observation, status, pet_photo)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [pet_name, owner_name, phone, price || 0, created_at, expires_at, observation, status, pet_photo || null], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Pacote criado com sucesso!', id: this.lastID });
    });
});

// 2. List Packages
app.get('/api/packages', (req, res) => {
    const { status, search } = req.query;
    let sql = `SELECT p.*, 
            COALESCE(p.renewal_count, 0) as renewal_count,
            (SELECT COUNT(*) FROM package_usage u WHERE u.package_id = p.id AND u.service_type = 'bath') as bath_count,
            (SELECT COUNT(*) FROM package_usage u WHERE u.package_id = p.id AND u.service_type = 'grooming') as groom_count
           FROM packages p `;

    let conditions = [];
    let params = [];

    if (status && status !== 'all') {
        conditions.push("p.status = ?");
        params.push(status);
    }

    if (search) {
        conditions.push("(p.pet_name LIKE ? OR p.owner_name LIKE ?)");
        params.push(`%${search}%`);
        params.push(`%${search}%`);
    }

    if (conditions.length > 0) {
        sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY p.created_at DESC";

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        // Auto-expire check logic could go here or in a background job. 
        // For simplicity, frontend handles visual expiration, or we update on fetch.
        res.json({ data: rows });
    });
});

// 3. Register Usage
app.post('/api/packages/:id/usage', (req, res) => {
    const { id } = req.params;
    const { service_type } = req.body; // 'bath' or 'grooming'
    const used_at = new Date().toISOString().split('T')[0];

    db.get(`SELECT * FROM packages WHERE id = ?`, [id], (err, pkg) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!pkg) return res.status(404).json({ error: 'Pacote não encontrado.' });
        if (pkg.status !== 'active') return res.status(400).json({ error: 'Pacote não está ativo.' });

        // Check limits
        db.all(`SELECT service_type FROM package_usage WHERE package_id = ?`, [id], (err, usages) => {
            if (err) return res.status(500).json({ error: err.message });

            const baths = usages.filter(u => u.service_type === 'bath').length;
            const grooms = usages.filter(u => u.service_type === 'grooming').length;

            if (service_type === 'bath' && baths >= 4) {
                return res.status(400).json({ error: 'Limite de banhos (4) atingido.' });
            }
            if (service_type === 'grooming' && grooms >= 1) {
                return res.status(400).json({ error: 'Limite de tosa (1) atingido.' });
            }

            const usage_number = (service_type === 'bath') ? baths + 1 : 1;

            db.run(`INSERT INTO package_usage (package_id, service_type, used_at, usage_number)
                    VALUES (?, ?, ?, ?)`, [id, service_type, used_at, usage_number], function (err) {
                if (err) return res.status(500).json({ error: err.message });

                // Check completion
                const newBaths = (service_type === 'bath') ? baths + 1 : baths;
                const newGrooms = (service_type === 'grooming') ? grooms + 1 : grooms;

                if (newBaths >= 4 && newGrooms >= 1) {
                    db.run(`UPDATE packages SET status = 'completed' WHERE id = ?`, [id]);
                    return res.json({ message: 'Uso registrado e Pacote Concluído!', completed: true });
                }

                res.json({ message: 'Uso registrado com sucesso!', completed: false });
            });
        });
    });
});

// 4. Update Package
app.put('/api/packages/:id', (req, res) => {
    const { id } = req.params;
    const { pet_name, owner_name, phone, price, created_at, observation, pet_photo } = req.body;

    if (!pet_name || !owner_name || !created_at) {
        return res.status(400).json({ error: 'Campos obrigatórios: Nome do Pet, Tutor e Data de Criação.' });
    }

    // Calculate expires_at as 1 month from created_at
    const createdDate = new Date(created_at);
    const expiresDate = new Date(createdDate);
    expiresDate.setMonth(expiresDate.getMonth() + 1);
    const expires_at = expiresDate.toISOString().split('T')[0];

    const sql = `UPDATE packages 
                 SET pet_name = ?, owner_name = ?, phone = ?, price = ?, created_at = ?, expires_at = ?, observation = ?, pet_photo = ?
                 WHERE id = ?`;

    db.run(sql, [pet_name, owner_name, phone, price, created_at, expires_at, observation, pet_photo || null, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Pacote atualizado com sucesso!' });
    });
});

// 5. Delete Package
app.delete('/api/packages/:id', (req, res) => {
    const { id } = req.params;

    // First delete usage records
    db.run(`DELETE FROM package_usage WHERE package_id = ?`, [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        // Then delete package
        db.run(`DELETE FROM packages WHERE id = ?`, [id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Pacote excluído com sucesso.' });
        });
    });
});

// 6. Manual Update Status (Close/Expire)
app.put('/api/packages/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    db.run(`UPDATE packages SET status = ? WHERE id = ?`, [status, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Status atualizado.' });
    });
});

// 7. Renew Package (Reset usage and increment counter)
app.post('/api/packages/:id/renew', (req, res) => {
    const { id } = req.params;

    // First, check if package exists and is completed
    db.get(`SELECT * FROM packages WHERE id = ?`, [id], (err, pkg) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!pkg) return res.status(404).json({ error: 'Pacote não encontrado.' });
        if (pkg.status !== 'completed') {
            return res.status(400).json({ error: 'Apenas pacotes concluídos podem ser renovados.' });
        }

        db.serialize(() => {
            // Delete all usage records
            db.run(`DELETE FROM package_usage WHERE package_id = ?`, [id], (err) => {
                if (err) return res.status(500).json({ error: err.message });

                // Update package: increment renewal_count, set status to active, update expires_at
                const newExpiresAt = new Date();
                newExpiresAt.setMonth(newExpiresAt.getMonth() + 1); // 1 month from now
                const expiresAtStr = newExpiresAt.toISOString().split('T')[0];

                db.run(
                    `UPDATE packages 
                     SET status = 'active', 
                         renewal_count = renewal_count + 1,
                         expires_at = ?
                     WHERE id = ?`,
                    [expiresAtStr, id],
                    function (err) {
                        if (err) return res.status(500).json({ error: err.message });

                        // Fetch updated package
                        db.get(`SELECT * FROM packages WHERE id = ?`, [id], (err, updatedPkg) => {
                            if (err) return res.status(500).json({ error: err.message });
                            res.json({
                                message: 'Pacote renovado com sucesso!',
                                package: updatedPkg
                            });
                        });
                    }
                );
            });
        });
    });
});

// --- EXPENSES MODULE ---

// 1. Create Expense Category
app.post('/api/expenses/categories', (req, res) => {
    const { name, category_type, frequency, default_value } = req.body;

    if (!name || !category_type) {
        return res.status(400).json({ error: 'Nome e tipo são obrigatórios.' });
    }

    const created_at = new Date().toISOString().split('T')[0];
    const sql = `INSERT INTO expense_categories (name, category_type, frequency, default_value, created_at)
                 VALUES (?, ?, ?, ?, ?)`;

    db.run(sql, [name, category_type, frequency || 'monthly', default_value || 0, created_at], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Categoria criada com sucesso!', id: this.lastID });
    });
});

// 2. List Expense Categories
app.get('/api/expenses/categories', (req, res) => {
    const { active_only } = req.query;
    let sql = 'SELECT * FROM expense_categories';

    if (active_only === 'true') {
        sql += ' WHERE is_active = 1';
    }

    sql += ' ORDER BY name ASC';

    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// 3. Update Expense Category
app.put('/api/expenses/categories/:id', (req, res) => {
    const { id } = req.params;
    const { name, category_type, frequency, default_value } = req.body;

    if (!name || !category_type) {
        return res.status(400).json({ error: 'Nome e tipo são obrigatórios.' });
    }

    const sql = `UPDATE expense_categories 
                 SET name = ?, category_type = ?, frequency = ?, default_value = ?
                 WHERE id = ?`;

    db.run(sql, [name, category_type, frequency, default_value, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Categoria atualizada com sucesso!' });
    });
});

// 4. Delete Expense Category
app.delete('/api/expenses/categories/:id', (req, res) => {
    const { id } = req.params;

    // Check if category has entries
    db.get('SELECT COUNT(*) as count FROM expense_entries WHERE category_id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (row.count > 0) {
            return res.status(400).json({ error: 'Não é possível excluir categoria com lançamentos. Arquive-a.' });
        }

        db.run('DELETE FROM expense_categories WHERE id = ?', [id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Categoria excluída com sucesso.' });
        });
    });
});

// 5. Archive/Unarchive Category
app.put('/api/expenses/categories/:id/archive', (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body;

    db.run('UPDATE expense_categories SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: is_active ? 'Categoria ativada.' : 'Categoria arquivada.' });
    });
});

// 6. Get Monthly Expenses (with auto-population from previous month)
app.get('/api/expenses/entries', (req, res) => {
    const { year, month } = req.query;

    if (!year || !month) {
        return res.status(400).json({ error: 'Ano e mês são obrigatórios.' });
    }

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    // Calculate previous month
    let prevYear = yearNum;
    let prevMonth = monthNum - 1;
    if (prevMonth === 0) {
        prevMonth = 12;
        prevYear--;
    }

    // Get all active categories with their entries for the requested month
    // and previous month values for auto-population
    const sql = `
        SELECT 
            c.id as category_id,
            c.name,
            c.category_type,
            c.default_value,
            e.id as entry_id,
            e.value,
            e.status,
            e.payment_date,
            e.observation,
            prev.value as prev_value
        FROM expense_categories c
        LEFT JOIN expense_entries e ON c.id = e.category_id AND e.year = ? AND e.month = ?
        LEFT JOIN expense_entries prev ON c.id = prev.category_id AND prev.year = ? AND prev.month = ?
        WHERE c.is_active = 1
        ORDER BY c.name ASC
    `;

    db.all(sql, [yearNum, monthNum, prevYear, prevMonth], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// 7. Create/Update Expense Entry (Upsert)
app.post('/api/expenses/entries', (req, res) => {
    const { category_id, year, month, value, status, payment_date, observation } = req.body;

    if (!category_id || !year || !month) {
        return res.status(400).json({ error: 'Categoria, ano e mês são obrigatórios.' });
    }

    const now = new Date().toISOString();
    const sql = `INSERT INTO expense_entries (category_id, year, month, value, status, payment_date, observation, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(category_id, year, month) 
                 DO UPDATE SET 
                    value = excluded.value,
                    status = excluded.status,
                    payment_date = excluded.payment_date,
                    observation = excluded.observation,
                    updated_at = excluded.updated_at`;

    db.run(sql, [
        category_id,
        year,
        month,
        value || 0,
        status || 'pending',
        payment_date || null,
        observation || '',
        now,
        now
    ], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Lançamento salvo com sucesso!', id: this.lastID });
    });
});

// 8. Update Entry Status
app.put('/api/expenses/entries/:id/status', (req, res) => {
    const { id } = req.params;
    const { status, payment_date } = req.body;

    const now = new Date().toISOString();
    const sql = `UPDATE expense_entries 
                 SET status = ?, payment_date = ?, updated_at = ?
                 WHERE id = ?`;

    db.run(sql, [status, payment_date || null, now, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Status atualizado.' });
    });
});

// 9. Delete Expense Entry
app.delete('/api/expenses/entries/:id', (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM expense_entries WHERE id = ?', [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Lançamento excluído.' });
    });
});

// 10. Get Monthly Summary
app.get('/api/expenses/summary', (req, res) => {
    const { year, month } = req.query;

    if (!year || !month) {
        return res.status(400).json({ error: 'Ano e mês são obrigatórios.' });
    }

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    // Calculate previous month
    let prevYear = yearNum;
    let prevMonth = monthNum - 1;
    if (prevMonth === 0) {
        prevMonth = 12;
        prevYear--;
    }

    // Current month totals
    const sqlCurrent = `
        SELECT 
            SUM(CASE WHEN status != 'skipped' THEN value ELSE 0 END) as total,
            SUM(CASE WHEN status = 'pending' THEN value ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'paid' THEN value ELSE 0 END) as paid,
            COUNT(*) as total_entries
        FROM expense_entries
        WHERE year = ? AND month = ?
    `;

    // Previous month total
    const sqlPrevious = `
        SELECT SUM(CASE WHEN status != 'skipped' THEN value ELSE 0 END) as total
        FROM expense_entries
        WHERE year = ? AND month = ?
    `;

    // Breakdown by category
    const sqlBreakdown = `
        SELECT 
            c.name,
            c.category_type,
            e.value,
            e.status
        FROM expense_entries e
        JOIN expense_categories c ON e.category_id = c.id
        WHERE e.year = ? AND e.month = ? AND e.status != 'skipped'
        ORDER BY e.value DESC
    `;

    db.get(sqlCurrent, [yearNum, monthNum], (err, current) => {
        if (err) return res.status(500).json({ error: err.message });

        db.get(sqlPrevious, [prevYear, prevMonth], (err, previous) => {
            if (err) return res.status(500).json({ error: err.message });

            db.all(sqlBreakdown, [yearNum, monthNum], (err, breakdown) => {
                if (err) return res.status(500).json({ error: err.message });

                const currentTotal = current.total || 0;
                const previousTotal = previous.total || 0;
                const difference = currentTotal - previousTotal;
                const percentChange = previousTotal > 0 ? ((difference / previousTotal) * 100) : 0;

                res.json({
                    current_month: {
                        total: currentTotal,
                        pending: current.pending || 0,
                        paid: current.paid || 0,
                        entries_count: current.total_entries || 0
                    },
                    previous_month: {
                        total: previousTotal
                    },
                    comparison: {
                        difference: difference,
                        percent_change: percentChange
                    },
                    breakdown: breakdown
                });
            });
        });
    });
});

// 11. Get Category History
app.get('/api/expenses/history/:categoryId', (req, res) => {
    const { categoryId } = req.params;
    const { months } = req.query;

    const limit = months ? parseInt(months) : 12;

    const sql = `
        SELECT year, month, value, status
        FROM expense_entries
        WHERE category_id = ?
        ORDER BY year DESC, month DESC
        LIMIT ?
    `;

    db.all(sql, [categoryId, limit], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows.reverse() }); // Reverse to show oldest first
    });
});

// --- BILLS MODULE (Contas a Pagar) ---

// 1. Create Bill (with installment support)
app.post('/api/bills', (req, res) => {
    const { description, amount, due_date, category, supplier, notes, total_installments } = req.body;

    if (!description || !amount || !due_date) {
        return res.status(400).json({ error: 'Descrição, valor e data de vencimento são obrigatórios.' });
    }

    const now = new Date().toISOString();
    const installments = parseInt(total_installments) || 1;

    if (installments === 1) {
        // Single bill
        const sql = `INSERT INTO bills (description, amount, due_date, category, supplier, notes, status, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`;

        db.run(sql, [description, amount, due_date, category, supplier, notes, now, now], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: 'Conta criada com sucesso!', id: this.lastID });
        });
    } else {
        // Multiple installments
        const installmentGroupId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const installmentAmount = parseFloat((amount / installments).toFixed(2));
        const baseDueDate = new Date(due_date);

        db.serialize(() => {
            const stmt = db.prepare(`INSERT INTO bills 
                (description, amount, due_date, category, supplier, notes, status, 
                 is_installment, installment_number, total_installments, installment_group_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 'pending', 1, ?, ?, ?, ?, ?)`);

            for (let i = 0; i < installments; i++) {
                const installmentDueDate = new Date(baseDueDate);
                installmentDueDate.setMonth(installmentDueDate.getMonth() + i);
                const dueDateStr = installmentDueDate.toISOString().split('T')[0];
                const installmentDesc = `${description} (${i + 1}/${installments})`;

                stmt.run([
                    installmentDesc,
                    installmentAmount,
                    dueDateStr,
                    category,
                    supplier,
                    notes,
                    i + 1,
                    installments,
                    installmentGroupId,
                    now,
                    now
                ]);
            }

            stmt.finalize((err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.status(201).json({
                    message: `${installments} parcelas criadas com sucesso!`,
                    installment_group_id: installmentGroupId
                });
            });
        });
    }
});

// 2. List Bills (with month/year filter)
app.get('/api/bills', (req, res) => {
    const { year, month, status, search } = req.query;
    let sql = 'SELECT * FROM bills WHERE 1=1';
    let params = [];

    if (year && month) {
        const yearNum = parseInt(year);
        const monthNum = parseInt(month);
        const monthStr = monthNum.toString().padStart(2, '0');
        sql += ' AND strftime("%Y-%m", due_date) = ?';
        params.push(`${yearNum}-${monthStr}`);
    }

    if (status && status !== 'all') {
        sql += ' AND status = ?';
        params.push(status);
    }

    if (search) {
        sql += ' AND (description LIKE ? OR supplier LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY due_date ASC';

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// 3. Get Monthly Summary
app.get('/api/bills/summary', (req, res) => {
    const { year, month } = req.query;

    if (!year || !month) {
        return res.status(400).json({ error: 'Ano e mês são obrigatórios.' });
    }

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    const monthStr = monthNum.toString().padStart(2, '0');
    const dateFilter = `${yearNum}-${monthStr}`;
    const today = new Date().toISOString().split('T')[0];

    const sql = `
        SELECT 
            COUNT(*) as total_count,
            SUM(amount) as total_amount,
            SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_amount,
            SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid_amount,
            SUM(CASE WHEN status = 'pending' AND due_date < ? THEN amount ELSE 0 END) as overdue_amount,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
            COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
            COUNT(CASE WHEN status = 'pending' AND due_date < ? THEN 1 END) as overdue_count
        FROM bills
        WHERE strftime("%Y-%m", due_date) = ?
    `;

    db.get(sql, [today, today, dateFilter], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
            total: row.total_amount || 0,
            pending: row.pending_amount || 0,
            paid: row.paid_amount || 0,
            overdue: row.overdue_amount || 0,
            counts: {
                total: row.total_count || 0,
                pending: row.pending_count || 0,
                paid: row.paid_count || 0,
                overdue: row.overdue_count || 0
            }
        });
    });
});

// 4. Get Annual Summary (for home page)
app.get('/api/bills/annual-summary', (req, res) => {
    const { year } = req.query;

    if (!year) {
        return res.status(400).json({ error: 'Ano é obrigatório.' });
    }

    const sql = `
        SELECT 
            strftime('%m', due_date) as month,
            SUM(amount) as total,
            SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
        FROM bills
        WHERE strftime('%Y', due_date) = ?
        GROUP BY strftime('%m', due_date)
        ORDER BY month ASC
    `;

    db.all(sql, [year], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        // Create array with all 12 months
        const monthlyData = Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            total: 0,
            pending: 0,
            paid: 0,
            pending_count: 0
        }));

        // Fill with actual data
        rows.forEach(row => {
            const monthIndex = parseInt(row.month) - 1;
            monthlyData[monthIndex] = {
                month: parseInt(row.month),
                total: row.total || 0,
                pending: row.pending || 0,
                paid: row.paid || 0,
                pending_count: row.pending_count || 0
            };
        });

        res.json({ data: monthlyData });
    });
});

// 5. Update Bill
app.put('/api/bills/:id', (req, res) => {
    const { id } = req.params;
    const { description, amount, due_date, category, supplier, notes } = req.body;

    if (!description || !amount || !due_date) {
        return res.status(400).json({ error: 'Descrição, valor e data de vencimento são obrigatórios.' });
    }

    const now = new Date().toISOString();
    const sql = `UPDATE bills 
                 SET description = ?, amount = ?, due_date = ?, category = ?, supplier = ?, notes = ?, updated_at = ?
                 WHERE id = ?`;

    db.run(sql, [description, amount, due_date, category, supplier, notes, now, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Conta atualizada com sucesso!' });
    });
});

// 6. Update Bill Status
app.put('/api/bills/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const now = new Date().toISOString();
    const payment_date = status === 'paid' ? new Date().toISOString().split('T')[0] : null;

    const sql = `UPDATE bills 
                 SET status = ?, payment_date = ?, updated_at = ?
                 WHERE id = ?`;

    db.run(sql, [status, payment_date, now, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Status atualizado.' });
    });
});

// 7. Delete Bill
app.delete('/api/bills/:id', (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM bills WHERE id = ?', [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Conta excluída com sucesso.' });
    });
});

// 8. Get Bills by Installment Group
app.get('/api/bills/installments/:groupId', (req, res) => {
    const { groupId } = req.params;

    const sql = 'SELECT * FROM bills WHERE installment_group_id = ? ORDER BY installment_number ASC';

    db.all(sql, [groupId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// Export/Start Logic

// ===== CASH FLOW ENDPOINT =====

// Get Cash Flow (Revenue vs Expenses)
app.get('/api/cash-flow/:year/:month', (req, res) => {
    const { year, month } = req.params;

    // Calculate Revenue from Sales
    const salesSql = `
        SELECT 
            SUM(amount) as total,
            SUM(form_money) as money,
            SUM(form_pix) as pix,
            SUM(form_debit) as debit,
            SUM(form_credit) as credit
        FROM sales 
        WHERE strftime('%Y', date) = ? AND strftime('%m', date) = ?
    `;

    // Calculate Expenses
    const expensesSql = `
        SELECT SUM(value) as total
        FROM expense_entries
        WHERE year = ? AND month = ?
    `;

    db.get(salesSql, [year, month.padStart(2, '0')], (err, salesData) => {
        if (err) return res.status(500).json({ error: err.message });

        db.get(expensesSql, [year, month], (err, expensesData) => {
            if (err) return res.status(500).json({ error: err.message });

            const revenue = salesData.total || 0;
            const expenses = expensesData.total || 0;
            const balance = revenue - expenses;

            res.json({
                revenue: revenue,
                expenses: expenses,
                balance: balance,
                revenue_breakdown: {
                    money: salesData.money || 0,
                    pix: salesData.pix || 0,
                    debit: salesData.debit || 0,
                    credit: salesData.credit || 0
                }
            });
        });
    });
});

// ===== AUTHENTICATION ENDPOINTS =====

// Middleware to check authentication
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Não autenticado' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Token inválido' });
    }

    db.get(
        `SELECT s.*, u.id as user_id, u.username, u.full_name, u.role, u.is_active
         FROM sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.token = ? AND s.expires_at > datetime('now')`,
        [token],
        (err, session) => {
            if (err || !session) {
                return res.status(401).json({ error: 'Sessão inválida ou expirada' });
            }

            if (!session.is_active) {
                return res.status(403).json({ error: 'Usuário inativo' });
            }

            req.user = {
                id: session.user_id,
                username: session.username,
                full_name: session.full_name,
                role: session.role
            };
            next();
        }
    );
}

// Middleware to check admin role
function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    }
    next();
}

// POST /api/auth/login - Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }

    db.get(
        'SELECT * FROM users WHERE username = ? AND is_active = 1',
        [username],
        (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Erro ao buscar usuário' });
            }

            if (!user) {
                return res.status(401).json({ error: 'Usuário ou senha incorretos' });
            }

            // Verify password
            bcrypt.compare(password, user.password_hash, (err, isMatch) => {
                if (err || !isMatch) {
                    return res.status(401).json({ error: 'Usuário ou senha incorretos' });
                }

                // Generate session token
                const token = crypto.randomBytes(32).toString('hex');
                const expiresAt = new Date();
                expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

                // Create session
                db.run(
                    `INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)`,
                    [user.id, token, expiresAt.toISOString()],
                    (err) => {
                        if (err) {
                            return res.status(500).json({ error: 'Erro ao criar sessão' });
                        }

                        // Update last login
                        db.run(
                            'UPDATE users SET last_login = datetime("now") WHERE id = ?',
                            [user.id]
                        );

                        res.json({
                            token: token,
                            user: {
                                id: user.id,
                                username: user.username,
                                full_name: user.full_name,
                                role: user.role
                            }
                        });
                    }
                );
            });
        }
    );
});

// POST /api/auth/logout - Logout
app.post('/api/auth/logout', requireAuth, (req, res) => {
    const token = req.headers.authorization.split(' ')[1];

    db.run('DELETE FROM sessions WHERE token = ?', [token], (err) => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao fazer logout' });
        }
        res.json({ message: 'Logout realizado com sucesso' });
    });
});

// GET /api/auth/check - Check session
app.get('/api/auth/check', requireAuth, (req, res) => {
    res.json({ user: req.user });
});

// ===== ADMIN ENDPOINTS =====

// GET /api/admin/users - List all users
app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
    db.all(
        'SELECT id, username, full_name, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC',
        [],
        (err, users) => {
            if (err) {
                return res.status(500).json({ error: 'Erro ao buscar usuários' });
            }
            res.json({ users });
        }
    );
});

// POST /api/admin/users - Create user
app.post('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
    const { username, password, full_name, role } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }

    // Hash password
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao processar senha' });
        }

        db.run(
            `INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)`,
            [username, hash, full_name || null, role || 'user'],
            function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.status(400).json({ error: 'Usuário já existe' });
                    }
                    return res.status(500).json({ error: 'Erro ao criar usuário' });
                }

                res.json({
                    message: 'Usuário criado com sucesso',
                    user: {
                        id: this.lastID,
                        username,
                        full_name,
                        role: role || 'user'
                    }
                });
            }
        );
    });
});

// PUT /api/admin/users/:id - Update user
app.put('/api/admin/users/:id', requireAuth, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { username, password, full_name, role, is_active } = req.body;

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (username) {
        updates.push('username = ?');
        values.push(username);
    }
    if (full_name !== undefined) {
        updates.push('full_name = ?');
        values.push(full_name);
    }
    if (role) {
        updates.push('role = ?');
        values.push(role);
    }
    if (is_active !== undefined) {
        updates.push('is_active = ?');
        values.push(is_active ? 1 : 0);
    }

    if (password) {
        // Hash new password
        const hash = bcrypt.hashSync(password, 10);
        updates.push('password_hash = ?');
        values.push(hash);
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    values.push(id);

    db.run(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        values,
        function (err) {
            if (err) {
                return res.status(500).json({ error: 'Erro ao atualizar usuário' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }

            res.json({ message: 'Usuário atualizado com sucesso' });
        }
    );
});

// DELETE /api/admin/users/:id - Delete user
app.delete('/api/admin/users/:id', requireAuth, requireAdmin, (req, res) => {
    const { id } = req.params;

    // Prevent deleting yourself
    if (parseInt(id) === req.user.id) {
        return res.status(400).json({ error: 'Você não pode deletar seu próprio usuário' });
    }

    db.run('DELETE FROM users WHERE id = ?', [id], function (err) {
        if (err) {
            return res.status(500).json({ error: 'Erro ao deletar usuário' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Delete user sessions
        db.run('DELETE FROM sessions WHERE user_id = ?', [id]);

        res.json({ message: 'Usuário deletado com sucesso' });

    });
});

require('./routes/license-routes')(app, db);

function startServer(portByEnv) {
    return new Promise((resolve, reject) => {
        // Use port provided (including 0 for dynamic), or default to 3000 if undefined/null
        const currentPort = portByEnv !== undefined ? portByEnv : PORT;
        const server = app.listen(currentPort, () => {
            console.log(`Servidor rodando em http://localhost:${server.address().port}`);
            resolve(server);
        });
        server.on('error', reject);
    });
}

// Se executado diretamente (node server.js), inicie
if (require.main === module) {
    startServer(PORT);
}

module.exports = { startServer, app };