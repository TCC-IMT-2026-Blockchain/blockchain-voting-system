# Votify Backend

API HTTP para operar a eleição usando a camada blockchain MultiChain.

## Rodar

```powershell
cd backend
npm install
npm run dev
```

Servidor padrão:

```text
http://localhost:3333/api/v1
```

## Usuários de Demonstração

```text
admin@example.com / demo123
elector@example.com / demo123
auditor@example.com / demo123
```

## Rotas Principais

```text
GET  /api/v1/health
POST /api/v1/auth/login
GET  /api/v1/auth/me
POST /api/v1/crypto/public-key
GET  /api/v1/elections
GET  /api/v1/elections/:electionId
GET  /api/v1/elections/:electionId/ballot
POST /api/v1/admin/elections
PATCH /api/v1/admin/elections/:electionId
POST /api/v1/admin/elections/:electionId/candidates
POST /api/v1/admin/elections/:electionId/voters
POST /api/v1/elections/:electionId/credentials
POST /api/v1/elections/:electionId/votes
GET  /api/v1/elections/:electionId/votes/:txid/receipt
GET  /api/v1/elections/:electionId/audit
GET  /api/v1/blockchain/status
```

## Fluxo Atual

Cadastro:

```text
CPF + chave privada simulada
        ↓
backend gera chave pública
        ↓
backend gera hash HMAC-SHA256 do CPF
        ↓
blockchain registra hash do eleitor + chave pública
```

Voto:

```text
chave privada simulada + escolha
        ↓
backend deriva a chave pública
        ↓
backend encontra o eleitor cadastrado
        ↓
backend emite ou reutiliza a credencial
        ↓
blockchain registra o voto e queima o token
```

Auditoria:

```text
stream urna + tokens queimados + blocos
        ↓
relatório recalculado pela blockchain
```

## Observação

O backend chama `../blockchain/scripts/votify.py` para operações críticas. A
integridade continua sendo validada pela blockchain, não pela API.
