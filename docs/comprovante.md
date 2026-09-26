# Comprovante de Votação (Receipt)

O **Comprovante de Votação** é o documento digital e criptográfico gerado imediatamente após o eleitor submeter seu voto na urna do Votify. Ele atua como uma garantia matemática de que a intenção de voto do eleitor foi convertida em uma transação na rede blockchain.

## O Que é o Comprovante?

Diferente de sistemas de votação em papel ou bancos de dados tradicionais, o comprovante do Votify não revela **em quem** o eleitor votou (para manter o anonimato e evitar coerção). Em vez disso, ele prova **que** o voto foi depositado na rede de forma imutável.

## Informações do Comprovante

A interface do comprovante (como exibido na cabine de votação) apresenta os seguintes campos:

1. **Status (Confirmado/Enviado)**: Indica o estado da transação na rede. Quando "Confirmado", significa que a transação já foi processada e incluída pelos nós mineradores/validadores da blockchain.
2. **TXID (Transaction ID)**: Um identificador hexadecimal único (ex: `91C3FD...`) que aponta exatamente para a transação que depositou o voto na *stream* da `urna` e queimou o *asset* (token) do eleitor.
3. **Bloco (Block)**: O número exato do bloco na blockchain onde a transação do voto foi fixada.
4. **Confirmações**: O número de blocos subsequentes que já foram minerados após o bloco do seu voto. Quanto maior esse número, maior a profundidade do bloco e a garantia matemática de imutabilidade.
5. **Hash**: Uma assinatura criptográfica (gerada em `receipt_hash` ou `receiptHash`) que serve como selo de integridade da operação na blockchain.

## Por que é importante?

O eleitor deve guardar o **TXID** e o **Hash** (geralmente copiando ou tirando um print). Com essas informações, o eleitor detém o poder autônomo de auditar o próprio voto a qualquer momento futuro, garantindo que ele não foi apagado ou alterado pelo sistema, utilizando o recurso de **Verificar Voto**.
