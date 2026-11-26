# Diagramas técnicos — Flance

Documentação gerada a partir do código versionado e do schema Prisma atual.
Os desenhos são uma fotografia estática: não substituem a validação do banco
ou dos serviços em execução.

## Arquivos

- [caso-de-uso.puml](./caso-de-uso.puml): atores humanos e integrações externas
  e as capacidades expostas na aplicação.
- [diagrama-de-classes.puml](./diagrama-de-classes.puml): modelos Prisma
  relevantes, atributos principais, operações existentes nos serviços e
  dependências centrais. O DER lista a totalidade das colunas.
- [diagrama-de-banco-de-dados.mmd](./diagrama-de-banco-de-dados.mmd): todas as
  18 entidades Prisma, campos, tipos PostgreSQL correspondentes, chaves e
  cardinalidades inferidas apenas de relações/FKs declaradas.
- [diagrama-de-atividades.puml](./diagrama-de-atividades.puml): cadastro e
  verificação; publicação de vaga e proposta; contratação/cobrança mensal;
  gestão e encerramento da renovação.

## Funcionalidades analisadas

Cadastro, confirmação de e-mail, autenticação, sessões e redefinição de senha;
vagas, propostas, negociação, conversas e mensagens; perfis, empresas, mídia,
avaliações e analytics; matching; assinatura, pagamentos Pix, aceite de contrato,
webhooks, ativação inicial por código, cobrança recorrente, cancelamento e
expiração; administração/moderação; e exportação/exclusão de dados.

## Fontes examinadas

- Banco: `packages/database/prisma/schema.prisma` e as migrations de
  `packages/database/prisma/migrations/`, incluindo pagamentos Pix,
  recorrência, contratos e calendário de cobrança.
- Backend: `apps/api/src/app.module.ts` e os módulos `auth`, `users`, `jobs`,
  `proposals`, `chat`, `ai`, `payments`, `contracts`, `admin` e `privacy` em
  `apps/api/src/modules/`.
- Rotina e datas de cobrança:
  `apps/api/src/modules/payments/subscriptions-check.service.ts` e
  `apps/api/src/modules/payments/billing/billing-schedule.ts`.
- Frontend: páginas em `apps/web/src/app/`, com atenção a planos, checkout,
  assinatura, contrato, vagas, propostas, chat, empresas, perfis, administração
  e privacidade; chamadas em `apps/web/src/services/`.

O arquivo `.env` não foi lido nem usado como fonte; valores secretos não fazem
parte da documentação.

## Ressalvas e pontos para validação operacional

- `AdminAuditLog.adminId`/`targetUserId`, `PaymentWebhookEvent.providerPaymentId`
  e `ContractAcceptance.paymentId` são colunas escalares sem relações/FKs
  declaradas no Prisma. `ContractAcceptance.paymentId` é único, mas não é uma
  relação com `Payment`.
- `Conversation.jobId` e `Payment.subscriptionId` são FKs opcionais.
  `PaymentActivationCode.paymentId` é obrigatório e único: um pagamento pode
  existir antes de ter código de ativação.
- A assinatura e os pagamentos recorrentes são reconciliados pelo webhook e
  pela rotina periódica; `PaymentActivationCode` é usado apenas no pagamento
  inicial.
- A configuração de planos na API oferece `FREE`, `PROFESSIONAL` e
  `PROFESSIONAL_PLUS`; o schema também preserva os níveis legados `BASIC`,
  `PRO` e `PREMIUM`.
- `EscrowTransaction` existe como modelo no banco; os diagramas não presumem
  um fluxo de escrow sem rota/regra de negócio comprovada.
- Não foi inspecionado o banco implantado nem foi possível confirmar se todas
  as migrations estão aplicadas. Credenciais, URLs, webhook, envio de e-mail e
  comportamento de produção dependem de validação operacional.

No DER, os rótulos `TEXT_ARRAY`, `DECIMAL_10_2`, `DOUBLE`, `TIMESTAMP` e
`JSONB` representam, respectivamente, PostgreSQL `TEXT[]`, `DECIMAL(10,2)`,
`DOUBLE PRECISION`, `TIMESTAMP(3)` e o tipo PostgreSQL correspondente ao
escalar Prisma `Json`. Os enums usam os nomes de tipos Prisma.

## Visualizar e exportar

### PlantUML (`.puml`)

No VS Code, abra o arquivo com uma extensão de preview PlantUML. A extensão
pode exigir Java e, dependendo do renderer, Graphviz. Para exportar localmente
com PlantUML CLI (Java instalado):

```powershell
java -jar plantuml.jar -tpng docs/diagramas/diagrama-de-atividades.puml
java -jar plantuml.jar -tsvg docs/diagramas/diagrama-de-classes.puml
```

### Mermaid (`.mmd`)

Abra o DER em um preview Mermaid do VS Code ou em outro visualizador compatível.
Para exportar em SVG com Mermaid CLI e Node.js:

```powershell
npx -p @mermaid-js/mermaid-cli mmdc -i docs/diagramas/diagrama-de-banco-de-dados.mmd -o docs/diagramas/diagrama-de-banco-de-dados.svg
```

PNG/SVG são saídas opcionais e não foram adicionadas ao repositório.
