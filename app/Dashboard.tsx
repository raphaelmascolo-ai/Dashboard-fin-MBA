"use client";
import { useState } from "react";
import Image from "next/image";
import {
  mortgages,
  companies,
  formatCHF,
  formatDate,
  calcRemainingInterest,
  calcTotalInterestFullPeriod,
  calcAnnualInterest,
  annualRent,
  yearsRemaining,
  isExpired,
  isExpiringSoon,
  ltv,
  ratio,
  TODAY,
  type Mortgage,
} from "./data";

// ── helpers ───────────────────────────────────────────────────────────────────
function totalPropertyValue(ms: Mortgage[]): number {
  const seen = new Set<string>();
  let total = 0;
  for (const m of ms) {
    if (!m.propertyValue) continue;
    const key = m.propertyGroup ?? m.id;
    if (!seen.has(key)) { seen.add(key); total += m.propertyValue * ratio(m); }
  }
  return total;
}
function eff(m: Mortgage, value: number): number { return value * ratio(m); }

function StatusBadge({ m }: { m: Mortgage }) {
  if (isExpired(m))
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">⚠ Expiré</span>;
  if (isExpiringSoon(m))
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">⏳ Bientôt</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">✓ Actif</span>;
}

function LtvBar({ value }: { value: number }) {
  const color = value > 80 ? "bg-red-500" : value > 66 ? "bg-amber-400" : "bg-yellow-400";
  const textColor = value > 80 ? "text-red-600" : value > 66 ? "text-amber-600" : "text-yellow-600";
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>LTV</span>
        <span className={`font-bold ${textColor}`}>{value.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-200">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

// ── Mobile card ───────────────────────────────────────────────────────────────
function MortgageCard({ m, excluded, onToggle }: { m: Mortgage; excluded: boolean; onToggle: () => void }) {
  const [open, setOpen] = useState(false);
  const remInterest = calcRemainingInterest(m);
  const annualInterest = calcAnnualInterest(m);
  const totalInterest = calcTotalInterestFullPeriod(m);
  const ltvVal = ltv(m);
  const yrs = yearsRemaining(m);
  const rent = annualRent(m);

  const accentColor = excluded ? "border-l-gray-300"
    : isExpired(m) ? "border-l-red-400"
    : isExpiringSoon(m) ? "border-l-amber-400"
    : "border-l-green-400";

  return (
    <div className={`rounded-2xl border border-gray-200 border-l-4 ${accentColor} bg-white shadow-sm overflow-hidden mb-3 transition-all ${excluded ? "opacity-50" : ""}`}>
      <button className="w-full text-left p-4" onClick={() => setOpen((v) => !v)}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className={`font-bold text-sm leading-snug ${excluded ? "line-through text-gray-400" : "text-gray-900"}`}>
              {m.label}
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="text-[11px] text-gray-400 font-mono">{m.id}</span>
              {m.shared && (
                <span className="rounded-full bg-yellow-100 border border-yellow-300 px-1.5 py-0.5 text-[10px] font-bold text-yellow-700">
                  50% MBA
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            {excluded
              ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">Exclu</span>
              : <StatusBadge m={m} />}
            <span className="text-[11px] text-gray-400">{open ? "▲" : "▼"}</span>
          </div>
        </div>

        {!excluded && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-3">
                <div className="text-[11px] text-yellow-700 font-medium mb-0.5">Solde actuel</div>
                <div className="text-base font-bold text-yellow-800 leading-tight">{formatCHF(eff(m, m.remainingToday))}</div>
              </div>
              <div className="rounded-xl bg-purple-50 border border-purple-200 p-3">
                <div className="text-[11px] text-purple-700 font-medium mb-0.5">Intérêts annuels</div>
                <div className="text-base font-bold text-purple-800 leading-tight">{formatCHF(annualInterest)}</div>
              </div>
              {rent > 0 && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                  <div className="text-[11px] text-emerald-700 font-medium mb-0.5">Loyer annuel</div>
                  <div className="text-base font-bold text-emerald-800 leading-tight">{formatCHF(rent)}</div>
                </div>
              )}
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                <div className="text-[11px] text-gray-500 font-medium mb-0.5">Taux</div>
                <div className="text-sm font-bold text-gray-800 leading-tight">
                  {m.rateType === "saron" ? `S+${m.rate}%` : `${m.rate.toFixed(2)}%`}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">{m.rateType === "saron" ? "Variable" : "Fixe"}</div>
              </div>
            </div>
            {ltvVal !== null && <div className="mt-3"><LtvBar value={ltvVal} /></div>}
          </>
        )}
      </button>

      {open && (
        <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-0">
          <DetailSection title="Contrat">
            <DataRow label="Début" value={formatDate(m.startDate)} />
            <DataRow label="Fin" value={formatDate(m.endDate)} />
            <DataRow label="Durée restante" value={yrs > 0 ? `${yrs.toFixed(1)} ans` : "Expiré"} />
            <DataRow label="Montant initial" value={formatCHF(eff(m, m.totalAmount))} />
            <DataRow label="Solde à l'échéance" value={formatCHF(eff(m, m.remainingAtEnd))} />
          </DetailSection>
          <DetailSection title="Remboursement">
            <DataRow label="Amortissement annuel" value={m.annualAmortization > 0 ? formatCHF(eff(m, m.annualAmortization)) : "–"} />
            <DataRow label="Amortissement trimestriel" value={m.quarterlyAmortization > 0 ? formatCHF(eff(m, m.quarterlyAmortization)) : "–"} />
          </DetailSection>
          <DetailSection title="Intérêts">
            <DataRow label="Intérêts annuels" value={formatCHF(annualInterest)} accent="purple" />
            <DataRow label="Intérêts restants" value={formatCHF(remInterest)} accent="purple" />
            <DataRow label="Intérêts totaux (contrat)" value={formatCHF(totalInterest)} />
          </DetailSection>
          {rent > 0 && (
            <DetailSection title="Revenus locatifs">
              <DataRow label="Loyer mensuel" value={formatCHF(m.monthlyRent!)} accent="green" />
              <DataRow label="Loyer annuel" value={formatCHF(rent)} accent="green" />
              <DataRow label="Charges (10%)" value={`–${formatCHF(Math.round(rent * 0.1))}`} />
              <DataRow label="Loyer net annuel" value={formatCHF(Math.round(rent * 0.9))} accent="green" />
            </DetailSection>
          )}
          {m.propertyValue && (
            <DetailSection title="Bien immobilier">
              <DataRow label="Valeur estimée" value={formatCHF(eff(m, m.propertyValue))} />
              {ltvVal !== null && <DataRow label="LTV" value={`${ltvVal.toFixed(1)}%`} accent={ltvVal > 80 ? "red" : ltvVal > 66 ? "amber" : "green"} />}
            </DetailSection>
          )}
          <div className="pt-3">
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              className={`w-full rounded-xl py-3 text-sm font-bold transition-colors border ${
                excluded
                  ? "bg-yellow-50 text-yellow-700 border-yellow-300"
                  : "bg-red-50 text-red-600 border-red-200"
              }`}
            >
              {excluded ? "✓ Réinclure dans les totaux" : "✕ Exclure des totaux"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">{title}</div>
      <div className="rounded-xl bg-white border border-gray-200 divide-y divide-gray-100 overflow-hidden shadow-sm">
        {children}
      </div>
    </div>
  );
}

function DataRow({ label, value, accent }: { label: string; value: string; accent?: "purple" | "green" | "red" | "amber" }) {
  const valueColor = accent === "purple" ? "text-purple-700"
    : accent === "green" ? "text-emerald-700"
    : accent === "red" ? "text-red-600"
    : accent === "amber" ? "text-amber-600"
    : "text-gray-900";
  return (
    <div className="flex justify-between items-center px-3 py-2.5 gap-2">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className={`font-semibold text-xs ${valueColor}`}>{value}</span>
    </div>
  );
}

// ── Desktop table row ─────────────────────────────────────────────────────────
function TableRow({ m, idx, excluded, onToggle }: { m: Mortgage; idx: number; excluded: boolean; onToggle: () => void }) {
  const remInterest = calcRemainingInterest(m);
  const ltvVal = ltv(m);
  const yrs = yearsRemaining(m);

  return (
    <tr
      onClick={onToggle}
      title={excluded ? "Cliquer pour réinclure" : "Cliquer pour exclure"}
      className={`border-b border-gray-100 cursor-pointer transition-all select-none ${
        excluded ? "opacity-30 hover:opacity-50"
        : idx % 2 === 0 ? "bg-white hover:bg-yellow-50"
        : "bg-gray-50 hover:bg-yellow-50"
      }`}
    >
      <td className="px-3 py-3">
        <div className={`font-semibold text-sm leading-snug ${excluded ? "line-through text-gray-400" : "text-gray-900"}`}>{m.label}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-gray-400 font-mono">{m.id}</span>
          {m.shared && <span className="rounded-full bg-yellow-100 px-1.5 py-0.5 text-xs font-semibold text-yellow-700">50% MBA</span>}
        </div>
      </td>
      <td className="px-3 py-3 text-center">
        {excluded
          ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">Exclu</span>
          : <StatusBadge m={m} />}
      </td>
      <td className={`px-3 py-3 text-right font-mono text-sm ${excluded ? "text-gray-400" : "text-gray-700"}`}>
        {formatCHF(eff(m, m.totalAmount))}
        {m.shared && <div className="text-xs text-gray-400">({formatCHF(m.totalAmount)} total)</div>}
      </td>
      <td className="px-3 py-3 text-center">
        {m.rateType === "saron"
          ? <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-semibold text-yellow-800">Saron +{m.rate}%</span>
          : <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-700">{m.rate.toFixed(2)}% fixe</span>}
      </td>
      <td className="px-3 py-3 text-center text-xs text-gray-500">
        <div>{formatDate(m.startDate)}</div>
        <div className="font-semibold text-gray-900">{formatDate(m.endDate)}</div>
        <div className="mt-0.5">{yrs > 0 ? `${yrs.toFixed(1)} ans` : "Expiré"}</div>
      </td>
      <td className={`px-3 py-3 text-right font-mono text-sm ${excluded ? "text-gray-400" : "text-gray-700"}`}>
        {m.annualAmortization > 0 ? formatCHF(eff(m, m.annualAmortization)) : "–"}
      </td>
      <td className={`px-3 py-3 text-right font-mono text-sm font-bold ${excluded ? "text-gray-400" : "text-yellow-700"}`}>
        {formatCHF(eff(m, m.remainingToday))}
        {m.shared && <div className="text-xs font-normal text-gray-400">({formatCHF(m.remainingToday)} total)</div>}
      </td>
      <td className={`px-3 py-3 text-right font-mono text-sm ${excluded ? "text-gray-400" : "text-gray-600"}`}>
        {formatCHF(eff(m, m.remainingAtEnd))}
      </td>
      <td className={`px-3 py-3 text-right font-mono text-sm font-semibold ${excluded ? "text-gray-400" : "text-purple-700"}`}>
        {formatCHF(calcAnnualInterest(m))}
      </td>
      <td className={`px-3 py-3 text-right font-mono text-sm ${excluded ? "text-gray-400" : "text-gray-600"}`}>
        {formatCHF(remInterest)}
      </td>
      <td className="px-3 py-3 text-right text-xs">
        {m.propertyValue ? (
          <>
            <div className={`font-mono ${excluded ? "text-gray-400" : "text-gray-700"}`}>{formatCHF(eff(m, m.propertyValue))}</div>
            {m.shared && <div className="text-gray-400">({formatCHF(m.propertyValue)} total)</div>}
            {ltvVal !== null && !excluded && (
              <div className={`font-bold mt-0.5 ${ltvVal > 80 ? "text-red-600" : ltvVal > 66 ? "text-amber-600" : "text-yellow-700"}`}>
                LTV {ltvVal.toFixed(0)}%
              </div>
            )}
          </>
        ) : "–"}
      </td>
      <td className={`px-3 py-3 text-right text-sm ${excluded ? "text-gray-400" : ""}`}>
        {(m.monthlyRent ?? 0) > 0 ? (
          <>
            <div className={`font-mono font-semibold ${excluded ? "text-gray-400" : "text-emerald-700"}`}>{formatCHF(annualRent(m))}</div>
            <div className="text-xs text-gray-400 font-mono">{formatCHF(m.monthlyRent!)}/mois</div>
            <div className="text-xs text-red-500 font-mono mt-0.5">–{formatCHF(Math.round(annualRent(m) * 0.1))} charges</div>
          </>
        ) : <span className="text-gray-300">–</span>}
      </td>
    </tr>
  );
}

// ── Company section ───────────────────────────────────────────────────────────
function CompanySection({ company, excludedIds, onToggle }: {
  company: string; excludedIds: Set<string>; onToggle: (id: string) => void;
}) {
  const allItems = mortgages.filter((m) => m.company === company);
  const activeItems = allItems.filter((m) => !excludedIds.has(m.id));

  const totalInitial = activeItems.reduce((s, m) => s + eff(m, m.totalAmount), 0);
  const totalToday = activeItems.reduce((s, m) => s + eff(m, m.remainingToday), 0);
  const totalEnd = activeItems.reduce((s, m) => s + eff(m, m.remainingAtEnd), 0);
  const totalIntAnnual = activeItems.reduce((s, m) => s + calcAnnualInterest(m), 0);
  const totalIntRem = activeItems.reduce((s, m) => s + calcRemainingInterest(m), 0);
  const totalIntFull = activeItems.reduce((s, m) => s + calcTotalInterestFullPeriod(m), 0);
  const totalAmort = activeItems.reduce((s, m) => s + eff(m, m.annualAmortization), 0);
  const totalRent = activeItems.reduce((s, m) => s + annualRent(m), 0);
  const totalCharges = Math.round(totalRent * 0.1);
  const propValue = totalPropertyValue(activeItems);
  const expiredCount = activeItems.filter(isExpired).length;
  const soonCount = activeItems.filter(isExpiringSoon).length;
  const excludedCount = allItems.length - activeItems.length;

  return (
    <section className="mb-10">
      {/* ── Company header band ── */}
      <div className="rounded-2xl bg-black text-white p-4 mb-4 shadow-md">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h2 className="text-sm font-bold text-white leading-snug">{company}</h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className="text-xs text-gray-400">{activeItems.length}/{allItems.length} hypothèque{allItems.length > 1 ? "s" : ""}</span>
              {excludedCount > 0 && <span className="rounded-full bg-gray-700 px-2 py-0.5 text-[11px] font-semibold text-gray-300">{excludedCount} exclu{excludedCount > 1 ? "s" : ""}</span>}
              {expiredCount > 0 && <span className="rounded-full bg-red-900 px-2 py-0.5 text-[11px] font-semibold text-red-300">⚠ {expiredCount} expiré{expiredCount > 1 ? "s" : ""}</span>}
              {soonCount > 0 && <span className="rounded-full bg-amber-900 px-2 py-0.5 text-[11px] font-semibold text-amber-300">⏳ {soonCount} bientôt</span>}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <CompanyStat label="Solde actuel" value={formatCHF(totalToday)} yellow />
          <CompanyStat label="Intérêts annuels" value={formatCHF(totalIntAnnual)} purple />
          {totalRent > 0 && <CompanyStat label="Loyers annuels" value={formatCHF(totalRent)} green />}
          {propValue > 0 && <CompanyStat label="Valeur des biens" value={formatCHF(propValue)} />}
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden">
        {allItems.map((m) => (
          <MortgageCard key={m.id} m={m} excluded={excludedIds.has(m.id)} onToggle={() => onToggle(m.id)} />
        ))}
        {/* Totals */}
        <div className="rounded-2xl bg-gray-900 text-white p-4 grid grid-cols-2 gap-2 mt-1 mb-2">
          <div className="col-span-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
            Sous-total — {activeItems.length}{excludedCount > 0 ? `/${allItems.length}` : ""} contrat{allItems.length > 1 ? "s" : ""}
          </div>
          <TotalCell label="Montant initial" value={formatCHF(totalInitial)} />
          <TotalCell label="Solde aujourd'hui" value={formatCHF(totalToday)} yellow />
          <TotalCell label="Solde à la fin" value={formatCHF(totalEnd)} />
          <TotalCell label="Intérêts annuels" value={formatCHF(totalIntAnnual)} purple />
          {propValue > 0 && <TotalCell label="Valeur des biens" value={formatCHF(propValue)} />}
          {propValue > 0 && <TotalCell label="Fonds propres" value={formatCHF(propValue - totalToday)} green />}
          {totalRent > 0 && <TotalCell label="Loyers annuels" value={formatCHF(totalRent)} green />}
          {totalRent > 0 && <TotalCell label="Charges (10%)" value={`–${formatCHF(totalCharges)}`} />}
          <TotalCell label="Intérêts totaux contrat" value={formatCHF(totalIntFull)} />
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="bg-gray-100 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
              {["Bien / Contrat", "Statut", "Montant initial", "Taux", "Période", "Amort. annuel", "Solde actuel", "Solde fin contrat", "Intérêts annuels", "Intérêts restants", "Valeur / LTV", "Loyers annuels"].map((h, i) => (
                <th key={h} className={`px-3 py-2.5 font-semibold ${i === 0 ? "text-left" : i <= 1 ? "text-center" : "text-right"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allItems.map((m, i) => (
              <TableRow key={m.id} m={m} idx={i} excluded={excludedIds.has(m.id)} onToggle={() => onToggle(m.id)} />
            ))}
            <tr className="bg-black text-white text-sm font-bold border-t-2 border-yellow-400">
              <td className="px-3 py-3" colSpan={2}>
                Sous-total — {activeItems.length}{excludedCount > 0 ? `/${allItems.length}` : ""} contrat{allItems.length > 1 ? "s" : ""}
              </td>
              <td className="px-3 py-3 text-right font-mono">{formatCHF(totalInitial)}</td>
              <td /><td />
              <td className="px-3 py-3 text-right font-mono">{totalAmort > 0 ? formatCHF(totalAmort) : "–"}</td>
              <td className="px-3 py-3 text-right font-mono text-yellow-400">{formatCHF(totalToday)}</td>
              <td className="px-3 py-3 text-right font-mono text-gray-300">{formatCHF(totalEnd)}</td>
              <td className="px-3 py-3 text-right font-mono text-purple-300">{formatCHF(totalIntAnnual)}</td>
              <td className="px-3 py-3 text-right font-mono text-gray-400">{formatCHF(totalIntRem)}</td>
              <td className="px-3 py-3 text-right font-mono">
                {propValue > 0 ? (
                  <>
                    <div className="text-gray-200">{formatCHF(propValue)}</div>
                    <div className="text-xs font-normal text-emerald-400">+{formatCHF(propValue - totalToday)}</div>
                  </>
                ) : "–"}
              </td>
              <td className="px-3 py-3 text-right font-mono">
                {totalRent > 0 ? (
                  <>
                    <div className="text-emerald-400">{formatCHF(totalRent)}</div>
                    <div className="text-xs font-normal text-red-400">–{formatCHF(totalCharges)}</div>
                  </>
                ) : "–"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CompanyStat({ label, value, yellow, purple, green }: { label: string; value: string; yellow?: boolean; purple?: boolean; green?: boolean }) {
  return (
    <div className="rounded-xl bg-white/10 border border-white/10 p-2.5">
      <div className="text-[11px] text-gray-400">{label}</div>
      <div className={`text-sm font-bold mt-0.5 ${yellow ? "text-yellow-400" : purple ? "text-purple-300" : green ? "text-emerald-400" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

function TotalCell({ label, value, yellow, purple, green }: { label: string; value: string; yellow?: boolean; purple?: boolean; green?: boolean }) {
  return (
    <div className="rounded-xl bg-gray-800 p-2.5">
      <div className="text-gray-400 text-[11px]">{label}</div>
      <div className={`font-bold text-sm mt-0.5 ${yellow ? "text-yellow-400" : purple ? "text-purple-300" : green ? "text-emerald-400" : "text-white"}`}>{value}</div>
    </div>
  );
}

// ── Grand summary KPI cards ───────────────────────────────────────────────────
function SummaryCards({ activeMortgages }: { activeMortgages: Mortgage[] }) {
  const all = mortgages;
  const totalInitial = activeMortgages.reduce((s, m) => s + eff(m, m.totalAmount), 0);
  const totalToday = activeMortgages.reduce((s, m) => s + eff(m, m.remainingToday), 0);
  const totalIntAnnual = activeMortgages.reduce((s, m) => s + calcAnnualInterest(m), 0);
  const totalIntRem = activeMortgages.reduce((s, m) => s + calcRemainingInterest(m), 0);
  const totalRentGlobal = activeMortgages.reduce((s, m) => s + annualRent(m), 0);
  const totalChargesGlobal = Math.round(totalRentGlobal * 0.1);
  const totalAmortA = activeMortgages.reduce((s, m) => s + eff(m, m.annualAmortization), 0);
  const totalAmortQ = activeMortgages.reduce((s, m) => s + eff(m, m.quarterlyAmortization), 0);
  const propValue = totalPropertyValue(activeMortgages);
  const expiredCount = activeMortgages.filter(isExpired).length;
  const soonCount = activeMortgages.filter(isExpiringSoon).length;
  const excludedCount = all.length - activeMortgages.length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
      <KpiCard icon="🏦" title="Encours total" value={formatCHF(totalToday)} sub={`sur ${formatCHF(totalInitial)} initiaux`} accent="yellow" />
      <KpiCard icon="🏠" title="Valeur des biens" value={formatCHF(propValue)} sub={`LTV moy. ${propValue > 0 ? ((totalToday / propValue) * 100).toFixed(0) : "–"}%`} accent="gray" />
      <KpiCard icon="💰" title="Fonds propres" value={formatCHF(propValue - totalToday)} sub={`${propValue > 0 ? (((propValue - totalToday) / propValue) * 100).toFixed(0) : "–"}% de la valeur`} accent="green" />
      <KpiCard icon="💶" title="Intérêts annuels" value={formatCHF(totalIntAnnual)} sub={`${formatCHF(totalIntRem)} restants`} accent="purple" />
      <KpiCard icon="📉" title="Amort. annuel" value={formatCHF(totalAmortA)} sub={`${formatCHF(totalAmortQ)} / trimestre`} accent="gray" />
      <KpiCard icon="🏘️" title="Loyers annuels" value={formatCHF(totalRentGlobal)} sub={`Charges : –${formatCHF(totalChargesGlobal)}`} accent="emerald" />
      <KpiCard
        icon="⚠️"
        title="Alertes"
        value={`${expiredCount + soonCount} contrat${expiredCount + soonCount !== 1 ? "s" : ""}`}
        sub={`${expiredCount} expiré · ${soonCount} bientôt${excludedCount > 0 ? ` · ${excludedCount} exclu` : ""}`}
        accent={expiredCount > 0 ? "red" : soonCount > 0 ? "amber" : "green"}
      />
    </div>
  );
}

function KpiCard({ icon, title, value, sub, accent }: { icon: string; title: string; value: string; sub: string; accent: string }) {
  const border: Record<string, string> = {
    yellow:  "border-l-yellow-400 bg-yellow-50 border border-yellow-200 border-l-4",
    green:   "border-l-emerald-500 bg-emerald-50 border border-emerald-200 border-l-4",
    purple:  "border-l-purple-500 bg-purple-50 border border-purple-200 border-l-4",
    emerald: "border-l-emerald-400 bg-emerald-50 border border-emerald-200 border-l-4",
    gray:    "border-l-gray-400 bg-white border border-gray-200 border-l-4",
    red:     "border-l-red-500 bg-red-50 border border-red-200 border-l-4",
    amber:   "border-l-amber-400 bg-amber-50 border border-amber-200 border-l-4",
  };
  const val: Record<string, string> = {
    yellow: "text-yellow-800", green: "text-emerald-800", purple: "text-purple-800",
    emerald: "text-emerald-800", gray: "text-gray-900", red: "text-red-700", amber: "text-amber-700",
  };
  const subColor: Record<string, string> = {
    yellow: "text-yellow-600", green: "text-emerald-600", purple: "text-purple-600",
    emerald: "text-emerald-600", gray: "text-gray-500", red: "text-red-500", amber: "text-amber-600",
  };
  return (
    <div className={`rounded-2xl p-3 shadow-sm flex flex-col gap-1 ${border[accent]}`}>
      <div className="text-xl leading-none">{icon}</div>
      <div className="text-[11px] font-medium text-gray-600 leading-tight mt-1">{title}</div>
      <div className={`text-sm font-bold leading-tight ${val[accent]}`}>{value}</div>
      <div className={`text-[10px] leading-tight ${subColor[accent]}`}>{sub}</div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [activeCompany, setActiveCompany] = useState<string | null>(null);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  function toggleExclude(id: string) {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const activeMortgages = mortgages.filter((m) => !excludedIds.has(m.id));
  const totalToday = activeMortgages.reduce((s, m) => s + eff(m, m.remainingToday), 0);
  const visible = activeCompany ? [activeCompany] : companies;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-black sticky top-0 z-20 shadow-md">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-9 h-9 shrink-0">
              <Image src="/logo.png" alt="MBA Groupe SA" fill className="object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white leading-tight">MBA Groupe SA</h1>
              <div className="text-[11px] text-gray-400 truncate">
                {TODAY.toLocaleDateString("fr-CH", { day: "2-digit", month: "long", year: "numeric" })}
                {excludedIds.size > 0 && (
                  <span className="ml-2 text-yellow-400 font-medium">· {excludedIds.size} exclu{excludedIds.size > 1 ? "s" : ""}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {excludedIds.size > 0 && (
              <button
                onClick={() => setExcludedIds(new Set())}
                className="text-xs rounded-full bg-yellow-400/20 text-yellow-400 px-3 py-1.5 font-medium border border-yellow-400/30"
              >
                ↺ Reset
              </button>
            )}
            <div className="text-right">
              <div className="text-[11px] text-gray-400">Encours</div>
              <div className="text-lg font-bold text-yellow-400 leading-tight">{formatCHF(totalToday)}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-3 py-5">
        <SummaryCards activeMortgages={activeMortgages} />

        {/* Hint */}
        <div className="mb-4 rounded-xl bg-yellow-50 border border-yellow-200 px-3 py-2.5 text-[11px] text-yellow-700 flex items-start gap-2">
          <span className="mt-0.5">💡</span>
          <span className="md:hidden">Ouvrez une fiche et appuyez sur « Exclure des totaux » pour retirer un bien du calcul.</span>
          <span className="hidden md:inline">Cliquez sur une ligne du tableau pour l'exclure des totaux. Cliquez à nouveau pour la réinclure.</span>
        </div>

        {/* Filter buttons */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          <FilterBtn label="Toutes" active={activeCompany === null} onClick={() => setActiveCompany(null)} />
          {companies.map((c) => (
            <FilterBtn key={c} label={c} active={activeCompany === c} onClick={() => setActiveCompany(activeCompany === c ? null : c)} />
          ))}
        </div>

        {visible.map((c) => (
          <CompanySection key={c} company={c} excludedIds={excludedIds} onToggle={toggleExclude} />
        ))}

        <div className="rounded-2xl bg-white border border-gray-200 p-4 mt-2 text-xs text-gray-500 leading-relaxed shadow-sm">
          <strong className="text-gray-800">Note — Taux Saron Flex :</strong> Les intérêts calculés pour les contrats à taux variable utilisent uniquement la marge (spread) indiquée. Le taux Saron réel peut varier — les montants sont une estimation minimale.
        </div>

        <footer className="mt-6 pb-4 text-center text-[11px] text-gray-400">
          MBA Groupe SA · Données au {TODAY.toLocaleDateString("fr-CH")}
        </footer>
      </main>
    </div>
  );
}

function FilterBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors border shrink-0 ${
        active
          ? "bg-black text-yellow-400 border-black font-bold"
          : "bg-white border-gray-300 text-gray-600 hover:border-gray-400"
      }`}
    >
      {label}
    </button>
  );
}
