# Documentação de Decisão Arquitetural: Gerenciamento de Chaves Privadas e Resiliência em Rede Permissionada

## 1. O Problema

Durante as baterias de testes de Tolerância a Falhas Bizantinas (BFT) do protótipo Votify, identificou-se uma limitação arquitetural que impede a concretização de votos quando o nó principal (Master Node) encontra-se inoperante. Embora a camada de consenso da rede MultiChain permaneça perfeitamente saudável e operacional através dos nós secundários (Slave Nodes), as tentativas de inserção de novos votos resultam em falha de assinatura criptográfica.

A raiz do problema reside no modelo de custódia adotado: as chaves privadas geradas no momento do cadastro do eleitor são armazenadas localmente no arquivo `wallet.dat` do nó administrador original. Consequentemente, quando o tráfego é redirecionado para o nó fiscal (Slave) via mecanismo de *fallback*, este nó é incapaz de assinar a transação (retornando a exceção *from-address is not found in this wallet*), pois não possui acesso ao material criptográfico necessário para validar o direito ao voto.

## 2. Contexto

O Votify foi projetado para atuar em ambientes organizacionais privados, priorizando a abstração da complexidade criptográfica para o eleitor. Para alcançar esse objetivo de usabilidade, a arquitetura original implementou um modelo de **Carteira Custodial** (Custodial Wallet), no qual o *backend* da aplicação atua como guardião das credenciais digitais.

Essa premissa arquitetural difere das aplicações descentralizadas puras (dApps em redes públicas), onde o usuário detém a custódia direta de suas chaves. No escopo atual, a interdependência entre a instância do nó da MultiChain e a custódia local das chaves criou um ponto único de falha lógica (Single Point of Failure), ferindo a resiliência estrutural almejada pela rede distribuída. A resolução deste entrave exige a separação clara entre a custódia de segredos e a camada de validação e propagação de blocos.

## 3. Soluções Avaliadas

Diante do desafio, duas soluções preliminares foram levantadas e analisadas sob a ótica de engenharia de software e segurança da informação:

### Solução A: Sincronização / Replicação de Chaves Privadas (Descartada)
* **Conceito:** Copiar o arquivo `wallet.dat` ou transmitir as chaves privadas do Master Node para os Slave Nodes, garantindo que qualquer nó possua o material necessário para assinar transações.
* **Veredito Técnico:** Extremamente contraindicada. Esta abordagem configura um anti-padrão de segurança. A replicação de chaves privadas multiplica a superfície de ataque do sistema, quebra o princípio do não-repúdio (tornando impossível auditar inequivocamente qual máquina assinou a transação) e expõe dados sensíveis em trânsito.

### Solução B: Assinatura do Lado do Cliente / Não-Custodial (Inviável no curto prazo)
* **Conceito:** Gerar e manter as chaves privadas exclusivamente no navegador do eleitor. O *frontend* assina a transação localmente e envia o *payload* (Raw Transaction) já assinado para a API, que apenas faz o *broadcast* para qualquer nó da rede.
* **Veredito Técnico:** É o padrão ideal de segurança (Web3). Contudo, devido às limitações do escopo laboratorial do TCC, a refatoração exigiria a importação de bibliotecas criptográficas complexas para o *frontend* (Next.js) e a reestruturação de toda a lógica de submissão de transações do modelo UTXO da MultiChain, inviabilizando o cronograma do projeto.

## 4. A Solução Sugerida: Microserviço KMS Local (Mock Custodial)

Para conciliar a necessidade de abstração custodial (usabilidade), a manutenção da resiliência BFT da blockchain e a viabilidade de desenvolvimento, estabeleceu-se a implementação de um **Key Management Service (KMS)** isolado.

### 4.1. Descrição Arquitetural
A arquitetura é desacoplada através da criação de um microserviço em Node.js (Votify KMS), dedicado unicamente ao armazenamento seguro e à utilização das chaves privadas. Os nós da rede MultiChain (Master e Slaves) são destituídos da responsabilidade de guardar carteiras, passando a atuar estritamente como validadores de consenso e retransmissores de transações.

### 4.2. Fluxo de Execução Resolvido
1.  **Orquestração:** O *backend* principal recebe a intenção de voto do eleitor e formula uma transação bruta não assinada (*Raw Transaction*).
2.  **Assinatura Delegada:** O *backend* envia esta transação bruta ao microserviço KMS.
3.  **Custódia Isolada:** O KMS localiza a chave privada correspondente, assina a transação criptograficamente e retorna o dado em formato hexadecimal ao *backend*.
4.  **Injeção Distribuída:** O *backend* envia a transação já validamente assinada para **qualquer nó disponível** na malha da MultiChain (seja o Master ou o Slave).

### 4.3. Justificativa Acadêmica e Técnica
A implementação de um KMS isolado evidencia o domínio de conceitos avançados de Arquitetura Limpa (Clean Architecture). Ao aplicar a **Separação de Preocupações (Separation of Concerns)**, o sistema garante que a camada de registro distribuído permaneça completamente agnóstica em relação ao gerenciamento de segredos. Essa modelagem comprova que a queda do nó administrador afeta apenas a porta de entrada lógica daquela máquina, enquanto a rede como um todo mantém sua disponibilidade e integridade plenas, atestando o êxito do Votify como uma solução institucional descentralizada confiável.