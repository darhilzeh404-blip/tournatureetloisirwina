import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Mail, Lock, User, Phone, Eye, EyeOff, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { FlagGabon } from "@/components/FlagGabon";

export const Route = createFileRoute("/inscription")({
  head: () => ({
    meta: [
      { title: "Inscription — WINA TOUR" },
      { name: "description", content: "Créez votre compte WINA TOUR en quelques étapes." },
      { property: "og:title", content: "Inscription — WINA TOUR" },
      { property: "og:description", content: "Créez votre compte WINA TOUR en quelques étapes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InscriptionPage,
});

// Architecture ouverte : ajouter d'autres pays ici plus tard.
const COUNTRIES = [
  { code: "GA", flag: "🇬🇦", name: "Gabon", dial: "+241", minDigits: 8, maxDigits: 9 },
] as const;

const TOTAL_STEPS = 6;

function InscriptionPage() {
  const { signUp, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [country, setCountry] = useState<(typeof COUNTRIES)[number]>(COUNTRIES[0]);
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate({ to: "/espace-client" });
  }, [isAuthenticated, navigate]);

  const digits = phone.replace(/\D/g, "");
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  const validate = (s: number): string | null => {
    if (s === 1) {
      if (!digits) return "Veuillez saisir votre numéro de téléphone.";
      if (digits.length < country.minDigits || digits.length > country.maxDigits)
        return `Le numéro doit contenir ${country.minDigits} à ${country.maxDigits} chiffres.`;
    }
    if (s === 2) {
      if (!firstName.trim()) return "Veuillez saisir votre prénom.";
      if (!lastName.trim()) return "Veuillez saisir votre nom.";
    }
    if (s === 3 && !emailOk) return "Adresse email invalide.";
    if (s === 4) {
      if (password.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
      if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
        return "Le mot de passe doit contenir des lettres et des chiffres.";
    }
    if (s === 5 && password !== confirm) return "Les mots de passe ne correspondent pas.";
    return null;
  };

  const next = () => {
    const err = validate(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const back = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const handleCreate = async () => {
    const err = validate(5);
    if (err) {
      setError(err);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      await signUp(email.trim(), password, fullName, `${country.dial}${digits}`);
      toast.success("Compte créé avec succès !");
      navigate({ to: "/espace-client" });
    } catch (e: any) {
      const msg = e?.message || "Erreur lors de l'inscription";
      setError(msg);
      toast.error(msg);
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-2xl border bg-background px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50";

  return (
    <section className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-10 pt-6">
      <div className="flex items-center gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={back}
            aria-label="Étape précédente"
            className="flex h-10 w-10 items-center justify-center rounded-full border"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <img src="/icon-192.png" alt="WINA TOUR" className="h-10 w-10 rounded-xl" />
        <span className="text-sm font-bold tracking-tight">WINA TOUR</span>
      </div>

      {/* Progression */}
      <div className="mt-6">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Étape {step + 1} / {TOTAL_STEPS}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1 py-8">
        {step === 0 && (
          <div>
            <h1 className="text-2xl font-extrabold">Dans quel pays êtes-vous ?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              D'autres pays seront disponibles prochainement.
            </p>
            <div className="mt-6 space-y-2.5">
              {COUNTRIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setCountry(c)}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${
                    country.code === c.code ? "border-primary bg-primary/5" : "bg-card"
                  }`}
                >
                  <FlagGabon className="h-6 w-9" />
                  <span className="flex-1">
                    <span className="block text-sm font-bold">{c.name}</span>
                    <span className="block text-xs text-muted-foreground">{c.dial}</span>
                  </span>
                  {country.code === c.code && <Check className="h-5 w-5 text-primary" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 className="text-2xl font-extrabold">Votre numéro de téléphone</h1>
            <p className="mt-1 text-sm text-muted-foreground">Nous l'utilisons pour vos réservations.</p>
            <div className="mt-6 flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-2xl border bg-muted/40 px-3 py-3.5 text-base font-semibold">
                <FlagGabon className="h-4 w-6" /> {country.dial}
              </span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="06 00 00 00"
                className={inputClass}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="text-2xl font-extrabold">Comment vous appelez-vous ?</h1>
            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4 text-muted-foreground" /> Prénom
                </label>
                <input
                  type="text"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jean"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4 text-muted-foreground" /> Nom
                </label>
                <input
                  type="text"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Ndong"
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="text-2xl font-extrabold">Votre adresse email</h1>
            <p className="mt-1 text-sm text-muted-foreground">Elle servira à vous connecter.</p>
            <label className="mb-1.5 mt-6 flex items-center gap-2 text-sm font-medium">
              <Mail className="h-4 w-4 text-muted-foreground" /> Adresse email
            </label>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              className={inputClass}
            />
          </div>
        )}

        {step === 4 && (
          <div>
            <h1 className="text-2xl font-extrabold">Créez votre mot de passe</h1>
            <label className="mb-1.5 mt-6 flex items-center gap-2 text-sm font-medium">
              <Lock className="h-4 w-4 text-muted-foreground" /> Mot de passe
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 caractères"
                className={inputClass + " pr-12"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Masquer" : "Afficher"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <ul className="mt-4 space-y-1.5 text-xs">
              {[
                { ok: password.length >= 8, label: "Au moins 8 caractères" },
                { ok: /[A-Za-z]/.test(password), label: "Au moins une lettre" },
                { ok: /\d/.test(password), label: "Au moins un chiffre" },
              ].map((r) => (
                <li
                  key={r.label}
                  className={r.ok ? "flex items-center gap-2 text-primary" : "flex items-center gap-2 text-muted-foreground"}
                >
                  <Check className="h-3.5 w-3.5" /> {r.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {step === 5 && (
          <div>
            <h1 className="text-2xl font-extrabold">Confirmez votre mot de passe</h1>
            <label className="mb-1.5 mt-6 flex items-center gap-2 text-sm font-medium">
              <Lock className="h-4 w-4 text-muted-foreground" /> Confirmer le mot de passe
            </label>
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              className={inputClass}
            />
            <div className="mt-4 rounded-2xl border bg-card p-4 text-sm">
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" /> {country.dial}
                {digits}
              </p>
              <p className="mt-1.5 flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" /> {firstName} {lastName}
              </p>
              <p className="mt-1.5 flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" /> {email}
              </p>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {step < TOTAL_STEPS - 1 ? (
          <button
            type="button"
            onClick={next}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground"
          >
            Continuer <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCreate}
            disabled={loading}
            className="w-full rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {loading ? "Création de votre compte..." : "Créer mon compte"}
          </button>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Déjà un compte ?{" "}
          <Link to="/connexion" className="font-medium text-primary hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </section>
  );
}
