# Comportamento da MultiChain em Ataques ao Nó Master

Para entender como a rede lida com falhas, precisamos esclarecer algumas dúvidas teóricas vitais sobre a arquitetura da MultiChain. Vamos usar o cenário exato do **Votify**: 1 Nó Master e 2 Nós Fiscais.

> [!NOTE]
> Você mencionou o termo "round-trip" na sua pergunta. Na verdade, em computação distribuída e na MultiChain, o termo correto para esse mecanismo é **Round-Robin** (um sistema de revezamento ou rodízio em círculo).

---

## 1. O Mito do "Nó Master"

A primeira grande revelação é que, para o protocolo da blockchain MultiChain, **não existe um "Rei" ou "Nó Master" intocável**. 

O que nós chamamos de "Master" (Nó 1) é simplesmente a máquina que **criou a gênese da rede** (o primeiro bloco). Por ter criado a rede, a MultiChain dá a esse nó, automaticamente, todas as permissões (`admin`, `mine`, `connect`, `send`, `receive`).

Quando o Master autoriza os Fiscais (Nó 2 e Nó 3) e concede a eles a permissão `mine` (minerar/forjar blocos), **todos passam a ser iguais no consenso da rede**. A rede não torna outro nó "Master" se o Nó 1 cair, porque o título "Master" não importa; o que importa são as permissões que os nós possuem gravadas no ledger.

---

## 2. Como Funciona o Consenso "Round-Robin"

Diferente do Bitcoin, onde os nós competem gastando energia para ver quem acha o bloco primeiro (Proof of Work), a MultiChain usa um consenso rígido de **Rodízio (Round-Robin)** para redes privadas.

A rede determina que os nós que possuem a permissão `mine` devem se revezar na forja de blocos. Isso é governado por um parâmetro matemático chamado `mining-diversity` (diversidade de mineração).

Se o `mining-diversity` for 0.5 (50%) e temos 3 nós mineradores (Nó 1, Nó 2 e Nó 3), a regra matemática exige que um nó não possa criar um bloco novamente até que um certo número de blocos tenha sido criado pelos seus pares.

A fila de fechamento de blocos fica parecida com isto:
1. Bloco 1: Criado pelo **Nó 1**
2. Bloco 2: Criado pelo **Nó 2**
3. Bloco 3: Criado pelo **Nó 3**
4. Bloco 4: Criado pelo **Nó 1**
*(E assim sucessivamente...)*

---

## 3. Cenário A: A Queda do Master Node

Você perguntou: *"Quando o master node cai, todos os nós automaticamente recebem o mine ou tem o round-trip?"*

**Resposta:** A permissão `mine` **não é concedida automaticamente quando alguém cai**. As permissões precisam ser concedidas previamente por um Administrador. Se o Master cair e os Fiscais não tivessem recebido `mine` previamente, a rede pararia.

Porém, graças à nossa última atualização no código do Votify, **nós concedemos o `mine` aos Nós Fiscais no momento do setup**. Como todos já têm a permissão, veja o que acontece quando o Master cai:

1. A rede está no rodízio normal: `[Nó 1 -> Nó 2 -> Nó 3]`.
2. O **Nó 1 sofre um apagão**.
3. Ocorre uma pequena lentidão momentânea pois a rede "esperava" o bloco do Nó 1.
4. O algoritmo Round-Robin detecta a ausência e entende que a vez expirou.
5. O consenso pula o Nó 1 e repassa a vez. A rede ajusta o rodízio matematicamente e continua forjando blocos apenas entre os nós vivos: `[Nó 2 -> Nó 3 -> Nó 2 -> Nó 3]`.

---

## 4. Cenário B: O Comprometimento (Ataque) ao Master Node

Se um hacker invadir o servidor do Nó Master (Nó 1) e tomar controle sobre ele, o estrago é contido pelo consenso matemático.

O hacker **tem** a permissão `mine`, logo ele pode forjar blocos quando for a vez dele no Round-Robin. Mas ele se depara com três barreiras intransponíveis:

### Barreira 1: Ele não pode forjar os blocos dos outros
Pela regra do Round-Robin e do `mining-diversity`, o hacker (Nó 1) só pode criar 1 bloco a cada rodada. Ele é obrigado a esperar que o Nó 2 e o Nó 3 façam seus blocos. Se o hacker tentar enviar 5 blocos seguidos, a rede rejeita do segundo ao quinto bloco imediatamente.

### Barreira 2: Ele não tem as chaves dos eleitores
O hacker não pode inventar votos, pois não tem as chaves privadas dos eleitores. Qualquer transação que ele tentar enfiar à força no bloco que ele fechou será rejeitada pelos Nós Fiscais, pois a assinatura criptográfica será inválida.

### Barreira 3: Ele não altera as regras do jogo
Mesmo comprometendo o Master original, ele precisa respeitar os filtros (`URNA_STREAM_FILTER` e `VOTE_TX_FILTER`). Um voto exige consumir 1 token oficial (`VOTE_ELEICAO_001`). O hacker não consegue criar blocos com votos que burlem o saldo de tokens. Se ele o fizer, o Nó 2 e Nó 3 desconsideram o bloco "sujo" dele e seguem a vida a partir do último bloco válido.

---

## 5. O Dilema da Carteira Custodial (Custodial Wallets)

Apesar da infraestrutura da blockchain (a rede) suportar a queda do Master com maestria, existe um limite técnico de *Arquitetura de Aplicação* que dita se os usuários finais continuarão conseguindo votar: **O modelo Custodial**.

Como o Votify atua como uma interface amigável que esconde do eleitor a complexidade de assinar criptograficamente transações, o próprio backend "guarda" (custodia) essas carteiras.
No momento em que o Master está operante e cadastra os eleitores, é o próprio nó do Master que executa o comando `getnewaddress`. Isso significa que a **Chave Privada** do eleitor gerado fica armazenada fisicamente no arquivo `wallet.dat` dentro do container `votify-master`.

> [!WARNING]
> **O Limite do Fallback:** Se o Master cair, a nossa API de Backend é inteligente o suficiente para rotear o comando de `cast-vote` para os Fiscais (Fallback Dinâmico). Porém, quando o Nó Fiscal tenta montar e **assinar** o voto daquele eleitor, a engine da MultiChain aborta o processo retornando o erro: `from-address is not found in this wallet`. 

O Nó Fiscal falha em assinar a transação porque **ele não possui a chave privada daquele eleitor na sua carteira local**. A chave está inacessível no Master offline.

### Descentralização vs Conveniência
Em uma rede blockchain descentralizada 100% "raiz" (como Ethereum), o eleitor usaria uma extensão no navegador (ex: MetaMask), assinaria a transação localmente e a enviaria já pronta (*Raw Transaction*) para a rede. Nesse cenário, **qualquer nó fiscal poderia simplesmente propagar a transação**.
No cenário corporativo/abstrato do Votify, a necessidade do nó central (Master) ser o mantenedor das chaves criptográficas cria uma dependência não da "Blockchain", mas da infraestrutura da Carteira Custodial dele.

---

## Conclusão

Na blockchain, a descentralização de permissões dilui o conceito de "Master". Ao dar `mine` para os Fiscais:
- Nós eliminamos o Gargalo de *Liveness* (produção contínua de blocos).
- O sistema usa Round-Robin nativamente para tolerar a ausência de um minerador.
- E as regras criptográficas contêm os estragos caso esse minerador vire malicioso.

O único grande limite arquitetônico observado no nosso cenário é a **Carteira Custodial**: enquanto leituras (auditoria, extração de comprovantes, validação) continuam funcionando com total resiliência entre os nós sobreviventes, a **escrita** (assinatura de novos votos para carteiras antigas) fica refém da disponibilidade do nó que gerou fisicamente a chave privada daquele eleitor.
