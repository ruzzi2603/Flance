"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function FreelancerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : "";

  useEffect(() => {
    if (id) {
      router.replace(`/empresas/${id}`);
    }
  }, [id, router]);

  return (
    <main className="page-shell">
      <section className="section-shell">
        <div className="card">Redirecionando...</div>
      </section>
    </main>
  );
}
