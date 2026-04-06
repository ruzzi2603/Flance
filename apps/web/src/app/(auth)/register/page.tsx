"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { registerSchema } from "../../../services/schemas";
import { register } from "../../../services/auth";
import { useAuthStore } from "../../../store/useAuthStore";
import { useI18n } from "../../../i18n/useI18n";

export default function RegisterPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [avatarUrl, setAvatarUrl] = useState("avatar-sky");
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const avatarIsImage = avatarUrl.startsWith("data:") || avatarUrl.startsWith("http");

  function handleAvatarUpload(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError(t("auth.register.photoErrorType"));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError(t("auth.register.photoErrorSize"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (result) {
        setAvatarUrl(result);
        setAvatarError(null);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") || ""),
      email: String(formData.get("email") || ""),
      password: String(formData.get("password") || ""),
      avatarUrl,
    };

    const parsed = registerSchema.safeParse(payload);
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
      const result = await register(parsed.data);
      setUser(result.user);
      router.push("/planos");
    } catch (error) {
      const message =
        typeof error === "object" && error && "response" in error
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (error as any).response?.data?.message
          : null;
      setFormError(message || t("auth.register.error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="section-shell">
        <div className="card-lg">
          <h1 className="heading-xl">{t("auth.register.title")}</h1>
          <p className="mt-2 text-muted">{t("auth.register.subtitle")}</p>

          <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
            <label className="form-label">
              {t("auth.register.name")}
              <input className="input" name="name" placeholder={t("auth.register.namePlaceholder")} />
              {fieldErrors.name ? <span className="text-xs text-rose-600">{fieldErrors.name}</span> : null}
            </label>
            <label className="form-label">
              {t("auth.register.email")}
              <input className="input" name="email" placeholder={t("auth.register.emailPlaceholder")} />
              {fieldErrors.email ? <span className="text-xs text-rose-600">{fieldErrors.email}</span> : null}
            </label>
            <label className="form-label">
              {t("auth.register.password")}
              <input className="input" name="password" type="password" placeholder={t("auth.register.passwordPlaceholder")} />
              {fieldErrors.password ? <span className="text-xs text-rose-600">{fieldErrors.password}</span> : null}
            </label>

            <div className="form-label">
              {t("auth.register.photo")}
              <label className="form-label">
                {t("auth.register.photoUpload")}
                <input
                  className="input file-input"
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleAvatarUpload(event.target.files?.[0] || null)}
                />
                {avatarError ? <span className="text-xs text-rose-600">{avatarError}</span> : null}
              </label>
              <div className="avatar-grid ">
                {avatarIsImage ? (
                  <label className="avatar-option is-active">
                    <input type="radio" checked readOnly />
                    <img className="avatar-image" src={avatarUrl} alt="Foto enviada" />
                    <span className="text-xs text-slate-600">{t("auth.register.photoFile")}</span>
                  </label>
                ) : null}
                {[
                  { id: "avatar-sky", label: t("auth.register.avatar.blue") },
                  { id: "avatar-amber", label: t("auth.register.avatar.yellow") },
                  { id: "avatar-emerald", label: t("auth.register.avatar.green") },
                  { id: "avatar-rose", label: t("auth.register.avatar.pink") },
                  { id: "avatar-violet", label: t("auth.register.avatar.purple") },
                  { id: "avatar-slate", label: t("auth.register.avatar.gray") },
                ].map((option) => (
                  <label key={option.id} className={` avatar-option ${avatarUrl === option.id ? "is-active" : ""}`}>
                    <input
                      type="radio"
                      name="profileAvatar"
                      checked={avatarUrl === option.id}
                      onChange={() => setAvatarUrl(option.id)}
                    />
                    <span className={`nav-avatar ${option.id}`}>{option.label.charAt(0)}</span>
                    <span className="text-xs text-slate-600 ">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {formError ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</div> : null}

            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? t("auth.register.creating") : t("auth.register.create")}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
