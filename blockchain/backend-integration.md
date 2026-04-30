# Integração do Backend e Frontend com a Camada Blockchain

Este documento descreve como o backend e o frontend devem conversar com a
camada blockchain do Votify.

A pasta `blockchain` entrega uma interface operacional por CLI. O backend pode
usar essa CLI como adaptador para enviar comandos à rede MultiChain, sem
precisar conhecer os detalhes internos de streams, assets, filtros e nós.

## Visão Geral

```text
[Frontend]
    |
    | HTTP/JSON
    v
[Backend da aplicação]
    |
    | Executa comandos CLI
    v
[blockchain/scripts/votify.py]
    |
    | multichain-cli dentro dos containers Docker
    v
[Rede MultiChain: Master Node + Slave Node]
```

Responsabilidade de cada camada:

- Frontend: coletar dados do usuário, exibir status, comprovante e resultado.
- Backend: receber requisições HTTP, chamar a CLI blockchain e devolver JSON.
- Blockchain: validar regras críticas, gravar dados imutáveis e permitir
  auditoria.

O backend não deve ser tratado como fonte final da verdade. Ele é apenas a
ponte entre a interface web e a blockchain.

## Regra Principal de Segurança

O backend pode facilitar o uso, mas não deve ser a camada que garante a
integridade final da votação.

A integridade deve permanecer na MultiChain:

- a elegibilidade é registrada na stream `identidades`;
- a emissão da credencial é registrada na stream `credenciais_emitidas`;
- o voto é registrado na stream `urna`;
- o formato do voto é validado por Stream Filter;
- o consumo de uma única credencial é validado por Transaction Filter;
- a anti-duplicidade é garantida pelo asset `VOTE_ELEICAO_001`.

## Como o Backend Deve Chamar a Blockchain

O backend deve executar o script:

```powershell
python .\scripts\votify.py <comando> <argumentos>
```
Quase todos os comandos retornam JSON no `stdout`. O backend deve fazer parse
desse JSON e retornar uma resposta HTTP para o frontend.

Exemplo conceitual em Node.js:

```js
import { execFile } from "node:child_process";

function runBlockchain(args) {
  return new Promise((resolve, reject) => {
    execFile("python", ["scripts/votify.py", ...args], {
      cwd: "blockchain-voting-system\\blockchain",
      shell: false,
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || stdout || error.message));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve(stdout.trim());
      }
    });
  });
}
```

Esse exemplo é apenas um contrato de integração. A implementação real do
backend fica fora do escopo da camada blockchain.

## Fluxo Completo Para o Usuário Votar

### 1. Preparação da Rede

Executado pelo administrador do projeto, não pelo usuário final:

```powershell
.\scripts\setup-chain.ps1
```

Esse comando sobe a rede e cria os objetos fundamentais:

- stream `identidades`;
- stream `credenciais_emitidas`;
- stream `urna`;
- asset `VOTE_ELEICAO_001`;
- Stream Filter da urna;
- Transaction Filter de queima da credencial.

O frontend não precisa saber dessa etapa.

### 2. Cadastro do Eleitor Apto

Entrada recebida pelo backend:

```json
{
  "cpf": "123.456.789-09",
  "public_key": "CHAVE_PUBLICA_SIMULADA",
  "election_id": "ELEICAO_001"
}
```

O CPF nunca deve ser gravado em texto claro na blockchain. O backend deve gerar
o hash protegido:

```powershell
python .\scripts\votify.py hash-cpf --cpf "123.456.789-09" --secret "segredo-da-eleicao" --election-id "ELEICAO_001"
```

Saída:

```text
HASH_GERADO
```

Depois, o backend cadastra o eleitor apto:

```powershell
python .\scripts\votify.py register-voter --election-id "ELEICAO_001" --voter-id-hash "HASH_GERADO" --public-key "CHAVE_PUBLICA_SIMULADA"
```

Saída esperada:

```json
{
  "identity_txid": "TXID_DO_CADASTRO"
}
```

O frontend pode exibir uma mensagem como: eleitor registrado para a eleição.

### 3. Validação da Chave Privada Simulada

Na explicação do TCC, a chave privada representa uma abstração da biometria.

Fluxo sugerido:

```text
[Eleitor apresenta chave privada simulada]
        |
        v
[Backend verifica se ela corresponde à chave pública cadastrada]
        |
        v
[Se for válida, backend pede uma credencial de voto à blockchain]
```

Essa validação libera a tentativa de voto, mas não é a regra final contra voto
duplicado. A regra final continua sendo on-chain, pelo asset consumível.

O backend não deve persistir a chave privada.

### 4. Emissão da Credencial de Voto

Depois da validação da chave privada simulada, o backend pede uma credencial:

```powershell
python .\scripts\votify.py issue-credential --election-id "ELEICAO_001" --voter-id-hash "HASH_GERADO"
```

Saída esperada:

```json
{
  "election_id": "ELEICAO_001",
  "voter_id_hash": "HASH_GERADO",
  "voter_address": "ENDERECO_DE_VOTACAO",
  "asset": "VOTE_ELEICAO_001",
  "token_transfer_txid": "TXID_DA_TRANSFERENCIA_DO_TOKEN",
  "credential_record_txid": "TXID_DO_REGISTRO_DA_CREDENCIAL"
}
```

O `voter_address` é um endereço blockchain usado para gastar a credencial de
voto.

Para manter o anonimato:

- o `voter_address` não é gravado na stream `identidades`;
- o `voter_address` não é gravado na stream `credenciais_emitidas`;
- o voto não carrega CPF, hash do CPF, chave pública ou dados pessoais;
- o backend não deve salvar uma tabela permanente ligando eleitor, endereço e
  voto.

No protótipo, o backend pode guardar o `voter_address` apenas durante a sessão
de votação, o suficiente para chamar o comando de voto.

### 5. Envio do Voto

Entrada recebida pelo backend:

```json
{
  "election_id": "ELEICAO_001",
  "choice": "CANDIDATO_A",
  "voter_address": "ENDERECO_DE_VOTACAO"
}
```

Comando:

```powershell
python .\scripts\votify.py cast-vote --election-id "ELEICAO_001" --choice "CANDIDATO_A" --voter-address "ENDERECO_DE_VOTACAO"
```

Saída esperada:

```json
{
  "txid": "TXID_DO_VOTO",
  "burn_address": "ENDERECO_DE_QUEIMA",
  "receipt": {
    "status": "pending_stream_index",
    "txid": "TXID_DO_VOTO",
    "message": "Transaction sent; stream item is not indexed yet."
  }
}
```

Logo após o envio, o recibo pode aparecer como pendente porque a stream ainda
está sendo indexada. Após alguns segundos, o backend pode consultar o
comprovante definitivo.

### 6. Consulta do Comprovante

Comando:

```powershell
python .\scripts\votify.py receipt --election-id "ELEICAO_001" --txid "TXID_DO_VOTO"
```

Saída esperada:

```json
{
  "status": "confirmed",
  "election_id": "ELEICAO_001",
  "txid": "TXID_DO_VOTO",
  "stream": "urna",
  "stream_item_id": "TXID_DO_VOTO:VOUT",
  "blockhash": "HASH_DO_BLOCO",
  "blockheight": 123,
  "blocktime": 1710000000,
  "confirmations": 5,
  "receipt_hash": "HASH_DO_COMPROVANTE"
}
```

O frontend pode entregar ao eleitor:

- `txid`;
- `receipt_hash`;
- número de confirmações;
- status do comprovante.

Esse comprovante prova que o voto foi incluído na blockchain, mas não deve
revelar a opção escolhida para terceiros.

### 7. Auditoria e Apuração

Comando:

```powershell
python .\scripts\votify.py audit --election-id "ELEICAO_001" --output "audit-ELEICAO_001.json"
```

Saída esperada:

```json
{
  "chain": "votifychain",
  "chain_height": 123,
  "election_id": "ELEICAO_001",
  "asset": "VOTE_ELEICAO_001",
  "burn_address": "ENDERECO_DE_QUEIMA",
  "tokens_burned_by_vote_transactions": 10,
  "votes_total": 10,
  "votes_by_choice": {
    "CANDIDATO_A": 6,
    "CANDIDATO_B": 4
  },
  "credentials_issued": 12,
  "votes_match_burned_tokens": true,
  "min_vote_confirmations": 3
}
```

O frontend pode exibir:

- total de votos;
- votos por opção;
- altura atual da blockchain;
- confirmações mínimas;
- se a contagem bate com os tokens queimados.

## Endpoints Sugeridos Para o Backend

Esses endpoints são sugestões para orientar o desenvolvedor. A camada
blockchain não implementa essas rotas.

### Registrar eleitor

```http
POST /api/elections/:electionId/voters
```

Body:

```json
{
  "cpf": "123.456.789-09",
  "public_key": "CHAVE_PUBLICA_SIMULADA"
}
```

Backend chama:

```text
hash-cpf
register-voter
```

Resposta sugerida:

```json
{
  "status": "registered",
  "identity_txid": "TXID_DO_CADASTRO"
}
```

### Liberar credencial de voto

```http
POST /api/elections/:electionId/credentials
```

Body:

```json
{
  "cpf": "123.456.789-09",
  "private_key_simulation": "CHAVE_PRIVADA_SIMULADA"
}
```

Backend faz:

```text
1. Valida a chave privada simulada contra a chave pública cadastrada.
2. Calcula o voter_id_hash.
3. Chama issue-credential.
```

Resposta sugerida:

```json
{
  "status": "credential_issued",
  "voter_address": "ENDERECO_DE_VOTACAO",
  "credential_record_txid": "TXID_DO_REGISTRO_DA_CREDENCIAL"
}
```

Observação: em uma versão mais fechada, o backend pode manter o
`voter_address` em sessão e não devolvê-lo ao frontend. Para o TCC, devolver o
endereço ajuda na demonstração.

### Votar

```http
POST /api/elections/:electionId/votes
```

Body:

```json
{
  "choice": "CANDIDATO_A",
  "voter_address": "ENDERECO_DE_VOTACAO"
}
```

Backend chama:

```text
cast-vote
```

Resposta sugerida:

```json
{
  "status": "vote_sent",
  "txid": "TXID_DO_VOTO",
  "receipt": {
    "status": "pending_stream_index",
    "txid": "TXID_DO_VOTO"
  }
}
```

### Consultar comprovante

```http
GET /api/elections/:electionId/votes/:txid/receipt
```

Backend chama:

```text
receipt
```

Resposta sugerida:

```json
{
  "status": "confirmed",
  "txid": "TXID_DO_VOTO",
  "receipt_hash": "HASH_DO_COMPROVANTE",
  "confirmations": 5,
  "blockheight": 123
}
```

### Consultar apuração

```http
GET /api/elections/:electionId/audit
```

Backend chama:

```text
audit
```

Resposta sugerida:

```json
{
  "votes_total": 10,
  "votes_by_choice": {
    "CANDIDATO_A": 6,
    "CANDIDATO_B": 4
  },
  "votes_match_burned_tokens": true,
  "chain_height": 123,
  "min_vote_confirmations": 3
}
```

### Consultar status da rede

```http
GET /api/blockchain/status
```

Backend chama:

```text
status
```

Essa rota é útil para telas administrativas e para a apresentação do TCC.

## Tratamento de Erros

O backend deve tratar erro pela saída e pelo código de retorno do processo.

Erros comuns:

- credencial já emitida para o eleitor;
- eleitor tentando votar sem token;
- tentativa de segundo voto;
- voto com formato inválido;
- tentativa de inserir CPF ou campo pessoal no voto;
- nó Docker indisponível;
- rede ainda inicializando.

Mapeamento sugerido:

```text
Credencial já emitida          -> HTTP 409 Conflict
Token insuficiente             -> HTTP 409 Conflict
Voto rejeitado por filtro      -> HTTP 400 Bad Request
Blockchain indisponível        -> HTTP 503 Service Unavailable
Erro inesperado da CLI         -> HTTP 500 Internal Server Error
```

## Cuidados Para Não Quebrar o Anonimato

O backend e o frontend não devem:

- gravar CPF em texto claro;
- gravar CPF dentro da stream `urna`;
- gravar `voter_id_hash` dentro da stream `urna`;
- anexar nome, unidade, e-mail ou chave pública ao voto;
- salvar uma tabela permanente com `voter_id_hash`, `voter_address`, `choice` e
  `txid` juntos;
- gerar logs com dados pessoais e escolha de voto na mesma linha;
- permitir que o frontend envie campos extras para o voto.

O payload de voto deve conter apenas:

```json
{
  "schema_version": 1,
  "election_id": "ELEICAO_001",
  "choice": "CANDIDATO_A"
}
```

Se o backend tentar enviar campos extras, o Stream Filter deve rejeitar a
transação.

## O Que a Blockchain Garante Sozinha

Mesmo que o backend tenha erro de regra de negócio, a blockchain ainda deve
barrar:

- voto sem JSON válido;
- voto com campo de identidade;
- voto sem asset `VOTE_ELEICAO_001`;
- voto consumindo quantidade diferente de 1 token;
- voto tentando reutilizar uma credencial já consumida;
- voto que não queima a credencial no endereço correto.

Essa é a separação mais importante para defender na banca:

```text
O backend opera o fluxo.
A blockchain valida a integridade.
```

## Resumo Para o Desenvolvedor

Contrato mínimo:

```text
Cadastro:
hash-cpf -> register-voter

Liberação da urna:
validar chave privada simulada -> issue-credential

Voto:
cast-vote

Comprovante:
receipt

Apuração:
audit

Status administrativo:
status
```

O frontend deve receber apenas dados necessários para a experiência:

- status de cadastro;
- status de credencial;
- opções de voto;
- `txid`;
- `receipt_hash`;
- confirmações;
- resultado auditável.

O frontend não precisa conhecer streams, filtros, assets, permissões ou comandos
MultiChain.
