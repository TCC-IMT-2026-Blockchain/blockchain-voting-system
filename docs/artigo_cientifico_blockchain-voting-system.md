CENTRO UNIVERSITÁRIO DO INSTITUTO MAUÁ DE TECNOLOGIA[cite: 3]
Engenharia da Computação[cite: 3]

# DESENVOLVIMENTO DE UM SISTEMA DE VOTAÇÃO ELETRÔNICA BASEADO EM BLOCKCHAIN[cite: 3]

**Enrico Mota Santarelli**[cite: 3]
**Leonardo Galdi Fiorese**[cite: 3]
**Rodrigo Reis Monasterios Morales**[cite: 3]
**Sérgio Guidi Trovo**[cite: 3]

**Orientadores:** Prof. Dr. Diego Hernandez Arjoni / Prof. Ahmad Kheder Mahfoud[cite: 3]

---

## Resumo[cite: 3]
O presente estudo tem como objetivo desenvolver um sistema de votação eletrônica seguro baseado em blockchain para mitigar as vulnerabilidades de arquiteturas centralizadas, garantindo integridade, auditabilidade e o sigilo do eleitor. A pesquisa apresenta abordagem aplicada com o desenvolvimento do Votify, um protótipo estruturado sobre uma rede permissionada (MultiChain). A metodologia baseia-se na separação entre identidade e voto, utilizando funções hash (HMAC-SHA256) para atestar a elegibilidade e a queima de ativos digitais de uso único para o registro das cédulas. Essa abordagem dispensa o uso de protocolos computacionalmente exaustivos, como proof-of-work e ring signatures. Os resultados demonstraram que o sistema superou modelos centralizados convencionais ao impedir o duplo voto diretamente na camada de consenso da rede, além de apresentar desempenho superior em latência e escalabilidade quando comparado a soluções baseadas em blockchains públicas. Por fim, a implementação de comprovantes de transação (TXID) possibilitou a verificabilidade individual e a auditoria global independente sem violação de privacidade. Conclui-se que o uso de redes permissionadas é viável, seguro e altamente eficiente para modernizar pleitos em ambientes organizacionais.[cite: 3]

**Palavras-chave:** Votação Eletrônica. Blockchain Permissionada. MultiChain. Segurança da Informação. Privacidade Criptográfica.[cite: 3]

## Abstract[cite: 3]
The present study aims to develop a secure blockchain-based electronic voting system to mitigate the vulnerabilities of centralized architectures, ensuring integrity, auditability, and voter secrecy. The research presents an applied approach through the development of Votify, a prototype structured on a permissioned network (MultiChain). The methodology relies on separating identity from the vote, utilizing hash functions (HMAC-SHA256) to certify eligibility and burning single-use digital assets to record ballots. This approach bypasses computationally exhaustive protocols, such as Proof-of-Work and Ring Signatures. The results demonstrated that the system outperformed conventional centralized models by preventing double voting directly at the network's consensus layer, while also exhibiting superior performance in latency and scalability compared to public blockchain-based solutions. Finally, the implementation of transaction receipts (TXID) enabled individual verifiability and independent global auditing without compromising privacy. It is concluded that the use of permissioned networks is a viable, secure, and highly efficient solution for modernizing electoral processes in organizational environments.[cite: 3]

**Keywords:** Electronic Voting. Permissioned Blockchain. MultiChain. Information Security. Cryptographic Privacy.[cite: 3]

---

## Introdução[cite: 3]

### Objetivos[cite: 3]

#### Objetivo Geral[cite: 3]
Desenvolver um sistema de votação eletrônica seguro baseado em blockchain, capaz de garantir integridade, auditabilidade e proteção da privacidade dos eleitores, utilizando uma rede blockchain permissionada como mecanismo de validação e registro das operações críticas do processo de votação.[cite: 3]

#### Objetivos Específicos[cite: 3]
Os objetivos específicos deste trabalho consistem em desenvolver uma arquitetura de votação eletrônica integrada a uma rede blockchain permissionada utilizando a tecnologia MultiChain, visando garantir maior segurança e integridade no processo eleitoral digital. Além disso, busca-se implementar mecanismos de proteção da identidade do eleitor, evitando a exposição de dados pessoais sensíveis na blockchain por meio de identificadores protegidos criptograficamente. O trabalho também pretende desenvolver um sistema de credenciais de voto baseado em tokens de uso único, de forma a impedir a duplicidade de votação e fortalecer a confiabilidade do processo.[cite: 3]

Adicionalmente, pretende-se implementar mecanismos nativos de validação na blockchain capazes de assegurar a integridade das transações realizadas, bem como promover a separação lógica entre a identidade do eleitor e o registro do voto, preservando a privacidade dos participantes. Busca-se ainda possibilitar a auditoria independente dos resultados por meio de nós distribuídos da rede, permitindo a verificação da consistência dos registros sem dependência exclusiva da aplicação principal.[cite: 3]

Por fim, busca-se desenvolver uma aplicação web integrada à camada blockchain para gerenciamento do fluxo de votação, além de implementar um mecanismo de comprovante criptográfico de inclusão do voto e avaliar o funcionamento do protótipo por meio de testes relacionados ao cadastro de eleitores, emissão de credenciais, validação de votos, prevenção de duplicidade e auditoria dos resultados.[cite: 3]

### Justificativa[cite: 3]
A crescente digitalização de processos organizacionais e institucionais tem ampliado a necessidade de mecanismos confiáveis para realização de votações eletrônicas, especialmente em contextos como instituições de ensino, organizações privadas, conselhos, associações e condomínios. Embora sistemas digitais de votação tragam benefícios relacionados à praticidade, agilidade na apuração e acessibilidade, ainda existem desafios significativos relacionados à segurança, transparência, auditabilidade e proteção da privacidade dos eleitores. Em muitos sistemas centralizados, a confiança no processo depende exclusivamente de um único servidor ou administrador, o que pode gerar questionamentos quanto à integridade dos registros, possibilidade de manipulação de dados e limitação na auditoria independente dos resultados.[cite: 3]

Nesse contexto, a tecnologia blockchain surge como uma alternativa promissora para mitigar parte dessas limitações, devido às suas características de descentralização, imutabilidade dos registros e verificabilidade das transações. Entretanto, apesar do crescente interesse acadêmico e tecnológico no uso de blockchain em processos eleitorais, ainda existem lacunas relacionadas à aplicação prática dessa tecnologia em sistemas de votação eletrônica voltados a ambientes permissionados, com foco simultâneo em privacidade, prevenção de voto duplicado e auditabilidade acessível. Além disso, muitos estudos concentram-se em propostas conceituais ou modelos complexos, sem demonstrar implementações funcionais integradas a aplicações reais.[cite: 3]

Dessa forma, o presente trabalho justifica-se pela necessidade de investigar e desenvolver uma solução prática que demonstre a viabilidade do uso de blockchain como camada de integridade em sistemas de votação eletrônica. O desenvolvimento do Votify busca contribuir para a área ao propor uma arquitetura baseada em rede blockchain permissionada, capaz de separar identidade e voto, impedir duplicidade por meio de credenciais de uso único e permitir auditoria independente dos registros. Ademais, o estudo contribui academicamente ao apresentar um protótipo funcional que integra conceitos de criptografia, privacidade, segurança da informação e sistemas distribuídos, servindo como base para futuras pesquisas e evoluções na área de votação digital segura.[cite: 3]

### Definição do escopo, contextualização e oportunidades[cite: 3]
A transformação digital ampliou a adoção de sistemas de votação eletrônica em diferentes contextos, como instituições de ensino, organizações privadas e processos administrativos, devido à necessidade de maior agilidade e praticidade na tomada de decisões coletivas. Entretanto, desafios relacionados à segurança, integridade dos registros, auditabilidade e proteção da privacidade ainda persistem, especialmente em arquiteturas centralizadas, nas quais a confiança depende predominantemente de uma única entidade responsável pelo sistema.[cite: 3]

Nesse cenário, a tecnologia blockchain surge como uma alternativa promissora por oferecer mecanismos de rastreabilidade, integridade e resistência à alteração de registros. Apesar do crescente interesse acadêmico sobre blockchain aplicada à votação eletrônica, muitos estudos concentram-se em propostas conceituais ou cenários de alta complexidade, frequentemente voltados a eleições públicas de larga escala e com difícil implementação prática.[cite: 3]

Diante disso, o escopo deste trabalho consiste no desenvolvimento do Votify, um sistema de votação eletrônica para ambientes permissionados utilizando a tecnologia MultiChain como infraestrutura blockchain privada. A proposta não visa substituir sistemas eleitorais públicos, mas demonstrar a viabilidade técnica de uma arquitetura capaz de registrar votos de forma íntegra, auditável e resistente a alterações posteriores, preservando a privacidade dos eleitores por meio da separação entre identidade e voto.[cite: 3]

A solução utiliza uma rede blockchain permissionada composta por nós autorizados, empregando credenciais digitais de uso único para prevenção de votos duplicados e validações nativas da blockchain para reforçar a integridade das transações. Dessa forma, busca-se reduzir a dependência exclusiva do backend da aplicação como fonte de confiança do processo eleitoral.[cite: 3]

Como oportunidade de contribuição, o trabalho permite investigar aplicações práticas da blockchain em sistemas de votação digital, contribuindo para áreas como segurança da informação, privacidade computacional e auditoria digital. Além disso, o protótipo desenvolvido pode servir de base para futuras evoluções e aplicações institucionais que demandem maior transparência e verificabilidade em processos de votação.[cite: 3]

## Métodos e Tecnologias[cite: 3]
O presente trabalho caracteriza-se como uma pesquisa de natureza aplicada, com abordagem experimental e exploratória, uma vez que investiga o uso da tecnologia blockchain como mecanismo de integridade em sistemas de votação eletrônica, propondo o desenvolvimento de um protótipo funcional para validação prática dos conceitos estudados. A pesquisa também apresenta caráter descritivo, ao analisar tecnologias, arquiteturas e mecanismos de segurança relacionados à privacidade, auditabilidade e prevenção de fraudes em processos de votação digital.[cite: 3]

A metodologia adotada fundamenta-se inicialmente em uma revisão bibliográfica sobre votação eletrônica, blockchain, criptografia, redes permissionadas e segurança da informação, permitindo compreender limitações de sistemas centralizados e identificar oportunidades de aplicação de arquiteturas distribuídas. Em seguida, realiza-se o desenvolvimento de um protótipo funcional para validação dos mecanismos de integridade e verificabilidade propostos.[cite: 3]

A arquitetura do sistema é organizada em três camadas principais: frontend, responsável pela interface com o usuário; backend, encarregado das regras de negócio e integração dos serviços; e infraestrutura blockchain, utilizada como camada de integridade dos registros eleitorais. O sistema utiliza a tecnologia MultiChain como blockchain permissionada, escolhida por oferecer controle de permissões, armazenamento estruturado de dados e suporte à validação de transações em ambiente privado. A infraestrutura é executada em contêineres Docker, sendo composta por um nó administrador (Master Node) e um nó fiscal (Slave Node), responsáveis pela replicação e validação dos registros.[cite: 3]

A camada de aplicação é desenvolvida com Node.js, TypeScript e Express, utilizando a especificação OpenAPI para documentação e padronização da API. A comunicação com a blockchain é realizada por scripts em Python, responsáveis pela execução das operações na rede MultiChain. O frontend é desenvolvido com Next.js, Tailwind CSS e React Query, oferecendo funcionalidades relacionadas à autenticação, gerenciamento de eleições, fluxo de votação e auditoria.[cite: 3]

A validação do protótipo é realizada por meio de testes envolvendo cadastro de eleitores, emissão de credenciais, registro de votos, prevenção de duplicidade, auditoria dos resultados e verificação da separação entre identidade do eleitor e conteúdo do voto. Para reforçar a segurança do sistema, são empregados mecanismos como HMAC-SHA256 para proteção de identificadores e tokens de uso único para controle do direito ao voto.[cite: 3]

## Revisão Bibliográfica[cite: 3]

### O Paradigma da Votação Eletrônica e Seus Desafios[cite: 3]
Sistemas de votação eletrônica modernizam o pleito, mas sua arquitetura centralizada (cliente-servidor) cria um ponto único de falha (single point of failure). Essa concentração de dados dificulta a auditoria independente e expõe o sistema a ataques cibernéticos, fraudes internas e manipulação de registros, gerando desconfiança pública sobre o sigilo e a precisão dos resultados.[cite: 3]

### A Tecnologia Blockchain como Camada de Integridade[cite: 3]
Originalmente concebida por Nakamoto (2008) como a infraestrutura do Bitcoin para resolver o problema do gasto duplo (double-spending) sem a necessidade de terceiros confiáveis, a blockchain é essencialmente um livro-razão distribuído, imutável e descentralizado.[cite: 3]

Em contextos eleitorais, a blockchain oferece características inerentes que resolvem as principais lacunas dos sistemas tradicionais:[cite: 3]
* **Descentralização:** A rede é mantida por múltiplos nós, eliminando a dependência de um servidor central.[cite: 3]
* **Imutabilidade e Integridade:** O uso de funções de dispersão criptográfica (hash) para encadear blocos matematicamente garante que, uma vez inserido, um voto não pode ser alterado ou deletado sem corromper toda a rede.[cite: 3]
* **Transparência e Auditabilidade:** O registro distribuído permite que qualquer participante ou auditor valide as transações em tempo real, garantindo que os votos foram registrados e contabilizados corretamente.[cite: 3]

### Trabalhos Relacionados e Soluções Anteriores[cite: 3]
A literatura propõe diversas integrações de blockchain em eleições. Destaca-se o projeto BlockVotes (Wu, 2017), que utiliza a rede Bitcoin com criptografia avançada. O modelo adota uma arquitetura clássica dividida em Autoridade de Registro (RA) e Autoridade Eleitoral (EA), introduzindo inovações técnicas como:[cite: 3]
* **Armazenamento via OP_RETURN:** Transforma o voto em uma transação na rede Bitcoin, "queimando" uma fração de moeda para anexar um payload com a cédula ou hash do voto.[cite: 3]
* **Anonimato via ring signatures:** O eleitor assina o voto juntamente com chaves públicas de outros eleitores, provando sua legitimidade sem revelar de qual membro do grupo partiu a transação.[cite: 3]

### Limitações das Abordagens Atuais e Identificação de Lacunas[cite: 3]
Apesar de viáveis conceitualmente, soluções baseadas em redes públicas (como Bitcoin e Ethereum) possuem limitações que inviabilizam a adoção em larga escala:[cite: 3]
* **Inviabilidade Econômica:** Taxas de mineração e a queima de fundos financeiros (via OP_RETURN) tornam o processo altamente oneroso e pouco escalável.[cite: 3]
* **Complexidade Computacional:** Protocolos de privacidade baseados em ring signatures ou Provas de Conhecimento Zero exigem processamento intensivo, prejudicando o tempo de resposta.[cite: 3]
* **Falta de Governança Institucional:** Redes baseadas em proof-of-work (PoW) sofrem com altíssimo consumo energético, latência de confirmação e sujeitam o pleito a congestionamentos da rede pública.[cite: 3]

### A Proposta do Projeto: Superando as Lacunas[cite: 3]
O Votify supera essas limitações ao substituir redes públicas financeiras por uma rede privada e permissionada, fundamentada na tecnologia MultiChain. Essa escolha equilibra imutabilidade e performance através das seguintes contribuições:[cite: 3]
* **Eliminação de Custos:** Redes permissionadas não exigem taxas por transação, garantindo sustentabilidade econômica.[cite: 3]
* **Privacidade Simétrica (Filtros PII):** Evita-se a alta carga computacional com uma separação arquitetural rigorosa. O hash da identidade apenas comprova a elegibilidade; o voto em si é realizado via um ativo digital nativo (token), que atua como cédula digital anônima e consumível.[cite: 3]
* **Validação Nativa contra Duplicidade:** Filtros de consenso (Transaction Filters) exigem o consumo exato de um token por eleitor, impedindo gastos duplos (double-voting) na própria camada da blockchain, sem depender apenas do banco de dados da aplicação.[cite: 3]

## Desenvolvimento[cite: 3]

### Contextualização dos Sistemas de Votação Eletrônica[cite: 3]

#### Funcionamento Geral de Sistemas de Votação Eletrônica[cite: 3]
Os sistemas de votação eletrônica surgiram como alternativa aos processos baseados em cédulas físicas, buscando aumentar a eficiência, reduzir erros humanos e acelerar a apuração dos resultados. Atualmente, são utilizados em universidades, organizações privadas e assembleias institucionais.[cite: 3]

De forma geral, esses sistemas realizam cadastro e autenticação de eleitores, registro dos votos e totalização dos resultados. O fluxo normalmente envolve identificação do eleitor, validação de elegibilidade, liberação para votação, registro do voto e apuração.[cite: 3]

A arquitetura tradicional é composta por frontend, backend e banco de dados centralizado. Embora esse modelo ofereça simplicidade operacional e rapidez, ele depende fortemente da confiabilidade da infraestrutura central.[cite: 3]

Apesar dos benefícios operacionais, ainda existem desafios relacionados à segurança, privacidade, transparência e auditabilidade, o que motiva a busca por arquiteturas mais verificáveis e resistentes a falhas.[cite: 3]

#### Vulnerabilidades e Limitações de Sistemas Centralizados[cite: 3]
Sistemas de votação eletrônica centralizados apresentam limitações importantes relacionadas à segurança e à confiabilidade do processo eleitoral.[cite: 3]

**Figura 1 - Exemplo de arquitetura de um sistema de votação eletrônica centralizado.**[cite: 3]

> *(Diagrama da arquitetura centralizada na Fonte)*[cite: 3]

Fonte: Adaptado de Springer Nature (2026).[cite: 3]

Conforme ilustrado na Figura 1, esse modelo concentra o gerenciamento da eleição em um servidor central, responsável pelo armazenamento dos registros, autenticação dos eleitores e contabilização dos votos.[cite: 3]

Nesse modelo, todas as operações críticas dependem de um servidor central, caracterizando um cenário de ponto único de falha (single point of failure). Assim, falhas técnicas, acessos indevidos ou comprometimentos da infraestrutura podem afetar diretamente a disponibilidade e a integridade do sistema. Segundo Bruce Schneier (2004), sistemas críticos devem considerar o comprometimento potencial de qualquer componente centralizado.[cite: 3]

Outro problema refere-se à integridade dos registros. Como os votos são armazenados em bancos de dados controlados pela própria aplicação, auditores e eleitores precisam confiar que os dados foram registrados corretamente, sem possuir mecanismos independentes de validação.[cite: 3]

A auditabilidade também pode ser limitada, já que a verificação normalmente depende do acesso aos mesmos servidores administrados pela entidade responsável pela eleição. Conforme Josh Benaloh (2015), sistemas eleitorais seguros devem possibilitar verificabilidade ponta a ponta sem comprometer o sigilo do voto.[cite: 3]

Além disso, existem riscos relacionados à privacidade e à duplicidade de votação, especialmente quando dados de autenticação e validação são armazenados de forma inadequada.[cite: 3]

Dessa forma, as limitações dos sistemas centralizados motivam a adoção de arquiteturas alternativas, como soluções baseadas em blockchain.[cite: 3]

### Blockchain como Camada de Integridade[cite: 3]

#### O que é Blockchain[cite: 3]
A blockchain é uma tecnologia de registro distribuído responsável por armazenar informações de maneira encadeada, imutável e compartilhada entre participantes de uma rede (NAKAMOTO, 2008).[cite: 3]

Diferentemente dos bancos de dados tradicionais, a blockchain mantém cópias sincronizadas dos registros em múltiplos nós. Cada bloco contém transações, um identificador criptográfico (hash), timestamp e referência ao bloco anterior, formando uma cadeia cronológica.[cite: 3]

A validação coletiva das transações dificulta alterações indevidas e favorece propriedades como integridade, rastreabilidade e auditabilidade.[cite: 3]

Embora tenha surgido com o Bitcoin, a tecnologia passou a ser aplicada em áreas como logística, saúde, contratos inteligentes e votação eletrônica.[cite: 3]

Neste trabalho, a blockchain atua como camada complementar de integridade e auditabilidade, registrando operações críticas relacionadas ao processo eleitoral.[cite: 3]

#### Integridade e Imutabilidade[cite: 3]
A blockchain garante integridade e imutabilidade por meio de funções criptográficas de hash. Cada bloco possui um identificador gerado a partir de seus dados e do hash do bloco anterior, formando um encadeamento criptográfico.[cite: 3]

Caso um registro seja alterado, seu hash também é modificado, comprometendo toda a sequência subsequente e tornando a adulteração facilmente detectável (NAKAMOTO, 2008).[cite: 3]

Além disso, a replicação dos dados entre múltiplos nós dificulta alterações unilaterais. Em redes permissionadas, apenas participantes autorizados validam as transações, mantendo controle operacional sem comprometer a verificabilidade.[cite: 3]

No contexto eleitoral, essas propriedades reduzem riscos de adulteração de votos e fortalecem a auditabilidade do processo.[cite: 3]

#### Redes Públicas vs Permissionadas[cite: 3]
As redes blockchain podem ser classificadas em públicas e permissionadas.[cite: 3]

As blockchains públicas permitem que qualquer participante visualize e valide transações, como ocorre no Bitcoin e no Ethereum. Apesar da elevada descentralização, apresentam limitações relacionadas à privacidade, escalabilidade e governança (ANTONOPOULOS, 2017).[cite: 3]

Já as redes permissionadas operam com acesso controlado, permitindo que apenas participantes autorizados realizem determinadas operações. Esse modelo oferece maior desempenho, controle administrativo e adequação a ambientes institucionais (DRESCHER, 2017).[cite: 3]

Neste trabalho, foi adotada uma blockchain permissionada baseada em MultiChain, devido ao controle granular de permissões e maior compatibilidade com sistemas institucionais de votação.[cite: 3]

### Arquitetura Proposta do Votify[cite: 3]
O Votify foi desenvolvido como um sistema de votação eletrônica baseado em blockchain permissionada, buscando reduzir a dependência exclusiva de componentes centralizados.[cite: 3]

A arquitetura é dividida em três camadas principais: frontend, backend e infraestrutura blockchain, conforme ilustrado na Figura 3. O frontend é responsável pela interação com usuários e administradores. O backend executa regras de negócio, autenticação e comunicação com a blockchain. Já a infraestrutura blockchain atua como camada de integridade e auditabilidade.[cite: 3]

**Figura 2 - Visão Geral da Arquitetura Proposta**[cite: 3]

> *(Diagrama contendo Eleitor, Aplicação com Front-end/Back-end, Nó Administrador, Blockchain, Nós Fiscais e Auditoria)*[cite: 3]

Fonte: Elaboração Própria (2026)[cite: 3]

A solução utiliza a tecnologia MultiChain em uma rede permissionada composta por nós autorizados, permitindo maior controle sobre participantes e registros.[cite: 3]

A arquitetura também implementa separação lógica entre identidade e voto, evitando o armazenamento direto de dados pessoais na blockchain. Além disso, utiliza credenciais digitais de uso único para impedir votos duplicados.[cite: 3]

Outro diferencial é a possibilidade de auditoria independente, já que os registros críticos são replicados entre múltiplos nós autorizados.[cite: 3]

Assim, o Votify busca equilibrar segurança, privacidade, verificabilidade e simplicidade operacional.[cite: 3]

### Modelagem da Blockchain do Sistema[cite: 3]

#### Streams da Blockchain[cite: 3]
A modelagem da blockchain foi desenvolvida utilizando streams da plataforma MultiChain, mecanismo responsável pelo armazenamento estruturado de informações na rede permissionada (GREENSPAN, 2015).[cite: 3]

Os streams foram organizados em três grupos principais: identificação de eleitores, credenciais de votação e registro dos votos. Essa separação favorece organização, rastreabilidade e privacidade.[cite: 3]

O stream de identificação armazena identificadores criptografados dos eleitores; o stream de credenciais registra a emissão e utilização do direito ao voto; e o stream eleitoral armazena os votos registrados.[cite: 3]

#### Asset de Votação[cite: 3]
O Votify utiliza assets da MultiChain como representação digital do direito ao voto. Cada eleitor recebe uma unidade de um ativo associado à eleição, funcionando como uma credencial digital de uso único.[cite: 3]

Após a autenticação, o asset é emitido ao eleitor. Durante a votação, ele é utilizado para validar o direito de participação e posteriormente consumido ou marcado como utilizado.[cite: 3]

Esse mecanismo reduz a dependência exclusiva do backend para controle de duplicidade, fortalecendo a integridade do processo eleitoral.[cite: 3]

#### Proteção da Identidade[cite: 3]
Para preservar a privacidade dos eleitores, o sistema utiliza HMAC-SHA256 para gerar identificadores protegidos.[cite: 3]

Em vez de armazenar informações pessoais diretamente na blockchain, o sistema registra apenas identificadores criptográficos gerados a partir dos dados do eleitor e de uma chave secreta.[cite: 3]

Essa abordagem reduz riscos de associação entre identidade e voto, preservando o sigilo eleitoral.[cite: 3]

### Fluxo Completo da Votação[cite: 3]

#### Preparação do Processo Eleitoral e Elegibilidade do Eleitor[cite: 3]
O fluxo inicia-se com a configuração da eleição, incluindo definição de candidatos, período eleitoral e eleitores autorizados.[cite: 3]

Durante o cadastro, os dados do eleitor são utilizados apenas para validação de elegibilidade, sem armazenamento direto de informações pessoais na blockchain. Para isso, o sistema gera identificadores protegidos utilizando HMAC-SHA256.[cite: 3]

Após autenticação, o sistema verifica se o eleitor possui direito válido de participação. Caso esteja apto, recebe uma credencial digital de votação.[cite: 3]

Essa separação entre identificação, autenticação e autorização fortalece a segurança e a privacidade do sistema.[cite: 3]

#### Emissão da Credencial e Registro do Voto[cite: 3]
Após a validação do eleitor, o sistema emite uma credencial digital representada por um asset da blockchain MultiChain.[cite: 3]

No momento da votação, o backend verifica a validade da credencial e registra o voto no stream correspondente da blockchain.[cite: 3]

Após o registro, o asset é consumido ou marcado como utilizado, impedindo reutilização e prevenindo votos duplicados.[cite: 3]

Além disso, filtros nativos da MultiChain validam regras de integridade antes da confirmação das transações.[cite: 3]

Dessa forma, o fluxo de votação busca garantir segurança, privacidade, verificabilidade e auditabilidade do processo eleitoral.[cite: 3]

## Resultados[cite: 3]
Para avaliar a eficácia da arquitetura proposta, os resultados obtidos pelo Votify foram submetidos a uma análise comparativa abordando dois cenários distintos. Primeiramente, o sistema foi contrastado com o modelo tradicional centralizado, representado no escopo deste trabalho pelo protótipo secundário denominado "Votifalho". Em seguida, realizou-se uma avaliação comparativa com a solução BlockVotes (WU, 2017), cujo modelo baseia-se em redes blockchain públicas. A análise pautou-se em critérios de integridade, prevenção contra o duplo voto, proteção da privacidade e viabilidade computacional.[cite: 3]

### Avaliação de Integridade e Prevenção de Fraudes[cite: 3]
A primeira etapa da validação consistiu em submeter o Votify e o Votifalho a tentativas simuladas de manipulação de dados e duplo voto. No sistema centralizado (Votifalho), cujos registros eleitorais dependem exclusivamente de um banco de dados relacional e das regras de negócio da camada de aplicação, evidenciou-se a vulnerabilidade do modelo. Foi possível demonstrar a viabilidade da inserção de múltiplos votos por um mesmo usuário, bem como a suscetibilidade à alteração de votos já registrados, simulando um comprometimento direto do banco de dados (single point of failure).[cite: 3]

As Figura 3 e 4 ilustram essa fragilidade, demonstrando o comportamento do sistema centralizado diante de uma tentativa de fraude ou inconsistência nos registros.[cite: 3]

**Figura 3 - Demonstração de voto depositado no Candidato A**[cite: 3]

> *(Print do Votifalho registrando voto no Candidato A)*[cite: 3]

Fonte: Elaboração Própria (2026)[cite: 3]

**Figura 4 - Ataque simulado de alteração de voto do Candidato A para o Candidato B**[cite: 3]

> *(Print do Votifalho com ataque simulado de alteração de registro)*[cite: 3]

Fonte: Elaboração Própria (2026)[cite: 3]

Em contrapartida, no Votify, a integridade do pleito foi assegurada pelos mecanismos nativos da rede MultiChain. A emissão de uma credencial digital única para cada eleitor (representada pelo asset VOTE_ELEICAO_001) garantiu que o direito ao voto fosse exercido estritamente uma única vez. Durante a experimentação, qualquer tentativa de repetição de voto utilizando a mesma credencial foi sumariamente rejeitada na camada de consenso da rede através dos filtros de transação (transaction filters), independentemente da validação prévia pelo backend.[cite: 3]

As Figuras 5 e 6 demonstram a eficácia da blockchain no bloqueio de transações maliciosas, ilustrando a rejeição de uma tentativa de duplo voto pelo consumo prévio do token.[cite: 3]

**Figura 5 - Demonstração de voto depositado no Candidato A**[cite: 3]

> *(Print da urna Votify contabilizando voto legítimo na blockchain)*[cite: 3]

Fonte: Elaboração Própria (2026)[cite: 3]

**Figura 6 - Ataque simulado de alteração de voto do Candidato A para o Candidato B**[cite: 3]

> *(Print do Votify bloqueando operação irregular com STDOUT Error Code)*[cite: 3]

Fonte: Elaboração Própria (2026)[cite: 3]

A rejeição da tentativa de fraude ocorre em um nível da arquitetura que pode ser auditada diretamente no log do nó da MultiChain. Ao forçar uma segunda transação pela mesma carteira que já exerceu o seu direito, a blockchain aborta a operação emitindo o erro de "Fundos Insuficientes" (Insufficient funds).[cite: 3]

Esse retorno comprova que o modelo de integridade do Votify independe das regras da aplicação (backend/frontend). Uma vez que o asset digital representativo do voto (VOTE_ELEICAO_001) foi transferido para o endereço de descarte (burn address) no primeiro voto, o balanço criptográfico se torna zero. Sem a posse prévia da credencial, é tecnologicamente impossível que um invasor ou eleitor injete um voto fraudulento nos streams da urna.[cite: 3]

Além do bloqueio de transações maliciosas, a avaliação de integridade testou a estabilidade da infraestrutura contra interrupções e ataques diretos aos servidores. No Votifalho, a queda do banco de dados central resulta em paralisia total do sistema (single point of failure), e o acesso indevido ao servidor permite a alteração arbitrária dos resultados. Em contraste, o Votify demonstrou Tolerância a Falhas Bizantinas (BFT) robusta. Ao forçar a desconexão abrupta de um nó fiscal ("Nó offline"), a rede MultiChain manteve-se totalmente operacional, dando continuidade à eleição com os nós remanescentes.[cite: 3]

As figuras 7 e 8 demonstram os comportamentos das arquiteturas referente ao ataque.[cite: 3]

**Figura 7 - Ataque simulado de exclusão do banco de dados central**[cite: 3]

> *(Print evidenciando comando derrubar-banco no Votifalho)*[cite: 3]

Fonte: Elaboração Própria (2026)[cite: 3]

**Figura 8 - Demonstração de resiliência e tolerância a queda de nó no Votify. A rede mantém a disponibilidade e a integridade da contagem por consenso majoritário**[cite: 3]

> *(Print demonstrando o Nó 3 Offline e a contagem inalterada)*[cite: 3]

Fonte: Elaboração Própria (2026)[cite: 3]

Da mesma forma, quando se simulou o comprometimento de um nó por um invasor (estado de "Nó comprometido"), na tentativa de injetar dados fraudulentos na apuração, o Votifalho resultou na inserção de 10 votos no banco de dados central. Já no Votify, a divergência foi instantaneamente detectada e rejeitada pelo consenso majoritário da rede.[cite: 3]

As figuras 9 e 10 demonstram os comportamentos das arquiteturas referente ao ataque.[cite: 3]

**Figura 9 - Simulação de ataque de inserção de votos**[cite: 3]

> *(Print de injeção de votos simulada no Votifalho)*[cite: 3]

Fonte: Elaboração Própria (2026)[cite: 3]

**Figura 10 - Mitigação de ataque de injeção de dados. A adulteração em um nó específico ("Nó 3") não afeta o resultado global no Votify**[cite: 3]

> *(Print do Votify sinalizando o Nó 3 Comprometido sem afetar a maioria)*[cite: 3]

Fonte: Elaboração Própria (2026)[cite: 3]

No cenário centralizado (Votifalho), a exclusão ou comprometimento do banco de dados configura uma falha catastrófica e praticamente irreparável, anulando o pleito por completo devido à ausência de mecanismos nativos de recuperação de estado. Em contrapartida, a arquitetura do Votify demonstrou resiliência estrutural. Quando a conexão do servidor inoperante foi restabelecida ("Nó restaurado"), o nó reconectou-se automaticamente à malha, sincronizou seu estado local baixando os blocos autênticos validados pelo consenso da rede e retornou à operação normal sem qualquer perda ou corrupção de dados.[cite: 3]

### Comparativo com Soluções Baseadas em Redes Públicas (BlockVotes)[cite: 3]
Ao contrastar os resultados do protótipo com os obtidos pelo BlockVotes, observam-se vantagens expressivas em relação à eficiência e viabilidade de implantação em ambientes organizacionais privados. O BlockVotes, por utilizar a rede pública do Bitcoin, atrela o registro do voto à queima financeira de frações de moeda (via operação OP_RETURN) e assegura o anonimato por meio de processamento matemático exaustivo derivado de ring signatures (WU, 2017).[cite: 3]

Os testes demonstraram que a abordagem permissionada do Votify obteve desempenho amplamente superior. A isenção de taxas transacionais e a ausência do mecanismo de proof-of-work (PoW) garantiram uma confirmação de votos praticamente imediata, mitigando o problema da latência de rede ou de processamento dos blocos (na rede Bitcoin, o tempo médio de processamento ou mineração de um bloco são 10 minutos). Além disso, ao substituir protocolos pesados de anonimato por uma arquitetura que isola criptograficamente o hash da identidade do conteúdo do voto, a sobrecarga computacional foi drasticamente reduzida. Como resultado, o Votify apresentou-se como uma solução consideravelmente mais rápida e escalável do que os modelos baseados em redes públicas.[cite: 3]

### Verificabilidade Individual via Comprovante[cite: 3]
Outro resultado expressivo no aspecto da transparência foi a implementação da verificabilidade individual. Em sistemas convencionais, o eleitor raramente possui meios técnicos para provar que o seu voto foi efetivamente contabilizado na apuração final. No Votify, o ato de votar gera um comprovante digital contendo o identificador único da transação (TXID) na blockchain e o seu respectivo hash de recibo.[cite: 3]

Esse mecanismo permite que o eleitor consulte, a qualquer momento e de forma independente, o status da sua transação na rede. A consulta por TXID atesta a inclusão do voto no bloco sem expor a identidade do usuário, garantindo a rastreabilidade (saber que o voto chegou à urna) mantendo intacto o sigilo (ninguém além do detentor do recibo sabe a escolha associada àquele hash).[cite: 3]

A Figura 11 demonstra a interface de emissão e verificação do comprovante criptográfico na plataforma.[cite: 3]

**Figura 11 - Verificação de integridade individual via TXID e Receipt Hash.**[cite: 3]

> *(Print do painel de Voto e Comprovante do Votify)*[cite: 3]

Fonte: Elaboração Própria (2026)[cite: 3]

### Auditoria Independente e Contribuições para a Área de TI[cite: 3]
Uma das contribuições adicionais mais relevantes desta pesquisa para a área de Tecnologia da Informação consiste na materialização de um modelo de auditoria ponta a ponta sem violação de sigilo. A validação demonstrou que qualquer nó auditor autorizado foi capaz de consultar os streams da blockchain e conferir a consistência dos resultados de forma autônoma.[cite: 3]

A apuração confirmou que a matemática da rede é inviolável. A soma total de votos nas urnas correspondeu exatamente à quantidade de credenciais (assets) VOTE_ELEICAO_001 consumidas. Essa verificação foi realizada sem expor em nenhum momento qual eleitor depositou qual voto, superando uma limitação histórica dos sistemas eletrônicos convencionais.[cite: 3]

A Figura 12 exibe o resultado dessa validação independente.[cite: 3]

**Figura 12 - Painel de auditoria do Votify exibindo a conferência e integridade das transações na blockchain.**[cite: 3]

> *(Print do painel de Auditoria Geral validando a integridade dos nós e blocos)*[cite: 3]

Fonte: Elaboração Própria (2026)[cite: 3]

Em síntese, os resultados obtidos indicam que a arquitetura do Votify oferece um nível de segurança, imutabilidade e auditabilidade superior aos métodos puramente centralizados (Votifalho). Simultaneamente, supera os principais entraves operacionais e financeiros dos sistemas descentralizados públicos (BlockVotes), confirmando a adequação da blockchain permissionada para a modernização do processo de votação eletrônica institucional.[cite: 3]

## Considerações Finais[cite: 3]
O presente trabalho alcançou seu objetivo primordial ao projetar, desenvolver e validar o Votify, um sistema de votação eletrônica amparado pela tecnologia blockchain permissionada (MultiChain). A pesquisa demonstrou que a dependência exclusiva de servidores centrais em sistemas eleitorais pode ser efetivamente mitigada, assegurando a integridade e a imutabilidade dos votos sem sacrificar o tempo de resposta ou onerar financeiramente o processo.[cite: 3]

A principal contribuição deste estudo reside na proposição de uma arquitetura que concilia perfeitamente segurança e privacidade em um ambiente organizacional. Ao invés de recorrer a métodos criptográficos pesados e custosos empregados em redes públicas, como o proof-of-work e as ring signatures, o Votify inovou ao separar categoricamente a etapa de autorização da etapa de votação. A emissão de um asset digital de uso único (VOTE_ELEICAO_001), aliada ao mascaramento da identidade via função de espalhamento (hash) HMAC-SHA256, comprovou-se matematicamente robusta para coibir o duplo voto. Ao mesmo tempo, preservou o sigilo absoluto do eleitor. A transparência do processo também foi elevada ao máximo por meio de recibos individuais verificáveis (TXID) e da capacidade de auditoria independente gerida pelos nós fiscais da rede.[cite: 3]

Entretanto, o estudo apresenta limitações inerentes ao escopo de desenvolvimento de um protótipo laboratorial. Em primeiro lugar, a autenticação do eleitor baseou-se em uma "chave privada simulada", operando como um substituto lógico para uma integração biométrica ou de hardware no ambiente da urna. Em segundo lugar, embora a arquitetura permissionada possua performance amplamente superior às redes públicas, testes de estresse em escalas massivas e altíssima concorrência não constituíram o foco desta validação, limitando conclusões sobre a aplicação da exata mesma modelagem para cenários em maiores escalas.[cite: 3]

Diante dessas considerações, sugere-se, para trabalhos futuros, a integração nativa do sistema com hardware de autenticação biométrica, explorando a geração de chaves a partir de atributos físicos. Adicionalmente, a retomada e o refinamento do "Visualizador Didático" compõem uma excelente trilha de pesquisa, servindo como uma ferramenta de governança que desmistifica a complexidade criptográfica e aproxima o eleitor leigo da transparência oferecida pela blockchain.[cite: 3]

## Referências[cite: 3]
1. JAFAR, Uzma et al. Blockchain for Electronic Voting System—Review and Open Research Challenges. Sensors, v. 21, n. 17, p. 5874, 2021. DOI: 10.3390/s21175874. Disponível em: https://www.mdpi.com/1424-8220/21/17/5874. Acesso em: 14 maio 2026.[cite: 3]
2. OHIZE, Henry O. et al. Blockchain for securing electronic voting systems: a survey of architectures, trends, solutions, and challenges. Cluster Computing, v. 28, art. 132, 2025. DOI: 10.1007/s10586-024-04709-8. Disponível em: https://link.springer.com/article/10.1007/s10586-024-04709-8. Acesso em: 14 maio 2026.[cite: 3]
3. TAŞ, Ruhi; TANRIÖVER, Ömer Özgür. A Systematic Review of Challenges and Opportunities of Blockchain for E-Voting. Symmetry, v. 12, n. 8, p. 1328, 2020. DOI: 10.3390/sym12081328. Disponível em: https://www.mdpi.com/2073-8994/12/8/1328. Acesso em: 14 maio 2026.[cite: 3]
4. RODRIGUES, Luiz Guilherme Villa Verde Costa. A aplicabilidade da tecnologia blockchain em sistemas de votações eletrônicas: uma revisão de literatura. 2022. Trabalho de Conclusão de Curso – Universidade Federal de Santa Catarina, Florianópolis, 2022. Disponível em: https://repositorio.ufsc.br/handle/123456789/249052. Acesso em: 14 maio 2026.[cite: 3]
5. BENALOH, Josh et al. End-to-End Verifiability. In: Handbook of Voting Technology. Springer, 2015.[cite: 3]
6. RIVEST, Ronald L.; WACK, John P. On the notion of software independence in voting systems. Philosophical Transactions of the Royal Society A, v. 366, n. 1881, p. 3759–3767, 2008.[cite: 3]
7. SCHNEIER, Bruce. Secrets and Lies: Digital Security in a Networked World. New York: Wiley Publishing, 2004.[cite: 3]
8. TAŞ, Ruhi; TANRIÖVER, Ömer Özgür. A Systematic Review of Challenges and Opportunities of Blockchain for E-Voting. Symmetry, v. 12, n. 8, p. 1328, 2020.[cite: 3]
9. NAKAMOTO, Satoshi. Bitcoin: A Peer-to-Peer Electronic Cash System. 2008. Disponível em: http://bitcoin.org/bitcoin.pdf. Acesso em: 14 maio 2026.[cite: 3]
10. ANTONOPOULOS, Andreas M. Mastering Bitcoin: Programming the Open Blockchain. 2. ed. Sebastopol: O’Reilly Media, 2017.[cite: 3]
11. DRESCHER, Daniel. Blockchain Basics: A Non-Technical Introduction in 25 Steps. New York: Apress, 2017.[cite: 3]
12. GREENSPAN, Gideon. MultiChain Private Blockchain – White Paper. 2015. Disponível em: MultiChain White Paper. Acesso em: 17 maio 2026.[cite: 3]
13. MULTICHAIN. Streams – MultiChain Documentation. Disponível em: MultiChain Streams Documentation. Acesso em: 17 maio 2026.[cite: 3]