# Flance
Flance e um marketplace para conectar clientes e prestadores de servico com mais precisao e seguranca.
O foco e reduzir o tempo de triagem com matching assistido por IA, garantir pagamento seguro com escrow
e oferecer comunicacao direta por chat entre cliente e fornecedor.

## Exemplos de uso
- Um cliente descreve um projeto e recebe propostas qualificadas em minutos, sem filtrar dezenas de perfis irrelevantes.
- Um freelancer envia uma proposta, acompanha o status (pendente/aceita/recusada) e conversa em chat direto com o cliente.
- Times e agencias usam o Flance para manter historico de jobs, propostas, cancelamentos e comunicacao em um unico lugar.

## Stack (versoes)
- Node.js: 24.12.0
- npm: 10.8.2
- TypeScript: 5.6.2
- Next.js: 16.1.6
- React: 18.3.1
- NestJS: 11.1.16
- Prisma: 5.22.0
- Tailwind CSS: 3.4.16
- TanStack Query: 5.62.7
- Zustand: 5.0.0
- PostgreSQL: 15+ (managed, ex: Supabase)
- Redis: 7+ (opcional)
- Python: nao requerido

## Estrutura do monorepo
- `apps/web`: frontend Next.js
- `apps/api`: backend NestJS
- `packages/database`: Prisma schema e migrations
- `packages/types`: tipos compartilhados
- `packages/design-system`: tokens visuais
- `packages/eslint-config`: lint compartilhado
- `docker`: assets de container

## Setup local
1. Instale dependencias:
   - `npm install`
2. Configure o `.env` na raiz (veja exemplo abaixo).
3. Rode migrations do Prisma:
   - `npx prisma migrate dev --name init --schema packages/database/prisma/schema.prisma`
4. Suba o ambiente:
   - `npm run dev`

## Variaveis de ambiente (.env)
Exemplo minimo (sem credenciais reais):
```bash
# Database
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres

# Auth
JWT_SECRET=change-me-with-32-chars-min
JWT_EXPIRES_IN_SECONDS=3600
JWT_REFRESH_EXPIRES_IN_SECONDS=604800

# API
PORT=3001
CORS_ORIGIN=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Documentacao de API
Base URL: `http://localhost:3001/v1`

### Auth
- `POST /auth/register`
  - Body:
    ```json
    { "name": "Ana", "email": "ana@email.com", "password": "123456", "role": "CLIENT" }
    ```
  - Response:
    ```json
    { "accessToken": "...", "user": { "id": "...", "email": "...", "role": "CLIENT" } }
    ```
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/refresh`
- `POST /auth/logout`

### Users
- `GET /users/freelancers` (query: `q`, `limit`, `offset`)
- `GET /users/freelancers/:id`
- `PATCH /users/me`
  - Body (exemplo parcial):
    ```json
    { "name": "Joao", "bio": "Dev fullstack", "services": "Sites e apps" }
    ```

### Jobs
- `GET /jobs` (query: `q`, `limit`, `offset`)
- `GET /jobs/:id`
- `POST /jobs`
  - Body:
    ```json
    {
      "title": "Landing page",
      "description": "Escopo completo...",
      "budgetType": "FIXED",
      "budget": 4500,
      "category": "Design"
    }
    ```

### Propostas
- `POST /jobs/:id/proposals`
  - Body:
    ```json
    { "text": "Minha proposta...", "bidAmount": 4200 }
    ```
- `GET /proposals/received`
- `GET /proposals/sent`
- `PATCH /proposals/:id`
  - Body:
    ```json
    { "status": "ACCEPTED" }
    ```
- `POST /proposals/:id/cancel`
  - Body:
    ```json
    { "reason": "Motivo do cancelamento..." }
    ```

### Chat
- `GET /conversations`
- `POST /conversations/direct`
  - Body:
    ```json
    { "jobId": "...", "freelancerId": "..." }
    ```
- `GET /conversations/:id/messages`
- `POST /conversations/:id/messages`
  - Body:
    ```json
    { "body": "Mensagem..." }
    ```

### Outros
- `GET /users/health`
- `GET /payments/health`
- `POST /ai/match`

## Regras de negocio (resumo)
- Propostas so podem ser enviadas por usuarios com perfil de fornecedor.
- Cancelamento de proposta aceita exige motivo e envia mensagem ao chat.
- Conversa e criada automaticamente ao enviar proposta.

## Erros comuns
- 401 Unauthorized: token invalido ou ausente.
- 403 Forbidden: papel do usuario nao permitido.
- 404 Not Found: recurso inexistente.
- 409 Conflict: duplicidade (ex: proposta ja enviada).
- 422 Unprocessable Entity: payload invalido (Zod).

## Diagramas (C4 simplificado)
```mermaid
flowchart LR
  Web[Next.js Web] --> API[NestJS API]
  API --> DB[(PostgreSQL)]
  API --> Cache[(Redis - opcional)]
  API --> Stripe[Stripe Connect]
  API --> OpenAI[OpenAI API]
```

## Observacoes
- O Prisma Client e gerado automaticamente no `postinstall`.
- Swagger ainda nao esta habilitado. Use a lista de endpoints acima ou uma colecao Postman.
