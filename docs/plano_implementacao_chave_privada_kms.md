# Implementação de Microserviço KMS Local e Separação de Custódia

Este plano detalha as alterações necessárias para isolar o armazenamento e uso de chaves privadas (Carteira Custodial) em um novo microserviço KMS (Key Management Service) Node.js, garantindo a tolerância a falhas (BFT) da rede blockchain.

## User Review Required
> [!IMPORTANT]
> **Modelo de Criptografia do KMS:** Para o KMS assinar transações sem depender do `wallet.dat` dos nós, temos duas opções arquiteturais. 
> A opção proposta no plano é usar os próprios nós MultiChain apenas como "calculadoras criptográficas", passando a chave privada no momento da assinatura (sem gravá-la). Isso evita configurar do zero uma biblioteca complexa como `bitcoinjs-lib` com os parâmetros customizados da MultiChain, mantendo o escopo viável para o cronograma do TCC.
> Por favor, aprove este caminho ou sinalize se prefere que o KMS utilize criptografia puramente em código (Node.js/TypeScript).

## Proposed Changes

A solução divide-se em duas grandes frentes: a criação do novo microserviço KMS e a refatoração do Backend atual para consumir esse KMS e parar de guardar chaves nas carteiras da rede.

### 1. Novo Microserviço: KMS
A ser implementado em um novo diretório na raiz: `/kms`.

#### [NEW] `kms/package.json`
- Inicialização de um projeto Node.js (TypeScript, Express, SQLite3/Prisma ou lowdb para simplicidade acadêmica).

#### [NEW] `kms/src/server.ts` e Rotas (Microserviço KMS / Vault Orchestrator)
O KMS deverá expor uma API REST interna operando sob o modelo de **Segurança Lógica Zero-Knowledge**, ou esta lógica poderá ser acoplada no Backend principal dependendo da preferência de deploy.
- `POST /api/v1/keys/generate`: 
  - **Ação:** Executa o comando `createkeypairs` na MultiChain (gera as chaves na hora, mas **não** as salva no `wallet.dat`). Gera também um **PIN numérico aleatório** (ex: 6 dígitos) exclusivo para este usuário.
  - **Cifragem Local (Zero-Knowledge):** A `PrivateKey` é encriptada na memória utilizando o `PIN` como chave simétrica (algoritmo AES-256-GCM), resultando no `EncryptedPrivateKey`.
  - **Armazenamento Seguro (Vault):** Envia o `EncryptedPrivateKey` via API REST para o HashiCorp Vault (`POST http://votify-vault:8200/v1/secret/data/voters/{voter_id_hash}`).
  - **Descarte:** A `PrivateKey` em texto claro e o `PIN` são imediatamente destruídos da memória RAM.
  - **Retorno:** Devolve o `address`, `pubKey` e o `PIN` (apenas uma vez) para o Frontend exibir ao eleitor.

- `POST /api/v1/keys/sign`:
  - **Recebe:** `voter_id_hash`, `pin` e `unsigned_tx_hex` (Transação Bruta).
  - **Ação 1 (Busca no Cofre):** Busca o segredo encriptado via `GET http://votify-vault:8200/v1/secret/data/voters/{voter_id_hash}`.
  - **Ação 2 (Decifragem):** Tenta decifrar o `EncryptedPrivateKey` em memória usando o `pin` fornecido (AES-256-GCM). Se o PIN estiver incorreto, a decifragem falha e a requisição é negada.
  - **Ação 3 (Assinatura):** Com a chave decifrada temporariamente em memória, executa `signrawtransaction` na MultiChain para obter a assinatura criptográfica.
  - **Limpeza (Zero-Knowledge):** Executa o descarte explícito/seguro da chave privada da memória (*secureMemoryWipe*).
  - **Retorno:** Devolve a transação assinada (`signed_tx_hex`).

#### [NEW] Infraestrutura HashiCorp Vault
- Inclusão do serviço `votify-vault` no `docker-compose.yml` da arquitetura.
- Configuração de políticas de acesso ao engine KV (Key-Value) v2 (`secret/data/voters/`).
- *(Nota Crítica: Como a chave privada é salva encriptada no Vault e a chave de decifragem (PIN) fica com o usuário, garante-se proteção máxima até mesmo contra acessos privilegiados ao Vault).*
---

### 2. Refatoração do Backend Principal

O Backend deve deixar de delegar a criação da carteira para os nós e passar a orquestrar o envio da transação dividindo a criação e a assinatura.

#### [MODIFY] `backend/src/services/blockchainClient.ts`
- **Modificar `issueCredential`:**
  - Em vez de chamar `getnewaddress`, fará uma requisição HTTP `POST /keys/generate` para o KMS.
  - Receberá o `address` e o `pin` gerado pelo KMS.
  - Executará `importaddress <address> "" false` no nó para que a MultiChain rastreie o saldo do eleitor (Watch-Only), sem ter a chave privada.
  - Retornará o `pin` na resposta da API para que o **Frontend exiba este código PIN ao eleitor** em um modal ou tela de sucesso, alertando-o para guardá-lo.
  
- **Modificar `castVote` (O coração do Fallback):**
  - A assinatura do endpoint de votação passará a receber o `pin` enviado pelo Frontend.
  - **Passo 1 (Criar):** Alterar o argumento do script Python para montar a transação **sem assinar**. 

#### [MODIFY] `blockchain/scripts/votify.py`
- Alterar o comando de criação do voto em `cast_vote`:
  ```python
  # Onde antes era:
  # txid = mc.cli(["createrawsendfrom", voter_address, outputs, data, "send"])
  
  # Passará a ser um processo de 4 etapas:
  # 1. Criar transação bruta (Raw Tx)
  unsigned_hex = mc.cli(["createrawsendfrom", voter_address, outputs, data, "create"])
  
  # 2. O Backend (ou o próprio script py) chamará o KMS para assinar:
  # KMS processa e retorna o signed_hex
  
  # 3. Enviar para a rede (Broadcast)
  txid = mc.cli(["sendrawtransaction", signed_hex])
  ```
*(Nota: a chamada ao KMS HTTP pode ser injetada no script Python `votify.py` usando `requests` ou delegada para o TypeScript do Backend)*. O ideal é o Backend TS orquestrar as chamadas.

## Verification Plan

### Testes Automatizados / Manuais
1. **Cadastro e Votação com Rede Saudável:** Realizar o fluxo completo (Cadastro -> Emissão -> Votação). O KMS deve gerar as chaves e o voto deve ser registrado com sucesso na blockchain.
2. **Auditoria de Isolamento (O mais importante):** Confirmar que as chaves privadas **não** estão no nó principal (Executar `dumpprivkey <endereco-eleitor>` no Master; deve retornar erro `Private key for address not known`).
3. **Teste BFT - Queda do Master (Cenário Real do Problema):**
   - Parar o container `votify-master`.
   - Autenticar o eleitor e votar (a requisição será roteada para o Slave).
   - Como o backend montará a `Raw Transaction` pelo Slave, a enviará ao KMS (que está sempre disponível e tem a chave), o KMS a assinará, e o Backend devolverá a `Signed Transaction` para o Slave propagar.
   - O voto **deve ser contabilizado com sucesso**, comprovando que a falha do Nó 1 não impacta mais a disponibilidade da eleição (High Availability).
