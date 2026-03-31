# Backend starter

This backend uses a contract-first workflow:

1. Design the API in `openapi/openapi.yaml`
2. Lint and preview the contract
3. Implement routes that honor the contract
4. Generate frontend TypeScript types from the same contract

## Getting started

```bash
cd backend
npm install
cp .env.example .env
npm run lint:openapi
npm run dev
```

The server will start on `http://localhost:3333`.

## Useful scripts

```bash
npm run dev
npm run build
npm run lint:openapi
npm run preview:docs
npm run generate:frontend-types
```

## Default mock users

- Elector: `elector@example.com` / `demo123`
- Admin: `admin@example.com` / `demo123`
- Auditor: `auditor@example.com` / `demo123`

## Main docs endpoints

- `GET /health`
- `GET /openapi.json`
- `GET /docs`

## Notes

- The implementation currently returns mock data so the frontend can start immediately.
- The contract is the source of truth.
- Once the frontend exists, `npm run generate:frontend-types` can generate TypeScript types into the frontend project.
