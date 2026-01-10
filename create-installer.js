const electronInstaller = require('electron-winstaller');
const path = require('path');

console.log('Criando instalador Windows...');

const resultPromise = electronInstaller.createWindowsInstaller({
    appDirectory: path.join(__dirname, 'release', 'Petlife-win32-x64'),
    outputDirectory: path.join(__dirname, 'installer'),
    authors: 'Petlife',
    exe: 'Petlife.exe',
    setupExe: 'PetlifeSetup.exe',
    setupIcon: path.join(__dirname, 'public', 'icon.png'),
    noMsi: true,
    title: 'Petlife - Sistema de Vendas'
});

resultPromise.then(() => {
    console.log('✅ Instalador criado com sucesso!');
    console.log('📁 Localização: installer/PetlifeSetup.exe');
}, (e) => {
    console.error(`❌ Erro ao criar instalador: ${e.message}`);
});
