# Flance API
NestJS backend API for the Flance platform.

## Stack
- NestJS 11.1.16
- TypeScript 5.6.2
- Prisma 5.22.0
- PostgreSQL 15+
- Socket.IO (chat realtime)

## Run
- `npm --workspace @flance/api run dev`

## Env
- `DATABASE_URL`
- `JWT_SECRET`
- `PORT`
- `CORS_ORIGIN`

## API
Base: `/v1`

Auth:
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/refresh`
- `POST /auth/logout`

Users:
- `GET /users/health`
- `PATCH /users/me`
- `GET /users/freelancers` (query: `q`, `limit`, `offset`)
- `GET /users/freelancers/:id`

Jobs:
- `GET /jobs` (query: `q`, `limit`, `offset`)
- `GET /jobs/:id`
- `POST /jobs`

Proposals:
- `POST /jobs/:id/proposals`
- `GET /proposals/received`
- `GET /proposals/sent`
- `PATCH /proposals/:id`
- `POST /proposals/:id/cancel`

Chat:
- `GET /conversations`
- `POST /conversations/direct`
- `GET /conversations/:id/messages`
- `POST /conversations/:id/messages`

Realtime (Socket.IO):
- Namespace: `/`
- Eventos: `join.conversation`, `leave.conversation`, `message.sent`

## Payloads (exemplos rapidos)
- `POST /jobs`:
  ```json
  { "title": "Site", "description": "Escopo", "budgetType": "FIXED", "budget": 3000, "category": "Dev" }
  ```
- `POST /jobs/:id/proposals`:
  ```json
  { "text": "Minha proposta", "bidAmount": 2500 }
  ```
- `PATCH /proposals/:id`:
  ```json
  { "status": "ACCEPTED" }
  ```
- `POST /proposals/:id/cancel`:
  ```json
  { "reason": "Cliente cancelou" }
  ```

## Erros
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- 409 Conflict
- 422 Unprocessable Entity

## Observacoes
Swagger nao esta habilitado ainda. Consulte o README raiz para payloads e exemplos.

## Arquivos e pastas principais
- `src/main.ts`: bootstrap do Nest, CORS, cookies, body parser e prefixo `/v1`.
- `src/app.module.ts`: registra modulos e guards globais.
- `src/app.controller.ts`: healthcheck base.
- `src/config/env.validation.ts`: validacao das variaveis de ambiente com Zod.
- `src/common/`: decoradores, guards, pipes, interceptors e helpers.
- `src/modules/auth/`: login, register, refresh, logout e JWT.
- `src/modules/users/`: perfil do usuario, upgrade para freelancer e listagem publica.
- `src/modules/jobs/`: criacao e consulta de jobs.
- `src/modules/proposals/`: envio, listagem, aceite/recusa e cancelamento.
- `src/modules/chat/`: conversas, mensagens e realtime (Socket.IO).
- `src/modules/payments/`: integracao de pagamentos (escrow/Stripe).
- `src/modules/ai/`: matching por IA (stub/base).
