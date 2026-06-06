# Arquitetura de Segurança, Gestão de Chaves e Resiliência BFT

Este documento consolida o conhecimento teórico e arquitetural sobre a tolerância a falhas do sistema **Votify**, detalhando o isolamento criptográfico das chaves privadas, o funcionamento do rodízio de consenso (Round-Robin) da MultiChain, e o fluxo dinâmico durante ataques aos nós da rede.

---

## 1. Contexto

O Votify foi arquitetado para atuar em ambientes organizacionais privados, priorizando a abstração da complexidade criptográfica para que o eleitor final não precisasse manipular carteiras virtuais (como o MetaMask). 
Para isso, implementou-se o conceito de **Carteira Custodial** (Custodial Wallet), onde o *backend* da aplicação era o responsável não apenas por enviar as transações, mas por guardar as credenciais (chaves) geradas para cada usuário fisicamente no arquivo `wallet.dat` da máquina principal, o Master Node (Nó 1).

**O Gargalo de Resiliência:** 
Descobriu-se que, apesar de a rede (blockchain em si) suportar perfeitamente a ausência do Master Node mantendo o consenso por meio dos Slaves, a inserção de votos passava a falhar. O Ponto Único de Falha (SPOF) ocorria porque os nós de contingência (Slaves) não possuíam acesso à chave privada hospedada no servidor morto, e portanto não conseguiam assinar o voto para validá-lo. 

---

## 2. Ataque ao Master Node

Para a blockchain MultiChain, **não existe um "Nó Master" intocável**. O título "Master" existe apenas para a primeira máquina que liga a rede e ganha permissões inaugurais (admin, mine, connect). A partir do momento em que os Nós Secundários recebem a permissão de mineração (`mine`), **todos se tornam equivalentes perante o consenso**.

### O que acontece em caso de Queda (Apagão)?
A permissão de criar blocos já está com os Slaves. O que acontece não é uma "transferência automática" de poder, mas sim uma auto-regulação: o algoritmo detecta a falta do nó 1 na vez dele, pula para o nó 2, e a rede continua produzindo blocos normalmente.

### O que acontece em caso de Comprometimento (Hacker invadindo o Master)?
Se o servidor for invadido, a matemática da MultiChain contém os estragos usando 3 barreiras intransponíveis:
1. **Limite Produtivo:** Como o consenso usa `mining-diversity`, o hacker é obrigado a respeitar a vez dos outros. Ele não consegue forçar 5 blocos seguidos goela abaixo da rede.
2. **Chaves Privadas:** O hacker não pode inventar votos de usuários legítimos, pois ele não possui as assinaturas criptográficas originadas com base nos PINs.
3. **Smart Filters Intocáveis:** Qualquer transação maliciosa enviada por ele é imediatamente rejeitada pelos outros nós da rede, caso desrespeite as regras de filtro em JavaScript, bloqueando fraudes sistêmicas.

---

## 3. Planos Considerados

Para resolver o problema do *fallback* não conseguir assinar as transações, foram estruturados alguns planos:

*   **Solução A: Replicaçao/Sincronização do `wallet.dat` (Descartada):** Sincronizar as chaves privadas fisicamente por todos os servidores. Uma prática terrível contra a Segurança da Informação, pois quebra o princípio do não-repúdio e inflaciona a superfície de ataque.
*   **Solução B: Assinatura no Lado do Cliente (Inviável no momento):** Entregar toda a carga de geração, criptografia e assinatura de transações brutas diretamente ao navegador (frontend). Considerado o padrão ouro Web3, porém demandava uma complexidade e mudança sistêmica inviáveis para o cronograma do projeto.
*   **Solução C: Microserviço KMS (Adotada):** Desacoplar inteiramente a custódia das chaves tanto do backend quanto da blockchain, alocando-a em uma infraestrutura *mock-custodial* e cega.

---

## 4. O Plano Selecionado: KMS + Orquestrador + HashiCorp

Para garantir que o nó caia sem afetar os dados do usuário, removemos do MultiChain a responsabilidade de guardar segredos. 

A solução consistiu no **Votify KMS (Key Management Service)** integrado ao **HashiCorp Vault**. 
Trata-se de um microserviço Node.js isolado com *Segurança Lógica Zero-Knowledge*. Nesse modelo, a blockchain (Slaves/Master) é meramente uma validadora. O KMS detém as ferramentas matemáticas, porém as chaves nunca repousam estáticas em texto legível. Como as chaves são cifradas imediatamente, nem mesmo um ataque direto aos bancos de dados do KMS ou do cofre revelaria o conteúdo das assinaturas dos usuários.

---

## 5. Fluxo de Cadastramento (CPF + PIN + Chave Privada)

Sob este novo modelo arquitetural (Zero-Knowledge), quando um usuário é inserido no sistema:

1.  **Geração do Dado Sujo:** O Backend (Orquestrador) contata o microserviço KMS pedindo uma chave. O KMS calcula as credenciais, mas **não as salva** nos nós. Junto a isso, ele gera um **PIN aleatório** numérico e exclusivo para aquele CPF.
2.  **Cifragem Cega:** A chave privada gerada é instantaneamente envelopada e encriptada localmente na RAM, usando o PIN do eleitor como senha simétrica (algoritmo AES-256-GCM). O que sobra é apenas um pacote inviolável (EncryptedPrivateKey).
3.  **Segurança em Cofre:** O pacote criptografado é enviado para armazenamento estático e guardado a 7 chaves num servidor de alta segurança do HashiCorp Vault.
4.  **Descarte (Wipe):** A memória RAM do servidor sofre expurgo seguro do texto puro da chave.
5.  **Notificação:** O sistema devolve ao eleitor o seu código de **PIN**, instruindo-o a guardá-lo. Agora, nem mesmo o administrador da infraestrutura é capaz de assinar em nome do usuário sem saber o PIN.

---

## 6. A Mecânica do Consenso: Round-Robin e a Permissão 'Mine'

No Bitcoin, qualquer nó tenta resolver um cálculo complexo para forjar blocos (Proof of Work), o que consome energia e gera lentidão. Na **MultiChain (uma rede permissionada)**, a forja de blocos não exige cálculos pesados, mas requer a permissão explícita `mine`. 

Quando um administrador concede a permissão `mine` para os nós Slave e Fiscal, eles ganham o poder de assinar e fechar blocos instantaneamente. Porém, para evitar que todos criem blocos ao mesmo tempo (o que causaria *forks* constantes na rede), o protocolo utiliza um rodízio dinâmico chamado **Round-Robin**.

### O Tempo de Geladeira (Cooldown)
O rodízio não é uma fila rígida, mas sim regulado por um "tempo de geladeira" matemático, definido pelo parâmetro `mining-diversity` (ex: 0.5 ou 50%).
A fórmula do castigo é: `nós mineradores vivos * mining-diversity`.
*   **Exemplo:** Se temos 3 nós (Master, Slave, Fiscal) e a diversidade é 0.5, o resultado é 1.5 (arredondado para **2**).
*   Isso significa que, após o **Nó Master** criar o Bloco 1, ele fica "na geladeira" e é proibido de criar os próximos 2 blocos. A rede então aceita blocos do Slave e do Fiscal. Só depois que os vizinhos participarem, o Master é liberado do castigo.

### A Tolerância a Falhas Dinâmica
A grande vantagem do Round-Robin é que ele reajusta esse castigo em tempo real. Se o Master sofrer um apagão, a rede aguarda o tempo de bloco (ex: 15 segundos). Ao notar a ausência, os nós sobreviventes recalculam a rede para "2 mineradores ativos". 
A fórmula passa a ser `2 * 0.5 = 1`. Agora, o castigo é de apenas 1 bloco. O Slave e o Fiscal passam a alternar o rodízio perfeitamente entre si, garantindo a **Alta Disponibilidade (HA)** e a fluidez da eleição sem intervenção humana.

---

## 7. Fluxo Teórico sob Queda do Master

O que acontece quando o ambiente colapsa por acidente ou ataque? O fluxo abaixo resume a teoria na prática, da ponta a ponta:

1.  **Morte do Nó Central:** O *Master Node* sofre uma queda brusca de energia. 
2.  **Consenso Round-Robin e Mine:** A rede de Fiscais e Slaves aguarda alguns instantes, o consenso percebe a ausência, reajusta matematicamente os direitos de `mine` dos envolvidos e continua a fabricação de blocos (15 em 15 segundos) pulando e re-roteando o tráfego do Master de maneira contínua.
3.  **A Identificação de Rotas:** Um eleitor chega e preenche seu **CPF e PIN** para votar. O backend entende que o comando nativo contra o Master falhou, ativando imediatamente o roteamento (Fallback Dinâmico) para o Nó Slave.
4.  **Criação de Transação Crua:** O Backend pede que o Slave crie um corpo de uma intenção de voto vazia (*Raw Transaction*). O Slave devolve a casca estrutural.
5.  **Mecanismo Zero-Knowledge KMS:** O Backend retransmite essa "casca" vazia e o PIN do eleitor ao KMS. O KMS puxa o cofre impenetrável lá do HashiCorp Vault, usa o PIN para "destravar" temporariamente a chave original dentro de sua memória volátil, preenche e injeta a assinatura na casca e deleta a chave de novo.
6.  **O Triunfo da Descentralização:** O Backend pega a Transação Válida Assinada Hexadecimal e joga na fila de processamento do nó Slave. O Slave submete as regras pelo Smart Filter e forja ele mesmo o bloco contendo aquele voto perfeitamente autenticado.

---

## 8. Decisão Criptográfica: AES-256-GCM vs HMAC-SHA256

Uma dúvida comum em bancas acadêmicas é o motivo de não utilizarmos algoritmos de Hashing (como o `HMAC-SHA256`) em vez do algoritmo `AES-256-GCM` na proteção das chaves privadas. A resposta técnica baseia-se na diferença fundamental entre Criptografia e Hashing:

*   **AES-256-GCM (Criptografia Simétrica de Mão Dupla):** É um processo **reversível**. O objetivo é "trancar" a chave privada em uma caixa forte e, mais tarde, utilizar o PIN do usuário para "destrancá-la" e recuperar o texto original exatamente como ele era. A recuperação exata é obrigatória porque a engine da MultiChain (`signrawtransaction`) necessita da chave em sua forma original legível para concretizar a assinatura do voto.
*   **HMAC-SHA256 (Hashing de Mão Única):** É um processo **irreversível**. Se aplicássemos um HMAC-SHA256 sobre a chave privada, nós a transformaríamos permanentemente em um hash de 64 caracteres. Quando o usuário retornasse com o PIN para votar, a matemática destrutiva do Hash impediria completamente a reconstrução da chave privada original. O sistema "esqueceria" a chave e o eleitor nunca mais conseguiria votar.

O `HMAC-SHA256`, porém, continua sendo valioso e indicado para outras etapas do projeto, como a **anonimização de CPFs** antes do armazenamento em banco de dados, onde a irreversibilidade se torna uma vantagem (não precisamos saber quem é a pessoa, apenas validar se a impressão digital do documento bate na hora do voto).
