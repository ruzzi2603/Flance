"use client";

import Link from "next/link";
import { useAuth } from "../../hooks/useAuth";

const plans = [
  {
    id: "FREE",
    name: "Teste gratuito",
    price: "R$ 0",
    description: "Ideal para conhecer a plataforma.",
    features: ["Cadastrar 1 empresa", "Perfil basico", "Contato direto via chat"],
  },
  {
    id: "BASIC",
    name: "Plano Essencial",
    price: "R$ 29,99",
    description: "Para empresas em inicio de divulgacao.",
    features: ["Cadastrar 2 empresas", "Prioridade simples", "Relatorio mensal de visitas"],
  },
  {
    id: "PRO",
    name: "Plano Profissional",
    price: "R$ 39,99",
    description: "Mais visibilidade e recursos.",
    features: ["Cadastrar 5 empresas", "Destaque na busca", "Relatorios semanais"],
  },
  {
    id: "PREMIUM",
    name: "Plano Premium",
    price: "R$ 59,99",
    description: "Maximo alcance e suporte.",
    features: ["Cadastrar ate 10 empresas", "Destaque maximo", "Suporte dedicado"],
  },
];

export default function PlansPage() {
  const { isAuthenticated } = useAuth();

  return (
    <main className="page-shell">
      <section className="section-shell">
        <header className="mb-10">
          <h1 className="heading-xl">Planos para divulgar sua empresa</h1>
          <p className="mt-2 text-muted">
            Escolha um plano e publique seu perfil profissional com contatos e fotos.
          </p>
        </header>

        <div className="plans-grid">
          {plans.map((plan) => (
            <div key={plan.id} className="card-container">
              <div className="title-card">
                <p>{plan.name}</p>
                <span>{plan.price}</span>
              </div>
              <div className="card-content">
                <div className="title">{plan.description}</div>
                <div className="plain">
                  <p>{plan.price}</p>
                  <p>por mes</p>
                </div>
                <div className="card-separate">
                  <span>Detalhes</span>
                  <span className="separate" />
                </div>
                <div className="card-list-features">
                  {plan.features.map((item) => (
                    <div key={item} className="option">
                      <span>-</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                {isAuthenticated ? (
                  <Link href={`/profile?plan=${plan.id}`} className="card-btn">
                    Selecionar plano
                  </Link>
                ) : (
                  <Link href={`/register?plan=${plan.id}`} className="card-btn">
                    Criar conta e escolher
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
