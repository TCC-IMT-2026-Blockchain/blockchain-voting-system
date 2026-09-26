# Verificação de Voto (Verify Vote)

A **Verificação de Voto** é o mecanismo de auditoria individual disponibilizado pelo Votify. Ele permite que qualquer eleitor confira o status e a integridade de sua participação na eleição de forma transparente, consultando diretamente o estado atual da blockchain.

## Como funciona?

Para realizar a verificação, o eleitor deve possuir os dados gerados no seu **Comprovante**, especificamente:
- **TXID do comprovante**: O ID da transação na rede.
- **Hash do comprovante**: A assinatura de integridade entregue na hora do voto.

Esses dois dados devem ser inseridos nos campos correspondentes na tela "Verificar voto". Ao clicar em "Verificar", o sistema (Frontend) faz uma requisição ao Backend, que por sua vez consulta a rede MultiChain buscando pelos metadados públicos daquele `TXID`.

## Retorno da Verificação

Quando o comprovante é encontrado e validado, o sistema exibe os resultados da auditoria individual:

1. **Localização na Rede**: Informa em qual **Bloco** exato (ex: `50`) a transação está registrada no momento da consulta.
2. **Nível de Segurança (Confirmações)**: Mostra quantas confirmações a transação possui no momento da pesquisa (ex: `3 confirmações`). Isso demonstra que a rede continua crescendo e empacotando blocos em cima do voto, tornando-o inalterável de acordo com as leis da criptografia.
3. **Validação do Hash**: A informação mais crítica. O sistema compara o `Hash` informado pelo eleitor com o `Hash` recalculado atual da transação presente na blockchain. 
   - Se eles baterem, exibe-se uma confirmação verde informando: *"Hash confirmado. O comprovante informado corresponde ao estado atual da blockchain."*
   - Isso significa que nem os administradores do sistema, nem atacantes, conseguiram adulterar os dados originais do voto inseridos naquele `TXID`.

## Segurança e Anonimato

É de extrema importância pontuar que o processo de "Verificar Voto" **NÃO exibe a escolha do candidato**. A verificação confirma apenas que a cédula (transação) está segura e selada na "urna" (stream) da rede. Dessa forma, o Votify prova que o voto foi processado corretamente sem ferir o princípio do voto secreto.
