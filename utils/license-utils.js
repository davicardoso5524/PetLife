const crypto = require('crypto');

/**
 * Gera uma chave de licença única no formato XXXX-XXXX-XXXX-XXXX
 * @returns {string} Chave de licença gerada
 */
function generateLicenseKey() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Evita caracteres confusos (0, O, 1, I)
    let key = '';

    for (let i = 0; i < 16; i++) {
        if (i > 0 && i % 4 === 0) {
            key += '-';
        }
        const randomIndex = crypto.randomInt(0, chars.length);
        key += chars[randomIndex];
    }

    return key;
}

/**
 * Valida o formato de uma chave de licença
 * @param {string} key - Chave a ser validada
 * @returns {boolean} True se o formato é válido
 */
function validateKeyFormat(key) {
    if (!key || typeof key !== 'string') {
        return false;
    }

    // Formato: XXXX-XXXX-XXXX-XXXX (4 blocos de 4 caracteres alfanuméricos)
    const keyRegex = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    return keyRegex.test(key);
}

/**
 * Gera hash SHA-256 de um machine ID
 * @param {string} machineId - ID da máquina
 * @returns {string} Hash do machine ID
 */
function hashMachineId(machineId) {
    return crypto.createHash('sha256').update(machineId).digest('hex');
}

/**
 * Verifica se uma licença expirou
 * @param {string} expiresAt - Data de expiração (ISO string)
 * @returns {boolean} True se expirou
 */
function isLicenseExpired(expiresAt) {
    if (!expiresAt) {
        return false; // Licença perpétua
    }

    const expirationDate = new Date(expiresAt);
    const now = new Date();

    return now > expirationDate;
}

/**
 * Gera um UUID v4
 * @returns {string} UUID gerado
 */
function generateUUID() {
    return crypto.randomUUID();
}

/**
 * Calcula data de expiração baseada em dias a partir de agora
 * @param {number} days - Número de dias
 * @returns {string} Data de expiração em ISO format
 */
function calculateExpirationDate(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
}

module.exports = {
    generateLicenseKey,
    validateKeyFormat,
    hashMachineId,
    isLicenseExpired,
    generateUUID,
    calculateExpirationDate
};
