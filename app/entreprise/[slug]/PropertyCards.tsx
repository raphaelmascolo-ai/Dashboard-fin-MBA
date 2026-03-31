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
  annualCharges: number;
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

const kpiExplanations: { label: string; formula: string; description: string }[] = [
  {
    label: "Revenus locatifs",
    formula: "Loyer mensuel x 12 x Taux d'occupation x Taux de recouvrement",
    description: "Total des loyers annuels encaissés, ajusté selon le taux d'occupation (% du temps loué) et le taux de recouvrement (% des loyers effectivement payés).",
  },
  {
    label: "Charges annuelles",
    formula: "Somme des charges du bien",
    description: "Total des charges d'exploitation annuelles : entretien, assurances, frais de gérance, impôts fonciers, provisions pour travaux, etc.",
  },
  {
    label: "NOI (Net Operating Income)",
    formula: "Revenus locatifs effectifs - Charges annuelles",
    description: "Revenu net d'exploitation. C'est ce qui reste après avoir payé toutes les charges d'exploitation, mais avant le service de la dette (intérêts + amortissements). Un NOI positif signifie que le bien est rentable opérationnellement.",
  },
  {
    label: "Rendement brut",
    formula: "(Loyers annuels bruts / Valeur du bien) x 100",
    description: "Ratio simple entre les loyers annuels bruts (sans déduction) et la valeur du bien. Permet une comparaison rapide entre biens, mais ne tient pas compte des charges ni de la vacance.",
  },
  {
    label: "Rendement net",
    formula: "(NOI / Valeur du bien) x 100",
    description: "Ratio entre le NOI et la valeur du bien. Plus réaliste que le rendement brut car il intègre les charges, le taux d'occupation et le recouvrement. C'est l'indicateur de rentabilité le plus utilisé en immobilier.",
  },
  {
    label: "LTV (Loan to Value)",
    formula: "(Encours hypothécaire / Valeur du bien) x 100",
    description: "Mesure le niveau d'endettement par rapport à la valeur du bien. En Suisse, un LTV > 66% implique un amortissement obligatoire du 2e rang. Au-delà de 80%, le financement est considéré à risque.",
  },
  {
    label: "DSCR (Debt Service Coverage Ratio)",
    formula: "NOI / Service de dette annuel (intérêts + amortissements)",
    description: "Capacité du bien à couvrir ses obligations de dette. Un DSCR de 1.0x signifie que le NOI couvre juste le service de dette. En dessous de 1.0x, le bien ne génère pas assez pour couvrir la dette. Les banques exigent généralement > 1.2x.",
  },
  {
    label: "Cash on Cash Return",
    formula: "((NOI - Service de dette) / Fonds propres investis) x 100",
    description: "Rendement sur les fonds propres (equity) après paiement de la dette. C'est le rendement réel pour l'investisseur. Il peut être négatif si le bien coûte plus qu'il ne rapporte après service de la dette.",
  },
  {
    label: "Taux d'occupation",
    formula: "(Mois occupés / 12 mois) x 100",
    description: "Part du temps sur l'année où le bien est effectivement loué. 100% = aucune vacance. Ce taux impacte directement les revenus locatifs effectifs et donc tous les indicateurs de rentabilité.",
  },
  {
    label: "Taux de recouvrement",
    formula: "(Loyers encaissés / Loyers facturés) x 100",
    description: "Part des loyers qui sont effectivement payés par les locataires. Un taux de 95% signifie que 5% des loyers sont impayés (retards, contentieux, abandons de créance).",
  },
];

function KpiGlossary() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1 mb-2 px-4">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-[11px] text-[#86868b] hover:text-[#1d1d1f] transition-colors"
      >
        <span>{open ? "▾" : "▸"}</span>
        <span className="underline underline-offset-2 decoration-dotted">Comprendre les indicateurs</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {kpiExplanations.map(k => (
            <div key={k.label} className="bg-stone-50/80 rounded-lg px-4 py-3">
              <div className="text-xs font-semibold text-[#1d1d1f]">{k.label}</div>
              <div className="text-[11px] text-[#bf5f1a] font-mono mt-0.5">{k.formula}</div>
              <div className="text-[11px] text-[#86868b] mt-1 leading-relaxed">{k.description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PropertyCard({ property }: { property: PropertyData }) {
  const [occupancy, setOccupancy] = useState(100);
  const [recovery, setRecovery] = useState(100);
  const [open, setOpen] = useState(false);

  const p = property;
  const effectiveRent = p.annualRent * (occupancy / 100) * (recovery / 100);
  const noi = effectiveRent - p.annualCharges;
  const rendementBrut = p.propertyValue > 0 ? (p.annualRent / p.propertyValue) * 100 : 0;
  const rendementNet = p.propertyValue > 0 ? (noi / p.propertyValue) * 100 : 0;
  const ltvVal = p.propertyValue > 0 ? (p.totalDebt / p.propertyValue) * 100 : 0;
  const dscr = p.debtService > 0 ? noi / p.debtService : 0;
  const equity = p.propertyValue - p.totalDebt;
  const cashOnCash = equity > 0 ? ((noi - p.debtService) / equity) * 100 : 0;
  const tauxRecouvrement = p.annualRent > 0 ? (effectiveRent / p.annualRent) * 100 : 0;

  const ltvColor = ltvVal > 80 ? "text-red-600" : ltvVal > 66 ? "text-amber-600" : "text-emerald-600";
  const dscrColor = dscr < 1 ? "text-red-600" : dscr < 1.2 ? "text-amber-600" : "text-emerald-600";
  const noiColor = noi >= 0 ? "text-emerald-600" : "text-red-600";

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

      {/* KPIs grid — always visible */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 py-3">
        <KpiBox label="Revenus locatifs" value={formatCHF(effectiveRent)} sub={occupancy < 100 || recovery < 100 ? `Brut: ${formatCHF(p.annualRent)}` : undefined} color="text-emerald-600" />
        <KpiBox label="Charges annuelles" value={formatCHF(p.annualCharges)} color="text-red-500" />
        <KpiBox label="NOI" value={formatCHF(noi)} color={noiColor} />
        <KpiBox label="Rendement brut" value={`${rendementBrut.toFixed(2)}%`} />
        <KpiBox label="Rendement net" value={`${rendementNet.toFixed(2)}%`} color={rendementNet >= 0 ? "text-emerald-600" : "text-red-500"} />
        <KpiBox label="LTV" value={`${ltvVal.toFixed(1)}%`} color={ltvColor} />
        <KpiBox label="DSCR" value={`${dscr.toFixed(2)}x`} sub={dscr < 1 ? "Insuffisant" : dscr < 1.2 ? "Limite" : "Sain"} color={dscrColor} />
        <KpiBox label="Cash on Cash" value={`${cashOnCash.toFixed(2)}%`} sub={`Equity: ${formatCHF(equity)}`} />
      </div>

      <KpiGlossary />

      {/* Expandable detail */}
      {open && (
        <div className="border-t border-white/30 px-5 py-4 space-y-5">
          {/* Inputs for occupation & recouvrement */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="flex justify-between"><span className="text-gray-500">Fonds propres (equity)</span><span className="font-semibold">{formatCHF(equity)}</span></div>
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

export default function PropertyCards({ properties }: { properties: PropertyData[] }) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-[#1d1d1f]">Biens immobiliers ({properties.length})</h2>
      {properties.map(p => (
        <PropertyCard key={p.label} property={p} />
      ))}
    </div>
  );
}
