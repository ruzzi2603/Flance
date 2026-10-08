"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../hooks/useAuth";
import { updateProfile } from "../../services/users";
import { useAuthStore } from "../../store/useAuthStore";
import { useI18n } from "../../i18n/useI18n";
import { companyProfileSchema } from "../../services/schemas";
import { getApiErrorDetails } from "../../services/form-errors";

function ProfilePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();
  const { setUser } = useAuthStore();
  const { t, formatCurrency } = useI18n();

  const plans = useMemo(
    () => [
      { id: "FREE", label: t("plans.free.title"), price: 0, limit: 1 },
      { id: "PROFESSIONAL", label: t("plans.professional.title"), price: 29.99, limit: 5 },
      { id: "PROFESSIONAL_PLUS", label: t("plans.professionalPlus.title"), price: 39.99, limit: 15 },
    ],
    [t],
  );

  const [name, setName] = useState(user?.name || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "avatar-sky");
  const [bio, setBio] = useState(user?.bio || "");
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedPlan, setSelectedPlan] = useState<string | null>(user?.planTier || null);
  const [companyEnabled, setCompanyEnabled] = useState(Boolean(user?.companyEnabled));
  const [companyName, setCompanyName] = useState(user?.companyName || "");
  const [companyCnpj, setCompanyCnpj] = useState(user?.companyCnpj || "");
  const [companyDescription, setCompanyDescription] = useState(user?.companyDescription || "");
  const [companyLocation, setCompanyLocation] = useState(user?.companyLocation || "");
  const [companyCity, setCompanyCity] = useState(user?.companyCity || "");
  const [companyState, setCompanyState] = useState(user?.companyState || "");
  const [companyAddress, setCompanyAddress] = useState(user?.companyAddress || "");
  const [companyWebsite, setCompanyWebsite] = useState(user?.companyWebsite || "");
  const [companyInstagram, setCompanyInstagram] = useState(user?.companyInstagram || "");
  const [companyWhatsapp, setCompanyWhatsapp] = useState(user?.companyWhatsapp || "");
  const [companyEmail, setCompanyEmail] = useState(user?.companyEmail || "");
  const [companyHours, setCompanyHours] = useState(user?.companyHours || "");
  const [companyIsOnline, setCompanyIsOnline] = useState(user?.companyIsOnline ?? true);
  const [companyIsPhysical, setCompanyIsPhysical] = useState(user?.companyIsPhysical ?? false);
  const [companyPhotos, setCompanyPhotos] = useState<string[]>(user?.companyPhotos || []);
  const [companyPhotoError, setCompanyPhotoError] = useState<string | null>(null);
  const [companyFieldErrors, setCompanyFieldErrors] = useState<Record<string, string>>({});
  const [showCompanySuccess, setShowCompanySuccess] = useState(false);
  const [showPaymentScreen, setShowPaymentScreen] = useState(false);

  const avatarIsImage = avatarUrl.startsWith("data:") || avatarUrl.startsWith("http");
  const maxPhotos = useMemo(() => {
    if (selectedPlan === "PROFESSIONAL") return 10;
    if (selectedPlan === "PROFESSIONAL_PLUS") return 20;
    return 3; // FREE or null
  }, [selectedPlan]);

  function clearCompanyFieldError(field: string) {
    setSaveError(null);
    setCompanyFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function getCompanyIssueMessage(
    field: string,
    issue: { code: string; minimum?: number; maximum?: number },
  ) {
    if (field === "companyWebsite" && issue.code === "invalid_string") return t("profile.company.websiteInvalid");
    if (field === "companyEmail" && issue.code === "invalid_string") return t("profile.company.emailInvalid");
    if (field === "companyCnpj" && issue.code === "invalid_string") return t("profile.company.cnpjInvalid");
    if (field === "companyWhatsapp" && issue.code === "invalid_string") return t("profile.company.whatsappInvalid");
    if (issue.code === "too_small" && issue.minimum !== undefined) {
      if (field === "companyName") return t("profile.company.nameTooShort");
      if (field === "companyDescription") return t("profile.company.descriptionTooShort");
      return t("profile.company.tooShort", { min: issue.minimum });
    }
    if (issue.code === "too_big" && issue.maximum !== undefined) {
      if (field === "companyName") return t("profile.company.nameTooLong");
      if (field === "companyDescription") return t("profile.company.descriptionTooLong");
      if (field === "companyPhotos") return t("profile.company.photosTooMany", { max: maxPhotos });
      return t("profile.company.tooLong", { max: issue.maximum });
    }
    return t("profile.company.invalid");
  }

  function handleAvatarUpload(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError(t("profile.photoErrorType"));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError(t("profile.photoErrorSize"));
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

  function handleCompanyPhotoUpload(index: number, file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setCompanyPhotoError(t("profile.company.photoErrorType"));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setCompanyPhotoError(t("profile.company.photoErrorSize"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) return;
      setCompanyPhotos((current) => {
        const next = [...current];
        next[index] = result;
        return next;
      });
      setCompanyPhotoError(null);
    };
    reader.readAsDataURL(file);
  }

  const initials = useMemo(() => {
    const source = name || user?.name;
    if (!source) return "FL";
    return source.split(" ").map((part) => part[0]).slice(0, 2).join("");
  }, [name, user?.name]);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setAvatarUrl(user.avatarUrl || "avatar-sky");
      setBio(user.bio || "");
      // A plan in the URL is the user's current choice. The API keeps paid
      // plans inactive until payment succeeds, so its FREE response must not
      // overwrite that pending choice after saving company details.
      if (!searchParams.get("plan")) {
        setSelectedPlan(user.planTier || null);
      }
      setCompanyEnabled(Boolean(user.companyEnabled));
      setCompanyName(user.companyName || "");
      setCompanyCnpj(user.companyCnpj || "");
      setCompanyDescription(user.companyDescription || "");
      setCompanyLocation(user.companyLocation || "");
      setCompanyCity(user.companyCity || "");
      setCompanyState(user.companyState || "");
      setCompanyAddress(user.companyAddress || "");
      setCompanyWebsite(user.companyWebsite || "");
      setCompanyInstagram(user.companyInstagram || "");
      setCompanyWhatsapp(user.companyWhatsapp || "");
      setCompanyEmail(user.companyEmail || "");
      setCompanyHours(user.companyHours || "");
      setCompanyIsOnline(user.companyIsOnline ?? true);
      setCompanyIsPhysical(user.companyIsPhysical ?? false);
      setCompanyPhotos(user.companyPhotos || []);
    }
  }, [user, searchParams]);

  useEffect(() => {
    const planFromUrl = searchParams.get("plan");
    if (planFromUrl) {
      setSelectedPlan(planFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    if (isLoading || searchParams.get("edit") !== "company") return;
    document.getElementById("company-ad-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [isLoading, searchParams]);

  async function handleSaveProfile() {
    setSaveError(null);
    setSaveSuccess(null);
    if (!name.trim()) {
      setSaveError(t("profile.nameRequired"));
      return;
    }
    setIsSaving(true);
    try {
      const updated = await updateProfile({
        name: name.trim(),
        avatarUrl,
        bio: bio.trim() || undefined,
      });
      setUser(updated);
      setSaveSuccess(t("profile.saveSuccess"));
    } catch (error) {
      const message =
        typeof error === "object" && error && "response" in error
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (error as any).response?.data?.message
          : null;
      setSaveError(message || t("profile.saveError"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveCompany() {
    setSaveError(null);
    setSaveSuccess(null);
    setCompanyPhotoError(null);
    setCompanyFieldErrors({});
    if (!selectedPlan) {
      setSaveError(t("profile.company.planRequired"));
      return;
    }
    if (companyPhotos.filter(Boolean).length > maxPhotos) {
      const message = t("profile.company.photosTooMany", { max: maxPhotos });
      setCompanyFieldErrors({ companyPhotos: message });
      return;
    }

    const companyPayload = {
      companyName: companyName.trim(),
      companyCnpj: companyCnpj.trim() || undefined,
      companyDescription: companyDescription.trim(),
      companyLocation: companyLocation.trim() || undefined,
      companyCity: companyCity.trim() || undefined,
      companyState: companyState.trim() || undefined,
      companyAddress: companyAddress.trim() || undefined,
      companyWebsite: companyWebsite.trim() || undefined,
      companyInstagram: companyInstagram.trim() || undefined,
      companyWhatsapp: companyWhatsapp.trim() || undefined,
      companyEmail: companyEmail.trim() || undefined,
      companyHours: companyHours.trim() || undefined,
      companyPhotos: companyPhotos.filter(Boolean),
    };
    const parsed = companyProfileSchema.safeParse(companyPayload);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? "");
        if (field && !errors[field]) {
          errors[field] = getCompanyIssueMessage(field, {
            code: issue.code,
            minimum: "minimum" in issue ? Number(issue.minimum) : undefined,
            maximum: "maximum" in issue ? Number(issue.maximum) : undefined,
          });
        }
      }
      setCompanyFieldErrors(errors);
      setSaveError(t("profile.company.validationSummary"));
      return;
    }

    setIsSaving(true);
    try {
      const enableCompany = companyEnabled || selectedPlan === "FREE";
      const updated = await updateProfile({
        planTier: selectedPlan as "FREE" | "PROFESSIONAL" | "PROFESSIONAL_PLUS",
        companyEnabled: enableCompany,
        ...parsed.data,
        companyIsOnline,
        companyIsPhysical,
      });
      setUser(updated);
      setCompanyEnabled(enableCompany);
      if (selectedPlan === "FREE") {
        setShowCompanySuccess(true);
        setTimeout(() => {
          setShowCompanySuccess(false);
          window.location.href = `/empresas/${updated.id}`;
        }, 1800);
      } else if (updated.planTier !== selectedPlan) {
        // Plano pago escolhido que ainda não está ativo no servidor: segue para o pagamento
        // (comparar com o plano do servidor cobre também quem está no FREE e quer fazer upgrade)
        setShowPaymentScreen(true);
      } else {
        setSaveSuccess(t("profile.company.saveSuccess"));
      }
    } catch (error) {
      const details = getApiErrorDetails(error);
      const errors: Record<string, string> = {};
      for (const [field, messages] of Object.entries(details.fieldErrors)) {
        const issue = messages[0] ?? "";
        if (field) errors[field] = getCompanyIssueMessage(field, { code: issue.includes("regex") ? "invalid_string" : "invalid" });
      }
      if (Object.keys(errors).length > 0) setCompanyFieldErrors(errors);
      const message = details.message;
      setSaveError(
        Object.keys(errors).length > 0 || message === "Validation failed"
          ? t("profile.company.validationSummary")
          : message || t("profile.company.saveError"),
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
        return (
          <main className="page-shell">
            <section className="section-shell">
              <div className="card">
                <div className="loader-wrap">
                  <div className="loader"></div>
                </div>
              </div>
            </section>
          </main>
        );
  }

  return (
    <main className="page-shell">
      <section className="section-shell">
        {showCompanySuccess ? (
          <div className="success-overlay">
            <span>{t("profile.company.successFree")}</span>
          </div>
        ) : null}
        {showPaymentScreen ? (
          <div className="payment-overlay">
            <div className="payment-card">
              <div className="payment-card-icon" aria-hidden="true">✓</div>
              <h2 className="payment-card-title">{t("profile.company.paymentTitle")}</h2>
              <p className="payment-plan">
                {t("profile.company.paymentSelected", {
                  plan: plans.find((plan) => plan.id === selectedPlan)?.label || "",
                })}
              </p>
              <p className="payment-value">
                {t("profile.company.paymentValue", {
                  value: formatCurrency(plans.find((plan) => plan.id === selectedPlan)?.price ?? 0),
                })}
              </p>
              <p className="payment-note">
                {t("profile.company.paymentNote")}
              </p>
              <div className="payment-actions">
                <button
                  className="btn-outline"
                  type="button"
                  onClick={() => setShowPaymentScreen(false)}
                >
                  {t("profile.company.paymentBack")}
                </button>
                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => router.push(`/checkout?plan=${selectedPlan}`)}
                >
                  {t("profile.company.paymentContinue")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <div className="card">
          <div className="flex items-center gap-4">
            {avatarIsImage ? (
              <img className="nav-avatar-image" src={avatarUrl} alt="Foto de perfil" />
            ) : (
              <div className={`nav-avatar ${avatarUrl}`}>{initials}</div>
            )}
            <div>
              <h1 className="heading-lg">{name || user?.name || t("profile.title")}</h1>
              <p className="text-muted">{user?.email}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="form-label">
              {t("profile.displayName")}
              <input
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("profile.displayNamePlaceholder")}
              />
            </label>
            <label className="form-label">
              {t("profile.about")}
              <textarea
                className="textarea"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder={t("profile.aboutPlaceholder")}
              />
            </label>
            <div className="form-label">
              {t("profile.photo")}
              <label className="form-label">
                {t("profile.photoUpload")}
                <input
                  className="input file-input"
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleAvatarUpload(event.target.files?.[0] || null)}
                />
                {avatarError ? <span className="text-xs text-rose-600">{avatarError}</span> : null}
              </label>
              <div className="avatar-grid">
                {avatarIsImage ? (
                  <label className="avatar-option is-active">
                    <input type="radio" checked readOnly />
                    <img className="avatar-image" src={avatarUrl} alt="Foto enviada" />
                    <span className="text-xs text-slate-600">{t("profile.photoSent")}</span>
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
                  <label key={option.id} className={`avatar-option ${avatarUrl === option.id ? "is-active" : ""}`}>
                    <input
                      type="radio"
                      name="profileAvatar"
                      checked={avatarUrl === option.id}
                      onChange={() => setAvatarUrl(option.id)}
                    />
                    <span className={`nav-avatar ${option.id}`}>{option.label.charAt(0)}</span>
                    <span className="text-xs text-slate-600">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <button type="button" className="btn-primary" onClick={handleSaveProfile} disabled={isSaving}>
              {isSaving ? t("profile.saving") : t("profile.save")}
            </button>
          </div>
        </div>

        <div className="card mt-8" id="company-ad-form">
          <h2 className="heading-lg">{t("profile.company.sectionTitle")}</h2>
          <p className="mt-2 text-muted">{t("profile.company.sectionSubtitle")}</p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                className="plan-card-button"
                onClick={() => setSelectedPlan(plan.id)}
              >
                <div className={`card-container ${selectedPlan === plan.id ? "is-active" : ""}`}>
                  <div className="title-card">
                    <p>{plan.label}</p>
                    <span>{formatCurrency(plan.price)}</span>
                  </div>
                  <div className="card-content">
                    <div className="title">{t("profile.company.planLimit", { limit: plan.limit })}</div>
                    <div className="plain">
                      <p>{formatCurrency(plan.price)}</p>
                      <p>{t("plans.period")}</p>
                    </div>
                    <div className="card-separate">
                      <span>{t("profile.company.planLabel")}</span>
                      <span className="separate" />
                    </div>
                    <div className="card-list-features">
                      {plan.id === "FREE" && (
                        <>
                          <div className="option"><span>-</span><span>{t("plans.free.feature1")}</span></div>
                          <div className="option"><span>-</span><span>{t("plans.free.feature2")}</span></div>
                          <div className="option"><span>-</span><span>{t("plans.free.feature3")}</span></div>
                        </>
                      )}
                      {plan.id === "PROFESSIONAL" && (
                        <>
                          <div className="option"><span>-</span><span>{t("plans.professional.feature1")}</span></div>
                          <div className="option"><span>-</span><span>{t("plans.professional.feature2")}</span></div>
                          <div className="option"><span>-</span><span>{t("plans.professional.feature3")}</span></div>
                        </>
                      )}
                      {plan.id === "PROFESSIONAL_PLUS" && (
                        <>
                          <div className="option"><span>-</span><span>{t("plans.professionalPlus.feature1")}</span></div>
                          <div className="option"><span>-</span><span>{t("plans.professionalPlus.feature4")}</span></div>
                          <div className="option"><span>-</span><span>{t("plans.professionalPlus.feature7")}</span></div>
                        </>
                      )}
                    </div>
                    <span className="card-btn">{t("profile.company.planSelect")}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-4">
            <label className="form-label">
              {t("profile.company.name")}
              <input
                className="input"
                value={companyName}
                onChange={(event) => { setCompanyName(event.target.value); clearCompanyFieldError("companyName"); }}
                required
                minLength={2}
                maxLength={140}
                aria-invalid={Boolean(companyFieldErrors.companyName)}
                placeholder={t("profile.company.namePlaceholder")}
              />
              <span className="text-xs text-slate-500">{t("profile.company.nameHint")}</span>
              {companyFieldErrors.companyName ? <span className="text-xs text-rose-600">{companyFieldErrors.companyName}</span> : null}
            </label>
            <label className="form-label">
              {t("profile.company.cnpj")}
              <input
                className="input"
                value={companyCnpj}
                onChange={(event) => { setCompanyCnpj(event.target.value); clearCompanyFieldError("companyCnpj"); }}
                minLength={8}
                maxLength={32}
                aria-invalid={Boolean(companyFieldErrors.companyCnpj)}
                placeholder={t("profile.company.cnpjPlaceholder")}
              />
              <span className="text-xs text-slate-500">{t("profile.company.cnpjHint")}</span>
              {companyFieldErrors.companyCnpj ? <span className="text-xs text-rose-600">{companyFieldErrors.companyCnpj}</span> : null}
            </label>
            <label className="form-label">
              {t("profile.company.description")}
              <textarea
                className="textarea"
                value={companyDescription}
                onChange={(event) => { setCompanyDescription(event.target.value); clearCompanyFieldError("companyDescription"); }}
                required
                minLength={10}
                maxLength={1000}
                aria-invalid={Boolean(companyFieldErrors.companyDescription)}
                placeholder={t("profile.company.descriptionPlaceholder")}
              />
              <span className="text-xs text-slate-500">{t("profile.company.descriptionHint")}</span>
              {companyFieldErrors.companyDescription ? <span className="text-xs text-rose-600">{companyFieldErrors.companyDescription}</span> : null}
            </label>
            <label className="form-label">
              {t("profile.company.location")}
              <input
                className="input"
                value={companyLocation}
                onChange={(event) => { setCompanyLocation(event.target.value); clearCompanyFieldError("companyLocation"); }}
                minLength={2}
                maxLength={160}
                aria-invalid={Boolean(companyFieldErrors.companyLocation)}
                placeholder={t("profile.company.locationPlaceholder")}
              />
              <span className="text-xs text-slate-500">{t("profile.company.locationHint")}</span>
              {companyFieldErrors.companyLocation ? <span className="text-xs text-rose-600">{companyFieldErrors.companyLocation}</span> : null}
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="form-label">
                {t("profile.company.city")}
                <input
                  className="input"
                  value={companyCity}
                  onChange={(event) => { setCompanyCity(event.target.value); clearCompanyFieldError("companyCity"); }}
                  minLength={2}
                  maxLength={80}
                  aria-invalid={Boolean(companyFieldErrors.companyCity)}
                />
                <span className="text-xs text-slate-500">{t("profile.company.cityHint")}</span>
                {companyFieldErrors.companyCity ? <span className="text-xs text-rose-600">{companyFieldErrors.companyCity}</span> : null}
              </label>
              <label className="form-label">
                {t("profile.company.state")}
                <input
                  className="input"
                  value={companyState}
                  onChange={(event) => { setCompanyState(event.target.value); clearCompanyFieldError("companyState"); }}
                  minLength={2}
                  maxLength={80}
                  aria-invalid={Boolean(companyFieldErrors.companyState)}
                />
                <span className="text-xs text-slate-500">{t("profile.company.stateHint")}</span>
                {companyFieldErrors.companyState ? <span className="text-xs text-rose-600">{companyFieldErrors.companyState}</span> : null}
              </label>
            </div>
            <label className="form-label">
              {t("profile.company.address")}
              <input
                className="input"
                value={companyAddress}
                onChange={(event) => { setCompanyAddress(event.target.value); clearCompanyFieldError("companyAddress"); }}
                minLength={2}
                maxLength={180}
                aria-invalid={Boolean(companyFieldErrors.companyAddress)}
              />
              <span className="text-xs text-slate-500">{t("profile.company.addressHint")}</span>
              {companyFieldErrors.companyAddress ? <span className="text-xs text-rose-600">{companyFieldErrors.companyAddress}</span> : null}
            </label>
            <label className="form-label">
              {t("profile.company.website")}
              <input
                className="input"
                value={companyWebsite}
                onChange={(event) => { setCompanyWebsite(event.target.value); clearCompanyFieldError("companyWebsite"); }}
                minLength={5}
                maxLength={240}
                aria-invalid={Boolean(companyFieldErrors.companyWebsite)}
                placeholder="https://"
              />
              <span className="text-xs text-slate-500">{t("profile.company.websiteHint")}</span>
              {companyFieldErrors.companyWebsite ? <span className="text-xs text-rose-600">{companyFieldErrors.companyWebsite}</span> : null}
            </label>
            <label className="form-label">
              {t("profile.company.instagram")}
              <input
                className="input"
                value={companyInstagram}
                onChange={(event) => { setCompanyInstagram(event.target.value); clearCompanyFieldError("companyInstagram"); }}
                minLength={2}
                maxLength={140}
                aria-invalid={Boolean(companyFieldErrors.companyInstagram)}
                placeholder="@empresa"
              />
              <span className="text-xs text-slate-500">{t("profile.company.instagramHint")}</span>
              {companyFieldErrors.companyInstagram ? <span className="text-xs text-rose-600">{companyFieldErrors.companyInstagram}</span> : null}
            </label>
            <label className="form-label">
              {t("profile.company.whatsapp")}
              <input
                className="input"
                value={companyWhatsapp}
                onChange={(event) => { setCompanyWhatsapp(event.target.value); clearCompanyFieldError("companyWhatsapp"); }}
                minLength={6}
                maxLength={32}
                aria-invalid={Boolean(companyFieldErrors.companyWhatsapp)}
                placeholder="(11) 99999-9999"
              />
              <span className="text-xs text-slate-500">{t("profile.company.whatsappHint")}</span>
              {companyFieldErrors.companyWhatsapp ? <span className="text-xs text-rose-600">{companyFieldErrors.companyWhatsapp}</span> : null}
            </label>
            <label className="form-label">
              {t("profile.company.email")}
              <input
                className="input"
                type="email"
                value={companyEmail}
                onChange={(event) => { setCompanyEmail(event.target.value); clearCompanyFieldError("companyEmail"); }}
                aria-invalid={Boolean(companyFieldErrors.companyEmail)}
                placeholder="contato@empresa.com"
              />
              <span className="text-xs text-slate-500">{t("profile.company.emailHint")}</span>
              {companyFieldErrors.companyEmail ? <span className="text-xs text-rose-600">{companyFieldErrors.companyEmail}</span> : null}
            </label>
            <label className="form-label">
              {t("profile.company.hours")}
              <input
                className="input"
                value={companyHours}
                onChange={(event) => { setCompanyHours(event.target.value); clearCompanyFieldError("companyHours"); }}
                minLength={2}
                maxLength={140}
                placeholder={t("profile.company.hoursPlaceholder")}
              />
              <span className="text-xs text-slate-500">{t("profile.company.hoursHint")}</span>
              {companyFieldErrors.companyHours ? <span className="text-xs text-rose-600">{companyFieldErrors.companyHours}</span> : null}
            </label>

            <div className="flex flex-wrap gap-4">
              <label className="form-label">
                <input
                  type="checkbox"
                  checked={companyIsOnline}
                  onChange={(event) => setCompanyIsOnline(event.target.checked)}
                />{" "}
                {t("profile.company.online")}
              </label>
              <label className="form-label">
                <input
                  type="checkbox"
                  checked={companyIsPhysical}
                  onChange={(event) => setCompanyIsPhysical(event.target.checked)}
                />{" "}
                {t("profile.company.physical")}
              </label>
            </div>

            <label className="form-label">
              {t("profile.company.photos", { max: maxPhotos })}
              <span className="text-xs text-slate-500">{t("profile.company.photosHint")}</span>
              {companyFieldErrors.companyPhotos ? <span className="text-xs text-rose-600">{companyFieldErrors.companyPhotos}</span> : null}
              {companyPhotoError ? <span className="text-xs text-rose-600">{companyPhotoError}</span> : null}
              <div className="grid gap-3 md:grid-cols-2">
                {Array.from({ length: maxPhotos }).map((_, index) => (
                  <div key={index} className="card">
                    {companyPhotos[index] ? (
                      <img className="rounded-2xl border border-slate-200 object-cover" src={companyPhotos[index]} alt="Foto" />
                    ) : (
                      <div className="text-xs text-slate-500">{t("profile.company.photoEmpty")}</div>
                    )}
                    <input
                      className="input file-input mt-3"
                      type="file"
                      accept="image/*"
                      onChange={(event) => handleCompanyPhotoUpload(index, event.target.files?.[0] || null)}
                    />
                    {companyPhotos[index] ? (
                      <button
                        type="button"
                        className="btn-outline mt-2"
                        onClick={() =>
                          setCompanyPhotos((current) => {
                            const next = [...current];
                            next[index] = "";
                            return next;
                          })
                        }
                      >
                        {t("profile.company.photoRemove")}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </label>
          </div>

          {user?.companyViews ? (
            <p className="mt-4 text-sm text-slate-600">
              {t("profile.company.views", { count: user.companyViews })}
            </p>
          ) : null}

          {saveError ? (
            <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{saveError}</div>
          ) : null}
          {saveSuccess ? (
            <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{saveSuccess}</div>
          ) : null}

          <button type="button" className="btn-primary mt-5" onClick={handleSaveCompany} disabled={isSaving}>
            {isSaving
              ? t("profile.saving")
              : companyEnabled
                ? t("profile.company.update")
                : t("profile.company.save")}
          </button>
        </div>
      </section>
    </main>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <main className="page-shell">
          <section className="section-shell">
          <div className="card">
            <div className="loader-wrap">
              <div className="loader"></div>
            </div>
          </div>
          </section>
        </main>
      }
    >
      <ProfilePageInner />
    </Suspense>
  );
}
