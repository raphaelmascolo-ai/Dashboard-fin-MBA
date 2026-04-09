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
      <header className="glass sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="logo-frame w-11 h-11 shrink-0 relative">
              <Image src="/logo.png" alt="MBA Groupe SA" fill className="object-contain p-0.5" />
            </div>
            <div className="min-w-0">
              <div className="text-base font-semibold text-[#1a1a1a] truncate">MBA Groupe SA</div>
              <div className="text-[11px] text-[#6b7280] tracking-wide truncate">Wealth Management</div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right hidden sm:block">
              <div className="text-[10px] text-[#6b7280] uppercase tracking-wide">Données au</div>
              <div className="text-sm font-medium text-[#1a1a1a]">{todayLabel}</div>
            </div>
            <HeaderActions isAdmin={isAdmin} />
          </div>
        </div>
        <div className="mba-accent-bar" />
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-10">
          <div className="inline-block bg-[#fef3c7] text-[#854d0e] text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md mb-3">
            Tableau de bord
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#1a1a1a] tracking-tight">
            Bienvenue
          </h1>
          <p className="text-[#6b7280] mt-2 text-base">Trois univers, sélectionnez le vôtre.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* ── Finance ──────────────────────────────────────── */}
          <Link href="/finance" className="group block">
            <div className="mba-card h-full flex flex-col">
              <div className="px-5 py-5 flex items-center gap-3 border-b border-gray-100">
                <div className="w-12 h-12 rounded-xl bg-[#fef3c7] flex items-center justify-center text-2xl shrink-0">
                  🏦
                </div>
                <div className="min-w-0">
                  <div className="text-base font-bold text-[#1a1a1a]">Finance</div>
                  <div className="text-[11px] text-[#6b7280] mt-0.5">Hypothèques · sociétés</div>
                </div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-gray-100">
                <div className="px-4 py-3.5">
                  <div className="text-[10px] text-[#9ca3af] uppercase tracking-wide font-semibold">Encours</div>
                  <div className="text-sm font-bold text-[#1a1a1a] mt-1">{formatCHF(totalDebt)}</div>
                </div>
                <div className="px-4 py-3.5">
                  <div className="text-[10px] text-[#9ca3af] uppercase tracking-wide font-semibold">Intérêts an.</div>
                  <div className="text-sm font-bold text-[#1a1a1a] mt-1">{formatCHF(totalInterest)}</div>
                </div>
              </div>
              <div className="px-5 py-3 flex items-center justify-between border-t border-gray-100 bg-[#fafaf7] mt-auto">
                <span className="text-xs text-[#6b7280]">{companiesCount} société{companiesCount > 1 ? "s" : ""}</span>
                <span className="text-xs font-bold text-[#1a1a1a] group-hover:text-[#ca8a04] transition-colors">Ouvrir →</span>
              </div>
            </div>
          </Link>

          {/* ── Véhicules ───────────────────────────────────── */}
          <Link href="/vehicules" className="group block">
            <div className="mba-card h-full flex flex-col">
              <div className="px-5 py-5 flex items-center gap-3 border-b border-gray-100">
                <div className="w-12 h-12 rounded-xl bg-[#fef3c7] flex items-center justify-center text-2xl shrink-0">
                  🚗
                </div>
                <div className="min-w-0">
                  <div className="text-base font-bold text-[#1a1a1a]">Véhicules</div>
                  <div className="text-[11px] text-[#6b7280] mt-0.5">Flotte · machines · leasings</div>
                </div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-gray-100">
                <div className="px-4 py-3.5">
                  <div className="text-[10px] text-[#9ca3af] uppercase tracking-wide font-semibold">Total</div>
                  <div className="text-sm font-bold text-[#1a1a1a] mt-1">{totalVehicles}</div>
                </div>
                <div className="px-4 py-3.5">
                  <div className="text-[10px] text-[#9ca3af] uppercase tracking-wide font-semibold">Leasing/mois</div>
                  <div className="text-sm font-bold text-[#1a1a1a] mt-1">{formatVHC(totalLeasingMonthly)}</div>
                </div>
              </div>
              <div className="px-5 py-3 flex items-center justify-end border-t border-gray-100 bg-[#fafaf7] mt-auto">
                <span className="text-xs font-bold text-[#1a1a1a] group-hover:text-[#ca8a04] transition-colors">Ouvrir →</span>
              </div>
            </div>
          </Link>

          {/* ── MBA Construction SA ─────────────────────────── */}
          <Link href="/mba-construction" className="group block">
            <div className="mba-card h-full flex flex-col">
              <div className="px-5 py-5 flex items-center gap-3 border-b border-gray-100">
                <div className="w-12 h-12 rounded-xl bg-[#fef3c7] flex items-center justify-center text-2xl shrink-0">
                  🏗️
                </div>
                <div className="min-w-0">
                  <div className="text-base font-bold text-[#1a1a1a] truncate">MBA Construction SA</div>
                  <div className="text-[11px] text-[#6b7280] mt-0.5">Outils opérationnels</div>
                </div>
              </div>
              <div className="px-5 py-5 text-sm text-[#6b7280] flex-1 leading-relaxed">
                Déclaration des commandes, planning chantiers et outils du quotidien.
              </div>
              <div className="px-5 py-3 flex items-center justify-end border-t border-gray-100 bg-[#fafaf7] mt-auto">
                <span className="text-xs font-bold text-[#1a1a1a] group-hover:text-[#ca8a04] transition-colors">Ouvrir →</span>
              </div>
            </div>
          </Link>
        </div>
      </main>

      <footer className="text-center text-[11px] text-[#9ca3af] pb-8 mt-8">
        MBA Groupe SA · {todayLabel}
      </footer>
    </div>
  );
}
