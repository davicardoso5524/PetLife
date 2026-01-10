const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database', 'petlife.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err.message);
        process.exit(1);
    } else {
        console.log('Conectado ao banco de dados SQLite.');
    }
});

// Primeiro, vamos ver todos os registros
console.log('\n=== REGISTROS ATUAIS ===');
db.all('SELECT * FROM sales ORDER BY date', [], (err, rows) => {
    if (err) {
        console.error('Erro ao buscar registros:', err.message);
        db.close();
        return;
    }

    if (rows.length === 0) {
        console.log('Nenhum registro encontrado.');
        db.close();
        return;
    }

    rows.forEach((row) => {
        console.log(`ID: ${row.id} | Data: ${row.date} | Valor: R$ ${row.amount.toFixed(2)}`);
    });

    // Procurar o registro específico de 20/05/2024
    const targetDate = '2024-05-20';
    const targetRecord = rows.find(r => r.date === targetDate);

    if (targetRecord) {
        console.log(`\n=== REGISTRO ENCONTRADO ===`);
        console.log(`ID: ${targetRecord.id}`);
        console.log(`Data: ${targetRecord.date}`);
        console.log(`Valor: R$ ${targetRecord.amount.toFixed(2)}`);
        console.log(`\nExcluindo este registro...`);

        db.run('DELETE FROM sales WHERE id = ?', [targetRecord.id], function (err) {
            if (err) {
                console.error('Erro ao excluir:', err.message);
            } else {
                console.log(`✅ Registro excluído com sucesso!`);
                console.log(`Registros afetados: ${this.changes}`);
            }
            db.close();
        });
    } else {
        console.log(`\n⚠️  Registro com data ${targetDate} não encontrado.`);
        console.log('Verifique se a data está no formato correto (YYYY-MM-DD).');
        db.close();
    }
});
