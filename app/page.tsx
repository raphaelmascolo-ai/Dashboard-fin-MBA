import Image from "next/image";
import Link from "next/link";
import { createClient } from "./lib/supabase/server";
import { formatCHF, isExpired, isExpiringSoon, calcAnnualInterest, ratio, type Mortgage } from "./data";
import HeaderActions from "./components/HeaderActions";
import { isLeasingEndingSoon, isLeasingExpired, formatCHF as formatVHC, type Vehicle } from "./vehicules/data";

function eff(m: Mortgage, v: number) { return v * ratio(m); }

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).single();
    isAdmin = profile?.role === "admin";
  }

  let mortgages: Mortgage[] = [];
  if (user) {
    const { data } = await supabase.from("mortgages").select("*").order("company");
    if (data) {
      mortgages = data.map((r: Record<string, unknown>) => ({
        id: r.id as string, label: r.label as string, company: r.company as string,
        totalAmount: r.total_amount as number, startDate: r.start_date as string,
        endDate: r.end_date as string, rateType: r.rate_type as "fixed" | "saron",
        rate: r.rate as number, annualAmortization: r.annual_amortization as number,
        quarterlyAmortization: r.quarterly_amortization as number,
        remainingAtEnd: r.remaining_at_end as number, remainingToday: r.remaining_today as number,
        propertyValue: r.property_value as number | null,
        propertyGroup: r.property_group as string | undefined,
        shared: r.shared as boolean, monthlyRent: r.monthly_rent as number,
      }));
    }
  }

  let vhcList: Vehicle[] = [];
  if (user) {
    const { data: vhcData } = await supabase.from("vehicles").select("*").order("type").order("brand");
    if (vhcData) {
      vhcList = vhcData.map((r: Record<string, unknown>) => ({
        id: r.id as string, type: r.type as Vehicle["type"],
        brand: r.brand as string, plate: (r.plate as string) ?? null,
        year: r.year as number, notes: (r.notes as string) ?? "",
        lastExpertise: (r.last_expertise as string) ?? null,
        lastService: (r.last_service as string) ?? null,
        purchasePrice: r.purchase_price as number, company: (r.company as string) ?? "",
        billedToMBAS: r.billed_to_mbas as number, leasingMonthly: r.leasing_monthly as number,
        leasingNumber: (r.leasing_number as string) ?? null,
        leasingEnd: (r.leasing_end as string) ?? null,
        insuranceMonthly: r.insurance_monthly as number, resaleMonthly: r.resale_monthly as number,
        refacturingRate: r.refacturing_rate as number,
        refacturingUnit: (r.refacturing_unit as string) as Vehicle["refacturingUnit"],
        refacturingTo: (r.refacturing_to as string) ?? "",
      }));
    }
  }

  const today = new Date("2026-03-27");
  const active = mortgages.filter(m => new Date(m.endDate) > today);
  const totalToday = mortgages.reduce((s, m) => s + eff(m, m.remainingToday), 0);
  const totalIntAnnual = mortgages.reduce((s, m) => s + calcAnnualInterest(m), 0);
  const expiredCount = mortgages.filter(isExpired).length;
  const soonCount = mortgages.filter(isExpiringSoon).length;
  const companiesCount = new Set(mortgages.map(m => m.company)).size;
  const todayLabel = today.toLocaleDateString("fr-CH", { day: "2-digit", month: "long", year: "numeric" });

  const totalVehicles = vhcList.length;
  const totalLeasingMonthly = vhcList.reduce((s, v) => s + v.leasingMonthly, 0);
  const vhcEnLeasing = vhcList.filter((v) => v.leasingMonthly > 0).length;
  const alertesLeasing = vhcList.filter(isLeasingExpired).length + vhcList.filter(isLeasingEndingSoon).length;

  return (
    <div className="min-h-screen bg-warm">
      <header className="glass sticky top-0 z-20 border-b border-white/30">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative w-9 h-9 shrink-0">
              <Image src="/logo.png" alt="MBA Groupe SA" fill className="object-contain" />
            </div>
            <div>
              <div className="text-base font-semibold text-[#1d1d1f]">MBA Groupe SA</div>
              <div className="text-[11px] text-[#86868b] tracking-wide">Wealth Management</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-[10px] text-[#86868b] uppercase tracking-wide">Données au</div>
              <div className="text-sm font-medium text-[#1d1d1f]">{todayLabel}</div>
            </div>
            <HeaderActions isAdmin={isAdmin} />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[#1d1d1f]">Tableau de bord</h1>
          <p className="text-[#86868b] mt-1 text-sm">Sélectionnez un module pour accéder aux données.</p>
        </div>

        {/* ── Cartes entreprises ─────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { name: "MBA Immobilier SA", icon: "🏠", color: "#bf5f1a" },
            { name: "LAEMA Immobilier SA", icon: "🏢", color: "#0071e3" },
            { name: "MBA Construction SA", icon: "🏗️", color: "#34c759" },
            { name: "ASV Construction Générale SA", icon: "🔨", color: "#5856d6" },
            { name: "ASV Fenêtres et Portes SA", icon: "🪟", color: "#ff9500" },
            { name: "MBA Services SA", icon: "⚙️", color: "#af52de" },
            { name: "Promotion", icon: "📐", color: "#ff2d55" },
          ].map((company) => {
            const companyMortgages = mortgages.filter(m => m.company === company.name);
            const companyVehicles = vhcList.filter(v => v.company === company.name);
            const companyDebt = companyMortgages.reduce((s, m) => s + eff(m, m.remainingToday), 0);
            const companyInterest = companyMortgages.reduce((s, m) => s + calcAnnualInterest(m), 0);
            const companyAlerts = companyMortgages.filter(isExpired).length + companyMortgages.filter(isExpiringSoon).length;

            return (
              <div key={company.name} className="group block">
                <div className="glass-card rounded-2xl overflow-hidden transition-all duration-300 group-hover:-translate-y-1">
                  <div className="px-5 py-4 flex items-center gap-3 border-b border-white/30">
                    <span className="text-2xl">{company.icon}</span>
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-[#1d1d1f] truncate">{company.name}</div>
                      <div className="text-[11px] text-[#86868b] mt-0.5">
                        {companyMortgages.length} hypothèque{companyMortgages.length !== 1 ? "s" : ""} · {companyVehicles.length} véhicule{companyVehicles.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-px bg-white/20">
                    {[
                      { label: "Encours", value: companyDebt > 0 ? formatCHF(companyDebt) : "—", accent: companyDebt > 0 },
                      { label: "Intérêts annuels", value: companyInterest > 0 ? formatCHF(companyInterest) : "—" },
                      { label: "Hypothèques", value: `${companyMortgages.length}` },
                      { label: "Alertes", value: `${companyAlerts}`, red: companyAlerts > 0 },
                    ].map((s) => (
                      <div key={s.label} className="bg-white/30 px-4 py-3">
                        <div className="text-[10px] text-[#86868b] uppercase tracking-wide">{s.label}</div>
                        <div className={`text-sm font-semibold mt-0.5 ${s.accent ? `text-[${company.color}]` : s.red ? "text-[#ff3b30]" : "text-[#1d1d1f]"}`}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="px-5 py-3 flex items-center justify-end">
                    <span className="text-xs font-medium text-[#86868b]">Détails bientôt →</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Modules ─────────────────────────────────────────────── */}
        <h2 className="text-lg font-semibold text-[#1d1d1f] mt-12 mb-5">Modules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Hypothèques */}
          <Link href="/hypotheques" className="group block">
            <div className="glass-card rounded-2xl overflow-hidden transition-all duration-300 group-hover:-translate-y-1">
              <div className="px-5 py-4 flex items-center gap-3 border-b border-white/30">
                <span className="text-2xl">🏦</span>
                <div>
                  <div className="text-base font-semibold text-[#1d1d1f]">Hypothèques</div>
                  <div className="text-[11px] text-[#86868b] mt-0.5">Contrats, soldes, taux et échéances</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-px bg-white/20">
                {[
                  { label: "Encours total", value: formatCHF(totalToday), accent: true },
                  { label: "Intérêts annuels", value: formatCHF(totalIntAnnual) },
                  { label: "Contrats actifs", value: `${active.length} / ${mortgages.length}` },
                  { label: "Alertes", value: `${expiredCount + soonCount}`, red: (expiredCount + soonCount) > 0 },
                ].map((s) => (
                  <div key={s.label} className="bg-white/30 px-4 py-3">
                    <div className="text-[10px] text-[#86868b] uppercase tracking-wide">{s.label}</div>
                    <div className={`text-sm font-semibold mt-0.5 ${s.accent ? "text-[#bf5f1a]" : s.red ? "text-[#ff3b30]" : "text-[#1d1d1f]"}`}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 flex items-center justify-between">
                <span className="text-xs text-[#86868b]">{companiesCount} société{companiesCount > 1 ? "s" : ""}</span>
                <span className="text-xs font-medium text-[#bf5f1a] group-hover:underline">Ouvrir →</span>
              </div>
            </div>
          </Link>

          {/* Véhicules */}
          <Link href="/vehicules" className="group block">
            <div className="glass-card rounded-2xl overflow-hidden transition-all duration-300 group-hover:-translate-y-1">
              <div className="px-5 py-4 flex items-center gap-3 border-b border-white/30">
                <span className="text-2xl">🚗</span>
                <div>
                  <div className="text-base font-semibold text-[#1d1d1f]">Véhicules</div>
                  <div className="text-[11px] text-[#86868b] mt-0.5">Flotte, machines et leasings</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-px bg-white/20">
                {[
                  { label: "Total véhicules", value: `${totalVehicles}` },
                  { label: "Leasing mensuel", value: formatVHC(totalLeasingMonthly), accent: true },
                  { label: "VHC en leasing", value: `${vhcEnLeasing}` },
                  { label: "Alertes leasing", value: `${alertesLeasing}`, red: alertesLeasing > 0 },
                ].map((s) => (
                  <div key={s.label} className="bg-white/30 px-4 py-3">
                    <div className="text-[10px] text-[#86868b] uppercase tracking-wide">{s.label}</div>
                    <div className={`text-sm font-semibold mt-0.5 ${s.accent ? "text-[#0071e3]" : s.red ? "text-[#ff3b30]" : "text-[#1d1d1f]"}`}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 flex items-center justify-between">
                <span className="text-xs text-[#86868b]">{vhcEnLeasing} en leasing</span>
                <span className="text-xs font-medium text-[#0071e3] group-hover:underline">Ouvrir →</span>
              </div>
            </div>
          </Link>

          {/* Placeholder */}
          <div className="glass-card rounded-2xl flex flex-col items-center justify-center py-10 px-6 text-center opacity-50">
            <div className="text-3xl mb-3 text-[#86868b]">＋</div>
            <div className="text-sm font-medium text-[#86868b]">Nouveau module</div>
            <div className="text-xs text-[#aeaeb2] mt-1">Bientôt disponible</div>
          </div>
        </div>
      </main>

      <footer className="text-center text-[11px] text-[#86868b] pb-8 mt-4">
        MBA Groupe SA · {todayLabel}
      </footer>
    </div>
  );
}
