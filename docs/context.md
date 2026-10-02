# Contexto do Sistema: Blockchain Voting System (Votify)

Este documento descreve o contexto geral do Votify, um sistema de votação baseado em blockchain permissionada.

## Arquitetura Geral

O sistema é dividido em três componentes principais:

1. **Frontend**: Uma aplicação web Single-Page Application (SPA) responsável pela interação com o usuário (eleitor, auditor e administrador).
2. **Backend**: Uma API HTTP em Node.js (Express) que orquestra a lógica de negócio e conecta o frontend à blockchain.
3. **Blockchain (MultiChain)**: A rede descentralizada utilizada pelo Votify para garantir a integridade, o anonimato e a segurança do processo eleitoral.

## 1. Backend

O backend atua como uma ponte entre as requisições web do frontend e a execução dos comandos da blockchain.

- **Tecnologias**: Node.js, Express, TypeScript.
- **Responsabilidade**: 
  - Gerenciamento do ciclo de vida das eleições.
  - Autenticação e autorização (Admin vs Eleitor).
  - Criptografia: Geração de chaves (simulação), cálculo de HMAC-SHA256 do CPF para proteção de identidade.
  - Integração com a rede blockchain executando comandos via a interface do Python (`blockchain/scripts/votify.py`).
- **Operação**: O Votify registra os dados na rede MultiChain de forma anônima e imutável.

## 2. Blockchain (Rede MultiChain)

A camada de persistência do sistema Votify é construída usando **MultiChain** (um fork corporativo do Bitcoin).

- **Nós da Rede**: A rede é composta por nós Docker (`votify-master` e `votify-slave`), permitindo auditorias independentes através de consenso.
- **Streams e Assets**:
  - `identidades`: Stream de acesso restrito que armazena apenas o hash protegido (HMAC) dos eleitores e suas chaves públicas.
  - `credenciais_emitidas`: Stream que controla os tickets de votação distribuídos.
  - `urna`: Stream pública (para auditoria) e anônima, onde o voto final é depositado.
  - `VOTE_ELEICAO_001` (Asset): Token digital. Cada eleitor apto recebe exatamente 1 token.
- **Smart Filters**:
  - *Stream Filter*: Valida os dados submetidos à urna e bloqueia ativamente qualquer payload que tente expor a identidade do eleitor.
  - *Transaction Filter*: Regra que exige a "queima" (burn) de exatamente 1 token de voto na mesma transação que registra a escolha, evitando duplicação de votos (Double Voting) de forma algorítmica.

## 3. Frontend

O frontend provê a interface do usuário, expondo fluxos de configuração, votação, verificação de comprovantes e auditoria.

- **Telas**:
  - `/` : Cabine de votação.
  - `/configuracao` : Painel para criação e registro de identidades dos eleitores.
  - `/auditoria` : Tela para visualizar os blocos da rede, total de votos, e realizar validações de consenso.
  - `/admin` : Gerenciamento do pleito (candidatos e liberação/fechamento da eleição).
- O Frontend é propositalmente livre de frameworks reativos complexos, focando em simplicidade para as demonstrações. Para detalhes do seu padrão de construção, veja o arquivo `design.md`.
