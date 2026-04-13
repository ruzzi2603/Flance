"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "../../hooks/useAuth";
import { updateProfile } from "../../services/users";
import { useAuthStore } from "../../store/useAuthStore";
import { useI18n } from "../../i18n/useI18n";

function ProfilePageInner() {
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();
  const { setUser } = useAuthStore();
  const { t, formatCurrency } = useI18n();

  const plans = useMemo(
    () => [
      { id: "FREE", label: t("plans.free.title"), price: 0, limit: 1 },
      { id: "BASIC", label: t("plans.essential.title"), price: 29.99, limit: 2 },
      { id: "PRO", label: t("plans.professional.title"), price: 39.99, limit: 5 },
      { id: "PREMIUM", label: t("plans.premium.title"), price: 59.99, limit: 10 },
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
  const [showCompanySuccess, setShowCompanySuccess] = useState(false);
  const [showPaymentScreen, setShowPaymentScreen] = useState(false);

  const avatarIsImage = avatarUrl.startsWith("data:") || avatarUrl.startsWith("http");
  const maxPhotos = useMemo(() => {
    if (selectedPlan === "FREE" || !selectedPlan) return 3;
    if (selectedPlan === "BASIC") return 6;
    if (selectedPlan === "PRO") return 10;
    return 20;
  }, [selectedPlan]);

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
      setSelectedPlan(user.planTier || null);
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
  }, [user]);

  useEffect(() => {
    const planFromUrl = searchParams.get("plan");
    if (planFromUrl) {
      setSelectedPlan(planFromUrl);
    }
  }, [searchParams]);

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
    if (!selectedPlan) {
      setSaveError(t("profile.company.planRequired"));
      return;
    }
    if (!companyName.trim()) {
      setSaveError(t("profile.company.nameRequired"));
      return;
    }
    if (!companyDescription.trim()) {
      setSaveError(t("profile.company.descriptionRequired"));
      return;
    }
    if (companyPhotos.filter(Boolean).length > maxPhotos) {
      setCompanyPhotoError(t("profile.company.photoErrorLimit", { max: maxPhotos }));
      return;
    }
    setIsSaving(true);
    try {
      const enableCompany = companyEnabled || selectedPlan === "FREE";
      const updated = await updateProfile({
        planTier: selectedPlan as "FREE" | "BASIC" | "PRO" | "PREMIUM",
        companyEnabled: enableCompany,
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
        companyIsOnline,
        companyIsPhysical,
        companyPhotos: companyPhotos.filter(Boolean),
      });
      setUser(updated);
      setCompanyEnabled(enableCompany);
      if (selectedPlan === "FREE") {
        setShowCompanySuccess(true);
        setTimeout(() => {
          setShowCompanySuccess(false);
          window.location.href = `/empresas/${updated.id}`;
        }, 1800);
      } else if (!companyEnabled) {
        setShowPaymentScreen(true);
      } else {
        setSaveSuccess(t("profile.company.saveSuccess"));
      }
    } catch (error) {
      const message =
        typeof error === "object" && error && "response" in error
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (error as any).response?.data?.message
          : null;
      setSaveError(message || t("profile.company.saveError"));
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
              <h2 className="heading-lg">{t("profile.company.paymentTitle")}</h2>
              <p className="mt-2 text-muted">
                {t("profile.company.paymentSelected", {
                  plan: plans.find((plan) => plan.id === selectedPlan)?.label || "",
                })}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {t("profile.company.paymentValue", {
                  value: formatCurrency(plans.find((plan) => plan.id === selectedPlan)?.price ?? 0),
                })}
              </p>
              <p className="mt-4 text-sm text-slate-600">
                {t("profile.company.paymentNote")}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
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
                  onClick={() => setShowPaymentScreen(false)}
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

        <div className="card mt-8">
          <h2 className="heading-lg">{t("profile.company.sectionTitle")}</h2>
          <p className="mt-2 text-muted">{t("profile.company.sectionSubtitle")}</p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
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
                      <div className="option">
                        <span>-</span>
                        <span>{t("plans.free.feature1")}</span>
                      </div>
                      <div className="option">
                        <span>-</span>
                        <span>{t("plans.free.feature2")}</span>
                      </div>
                      <div className="option">
                        <span>-</span>
                        <span>{t("plans.free.feature3")}</span>
                      </div>
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
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder={t("profile.company.namePlaceholder")}
              />
            </label>
            <label className="form-label">
              {t("profile.company.cnpj")}
              <input
                className="input"
                value={companyCnpj}
                onChange={(event) => setCompanyCnpj(event.target.value)}
                placeholder={t("profile.company.cnpjPlaceholder")}
              />
            </label>
            <label className="form-label">
              {t("profile.company.description")}
              <textarea
                className="textarea"
                value={companyDescription}
                onChange={(event) => setCompanyDescription(event.target.value)}
                placeholder={t("profile.company.descriptionPlaceholder")}
              />
            </label>
            <label className="form-label">
              {t("profile.company.location")}
              <input
                className="input"
                value={companyLocation}
                onChange={(event) => setCompanyLocation(event.target.value)}
                placeholder={t("profile.company.locationPlaceholder")}
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="form-label">
                {t("profile.company.city")}
                <input
                  className="input"
                  value={companyCity}
                  onChange={(event) => setCompanyCity(event.target.value)}
                />
              </label>
              <label className="form-label">
                {t("profile.company.state")}
                <input
                  className="input"
                  value={companyState}
                  onChange={(event) => setCompanyState(event.target.value)}
                />
              </label>
            </div>
            <label className="form-label">
              {t("profile.company.address")}
              <input
                className="input"
                value={companyAddress}
                onChange={(event) => setCompanyAddress(event.target.value)}
              />
            </label>
            <label className="form-label">
              {t("profile.company.website")}
              <input
                className="input"
                value={companyWebsite}
                onChange={(event) => setCompanyWebsite(event.target.value)}
                placeholder="https://"
              />
            </label>
            <label className="form-label">
              {t("profile.company.instagram")}
              <input
                className="input"
                value={companyInstagram}
                onChange={(event) => setCompanyInstagram(event.target.value)}
                placeholder="@empresa"
              />
            </label>
            <label className="form-label">
              {t("profile.company.whatsapp")}
              <input
                className="input"
                value={companyWhatsapp}
                onChange={(event) => setCompanyWhatsapp(event.target.value)}
                placeholder="(11) 99999-9999"
              />
            </label>
            <label className="form-label">
              {t("profile.company.email")}
              <input
                className="input"
                value={companyEmail}
                onChange={(event) => setCompanyEmail(event.target.value)}
                placeholder="contato@empresa.com"
              />
            </label>
            <label className="form-label">
              {t("profile.company.hours")}
              <input
                className="input"
                value={companyHours}
                onChange={(event) => setCompanyHours(event.target.value)}
                placeholder={t("profile.company.hoursPlaceholder")}
              />
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

          {companyPhotoError ? (
            <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{companyPhotoError}</div>
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
