# Proteção da Flance: pagamentos, direitos do cliente e LGPD (documento INTERNO)

> Modelo operacional para a equipe. **Não é parecer jurídico.** Os prazos e textos marcados com ⚖️ devem ser
> confirmados por um advogado antes de publicar. Mantém coerência com `/contrato`, `/pagamentos` e `/privacidade`.

## 1. O que está público e onde

| Documento | Rota | Fonte no código | Versão |
|---|---|---|---|
| Contrato de Assinatura (aceite obrigatório) | `/contrato` | `apps/api/src/modules/contracts/subscription-contract.ts` | `SUBSCRIPTION_CONTRACT_VERSION` |
| Política de Pagamentos e Direitos do Cliente | `/pagamentos` | `apps/web/src/lib/legal/payment-policy.ts` | `PAYMENT_POLICY_VERSION` |
| Política de Privacidade (LGPD) | `/privacidade` | `apps/web/src/lib/legal/privacy-policy.ts` | `PRIVACY_POLICY_VERSION` |
| Meus dados (exportar / excluir conta) | `/meus-dados` | `apps/web/src/app/meus-dados/page.tsx` + `apps/api/src/modules/privacy/` | — |
| Termos de Uso | `/termos` | `apps/web/src/app/termos/page.tsx` | — |

**Regra de ouro:** se mudar preço, dia de cobrança, tolerância, prazo de reembolso, dado coletado ou fornecedor,
atualize os três textos **e a versão**. Mudança que reduza direitos do cliente exige novo aceite e aviso de 30 dias.

## 2. Evidências que protegem a Flance (e como obtê-las)

| Prova | Onde fica | O que demonstra |
|---|---|---|
| Aceite do contrato | tabela `ContractAcceptance` | Quem aceitou, quando, de qual IP/navegador, qual texto exato (`contractSnapshot`) e hash |
| Pagamento | tabela `Payment` (+ painel Asaas) | Valor, data, status, ID da cobrança no Asaas |
| Período e renovações | tabela `Subscription` + `Payment` (`kind=RECURRING`) | Plano, vigência, mensalidades geradas pelo Asaas e pagas, cancelamento (`canceledAt`) |
| Ativação do plano | `Payment.subscriptionId` + `PaymentActivationCode.usedAt` | Que o cliente digitou o código enviado ao e-mail dele |
| Eventos do Asaas | tabela `PaymentWebhookEvent` | Linha do tempo dos avisos do provedor |
| Ações administrativas | tabela `AdminAuditLog` | Quem moderou/excluiu, quando e por quê |

Consulta rápida do dossiê de um cliente (substitua o e-mail):

```sql
SELECT u.email, ca."acceptedAt", ca."contractVersion", ca."contractHash", ca."ipAddress", ca."userAgent",
       p.id AS payment_id, p.kind, p.amount, p.status, p."paidAt", p."providerPaymentId"
FROM "User" u
LEFT JOIN "ContractAcceptance" ca ON ca."userId" = u.id
LEFT JOIN "Payment" p ON p."userId" = u.id
WHERE u.email = 'cliente@email.com'
ORDER BY p."createdAt";
```

O texto aceito pode ser reexibido ao cliente em `/contrato?view=accepted` (usa o snapshot, não o texto atual).

**Retenção:** pagamentos, assinaturas e aceites ficam **5 anos** após o fim da relação ⚖️. Desde a migration
`20261003120000_retain_payment_evidence` o banco **impede** apagá-los junto com o usuário.

## 3. Procedimentos de atendimento (SLA prometido ao cliente)

### 3.1 Arrependimento (7 dias corridos da contratação, art. 49 CDC)
1. Confirmar que o pedido veio do e-mail da conta e que está dentro de 7 dias da **primeira** contratação. **Prazo de resposta: 3 dias úteis.**
2. Devolver o valor **integral** pelo Pix, no painel do Asaas (estorno da cobrança).
3. Encerrar o plano: o webhook `PAYMENT_REFUNDED` marca o pagamento, mas **não revoga o plano**. Fazer manualmente:
   cancelar a renovação do cliente (ele mesmo em "Minha assinatura" ou via banco: `Subscription.status='CANCELED'`,
   `User.planTier='FREE'`) e cancelar no Asaas a assinatura e a mensalidade pendente, se houver.
4. Registrar o atendimento (data, solicitante, decisão). **Devolução em até 10 dias úteis após a análise.**

### 3.2 Cobrança indevida, duplicada ou valor errado
1. Pedir o comprovante do Pix; conferir `Payment` e o painel do Asaas.
2. Confirmado o erro: estornar o excedente. Resposta em **até 10 dias úteis**. Se a lei exigir devolução em dobro (CDC art. 42, parágrafo único), seguir o advogado ⚖️.
3. Causa raiz: se foi bug, corrigir e registrar.

### 3.3 Contestação / devolução de Pix por suspeita de fraude (MED)
1. Suspender o plano (não excluir dados) até apurar.
2. Reunir o dossiê da seção 2 (aceite, IP, código de ativação usado, uso do plano).
3. Responder ao Asaas/banco com as provas dentro do prazo deles. Se o titular alegar fraude e a prova mostrar uso legítimo, manter a cobrança.
4. Se a fraude for real (CPF de terceiro, etc.): devolver ao titular, cancelar a conta e guardar as provas.

### 3.4 Cancelamento pedido por e-mail
Cancelar pelo banco/painel e confirmar por e-mail. O plano segue até o fim do período pago.

## 4. LGPD: pedidos dos titulares (prazo: resposta completa em até 15 dias, art. 19)

**Autoatendimento (`/meus-dados`)**, com reautenticação por senha:
- `POST /v1/privacy/export`: JSON com conta, perfil, cobranças, contratos aceitos e atividade (CPF mascarado; sem hashes/tokens; sem mensagens recebidas de terceiros).
- `POST /v1/privacy/delete-account` (senha + palavra `EXCLUIR`): exclui ou anonimiza (regra abaixo) e encerra a sessão. Administradores não podem se excluir por aqui.

Para o que não é autoatendimento (oposição, correção que o titular não consiga fazer, dúvidas), o canal é o e-mail do Encarregado (`COMPANY_PRIVACY_EMAIL`). **Confirmar identidade** (pedido do e-mail cadastrado) antes de agir.
Registrar cada pedido (data, direito, decisão, data da resposta) numa planilha.

| Direito (art. 18) | Como executar |
|---|---|
| Confirmação e acesso | Autoatendimento em `/meus-dados` (exportação JSON). Por e-mail: usar a mesma exportação (`PrivacyService.exportData`) |
| Correção | Corrigir o campo em `User` (cadastro/perfil/empresa) |
| Eliminação | **Sem histórico financeiro:** exclusão total. **Com histórico:** anonimização (ver abaixo) e manutenção das provas por 5 anos |
| Portabilidade | O mesmo JSON da exportação |
| Revogar consentimento | Cookies: o titular altera em "Gerenciar cookies". Outros: apagar o dado que dependia do consentimento |
| Informação sobre compartilhamento | Responder com a lista da seção 5 da `/privacidade` (Asaas, e-mail, infraestrutura, autoridades) |

**Exclusão de conta** (autoatendimento e admin usam a MESMA lógica, `PrivacyService.eraseUserInTransaction`):
sem histórico financeiro → exclusão total. Com histórico → **anonimização**: apaga conteúdo (mensagens, conversas,
avaliações, vagas, propostas, selos, estatísticas) e credenciais; troca nome/e-mail/CPF/perfil/empresa por valores
neutros; cancela Pix pendentes; encerra o plano e cancela a assinatura e a mensalidade pendente no Asaas. Fica só o que a lei exige
(pagamentos, assinaturas, aceites). Nunca use `DELETE` direto na tabela `User`.

## 5. Incidente de segurança (vazamento, acesso indevido)
1. **Conter:** revogar chaves (Asaas, JWT, SMTP, banco), invalidar sessões, isolar o problema.
2. **Avaliar:** quais dados, quantos titulares, risco de dano (CPF e e-mail são dados pessoais; senhas e CPF estão protegidos por hash/criptografia).
3. **Comunicar** a ANPD e os titulares afetados quando houver risco ou dano relevante. Prazo regulamentado: **3 dias úteis** (Resolução CD/ANPD nº 15/2024) ⚖️ confirmar.
4. **Registrar** o incidente, as medidas e as lições. Atualizar a `/privacidade` se mudar algo.

## 5.1 Retenção automática (`RetentionService`, 1x por dia)
Apaga: tokens de sessão vencidos há 30 dias; recuperações de senha vencidas há 7; códigos de ativação **não usados**
vencidos há 30 dias (os usados ficam: provam a ativação); eventos de webhook com mais de 5 anos; nomes/e-mails em logs
de moderação com mais de 5 anos (viram `[removido]`); e **contas anonimizadas cujo último registro financeiro tem mais de 5 anos**
(aí apaga também pagamentos, assinaturas e aceites). Prazos em `apps/api/src/modules/privacy/retention-policy.ts`
(devem bater com a seção 8 da `/privacidade`). Desligar: `RETENTION_JOB_DISABLED=true`. O resultado de cada execução fica no log da API.

## 6. Rotina (calendário)
- **Mensal:** conferir se `npm run payments:check` continua verde em produção; revisar webhooks falhos no painel do Asaas; conferir no log que a rotina de retenção rodou (`Rotina de retenção concluída`).
- **Trimestral:** revisar fornecedores (item 5 da `/privacidade`) e se algum novo dado passou a ser coletado.
- **Anual:** revisão jurídica dos quatro textos; teste de restauração e do plano de incidente; eliminar o que passou da retenção.

## 7. Pendências conhecidas (honestidade técnica)
- **`PAYMENT_REFUNDED` não revoga o plano** automaticamente (seção 3.1, passo 3).
- **Stripe e OpenAI** aparecem apenas em configuração. Se passarem a ser usados, **atualizar a `/privacidade`** (compartilhamento e transferência internacional).
- **Asaas mantém seus próprios dados** do cliente (nome, CPF, cobranças) por obrigação regulatória; excluir a conta na Flance não apaga o cadastro lá. Isso consta na `/privacidade` (o Asaas também é controlador).
- **Logs de acesso** (arquivos/stdout do servidor) não são tocados pela rotina: configure a retenção na hospedagem para **no mínimo 6 meses** (Marco Civil).
- **Cópias de segurança (backups)** do banco podem conter dados já excluídos até expirarem: defina a rotação (ex.: 30 dias) e documente.
- **Estatísticas de perfis de empresa** só são registradas com o consentimento "analytics" do banner (corrigido nesta versão).
- **Provedor de e-mail:** se continuar em conta Gmail pessoal, trocar por provedor transacional com domínio próprio.
- **Revisão jurídica** pendente de todos os textos e dos prazos marcados com ⚖️.
