# Votify Print Agent

Serviço Node.js responsável por receber eventos de comprovante de votação via WebSocket (`socket.io-client`) do backend e imprimir os recibos térmicos (~80mm) de forma sequencial.

## Funcionamento e Fila FIFO Serial

- Os eventos `print_receipt` recebidos do backend entram em uma **fila FIFO serial** (um único worker).
- Apenas **um comprovante é impresso por vez**, mesmo que múltiplos votos cheguem simultaneamente.
- Eventos duplicados (mesmo `txid` já na fila, em impressão ou já impresso) são ignorados automaticamente.
- Após o término real de cada impressão, se houver mais itens na fila (ou se um novo item chegar antes do intervalo mínimo), o agente aguarda `PRINT_INTERVAL_MS` (padrão `5000` ms) antes de iniciar a próxima impressão.
- Falhas de impressão contam com retentativas limitadas (`PRINT_MAX_RETRIES`, padrão `2`) e não travam a fila: o erro é registrado, o ACK de falha (`print_receipt_ack`) é enviado ao backend e o worker segue para o próximo item.
- No encerramento (`SIGINT` / `SIGTERM`), o agente para de aceitar novos eventos e aguarda a conclusão da impressão em andamento antes de finalizar o processo.

## Configuração (`.env`)

Copie o arquivo `.env.example` para `.env` e ajuste as variáveis:

```ini
BACKEND_URL=http://localhost:3333
PRINTER_NAME=4BARCODE 2B-2023B
PRINT_AGENT_SECRET=troque-este-valor-em-producao
FRONTEND_BASE_URL=http://localhost:5173
PRINT_INTERVAL_MS=5000
PRINT_MAX_RETRIES=2
```

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `BACKEND_URL` | `http://localhost:3333` | URL do servidor backend (Socket.IO) |
| `PRINTER_NAME` | *(impressora padrão do SO)* | Nome da impressora térmica no Windows |
| `PRINT_AGENT_SECRET` | — | Token de autenticação compartilhado com o backend |
| `FRONTEND_BASE_URL` | `http://localhost:5173` | URL base impressa no rodapé de validação do comprovante |
| `PRINT_INTERVAL_MS` | `5000` | Intervalo de espera (em ms) após o fim de uma impressão antes de processar a próxima |
| `PRINT_MAX_RETRIES` | `2` | Número máximo de retentativas por comprovante em caso de falha na impressão |

## Como Rodar

Manualmente:

```powershell
cd print-agent
npm install
npm run start:print
```

Ou via script de configuração (cria a Tarefa Agendada `VotifyPrintAgent` no Windows e inicia o agente):

```powershell
cd print-agent
.\setup-print-agent.ps1
```
