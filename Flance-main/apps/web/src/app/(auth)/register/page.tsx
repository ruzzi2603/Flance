"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { registerSchema } from "../../../services/schemas";
import { register, resendRegistrationCode, verifyRegistrationEmail } from "../../../services/auth";
import { useAuthStore } from "../../../store/useAuthStore";
import { useI18n } from "../../../i18n/useI18n";
import { getApiErrorDetails } from "../../../services/form-errors";

export default function RegisterPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitInProgress = useRef(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [avatarUrl, setAvatarUrl] = useState("avatar-sky");
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const avatarIsImage = avatarUrl.startsWith("data:") || avatarUrl.startsWith("http");

  function getRegisterFieldError(field: string, value: string) {
    if (field === "name") {
      if (value.trim().length < 2) return t("auth.register.nameShort");
      if (value.length > 120) return t("auth.register.nameLong");
    }
    if (field === "email") return t("auth.register.emailInvalid");
    if (field === "password") return t("auth.register.passwordShort");
    return t("auth.register.validationSummary");
  }

  function clearRegisterFieldError(field: string) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormError(null);
  }

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = window.setTimeout(() => setResendCountdown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCountdown]);

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
    if (submitInProgress.current) return;
    setFormError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      password: String(formData.get("password") || ""),
      avatarUrl,
    };

    const parsed = registerSchema.safeParse(payload);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") {
          errors[key] = getRegisterFieldError(key, String(formData.get(key) || ""));
        }
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    submitInProgress.current = true;
    setIsSubmitting(true);

    try {
      const result = await register(parsed.data);
      setVerificationEmail(result.email);
      setResendCountdown(result.resendAfterSeconds);
    } catch (error) {
      const details = getApiErrorDetails(error);
      if (Object.keys(details.fieldErrors).length > 0) {
        const errors = Object.fromEntries(
          Object.keys(details.fieldErrors).map((field) => [field, getRegisterFieldError(field, String(formData.get(field) || ""))]),
        );
        setFieldErrors(errors);
        setFormError(t("auth.register.validationSummary"));
      } else if (details.message?.toLowerCase().includes("email already in use")) {
        setFieldErrors({ email: t("auth.register.nameTaken") });
        setFormError(t("auth.register.nameTaken"));
      } else {
        setFormError(details.message && details.message !== "Validation failed" ? details.message : t("auth.register.error"));
      }
    } finally {
      submitInProgress.current = false;
      setIsSubmitting(false);
    }
  }

  async function handleVerifyEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!verificationEmail) return;
    setFormError(null);
    setIsVerifying(true);
    try {
      const result = await verifyRegistrationEmail({ email: verificationEmail, code: verificationCode.trim() });
      setUser(result.user);
      router.push("/planos");
    } catch (error) {
      const message =
        typeof error === "object" && error && "response" in error
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (error as any).response?.data?.message
          : null;
      setFormError(Array.isArray(message) ? message[0] : message || t("auth.register.verifyError"));
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResendCode() {
    if (!verificationEmail || resendCountdown > 0) return;
    setFormError(null);
    setIsResending(true);
    try {
      const result = await resendRegistrationCode(verificationEmail);
      setResendCountdown(result.resendAfterSeconds);
      setFormError(result.sent ? t("auth.register.codeResent") : t("auth.register.verifyError"));
    } catch {
      setFormError(t("auth.register.resendError"));
    } finally {
      setIsResending(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="section-shell">
        <div className="card-lg">
          <h1 className="heading-xl">{verificationEmail ? t("auth.register.verifyTitle") : t("auth.register.title")}</h1>
          <p className="mt-2 text-muted" id="pop">
            {verificationEmail ? t("auth.register.verifySubtitle", { email: verificationEmail }) : t("auth.register.subtitle")}
          </p>

          {verificationEmail ? (
            <form key="email-verification-form" className="mt-8 grid gap-5" onSubmit={handleVerifyEmail}>
              <label className="form-label">
                {t("auth.register.verificationCode")}
                <input
                  className="input"
                  name="verificationCode"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  required
                  minLength={6}
                  maxLength={6}
                />
              </label>
              {formError ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="status">{formError}</div> : null}
              <button type="submit" className="btn-primary" disabled={isVerifying || verificationCode.length !== 6}>
                {isVerifying ? t("auth.register.verifying") : t("auth.register.verifyButton")}
              </button>
              <button type="button" className="btn-outline" disabled={isResending || resendCountdown > 0} onClick={() => void handleResendCode()}>
                {isResending ? t("auth.register.resending") : resendCountdown > 0 ? t("auth.register.resendCountdown", { seconds: resendCountdown }) : t("auth.register.resendCode")}
              </button>
            </form>
          ) : (
          <form key="registration-form" className="mt-8 grid gap-5" onSubmit={handleSubmit} noValidate>
            <label className="form-label">
              {t("auth.register.name")}
              <input className="input" name="name" placeholder={t("auth.register.namePlaceholder")} onChange={() => clearRegisterFieldError("name")} required minLength={2} maxLength={120} autoComplete="name" aria-invalid={Boolean(fieldErrors.name)} />
              <span className="text-xs text-slate-500">{t("auth.register.nameHint")}</span>
              {fieldErrors.name ? <span className="text-xs text-rose-600">{fieldErrors.name}</span> : null}
            </label>
            <label className="form-label">
              {t("auth.register.email")}
              <input className="input" name="email" type="email" placeholder={t("auth.register.emailPlaceholder")} onChange={() => clearRegisterFieldError("email")} required autoComplete="email" aria-invalid={Boolean(fieldErrors.email)} />
              <span className="text-xs text-slate-500">{t("auth.register.emailHint")}</span>
              {fieldErrors.email ? <span className="text-xs text-rose-600">{fieldErrors.email}</span> : null}
            </label>
            <label className="form-label">
              {t("auth.register.password")}
              <input className="input" name="password" type="password" placeholder={t("auth.register.passwordPlaceholder")} onChange={() => clearRegisterFieldError("password")} required minLength={8} autoComplete="new-password" aria-invalid={Boolean(fieldErrors.password)} />
              <span className="text-xs text-slate-500">{t("auth.register.passwordHint")}</span>
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
                <span className="text-xs text-slate-500">{t("auth.register.photoHint")}</span>
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
          )}
        </div>
      </section>
    </main>
  );
}
