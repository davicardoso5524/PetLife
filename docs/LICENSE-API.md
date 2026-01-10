# PetLife - API de Licenciamento

## Visão Geral

API RESTful para gerenciamento de licenças do aplicativo PetLife. Suporta validação de chaves, controle de ativações por máquina, expiração de licenças e administração completa.

**Base URL:** `http://localhost:3000`

---

## Endpoints Públicos

### 1. Health Check

Verifica se a API está funcionando.

**Endpoint:** `GET /health`

**Resposta:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-09T04:00:00.000Z"
}
```

---

### 2. Validar Licença

Valida uma chave de licença e registra a ativação da máquina.

**Endpoint:** `POST /api/license/validate`

**Rate Limit:** 100 requisições/hora por IP

**Request Body:**
```json
{
  "key": "A1B2-C3D4-E5F6-G7H8",
  "app_id": "petlife",
  "machine_id": "hashed-machine-id",
  "app_version": "1.0.0"
}
```

**Resposta de Sucesso (200):**
```json
{
  "valid": true,
  "expires_at": "2027-01-08T00:00:00.000Z",
  "features": ["full"],
  "max_users": 5,
  "max_machines": 3,
  "current_machines": 1
}
```

**Respostas de Erro:**

**400 - Formato Inválido:**
```json
{
  "valid": false,
  "error": "invalid_format",
  "message": "Formato de chave inválido. Use: XXXX-XXXX-XXXX-XXXX"
}
```

**401 - Chave Não Encontrada:**
```json
{
  "valid": false,
  "error": "invalid_key",
  "message": "Chave de licença não encontrada"
}
```

**403 - Licença Revogada:**
```json
{
  "valid": false,
  "error": "revoked_key",
  "message": "Esta licença foi revogada"
}
```

**403 - Licença Expirada:**
```json
{
  "valid": false,
  "error": "expired_key",
  "message": "Esta licença expirou"
}
```

**403 - Limite de Máquinas:**
```json
{
  "valid": false,
  "error": "machine_limit_exceeded",
  "message": "Esta licença já está ativada em 3 máquina(s)",
  "max_machines": 3,
  "current_machines": 3
}
```

---

### 3. Verificar Status da Licença

Consulta o status atual de uma licença.

**Endpoint:** `GET /api/license/status?key=XXXX-XXXX-XXXX-XXXX`

**Rate Limit:** 100 requisições/hora por IP

**Resposta (200):**
```json
{
  "active": true,
  "status": "active",
  "expires_at": "2027-01-08T00:00:00.000Z",
  "days_remaining": 365,
  "machines_used": 1,
  "machines_limit": 3
}
```

---

### 4. Desativar Máquina

Remove a ativação de uma máquina específica.

**Endpoint:** `POST /api/license/deactivate`

**Rate Limit:** 100 requisições/hora por IP

**Request Body:**
```json
{
  "key": "A1B2-C3D4-E5F6-G7H8",
  "machine_id": "hashed-machine-id"
}
```

**Resposta (200):**
```json
{
  "message": "Máquina desativada com sucesso",
  "machines_remaining": 2
}
```

---

## Endpoints Admin (Requerem Autenticação)

### 5. Login Admin

Autentica um administrador e retorna um token JWT.

**Endpoint:** `POST /api/admin/license/login`

**Rate Limit:** 5 tentativas/15 minutos por IP

**Request Body:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Resposta (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "full_name": "Administrador",
    "role": "admin"
  }
}
```

> **Nota:** Use o token retornado no header `Authorization: Bearer <token>` para os endpoints admin.

---

### 6. Criar Nova Licença

Gera uma nova chave de licença.

**Endpoint:** `POST /api/admin/keys`

**Headers:** `Authorization: Bearer <token>`

**Rate Limit:** 500 requisições/hora por IP

**Request Body:**
```json
{
  "expires_in_days": 365,
  "max_machines": 3,
  "max_users": 5,
  "features": ["full"],
  "notes": "Cliente XYZ - Licença anual"
}
```

**Resposta (201):**
```json
{
  "message": "Licença criada com sucesso",
  "key": "A1B2-C3D4-E5F6-G7H8",
  "created_at": "2026-01-09T04:00:00.000Z",
  "expires_at": "2027-01-09T04:00:00.000Z",
  "max_machines": 3,
  "max_users": 5
}
```

---

### 7. Listar Licenças

Lista todas as licenças com paginação.

**Endpoint:** `GET /api/admin/keys?status=active&page=1&limit=50`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `status` (opcional): `active`, `revoked`, `expired`, ou `all`
- `page` (opcional): Número da página (padrão: 1)
- `limit` (opcional): Itens por página (padrão: 50)

**Resposta (200):**
```json
{
  "keys": [
    {
      "id": "uuid-here",
      "key": "A1B2-C3D4-E5F6-G7H8",
      "status": "active",
      "created_at": "2026-01-09T04:00:00.000Z",
      "expires_at": "2027-01-09T04:00:00.000Z",
      "max_machines": 3,
      "max_users": 5,
      "features": ["full"],
      "notes": "Cliente XYZ",
      "created_by": "admin",
      "machines_count": 1,
      "last_validated": "2026-01-09T04:00:00.000Z"
    }
  ],
  "total": 100,
  "page": 1,
  "pages": 2
}
```

---

### 8. Detalhes da Licença

Obtém informações detalhadas de uma licença específica, incluindo ativações.

**Endpoint:** `GET /api/admin/keys/:key`

**Headers:** `Authorization: Bearer <token>`

**Resposta (200):**
```json
{
  "id": "uuid-here",
  "key": "A1B2-C3D4-E5F6-G7H8",
  "status": "active",
  "created_at": "2026-01-09T04:00:00.000Z",
  "expires_at": "2027-01-09T04:00:00.000Z",
  "max_machines": 3,
  "max_users": 5,
  "features": ["full"],
  "notes": "Cliente XYZ",
  "created_by": "admin",
  "activations": [
    {
      "id": "activation-uuid",
      "machine_id_hash": "hashed-id",
      "app_version": "1.0.0",
      "activated_at": "2026-01-09T04:00:00.000Z",
      "last_validated": "2026-01-09T04:00:00.000Z",
      "ip_address": "192.168.1.100"
    }
  ]
}
```

---

### 9. Revogar Licença

Revoga uma licença, impedindo seu uso.

**Endpoint:** `DELETE /api/admin/keys/:key`

**Headers:** `Authorization: Bearer <token>`

**Resposta (200):**
```json
{
  "message": "Chave revogada com sucesso",
  "key": "A1B2-C3D4-E5F6-G7H8"
}
```

---

## Códigos de Erro

| Código | Descrição |
|--------|-----------|
| `invalid_key` | Chave de licença não encontrada |
| `expired_key` | Licença expirou |
| `revoked_key` | Licença foi revogada |
| `machine_limit_exceeded` | Limite de máquinas atingido |
| `invalid_format` | Formato de chave inválido |
| `missing_parameters` | Parâmetros obrigatórios ausentes |
| `database_error` | Erro no banco de dados |
| `network_error` | Erro de conexão |
| `unauthorized` | Token de autenticação não fornecido |
| `invalid_token` | Token inválido ou expirado |
| `rate_limit_exceeded` | Limite de requisições excedido |

---

## Rate Limiting

A API implementa rate limiting por IP:

- **Endpoints públicos:** 100 requisições/hora
- **Endpoints admin:** 500 requisições/hora
- **Login:** 5 tentativas/15 minutos

Headers de resposta:
- `X-RateLimit-Limit`: Limite máximo
- `X-RateLimit-Remaining`: Requisições restantes
- `X-RateLimit-Reset`: Timestamp de reset

Quando o limite é excedido, retorna status `429`:
```json
{
  "error": "rate_limit_exceeded",
  "message": "Limite de validações excedido. Tente novamente em 1 hora.",
  "retryAfter": 3600
}
```

---

## Segurança

### Machine ID
O `machine_id` deve ser hasheado (SHA-256) antes de enviar para a API. Use a função `hashMachineId()` do módulo `utils/machineId.js`.

### JWT Token
Tokens JWT expiram em 24 horas. Armazene de forma segura e renove quando necessário.

### HTTPS
Em produção, sempre use HTTPS para proteger os dados em trânsito.

---

## Exemplos de Uso

### PowerShell

**Criar Licença:**
```powershell
# Login
$loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/admin/license/login" `
    -Method POST `
    -Body (@{username="admin"; password="admin123"} | ConvertTo-Json) `
    -ContentType "application/json"

$token = $loginResponse.token

# Criar licença
$headers = @{Authorization="Bearer $token"}
$body = @{
    expires_in_days=365
    max_machines=3
    max_users=5
    features=@("full")
    notes="Cliente Teste"
} | ConvertTo-Json

$license = Invoke-RestMethod -Uri "http://localhost:3000/api/admin/keys" `
    -Method POST `
    -Headers $headers `
    -Body $body `
    -ContentType "application/json"

Write-Host "Licença criada: $($license.key)"
```

**Validar Licença:**
```powershell
$validationBody = @{
    key="A1B2-C3D4-E5F6-G7H8"
    app_id="petlife"
    machine_id="test-machine-hash"
    app_version="1.0.0"
} | ConvertTo-Json

$result = Invoke-RestMethod -Uri "http://localhost:3000/api/license/validate" `
    -Method POST `
    -Body $validationBody `
    -ContentType "application/json"

if ($result.valid) {
    Write-Host "✓ Licença válida"
} else {
    Write-Host "✗ Licença inválida: $($result.message)"
}
```

### JavaScript (Node.js)

```javascript
const fetch = require('node-fetch');

// Validar licença
async function validateLicense(key, machineId) {
    const response = await fetch('http://localhost:3000/api/license/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            key,
            app_id: 'petlife',
            machine_id: machineId,
            app_version: '1.0.0'
        })
    });
    
    return await response.json();
}

// Uso
validateLicense('A1B2-C3D4-E5F6-G7H8', 'hashed-machine-id')
    .then(result => {
        if (result.valid) {
            console.log('✓ Licença válida');
        } else {
            console.log('✗ Erro:', result.message);
        }
    });
```

---

## Suporte

Para dúvidas ou problemas, entre em contato: suporte@petlife.com
