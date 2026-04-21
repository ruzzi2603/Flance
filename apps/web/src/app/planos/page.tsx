"use client";

import Link from "next/link";
import { useAuth } from "../../hooks/useAuth";
import { useI18n } from "../../i18n/useI18n";

export default function PlansPage() {
  const { isAuthenticated } = useAuth();
  const { t, formatCurrency } = useI18n();

  const plans = [
    {
      id: "FREE",
      name: t("plans.free.title"),
      price: 0,
      description: t("plans.free.desc"),
      features: [t("plans.free.feature1"), t("plans.free.feature2"), t("plans.free.feature3")],
    },
    {
      id: "BASIC",
      name: t("plans.essential.title"),
      price: 29.99,
      description: t("plans.essential.desc"),
      features: [t("plans.essential.feature1"), t("plans.essential.feature2"), t("plans.essential.feature3")],
    },
    {
      id: "PRO",
      name: t("plans.professional.title"),
      price: 39.99,
      description: t("plans.professional.desc"),
      features: [t("plans.professional.feature1"), t("plans.professional.feature2"), t("plans.professional.feature3")],
    },
  
  ];

  return (
    <main className="page-shell">
      <section className="section-shell">
        
    
<div className="marquee">
  <div className="heading-xl" id="ttplans">Foco em resultados</div>
  <div className="marquee__inner">
    <div className="marquee__group">
    <div id="cardInfo"
  className="h-[16em] w-[18em]  rounded-[1.5em]   font-nunito p-[1em] flex justify-center items-left flex-col gap-[0.75em] backdrop-blur-[12px]"
>
  <div>
    <h1 className="text-[2em] font-medium">Melhore seus resultados</h1>
    <p className="text-[0.85em]">
      Aumente seus resultados com nosso plano PRO, projetado para impulsionar seu sucesso.
    </p>
  </div>

  
</div>
    <div id="cardInfo"
  className="h-[16em] w-[18em]  rounded-[1.5em]   font-nunito p-[1em] flex justify-center items-left flex-col gap-[0.75em] backdrop-blur-[12px]"
>
  <div>
    <h1 className="text-[2em] font-medium">Aumente sua visibilidade</h1>
    <p className="text-[0.85em]">
      Melhore sua visibilidade e alcance mais clientes com nosso plano PRO, projetado para destacar seu perfil.
    </p>
  </div>

  
</div>
   <div id="cardInfo"
  className="h-[16em] w-[18em]  rounded-[1.5em]   font-nunito p-[1em] flex justify-center items-left flex-col gap-[0.75em] backdrop-blur-[12px]"
>
  <div>
    <h1 className="text-[2em] font-medium">Aumento de renda</h1>
    <p className="text-[0.85em]">
      Aumente sua renda com a visibilidade do nosso plano PRO, projetado para maximizar seus lucros.
    </p>
  </div>

  
</div>
    <div id="cardInfo"
  className="h-[16em] w-[18em]  rounded-[1.5em]   font-nunito p-[1em] flex justify-center items-left flex-col gap-[0.75em] backdrop-blur-[12px]"
>
  <div>
    <h1 className="text-[2em] font-medium">Potencialize seus ganhos</h1>
    <p className="text-[0.85em]">
      Melhore seus ganhos com nossos planos, projetados para impulsionar seu sucesso.
    </p>
  </div>

  
</div>
    <div id="cardInfo"
  className="h-[16em] w-[18em]  rounded-[1.5em]   font-nunito p-[1em] flex justify-center items-left flex-col gap-[0.75em] backdrop-blur-[12px]"
>
  <div>
    <h1 className="text-[2em] font-medium">Ganhe novos clientes</h1>
    <p className="text-[0.85em]">
      Converta novos clientes com nossos planos, projetados para destacar seu perfil e atrair mais oportunidades.
    </p>
  </div>

  
</div>
    </div>

    <div className="marquee__group">
     <div id="cardInfo"
  className="h-[16em] w-[18em]  rounded-[1.5em]   font-nunito p-[1em] flex justify-center items-left flex-col gap-[0.75em] backdrop-blur-[12px]"
>
  <div>
    <h1 className="text-[2em] font-medium">Expanda seu negócio</h1>
    <p className="text-[0.85em]">
      Aumente seu negócio com nosso plano PRO, projetado para impulsionar seu crescimento.
    </p>
  </div>

  
</div>
    <div id="cardInfo"
  className="h-[16em] w-[18em]  rounded-[1.5em]   font-nunito p-[1em] flex justify-center items-left flex-col gap-[0.75em] backdrop-blur-[12px]"
>
  <div>
    <h1 className="text-[2em] font-medium">Desenvolva seu marketing</h1>
    <p className="text-[0.85em]">
      Desenvolva seu marketing com nosso plano PRO, projetado para destacar seu perfil e atrair mais clientes.
    </p>
  </div>

  
</div>
    <div id="cardInfo"
  className="h-[16em] w-[18em]  rounded-[1.5em]   font-nunito p-[1em] flex justify-center items-left flex-col gap-[0.75em] backdrop-blur-[12px]"
>
  <div>
    <h1 className="text-[2em] font-medium">Ganhe reconhecimento</h1>
    <p className="text-[0.85em]">
      Ganhe reconhecimento na sua região com nosso plano PRO, projetado para destacar seu perfil e atrair mais clientes.
    </p>
  </div>

  
</div>
     <div id="cardInfo"
  className="h-[16em] w-[18em] border-[rgba(0,0,0,0)] rounded-[1.5em]   font-nunito p-[1em] flex justify-center items-left flex-col gap-[0.75em] backdrop-blur-[12px]"
>
  <div>
    <h1 className="text-[2em] font-medium ">Cresca no mercado</h1>
    <p className="text-[0.85em]">
      Cresca dentro da sua área impulsioanndo sua visibilidade e atraindo mais clientes com nosso plano PRO, projetado para destacar seu perfil e atrair mais oportunidades.
    </p>
  </div>

  
</div>
    <div id="cardInfo"
  className="h-[16em] w-[18em]  rounded-[1.5em]   font-nunito p-[1em] flex justify-center items-left flex-col gap-[0.75em] backdrop-blur-[12px]"
>
  <div>
    <h1 className="text-[2em] font-medium">Aumenta suas vendas</h1>
    <p className="text-[0.85em]">
      Aumente suas vendas com nosso plano PRO, projetado para maximizar seus lucros.
    </p>
  </div>

  
</div>
    </div>
  </div>
</div>
<h1 className="heading-xl" id="ttplans">{t("plans.title")}</h1>
          <p className="mt-2 text-muted" id="ttplanssub">
            {t("plans.subtitle")}
          </p>
        <div className="plans-grid">
          {plans.map((plan) => (
            <div key={plan.id} className="card-container">
              <div className="title-card">
                <p>{plan.name}</p>
                <span>{formatCurrency(plan.price)}</span>
              </div>
              <div className="card-content">
                <div className="title">{plan.description}</div>
                <div className="plain">
                  <p>{formatCurrency(plan.price)}</p>
                  <p>{t("plans.period")}</p>
                </div>
                <div className="card-separate">
                  <span>{t("plans.details")}</span>
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
                    {t("plans.select")}
                  </Link>
                ) : (
                  <Link href={`/register?plan=${plan.id}`} className="card-btn">
                    {t("plans.createAndSelect")}
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
