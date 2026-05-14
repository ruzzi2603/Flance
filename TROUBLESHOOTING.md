# 🔧 Troubleshooting Guide - Flance

Guia para resolver problemas comuns ao usar ou desenvolver o Flance.

## 🔍 Problemas Comuns

### 1. Erro: `Cannot find module '@flance/types'`

#### Solução
```bash
# Reinstale dependências
npm install

# Gere tipos do Prisma
npm run db:prisma:generate

# Se ainda não funcionar:
npm run clean
npm install
npm run build
```

---

### 2. Erro: `Port 3001 already in use`

#### Solução

**Opção 1: Encontre e mate o processo**

```bash
# macOS/Linux
lsof -ti:3001 | xargs kill -9

# Windows PowerShell
Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process
```

**Opção 2: Use uma porta diferente**

```bash
API_PORT=3002 npm run dev
```

---

### 3. Erro: `Error: connect ECONNREFUSED 127.0.0.1:5432`

#### Problema
PostgreSQL não está rodando.

#### Solução

**Opção 1: Usar Docker Compose (Recomendado)**

```bash
docker-compose up -d
npm run db:migrate:dev
npm run dev
```

**Opção 2: PostgreSQL Local**

```bash
# macOS (Homebrew)
brew services start postgresql@15

# Windows
# Abra Services.msc e inicie "PostgreSQL"

# Linux
sudo systemctl start postgresql
```

---

### 4. Erro: `Invalid DATABASE_URL format`

#### Problema
Variável de ambiente mal formatada.

#### Solução

Verifique o `.env`:

```bash
# ❌ ERRADO
DATABASE_URL=postgresql://user password@localhost:5432/flance

# ✅ CORRETO
DATABASE_URL="postgresql://user:password@localhost:5432/flance"

# ✅ Com caracteres especiais
DATABASE_URL="postgresql://user:p%40ssw0rd@localhost:5432/flance"
# Use URL encoding para caracteres especiais
```

---

### 5. Erro: `Prisma: The engine failed to start`

#### Solução

```bash
# Regenere o Prisma Client
npm run db:prisma:generate

# Ou delete e reinstale
rm -rf node_modules/.prisma
npm install
```

---

### 6. Erro: `TypeScript compilation failed`

#### Solução

```bash
# Verifique tipos
npm run typecheck

# Corrija todos os erros de tipo

# Compile manualmente
npm run build

# Se precisar forçar:
npm run build -- --force
```

---

### 7. Erro: `CORS policy: No 'Access-Control-Allow-Origin' header`

#### Problema
Frontend e backend em domínios diferentes.

#### Solução

Verifique `.env`:

```bash
# Backend
CORS_ORIGIN="http://localhost:3000"

# Frontend
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

Em produção, use domínios específicos:

```bash
# ✅ Bom
CORS_ORIGIN="https://seu-dominio.com"

# ❌ NUNCA faça isto em produção
CORS_ORIGIN="*"
```

---

### 8. Erro: `JWT Token is invalid or expired`

#### Solução

```bash
# Limpe cookies/localStorage do navegador
# DevTools → Application → Clear All

# Ou login novamente

# Verifique JWT_SECRET no .env (mínimo 32 chars)
```

---

### 9. WebSocket não conecta

#### Problema
Socket.io não consegue conectar em chat.

#### Solução

```bash
# 1. Verifique se API está rodando
curl http://localhost:3001/health

# 2. Verifique firewall (porta 3001)
# 3. Tente desabilitar CORS temporariamente (dev only)
# 4. Verifique logs da API
npm run dev

# 5. Se usar proxy reverso, configure websocket
# nginx: proxy_upgrade http/1.1; proxy_set_header Upgrade $http_upgrade;
```

---

### 10. Erro: `ENOTFOUND` quando chamando API

#### Problema
Domínio/IP não resolvido.

#### Solução

```bash
# Verifique NEXT_PUBLIC_API_URL
echo $NEXT_PUBLIC_API_URL

# Em produção, use um domínio válido
# Não use localhost quando deployado

# Ping o servidor
ping api.seu-dominio.com
```

---

## 🚀 Build & Deployment Issues

### 1. Build falha em produção

```bash
# Rode build localmente para simular produção
npm run build

# Verifique erros de tipos
npm run typecheck

# Verifique linting
npm run lint

# Execute em modo strict
NODE_ENV=production npm run build
```

### 2. Imagens não carregam em produção

```bash
# Verifique públic/uploads existe
# Configure CDN corretamente
# Verifique permissões de acesso

# Em Next.js, configure next.config.mjs
# images: { domains: ['seu-dominio.com'] }
```

### 3. Variáveis de ambiente não carregam

```bash
# Para Next.js, use NEXT_PUBLIC_* prefix
# NEXT_PUBLIC_API_URL=...

# Para NestJS, use .env
# DATABASE_URL=...

# Verifique arquivo .env existe
ls -la .env

# Recompile após mudança de .env
npm run build
```

---

## 🗄️ Database Issues

### 1. Migrations pendentes

```bash
# Verifique status
npx prisma migrate status

# Execute migrations
npm run db:migrate:deploy

# Se houver problema, force
npx prisma migrate deploy --force
```

### 2. Seed falha

```bash
# Debug seed
npx ts-node packages/database/prisma/seed.js

# Ou execute via npm
npm run db:seed
```

### 3. Database está corrompida

```bash
# ⚠️ DESTRUTIVO - Só em desenvolvimento!
npx prisma migrate reset

# Em produção, faça backup primeiro
```

---

## 🧪 Testing Issues

### 1. Testes falham aleatoriamente

```bash
# Execute com seed fixo
npm run test -- --seed=12345

# Debug um teste específico
npm run test -- --inspect-brk

# Execute sem paralelização
npm run test -- --no-threads
```

### 2. Coverage não calcula corretamente

```bash
# Limpe cache
rm -rf coverage
npm run test:coverage

# Gere relatório HTML
npm run test:coverage -- --reporter=html
```

---

## 📦 Dependency Issues

### 1. `npm install` falha

```bash
# Limpe cache
npm cache clean --force

# Delete node_modules e lock
rm -rf node_modules package-lock.json

# Reinstale
npm install

# Se houver problema de compatibilidade
npm install --legacy-peer-deps
```

### 2. Versão errada de dependência

```bash
# Verifique versão instalada
npm list package-name

# Upgrade para latest
npm upgrade package-name@latest

# Downgrade
npm install package-name@1.2.3
```

---

## 🐛 Debugging

### 1. Logs estruturados

```bash
# API usa Winston logger
# Veja logs em tempo real:

npm run dev

# ou com debug detalhado
DEBUG=* npm run dev
```

### 2. Node debugger

```bash
# Rode com inspector
node --inspect dist/apps/api/src/main.js

# Acesse em: chrome://inspect
```

### 3. Prisma Studio

```bash
# Visualize database graficamente
npm run db:studio

# Acessível em: http://localhost:5555
```

### 4. Network debugging

```bash
# Monitore requisições HTTP
# DevTools → Network tab

# Para HTTPS:
# 1. Exporte certificado do servidor
# 2. Importe no DevTools
```

---

## 💡 Performance Issues

### 1. Aplicação lenta

```bash
# Profile a aplicação
NODE_OPTIONS=--prof npm run dev

# Analise o profiling
node --prof-process isolate-*.log > profile.txt
cat profile.txt

# Verifique queries lentas
npm run db:studio
# Use slow query log
```

### 2. Memória alta

```bash
# Verifique consumo
npm top

# Se usar Docker:
docker stats

# Procure memory leaks
npm run dev -- --max-old-space-size=4096
```

---

## 🔐 Security Issues

### 1. Secrets expostos

```bash
# Procure por secrets em git
git log -p -S "sk_test_" -- .

# Se já commitou:
# 1. Rotate a key
# 2. Use git-filter-repo para remover
# 3. Force push (cuidado!)

git filter-repo --invert-paths --path .env
```

### 2. Dependências vulneráveis

```bash
# Scan
npm audit

# Automatic fix
npm audit fix

# Fix com risco
npm audit fix --force

# Verifique antes de commitar
npm audit
```

---

## 🎨 Frontend Issues

### 1. Estilos não aplicam

```bash
# Limpe cache Next.js
rm -rf .next

# Recompile
npm run build

# Ou em dev
npm run dev
```

### 2. Componentes não carregam

```bash
# Verifique import paths
# Componentes devem estar em src/components/

# Limpe cache do navegador
# DevTools → Network → Disable cache

# Reload com força
Ctrl+Shift+R (ou Cmd+Shift+R no Mac)
```

---

## 📱 Mobile/Responsivo Issues

### 1. Layout quebra em mobile

```bash
# Abra DevTools
# Toggle device toolbar (Ctrl+Shift+M)

# Teste com diferentes viewports:
# iPhone: 375x667
# iPad: 768x1024
# Desktop: 1920x1080
```

---

## ❓ Ainda com problemas?

### Procure ajuda

1. **Documentação:** [README.md](./README.md)
2. **Setup Guide:** [docker/SETUP_GUIDE.md](./docker/SETUP_GUIDE.md)
2. **Issues:** [GitHub Issues](https://github.com/ruzzi2603/flance/issues)
3. **Discussions:** [GitHub Discussions](https://github.com/ruzzi2603/flance/discussions)
5. **Email:** [contato@flance.com](mailto:contato@flance.com)
6. **Discord:** [Comunidade Flance](https://discord.gg/flance)

### Ao pedir ajuda, inclua

```bash
# Versões
node --version
npm --version
git --version

# Logs relevantes
npm run dev 2>&1 | head -50

# Reprodução clara dos passos
# Screenshot/video se possível
```

---

<div align="center">

**Ainda assim não conseguiu? Não desista!** 💪

A comunidade está aqui para ajudar. Abra uma issue no GitHub!

</div>
