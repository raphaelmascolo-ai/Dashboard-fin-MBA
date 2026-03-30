import Image from "next/image";
import Link from "next/link";
import { mortgages, formatCHF, companies, isExpired, isExpiringSoon, ratio, calcAnnualInterest, annualRent } from "./data";

function eff(m: Parameters<typeof ratio>[0], v: number) { return v * ratio(m); }

// ── Modules disponibles ───────────────────────────────────────────────────────
// Pour ajouter une nouvelle carte : ajouter un objet dans ce tableau.
const modules = [
  {
    href: "/hypotheques",
    icon: "🏦",
    title: "Hypothèques",
    description: "Suivi des contrats, soldes, taux et échéances par société",
    stats: () => {
      const active = mortgages.filter(m => new Date(m.endDate) > new Date("2026-03-27"));
      const totalToday = mortgages.reduce((s, m) => s + eff(m, m.remainingToday), 0);
      const totalIntAnnual = mortgages.reduce((s, m) => s + calcAnnualInterest(m), 0);
      const expiredCount = mortgages.filter(isExpired).length;
      const soonCount = mortgages.filter(isExpiringSoon).length;
      return [
        { label: "Encours total", value: formatCHF(totalToday), gold: true },
        { label: "Intérêts annuels", value: formatCHF(totalIntAnnual) },
        { label: "Contrats actifs", value: `${active.length} / ${mortgages.length}` },
        { label: "Alertes", value: `${expiredCount + soonCount}`, red: (expiredCount + soonCount) > 0 },
      ];
    },
    color: "border-amber-400",
  },
  // Prochaines modules — décommenter quand prêt :
  // { href: "/biens", icon: "🏠", title: "Biens immobiliers", description: "...", stats: () => [], color: "border-gray-300" },
  // { href: "/analyses", icon: "📈", title: "Analyses", description: "...", stats: () => [], color: "border-gray-300" },
];

export default function Home() {
  const today = new Date("2026-03-27").toLocaleDateString("fr-CH", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-stone-100">
      {/* Header */}
      <header className="bg-black text-white shadow-md">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative w-10 h-10 shrink-0">
              <Image src="/logo.png" alt="MBA Groupe SA" fill className="object-contain" />
            </div>
            <div>
              <div className="text-lg font-bold text-white leading-tight">MBA Groupe SA</div>
              <div className="text-[11px] text-gray-400 uppercase tracking-wider mt-0.5">Wealth Management</div>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-[11px] text-gray-500 uppercase tracking-wide">Données au</div>
            <div className="text-sm font-semibold text-gray-300">{today}</div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-gray-500 mt-1 text-sm">Sélectionnez un module pour accéder aux données.</p>
        </div>

        {/* Module cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {modules.map((mod) => {
            const stats = mod.stats();
            return (
              <Link key={mod.href} href={mod.href} className="group block">
                <div className={`bg-white rounded-2xl border-2 ${mod.color} shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden group-hover:-translate-y-0.5`}>
                  {/* Card header */}
                  <div className="bg-black px-5 py-4 flex items-center gap-3">
                    <span className="text-2xl">{mod.icon}</span>
                    <div>
                      <div className="text-base font-bold text-white">{mod.title}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">{mod.description}</div>
                    </div>
                  </div>
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-px bg-gray-100">
                    {stats.map((s) => (
                      <div key={s.label} className="bg-white px-4 py-3">
                        <div className="text-[10px] text-gray-400 uppercase tracking-wide">{s.label}</div>
                        <div className={`text-sm font-bold mt-0.5 ${
                          "gold" in s && s.gold ? "text-amber-600"
                          : "red" in s && s.red ? "text-red-600"
                          : "text-gray-900"
                        }`}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  {/* Footer */}
                  <div className="px-5 py-3 flex items-center justify-between">
                    <span className="text-xs text-gray-400">{companies.length} sociétés</span>
                    <span className="text-xs font-semibold text-amber-600 group-hover:underline">Ouvrir →</span>
                  </div>
                </div>
              </Link>
            );
          })}

          {/* Placeholder — future modules */}
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center py-10 px-6 text-center">
            <div className="text-3xl mb-3">＋</div>
            <div className="text-sm font-semibold text-gray-400">Nouveau module</div>
            <div className="text-xs text-gray-300 mt-1">Bientôt disponible</div>
          </div>
        </div>
      </main>

      <footer className="text-center text-[11px] text-gray-400 pb-8 mt-4">
        MBA Groupe SA · {today}
      </footer>
    </div>
  );
}
