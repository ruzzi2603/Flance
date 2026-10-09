# Flance

Plataforma para encontrar empresas e profissionais, publicar serviços, conversar e contratar planos de divulgação. O projeto está organizado como um monorepo npm com frontend Next.js, API NestJS e banco PostgreSQL acessado pelo Prisma.

## Funcionalidades

- Cadastro, login, verificação de email e recuperação de senha.
- Perfis de usuários e empresas, anúncios e avaliações.
- Conversas, propostas e recursos administrativos.
- Planos e pagamentos via Asaas, com suporte a Pix e webhooks.

## Gestão de pagamentos e assinaturas

Os planos pagos são cobrados via Pix pelo Asaas. A escolha do plano no perfil apenas inicia o checkout; o plano só fica ativo depois de o Pix ser confirmado e o usuário informar o código de ativação enviado ao e-mail. O preço é calculado pela API, e o formulário apresenta o valor e as regras de renovação antes do aceite do contrato.

O fluxo é: escolher um plano pago → revisar e aceitar o contrato → informar nome, e-mail verificado e CPF → gerar o Pix → aguardar a confirmação do Asaas → informar o código de ativação → usar o plano. Depois da ativação, o Asaas cria a assinatura mensal em Pix. Cada mensalidade precisa ser paga pelo usuário; o webhook atualiza o Flance e a página **Minha assinatura** permite consultar vencimentos, pagar uma mensalidade, cancelar ou reativar a renovação.

Em desenvolvimento, use o Sandbox do Asaas e configure o webhook para `https://<endereço-ngrok>/v1/payments/webhook`, com o mesmo token definido em `ASAAS_WEBHOOK_TOKEN`. Mantenha a API e o ngrok ativos durante os testes. A integração detalhada, endpoints, eventos, regras de cobrança e configuração estão no [guia de pagamentos](./apps/api/src/modules/payments/README.md).

> A cobrança real depende das credenciais de produção e da configuração do Asaas. Para desenvolvimento, use as credenciais e o endereço do Sandbox.

## Tecnologias

- Next.js, React e TypeScript (`apps/web`).
- NestJS e TypeScript (`apps/api`).
- PostgreSQL e Prisma (`packages/database`).
- npm workspaces e Turborepo.

## Requisitos

- Node.js e npm compatíveis com as versões declaradas no `package.json`.
- Acesso a um PostgreSQL. O projeto também pode usar Supabase como provedor PostgreSQL.
- ngrok instalado e autenticado, somente para testar webhooks recebidos localmente.

## Configuração local

Execute os comandos a partir da raiz do repositório.

1. Instale as dependências:

   ```powershell
   npm install
   ```

2. Crie o arquivo `.env` na raiz. Não compartilhe nem versione esse arquivo. Configure pelo menos:

   ```dotenv
   DATABASE_URL="postgresql://USUARIO:SENHA@HOST:6543/postgres?pgbouncer=true&connection_limit=1"
   DIRECT_URL="postgresql://USUARIO:SENHA@HOST:5432/postgres"
   JWT_SECRET="gere-uma-chave-aleatoria-com-pelo-menos-32-caracteres"
   CORS_ORIGIN="http://localhost:3000"
   WEB_BASE_URL="http://localhost:3000"
   NEXT_PUBLIC_API_URL="http://localhost:3001"
   ASAAS_BASE_URL="https://api-sandbox.asaas.com/v3"
   ```

   Para Supabase, use a connection string do pooler na `DATABASE_URL` e a conexão direta na `DIRECT_URL`. Se estiver usando PostgreSQL local, configure as duas URLs para o host local e a porta do seu banco.

   Para testar pagamentos no Sandbox, configure também `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` e `ASAAS_CPF_ENCRYPTION_KEY`. A chave de criptografia deve ter pelo menos 32 caracteres. Para recuperação de senha e emails funcionarem, configure as variáveis `SMTP_*` usadas pela API.

3. Aplique as migrations:

   ```powershell
   npm run db:migrate:deploy --workspace @flance/api
   ```

   Para criar e aplicar uma migration durante o desenvolvimento, use `npm run db:migrate:dev --workspace @flance/api`.

4. Inicie o site e a API:

   ```powershell
   npm run dev / npm run dev --workspace @flance/web / npm run dev --workspace @flance/api / ngrok http 3001
   ```

   O frontend fica em `http://localhost:3000` e a API em `http://localhost:3001`.

### Iniciar também o ngrok

No Windows, o script abaixo abre o ambiente de desenvolvimento e o ngrok em janelas separadas:

```powershell
.\iniciar-flance.bat
```

O ngrok encaminha para a porta `3001`. No painel do Asaas, use a URL exibida pelo ngrok com o caminho `/v1/payments/webhook`. Mantenha as duas janelas abertas durante os testes. Em contas gratuitas, o endereço do ngrok pode mudar ao iniciar uma nova sessão.

## Comandos úteis

```powershell
npm run dev                                       # Frontend e API
npm run build                                     # Build dos workspaces
npm run lint                                      # ESLint dos workspaces
npm run typecheck                                 # Checagem TypeScript
npm run test --workspace @flance/api              # Testes da API
npm run db:migrate:dev --workspace @flance/api    # Migrations em desenvolvimento
npm run db:migrate:deploy --workspace @flance/api # Aplicar migrations existentes
npm run db:studio --workspace @flance/api         # Prisma Studio
```

## Estrutura

```text
apps/
  api/                 API NestJS
  web/                 Aplicação Next.js
packages/
  database/            Schema, migrations e seed Prisma
  design-system/       Componentes e estilos compartilhados
  eslint-config/       Configuração ESLint compartilhada
  legal/               Documentos legais
  types/               Tipos compartilhados
```

## Variáveis e segurança

- O `.env` local e credenciais reais não devem ser adicionados ao Git.
- `DATABASE_URL` é usada pela aplicação; migrations do Prisma usam `DIRECT_URL`.
- Em produção, configure URLs HTTPS, CORS para o domínio correto, segredos próprios, credenciais reais do Asaas e SMTP.
- Nunca use a chave do Sandbox em produção nem a chave de produção em testes locais.

## Documentação adicional

- [Guia de API](./apps/api/README.md)
- [Gestão de pagamentos e assinaturas](./apps/api/src/modules/payments/README.md)
- [Guia do frontend](./apps/web/README.md)
- [Setup de Docker](./docker/SETUP_GUIDE.md)
- [Documentação geral](./DOCUMENTATION.md)
- [Política de segurança](./SECURITY.md)
