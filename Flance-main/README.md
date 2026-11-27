# Flance

Plataforma para clientes encontrarem freelancers, conhecerem seus serviços, conversar e contratar planos de divulgação. O projeto está organizado como um monorepo npm com frontend Next.js, API NestJS e banco PostgreSQL acessado pelo Prisma.

## Finalidade e funcionamento do projeto

O Flance é uma plataforma de divulgação e conexão entre clientes e freelancers. A finalidade é ajudar o cliente a encontrar profissionais, conhecer os serviços oferecidos e iniciar uma conversa; e permitir que o freelancer publique e divulgue seu perfil e seus anúncios. O Flance oferece ferramentas para essa conexão, mas não intermedeia nem processa o pagamento pelo serviço combinado entre cliente e freelancer. Os pagamentos integrados ao Asaas são referentes aos planos de divulgação do próprio Flance.

### Fluxo para clientes

1. O cliente cria e confirma uma conta.
2. Pesquisa e visualiza perfis e anúncios de serviços publicados por freelancers.
3. Pode iniciar uma conversa pelo chat e, quando aplicável, trocar propostas com o profissional.
4. Pode avaliar o serviço conforme os recursos disponíveis na plataforma.

### Fluxo para freelancers

1. O profissional cria e confirma uma conta e completa seu perfil público.
2. Publica anúncios com descrição, categoria, fotos e formas de contato disponíveis na plataforma.
3. Escolhe um plano de divulgação: o plano define limites e recursos para os anúncios e para a exposição do perfil.
4. Recebe conversas e propostas de clientes pelo Flance e administra seus anúncios e assinatura no próprio site.

O plano gratuito permite começar a divulgar. Os planos pagos aumentam limites ou oferecem recursos adicionais. A contratação de um plano pago passa pelo checkout, aceite do contrato e pagamento via Pix ao Asaas. O plano é ativado após a confirmação do pagamento e a validação do código enviado ao e-mail. As renovações também são cobranças Pix: o Asaas gera a cobrança mensal e o assinante precisa pagá-la. O Flance não faz débito automático. O webhook do Asaas comunica os pagamentos à API, que atualiza a assinatura. Consulte [Gestão de pagamentos e assinaturas](./apps/api/src/modules/payments/README.md) para os detalhes.

### Fluxo técnico

- O frontend Next.js (`apps/web`) apresenta as páginas e formulários e conversa com a API.
- A API NestJS (`apps/api`) valida as entradas, autentica usuários, aplica as regras de negócio e expõe as rotas REST sob `/v1`. O chat também usa Socket.IO para comunicação em tempo real.
- O Prisma acessa o PostgreSQL definido em `DATABASE_URL`; as migrations usam `DIRECT_URL`. O Supabase pode hospedar o PostgreSQL e o armazenamento das imagens.
- Avatares e fotos de anúncios são enviados à API autenticada e guardados no Supabase Storage; o banco guarda as URLs das imagens, não os arquivos Base64.
- O Asaas processa os Pix dos planos e notifica a API por webhooks. E-mail é usado para confirmação de conta, recuperação de senha e etapas do pagamento.
- Administradores usam a área restrita para moderar contas e anúncios e acompanhar atividades da plataforma.

## Funcionalidades

- Cadastro, login, verificação de email e recuperação de senha.
- Perfis de clientes e freelancers, anúncios de serviços e avaliações.
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
   npm ci
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

   Para Supabase, use o pooler de transação (porta `6543`) em `DATABASE_URL` e o pooler de sessão (porta `5432`) em `DIRECT_URL`, copiando as URLs em **Connect** no painel. Apesar do nome da variável Prisma, a URL de sessão também pode ser usada para migrations em ambientes que não alcançam a conexão direta IPv6. Para PostgreSQL local, configure as duas URLs para o host e a porta do banco.

   Para testar pagamentos no Sandbox, configure também `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` e `ASAAS_CPF_ENCRYPTION_KEY`. A chave de criptografia deve ter pelo menos 32 caracteres. Para que os e-mails de verificacao, recuperacao de senha, administracao e pagamentos funcionem no Render Free, configure `RESEND_API_KEY` e `EMAIL_FROM` na API. O remetente deve pertencer a um dominio verificado no Resend. Para testar uploads de fotos, configure também `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` na API; mantenha a chave privada apenas no backend.

3. Aplique as migrations:

   ```powershell
   npm run db:migrate:deploy --workspace @flance/api
   ```

   Para criar e aplicar uma migration durante o desenvolvimento, use `npm run db:migrate:dev --workspace @flance/api`.

4. Inicie o site e a API:

   ```powershell
   npm run dev
   ```

   O frontend fica em `http://localhost:3000` e a API em `http://localhost:3001`.

### Iniciar também o ngrok

No Windows, o script abaixo abre o ambiente de desenvolvimento e o ngrok em janelas separadas:

```powershell
.\iniciar-flance.bat
```

O ngrok encaminha para a porta `3001`. No painel do Asaas, use a URL exibida pelo ngrok com o caminho `/v1/payments/webhook`. Mantenha as duas janelas abertas durante os testes. Em contas gratuitas, o endereço do ngrok pode mudar ao iniciar uma nova sessão.

## Deploy no Render

No repositório GitHub, o monorepo está dentro da pasta `Flance-main`. Para cada serviço do Render, defina **Root Directory** como `Flance-main`.

Crie dois serviços Node:

| Serviço | Build Command | Start Command |
|---|---|---|
| API | `npm ci && npm run build --workspace @flance/api` | `npm run start --workspace @flance/api` |
| Site | `npm ci && npm run build --workspace @flance/web` | `npm run start --workspace @flance/web` |

Configure `NEXT_PUBLIC_API_URL` no serviço do site com a URL HTTPS pública da API. No servico da API, configure `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `WEB_BASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM` e as credenciais do Asaas. `CORS_ORIGIN` e `WEB_BASE_URL` devem usar a origem HTTPS do site publicado, sem caminhos. Para uploads, a API também exige `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`; `SUPABASE_STORAGE_BUCKET` pode ser definido como `flance-media` (padrão). O bucket é público para leitura das imagens e aceita PNG, JPEG e WebP de até 2 MB.

`COMPANY_LEGAL_NAME`, `COMPANY_CNPJ` e `COMPANY_ADDRESS` são opcionais. Se não forem configuradas, o contrato usa o nome Flance e omite os campos de CNPJ e endereço.

Antes de aplicar migrations no banco de produção, confirme o projeto Supabase e faça backup. O script abaixo cria e valida um backup do schema `public` antes de aplicar as migrations. Exige `DATABASE_URL`, `DIRECT_URL`, `pg_dump` e `pg_restore` disponíveis localmente. Substitua `SUA_REF_CONFIRMADA` pela project ref de 20 caracteres do banco de produção; o script interrompe a execução se as URLs apontarem para outro projeto. Guarde o backup fora do repositório.

```powershell
$projectRef = "SUA_REF_CONFIRMADA"
node apps/api/scripts/backup-and-migrate-production.js "--project-ref=$projectRef"
```

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
- Em produção, configure URLs HTTPS, CORS para o domínio do site, segredos próprios, credenciais reais do Asaas, Resend e Supabase Storage.
- Nunca use a chave do Sandbox em produção nem a chave de produção em testes locais.

## Documentação adicional

- [Guia de API](./apps/api/README.md)
- [Gestão de pagamentos e assinaturas](./apps/api/src/modules/payments/README.md)
- [Guia do frontend](./apps/web/README.md)
- [Setup de Docker](./docker/SETUP_GUIDE.md)
- [Documentação geral](./DOCUMENTATION.md)
- [Política de segurança](./SECURITY.md)
