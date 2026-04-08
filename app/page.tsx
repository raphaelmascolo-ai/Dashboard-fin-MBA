import Image from "next/image";
import Link from "next/link";
import { createClient } from "./lib/supabase/server";
import { formatCHF, calcAnnualInterest, ratio, type Mortgage } from "./data";
import HeaderActions from "./components/HeaderActions";
import { formatCHF as formatVHC, type Vehicle } from "./vehicules/data";

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
  let vhcList: Vehicle[] = [];
  if (user) {
    const { data: mData } = await supabase.from("mortgages").select("*");
    if (mData) {
      mortgages = mData.map((r: Record<string, unknown>) => ({
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

    const { data: vhcData } = await supabase.from("vehicles").select("*");
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
  const totalDebt = mortgages.reduce((s, m) => s + eff(m, m.remainingToday), 0);
  const totalInterest = mortgages.reduce((s, m) => s + calcAnnualInterest(m), 0);
  const companiesCount = new Set(mortgages.map(m => m.company)).size;
  const totalVehicles = vhcList.length;
  const totalLeasingMonthly = vhcList.reduce((s, v) => s + v.leasingMonthly, 0);
  const todayLabel = today.toLocaleDateString("fr-CH", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-warm">
      <header className="glass sticky top-0 z-20 border-b border-white/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="relative w-9 h-9 shrink-0">
              <Image src="/logo.png" alt="MBA Groupe SA" fill className="object-contain" />
            </div>
            <div className="min-w-0">
              <div className="text-base font-semibold text-[#1d1d1f] truncate">MBA Groupe SA</div>
              <div className="text-[11px] text-[#86868b] tracking-wide truncate">Wealth Management</div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right hidden sm:block">
              <div className="text-[10px] text-[#86868b] uppercase tracking-wide">Données au</div>
              <div className="text-sm font-medium text-[#1d1d1f]">{todayLabel}</div>
            </div>
            <HeaderActions isAdmin={isAdmin} />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-2xl font-semibold text-[#1d1d1f]">Tableau de bord</h1>
          <p className="text-[#86868b] mt-1 text-sm">Trois univers, sélectionnez le vôtre.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* ── Finance ──────────────────────────────────────── */}
          <Link href="/finance" className="group block">
            <div className="glass-card rounded-2xl overflow-hidden transition-all duration-300 group-hover:-translate-y-1 h-full flex flex-col">
              <div className="px-5 py-5 flex items-center gap-3 border-b border-white/30">
                <span className="text-3xl">🏦</span>
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-[#1d1d1f]">Finance</div>
                  <div className="text-[11px] text-[#86868b] mt-0.5">Hypothèques · sociétés</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-px bg-white/20">
                <div className="bg-white/30 px-4 py-3">
                  <div className="text-[10px] text-[#86868b] uppercase tracking-wide">Encours</div>
                  <div className="text-sm font-semibold text-[#bf5f1a] mt-0.5">{formatCHF(totalDebt)}</div>
                </div>
                <div className="bg-white/30 px-4 py-3">
                  <div className="text-[10px] text-[#86868b] uppercase tracking-wide">Intérêts an.</div>
                  <div className="text-sm font-semibold text-[#1d1d1f] mt-0.5">{formatCHF(totalInterest)}</div>
                </div>
              </div>
              <div className="px-5 py-3 flex items-center justify-between border-t border-white/30 bg-white/20 mt-auto">
                <span className="text-xs text-[#86868b]">{companiesCount} société{companiesCount > 1 ? "s" : ""}</span>
                <span className="text-xs font-semibold text-[#bf5f1a] group-hover:underline">Ouvrir →</span>
              </div>
            </div>
          </Link>

          {/* ── Véhicules ───────────────────────────────────── */}
          <Link href="/vehicules" className="group block">
            <div className="glass-card rounded-2xl overflow-hidden transition-all duration-300 group-hover:-translate-y-1 h-full flex flex-col">
              <div className="px-5 py-5 flex items-center gap-3 border-b border-white/30">
                <span className="text-3xl">🚗</span>
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-[#1d1d1f]">Véhicules</div>
                  <div className="text-[11px] text-[#86868b] mt-0.5">Flotte, machines, leasings</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-px bg-white/20">
                <div className="bg-white/30 px-4 py-3">
                  <div className="text-[10px] text-[#86868b] uppercase tracking-wide">Total</div>
                  <div className="text-sm font-semibold text-[#1d1d1f] mt-0.5">{totalVehicles}</div>
                </div>
                <div className="bg-white/30 px-4 py-3">
                  <div className="text-[10px] text-[#86868b] uppercase tracking-wide">Leasing/mois</div>
                  <div className="text-sm font-semibold text-[#0071e3] mt-0.5">{formatVHC(totalLeasingMonthly)}</div>
                </div>
              </div>
              <div className="px-5 py-3 flex items-center justify-end border-t border-white/30 bg-white/20 mt-auto">
                <span className="text-xs font-semibold text-[#0071e3] group-hover:underline">Ouvrir →</span>
              </div>
            </div>
          </Link>

          {/* ── MBA Construction SA ─────────────────────────── */}
          <Link href="/mba-construction" className="group block">
            <div className="glass-card rounded-2xl overflow-hidden transition-all duration-300 group-hover:-translate-y-1 h-full flex flex-col">
              <div className="px-5 py-5 flex items-center gap-3 border-b border-white/30">
                <span className="text-3xl">🏗️</span>
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-[#1d1d1f]">MBA Construction SA</div>
                  <div className="text-[11px] text-[#86868b] mt-0.5">Outils opérationnels</div>
                </div>
              </div>
              <div className="px-5 py-5 text-sm text-[#86868b] flex-1">
                Déclaration des commandes fournisseurs et autres outils du quotidien à venir.
              </div>
              <div className="px-5 py-3 flex items-center justify-end border-t border-white/30 bg-white/20 mt-auto">
                <span className="text-xs font-semibold text-[#34c759] group-hover:underline">Ouvrir →</span>
              </div>
            </div>
          </Link>
        </div>
      </main>

      <footer className="text-center text-[11px] text-[#86868b] pb-8 mt-4">
        MBA Groupe SA · {todayLabel}
      </footer>
    </div>
  );
}
