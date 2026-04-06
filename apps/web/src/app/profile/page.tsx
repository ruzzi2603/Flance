"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "../../hooks/useAuth";
import { updateProfile } from "../../services/users";
import { useAuthStore } from "../../store/useAuthStore";

const plans = [
  { id: "FREE", label: "Teste gratuito", price: "R$ 0", limit: "1 empresa" },
  { id: "BASIC", label: "Plano Essencial", price: "R$ 29,99", limit: "2 empresas" },
  { id: "PRO", label: "Plano Profissional", price: "R$ 39,99", limit: "5 empresas" },
  { id: "PREMIUM", label: "Plano Premium", price: "R$ 59,99", limit: "10 empresas" },
];

function ProfilePageInner() {
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();
  const { setUser } = useAuthStore();

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
      setAvatarError("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("A imagem precisa ter ate 2MB.");
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
      setCompanyPhotoError("Selecione uma imagem valida.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setCompanyPhotoError("Cada foto precisa ter ate 2MB.");
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
      setSaveError("Informe um nome valido.");
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
      setSaveSuccess("Perfil atualizado com sucesso.");
    } catch (error) {
      const message =
        typeof error === "object" && error && "response" in error
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (error as any).response?.data?.message
          : null;
      setSaveError(message || "Nao foi possivel salvar. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveCompany() {
    setSaveError(null);
    setSaveSuccess(null);
    setCompanyPhotoError(null);
    if (!selectedPlan) {
      setSaveError("Selecione um plano para continuar.");
      return;
    }
    if (!companyName.trim()) {
      setSaveError("Informe o nome da empresa.");
      return;
    }
    if (!companyDescription.trim()) {
      setSaveError("Descreva o que sua empresa faz.");
      return;
    }
    if (companyPhotos.filter(Boolean).length > maxPhotos) {
      setCompanyPhotoError(`Voce pode enviar no maximo ${maxPhotos} fotos neste plano.`);
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
        setSaveSuccess("Empresa atualizada com sucesso.");
      }
    } catch (error) {
      const message =
        typeof error === "object" && error && "response" in error
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (error as any).response?.data?.message
          : null;
      setSaveError(message || "Nao foi possivel salvar a empresa.");
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
            <span>Empresa cadastrada no plano gratuito</span>
          </div>
        ) : null}
        {showPaymentScreen ? (
          <div className="payment-overlay">
            <div className="payment-card">
              <h2 className="heading-lg">Confirmar plano</h2>
              <p className="mt-2 text-muted">
                Plano selecionado: {plans.find((plan) => plan.id === selectedPlan)?.label}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Valor: {plans.find((plan) => plan.id === selectedPlan)?.price}
              </p>
              <p className="mt-4 text-sm text-slate-600">
                Em seguida vamos integrar o pagamento real com seguranca.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  className="btn-outline"
                  type="button"
                  onClick={() => setShowPaymentScreen(false)}
                >
                  Voltar
                </button>
                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => setShowPaymentScreen(false)}
                >
                  Continuar para pagamento
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
              <h1 className="heading-lg">{name || user?.name || "Perfil"}</h1>
              <p className="text-muted">{user?.email}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="form-label">
              Nome de exibicao
              <input
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Seu nome"
              />
            </label>
            <label className="form-label">
              Sobre voce
              <textarea
                className="textarea"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder="Conte um pouco sobre voce"
              />
            </label>
            <div className="form-label">
              Foto de perfil
              <label className="form-label">
                Enviar foto da galeria
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
                    <span className="text-xs text-slate-600">Foto</span>
                  </label>
                ) : null}
                {[
                  { id: "avatar-sky", label: "Azul" },
                  { id: "avatar-amber", label: "Amarelo" },
                  { id: "avatar-emerald", label: "Verde" },
                  { id: "avatar-rose", label: "Rosa" },
                  { id: "avatar-violet", label: "Violeta" },
                  { id: "avatar-slate", label: "Cinza" },
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
              {isSaving ? "Salvando..." : "Salvar perfil"}
            </button>
          </div>
        </div>

        <div className="card mt-8">
          <h2 className="heading-lg">Minha empresa</h2>
          <p className="mt-2 text-muted">
            Escolha um plano e preencha os dados para divulgar sua empresa ou servico.
          </p>

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
                    <span>{plan.price}</span>
                  </div>
                  <div className="card-content">
                    <div className="title">Limite: {plan.limit}</div>
                    <div className="plain">
                      <p>{plan.price}</p>
                      <p>por mes</p>
                    </div>
                    <div className="card-separate">
                      <span>Plano</span>
                      <span className="separate" />
                    </div>
                    <div className="card-list-features">
                      <div className="option">
                        <span>-</span>
                        <span>Cadastro de empresas</span>
                      </div>
                      <div className="option">
                        <span>-</span>
                        <span>Perfil publico</span>
                      </div>
                      <div className="option">
                        <span>-</span>
                        <span>Contato via chat</span>
                      </div>
                    </div>
                    <span className="card-btn">Selecionar plano</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-4">
            <label className="form-label">
              Nome da empresa
              <input
                className="input"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Ex: Flance Solucoes"
              />
            </label>
            <label className="form-label">
              CNPJ (opcional)
              <input
                className="input"
                value={companyCnpj}
                onChange={(event) => setCompanyCnpj(event.target.value)}
                placeholder="00.000.000/0001-00"
              />
            </label>
            <label className="form-label">
              O que a empresa faz
              <textarea
                className="textarea"
                value={companyDescription}
                onChange={(event) => setCompanyDescription(event.target.value)}
                placeholder="Descreva seus servicos e diferenciais"
              />
            </label>
            <label className="form-label">
              Localizacao
              <input
                className="input"
                value={companyLocation}
                onChange={(event) => setCompanyLocation(event.target.value)}
                placeholder="Ex: Sao Paulo - SP"
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="form-label">
                Cidade
                <input
                  className="input"
                  value={companyCity}
                  onChange={(event) => setCompanyCity(event.target.value)}
                />
              </label>
              <label className="form-label">
                Estado
                <input
                  className="input"
                  value={companyState}
                  onChange={(event) => setCompanyState(event.target.value)}
                />
              </label>
            </div>
            <label className="form-label">
              Endereco completo
              <input
                className="input"
                value={companyAddress}
                onChange={(event) => setCompanyAddress(event.target.value)}
              />
            </label>
            <label className="form-label">
              Site
              <input
                className="input"
                value={companyWebsite}
                onChange={(event) => setCompanyWebsite(event.target.value)}
                placeholder="https://"
              />
            </label>
            <label className="form-label">
              Instagram
              <input
                className="input"
                value={companyInstagram}
                onChange={(event) => setCompanyInstagram(event.target.value)}
                placeholder="@empresa"
              />
            </label>
            <label className="form-label">
              WhatsApp
              <input
                className="input"
                value={companyWhatsapp}
                onChange={(event) => setCompanyWhatsapp(event.target.value)}
                placeholder="(11) 99999-9999"
              />
            </label>
            <label className="form-label">
              Email comercial
              <input
                className="input"
                value={companyEmail}
                onChange={(event) => setCompanyEmail(event.target.value)}
                placeholder="contato@empresa.com"
              />
            </label>
            <label className="form-label">
              Horario de funcionamento
              <input
                className="input"
                value={companyHours}
                onChange={(event) => setCompanyHours(event.target.value)}
                placeholder="Seg a Sex, 08:00 as 18:00"
              />
            </label>

            <div className="flex flex-wrap gap-4">
              <label className="form-label">
                <input
                  type="checkbox"
                  checked={companyIsOnline}
                  onChange={(event) => setCompanyIsOnline(event.target.checked)}
                />{" "}
                Atendimento online
              </label>
              <label className="form-label">
                <input
                  type="checkbox"
                  checked={companyIsPhysical}
                  onChange={(event) => setCompanyIsPhysical(event.target.checked)}
                />{" "}
                Atendimento presencial
              </label>
            </div>

            <label className="form-label">
              Fotos da empresa (ate {maxPhotos})
              <div className="grid gap-3 md:grid-cols-2">
                {Array.from({ length: maxPhotos }).map((_, index) => (
                  <div key={index} className="card">
                    {companyPhotos[index] ? (
                      <img className="rounded-2xl border border-slate-200 object-cover" src={companyPhotos[index]} alt="Foto" />
                    ) : (
                      <div className="text-xs text-slate-500">Nenhuma foto selecionada</div>
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
                        Remover foto
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </label>
          </div>

          {user?.companyViews ? (
            <p className="mt-4 text-sm text-slate-600">Visualizacoes: {user.companyViews}</p>
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
            {isSaving ? "Salvando..." : companyEnabled ? "Atualizar empresa" : "Ativar empresa"}
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
