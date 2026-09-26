# Design Patterns - Frontend Votify

Este documento descreve os padrões de projeto adotados no desenvolvimento do Frontend da aplicação Votify.

O frontend foi desenvolvido com **Vite + TypeScript**, de forma "Vanilla" (sem uso de frameworks de UI tradicionais como React, Vue ou Angular). A escolha do Vanilla JS/TS foi proposital, mantendo o sistema simples, focado em demonstrar o fluxo e as operações do backend/blockchain ao invés de exibir arquiteturas complexas no navegador.

## 1. Arquitetura Single-Page Application (SPA) Customizada

O frontend se comporta como uma SPA que intercepta mudanças na URL e atualiza o DOM através de funções de renderização, sem o recarregamento da página.

- **`main.ts`**: Ponto único de entrada da lógica TypeScript. Ele concentra o gerenciamento do estado e as regras de renderização HTML e roteamento.
- **Roteamento Dinâmico**: Uma função `route()` captura as rotas ativas através do `window.location.pathname` e determina o comportamento (como `/configuracao`, `/auditoria` e `/admin`). O sistema invoca um `render()` condicional baseado nessa rota.

## 2. Gerenciamento de Estado Centralizado e Reatividade Manual

Como não há bibliotecas de reatividade declarativa (React/Vue), toda a informação necessária para compor a UI está centralizada em um único objeto de estado mutável.

- **Padrão de Objeto Global de Estado**:
  O objeto `state` concentra todos os dados que transitam pelo usuário (token, perfil do eleitor escolhido, recibos de voto, relatórios de auditoria, modo do sistema atual e flags de *busy/loading*).
- **Ciclo de Atualização Unidirecional (One-Way Data Flow simplificado)**:
  1. Ações (cliques, preenchimento de formulário, eventos de roteamento) são executadas através de chamadas de função assíncronas (como `castVote`, `registerVoter`, `switchMode`).
  2. Ao longo de sua execução, essas funções invocam APIs do backend e modificam diretamente o objeto global `state`.
  3. No fim da função, ela invoca a função raiz `render()`, que recompila os nós de interface necessários com base nos valores atualizados do objeto `state`.

## 3. Decoradores/Wrappers de Execução (`withBusy`)

O aplicativo emprega um padrão decorador simples via High-Order Functions (HOFs), notavelmente a função `withBusy()`.

- **`withBusy(task: Function)`**: Intercepta a execução de tarefas assíncronas.
  - Muda a variável de estado `state.busy = true` e exibe um spinner (loader) chamando `render()`.
  - Executa a promessa e captura exceções globais para exibir mensagens na UI (`state.error`).
  - Ao fim, finaliza os status (`busy = false`) e chama novamente `render()`.

## 4. Polling Controlado na Interface

Em rotas específicas como `/auditoria` ou ao aguardar os recibos da blockchain, a aplicação necessita monitorar mudanças com frequência.

- O aplicativo utiliza a técnica de **Polling**, através de funções auto-escalonadas (como `pollCurrentRoute`).
- O polling é "desativado" intencionalmente se houver operações em progresso ou se o roteamento do usuário afastar da tela de acompanhamento contínuo, preservando processamento cliente-servidor.

## 5. Padrão Fetch e Tratamento de Exceções

O frontend encapsula as conexões externas através do helper centralizado `api()`.

- Essa função abstrai as definições do `fetch` base (adicionando cabeçalhos de *Content-Type* baseados no ambiente, *Bearer Tokens* provindos do `state`).
- Verifica os Status Codes e lança exceções formatadas padronizadas, extraindo e propagando as mensagens de erro provindas do Backend para o bloco `try/catch` de `withBusy`.
