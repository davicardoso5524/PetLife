/**
 * Rate Limiter simples baseado em IP
 * Armazena contadores em memória (para produção, considere Redis)
 */

const requestCounts = new Map();

/**
 * Limpa contadores antigos periodicamente
 */
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of requestCounts.entries()) {
        if (now - data.resetTime > data.windowMs) {
            requestCounts.delete(key);
        }
    }
}, 60000); // Limpa a cada minuto

/**
 * Cria middleware de rate limiting
 * @param {object} options - Opções de configuração
 * @param {number} options.windowMs - Janela de tempo em ms (padrão: 1 hora)
 * @param {number} options.max - Máximo de requisições (padrão: 100)
 * @param {string} options.message - Mensagem de erro
 * @returns {Function} Middleware Express
 */
function createRateLimiter(options = {}) {
    const {
        windowMs = 60 * 60 * 1000, // 1 hora
        max = 100,
        message = 'Muitas requisições. Tente novamente mais tarde.'
    } = options;

    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress;
        const key = `${ip}:${req.path}`;
        const now = Date.now();

        let requestData = requestCounts.get(key);

        if (!requestData) {
            requestData = {
                count: 0,
                resetTime: now
            };
            requestCounts.set(key, requestData);
        }

        // Reseta contador se a janela expirou
        if (now - requestData.resetTime > windowMs) {
            requestData.count = 0;
            requestData.resetTime = now;
        }

        requestData.count++;

        // Define headers de rate limit
        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, max - requestData.count));
        res.setHeader('X-RateLimit-Reset', new Date(requestData.resetTime + windowMs).toISOString());

        if (requestData.count > max) {
            return res.status(429).json({
                error: 'rate_limit_exceeded',
                message: message,
                retryAfter: Math.ceil((requestData.resetTime + windowMs - now) / 1000)
            });
        }

        next();
    };
}

/**
 * Rate limiter para endpoints públicos de validação
 */
const publicLicenseRateLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 100,
    message: 'Limite de validações excedido. Tente novamente em 1 hora.'
});

/**
 * Rate limiter para endpoints admin (mais permissivo)
 */
const adminRateLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 500,
    message: 'Limite de requisições admin excedido. Tente novamente em 1 hora.'
});

/**
 * Rate limiter para login (mais restritivo)
 */
const loginRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5,
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
});

module.exports = {
    createRateLimiter,
    publicLicenseRateLimiter,
    adminRateLimiter,
    loginRateLimiter
};
