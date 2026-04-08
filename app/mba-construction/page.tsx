import Link from "next/link";
import { createClient } from "../lib/supabase/server";
import HeaderActions from "../components/HeaderActions";
import NavButton from "../components/NavButton";

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
        <div className="max-w-5xl mx-auto px-3 sm:px-5 py-2 sm:py-3 flex items-center justify-between gap-2">
          <NavButton href="/" label="Accueil" />
          <div className="text-sm font-semibold text-[#1d1d1f] truncate text-center flex-1">
            <span className="sm:hidden">MBA Construction</span>
            <span className="hidden sm:inline">MBA Construction SA</span>
          </div>
          <HeaderActions isAdmin={isAdmin} />
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

          {/* Planning Chantiers */}
          <Link href="/planning" className="group block">
            <div className="glass-card rounded-2xl overflow-hidden transition-all duration-300 group-hover:-translate-y-1 h-full flex flex-col">
              <div className="px-5 py-4 flex items-center gap-3 border-b border-white/30">
                <span className="text-2xl">📅</span>
                <div>
                  <div className="text-base font-semibold text-[#1d1d1f]">Planning Chantiers</div>
                  <div className="text-[11px] text-[#86868b] mt-0.5">Ouvriers × jours × chantiers</div>
                </div>
              </div>
              <div className="px-5 py-5 text-sm text-[#86868b] flex-1">
                Planning hebdomadaire visuel : glissez-déposez les ouvriers sur les chantiers.
              </div>
              <div className="px-5 py-3 flex items-center justify-end border-t border-white/30 bg-white/20">
                <span className="text-xs font-semibold text-[#0071e3] group-hover:underline">Ouvrir le planning →</span>
              </div>
            </div>
          </Link>

          {/* Vue annuelle chantiers */}
          <Link href="/planning/annuel" className="group block">
            <div className="glass-card rounded-2xl overflow-hidden transition-all duration-300 group-hover:-translate-y-1 h-full flex flex-col">
              <div className="px-5 py-4 flex items-center gap-3 border-b border-white/30">
                <span className="text-2xl">🗓️</span>
                <div>
                  <div className="text-base font-semibold text-[#1d1d1f]">Vue annuelle chantiers</div>
                  <div className="text-[11px] text-[#86868b] mt-0.5">Kanban semaine par semaine</div>
                </div>
              </div>
              <div className="px-5 py-5 text-sm text-[#86868b] flex-1">
                52 colonnes pour planifier les chantiers à long terme. Glissez librement, les chantiers sont partagés avec le planning hebdo.
              </div>
              <div className="px-5 py-3 flex items-center justify-end border-t border-white/30 bg-white/20">
                <span className="text-xs font-semibold text-[#5856d6] group-hover:underline">Ouvrir la vue →</span>
              </div>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
