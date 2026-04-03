# Database Package
Prisma schema, migrations e client.

## Comandos
- `npm --workspace @flance/database run prisma:generate`
- `npm --workspace @flance/database run prisma:migrate -- --name <name>`
- `npm --workspace @flance/database run prisma:seed`

## Env
- `DATABASE_URL`

## Principais modelos
- `User`: perfil, role, avatar, bio, services, servicesTags, needs.
- `Job`: pedidos publicados, budget, status, cliente.
- `Proposal`: propostas enviadas, status (PENDING/ACCEPTED/REJECTED/CANCELLED).
- `Conversation` e `Message`: chat entre cliente e fornecedor.
- `RefreshToken`, `Badge`, `EscrowTransaction`.

## Observacoes
O Prisma Client e gerado no postinstall da raiz.
