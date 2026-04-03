"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function JobDetailRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/empresas");
  }, [router]);

  return (
    <main className="page-shell">
      <section className="section-shell">
        <div className="card">Redirecionando...</div>
      </section>
    </main>
  );
}

