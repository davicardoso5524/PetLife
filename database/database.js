const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

let dbPath;

// Determine correct database path based on environment
if (process.versions.electron) {
    // Running in Electron: use userData directory (App Data)
    // Needs to dynamically require electron to avoid build issues if ran outside
    const { app } = require('electron');
    const userDataPath = app.getPath('userData');

    // Ensure directory exists
    if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
    }

    dbPath = path.join(userDataPath, 'petlife.db');
    console.log('Using Production Database Path:', dbPath);
} else {
    // Running in Dev/Node: use local file
    dbPath = path.resolve(__dirname, 'petlife.db');
    console.log('Using Development Database Path:', dbPath);
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite.');
    }
});

// Verifica e aplica migrações automaticamente

// Migração de correção: Remover UNIQUE da coluna date para permitir múltiplas vendas
// Verificamos se precisamos migrar tentando inserir uma duplicata de teste ou checando schema
// Estratégia simples: Renomear, Criar Nova, Copiar, Dropar (Padrão SQLite)

// Para simplificar neste ambiente, vamos rodar a recriação se a tabela antiga existir com a constraint
// Como não temos 'SHOW CREATE TABLE' fácil, vamos forçar a migração se a tabela existir

db.serialize(() => {
    // Tabela antiga
    db.run(`CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            amount REAL NOT NULL,
            form_money REAL DEFAULT 0,
            form_pix REAL DEFAULT 0,
            form_debit REAL DEFAULT 0,
            form_credit REAL DEFAULT 0
        )`);

    // Check if we need to migrate (this is a simplified check, ideally version the db)
    // Here we will try to ensure indices are correct.
    // NOTE: If the user already has the UNIQUE constraint, we need to remove it.
    // SQLite ALTER TABLE cannot drop constraints. We must recreate.

    const migrationFlag = 'v2_multi_sales_migration';

    db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='${migrationFlag}'`, (err, row) => {
        if (!row) {
            console.log('Iniciando migração de banco de dados para v2...');
            db.serialize(() => {
                // Clean up any failed previous migration
                db.run(`DROP TABLE IF EXISTS sales_new`);

                db.run(`CREATE TABLE IF NOT EXISTS sales_new (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        date TEXT NOT NULL,
                        amount REAL NOT NULL,
                        form_money REAL DEFAULT 0,
                        form_pix REAL DEFAULT 0,
                        form_debit REAL DEFAULT 0,
                        form_credit REAL DEFAULT 0
                    )`);

                // Copia dados da tabela antiga (date, amount)
                db.run(`INSERT INTO sales_new (date, amount)
                            SELECT date, amount FROM sales`, (err) => {
                    if (!err) {
                        // Serializing the critical swap operations
                        db.serialize(() => {
                            db.run(`DROP TABLE IF EXISTS sales`);
                            db.run(`ALTER TABLE sales_new RENAME TO sales`, (err) => {
                                if (err) {
                                    console.error('Error renaming table during v2 migration:', err);
                                } else {
                                    db.run(`CREATE TABLE ${migrationFlag} (id INTEGER PRIMARY KEY)`);
                                    console.log('Migração v2 concluída com sucesso.');
                                    checkV3();
                                }
                            });
                        });
                    } else {
                        console.error('Erro migração (INSERT):', err);
                        // Even if insert failed, we should probably check next versions or retry? 
                        // For safety, let's proceed to checkV3 but log error.
                        checkV3();
                    }
                });
            });
        } else {
            console.log('Banco de dados versão v2.');
            checkV3();
        }
    });

    function checkV3() {
        const v3Flag = 'v3_observation_migration';
        db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='${v3Flag}'`, (err, row) => {
            if (!row) {
                console.log('Aplicando migração v3 (Observações)...');
                db.run(`ALTER TABLE sales ADD COLUMN observation TEXT DEFAULT ''`, (err) => {
                    if (!err) {
                        db.run(`CREATE TABLE ${v3Flag} (id INTEGER PRIMARY KEY)`);
                        console.log('Migração v3 concluída.');
                        checkV4();
                    } else {
                        console.error('Erro migração v3:', err);
                    }
                });
            } else {
                console.log('Banco de dados versão v3.');
                checkV4();
            }
        });
    }

    function checkV4() {
        const v4Flag = 'v4_packages_migration';
        db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='${v4Flag}'`, (err, row) => {
            if (!row) {
                console.log('Aplicando migração v4 (Pacotes)...');
                db.serialize(() => {
                    // Tabela de Pacotes
                    db.run(`CREATE TABLE IF NOT EXISTS packages (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        pet_name TEXT NOT NULL,
                        owner_name TEXT NOT NULL,
                        phone TEXT,
                        price REAL DEFAULT 0,
                        created_at TEXT NOT NULL,
                        expires_at TEXT NOT NULL,
                        observation TEXT,
                        status TEXT DEFAULT 'active'
                    )`);

                    // Tabela de Usos (Banhos/Tosa)
                    db.run(`CREATE TABLE IF NOT EXISTS package_usage (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        package_id INTEGER NOT NULL,
                        service_type TEXT NOT NULL,
                        used_at TEXT NOT NULL,
                        usage_number INTEGER DEFAULT 1,
                        FOREIGN KEY(package_id) REFERENCES packages(id)
                    )`);

                    db.run(`CREATE TABLE ${v4Flag} (id INTEGER PRIMARY KEY)`);
                    console.log('Migração v4 (Pacotes) concluída.');
                    checkV5();
                });
            } else {
                console.log('Banco de dados versão v4 (Pacotes).');
                checkV5();
            }
        });
    }

    function checkV5() {
        const v5Flag = 'v5_renewal_count_migration';
        db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='${v5Flag}'`, (err, row) => {
            if (!row) {
                console.log('Aplicando migração v5 (Contador de Renovações)...');
                db.run(`ALTER TABLE packages ADD COLUMN renewal_count INTEGER DEFAULT 0`, (err) => {
                    if (!err) {
                        db.run(`CREATE TABLE ${v5Flag} (id INTEGER PRIMARY KEY)`);
                        console.log('Migração v5 concluída.');
                        checkV6();
                    } else {
                        console.error('Erro migração v5:', err);
                    }
                });
            } else {
                console.log('Banco de dados versão v5 (Renovações).');
                checkV6();
            }
        });
    }

    function checkV6() {
        const v6Flag = 'v6_expenses_migration';
        db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='${v6Flag}'`, (err, row) => {
            if (!row) {
                console.log('Aplicando migração v6 (Despesas)...');
                db.serialize(() => {
                    // Tabela de Categorias de Despesas
                    db.run(`CREATE TABLE IF NOT EXISTS expense_categories (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        category_type TEXT NOT NULL,
                        frequency TEXT DEFAULT 'monthly',
                        default_value REAL DEFAULT 0,
                        is_active INTEGER DEFAULT 1,
                        created_at TEXT NOT NULL
                    )`);

                    // Tabela de Lançamentos Mensais
                    db.run(`CREATE TABLE IF NOT EXISTS expense_entries (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        category_id INTEGER NOT NULL,
                        year INTEGER NOT NULL,
                        month INTEGER NOT NULL,
                        value REAL DEFAULT 0,
                        status TEXT DEFAULT 'pending',
                        payment_date TEXT,
                        observation TEXT,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        FOREIGN KEY(category_id) REFERENCES expense_categories(id),
                        UNIQUE(category_id, year, month)
                    )`);

                    // Índices para performance
                    db.run(`CREATE INDEX IF NOT EXISTS idx_expense_entries_date 
                            ON expense_entries(year, month)`);

                    db.run(`CREATE INDEX IF NOT EXISTS idx_expense_entries_category 
                            ON expense_entries(category_id)`);

                    db.run(`CREATE TABLE ${v6Flag} (id INTEGER PRIMARY KEY)`);
                    console.log('Migração v6 (Despesas) concluída.');
                    checkV7();
                });
            } else {
                console.log('Banco de dados versão v6 (Despesas).');
                checkV7();
            }
        });
    }

    function checkV7() {
        const v7Flag = 'v7_bills_migration';
        db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='${v7Flag}'`, (err, row) => {
            if (!row) {
                console.log('Aplicando migração v7 (Contas a Pagar)...');
                db.serialize(() => {
                    // Tabela de Contas a Pagar
                    db.run(`CREATE TABLE IF NOT EXISTS bills (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        description TEXT NOT NULL,
                        amount REAL NOT NULL,
                        due_date TEXT NOT NULL,
                        category TEXT,
                        supplier TEXT,
                        status TEXT DEFAULT 'pending',
                        payment_date TEXT,
                        notes TEXT,
                        is_installment INTEGER DEFAULT 0,
                        installment_number INTEGER,
                        total_installments INTEGER,
                        installment_group_id TEXT,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    )`);

                    // Índices para performance
                    db.run(`CREATE INDEX IF NOT EXISTS idx_bills_due_date 
                            ON bills(due_date)`);

                    db.run(`CREATE INDEX IF NOT EXISTS idx_bills_status 
                            ON bills(status)`);

                    db.run(`CREATE INDEX IF NOT EXISTS idx_bills_installment_group 
                            ON bills(installment_group_id)`);

                    db.run(`CREATE TABLE ${v7Flag} (id INTEGER PRIMARY KEY)`);
                    console.log('Migração v7 (Contas a Pagar) concluída.');
                    checkV8();
                });
            } else {
                console.log('Banco de dados versão v7 (Contas a Pagar).');
                checkV8();
            }
        });
    }

    function checkV8() {
        const v8Flag = 'v8_pet_photo_migration';
        db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='${v8Flag}'`, (err, row) => {
            if (!row) {
                console.log('Aplicando migração v8 (Foto do Pet)...');
                db.run(`ALTER TABLE packages ADD COLUMN pet_photo TEXT`, (err) => {
                    if (!err) {
                        db.run(`CREATE TABLE ${v8Flag} (id INTEGER PRIMARY KEY)`);
                        console.log('Migração v8 (Foto do Pet) concluída.');
                        checkV9();
                    } else {
                        console.error('Erro migração v8:', err);
                    }
                });
            } else {
                console.log('Banco de dados versão v8 (Foto do Pet).');
                checkV9();
            }
        });
    }

    function checkV9() {
        const v9Flag = 'v9_authentication_migration';
        db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='${v9Flag}'`, (err, row) => {
            if (!row) {
                console.log('Aplicando migração v9 (Autenticação)...');
                const bcrypt = require('bcryptjs');

                db.serialize(() => {
                    // Tabela de Usuários
                    db.run(`CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        full_name TEXT,
                        role TEXT DEFAULT 'user',
                        is_active INTEGER DEFAULT 1,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        last_login TEXT
                    )`);

                    // Tabela de Sessões
                    db.run(`CREATE TABLE IF NOT EXISTS sessions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        token TEXT UNIQUE NOT NULL,
                        expires_at TEXT NOT NULL,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(user_id) REFERENCES users(id)
                    )`);

                    // Índices para performance
                    db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_token 
                            ON sessions(token)`);

                    db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_user 
                            ON sessions(user_id)`);

                    // Criar usuário admin padrão
                    const defaultPassword = 'admin123';
                    const passwordHash = bcrypt.hashSync(defaultPassword, 10);

                    db.run(`INSERT OR IGNORE INTO users (username, password_hash, full_name, role)
                            VALUES (?, ?, ?, ?)`,
                        ['admin', passwordHash, 'Administrador', 'admin'],
                        (err) => {
                            if (!err) {
                                console.log('Usuário admin padrão criado (username: admin, password: admin123)');
                            }
                        });

                    db.run(`CREATE TABLE ${v9Flag} (id INTEGER PRIMARY KEY)`);
                    console.log('Migração v9 (Autenticação) concluída.');
                    checkV10();
                });
            } else {
                console.log('Banco de dados versão v9 (Autenticação).');
                checkV10();
            }
        });
    }

    function checkV10() {
        const v10Flag = 'v10_licensing_migration';
        db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='${v10Flag}'`, (err, row) => {
            if (!row) {
                console.log('Aplicando migração v10 (Licenciamento)...');
                const crypto = require('crypto');

                db.serialize(() => {
                    // Tabela de Licenças
                    db.run(`CREATE TABLE IF NOT EXISTS licenses (
                        id TEXT PRIMARY KEY,
                        key TEXT UNIQUE NOT NULL,
                        status TEXT DEFAULT 'active',
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        expires_at TEXT,
                        max_machines INTEGER DEFAULT 1,
                        max_users INTEGER DEFAULT 5,
                        features TEXT DEFAULT '["full"]',
                        notes TEXT,
                        created_by TEXT
                    )`);

                    // Tabela de Ativações de Máquinas
                    db.run(`CREATE TABLE IF NOT EXISTS license_activations (
                        id TEXT PRIMARY KEY,
                        license_id TEXT NOT NULL,
                        machine_id_hash TEXT NOT NULL,
                        app_version TEXT,
                        activated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        last_validated TEXT DEFAULT CURRENT_TIMESTAMP,
                        ip_address TEXT,
                        FOREIGN KEY(license_id) REFERENCES licenses(id),
                        UNIQUE(license_id, machine_id_hash)
                    )`);

                    // Tabela de Log de Validações
                    db.run(`CREATE TABLE IF NOT EXISTS license_validations (
                        id TEXT PRIMARY KEY,
                        license_id TEXT,
                        machine_id_hash TEXT,
                        validated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        success INTEGER,
                        error_code TEXT,
                        ip_address TEXT,
                        FOREIGN KEY(license_id) REFERENCES licenses(id)
                    )`);

                    // Índices para performance
                    db.run(`CREATE INDEX IF NOT EXISTS idx_licenses_key 
                            ON licenses(key)`);

                    db.run(`CREATE INDEX IF NOT EXISTS idx_licenses_status 
                            ON licenses(status)`);

                    db.run(`CREATE INDEX IF NOT EXISTS idx_activations_license 
                            ON license_activations(license_id)`);

                    db.run(`CREATE INDEX IF NOT EXISTS idx_validations_license 
                            ON license_validations(license_id)`);

                    db.run(`CREATE TABLE ${v10Flag} (id INTEGER PRIMARY KEY)`);
                    console.log('Migração v10 (Licenciamento) concluída.');
                });
            } else {
                console.log('Banco de dados versão v10 (Licenciamento).');
            }
        });
    }

});

module.exports = db;
