const { machineIdSync } = require('node-machine-id');
const crypto = require('crypto');
const os = require('os');

/**
 * Gera um ID único e persistente para a máquina
 * Combina informações do hardware para criar um identificador estável
 * @returns {string} Machine ID único
 */
function generateMachineId() {
    try {
        // Tenta usar node-machine-id (mais confiável)
        const machineId = machineIdSync({ original: true });
        return machineId;
    } catch (error) {
        console.warn('Falha ao obter machine ID via node-machine-id, usando fallback');

        // Fallback: combina informações do sistema
        const networkInterfaces = os.networkInterfaces();
        const macAddresses = [];

        // Coleta MACs de todas as interfaces
        for (const interfaceName in networkInterfaces) {
            const interfaces = networkInterfaces[interfaceName];
            for (const iface of interfaces) {
                if (iface.mac && iface.mac !== '00:00:00:00:00:00') {
                    macAddresses.push(iface.mac);
                }
            }
        }

        // Ordena para garantir consistência
        macAddresses.sort();

        // Combina com outras informações do sistema
        const systemInfo = {
            platform: os.platform(),
            arch: os.arch(),
            hostname: os.hostname(),
            macs: macAddresses.join(','),
            cpus: os.cpus().length
        };

        // Gera hash das informações
        const hash = crypto
            .createHash('sha256')
            .update(JSON.stringify(systemInfo))
            .digest('hex');

        return hash;
    }
}

/**
 * Gera hash SHA-256 do machine ID
 * @param {string} machineId - ID da máquina
 * @returns {string} Hash do machine ID
 */
function hashMachineId(machineId) {
    return crypto.createHash('sha256').update(machineId).digest('hex');
}

/**
 * Obtém o machine ID hasheado (pronto para enviar à API)
 * @returns {string} Machine ID hasheado
 */
function getHashedMachineId() {
    const machineId = generateMachineId();
    return hashMachineId(machineId);
}

module.exports = {
    generateMachineId,
    hashMachineId,
    getHashedMachineId
};
