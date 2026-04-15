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
        <p className="hero-eyebrow">flance</p>

<div className="cardT">
  <div className="loadere">
    <p id="txt1">Aqui você encontra</p>
    <div className="words">
      <span className="word">serviços.</span>
      <span className="word">soluções.</span>
      <span className="word">projetos.</span>
      <span className="word">cultura.</span>
      <span className="word">tudo.</span>
    </div>
  </div>
</div>

        
        <p className="hero-subtitle">
          Encontre empresas e prestadores de servico confiaveis, com contato direto e perfis completos.
          Para quem presta servico, destaque sua empresa com planos pensados para crescer sua visibilidade.
        </p>
        <Link href="/empresas" className="animated-button">
          <svg viewBox="0 0 24 24" className="arr-2" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z"
            ></path>
          </svg>
          <span className="text">Conhecer empresas</span>
          <span className="circle"></span>
          <svg viewBox="0 0 24 24" className="arr-1" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z"
            ></path>
          </svg>
        </Link>

        <div className="hero-actions">
        
            <>
              
              <Link href="/planos" className="animated-button" id="divulgar-empresa">
          <svg viewBox="0 0 24 24" className="arr-2" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z"
            ></path>
          </svg>
          <span className="text">Quero divulgar minha empresa</span>
          <span className="circle" id="circleEmpresas"></span>
          <svg viewBox="0 0 24 24" className="arr-1" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z"
            ></path>
          </svg>
        </Link>
          
            </>
          
        </div>
      </motion.section>
    </main>
  );
}
