"use client";

import { useI18n } from "../../i18n/useI18n";

type TermsSection = {
  title: string;
  paragraphs: string[];
};

type TermsContent = {
  pageTitle: string;
  updatedAt: string;
  intro: string;
  sections: TermsSection[];
  rightsTitle: string;
  rightsParagraphs: string[];
  contactTitle: string;
  contactText: string;
};

const contentByLocale: Record<"pt-BR" | "en-US", TermsContent> = {
  "pt-BR": {
    pageTitle: "Termos de Uso",
    updatedAt: "Ultima atualizacao: 20 de abril de 2026",
    intro:
      "Ao utilizar a plataforma Flance, voce concorda com estes Termos de Uso. Este documento descreve as regras para uso da plataforma, publicacao de perfis empresariais, comunicacao por chat e contratacao de planos.",
    sections: [
      {
        title: "1. Objeto da plataforma",
        paragraphs: [
          "A Flance e um diretorio digital para empresas, microempresas e prestadores de servicos divulgarem seus perfis profissionais, com informacoes de contato, especialidades, localizacao e portifolio de imagens.",
          "A plataforma tambem oferece recursos de comunicacao direta entre usuarios e empresas por meio de chat interno.",
        ],
      },
      {
        title: "2. Conta e responsabilidade do usuario",
        paragraphs: [
          "Para utilizar recursos completos, o usuario deve criar uma conta com informacoes verdadeiras e atualizadas.",
          "O titular da conta e responsavel por manter a confidencialidade de sua senha e por toda atividade realizada em seu acesso.",
          "A Flance podera limitar, suspender ou encerrar contas em caso de uso indevido, fraude, tentativa de invasao, publicacao enganosa ou violacao destes termos.",
        ],
      },
      {
        title: "3. Publicacao de perfis empresariais",
        paragraphs: [
          "Empresas e prestadores podem publicar seus perfis conforme os limites do plano contratado, incluindo plano gratuito de teste.",
          "As informacoes publicadas devem ser legitimas, nao infrigir direitos de terceiros e respeitar a legislacao aplicavel.",
          "A Flance pode remover ou ajustar conteudos que violem estes termos, sem aviso previo, quando necessario para seguranca da plataforma e dos usuarios.",
        ],
      },
      {
        title: "4. Planos, cobranca e disponibilidade",
        paragraphs: [
          "A plataforma pode oferecer plano gratuito e planos pagos recorrentes, com valores e beneficios exibidos na pagina de planos.",
          "Valores, funcionalidades e limites podem ser atualizados mediante publicacao na plataforma.",
          "A indisponibilidade temporaria por manutencao, atualizacao tecnica ou fatores externos nao gera direito automatico a indenizacao.",
        ],
      },
      {
        title: "5. Comunicacao por chat",
        paragraphs: [
          "O chat e disponibilizado para contato profissional entre usuarios e empresas cadastradas.",
          "E proibido o uso do chat para spam, fraude, assedio, conteudo ofensivo, coleta ilicita de dados ou qualquer pratica contraria a lei.",
          "Mensagens podem ser registradas para fins de seguranca, auditoria tecnica e prevencao de abuso, respeitando a politica de privacidade aplicavel.",
        ],
      },
      {
        title: "6. Privacidade e seguranca",
        paragraphs: [
          "A Flance adota medidas tecnicas e organizacionais para proteger dados e sessoes de acesso.",
          "Nenhum sistema e totalmente imune a falhas; por isso, o usuario concorda em utilizar a plataforma com boas praticas de seguranca.",
          "Solicitacoes de redefinicao de senha e autenticacao devem ser feitas somente pelos canais oficiais da plataforma.",
        ],
      },
      {
        title: "7. Limitacao de responsabilidade",
        paragraphs: [
          "A Flance nao atua como parte contratante dos servicos negociados entre usuarios e empresas, sendo uma intermediadora de visibilidade e contato.",
          "A responsabilidade por escopo, preco, prazo, qualidade e cumprimento de acordos e das partes envolvidas na contratacao.",
          "Sempre que permitido por lei, a responsabilidade da Flance fica limitada aos servicos efetivamente prestados na plataforma.",
        ],
      },
      {
        title: "8. Alteracoes destes termos",
        paragraphs: [
          "Estes termos podem ser atualizados para refletir evolucoes do produto, requisitos legais e praticas de seguranca.",
          "A versao vigente sempre sera a publicada nesta pagina com data de atualizacao.",
        ],
      },
    ],
    rightsTitle: "Direitos Reservados",
    rightsParagraphs: [
      "Todo o conteudo da plataforma Flance, incluindo marca, nome comercial, identidade visual, codigo-fonte, layouts, textos, elementos graficos e funcionalidades, e protegido por direitos de propriedade intelectual.",
      "E vedada a copia, reproducao, distribuicao, engenharia reversa, revenda ou uso comercial nao autorizado de qualquer parte da plataforma, total ou parcialmente, sem autorizacao expressa dos titulares.",
      "Flance (c) 2026 - Todos os direitos reservados.",
    ],
    contactTitle: "Contato oficial",
    contactText:
      "Para duvidas juridicas, notificacoes ou solicitacoes relacionadas a estes termos, entre em contato pelo email: gestaoFlance@gmail.com",
  },
  "en-US": {
    pageTitle: "Terms of Use",
    updatedAt: "Last updated: April 20, 2026",
    intro:
      "By using the Flance platform, you agree to these Terms of Use. This document defines the rules for using the platform, publishing company profiles, chatting, and subscribing to plans.",
    sections: [
      {
        title: "1. Platform purpose",
        paragraphs: [
          "Flance is a digital directory where companies, small businesses, and service providers can publish professional profiles, including contact information, specialties, location, and image portfolio.",
          "The platform also provides direct communication features through internal chat.",
        ],
      },
      {
        title: "2. Account and user responsibility",
        paragraphs: [
          "To access full features, users must create an account with accurate and up-to-date information.",
          "Account holders are responsible for keeping their password confidential and for all activity under their access.",
          "Flance may limit, suspend, or terminate accounts in cases of misuse, fraud, intrusion attempts, deceptive content, or violation of these terms.",
        ],
      },
      {
        title: "3. Company profile publishing",
        paragraphs: [
          "Companies and providers may publish profiles according to the limits of their selected plan, including the free trial plan.",
          "Published information must be legitimate, must not infringe third-party rights, and must comply with applicable law.",
          "Flance may remove or adjust content that violates these terms, without prior notice, when required for platform and user safety.",
        ],
      },
      {
        title: "4. Plans, billing, and availability",
        paragraphs: [
          "The platform may offer a free plan and recurring paid plans, with prices and benefits displayed on the plans page.",
          "Prices, features, and limits may be updated and published on the platform.",
          "Temporary downtime due to maintenance, technical updates, or external factors does not automatically entitle users to compensation.",
        ],
      },
      {
        title: "5. Chat communication",
        paragraphs: [
          "Chat is provided for professional communication between users and registered companies.",
          "Spam, fraud, harassment, offensive content, unlawful data collection, or any illegal activity is prohibited.",
          "Messages may be logged for security, technical auditing, and abuse prevention purposes, according to the applicable privacy policy.",
        ],
      },
      {
        title: "6. Privacy and security",
        paragraphs: [
          "Flance adopts technical and organizational measures to protect data and active sessions.",
          "No system is fully immune to failure; users agree to use the platform following good security practices.",
          "Password reset and authentication requests must be made only through official platform channels.",
        ],
      },
      {
        title: "7. Limitation of liability",
        paragraphs: [
          "Flance is not a contracting party in services negotiated between users and companies; it provides visibility and contact infrastructure.",
          "Scope, pricing, deadlines, quality, and contract fulfillment are the responsibility of the parties involved.",
          "Whenever permitted by law, Flance liability is limited to services effectively provided through the platform.",
        ],
      },
      {
        title: "8. Changes to these terms",
        paragraphs: [
          "These terms may be updated to reflect product evolution, legal requirements, and security practices.",
          "The current version is always the one published on this page with the update date.",
        ],
      },
    ],
    rightsTitle: "All Rights Reserved",
    rightsParagraphs: [
      "All Flance platform content, including trademark, trade name, visual identity, source code, layouts, text, graphic elements, and features, is protected by intellectual property rights.",
      "Copying, reproducing, distributing, reverse engineering, reselling, or unauthorized commercial use of any part of the platform, in whole or in part, is prohibited without express authorization.",
      "Flance (c) 2026 - All rights reserved.",
    ],
    contactTitle: "Official contact",
    contactText:
      "For legal questions, notices, or requests related to these terms, contact: gestaoFlance@gmail.com",
  },
};

export default function TermsPage() {
  const { locale } = useI18n();
  const content = locale === "en-US" ? contentByLocale["en-US"] : contentByLocale["pt-BR"];

  return (
    <main className="page-shell">
      <section className="section-shell-sm">
        <header className="card">
          <h1 className="heading-xl">{content.pageTitle}</h1>
          <p className="mt-2 text-sm text-muted">{content.updatedAt}</p>
          <p className="mt-4 text-muted">{content.intro}</p>
        </header>

        {content.sections.map((section) => (
          <article key={section.title} className="card">
            <h2 className="text-xl font-bold text-[#ffffff]">{section.title}</h2>
            <div className="mt-3 grid gap-3">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-muted">
                  {paragraph}
                </p>
              ))}
            </div>
          </article>
        ))}

        <article className="card">
          <h2 className="text-xl font-bold text-[#d6d6d6]">{content.rightsTitle}</h2>
          <div className="mt-3 grid gap-3">
            {content.rightsParagraphs.map((paragraph) => (
              <p key={paragraph} className="text-muted">
                {paragraph}
              </p>
            ))}
          </div>
        </article>

        <article className="card">
          <h2 className="text-xl font-bold text-[#64380c]">{content.contactTitle}</h2>
          <p className="mt-3 text-muted">{content.contactText}</p>
        </article>
      </section>
    </main>
  );
}
