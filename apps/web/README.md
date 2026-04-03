# Flance Web
Next.js App Router frontend.

## Stack
- Next.js 16.1.6
- React 18.3.1
- TypeScript 5.6.2
- Tailwind CSS 3.4.16
- TanStack Query 5.62.7

## Run
- `npm --workspace @flance/web run dev`

## Env
- `NEXT_PUBLIC_API_URL`

## Pastas
- `src/app`
- `src/components`
- `src/hooks`
- `src/services`
- `src/store`

## Rotas principais
- `/`: landing page
- `/jobs`: lista de pedidos com busca e paginacao
- `/jobs/[id]`: detalhes do pedido e envio de proposta
- `/dashboard/client`: painel do cliente (propostas recebidas, cancelamento, abrir chat)
- `/dashboard/freelancer`: painel do fornecedor (propostas enviadas e chat)
- `/freelancers`: lista publica de perfis de fornecedores
- `/freelancers/[id]`: perfil publico do fornecedor
- `/chat/[id]`: chat entre cliente e fornecedor
- `/profile`: perfil do usuario

## Fluxos principais
- Cliente publica pedido e acompanha propostas no dashboard.
- Fornecedor envia proposta, pode abrir chat apos sucesso.
- Cliente aceita/recusa proposta e pode cancelar acordo com motivo.
- Chat usa Socket.IO para mensagens em tempo real.

## Arquivos e pastas principais
- `src/app/layout.tsx`: layout global e providers.
- `src/app/page.tsx`: landing page.
- `src/app/jobs/`: listagem e detalhes de jobs.
- `src/app/dashboard/`: dashboards de cliente e freelancer.
- `src/app/profile/`: edicao do perfil.
- `src/app/freelancers/`: listagem e perfil publico do fornecedor.
- `src/app/chat/[id]/`: chat entre cliente e freelancer.
- `src/components/shared/`: Navbar, Footer e shell.
- `src/components/ui/`: componentes base (Shadcn/UI + custom).
- `src/components/forms/`: inputs e validacao.
- `src/hooks/useAuth.ts`: estado de sessao e `/auth/me`.
- `src/services/api.ts`: axios + refresh de sessao.
- `src/services/auth.ts`: login/register/logout.
- `src/services/jobs.ts`: CRUD de jobs.
- `src/services/proposals.ts`: propostas (enviar/aceitar/recusar/cancelar).
- `src/services/chat.ts`: conversas e mensagens.
- `src/services/realtime.ts`: socket client.
- `src/store/useAuthStore.ts`: estado global do usuario.
