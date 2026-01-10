const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { getHashedMachineId } = require('../utils/machineId');

// Simple file-based storage (replacing electron-store to avoid compatibility issues)
const storePath = path.join(app.getPath('userData'), 'license-data.json');

const store = {
    get(key, defaultValue) {
        try {
            if (fs.existsSync(storePath)) {
                const data = JSON.parse(fs.readFileSync(storePath, 'utf8'));
                return data[key] !== undefined ? data[key] : defaultValue;
            }
        } catch (error) {
            console.error('Error reading store:', error);
        }
        return defaultValue;
    },
    set(key, value) {
        try {
            let data = {};
            if (fs.existsSync(storePath)) {
                data = JSON.parse(fs.readFileSync(storePath, 'utf8'));
            }
            data[key] = value;
            fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error writing store:', error);
        }
    },
    delete(key) {
        try {
            if (fs.existsSync(storePath)) {
                const data = JSON.parse(fs.readFileSync(storePath, 'utf8'));
                delete data[key];
                fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
            }
        } catch (error) {
            console.error('Error deleting from store:', error);
        }
    }
};

const API_URL = process.env.LICENSE_API_URL || 'https://petlife-licensing-platform.vercel.app';
const APP_ID = 'petlife';
const APP_VERSION = '1.0.0';
const VALIDATION_INTERVAL_DAYS = 7;
const OFFLINE_GRACE_PERIOD_DAYS = 30;
const REQUEST_TIMEOUT = 10000; // 10 segundos
const MAX_RETRIES = 3;

/**
 * Faz requisição HTTP com retry logic
 * @param {string} url - URL da requisição
 * @param {object} options - Opções do fetch
 * @param {number} retries - Número de tentativas restantes
 * @returns {Promise<object>} Resposta da API
 */
async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        clearTimeout(timeout);

        if (retries > 0 && (error.name === 'AbortError' || error.message.includes('fetch'))) {
            console.log(`Tentativa falhou, ${retries} tentativas restantes...`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Aguarda 1s
            return fetchWithRetry(url, options, retries - 1);
        }

        throw error;
    }
}

/**
 * Valida uma chave de licença com a API
 * @param {string} licenseKey - Chave de licença
 * @returns {Promise<object>} Resultado da validação
 */
async function validateLicense(licenseKey) {
    try {
        const machineId = getHashedMachineId();

        const response = await fetchWithRetry(`${API_URL}/api/license/validate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                key: licenseKey,
                app_id: APP_ID,
                machine_id: machineId,
                app_version: APP_VERSION
            })
        });

        if (response.valid) {
            // Salva licença validada
            store.set('license', {
                key: licenseKey,
                validatedAt: new Date().toISOString(),
                expiresAt: response.expires_at,
                features: response.features,
                maxUsers: response.max_users,
                maxMachines: response.max_machines,
                currentMachines: response.current_machines
            });
        }

        return response;
    } catch (error) {
        console.error('Erro ao validar licença:', error);
        throw {
            valid: false,
            error: 'network_error',
            message: 'Não foi possível conectar ao servidor de licenças. Verifique sua conexão.',
            offline: true
        };
    }
}

/**
 * Verifica o status de uma licença
 * @param {string} licenseKey - Chave de licença
 * @returns {Promise<object>} Status da licença
 */
async function checkLicenseStatus(licenseKey) {
    try {
        const response = await fetchWithRetry(
            `${API_URL}/api/license/status?key=${encodeURIComponent(licenseKey)}`
        );

        return response;
    } catch (error) {
        console.error('Erro ao verificar status:', error);
        throw {
            error: 'network_error',
            message: 'Não foi possível verificar o status da licença.'
        };
    }
}

/**
 * Desativa a máquina atual
 * @param {string} licenseKey - Chave de licença
 * @returns {Promise<object>} Resultado da desativação
 */
async function deactivateMachine(licenseKey) {
    try {
        const machineId = getHashedMachineId();

        const response = await fetchWithRetry(`${API_URL}/api/license/deactivate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                key: licenseKey,
                machine_id: machineId
            })
        });

        // Remove licença local
        store.delete('license');

        return response;
    } catch (error) {
        console.error('Erro ao desativar máquina:', error);
        throw {
            error: 'network_error',
            message: 'Não foi possível desativar a máquina.'
        };
    }
}

/**
 * Obtém a licença armazenada localmente
 * @returns {object|null} Dados da licença ou null
 */
function getStoredLicense() {
    return store.get('license', null);
}

/**
 * Verifica se a licença precisa ser revalidada
 * @returns {boolean} True se precisa revalidar
 */
function needsRevalidation() {
    const license = getStoredLicense();

    if (!license || !license.validatedAt) {
        return true;
    }

    const lastValidation = new Date(license.validatedAt);
    const now = new Date();
    const daysSinceValidation = (now - lastValidation) / (1000 * 60 * 60 * 24);

    return daysSinceValidation >= VALIDATION_INTERVAL_DAYS;
}

/**
 * Verifica se ainda está dentro do período de graça offline
 * @returns {boolean} True se ainda pode usar offline
 */
function isWithinOfflineGracePeriod() {
    const license = getStoredLicense();

    if (!license || !license.validatedAt) {
        return false;
    }

    const lastValidation = new Date(license.validatedAt);
    const now = new Date();
    const daysSinceValidation = (now - lastValidation) / (1000 * 60 * 60 * 24);

    return daysSinceValidation < OFFLINE_GRACE_PERIOD_DAYS;
}

/**
 * Verifica se a licença local expirou
 * @returns {boolean} True se expirou
 */
function isLicenseExpired() {
    const license = getStoredLicense();

    if (!license || !license.expiresAt) {
        return false; // Licença perpétua ou não existe
    }

    const expirationDate = new Date(license.expiresAt);
    const now = new Date();

    return now > expirationDate;
}

/**
 * Verifica a licença ao iniciar o aplicativo
 * @returns {Promise<object>} Resultado da verificação
 */
async function checkLicenseOnStartup() {
    const storedLicense = getStoredLicense();

    // Sem licença armazenada
    if (!storedLicense) {
        return {
            valid: false,
            needsActivation: true,
            message: 'Nenhuma licença encontrada. Por favor, ative o aplicativo.'
        };
    }

    // Verifica expiração local
    if (isLicenseExpired()) {
        return {
            valid: false,
            needsActivation: true,
            message: 'Sua licença expirou. Por favor, renove sua licença.'
        };
    }

    // Tenta revalidar se necessário
    if (needsRevalidation()) {
        try {
            const result = await validateLicense(storedLicense.key);

            if (!result.valid) {
                return {
                    valid: false,
                    needsActivation: true,
                    message: result.message || 'Licença inválida.',
                    error: result.error
                };
            }

            return {
                valid: true,
                license: result,
                message: 'Licença validada com sucesso.'
            };
        } catch (error) {
            // Erro de rede - verifica período de graça
            if (error.offline && isWithinOfflineGracePeriod()) {
                return {
                    valid: true,
                    offline: true,
                    license: storedLicense,
                    message: 'Usando licença em modo offline. Conecte-se à internet para validar.'
                };
            }

            return {
                valid: false,
                needsActivation: true,
                message: 'Não foi possível validar a licença. Período de graça offline expirado.',
                error: 'offline_grace_expired'
            };
        }
    }

    // Licença válida e não precisa revalidar
    return {
        valid: true,
        license: storedLicense,
        message: 'Licença válida.'
    };
}

/**
 * Remove a licença armazenada
 */
function clearLicense() {
    store.delete('license');
}

module.exports = {
    validateLicense,
    checkLicenseStatus,
    deactivateMachine,
    getStoredLicense,
    needsRevalidation,
    isWithinOfflineGracePeriod,
    isLicenseExpired,
    checkLicenseOnStartup,
    clearLicense,
    VALIDATION_INTERVAL_DAYS,
    OFFLINE_GRACE_PERIOD_DAYS
};
