"use client";
import { useState } from "react";
import { formatCHF } from "../../data";

interface MortgageInfo {
  id: string;
  label: string;
  rate: number;
  rateType: "fixed" | "saron";
  remainingToday: number;
  endDate: string;
}

interface PropertyData {
  label: string;
  chargesByYear: Record<number, number>;
  totalDebt: number;
  annualInterest: number;
  annualAmort: number;
  annualRent: number;
  propertyValue: number;
  debtService: number;
  mortgageCount: number;
  mortgages: MortgageInfo[];
}

function KpiBox({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white/30 px-3 py-2.5 rounded-lg">
      <div className="text-[10px] text-[#86868b] uppercase tracking-wide">{label}</div>
      <div className={`text-sm font-bold mt-0.5 ${color ?? "text-[#1d1d1f]"}`}>{value}</div>
      {sub && <div className="text-[10px] text-[#aeaeb2] mt-0.5">{sub}</div>}
    </div>
  );
}

function ExplainRow({ label, formula, result, description }: { label: string; formula: string; result: string; description: string }) {
  return (
    <div className="bg-stone-50/80 rounded-lg px-4 py-3">
      <div className="text-xs font-semibold text-[#1d1d1f]">{label}</div>
      <div className="text-[11px] text-[#bf5f1a] font-mono mt-0.5 leading-relaxed">{formula} = <span className="font-bold">{result}</span></div>
      <div className="text-[11px] text-[#86868b] mt-1 leading-relaxed">{description}</div>
    </div>
  );
}

const f = (n: number) => formatCHF(Math.round(n));
const pct = (n: number) => `${n.toFixed(2)}%`;

function PropertyCard({ property, availableYears }: { property: PropertyData; availableYears: number[] }) {
  const [occupancy, setOccupancy] = useState(100);
  const [recovery, setRecovery] = useState(100);
  const [selectedYear, setSelectedYear] = useState(availableYears[0]);
  const defaultEquity = property.propertyValue - property.totalDebt;
  const [equityOverride, setEquityOverride] = useState<number>(defaultEquity);
  const [open, setOpen] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  const p = property;
  const annualCharges = p.chargesByYear[selectedYear] ?? 0;
  const hasChargesForYear = selectedYear in p.chargesByYear;
  const effectiveRent = p.annualRent * (occupancy / 100) * (recovery / 100);
  const noi = effectiveRent - annualCharges;
  const rendementBrut = p.propertyValue > 0 ? (p.annualRent / p.propertyValue) * 100 : 0;
  const rendementNet = p.propertyValue > 0 ? (noi / p.propertyValue) * 100 : 0;
  const ltvVal = p.propertyValue > 0 ? (p.totalDebt / p.propertyValue) * 100 : 0;
  const dscr = p.debtService > 0 ? noi / p.debtService : 0;
  const equity = equityOverride;
  const cashOnCash = equity > 0 ? ((noi - p.debtService) / equity) * 100 : 0;
  const tauxRecouvrement = p.annualRent > 0 ? (effectiveRent / p.annualRent) * 100 : 0;

  const ltvColor = ltvVal > 80 ? "text-red-600" : ltvVal > 66 ? "text-amber-600" : "text-emerald-600";
  const dscrColor = dscr < 1 ? "text-red-600" : dscr < 1.2 ? "text-amber-600" : "text-emerald-600";
  const noiColor = noi >= 0 ? "text-emerald-600" : "text-red-600";

  const monthlyRent = p.annualRent / 12;

  const explanations = [
    {
      label: "Revenus locatifs effectifs",
      formula: `${f(monthlyRent)}/mois x 12 x ${occupancy}% x ${recovery}%`,
      result: f(effectiveRent),
      description: "Loyer mensuel annualisé, ajusté par le taux d'occupation et le taux de recouvrement.",
    },
    {
      label: `Charges annuelles (${selectedYear})`,
      formula: `Charges ${selectedYear} pour ${p.label}`,
      result: hasChargesForYear ? f(annualCharges) : "— (pas de données)",
      description: "Total des charges d'exploitation : entretien, assurances, gérance, impôts fonciers, provisions travaux.",
    },
    {
      label: "NOI (Net Operating Income)",
      formula: `${f(effectiveRent)} - ${f(annualCharges)}`,
      result: f(noi),
      description: "Ce qui reste après les charges d'exploitation, avant le service de la dette. Un NOI positif = bien rentable opérationnellement.",
    },
    {
      label: "Rendement brut",
      formula: `(${f(p.annualRent)} / ${f(p.propertyValue)}) x 100`,
      result: pct(rendementBrut),
      description: "Ratio loyers bruts / valeur du bien. Comparaison rapide, sans tenir compte des charges ni de la vacance.",
    },
    {
      label: "Rendement net",
      formula: `(${f(noi)} / ${f(p.propertyValue)}) x 100`,
      result: pct(rendementNet),
      description: "Ratio NOI / valeur du bien. Intègre les charges, l'occupation et le recouvrement. Indicateur de rentabilité le plus fiable.",
    },
    {
      label: "LTV (Loan to Value)",
      formula: `(${f(p.totalDebt)} / ${f(p.propertyValue)}) x 100`,
      result: `${ltvVal.toFixed(1)}%`,
      description: `Niveau d'endettement. ${ltvVal > 80 ? "Attention : > 80%, financement à risque." : ltvVal > 66 ? "Entre 66% et 80% : amortissement du 2e rang obligatoire en Suisse." : "< 66% : situation saine, pas d'amortissement obligatoire du 2e rang."}`,
    },
    {
      label: "DSCR (Debt Service Coverage Ratio)",
      formula: `${f(noi)} / ${f(p.debtService)}`,
      result: `${dscr.toFixed(2)}x`,
      description: `Capacité à couvrir la dette (intérêts ${f(p.annualInterest)} + amortissements ${f(p.annualAmort)} = ${f(p.debtService)}/an). ${dscr < 1 ? "< 1x : le bien ne couvre pas sa dette." : dscr < 1.2 ? "Entre 1x et 1.2x : limite, les banques exigent > 1.2x." : "> 1.2x : confortable."}`,
    },
    {
      label: "Cash on Cash Return",
      formula: `((${f(noi)} - ${f(p.debtService)}) / ${f(equity)}) x 100`,
      result: pct(cashOnCash),
      description: `Rendement réel sur vos fonds propres de ${f(equity)}. Après paiement de la dette, il reste ${f(noi - p.debtService)}/an. ${cashOnCash < 0 ? "Négatif : le bien coûte plus qu'il ne rapporte après dette." : "Positif : l'investissement génère un retour."}`,
    },
    {
      label: "Taux d'occupation",
      formula: `${occupancy}% (paramètre modifiable)`,
      result: `${occupancy}%`,
      description: "Part du temps où le bien est loué. 100% = aucune vacance. Impacte directement les revenus effectifs.",
    },
    {
      label: "Taux de recouvrement",
      formula: `${f(effectiveRent)} / ${f(p.annualRent)} x 100`,
      result: `${tauxRecouvrement.toFixed(1)}%`,
      description: "Part des loyers effectivement encaissés. Reflète les impayés, retards et abandons de créance.",
    },
  ];

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <button className="w-full text-left px-5 py-4 flex items-center justify-between border-b border-white/30" onClick={() => setOpen(v => !v)}>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#1d1d1f]">{p.label}</div>
          <div className="text-[11px] text-[#86868b] mt-0.5">
            {p.mortgageCount} hypothèque{p.mortgageCount !== 1 ? "s" : ""} · Valeur {formatCHF(p.propertyValue)}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-xs font-bold ${noiColor}`}>NOI {formatCHF(noi)}</span>
          <span className="text-[10px] text-gray-400">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* Year selector */}
      <div className="px-4 pt-3 pb-1 flex items-center gap-2">
        <span className="text-[10px] text-[#86868b] uppercase tracking-wide">Charges</span>
        <div className="flex gap-1">
          {availableYears.map(y => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                selectedYear === y
                  ? "bg-[#1d1d1f] text-white"
                  : "bg-stone-100 text-[#86868b] hover:bg-stone-200"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
        {!hasChargesForYear && (
          <span className="text-[10px] text-amber-600 font-medium ml-1">Pas de données pour {selectedYear}</span>
        )}
      </div>

      {/* KPIs grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 py-3">
        <KpiBox label="Revenus locatifs" value={formatCHF(effectiveRent)} sub={occupancy < 100 || recovery < 100 ? `Brut: ${formatCHF(p.annualRent)}` : undefined} color="text-emerald-600" />
        <KpiBox label={`Charges ${selectedYear}`} value={hasChargesForYear ? formatCHF(annualCharges) : "—"} color="text-red-500" />
        <KpiBox label="NOI" value={formatCHF(noi)} color={noiColor} />
        <KpiBox label="Rendement brut" value={`${rendementBrut.toFixed(2)}%`} />
        <KpiBox label="Rendement net" value={`${rendementNet.toFixed(2)}%`} color={rendementNet >= 0 ? "text-emerald-600" : "text-red-500"} />
        <KpiBox label="LTV" value={`${ltvVal.toFixed(1)}%`} color={ltvColor} />
        <KpiBox label="DSCR" value={`${dscr.toFixed(2)}x`} sub={dscr < 1 ? "Insuffisant" : dscr < 1.2 ? "Limite" : "Sain"} color={dscrColor} />
        <KpiBox label="Cash on Cash" value={`${cashOnCash.toFixed(2)}%`} sub={`Equity: ${formatCHF(equity)}`} />
      </div>

      {/* Glossary with real numbers */}
      <div className="mt-1 mb-2 px-4">
        <button
          onClick={() => setGlossaryOpen(v => !v)}
          className="flex items-center gap-1.5 text-[11px] text-[#86868b] hover:text-[#1d1d1f] transition-colors"
        >
          <span>{glossaryOpen ? "▾" : "▸"}</span>
          <span className="underline underline-offset-2 decoration-dotted">Voir le détail des calculs</span>
        </button>
        {glossaryOpen && (
          <div className="mt-3 space-y-3">
            {explanations.map(k => (
              <ExplainRow key={k.label} {...k} />
            ))}
          </div>
        )}
      </div>

      {/* Expandable detail */}
      {open && (
        <div className="border-t border-white/30 px-5 py-4 space-y-5">
          {/* Editable parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                Taux d'occupation (%)
              </label>
              <input
                type="number" min={0} max={100} step={1} value={occupancy}
                onChange={e => setOccupancy(Math.min(100, Math.max(0, Number(e.target.value))))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <p className="text-[10px] text-[#aeaeb2] mt-1">Part des unités occupées sur l'année</p>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                Taux de recouvrement (%)
              </label>
              <input
                type="number" min={0} max={100} step={1} value={recovery}
                onChange={e => setRecovery(Math.min(100, Math.max(0, Number(e.target.value))))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <p className="text-[10px] text-[#aeaeb2] mt-1">Part des loyers effectivement encaissés</p>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                Fonds propres (CHF)
              </label>
              <input
                type="number" min={0} step={1000} value={equityOverride}
                onChange={e => setEquityOverride(Math.max(0, Number(e.target.value)))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <p className="text-[10px] text-[#aeaeb2] mt-1">
                Par défaut : valeur - dette = {formatCHF(defaultEquity)}
                {equityOverride !== defaultEquity && (
                  <button onClick={() => setEquityOverride(defaultEquity)} className="ml-2 text-[#0071e3] underline">réinitialiser</button>
                )}
              </p>
            </div>
          </div>

          {/* Taux de recouvrement résultat */}
          <div className="bg-stone-50 rounded-lg px-4 py-3">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Taux de recouvrement effectif</div>
            <div className="text-sm font-bold text-[#1d1d1f]">{tauxRecouvrement.toFixed(1)}%</div>
          </div>

          {/* Détail financier */}
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Détail financier</div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Valeur du bien</span><span className="font-semibold">{formatCHF(p.propertyValue)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Encours hypothécaire</span><span className="font-semibold text-[#bf5f1a]">{formatCHF(p.totalDebt)}</span></div>
              <div className="flex justify-between">
                <span className="text-gray-500">Fonds propres</span>
                <span className="font-semibold">
                  {formatCHF(equity)}
                  {equityOverride !== defaultEquity && <span className="text-[10px] text-amber-600 ml-1">(modifié)</span>}
                </span>
              </div>
              <div className="flex justify-between"><span className="text-gray-500">Intérêts annuels</span><span className="font-semibold">{formatCHF(p.annualInterest)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Amortissement annuel</span><span className="font-semibold">{formatCHF(p.annualAmort)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Service de dette total</span><span className="font-semibold">{formatCHF(p.debtService)}</span></div>
            </div>
          </div>

          {/* Hypothèques liées */}
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Hypothèques liées</div>
            <div className="space-y-2">
              {p.mortgages.map(m => (
                <div key={m.id} className="bg-stone-50 rounded-lg px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-gray-900 truncate">{m.label}</div>
                    <div className="text-[10px] text-gray-400 font-mono">{m.id}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-[#bf5f1a]">{formatCHF(m.remainingToday)}</div>
                    <div className="text-[10px] text-gray-400">{m.rate}% {m.rateType} · éch. {new Date(m.endDate).toLocaleDateString("fr-CH")}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PropertyCards({ properties, availableYears }: { properties: PropertyData[]; availableYears: number[] }) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-[#1d1d1f]">Biens immobiliers ({properties.length})</h2>
      {properties.map(p => (
        <PropertyCard key={p.label} property={p} availableYears={availableYears} />
      ))}
    </div>
  );
}
