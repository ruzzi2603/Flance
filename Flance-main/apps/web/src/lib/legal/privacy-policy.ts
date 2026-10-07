import type { LegalSection } from "./types";

/** Mude ao alterar dados coletados, finalidades ou fornecedores. */
export const PRIVACY_POLICY_VERSION = "2026-10-04.1";
export const PRIVACY_POLICY_UPDATED_AT = "4 de outubro de 2026";

export const PRIVACY_POLICY_INTRO =
  "Esta Política de Privacidade explica, de forma simples, quais dados pessoais a Flance coleta, por que coleta, com quem compartilha, por quanto tempo guarda e como você exerce seus direitos, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 – LGPD).";

export function buildPrivacySections(privacyEmail: string): LegalSection[] {
  return [
    {
      id: "controlador",
      title: "1. Quem é o responsável pelos seus dados",
      paragraphs: [
        "A Flance, identificada no quadro \"Controlador dos dados\" no início desta página, é a controladora dos dados pessoais tratados na plataforma, ou seja, quem decide como e por que eles são usados.",
        `Para qualquer assunto sobre privacidade, inclusive para exercer seus direitos, fale com o nosso Encarregado pelo Tratamento de Dados Pessoais (DPO) pelo e-mail ${privacyEmail}.`,
      ],
    },
    {
      id: "dados",
      title: "2. Quais dados coletamos",
      paragraphs: ["Coletamos apenas o que é necessário para o funcionamento da plataforma:"],
      table: {
        head: ["Categoria", "Dados", "De onde vêm"],
        rows: [
          ["Conta", "Nome, e-mail e senha (guardada somente como hash, nunca em texto aberto), data de cadastro e verificação do e-mail.", "Você, no cadastro."],
          ["Perfil", "Apresentação, título profissional, serviços, foto e necessidades.", "Você, ao preencher o perfil."],
          ["Perfil empresarial (público)", "Nome da empresa, CNPJ, descrição, endereço, cidade/UF, site, Instagram, WhatsApp, e-mail e horário de atendimento, fotos.", "Você, ao ativar o perfil empresarial."],
          ["Pagamento e assinatura", "Nome, e-mail e CPF (guardado criptografado), identificador do seu cadastro no Asaas, valor, status e datas das cobranças, plano contratado.", "Você, no checkout; e o Asaas, ao confirmar pagamentos."],
          ["Aceite do contrato", "Versão e texto do contrato aceito, hash, data e hora, endereço IP e navegador (user-agent).", "Gerado automaticamente quando você aceita o contrato."],
          ["Comunicação", "Mensagens trocadas no chat da plataforma e e-mails transacionais (verificação de conta, código de ativação, avisos de cobrança).", "Você e a Flance."],
          ["Uso da plataforma", "Visualizações e compartilhamentos de perfis de empresas (com identificador de sessão e origem), avaliações, pontos e nível.", "Gerado pelo uso; as estatísticas dependem do seu consentimento (item 7)."],
          ["Técnicos e de segurança", "Endereço IP, tokens de sessão (guardamos apenas o hash do token de renovação) e registros de erros e de acesso.", "Gerado automaticamente."],
        ],
      },
      after: [
        "Não coletamos dados de cartão de crédito: o pagamento é feito por Pix. Também não temos acesso aos seus dados bancários; o Pix é processado pelo seu banco e pelo Asaas.",
        "Não coletamos dados pessoais sensíveis (como saúde, religião ou biometria). Não os informe em mensagens ou perfis.",
      ],
    },
    {
      id: "finalidades",
      title: "3. Para que usamos os dados e em que base legal",
      table: {
        head: ["Finalidade", "Base legal (art. 7º da LGPD)"],
        rows: [
          ["Criar e manter sua conta, exibir seu perfil e permitir o chat.", "Execução de contrato (inciso V)."],
          ["Cobrar a assinatura, emitir o Pix, ativar o plano e enviar avisos de vencimento.", "Execução de contrato (inciso V)."],
          ["Guardar contratos aceitos, pagamentos e registros para fins fiscais, contábeis e legais.", "Cumprimento de obrigação legal (II) e exercício regular de direitos (VI)."],
          ["Prevenir fraudes, abusos e acessos indevidos; limitar requisições; investigar incidentes.", "Legítimo interesse (IX), com avaliação de impacto à sua privacidade."],
          ["Medir visualizações dos perfis de empresas e salvar preferências (idioma e tema).", "Consentimento (I), que você pode dar e retirar quando quiser."],
          ["Responder suas solicitações e dúvidas.", "Execução de contrato (V) e legítimo interesse (IX)."],
        ],
      },
      after: ["Não vendemos seus dados pessoais e não os usamos para decisões automatizadas que produzam efeitos jurídicos sobre você."],
    },
    {
      id: "publico",
      title: "4. O que fica público na plataforma",
      paragraphs: [
        "Quando você ativa o perfil empresarial, as informações da empresa (nome, descrição, localização, contatos, horário e fotos) ficam visíveis para qualquer visitante, inclusive buscadores. Publique apenas o que você quer divulgar.",
        "Seu CPF, e-mail de login, dados de pagamento e histórico de cobranças nunca são exibidos publicamente.",
      ],
    },
    {
      id: "compartilhamento",
      title: "5. Com quem compartilhamos",
      paragraphs: ["Compartilhamos dados somente quando necessário e com quem presta serviço à Flance:"],
      bullets: [
        "Asaas (instituição de pagamento): recebe nome, e-mail e CPF para emitir e conciliar as cobranças Pix. O Asaas também trata esses dados como controlador, para cumprir obrigações regulatórias do sistema financeiro.",
        "Provedor de e-mail: envia os e-mails da plataforma (verificação, código de ativação, cobrança).",
        "Provedores de infraestrutura em nuvem e banco de dados: hospedam a plataforma e os dados, sob contrato e obrigação de confidencialidade.",
        "Outros usuários: o que você publica no perfil público e as mensagens que envia a eles no chat.",
        "Autoridades públicas: quando houver obrigação legal, ordem judicial ou requisição de autoridade competente.",
      ],
      after: ["Se a Flance passar por fusão, venda ou reorganização, os dados poderão ser transferidos ao sucessor, mantidas as garantias desta Política."],
    },
    {
      id: "pagamentos",
      title: "6. Pagamentos e dados financeiros",
      bullets: [
        "O pagamento é feito somente por Pix, pelo aplicativo do seu banco.",
        "O CPF é guardado criptografado (AES-256-GCM) e usado apenas para emitir cobranças.",
        "O código de ativação enviado por e-mail é guardado apenas como hash e expira em 30 minutos.",
        "As regras de cobrança, cancelamento e reembolso estão na Política de Pagamentos (/pagamentos) e no Contrato de Assinatura (/contrato).",
      ],
    },
    {
      id: "cookies",
      title: "7. Cookies e tecnologias semelhantes",
      paragraphs: [
        "Usamos cookies e armazenamento local. Os essenciais não dependem de consentimento; os demais só são usados se você permitir no aviso de cookies. Você pode mudar a escolha a qualquer momento em \"Gerenciar cookies\", no rodapé.",
      ],
      table: {
        head: ["Nome", "Tipo", "Finalidade", "Duração"],
        rows: [
          ["flance_access_token", "Essencial (HttpOnly)", "Manter você autenticado.", "Curta duração (cerca de 1 hora)."],
          ["flance_refresh_token", "Essencial (HttpOnly)", "Renovar a sessão sem novo login.", "Até 7 dias ou até você sair."],
          ["flance_cookie_consent", "Essencial", "Lembrar suas escolhas de cookies.", "1 ano."],
          ["Preferências (idioma e tema)", "Preferências (consentimento)", "Lembrar como você prefere usar a plataforma.", "Até você limpar o navegador."],
          ["flance_analytics_session", "Estatísticas (consentimento)", "Contar visualizações e compartilhamentos de perfis de empresas, sem identificar você pelo nome.", "Até fechar a aba."],
        ],
      },
    },
    {
      id: "retencao",
      title: "8. Por quanto tempo guardamos seus dados",
      table: {
        head: ["Dado", "Prazo"],
        rows: [
          ["Conta, perfil e mensagens", "Enquanto a conta existir. Ao excluir a conta, apagamos esses dados na hora. Se houver histórico de pagamento, a conta é anonimizada e só ficam os registros financeiros abaixo."],
          ["Pagamentos, contratos aceitos e registros de aceite", "5 anos após o fim da relação, para obrigações fiscais e contábeis e para defesa em processos (inclusive o prazo do Código de Defesa do Consumidor)."],
          ["Registros de acesso à aplicação", "No mínimo 6 meses, conforme o Marco Civil da Internet (Lei nº 12.965/2014)."],
          ["Estatísticas de visualização de perfis", "Enquanto o perfil da empresa existir."],
          ["Códigos de verificação e ativação, tokens de sessão", "Apenas pelo tempo de validade (minutos ou dias) e depois deixam de ter uso."],
        ],
      },
      after: ["Uma rotina automática diária apaga os dados cujo prazo terminou (sessões e códigos vencidos, eventos técnicos de pagamento e registros financeiros de contas já anonimizadas), de forma que não identifiquem mais você."],
    },
    {
      id: "direitos",
      title: "9. Seus direitos como titular",
      paragraphs: ["Você pode pedir, a qualquer momento e sem custo (art. 18 da LGPD):"],
      bullets: [
        "confirmação de que tratamos seus dados e acesso a eles;",
        "correção de dados incompletos, inexatos ou desatualizados;",
        "anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados fora da lei;",
        "portabilidade dos dados a outro fornecedor, mediante requisição;",
        "eliminação dos dados tratados com base no seu consentimento;",
        "informação sobre com quem compartilhamos seus dados;",
        "informação sobre a possibilidade de não consentir e as consequências;",
        "revogação do consentimento, quando for essa a base legal.",
      ],
      after: [
        "Em autoatendimento: na página Meus dados (/meus-dados), com a sua senha, você baixa uma cópia dos seus dados (acesso e portabilidade) e exclui a sua conta na hora.",
        "Para os demais direitos (correção que você não consiga fazer no perfil, oposição, dúvidas), envie e-mail ao Encarregado (contato no início da página) a partir do e-mail cadastrado. Podemos pedir informações para confirmar que é você, para proteger seus dados contra pedidos de terceiros.",
        "Prazo: confirmamos o recebimento de imediato e respondemos de forma completa em até 15 dias, como determina o art. 19 da LGPD.",
        "Limites: alguns dados precisam ser mantidos por obrigação legal (por exemplo, registros de pagamento e do aceite do contrato). Nesses casos explicamos o motivo e o prazo de guarda.",
        "Reclamação: se não ficar satisfeito, você pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD) em gov.br/anpd.",
      ],
    },
    {
      id: "seguranca",
      title: "10. Como protegemos seus dados",
      bullets: [
        "Conexão criptografada (HTTPS) e cookies de sessão com HttpOnly e SameSite.",
        "Senhas guardadas apenas como hash; CPF criptografado; códigos de ativação e tokens de renovação guardados apenas como hash.",
        "Webhooks do provedor de pagamento autenticados por token, com conferência de valor e cliente diretamente no Asaas antes de liberar qualquer plano.",
        "Limite de requisições, registro de erros e acesso restrito ao banco de dados.",
      ],
      after: ["Nenhum sistema é totalmente imune a falhas. Se ocorrer um incidente que possa causar risco ou dano relevante a você, comunicaremos você e a ANPD nos prazos e na forma da lei."],
    },
    {
      id: "internacional",
      title: "11. Transferência internacional",
      paragraphs: [
        "Alguns provedores de nuvem e e-mail podem armazenar ou processar dados fora do Brasil. Nesses casos, exigimos garantias adequadas de proteção, conforme o art. 33 da LGPD.",
      ],
    },
    {
      id: "menores",
      title: "12. Crianças e adolescentes",
      paragraphs: [
        "A plataforma é destinada a maiores de 18 anos e não coleta intencionalmente dados de crianças e adolescentes. Se identificarmos uma conta de menor, ela poderá ser encerrada e os dados eliminados.",
      ],
    },
    {
      id: "alteracoes",
      title: "13. Alterações desta política",
      paragraphs: [
        "Podemos atualizar esta Política para refletir mudanças na plataforma ou na lei. A data e a versão no topo da página mostram a última atualização. Mudanças relevantes serão avisadas por e-mail ou na plataforma.",
      ],
    },
  ];
}
