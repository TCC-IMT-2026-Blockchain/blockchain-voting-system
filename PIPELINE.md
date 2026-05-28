# Pipeline de Desenvolvimento do Votify

Este documento organiza o desenvolvimento do projeto em etapas sequenciais.
A ideia é fazer **um bloco por vez**, evitando misturar blockchain, backend,
frontend, visualização e documentação ao mesmo tempo.

## 1. Base Blockchain

Objetivo: garantir que a camada MultiChain seja a fonte de integridade do
sistema.

Entregáveis:

- rede Docker com Nó Administrador e Nós Fiscais;
- streams `identidades`, `credenciais_emitidas` e `urna`;
- asset/token `VOTE_ELEICAO_001`;
- filtros nativos para formato do voto e consumo do token;
- scripts de setup, reset, voto, comprovante, auditoria e status;
- relatório de auditoria com votos, tokens queimados, blocos e confirmações.

Critério de pronto:

- voto válido entra na urna;
- voto duplicado é rejeitado;
- voto com dados pessoais é rejeitado;
- auditoria confirma `votos = tokens queimados`;
- Nós Fiscais conseguem replicar e auditar a blockchain.

## 2. Backend Completo da Eleição

Objetivo: transformar o backend atual, que ainda é mock, em uma API funcional
conectada à blockchain.

Entregáveis:

- autenticação por perfil: eleitor, administrador e auditor;
- API para criar e gerenciar eleições;
- API para cadastrar candidatos/opções;
- API para cadastrar eleitores aptos;
- integração com `blockchain/scripts/votify.py`;
- emissão de credencial de voto;
- envio de voto para a blockchain;
- consulta de comprovante;
- consulta de auditoria e resultado;
- endpoint de status da blockchain;
- tratamento de erros da blockchain em respostas HTTP claras.

Critério de pronto:

- frontend consegue operar a eleição usando apenas a API;
- backend não usa mock para voto, comprovante, resultado e auditoria;
- backend não grava CPF em texto claro na blockchain;
- backend não grava identidade junto com escolha do voto;
- regras críticas continuam validadas pela blockchain.

## 3. Frontend Completo por Perfil

Objetivo: criar a interface principal do sistema para uso real na apresentação.

Entregáveis:

- tela de login;
- dashboard do eleitor;
- dashboard do administrador;
- dashboard do auditor;
- lista de eleições;
- detalhe da eleição;
- cédula de votação;
- validação da chave privada simulada;
- confirmação antes do voto;
- tela de voto enviado;
- tela de comprovante;
- verificação de comprovante;
- tela de resultados;
- tela de auditoria;
- tela de status da blockchain.

Critério de pronto:

- eleitor consegue votar de ponta a ponta;
- administrador consegue preparar dados da eleição;
- auditor consegue verificar resultado e integridade;
- interface explica o processo sem exigir conhecimento profundo de blockchain.

## 4. Visualizador Didático da Blockchain (Pausado)

Objetivo futuro: criar uma visualização gráfica para a banca enxergar a
blockchain funcionando durante a demonstração.

Status: removido do escopo atual para ser repensado depois. A demonstração
atual deve funcionar sem depender desse painel.

Importante: este painel é **didático e observacional**. Ele não é a fonte de
segurança do sistema. Mesmo que ele seja alterado, a integridade continua na
blockchain.

Entregáveis:

- tela visual com Nó Administrador, Nós Fiscais, aplicação, blockchain e
  auditoria;
- bloquinhos sendo adicionados conforme a blockchain avança;
- animação de votos chegando;
- voto passando pelo filtro;
- token sendo consumido/queimado;
- stream urna recebendo o voto;
- contador de blocos;
- contador de confirmações;
- resultado parcial por opção;
- quantidade de tokens emitidos e queimados;
- status dos nós conectados;
- últimos txids/comprovantes;
- modo apresentação, com textos simples e grandes.

Fluxo visual esperado:

```text
Eleitor -> Aplicação -> Filtro -> Urna
                         |
                         v
                    Queima do Token
                         |
                         v
                    Novo Bloco
                         |
                         v
                  Confirmações + Auditoria
```

Critério de pronto:

- painel atualiza automaticamente durante a execução da blockchain;
- novo voto aparece visualmente;
- novo bloco aparece como bloquinho na cadeia;
- confirmações aumentam com o tempo;
- resultado visual bate com auditoria real da blockchain;
- fica claro para a banca que o painel só visualiza, não valida.

## 5. Painel de Auditoria e Resultados

Objetivo: separar a visualização operacional da blockchain da visão de
auditoria e apuração.

Entregáveis:

- total de votos;
- votos por opção;
- tokens emitidos;
- tokens queimados;
- consistência `votos = tokens queimados`;
- altura atual da blockchain;
- confirmações mínimas dos votos;
- lista de transações recentes;
- consulta de comprovante por `txid` ou `receipt_hash`;
- indicação visual de integridade.

Critério de pronto:

- auditor consegue recalcular ou consultar o resultado sem depender de uma tela
  administrativa;
- dados exibidos vêm da blockchain;
- divergências ficam visíveis.

## 6. Demonstração Guiada

Objetivo: preparar um roteiro fechado para apresentar o sistema sem improviso.

Roteiro sugerido:

1. resetar a blockchain;
2. subir a rede;
3. mostrar Nó Administrador e Nós Fiscais conectados;
4. criar/preparar eleição;
5. cadastrar eleitor com CPF protegido;
6. validar chave privada simulada;
7. emitir credencial/token;
8. votar;
9. mostrar o comprovante;
10. explicar token consumido e bloco criado;
11. acompanhar confirmações;
12. tentar voto duplicado;
13. mostrar rejeição;
14. abrir auditoria;
15. mostrar resultado recalculado.

Critério de pronto:

- roteiro executa sem comandos manuais confusos;
- cada etapa tem print/tela preparada;
- existe plano B caso a blockchain demore ou algum container falhe.

## 7. Documentação, Artigo e Apresentação

Objetivo: manter a explicação acadêmica alinhada ao sistema implementado.

Entregáveis:

- README raiz atualizado;
- guia de instalação;
- guia de demonstração;
- documentação backend/frontend/blockchain;
- diagramas atualizados;
- slides com a versão final do fluxo;
- artigo/TCC com limitações e trabalhos futuros.

Pontos obrigatórios na explicação:

- CPF não entra em texto claro na blockchain;
- chave privada simula biometria no protótipo;
- credencial/token impede duplicidade;
- voto não carrega identidade;
- filtros rejeitam voto inválido;
- blocos e hashes aumentam imutabilidade;
- comprovante prova inclusão, não escolha;
- auditoria recalcula resultado pela blockchain;
- visualizador didático fica como trabalho futuro, não como requisito atual.

Critério de pronto:

- qualquer colega consegue explicar o projeto usando os documentos;
- apresentação responde dúvidas básicas da banca;
- limitações estão claras e honestas.

## Ordem Recomendada de Execução

```text
1. Fechar blockchain
2. Integrar backend real com blockchain
3. Criar frontend principal
4. Criar painel de auditoria/resultados
5. Ensaiar demonstração guiada
6. Finalizar documentação, artigo e slides
7. Repensar visualizador didático como melhoria futura
```

## Decisão Arquitetural Importante

O visualizador gráfico pode facilitar muito a apresentação, mas deve ser
tratado como uma camada separada:

```text
Blockchain = verdade e integridade
Backend = ponte operacional
Frontend = uso do sistema
Visualizador = ideia futura para explicação didática em tempo real
Auditoria = conferência dos dados on-chain
```

Essa separação evita confusão na banca e deixa claro que a segurança não depende
da animação visual.

## Status Atual das Features

Status atual da demonstração:

- `/auditoria` deixou de exibir apenas JSON bruto e passou a mostrar métricas,
  resultado por opção e provas de integridade;
- o comprovante da urna foi organizado em um card com status, TXID, bloco,
  confirmações e hash;
- a urna demonstra duplicidade quando o usuário tenta votar novamente com a mesma
  chave privada simulada;
- `DEMO.md` foi criado com o roteiro de apresentação;
- os READMEs foram atualizados para refletir o fluxo real atual;
- o visualizador em tempo real foi removido do escopo atual e fica como melhoria
  futura.
