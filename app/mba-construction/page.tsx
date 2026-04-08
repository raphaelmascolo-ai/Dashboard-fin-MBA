import Image from "next/image";
import Link from "next/link";
import { createClient } from "../lib/supabase/server";
import HeaderActions from "../components/HeaderActions";

export default async function MbaConstructionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).single();
    isAdmin = profile?.role === "admin";
  }

  return (
    <div className="min-h-screen bg-warm">
      <header className="glass sticky top-0 z-20 border-b border-white/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="relative w-9 h-9 shrink-0">
              <Image src="/logo.png" alt="MBA Groupe SA" fill className="object-contain" />
            </div>
            <div className="min-w-0">
              <div className="text-base font-semibold text-[#1d1d1f] truncate">MBA Construction SA</div>
              <div className="text-[11px] text-[#86868b] tracking-wide truncate">Outils opérationnels</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/"
              title="Accueil"
              className="text-xs font-medium text-[#86868b] hover:text-[#1d1d1f] bg-white/40 hover:bg-white/60 border border-white/30 rounded-xl px-2.5 sm:px-3 py-2 transition-all"
            >
              <span aria-hidden>←</span>
              <span className="hidden sm:inline ml-1">Accueil</span>
            </Link>
            <HeaderActions isAdmin={isAdmin} />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[#1d1d1f]">MBA Construction SA</h1>
          <p className="text-[#86868b] mt-1 text-sm">Outils opérationnels du quotidien.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Déclarer une commande */}
          <Link href="/commandes" className="group block">
            <div className="glass-card rounded-2xl overflow-hidden transition-all duration-300 group-hover:-translate-y-1 h-full flex flex-col">
              <div className="px-5 py-4 flex items-center gap-3 border-b border-white/30">
                <span className="text-2xl">📋</span>
                <div>
                  <div className="text-base font-semibold text-[#1d1d1f]">Déclarer une commande</div>
                  <div className="text-[11px] text-[#86868b] mt-0.5">Saisie rapide fournisseur</div>
                </div>
              </div>
              <div className="px-5 py-5 text-sm text-[#86868b] flex-1">
                Formulaire pour enregistrer une commande fournisseur en moins d&apos;une minute.
              </div>
              <div className="px-5 py-3 flex items-center justify-end border-t border-white/30 bg-white/20">
                <span className="text-xs font-semibold text-[#34c759] group-hover:underline">Ouvrir le formulaire →</span>
              </div>
            </div>
          </Link>

          {/* Placeholder */}
          <div className="glass-card rounded-2xl flex flex-col items-center justify-center py-10 px-6 text-center opacity-50">
            <div className="text-3xl mb-3 text-[#86868b]">＋</div>
            <div className="text-sm font-medium text-[#86868b]">Bientôt disponible</div>
            <div className="text-xs text-[#aeaeb2] mt-1">Nouveaux outils à venir</div>
          </div>
        </div>
      </main>
    </div>
  );
}
