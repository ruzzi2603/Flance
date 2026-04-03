# 🚀 Flance - Guia de Setup & Desenvolvimento

## ⚡ Quick Start

### Pré-requisitos
- Node.js 24.12.0+
- npm 10.8.2+
- PostgreSQL 15+ (local ou Supabase)
- Redis 7+ (opcional, para cache em produção)

### Setup Local (Desenvolvimento)

```bash
# 1. Clone e instale dependências
git clone https://github.com/seu-usuario/flance.git
cd flance
npm install

# 2. Configure .env na raiz
cp .env.example .env

# IMPORTANTE: Edite .env com suas credenciais:
# - DATABASE_URL: PostgreSQL connection string
# - JWT_SECRET: Min 32 caracteres (gere com: openssl rand -base64 32)
# - SMTP_*: Credenciais de email (Gmail com app password)
# - CORS_ORIGIN: http://localhost:3000 (dev)

# 3. Setup database
npm run db:migrate:dev

# 4. (Opcional) Seed data de exemplo
npm run db:seed

# 5. Inicie a dev stack (API + Web + Database)
npm run dev

# Frontend: http://localhost:3000
# API: http://localhost:3001/v1
# Banco: localhost:5432
```

---

## 📁 Estrutura do Projeto

```
flance/
├── apps/
│   ├── api/              # Backend NestJS
│   │   ├── src/
│   │   │   ├── modules/  # Domínios (auth, jobs, proposals, chat, etc)
│   │   │   ├── common/   # Shared utilities (logger, filters, guards)
│   │   │   ├── config/   # Env validation
│   │   │   └── main.ts   # Bootstrap
│   │   └── package.json
│   └── web/              # Frontend Next.js
│       ├── src/
│       │   ├── app/      # Páginas (App Router)
│       │   ├── components/ # React components
│       │   ├── hooks/    # Custom hooks (useAuth, useQuery, etc)
│       │   ├── services/ # API clients
│       │   ├── store/    # Zustand stores
│       │   └── types/    # TypeScriptinterfaces
│       └── package.json
├── packages/
│   ├── database/         # Prisma schema + migrations
│   ├── types/            # Tipos compartilhados API ↔ Web
│   ├── design-system/    # Design tokens (cores, typography)
│   └── eslint-config/    # Lint rules compartilhadas
├── .env.example          # Template de environment variables
├── turbo.json            # Build orchestrator config
└── package.json          # Workspace root
```

---

## 🔐 Segurança & Environment

### Variáveis de Ambiente (Obrigatórias em Prod)

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `NODE_ENV` | Ambiente | `production` \| `development` |
| `DATABASE_URL` | PostgreSQL | `postgresql://user:pass@host/db` |
| `JWT_SECRET` | Signing key | Min 32 chars (use `openssl rand -base64 32`) |
| `CORS_ORIGIN` | Frontend URL | `https://flance.com` (NUNCA use `*`) |
| `SMTP_HOST` | Email SMTP | `smtp.gmail.com` |

**🔑 Segurança Crítica:**
- ❌ NUNCA commit .env em git
- ❌ NUNCA use `*` em CORS em produção
- ✅ Use secrets manager (AWS SecretsManager, Vercel, etc)
- ✅ Rotate JWT_SECRET a cada 6 meses
- ✅ Habilitar HTTPS em produção (Helmet faz HSTS)

---

## 🧪 Testes

### Executar Testes

```bash
# Todos os testes
npm run test

# Apenas API
npm run test --workspace @flance/api

# Apenas Web
npm run test --workspace @flance/web

# Com coverage
npm run test -- --coverage

# Watch mode (re-run ao salvar)
npm run test -- --watch
```

### Cobertura Esperada
- **Crítico (Auth, Payments):** 90%+
- **Core (Jobs, Proposals):** 70%+
- **UI (Components):** 50%+

---

## 🏗️ Arquitetura & Padrões

### Backend (NestJS) - Estrutura de Módulos

```
modules/
├── auth/                 # Autenticação: JWT, password reset, refresh tokens
├── users/               # Perfis de usuário, busca de freelancers
├── jobs/                # CRUD de jobs, search
├── proposals/           # Propostas, bid management, lifecycle
├── chat/                # WebSocket real-time messaging
├── payments/            # Stripe integration, escrow (TODO)
└── ai/                  # Proposal matching com IA (TODO)

common/
├── logger/              # Structured logging (Winston)
├── filters/             # Exception handlers
├── guards/              # Authentication, rate limiting
├── middleware/          # Request logging, correlation IDs
├── prisma/              # ORM setup
└── decorators/          # @CurrentUser(), @Auth()
```

### Frontend (Next.js) - Estrutura

```
src/
├── app/                 # Pages + Layouts (App Router)
├── components/          # Reusable UI components
│   ├── forms/          # Form components
│   ├── shared/         # Common (Header, Footer, etc)
│   ├── gamification/   # Badges, levels
│   └── ui/             # Buttons, modals, etc
├── hooks/              # Custom hooks (useAuth, useQuery)
├── services/           # API clients (axios instances)
├── store/              # State management (Zustand)
├── types/              # TypeScript interfaces
└── lib/                # Utilities (formatters, validators)
```

---

## 📊 Database (Prisma)

### Executar Migrations

```bash
# Criar migration (após change schema.prisma)
npx prisma migrate dev --name add_feature_name

# Apply migrations (prod)
npx prisma migrate deploy

# Rollback (dev only)
npx prisma migrate resolve --rolled-back migration_name

# View schema
npx prisma studio  # Abre UI no localhost:5555
```

### Performance - Indexes

Crítico em produção: Todas as foreign keys tem indexes

```prisma
model Proposal {
  @@index([jobId])                    # Listar propostas de job
  @@index([freelancerId])             # Listar propostas de freelancer
  @@index([status])                   # Filtrar por status
  @@index([freelancerId, jobId])      # Validar uniqueness
}
```

---

## 🚀 Deployment

### Requisitos

- **Hosting:** Vercel (frontend), Railway/Heroku/VPS (backend)
- **Database:** Supabase ou AWS RDS PostgreSQL
- **Cache:** Upstash Redis (optional)
- **Email:** SendGrid ou AWS SES
- **Payments:** Stripe Connect
- **Monitoring:** Datadog ou New Relic (optional)

### Deploy Checklist

- [ ] Todos .env em secrets manager
- [ ] Database migrations rodadas
- [ ] Cache (Redis) configurado
- [ ] Backups automatizados habilitados
- [ ] HTTPS + HSTS ativados
- [ ] Rate limiting ajustado para escala
- [ ] Monitoring + alertas configurados
- [ ] CORS de produção confirmado
- [ ] Testes passando (CI/CD)

---

## 📝 Logging & Debugging

### Viewing Logs (Desenvolvimento)

```bash
# Ver logs em tempo real (colorized)
tail -f logs/combined.log

# Ver apenas erros
grep "ERROR" logs/error.log

# Com timezone
TIMEZONE=America/Sao_Paulo npm run dev
```

### Logging em Código

```typescript
// No controller/service
constructor(private logger: LoggerService) {}

// Informações
this.logger.info("User login successful", { userId, ip });

// Avisos (comportamento anormal mas recuperável)
this.logger.warn("Rate limit approached", { userId, remaining: 5 });

// Erros (falha que afeta função)
this.logger.error("Database connection failed", error, { host, port });

// Debug (development only)
this.logger.debug("Executing complex query", { queryCount: 3 });
```

---

## 🔗 APIs Importantes

### REST Endpoints (NestJS)

Base: `http://localhost:3001/v1`

#### Auth
- `POST /auth/register` - Criar conta
- `POST /auth/login` - Login
- `POST /auth/refresh` - Novo access token
- `POST /auth/logout` - Revoke refresh tokens
- `GET /auth/me` - Usuário atual
- `POST /auth/password/forgot` - Request password reset
- `POST /auth/password/verify` - Verify reset code
- `POST /auth/password/reset` - Set nova senha

#### Usuários
- `GET /users/freelancers?q=...` - Buscar freelancers
- `GET /users/freelancers/:id` - Detalhes freelancer
- `PATCH /users/me` - Atualizar perfil

#### Jobs
- `GET /jobs?q=...` - Listar jobs
- `GET /jobs/:id` - Detalhes job
- `POST /jobs` - Criar job

#### Propostas
- `POST /jobs/:jobId/proposals` - Enviar proposta
- `GET /proposals/received` - Propostas recebidas (cliente)
- `GET /proposals/sent` - Propostas enviadas (freelancer)
- `PATCH /proposals/:id` - Aceitar/rejeitar
- `POST /proposals/:id/cancel` - Cancelar acordo

#### Chat
- `GET /conversations` - Listar conversas
- `GET /conversations/:id/messages` - Mensagens
- `POST /conversations/:id/messages` - Enviar mensagem
- **WebSocket:** `ws://localhost:3001` - Real-time chat

---

## 🛠️ Troubleshooting

### "DATABASE_URL não encontrada"

```bash
# Verificar se .env existe
ls -la .env

# Verificar variável
echo $DATABASE_URL

# Se vazio, adicionar manualmente:
# DATABASE_URL=postgresql://user:pass@localhost:5432/flance_dev
```

### "JWT_SECRET muito fraco"

```bash
# Gerar secret seguro:
openssl rand -base64 32

# Copiar para .env:
JWT_SECRET=sua_chave_aqui
```

### "Porta 3000 já em uso"

```bash
# Encontrar processo
lsof -i :3000

# Kill
kill -9 <PID>

# Ou use porta diferente:
PORT=3001 npm run dev
```

### "Migrations falhando"

```bash
# Reset database (DEV ONLY - deleta tudo!)
npx prisma migrate reset

# Caso específico:
npx prisma migrate resolve --rolled-back nome_da_migration
npx prisma migrate deploy
```

---

## 📚 Recursos

- [NestJS Docs](https://docs.nestjs.com)
- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Socket.IO Docs](https://socket.io/docs/v4)

---

## 💡 Próximos Passos

- [ ] Implementar AI matching (OpenAI API)
- [ ] Integração Stripe Connect
- [ ] Testes end-to-end (Playwright)
- [ ] Dark mode
- [ ] Internacionalização (i18n)
- [ ] Mobile app (React Native)
- [ ]Métricas & Analytics

**Última atualização:** 2026-03-29
