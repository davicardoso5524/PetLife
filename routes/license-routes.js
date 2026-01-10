const licenseUtils = require('../utils/license-utils');
const { verifyAdminToken, generateAdminToken } = require('../middleware/auth-middleware');
const { publicLicenseRateLimiter, adminRateLimiter, loginRateLimiter } = require('../middleware/rate-limiter');
const bcrypt = require('bcryptjs');

module.exports = function (app, db) {

    // Health Check
    app.get('/health', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // --- PUBLIC LICENSE ENDPOINTS ---

    // 1. Validate License (Public)
    app.post('/api/license/validate', publicLicenseRateLimiter, (req, res) => {
        const { key, app_id, machine_id, app_version } = req.body;
        const ip = req.ip || req.connection.remoteAddress;

        if (!key || !app_id || !machine_id) {
            return res.status(400).json({
                valid: false,
                error: 'missing_parameters',
                message: 'Parâmetros obrigatórios: key, app_id, machine_id'
            });
        }

        // Validate key format
        if (!licenseUtils.validateKeyFormat(key)) {
            // Log invalid attempt
            const validationId = licenseUtils.generateUUID();
            db.run(
                `INSERT INTO license_validations (id, machine_id_hash, validated_at, success, error_code, ip_address)
             VALUES (?, ?, ?, ?, ?, ?)`,
                [validationId, machine_id, new Date().toISOString(), 0, 'invalid_format', ip]
            );

            return res.status(400).json({
                valid: false,
                error: 'invalid_format',
                message: 'Formato de chave inválido. Use: XXXX-XXXX-XXXX-XXXX'
            });
        }

        // Find license
        db.get('SELECT * FROM licenses WHERE key = ?', [key], (err, license) => {
            if (err) {
                return res.status(500).json({
                    valid: false,
                    error: 'database_error',
                    message: 'Erro ao verificar licença'
                });
            }

            // License not found
            if (!license) {
                const validationId = licenseUtils.generateUUID();
                db.run(
                    `INSERT INTO license_validations (id, machine_id_hash, validated_at, success, error_code, ip_address)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                    [validationId, machine_id, new Date().toISOString(), 0, 'invalid_key', ip]
                );

                return res.status(401).json({
                    valid: false,
                    error: 'invalid_key',
                    message: 'Chave de licença não encontrada'
                });
            }

            // Check if revoked
            if (license.status === 'revoked') {
                const validationId = licenseUtils.generateUUID();
                db.run(
                    `INSERT INTO license_validations (id, license_id, machine_id_hash, validated_at, success, error_code, ip_address)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [validationId, license.id, machine_id, new Date().toISOString(), 0, 'revoked_key', ip]
                );

                return res.status(403).json({
                    valid: false,
                    error: 'revoked_key',
                    message: 'Esta licença foi revogada'
                });
            }

            // Check if expired
            if (licenseUtils.isLicenseExpired(license.expires_at)) {
                const validationId = licenseUtils.generateUUID();
                db.run(
                    `INSERT INTO license_validations (id, license_id, machine_id_hash, validated_at, success, error_code, ip_address)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [validationId, license.id, machine_id, new Date().toISOString(), 0, 'expired_key', ip]
                );

                return res.status(403).json({
                    valid: false,
                    error: 'expired_key',
                    message: 'Esta licença expirou'
                });
            }

            // Check machine limit
            db.all(
                'SELECT * FROM license_activations WHERE license_id = ?',
                [license.id],
                (err, activations) => {
                    if (err) {
                        return res.status(500).json({
                            valid: false,
                            error: 'database_error',
                            message: 'Erro ao verificar ativações'
                        });
                    }

                    const existingActivation = activations.find(a => a.machine_id_hash === machine_id);

                    if (!existingActivation && activations.length >= license.max_machines) {
                        const validationId = licenseUtils.generateUUID();
                        db.run(
                            `INSERT INTO license_validations (id, license_id, machine_id_hash, validated_at, success, error_code, ip_address)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            [validationId, license.id, machine_id, new Date().toISOString(), 0, 'machine_limit_exceeded', ip]
                        );

                        return res.status(403).json({
                            valid: false,
                            error: 'machine_limit_exceeded',
                            message: `Esta licença já está ativada em ${license.max_machines} máquina(s)`,
                            max_machines: license.max_machines,
                            current_machines: activations.length
                        });
                    }

                    const now = new Date().toISOString();

                    if (existingActivation) {
                        // Update existing activation
                        db.run(
                            `UPDATE license_activations 
                         SET last_validated = ?, app_version = ?, ip_address = ?
                         WHERE id = ?`,
                            [now, app_version, ip, existingActivation.id],
                            (err) => {
                                if (err) {
                                    return res.status(500).json({
                                        valid: false,
                                        error: 'database_error',
                                        message: 'Erro ao atualizar ativação'
                                    });
                                }

                                // Log successful validation
                                const validationId = licenseUtils.generateUUID();
                                db.run(
                                    `INSERT INTO license_validations (id, license_id, machine_id_hash, validated_at, success, ip_address)
                                 VALUES (?, ?, ?, ?, ?, ?)`,
                                    [validationId, license.id, machine_id, now, 1, ip]
                                );

                                res.json({
                                    valid: true,
                                    expires_at: license.expires_at,
                                    features: JSON.parse(license.features || '["full"]'),
                                    max_users: license.max_users,
                                    max_machines: license.max_machines,
                                    current_machines: activations.length
                                });
                            }
                        );
                    } else {
                        // Create new activation
                        const activationId = licenseUtils.generateUUID();
                        db.run(
                            `INSERT INTO license_activations (id, license_id, machine_id_hash, app_version, activated_at, last_validated, ip_address)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            [activationId, license.id, machine_id, app_version, now, now, ip],
                            (err) => {
                                if (err) {
                                    return res.status(500).json({
                                        valid: false,
                                        error: 'database_error',
                                        message: 'Erro ao criar ativação'
                                    });
                                }

                                // Log successful validation
                                const validationId = licenseUtils.generateUUID();
                                db.run(
                                    `INSERT INTO license_validations (id, license_id, machine_id_hash, validated_at, success, ip_address)
                                 VALUES (?, ?, ?, ?, ?, ?)`,
                                    [validationId, license.id, machine_id, now, 1, ip]
                                );

                                res.json({
                                    valid: true,
                                    expires_at: license.expires_at,
                                    features: JSON.parse(license.features || '["full"]'),
                                    max_users: license.max_users,
                                    max_machines: license.max_machines,
                                    current_machines: activations.length + 1
                                });
                            }
                        );
                    }
                }
            );
        });
    });

    // 2. Check License Status (Public)
    app.get('/api/license/status', publicLicenseRateLimiter, (req, res) => {
        const { key } = req.query;

        if (!key) {
            return res.status(400).json({
                error: 'missing_parameter',
                message: 'Parâmetro obrigatório: key'
            });
        }

        db.get('SELECT * FROM licenses WHERE key = ?', [key], (err, license) => {
            if (err || !license) {
                return res.status(404).json({
                    error: 'not_found',
                    message: 'Licença não encontrada'
                });
            }

            // Get activation count
            db.get(
                'SELECT COUNT(*) as count FROM license_activations WHERE license_id = ?',
                [license.id],
                (err, result) => {
                    if (err) {
                        return res.status(500).json({ error: 'Erro ao buscar ativações' });
                    }

                    const active = license.status === 'active' && !licenseUtils.isLicenseExpired(license.expires_at);
                    let daysRemaining = null;

                    if (license.expires_at) {
                        const expiresDate = new Date(license.expires_at);
                        const now = new Date();
                        daysRemaining = Math.ceil((expiresDate - now) / (1000 * 60 * 60 * 24));
                    }

                    res.json({
                        active,
                        status: license.status,
                        expires_at: license.expires_at,
                        days_remaining: daysRemaining,
                        machines_used: result.count,
                        machines_limit: license.max_machines
                    });
                }
            );
        });
    });

    // 3. Deactivate Machine (Public)
    app.post('/api/license/deactivate', publicLicenseRateLimiter, (req, res) => {
        const { key, machine_id } = req.body;

        if (!key || !machine_id) {
            return res.status(400).json({
                error: 'missing_parameters',
                message: 'Parâmetros obrigatórios: key, machine_id'
            });
        }

        db.get('SELECT * FROM licenses WHERE key = ?', [key], (err, license) => {
            if (err || !license) {
                return res.status(404).json({
                    error: 'not_found',
                    message: 'Licença não encontrada'
                });
            }

            db.run(
                'DELETE FROM license_activations WHERE license_id = ? AND machine_id_hash = ?',
                [license.id, machine_id],
                function (err) {
                    if (err) {
                        return res.status(500).json({ error: 'Erro ao desativar máquina' });
                    }

                    if (this.changes === 0) {
                        return res.status(404).json({
                            error: 'not_found',
                            message: 'Máquina não encontrada nas ativações'
                        });
                    }

                    // Get remaining count
                    db.get(
                        'SELECT COUNT(*) as count FROM license_activations WHERE license_id = ?',
                        [license.id],
                        (err, result) => {
                            res.json({
                                message: 'Máquina desativada com sucesso',
                                machines_remaining: result ? result.count : 0
                            });
                        }
                    );
                }
            );
        });
    });

    // --- ADMIN LICENSE ENDPOINTS ---

    // 4. Admin Login
    app.post('/api/admin/license/login', loginRateLimiter, (req, res) => {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username e password são obrigatórios' });
        }

        db.get('SELECT * FROM users WHERE username = ? AND is_active = 1', [username], (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Erro ao buscar usuário' });
            }

            if (!user) {
                return res.status(401).json({ error: 'Credenciais inválidas' });
            }

            bcrypt.compare(password, user.password_hash, (err, isMatch) => {
                if (err || !isMatch) {
                    return res.status(401).json({ error: 'Credenciais inválidas' });
                }

                const token = generateAdminToken(user.id, user.username, user.role);

                res.json({
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        full_name: user.full_name,
                        role: user.role
                    }
                });
            });
        });
    });

    // 5. Create License (Admin)
    app.post('/api/admin/keys', verifyAdminToken, adminRateLimiter, (req, res) => {
        const { expires_in_days, max_machines, max_users, features, notes } = req.body;

        const licenseId = licenseUtils.generateUUID();
        const key = licenseUtils.generateLicenseKey();
        const now = new Date().toISOString();
        const expiresAt = expires_in_days ? licenseUtils.calculateExpirationDate(expires_in_days) : null;

        const sql = `INSERT INTO licenses (id, key, status, created_at, expires_at, max_machines, max_users, features, notes, created_by)
                 VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?, ?)`;

        db.run(
            sql,
            [
                licenseId,
                key,
                now,
                expiresAt,
                max_machines || 1,
                max_users || 5,
                JSON.stringify(features || ['full']),
                notes || '',
                req.user.username
            ],
            function (err) {
                if (err) {
                    return res.status(500).json({ error: 'Erro ao criar licença' });
                }

                res.status(201).json({
                    message: 'Licença criada com sucesso',
                    key,
                    created_at: now,
                    expires_at: expiresAt,
                    max_machines: max_machines || 1,
                    max_users: max_users || 5
                });
            }
        );
    });

    // 6. List Licenses (Admin)
    app.get('/api/admin/keys', verifyAdminToken, adminRateLimiter, (req, res) => {
        const { status, page = 1, limit = 50 } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        let sql = `SELECT l.*, 
                      (SELECT COUNT(*) FROM license_activations WHERE license_id = l.id) as machines_count,
                      (SELECT MAX(validated_at) FROM license_validations WHERE license_id = l.id AND success = 1) as last_validated
               FROM licenses l`;
        let params = [];

        if (status && status !== 'all') {
            sql += ' WHERE l.status = ?';
            params.push(status);
        }

        sql += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        db.all(sql, params, (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Erro ao listar licenças' });
            }

            // Get total count
            let countSql = 'SELECT COUNT(*) as total FROM licenses';
            let countParams = [];

            if (status && status !== 'all') {
                countSql += ' WHERE status = ?';
                countParams.push(status);
            }

            db.get(countSql, countParams, (err, countRow) => {
                const total = countRow ? countRow.total : 0;
                const pages = Math.ceil(total / parseInt(limit));

                res.json({
                    keys: rows.map(row => ({
                        ...row,
                        features: JSON.parse(row.features || '["full"]')
                    })),
                    total,
                    page: parseInt(page),
                    pages
                });
            });
        });
    });

    // 7. Get License Details (Admin)
    app.get('/api/admin/keys/:key', verifyAdminToken, adminRateLimiter, (req, res) => {
        const { key } = req.params;

        db.get('SELECT * FROM licenses WHERE key = ?', [key], (err, license) => {
            if (err || !license) {
                return res.status(404).json({ error: 'Licença não encontrada' });
            }

            // Get activations
            db.all(
                'SELECT * FROM license_activations WHERE license_id = ? ORDER BY activated_at DESC',
                [license.id],
                (err, activations) => {
                    if (err) {
                        return res.status(500).json({ error: 'Erro ao buscar ativações' });
                    }

                    res.json({
                        ...license,
                        features: JSON.parse(license.features || '["full"]'),
                        activations
                    });
                }
            );
        });
    });

    // 8. Revoke License (Admin)
    app.delete('/api/admin/keys/:key', verifyAdminToken, adminRateLimiter, (req, res) => {
        const { key } = req.params;

        db.run(
            'UPDATE licenses SET status = ? WHERE key = ?',
            ['revoked', key],
            function (err) {
                if (err) {
                    return res.status(500).json({ error: 'Erro ao revogar licença' });
                }

                if (this.changes === 0) {
                    return res.status(404).json({ error: 'Licença não encontrada' });
                }

                res.json({
                    message: 'Chave revogada com sucesso',
                    key
                });
            }
        );
    });

    // Test endpoint (development only)
    if (process.env.NODE_ENV !== 'production') {
        app.post('/api/license/test-validate', (req, res) => {
            res.json({
                valid: true,
                expires_at: '2099-12-31T23:59:59.000Z',
                features: ['full'],
                max_users: 5,
                max_machines: 3,
                current_machines: 1,
                test_mode: true
            });
        });
    }

};
