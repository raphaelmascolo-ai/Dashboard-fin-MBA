import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "../../lib/supabase/server";
import { formatCHF, calcAnnualInterest, ratio, type Mortgage } from "../../data";
import { properties, matchMortgageLabel } from "../properties";
import PropertyCards from "./PropertyCards";

const slugMap: Record<string, string> = {
  "mba-immobilier": "MBA Immobilier SA",
  "laema-immobilier": "LAEMA Immobilier SA",
  "mba-construction": "MBA Construction SA",
  "asv-construction": "ASV Construction Générale SA",
  "asv-fenetres": "ASV Fenêtres et Portes SA",
  "mba-services": "MBA Services SA",
  "promotion": "Promotion",
};

export default async function EntreprisePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const companyName = slugMap[slug];
  if (!companyName) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  let mortgages: Mortgage[] = [];
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

  // Get properties for this company
  const companyProperties = properties.filter(p => p.company === companyName);

  // Build property data with linked mortgages
  const propertyData = companyProperties.map(prop => {
    const linkedMortgages = mortgages.filter(m =>
      matchMortgageLabel(prop.label, m.label)
    );

    const totalDebt = linkedMortgages.reduce((s, m) => s + m.remainingToday * ratio(m), 0);
    const annualInterest = linkedMortgages.reduce((s, m) => s + calcAnnualInterest(m), 0);
    const annualAmort = linkedMortgages.reduce((s, m) => s + m.annualAmortization * ratio(m), 0);
    const annualRent = linkedMortgages.reduce((s, m) => s + (m.monthlyRent ?? 0) * 12 * ratio(m), 0);
    const propertyValue = linkedMortgages[0]?.propertyValue ?? 0;
    const debtService = annualInterest + annualAmort;

    return {
      label: prop.label,
      annualCharges: prop.annualCharges,
      totalDebt,
      annualInterest,
      annualAmort,
      annualRent,
      propertyValue,
      debtService,
      mortgageCount: linkedMortgages.length,
      mortgages: linkedMortgages.map(m => ({
        id: m.id,
        label: m.label,
        rate: m.rate,
        rateType: m.rateType,
        remainingToday: m.remainingToday * ratio(m),
        endDate: m.endDate,
      })),
    };
  });

  // Company totals
  const totalRent = propertyData.reduce((s, p) => s + p.annualRent, 0);
  const totalCharges = propertyData.reduce((s, p) => s + p.annualCharges, 0);
  const totalDebt = propertyData.reduce((s, p) => s + p.totalDebt, 0);
  const totalValue = propertyData.reduce((s, p) => s + p.propertyValue, 0);
  const totalNOI = totalRent - totalCharges;
  const totalDebtService = propertyData.reduce((s, p) => s + p.debtService, 0);

  return (
    <div className="min-h-screen bg-warm">
      <header className="glass sticky top-0 z-20 border-b border-white/30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative w-9 h-9 shrink-0">
              <Image src="/logo.png" alt="MBA Groupe SA" fill className="object-contain" />
            </div>
            <div>
              <div className="text-base font-semibold text-[#1d1d1f]">{companyName}</div>
              <div className="text-[11px] text-[#86868b] tracking-wide">Portefeuille immobilier</div>
            </div>
          </div>
          <Link href="/" className="text-xs text-[#0071e3] font-medium hover:underline">← Accueil</Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Company KPI summary */}
        {companyProperties.length > 0 && (
          <div className="glass-card rounded-2xl overflow-hidden mb-8">
            <div className="px-5 py-4 border-b border-white/30">
              <div className="text-sm font-semibold text-[#1d1d1f]">Vue d'ensemble — {companyName}</div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/20">
              {[
                { label: "Revenus locatifs", value: formatCHF(totalRent), color: "text-emerald-600" },
                { label: "Charges totales", value: formatCHF(totalCharges), color: "text-red-500" },
                { label: "NOI", value: formatCHF(totalNOI), color: totalNOI >= 0 ? "text-emerald-600" : "text-red-500" },
                { label: "Valeur portefeuille", value: formatCHF(totalValue), color: "text-[#1d1d1f]" },
                { label: "Encours hypothécaire", value: formatCHF(totalDebt), color: "text-[#bf5f1a]" },
                { label: "LTV global", value: totalValue > 0 ? `${(totalDebt / totalValue * 100).toFixed(1)}%` : "—", color: "text-[#1d1d1f]" },
                { label: "DSCR global", value: totalDebtService > 0 ? (totalNOI / totalDebtService).toFixed(2) + "x" : "—", color: "text-[#1d1d1f]" },
                { label: "Rendement brut", value: totalValue > 0 ? `${(totalRent / totalValue * 100).toFixed(2)}%` : "—", color: "text-[#1d1d1f]" },
              ].map(s => (
                <div key={s.label} className="bg-white/30 px-4 py-3">
                  <div className="text-[10px] text-[#86868b] uppercase tracking-wide">{s.label}</div>
                  <div className={`text-sm font-semibold mt-0.5 ${s.color}`}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {companyProperties.length === 0 ? (
          <div className="glass-card rounded-2xl py-16 text-center">
            <div className="text-3xl mb-3 text-[#86868b]">🏗️</div>
            <div className="text-sm font-medium text-[#86868b]">Aucun bien immobilier pour cette entreprise</div>
            <div className="text-xs text-[#aeaeb2] mt-1">Les données seront ajoutées prochainement</div>
          </div>
        ) : (
          <PropertyCards properties={propertyData} />
        )}
      </main>

      <footer className="text-center text-[11px] text-[#86868b] pb-8 mt-4">
        MBA Groupe SA · {companyName}
      </footer>
    </div>
  );
}
