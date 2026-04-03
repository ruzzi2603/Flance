"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { loginSchema } from "../../../services/schemas";
import { login } from "../../../services/auth";
import { useAuthStore } from "../../../store/useAuthStore";
import { useAuth } from "../../../hooks/useAuth";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const { user, isLoading, isAuthenticated } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && user) {
      router.replace("/profile");
    }
  }, [isLoading, isAuthenticated, user, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      email: String(formData.get("email") || ""),
      password: String(formData.get("password") || ""),
    };

    const parsed = loginSchema.safeParse(payload);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") {
          errors[key] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const result = await login(parsed.data);
      setUser(result.user);
      router.push("/profile");
    } catch (error) {
      setFormError("Credenciais invalidas. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="section-shell-md">
        <div className="card-lg">
          <h1 className="heading-xl">Entrar</h1>
          <p className="mt-2 text-muted">Acesse sua conta para continuar.</p>

          <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
            <label className="form-label">
              Email
              <input
                className="input"
                type="email"
                name="email"
                placeholder="voce@exemplo.com"
                autoComplete="email"
              />
              {fieldErrors.email ? <span className="text-xs text-rose-600">{fieldErrors.email}</span> : null}
            </label>
            <label className="form-label">
              Senha
              <input
                className="input"
                type="password"
                name="password"
                placeholder="********"
                autoComplete="current-password"
              />
              {fieldErrors.password ? <span className="text-xs text-rose-600">{fieldErrors.password}</span> : null}
            </label>

            {formError ? (
              <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted">
            <a className="text-slate-900 underline" href="/register">
              Criar conta
            </a>
            <span>|</span>
            <a className="text-slate-900 underline" href="/reset">
              Esqueci minha senha
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
