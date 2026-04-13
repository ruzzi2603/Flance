"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { loginSchema } from "../../../services/schemas";
import { login } from "../../../services/auth";
import { useAuthStore } from "../../../store/useAuthStore";
import { useAuth } from "../../../hooks/useAuth";
import { useI18n } from "../../../i18n/useI18n";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const { user, isLoading, isAuthenticated } = useAuth();
  const { t } = useI18n();
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
      setFormError(t("auth.login.error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="section-shell-md">
        <div className="card-lg">
          <h1 className="heading-xl">{t("auth.login.title")}</h1>
          <p className="mt-2 text-muted">{t("auth.login.subtitle")}</p>

          <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
            <label className="form-label">
              {t("auth.login.email")}
              <input
                className="input"
                type="email"
                name="email"
                placeholder={t("auth.login.emailPlaceholder")}
                autoComplete="email"
              />
              {fieldErrors.email ? <span className="text-xs text-rose-600">{fieldErrors.email}</span> : null}
            </label>
            <label className="form-label">
              {t("auth.login.password")}
              <input
                className="input"
                type="password"
                name="password"
                placeholder={t("auth.login.passwordPlaceholder")}
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
              {isSubmitting ? t("auth.login.loading") : t("auth.login.button")}
            </button>
          </form>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted">
            <a className="text-slate-900 underline" href="/register" id="Remember">
              {t("auth.login.create")}
            </a>
            <span>|</span>
            <a className="text-slate-900 underline" id="Remember" href="/reset">
              {t("auth.login.forgot")}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
