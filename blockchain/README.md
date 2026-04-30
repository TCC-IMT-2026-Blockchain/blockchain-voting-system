# Camada Blockchain do Votify

Esta pasta contém apenas a camada blockchain do projeto: MultiChain, Docker,
filtros nativos, automações por CLI e auditoria. Ela não implementa backend web
nem frontend.

## Componentes

- `docker-compose.yml`: sobe os nós `votify-master` e `votify-slave`.
- `filters/urna_stream_filter.js`: valida o formato dos votos publicados na
  stream `urna` e bloqueia campos de identidade.
- `filters/vote_tx_filter.template.js`: template do Transaction Filter que
  exige a queima de exatamente 1 token `VOTE_ELEICAO_001` em cada voto.
- `scripts/votify.py`: CLI principal de automação da camada blockchain.
- `scripts/setup-chain.ps1`: wrapper PowerShell para subir e configurar a rede.
- `scripts/audit-chain.ps1`: wrapper PowerShell para gerar relatório de
  auditoria.
- `scripts/reset-chain.ps1`: wrapper PowerShell para apagar containers, rede
  Docker, dados locais dos nós e relatórios gerados.
- `backend-integration.md`: contrato de comunicação entre backend, frontend e
  camada blockchain.
- `flow-explanation.md`: explicação didática do fluxo para TCC e slides.

## Modelo Implementado

O fluxo operacional implementado é:

```text
1. Cadastro de identidade protegida na stream identidades
2. Emissão de uma credencial de voto na forma de asset
3. Registro da emissão em credenciais_emitidas
4. Voto anônimo na stream urna
5. Queima obrigatória de 1 VOTE_ELEICAO_001 na mesma transação do voto
6. Geração de comprovante criptográfico de inclusão
7. Auditoria por leitura direta da blockchain
```

O eleitor não manipula o token diretamente. O token é uma credencial interna da
blockchain, operacionalizada pelos scripts/CLI.

## Setup Inicial

Com o Docker Desktop rodando:

```powershell
cd blockchain
.\scripts\setup-chain.ps1
```

Ou manualmente:

```powershell
python .\scripts\votify.py up
python .\scripts\votify.py setup --initial-supply 100
```

O setup cria:

- `identidades` com escrita restrita;
- `credenciais_emitidas` com escrita restrita;
- `urna` com escrita restrita;
- asset `VOTE_ELEICAO_001`;
- Stream Filter da urna;
- Transaction Filter da urna;
- assinatura/subscription dos nós nas streams.

## Reset Total da Blockchain

Para apagar containers, rede Docker, volumes, dados locais dos nós e relatórios
gerados:

```powershell
.\scripts\reset-chain.ps1
```

O script pede confirmação digitando `RESET`.

Para executar sem confirmação interativa:

```powershell
.\scripts\reset-chain.ps1 -Force
```

Para simular o reset sem apagar nada:

```powershell
.\scripts\reset-chain.ps1 -WhatIf
```

Para apagar também a imagem Docker local criada pelo `docker compose build`:

```powershell
.\scripts\reset-chain.ps1 -Force -RemoveImages
```

Por segurança, o script só remove estes diretórios dentro da pasta
`blockchain`:

- `master-data`;
- `slave-data`;
- `reports`.

## Gerar Hash Protegido do CPF

Use HMAC-SHA256 com segredo da eleição:

```powershell
python .\scripts\votify.py hash-cpf `
  --cpf "123.456.789-09" `
  --secret "segredo-da-eleicao" `
  --election-id "ELEICAO_001"
```

O resultado é o `voter_id_hash`.

## Registrar Eleitor

```powershell
python .\scripts\votify.py register-voter `
  --election-id "ELEICAO_001" `
  --voter-id-hash "HASH_GERADO" `
  --public-key "CHAVE_PUBLICA_SIMULADA"
```

Esse comando publica na stream `identidades`.

## Emitir Credencial de Voto

```powershell
python .\scripts\votify.py issue-credential `
  --election-id "ELEICAO_001" `
  --voter-id-hash "HASH_GERADO"
```

O script:

- verifica se a credencial já foi emitida;
- cria um endereço de votação se nenhum for informado;
- concede permissões necessárias ao endereço;
- envia 1 `VOTE_ELEICAO_001`;
- registra a emissão em `credenciais_emitidas`.

O retorno inclui o `voter_address`, que será usado no voto.

## Votar

```powershell
python .\scripts\votify.py cast-vote `
  --election-id "ELEICAO_001" `
  --choice "CANDIDATO_A" `
  --voter-address "ENDERECO_DE_VOTACAO"
```

A transação faz duas coisas ao mesmo tempo:

```text
Publica {"election_id":"ELEICAO_001","choice":"CANDIDATO_A"} na stream urna.
Queima exatamente 1 VOTE_ELEICAO_001.
```

Se não houver token, se o token for incorreto, se a quantidade não for 1 ou se o
voto carregar dados pessoais, a transação é rejeitada.

## Comprovante de Inclusão

Depois do voto, gere ou consulte o comprovante:

```powershell
python .\scripts\votify.py receipt `
  --election-id "ELEICAO_001" `
  --txid "TXID_DO_VOTO"
```

O comprovante contém:

- `txid`;
- stream;
- item da stream;
- bloco;
- hash do bloco;
- confirmações;
- hash de inclusão.

Esse comprovante prova inclusão e imutabilidade, mas não revela a escolha do
voto.

## Auditoria

```powershell
.\scripts\audit-chain.ps1 -ElectionId "ELEICAO_001"
```

Ou:

```powershell
python .\scripts\votify.py audit `
  --election-id "ELEICAO_001" `
  --output "audit-ELEICAO_001.json"
```

O relatório mostra:

- altura da blockchain;
- total de votos;
- votos por opção;
- total de credenciais emitidas;
- tokens queimados pelas transações de voto;
- menor número de confirmações entre os votos;
- asset usado;
- burn address.

## Status e Governança

Verificar estado geral:

```powershell
python .\scripts\votify.py status
```

Autorizar um endereço ou nó fiscal:

```powershell
python .\scripts\votify.py grant-address `
  --address "ENDERECO" `
  --permissions "connect,send,receive"
```

Autorizar automaticamente o Slave Node que está aguardando permissão:

```powershell
python .\scripts\votify.py authorize-slave
```

Conceder escrita em uma stream específica:

```powershell
python .\scripts\votify.py grant-address `
  --address "ENDERECO" `
  --permissions "send,receive" `
  --stream-write "urna"
```

## Observações de Segurança do Protótipo

O modelo atual mantém a custódia operacional dos endereços de votação na
infraestrutura do protótipo, como discutido no escopo do TCC. Isso simplifica a
demonstração e mantém o foco na integridade on-chain.

Em uma versão de produção, o ideal seria o eleitor gerar e custodiar sua própria
chave de votação, reduzindo a dependência operacional do Master Node.

O Transaction Filter garante que votos publicados na `urna` só sejam aceitos se
consumirem exatamente 1 token da eleição. O Stream Filter reforça o formato dos
dados e impede que payloads com identidade sejam usados como votos válidos.
