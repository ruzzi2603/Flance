import type { LegalSection } from "./types";

/** Mude ao alterar regras de cobrança, prazos ou reembolso (e mantenha coerente com o contrato). */
export const PAYMENT_POLICY_VERSION = "2026-10-05.1";
export const PAYMENT_POLICY_UPDATED_AT = "5 de outubro de 2026";

export const PAYMENT_POLICY_INTRO =
  "Esta política resume, em linguagem direta, como funciona a cobrança dos planos pagos da Flance, quais são os seus direitos como cliente e como a Flance se protege de fraudes e usos indevidos. Ela complementa o Contrato de Assinatura (/contrato), que você aceita antes do primeiro pagamento. Em caso de divergência, vale a regra mais favorável ao consumidor, nos termos do Código de Defesa do Consumidor.";

const brl = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;

export function buildPaymentSections(
  plans: Array<{ name: string; price: number }> | null,
  supportEmail: string,
): LegalSection[] {
  const planRows = (plans ?? []).map((plan) => [plan.name, `${brl(plan.price)} por mês`]);

  return [
    {
      id: "resumo",
      title: "1. Resumo",
      bullets: [
        "Pagamento por Pix. Não pedimos nem guardamos dados de cartão.",
        "Você paga o valor cheio do plano ao contratar e a mensalidade vence todo mês, no mesmo dia do mês em que o plano foi ativado. Não há cobrança proporcional.",
        "O Pix não é débito automático: todo mês você recebe um novo Pix e paga até o vencimento.",
        "Você cancela a renovação quando quiser, sem multa, em \"Minha assinatura\".",
        "Você pode desistir em até 7 dias da contratação e receber o valor integral de volta.",
        "Não cobramos juros nem multa por atraso.",
      ],
    },
    {
      id: "valores",
      title: "2. Planos e valores",
      paragraphs: [
        planRows.length
          ? "Valores vigentes dos planos pagos (os mesmos exibidos na página de planos e no contrato):"
          : "Os valores vigentes dos planos pagos estão na página de planos e no Contrato de Assinatura.",
      ],
      table: planRows.length ? { head: ["Plano", "Mensalidade"], rows: planRows } : undefined,
      after: ["O valor é sempre definido pelo servidor da Flance no momento da cobrança. Você vê o valor exato antes de gerar o Pix e antes de aceitar o contrato."],
    },
    {
      id: "cobranca",
      title: "3. Como a cobrança funciona",
      bullets: [
        "Primeiro pagamento: você paga o valor cheio do plano e tem direito ao primeiro mês, contado da ativação do plano. Não há cobrança proporcional.",
        "Mensalidades seguintes: vencem todo mês, no mesmo dia do mês da ativação (para ativações nos dias 29, 30 ou 31, no dia 28). O Asaas gera a cobrança com antecedência; ela fica disponível em \"Minha assinatura\" e é enviada por e-mail, com lembrete antes do vencimento.",
        "Pagamento antecipado: você pode pagar a mensalidade assim que ela estiver disponível. Não perde dias: o novo mês começa quando o atual termina.",
      ],
      after: [
        "Exemplo: você contrata um plano de R$ 29,99 e ativa em 2 de outubro. Ele vale até 2 de novembro e a mensalidade de R$ 29,99 vence em 2 de novembro, depois em 2 de dezembro, e assim por diante.",
      ],
    },
    {
      id: "pix",
      title: "4. Pagamento por Pix e segurança",
      bullets: [
        "O Pix é gerado e processado pelo Asaas, instituição de pagamento. A Flance não tem acesso às suas credenciais bancárias.",
        "Pague somente por Pix gerado dentro da plataforma (checkout ou \"Minha assinatura\") ou pelo link enviado por e-mail pela Flance.",
        "A Flance nunca pede pagamento por WhatsApp, redes sociais, transferência para conta pessoal ou chave Pix avulsa. Desconfie e avise-nos.",
        "Confira o beneficiário e o valor no aplicativo do banco antes de confirmar.",
      ],
    },
    {
      id: "ativacao",
      title: "5. Confirmação e ativação do plano",
      paragraphs: [
        "Após a confirmação do primeiro Pix, enviamos um código de 6 dígitos ao seu e-mail, válido por 30 minutos. O plano é ativado quando você informa o código. Se o código expirar ou o e-mail não chegar, peça um novo na própria página; o pagamento não se perde.",
        "O pagamento de cada mensalidade renova o plano por mais um mês, sem novo código.",
        "O pagamento só é considerado quando confirmado pelo Asaas. Em geral isso leva segundos, mas pode demorar por falhas da rede bancária, fora do controle da Flance.",
      ],
    },
    {
      id: "atraso",
      title: "6. Atraso no pagamento",
      bullets: [
        "Se a mensalidade não for paga até o vencimento, você mantém o plano por mais 3 dias e recebe um aviso por e-mail.",
        "Passado esse prazo sem pagamento, o plano pago é encerrado e a conta volta ao plano gratuito. A cobrança recorrente é cancelada.",
        "Seus dados, perfil e conversas são mantidos. Apenas os recursos exclusivos do plano pago deixam de estar disponíveis.",
        "Você pode assinar novamente quando quiser.",
      ],
    },
    {
      id: "cancelamento",
      title: "7. Cancelamento",
      bullets: [
        "Cancele a renovação a qualquer momento em \"Minha assinatura\". Não há multa nem taxa.",
        "O cancelamento impede novas cobranças. O plano continua ativo até o fim do período que você já pagou.",
        "Antes do fim do período, você pode reativar a renovação.",
        "Não precisa falar com ninguém para cancelar. Se tiver dificuldade, escreva para o suporte e cancelamos para você.",
      ],
    },
    {
      id: "arrependimento",
      title: "8. Direito de arrependimento e reembolso",
      bullets: [
        "Em até 7 dias corridos da contratação, você pode desistir sem justificar e recebe o valor integral pago (art. 49 do Código de Defesa do Consumidor).",
        "Como pedir: e-mail para o suporte, a partir do e-mail cadastrado, informando que deseja exercer o arrependimento.",
        `Prazo: respondemos em até 3 dias úteis e devolvemos o valor pelo mesmo meio de pagamento (Pix) em até 10 dias úteis após a análise. Contato: ${supportEmail}.`,
        "A devolução encerra o plano e a cobrança recorrente.",
      ],
      after: [
        "Depois dos 7 dias, não há devolução proporcional de períodos já utilizados, mas você tem direito à devolução nos casos de cobrança indevida (item 9) ou de falha do serviço atribuível à Flance, nos termos da lei.",
      ],
    },
    {
      id: "indevida",
      title: "9. Cobrança indevida, duplicada ou com valor errado",
      bullets: [
        "Se você foi cobrado em duplicidade, por valor diferente do informado ou depois de cancelar, avise o suporte com o comprovante.",
        "Analisamos em até 10 dias úteis e, confirmada a cobrança indevida, devolvemos o valor pago a mais. Se a lei assegurar devolução em dobro, ela será observada.",
        "Se o erro for da Flance, não há custo para você.",
      ],
    },
    {
      id: "reajuste",
      title: "10. Reajuste de preços",
      paragraphs: [
        "Qualquer reajuste é avisado por e-mail com, no mínimo, 30 dias de antecedência e só vale para cobranças posteriores ao aviso. Você pode cancelar antes de ele entrar em vigor.",
      ],
    },
    {
      id: "direitos",
      title: "11. Seus direitos como cliente",
      bullets: [
        "Informação clara sobre preço, vencimento, forma de pagamento e renovação, antes de pagar.",
        "Cancelamento fácil, a qualquer momento, sem multa.",
        "Arrependimento em 7 dias, com reembolso integral.",
        "Proteção dos seus dados pessoais (veja a Política de Privacidade em /privacidade).",
        "Atendimento e resposta às suas reclamações.",
        "Acesso ao texto do contrato que você aceitou, a qualquer momento, em \"Minha assinatura\".",
      ],
      after: [
        "Se não ficar satisfeito com a resposta, você pode procurar o Procon da sua cidade ou a plataforma consumidor.gov.br.",
      ],
    },
    {
      id: "protecao",
      title: "12. Proteção da Flance contra fraude e uso indevido",
      paragraphs: [
        "Para manter a plataforma segura para todos, e sempre dentro dos limites da lei, a Flance pode:",
      ],
      bullets: [
        "Recusar, suspender ou cancelar uma contratação quando houver indícios razoáveis de fraude, uso de CPF ou dados de terceiros sem autorização, ou pagamento originado de atividade ilícita. Nesses casos, valores pagos de boa-fé serão devolvidos, descontados apenas o que a lei permitir.",
        "Suspender recursos do plano em caso de violação grave dos Termos de Uso, após comunicar o motivo e permitir sua manifestação, salvo risco imediato a terceiros.",
        "Suspender o plano quando o Pix for devolvido, estornado ou contestado junto ao banco (inclusive pelo Mecanismo Especial de Devolução do Pix) até a apuração do caso.",
        "Guardar e apresentar, quando necessário para sua defesa ou por ordem de autoridade, os registros do pagamento e do aceite do contrato (data, hora, IP, navegador e texto aceito).",
        "Recusar pedidos que usem o direito de arrependimento ou a contestação de má-fé, como contestar um pagamento que o próprio titular realizou e usou.",
      ],
      after: [
        "A Flance não responde por falhas de terceiros fora do seu controle, como indisponibilidade do banco, do Asaas ou da internet. Isso não afasta a responsabilidade que a lei atribui à Flance pelos serviços que presta, nem os seus direitos de consumidor.",
        "Você é responsável por informar dados verdadeiros e por usar apenas CPF e meios de pagamento próprios, ou que você tenha autorização para usar.",
      ],
    },
    {
      id: "dados",
      title: "13. Dados pessoais no pagamento",
      paragraphs: [
        "Para cobrar, tratamos seu nome, e-mail e CPF (guardado criptografado), compartilhados com o Asaas apenas para emitir e conciliar as cobranças. Guardamos os registros de pagamento e do aceite do contrato por 5 anos após o fim da relação, por obrigação legal e para defesa em processos. Detalhes e seus direitos de titular estão na Política de Privacidade (/privacidade).",
      ],
    },
    {
      id: "contato",
      title: "14. Atendimento",
      paragraphs: [
        `Dúvidas, reembolso, cobrança indevida ou cancelamento assistido: ${supportEmail}. Informe o e-mail da conta e, se possível, o comprovante do Pix.`,
      ],
    },
  ];
}
