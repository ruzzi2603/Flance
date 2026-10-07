import { createHash } from "crypto";
import { GRACE_DAYS, MAX_ANCHOR_DAY } from "../payments/billing/billing-schedule";
import { PLANS, PlanKey } from "../payments/plans.config";

export const SUBSCRIPTION_CONTRACT_KEY = "SUBSCRIPTION_TERMS";
/**
 * Mude esta versão SEMPRE que alterar o texto das cláusulas abaixo.
 * (O hash também muda sozinho se preços/dia de cobrança mudarem.)
 */
export const SUBSCRIPTION_CONTRACT_VERSION = "2026-10-05.1";

export interface ContractSection {
  id: string;
  title: string;
  paragraphs: string[];
}

export interface SubscriptionContract {
  key: string;
  version: string;
  hash: string;
  title: string;
  effectiveDate: string;
  company: { legalName: string; cnpj: string; address: string; supportEmail: string; privacyEmail: string };
  plans: Array<{ key: string; name: string; price: number; description: string }>;
  sections: ContractSection[];
}

const brl = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;

export function getCompanyInfo() {
  const supportEmail =
    process.env.COMPANY_SUPPORT_EMAIL?.trim() || process.env.SMTP_FROM?.trim() || "[E-MAIL DE SUPORTE - PREENCHER]";
  return {
    legalName: process.env.COMPANY_LEGAL_NAME?.trim() || "[RAZÃO SOCIAL DA FLANCE - PREENCHER]",
    cnpj: process.env.COMPANY_CNPJ?.trim() || "[CNPJ - PREENCHER]",
    address: process.env.COMPANY_ADDRESS?.trim() || "[ENDEREÇO - PREENCHER]",
    supportEmail,
    // Encarregado (DPO) – art. 41 da LGPD. Se não houver e-mail próprio, usa o de suporte.
    privacyEmail: process.env.COMPANY_PRIVACY_EMAIL?.trim() || supportEmail,
  };
}

export function buildSubscriptionContract(): SubscriptionContract {
  const company = getCompanyInfo();
  const paidPlans = [PLANS[PlanKey.PROFESSIONAL], PLANS[PlanKey.PROFESSIONAL_PLUS]];
  const planList = paidPlans
    .map((p) => `${p.name}: ${brl(p.price)} por mês (até ${p.maxAds} anúncios, ${p.maxPhotos} fotos, ${p.featuredAds} destaque(s)${p.prioritySearch ? ", prioridade nas buscas" : ""}).`);

  const sections: ContractSection[] = [
    {
      id: "partes",
      title: "1. Partes e aceite eletrônico",
      paragraphs: [
        `Este contrato é firmado entre ${company.legalName}, inscrita no CNPJ sob o nº ${company.cnpj}, com sede em ${company.address} ("Flance"), e a pessoa física ou jurídica que o aceita na plataforma ("Assinante").`,
        "O Assinante declara ter lido e concordado com este contrato ao marcar a opção de aceite antes de gerar o primeiro pagamento. O aceite eletrônico tem validade jurídica e é registrado com data, hora, endereço IP, navegador e versão exata do texto aceito.",
      ],
    },
    {
      id: "objeto",
      title: "2. Objeto e planos",
      paragraphs: [
        "O contrato tem por objeto a assinatura mensal de um plano pago da plataforma Flance, que amplia os recursos de divulgação da empresa do Assinante. Os planos pagos disponíveis são:",
        ...planList,
        "Os recursos de cada plano são os informados na página de planos no momento da contratação.",
      ],
    },
    {
      id: "cobranca",
      title: "3. Preço, mensalidade e vencimento",
      paragraphs: [
        "A mensalidade é cobrada pelo valor do plano contratado, uma vez por mês, sempre no mesmo dia do mês.",
        "O primeiro pagamento é feito na contratação, no valor cheio do plano (sem cobrança proporcional), e dá direito ao primeiro mês, contado da data em que o plano é ativado.",
        `A renovação vence no mesmo dia do mês em que o plano foi ativado. Exemplo: plano ativado em 2 de outubro vale até 2 de novembro, e a mensalidade vence todo dia 2. Para ativações nos dias 29, 30 ou 31, a renovação ocorre todo dia ${MAX_ANCHOR_DAY}, porque nem todo mês tem esses dias.`,
        "O valor, o primeiro mês e o dia da renovação são exibidos antes da geração do Pix e fazem parte do aceite. A data exata é confirmada na ativação do plano.",
        "Não são cobrados juros, multa ou taxas adicionais do Assinante pelo atraso.",
      ],
    },
    {
      id: "pagamento",
      title: "4. Forma de pagamento",
      paragraphs: [
        "Os pagamentos são feitos exclusivamente por Pix, processados pela instituição de pagamento Asaas. O Pix não é um débito automático: a cada mês será gerada uma cobrança Pix, e o Assinante deve pagá-la até o vencimento.",
        `A cobrança do mês é gerada com antecedência pelo Asaas e a Flance avisa o Assinante por e-mail quando está perto do vencimento. A cobrança também fica disponível na página "Minha assinatura", e pode ser paga antes do vencimento sem perda de dias. A ausência do aviso por e-mail não isenta o Assinante do pagamento.`,
        "Os direitos do cliente, as regras de reembolso, a contestação de cobranças e as medidas de proteção contra fraude estão na Política de Pagamentos, disponível em /pagamentos, que integra este contrato.",
      ],
    },
    {
      id: "ativacao",
      title: "5. Ativação do plano",
      paragraphs: [
        "Após a confirmação do primeiro pagamento, a Flance envia um código de ativação de 6 dígitos ao e-mail cadastrado, válido por 30 minutos. O plano é ativado quando o Assinante informa o código. O código pode ser reenviado na própria plataforma.",
        "O pagamento de cada mensalidade renova o plano por mais um mês, sem novo código.",
      ],
    },
    {
      id: "vigencia",
      title: "6. Vigência e renovação",
      paragraphs: [
        "O contrato vigora por prazo indeterminado, com períodos mensais renovados enquanto o Assinante pagar a mensalidade e não cancelar.",
      ],
    },
    {
      id: "atraso",
      title: "7. Atraso e suspensão",
      paragraphs: [
        `Se a mensalidade não for paga até o vencimento, o Assinante mantém o plano por mais ${GRACE_DAYS} dias. Passado esse prazo sem pagamento, o plano pago é encerrado, a conta retorna ao plano gratuito e a cobrança mensal é cancelada.`,
        "Os dados do Assinante não são apagados pelo encerramento do plano; apenas os recursos exclusivos do plano pago deixam de estar disponíveis.",
      ],
    },
    {
      id: "cancelamento",
      title: "8. Cancelamento",
      paragraphs: [
        'O Assinante pode cancelar a renovação a qualquer momento, sem multa, na página "Minha assinatura". O cancelamento interrompe as cobranças futuras e o plano segue ativo até o fim do período já pago.',
        "Não há reembolso proporcional de períodos já utilizados, ressalvado o direito de arrependimento da cláusula seguinte.",
      ],
    },
    {
      id: "arrependimento",
      title: "9. Direito de arrependimento",
      paragraphs: [
        `Por ser uma contratação a distância, o Assinante pode desistir em até 7 (sete) dias contados da contratação (art. 49 do Código de Defesa do Consumidor), com devolução integral do valor pago pelo mesmo meio de pagamento. Basta solicitar pelo e-mail ${company.supportEmail}.`,
      ],
    },
    {
      id: "reajuste",
      title: "10. Reajuste de preços",
      paragraphs: [
        "A Flance poderá reajustar os preços mediante aviso por e-mail com, no mínimo, 30 dias de antecedência. O novo valor só vale para cobranças posteriores ao aviso, e o Assinante pode cancelar antes de ele entrar em vigor.",
      ],
    },
    {
      id: "uso",
      title: "11. Uso adequado da plataforma",
      paragraphs: [
        "O Assinante é responsável pela veracidade das informações e pelo conteúdo que publica, e se compromete a usar a plataforma conforme a lei e os Termos de Uso. A Flance pode suspender recursos em caso de violação, garantido o contraditório sempre que possível.",
        "A Flance é uma plataforma de divulgação e conexão. Não é parte nas negociações entre usuários e não garante resultados comerciais.",
      ],
    },
    {
      id: "dados",
      title: "12. Dados pessoais (LGPD)",
      paragraphs: [
        "Para a cobrança, a Flance trata nome, e-mail e CPF do Assinante, com base na execução deste contrato e no cumprimento de obrigações legais (Lei 13.709/2018). O CPF é armazenado de forma criptografada.",
        "Esses dados são compartilhados com a Asaas, instituição de pagamento, apenas para emitir e conciliar as cobranças. O Assinante pode exercer seus direitos de titular (acesso, correção, eliminação, entre outros) pelo e-mail " + company.privacyEmail + ". O tratamento de dados está detalhado na Política de Privacidade, disponível em /privacidade.",
        "Os registros de aceite deste contrato e de pagamento são mantidos pelo prazo necessário ao cumprimento de obrigações legais e à defesa em processos.",
      ],
    },
    {
      id: "alteracoes",
      title: "13. Alterações deste contrato",
      paragraphs: [
        "A Flance pode alterar este contrato mediante aviso prévio de 30 dias por e-mail. Alterações que reduzam direitos do Assinante dependem de novo aceite, e o Assinante pode cancelar sem ônus caso não concorde.",
      ],
    },
    {
      id: "foro",
      title: "14. Foro",
      paragraphs: [
        "Aplica-se a lei brasileira. Fica eleito o foro do domicílio do Assinante quando este for consumidor, e o foro da sede da Flance nos demais casos.",
      ],
    },
  ];

  const base = {
    key: SUBSCRIPTION_CONTRACT_KEY,
    version: SUBSCRIPTION_CONTRACT_VERSION,
    title: "Contrato de Assinatura de Plano Flance",
    effectiveDate: SUBSCRIPTION_CONTRACT_VERSION.slice(0, 10),
    company,
    plans: paidPlans.map((p) => ({ key: p.key, name: p.name, price: p.price, description: p.description })),
    sections,
  };

  const hash = createHash("sha256").update(JSON.stringify(base)).digest("hex");
  return { ...base, hash };
}
