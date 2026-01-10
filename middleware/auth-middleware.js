const crypto = require('crypto');

// Secret para JWT (em produção, use variável de ambiente)
const JWT_SECRET = process.env.JWT_SECRET || 'petlife-secret-key-change-in-production';
const JWT_EXPIRATION = '24h'; // Token expira em 24 horas

/**
 * Gera um token JWT simples (implementação básica sem biblioteca externa)
 * @param {object} payload - Dados a serem incluídos no token
 * @returns {string} Token JWT
 */
function generateToken(payload) {
    const header = {
        alg: 'HS256',
        typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const tokenPayload = {
        ...payload,
        iat: now,
        exp: now + (24 * 60 * 60) // 24 horas
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');

    const signature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest('base64url');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verifica e decodifica um token JWT
 * @param {string} token - Token a ser verificado
 * @returns {object|null} Payload do token ou null se inválido
 */
function verifyToken(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return null;
        }

        const [encodedHeader, encodedPayload, signature] = parts;

        // Verifica assinatura
        const expectedSignature = crypto
            .createHmac('sha256', JWT_SECRET)
            .update(`${encodedHeader}.${encodedPayload}`)
            .digest('base64url');

        if (signature !== expectedSignature) {
            return null;
        }

        // Decodifica payload
        const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString());

        // Verifica expiração
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
            return null;
        }

        return payload;
    } catch (error) {
        return null;
    }
}

/**
 * Middleware para verificar token JWT em requisições
 */
function verifyAdminToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'unauthorized',
            message: 'Token de autenticação não fornecido'
        });
    }

    const token = authHeader.substring(7); // Remove 'Bearer '
    const payload = verifyToken(token);

    if (!payload) {
        return res.status(401).json({
            error: 'invalid_token',
            message: 'Token inválido ou expirado'
        });
    }

    // Adiciona informações do usuário à requisição
    req.user = payload;
    next();
}

/**
 * Gera token para admin
 * @param {number} userId - ID do usuário
 * @param {string} username - Nome de usuário
 * @param {string} role - Papel do usuário
 * @returns {string} Token JWT
 */
function generateAdminToken(userId, username, role = 'admin') {
    return generateToken({
        userId,
        username,
        role
    });
}

module.exports = {
    generateToken,
    verifyToken,
    verifyAdminToken,
    generateAdminToken
};
