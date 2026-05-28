# Votify Frontend

Interface oficial simples para demonstração do sistema de votação.

## Rodar

```powershell
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

URL padrão:

```text
http://localhost:5173
```

O backend deve estar rodando em:

```text
http://localhost:3333/api/v1
```

## Telas

```text
/               Urna do eleitor
/configuracao   Cadastro de eleitores para demonstração
/auditoria      Apuração e provas de integridade
```

## Fluxo de Demonstração

1. Acessar `/configuracao`.
2. Gerar CPF e chave privada.
3. Cadastrar eleitor.
4. Acessar `/`.
5. Informar a chave privada.
6. Escolher uma opção e votar.
7. Aguardar o comprovante atualizar automaticamente.
8. Clicar em `Votar` novamente para demonstrar a barreira anti-duplicidade.
9. Acessar `/auditoria`.

O frontend é propositalmente simples e direto. A segurança do sistema não está
na interface; está nas regras da blockchain.
