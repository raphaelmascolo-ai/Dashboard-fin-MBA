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
      <header className="glass sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-3 sm:px-5 py-2 sm:py-3 flex items-center justify-between gap-2">
          <NavButton href="/" label="Accueil" />
          <div className="text-sm font-bold text-[#1a1a1a] truncate text-center flex-1">
            <span className="sm:hidden">MBA Construction</span>
            <span className="hidden sm:inline">MBA Construction SA</span>
          </div>
          <HeaderActions isAdmin={isAdmin} />
        </div>
        <div className="mba-accent-bar" />
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <div className="inline-block bg-[#fef3c7] text-[#854d0e] text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md mb-2">
            Outils opérationnels
          </div>
          <h1 className="text-3xl font-bold text-[#1a1a1a] tracking-tight">MBA Construction SA</h1>
          <p className="text-[#6b7280] mt-1 text-sm">Outils du quotidien pour les chantiers.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Déclarer une commande */}
          <Link href="/commandes" className="group block">
            <div className="mba-card h-full flex flex-col">
              <div className="px-5 py-5 flex items-center gap-3 border-b border-gray-100">
                <div className="w-12 h-12 rounded-xl bg-[#fef3c7] flex items-center justify-center text-2xl shrink-0">
                  📋
                </div>
                <div>
                  <div className="text-base font-bold text-[#1a1a1a]">Déclarer une commande</div>
                  <div className="text-[11px] text-[#6b7280] mt-0.5">Saisie rapide fournisseur</div>
                </div>
              </div>
              <div className="px-5 py-5 text-sm text-[#6b7280] flex-1 leading-relaxed">
                Formulaire pour enregistrer une commande fournisseur en moins d&apos;une minute.
              </div>
              <div className="px-5 py-3 flex items-center justify-end border-t border-gray-100 bg-[#fafaf7]">
                <span className="text-xs font-bold text-[#1a1a1a] group-hover:text-[#ca8a04] transition-colors">Ouvrir le formulaire →</span>
              </div>
            </div>
          </Link>

          {/* Planning Chantiers */}
          <Link href="/planning" className="group block">
            <div className="mba-card h-full flex flex-col">
              <div className="px-5 py-5 flex items-center gap-3 border-b border-gray-100">
                <div className="w-12 h-12 rounded-xl bg-[#fef3c7] flex items-center justify-center text-2xl shrink-0">
                  📅
                </div>
                <div>
                  <div className="text-base font-bold text-[#1a1a1a]">Planning Chantiers</div>
                  <div className="text-[11px] text-[#6b7280] mt-0.5">Ouvriers × jours × chantiers</div>
                </div>
              </div>
              <div className="px-5 py-5 text-sm text-[#6b7280] flex-1 leading-relaxed">
                Planning hebdomadaire visuel : glissez-déposez les ouvriers sur les chantiers.
              </div>
              <div className="px-5 py-3 flex items-center justify-end border-t border-gray-100 bg-[#fafaf7]">
                <span className="text-xs font-bold text-[#1a1a1a] group-hover:text-[#ca8a04] transition-colors">Ouvrir le planning →</span>
              </div>
            </div>
          </Link>

          {/* Vue annuelle chantiers */}
          <Link href="/planning/annuel" className="group block">
            <div className="mba-card h-full flex flex-col">
              <div className="px-5 py-5 flex items-center gap-3 border-b border-gray-100">
                <div className="w-12 h-12 rounded-xl bg-[#fef3c7] flex items-center justify-center text-2xl shrink-0">
                  🗓️
                </div>
                <div>
                  <div className="text-base font-bold text-[#1a1a1a]">Vue annuelle chantiers</div>
                  <div className="text-[11px] text-[#6b7280] mt-0.5">Kanban semaine par semaine</div>
                </div>
              </div>
              <div className="px-5 py-5 text-sm text-[#6b7280] flex-1 leading-relaxed">
                52 colonnes pour planifier les chantiers à long terme. Chantiers partagés avec le planning hebdo.
              </div>
              <div className="px-5 py-3 flex items-center justify-end border-t border-gray-100 bg-[#fafaf7]">
                <span className="text-xs font-bold text-[#1a1a1a] group-hover:text-[#ca8a04] transition-colors">Ouvrir la vue →</span>
              </div>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
