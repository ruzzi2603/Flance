"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useApiHealth } from "../hooks/useApiHealth";
import { useAuth } from "../hooks/useAuth";

export default function HomePage() {
  const { data, isLoading, isError } = useApiHealth();
  const { isAuthenticated } = useAuth();

  return (
    <main className="hero-root">
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="hero-card"
      >
        <p className="hero-eyebrow">empreender é a essência</p>
        <h1 className="hero-title">
          Servicos, produtos e <span className="hero-highlight">soluções</span> em um único lugar.
        </h1>
        <p className="hero-subtitle">
          Encontre empresas e prestadores de servico confiaveis, com contato direto e perfis completos.
          Para quem presta servico, destaque sua empresa com planos pensados para crescer sua visibilidade.
        </p>
        <div className="hero-actions">
          {isAuthenticated ? null : (
            <>
              
              <Link href="/planos" className="btn-cta-secondary">
                Quero divulgar meu serviço
              </Link>
              <Link href="/empresas" className="btn-cta-primary">
                Quero encontrar empresas
              </Link>
            </>
          )}
        </div>
      </motion.section>
    </main>
  );
}
