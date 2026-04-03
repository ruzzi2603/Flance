"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { registerSchema } from "../../../services/schemas";
import { register } from "../../../services/auth";
import { useAuthStore } from "../../../store/useAuthStore";

export default function RegisterPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [avatarUrl, setAvatarUrl] = useState("avatar-sky");
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const avatarIsImage = avatarUrl.startsWith("data:") || avatarUrl.startsWith("http");

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
      setFormError(message || "Nao foi possivel criar a conta.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="section-shell">
        <div className="card-lg">
          <h1 className="heading-xl">Criar conta</h1>
          <p className="mt-2 text-muted">Cadastre-se para acessar empresas e divulgar seu servico.</p>

          <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
            <label className="form-label">
              Nome completo
              <input className="input" name="name" placeholder="Seu nome" />
              {fieldErrors.name ? <span className="text-xs text-rose-600">{fieldErrors.name}</span> : null}
            </label>
            <label className="form-label">
              Email
              <input className="input" name="email" placeholder="voce@exemplo.com" />
              {fieldErrors.email ? <span className="text-xs text-rose-600">{fieldErrors.email}</span> : null}
            </label>
            <label className="form-label">
              Senha
              <input className="input" name="password" type="password" placeholder="Minimo 8 caracteres" />
              {fieldErrors.password ? <span className="text-xs text-rose-600">{fieldErrors.password}</span> : null}
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

            {formError ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</div> : null}

            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Criando conta..." : "Criar conta"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

