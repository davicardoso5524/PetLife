const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const os = require('os');

// Get the correct database path (Windows AppData)
const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'PetLife');
const dbPath = path.join(userDataPath, 'petlife.db');

console.log('📂 Database Path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erro ao conectar ao banco:', err.message);
        console.log('');
        console.log('💡 Dica: Certifique-se de que o aplicativo foi executado pelo menos uma vez');
        console.log('   para criar o banco de dados em:', userDataPath);
        process.exit(1);
    } else {
        console.log('✅ Conectado ao banco de dados.');
    }
});

// Create admin user
const username = 'admin';
const password = 'admin123';
const passwordHash = bcrypt.hashSync(password, 10);

db.run(`INSERT OR REPLACE INTO users (id, username, password_hash, full_name, role, is_active)
        VALUES (1, ?, ?, ?, ?, ?)`,
    [username, passwordHash, 'Administrador', 'admin', 1],
    function (err) {
        if (err) {
            console.error('❌ Erro ao criar usuário:', err.message);
        } else {
            console.log('✅ Usuário admin criado com sucesso!');
            console.log('');
            console.log('📝 Credenciais de Login:');
            console.log('   👤 Usuário: admin');
            console.log('   🔑 Senha: admin123');
            console.log('');
            console.log('🚀 Agora você pode fazer login no PetLife!');
        }

        db.close((err) => {
            if (err) {
                console.error('❌ Erro ao fechar banco:', err.message);
            }
        });
    }
);
