# Roteiro de Demonstração do Votify

Este roteiro foi pensado para apresentação para banca, com foco didático e sem
depender de explicações improvisadas.

## 1. Preparar o Ambiente

```powershell
cd blockchain
python scripts/votify.py up
python scripts/votify.py setup
```

Em outro terminal:

```powershell
cd backend
npm run dev
```

Em outro terminal:

```powershell
cd frontend
npm run dev -- --host 0.0.0.0
```

Abrir:

```text
http://localhost:5173
```

## 2. Mostrar a Configuração

Acessar:

```text
http://localhost:5173/configuracao
```

Passos:

1. Clicar em `Gerar dados`.
2. Mostrar que a chave privada simulada tem 5 dígitos.
3. Clicar em `Cadastrar eleitor`.
4. Mostrar o CPF e a chave na lista lateral.
5. Explicar que a blockchain recebe o hash do CPF e a chave pública, nunca o CPF
   em texto claro.

Frase sugerida:

```text
Esta tela representa a preparação da eleição. O CPF é protegido por hash e a
chave pública é derivada da chave privada simulada.
```

## 3. Realizar o Voto

Acessar:

```text
http://localhost:5173
```

Passos:

1. Copiar a chave privada da tela de configuração.
2. Colar no campo da urna.
3. Escolher um candidato.
4. Clicar em `Votar`.
5. Mostrar o comprovante com TXID, bloco, confirmações e hash.

Frase sugerida:

```text
Para o eleitor, o fluxo é simples. Por baixo, o sistema emite a credencial,
registra o voto e queima o token de votação.
```

## 4. Demonstrar Anti-Duplicidade

Na mesma tela do voto:

1. Clicar em `Votar` novamente com a mesma chave privada.
2. Mostrar o erro exibido no topo da tela.
3. Explicar que o token já foi consumido.

Frase sugerida:

```text
O mesmo eleitor não consegue votar duas vezes porque a credencial de voto já foi
usada. A tentativa não altera a urna.
```

## 5. Abrir a Auditoria

Acessar:

```text
http://localhost:5173/auditoria
```

Passos:

1. Clicar em `Atualizar auditoria`.
2. Mostrar total de votos.
3. Mostrar votos por opção.
4. Mostrar credenciais emitidas.
5. Mostrar tokens queimados.
6. Mostrar integridade válida.

Frase sugerida:

```text
O resultado não precisa ser confiado. Ele pode ser recalculado a partir da
blockchain.
```

## 6. Plano B

Se a blockchain demorar para atualizar:

1. Clicar em `Atualizar` no comprovante.
2. Clicar em `Atualizar auditoria`.
3. Explicar que confirmações dependem da mineração de novos blocos.

Se aparecer erro de eleitor já cadastrado:

1. Clicar em `Gerar dados` novamente.
2. Cadastrar outro eleitor.

Se aparecer erro de credencial já consumida:

1. Explicar que essa é a barreira anti-duplicidade funcionando.
