const pngToIco = require('png-to-ico');
const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'public', 'icon.png');
const outputPath = path.join(__dirname, 'public', 'icon.ico');

console.log('Convertendo PNG para ICO...');

pngToIco(inputPath)
    .then(buf => {
        fs.writeFileSync(outputPath, buf);
        console.log('✅ Ícone convertido com sucesso!');
        console.log(`Salvo em: ${outputPath}`);
    })
    .catch(err => {
        console.error('❌ Erro ao converter:', err);
    });
