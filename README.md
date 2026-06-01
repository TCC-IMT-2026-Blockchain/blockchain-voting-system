# Votify

Sistema de votação eletrônica seguro baseado em blockchain, desenvolvido para o
TCC **DESENVOLVIMENTO DE UM SISTEMA DE VOTAÇÃO ELETRÔNICA SEGURO BASEADO EM
BLOCKCHAIN**.

O projeto usa uma rede privada MultiChain para registrar identidades protegidas,
emitir credenciais únicas de voto, gravar votos anônimos, queimar o token de
votação e permitir auditoria independente por qualquer nó participante.

## Partes do Projeto

```text
blockchain  Camada MultiChain, scripts, streams, assets, filtros e auditoria
backend     API de integração entre aplicação, demonstração e blockchain
frontend    Urna oficial simples: configuração, voto e auditoria
visualizer  Tela didática independente que anima os bastidores do sistema
```

## Fluxo Atual

1. O administrador acessa `/configuracao`.
2. Gera CPF e chave privada simulada para demonstração.
3. Cadastra o eleitor.
4. A aplicação gera a chave pública e registra na blockchain o hash do CPF mais
   a chave pública.
5. O administrador clica em `Travar eleição`, emitindo as credenciais dos eleitores e revogando permissões críticas do Master.
6. O eleitor acessa `/`, informa a chave privada simulada e vota usando a credencial já emitida.
7. A tela `/auditoria` recalcula o resultado pela blockchain.

## Rodar

Modo completo, reiniciando a demo do zero:

```powershell
.\start-demo.cmd
```

O travamento da eleição é feito pela tela `/configuracao`, depois de cadastrar
eleitores e opções de voto.

Subir blockchain:

```powershell
cd blockchain
python scripts/votify.py up
python scripts/votify.py setup
```

Subir backend:

```powershell
cd backend
npm install
npm run dev
```

Subir frontend oficial:

```powershell
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

Subir visualizador didático:

```powershell
cd visualizer
npm install
npm run dev -- --host 0.0.0.0 --port 5174
```

URLs principais:

```text
Urna oficial: http://localhost:5173
Visualizador: http://localhost:5174
Backend:      http://localhost:3333/api/v1
```

## Telas

```text
/               Urna do eleitor
/configuracao   Cadastro de eleitores para demonstração
/auditoria      Resultado e provas de integridade
```

## Segurança Demonstrada

- CPF não entra em texto claro na blockchain.
- O hash do eleitor usa HMAC-SHA256.
- A chave privada simulada representa a biometria no protótipo.
- A blockchain armazena apenas a chave pública.
- O token `VOTE_ELEICAO_001` representa o direito de votar uma vez.
- O voto não carrega CPF, hash do eleitor ou chave pública.
- Filtros nativos rejeitam votos malformados ou sem consumo do token.
- A auditoria compara votos registrados com tokens queimados.
- A tentativa de votar duas vezes é bloqueada pela própria lógica on-chain.
