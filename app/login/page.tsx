"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "../lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("Email ou mot de passe incorrect.");
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-warm flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-14 h-14 mb-4">
            <Image src="/logo.png" alt="MBA Groupe SA" fill className="object-contain" />
          </div>
          <div className="text-xl font-semibold text-[#1d1d1f]">MBA Groupe SA</div>
          <div className="text-xs text-[#86868b] tracking-widest uppercase mt-1">Wealth Management</div>
        </div>

        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-white/40">
            <div className="text-[#1d1d1f] font-semibold text-base">Connexion</div>
            <div className="text-[#86868b] text-xs mt-0.5">Accès réservé aux collaborateurs</div>
          </div>
          <form onSubmit={handleSubmit} className="px-6 py-6 flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-[#86868b] block mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-[#d2d2d7] rounded-xl px-3.5 py-2.5 text-sm bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#d4a574]/50 focus:border-[#d4a574] transition-all"
                placeholder="votre@email.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#86868b] block mb-1.5">Mot de passe</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-[#d2d2d7] rounded-xl px-3.5 py-2.5 text-sm bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#d4a574]/50 focus:border-[#d4a574] transition-all"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div className="text-[#ff3b30] text-sm bg-[#ff3b30]/5 border border-[#ff3b30]/10 rounded-xl px-3.5 py-2.5">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1d1d1f] text-white font-medium rounded-xl py-2.5 text-sm hover:bg-[#333] transition-colors disabled:opacity-50"
            >
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-[#86868b] mt-6">
          Vous n'avez pas de compte ? Contactez l'administrateur.
        </p>
      </div>
    </div>
  );
}
