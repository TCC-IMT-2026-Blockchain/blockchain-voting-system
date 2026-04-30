# Comandos Úteis da Camada Blockchain

## Subir e configurar tudo

```powershell
.\scripts\setup-chain.ps1
```

## Apagar tudo e iniciar do zero

```powershell
.\scripts\reset-chain.ps1
```

O script remove containers, rede Docker, volumes, `master-data`, `slave-data` e
`reports`. Ele pede confirmação digitando `RESET`.

Para executar sem confirmação:

```powershell
.\scripts\reset-chain.ps1 -Force
```

Para simular sem apagar nada:

```powershell
.\scripts\reset-chain.ps1 -WhatIf
```

Para remover também a imagem Docker local:

```powershell
.\scripts\reset-chain.ps1 -Force -RemoveImages
```

## Ver status da rede

```powershell
python .\scripts\votify.py status
```

## Gerar hash protegido do CPF

```powershell
python .\scripts\votify.py hash-cpf --cpf "123.456.789-09" --secret "segredo-da-eleicao" --election-id "ELEICAO_001"
```

## Registrar eleitor apto

```powershell
python .\scripts\votify.py register-voter --election-id "ELEICAO_001" --voter-id-hash "HASH_GERADO" --public-key "CHAVE_PUBLICA_SIMULADA"
```

## Emitir credencial de voto

```powershell
python .\scripts\votify.py issue-credential --election-id "ELEICAO_001" --voter-id-hash "HASH_GERADO"
```

Guarde o `voter_address` retornado para simular o voto desse eleitor.

## Votar

```powershell
python .\scripts\votify.py cast-vote --election-id "ELEICAO_001" --choice "CANDIDATO_A" --voter-address "ENDERECO_DE_VOTACAO"
```

## Gerar comprovante do voto

```powershell
python .\scripts\votify.py receipt --election-id "ELEICAO_001" --txid "TXID_DO_VOTO"
```

## Auditar eleição

```powershell
python .\scripts\votify.py audit --election-id "ELEICAO_001" --output "audit-ELEICAO_001.json"
```

## Autorizar endereço ou nó fiscal

```powershell
python .\scripts\votify.py grant-address --address "ENDERECO" --permissions "connect,send,receive"
```

## Autorizar o Slave Node automaticamente

```powershell
python .\scripts\votify.py authorize-slave
```

## Streams esperadas

```text
identidades
credenciais_emitidas
urna
```

Todas devem ser criadas com escrita restrita.

## Asset esperado

```text
VOTE_ELEICAO_001
```

Esse asset representa a credencial de voto. Cada voto válido deve consumir
exatamente 1 unidade desse asset.

## Documento para Backend e Frontend

O contrato de integração está em:

```text
backend-integration.md
```
