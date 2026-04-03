"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardClientRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/profile");
  }, [router]);

  return (
    <main className="page-shell">
      <section className="section-shell">
        <div className="card">Redirecionando...</div>
      </section>
    </main>
  );
}

