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
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-900/60 px-2 py-0.5 text-xs font-semibold text-red-400">⚠ Expiré</span>;
  if (isExpiringSoon(m))
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-900/60 px-2 py-0.5 text-xs font-semibold text-amber-400">⏳ Bientôt</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-green-900/60 px-2 py-0.5 text-xs font-semibold text-green-400">✓ Actif</span>;
}

function LtvBar({ value }: { value: number }) {
  const color = value > 80 ? "bg-red-500" : value > 66 ? "bg-amber-400" : "bg-yellow-400";
  const textColor = value > 80 ? "text-red-400" : value > 66 ? "text-amber-400" : "text-yellow-400";
  return (
    <div>
      <div className="flex justify-between text-xs text-zinc-400 mb-1">
        <span>LTV</span>
        <span className={`font-bold ${textColor}`}>{value.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-zinc-700">
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

  const borderColor = excluded ? "border-zinc-700"
    : isExpired(m) ? "border-red-800/60"
    : isExpiringSoon(m) ? "border-amber-700/60"
    : "border-zinc-700/60";

  return (
    <div className={`rounded-2xl border ${borderColor} overflow-hidden mb-3 transition-all ${excluded ? "opacity-40" : ""} bg-zinc-900`}>
      {/* Card header — always visible */}
      <button className="w-full text-left p-4" onClick={() => setOpen((v) => !v)}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className={`font-bold text-sm leading-snug ${excluded ? "line-through text-zinc-500" : "text-white"}`}>
              {m.label}
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="text-[11px] text-zinc-500 font-mono">{m.id}</span>
              {m.shared && (
                <span className="rounded-full bg-yellow-400/15 border border-yellow-400/30 px-1.5 py-0.5 text-[10px] font-bold text-yellow-400">
                  50% MBA
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            {excluded
              ? <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs font-semibold text-zinc-400">Exclu</span>
              : <StatusBadge m={m} />}
            <span className="text-[11px] text-zinc-500">{open ? "▲" : "▼"}</span>
          </div>
        </div>

        {/* Key figures — 2-col grid */}
        {!excluded && (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-yellow-400/10 border border-yellow-400/20 p-3">
              <div className="text-[11px] text-yellow-400/80 font-medium mb-0.5">Solde actuel</div>
              <div className="text-base font-bold text-yellow-300 leading-tight">{formatCHF(eff(m, m.remainingToday))}</div>
            </div>
            <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-3">
              <div className="text-[11px] text-purple-400/80 font-medium mb-0.5">Intérêts annuels</div>
              <div className="text-base font-bold text-purple-300 leading-tight">{formatCHF(annualInterest)}</div>
            </div>
            {rent > 0 && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3">
                <div className="text-[11px] text-emerald-400/80 font-medium mb-0.5">Loyer annuel</div>
                <div className="text-base font-bold text-emerald-300 leading-tight">{formatCHF(rent)}</div>
              </div>
            )}
            <div className={`rounded-xl bg-zinc-800 border border-zinc-700 p-3 ${rent > 0 ? "" : "col-span-1"}`}>
              <div className="text-[11px] text-zinc-400 font-medium mb-0.5">Taux</div>
              <div className="text-sm font-bold text-white leading-tight">
                {m.rateType === "saron" ? `S+${m.rate}%` : `${m.rate.toFixed(2)}%`}
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">{m.rateType === "saron" ? "Variable" : "Fixe"}</div>
            </div>
          </div>
        )}

        {/* LTV bar */}
        {!excluded && ltvVal !== null && (
          <div className="mt-3">
            <LtvBar value={ltvVal} />
          </div>
        )}
      </button>

      {/* Expanded details */}
      {open && (
        <div className="border-t border-zinc-800 bg-zinc-950/50 p-4 space-y-0">
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
              className={`w-full rounded-xl py-3 text-sm font-bold transition-colors ${
                excluded
                  ? "bg-yellow-400/20 text-yellow-400 border border-yellow-400/30"
                  : "bg-red-900/30 text-red-400 border border-red-800/40"
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
      <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2">{title}</div>
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 divide-y divide-zinc-800 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function DataRow({ label, value, accent }: { label: string; value: string; accent?: "purple" | "green" | "red" | "amber" }) {
  const valueColor = accent === "purple" ? "text-purple-400"
    : accent === "green" ? "text-emerald-400"
    : accent === "red" ? "text-red-400"
    : accent === "amber" ? "text-amber-400"
    : "text-white";
  return (
    <div className="flex justify-between items-center px-3 py-2.5 gap-2">
      <span className="text-zinc-400 text-xs">{label}</span>
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
      title={excluded ? "Cliquer pour réinclure" : "Cliquer pour exclure des totaux"}
      className={`border-b border-zinc-800 cursor-pointer transition-all select-none ${
        excluded ? "opacity-30 bg-zinc-900 hover:opacity-50"
        : idx % 2 === 0 ? "bg-zinc-900 hover:bg-zinc-800"
        : "bg-zinc-950 hover:bg-zinc-800"
      }`}
    >
      <td className="px-3 py-3">
        <div className={`font-medium text-sm leading-snug ${excluded ? "line-through text-zinc-500" : "text-white"}`}>{m.label}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-zinc-500 font-mono">{m.id}</span>
          {m.shared && <span className="inline-flex items-center rounded-full bg-yellow-900/50 px-1.5 py-0.5 text-xs font-semibold text-yellow-400">50% MBA</span>}
        </div>
      </td>
      <td className="px-3 py-3 text-center">
        {excluded
          ? <span className="inline-flex items-center rounded-full bg-zinc-700 px-2 py-0.5 text-xs font-semibold text-zinc-400">Exclu</span>
          : <StatusBadge m={m} />}
      </td>
      <td className={`px-3 py-3 text-right font-mono text-sm ${excluded ? "text-zinc-500" : "text-zinc-300"}`}>
        {formatCHF(eff(m, m.totalAmount))}
        {m.shared && <div className="text-xs text-zinc-500">({formatCHF(m.totalAmount)} total)</div>}
      </td>
      <td className="px-3 py-3 text-center">
        {m.rateType === "saron"
          ? <span className="inline-block rounded bg-yellow-900/50 px-1.5 py-0.5 text-xs font-semibold text-yellow-400">Saron +{m.rate}%</span>
          : <span className="inline-block rounded bg-zinc-700 px-1.5 py-0.5 text-xs font-semibold text-zinc-300">{m.rate.toFixed(2)}% fixe</span>}
      </td>
      <td className="px-3 py-3 text-center text-xs text-zinc-400">
        <div>{formatDate(m.startDate)}</div>
        <div className="font-semibold text-white">{formatDate(m.endDate)}</div>
        <div className="mt-0.5">{yrs > 0 ? `${yrs.toFixed(1)} ans` : "Expiré"}</div>
      </td>
      <td className={`px-3 py-3 text-right font-mono text-sm ${excluded ? "text-zinc-500" : "text-zinc-300"}`}>
        {m.annualAmortization > 0 ? formatCHF(eff(m, m.annualAmortization)) : "–"}
      </td>
      <td className={`px-3 py-3 text-right font-mono text-sm font-semibold ${excluded ? "text-zinc-500" : "text-yellow-400"}`}>
        {formatCHF(eff(m, m.remainingToday))}
        {m.shared && <div className="text-xs font-normal text-zinc-500">({formatCHF(m.remainingToday)} total)</div>}
      </td>
      <td className={`px-3 py-3 text-right font-mono text-sm ${excluded ? "text-zinc-500" : "text-zinc-400"}`}>
        {formatCHF(eff(m, m.remainingAtEnd))}
      </td>
      <td className={`px-3 py-3 text-right font-mono text-sm font-semibold ${excluded ? "text-zinc-500" : "text-purple-400"}`}>
        {formatCHF(calcAnnualInterest(m))}
      </td>
      <td className={`px-3 py-3 text-right font-mono text-sm ${excluded ? "text-zinc-500" : "text-zinc-400"}`}>
        {formatCHF(remInterest)}
      </td>
      <td className="px-3 py-3 text-right text-xs text-zinc-400">
        {m.propertyValue ? (
          <>
            <div className="font-mono text-zinc-300">{formatCHF(eff(m, m.propertyValue))}</div>
            {m.shared && <div className="text-zinc-500">({formatCHF(m.propertyValue)} total)</div>}
            {ltvVal !== null && !excluded && (
              <div className={`font-bold mt-0.5 ${ltvVal > 80 ? "text-red-400" : ltvVal > 66 ? "text-amber-400" : "text-yellow-400"}`}>
                LTV {ltvVal.toFixed(0)}%
              </div>
            )}
          </>
        ) : "–"}
      </td>
      <td className={`px-3 py-3 text-right text-sm ${excluded ? "text-zinc-500" : (m.monthlyRent ?? 0) > 0 ? "" : "text-zinc-600"}`}>
        {(m.monthlyRent ?? 0) > 0 ? (
          <>
            <div className="font-mono font-semibold text-emerald-400">{formatCHF(annualRent(m))}</div>
            <div className="text-xs text-zinc-500 font-mono">{formatCHF(m.monthlyRent!)}/mois</div>
            <div className="text-xs text-red-400 font-mono mt-0.5">–{formatCHF(Math.round(annualRent(m) * 0.1))} charges</div>
          </>
        ) : "–"}
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
    <section className="mb-8">
      {/* Company header */}
      <div className="rounded-2xl bg-zinc-900 border border-yellow-400/25 p-4 mb-3 shadow-lg">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h2 className="text-sm font-bold text-white leading-snug">{company}</h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="text-xs text-zinc-500">{activeItems.length}/{allItems.length} hypothèque{allItems.length > 1 ? "s" : ""}</span>
              {excludedCount > 0 && <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-[11px] font-semibold text-zinc-300">{excludedCount} exclu{excludedCount > 1 ? "s" : ""}</span>}
              {expiredCount > 0 && <span className="rounded-full bg-red-900/60 px-2 py-0.5 text-[11px] font-semibold text-red-400">⚠ {expiredCount} expiré{expiredCount > 1 ? "s" : ""}</span>}
              {soonCount > 0 && <span className="rounded-full bg-amber-900/60 px-2 py-0.5 text-[11px] font-semibold text-amber-400">⏳ {soonCount} bientôt</span>}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="Solde actuel" value={formatCHF(totalToday)} accent="yellow" />
          <MiniStat label="Intérêts annuels" value={formatCHF(totalIntAnnual)} accent="purple" />
          {totalRent > 0 && <MiniStat label="Loyers annuels" value={formatCHF(totalRent)} accent="green" />}
          {propValue > 0 && <MiniStat label="Valeur des biens" value={formatCHF(propValue)} />}
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden">
        {allItems.map((m) => (
          <MortgageCard key={m.id} m={m} excluded={excludedIds.has(m.id)} onToggle={() => onToggle(m.id)} />
        ))}
        {/* Mobile totals */}
        <div className="rounded-2xl bg-zinc-900 border border-zinc-700/60 p-4 grid grid-cols-2 gap-2 mt-1 mb-4">
          <div className="col-span-2 text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
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
      <div className="hidden md:block overflow-x-auto rounded-xl border border-zinc-800 shadow">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="bg-zinc-800 text-xs text-zinc-400 uppercase tracking-wide border-b border-zinc-700">
              {["Bien / Contrat", "Statut", "Montant initial", "Taux", "Période", "Amort. annuel", "Solde actuel", "Solde fin contrat", "Intérêts annuels", "Intérêts restants", "Valeur / LTV", "Loyers annuels"].map((h, i) => (
                <th key={h} className={`px-3 py-2 ${i === 0 ? "text-left" : i <= 1 ? "text-center" : "text-right"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allItems.map((m, i) => (
              <TableRow key={m.id} m={m} idx={i} excluded={excludedIds.has(m.id)} onToggle={() => onToggle(m.id)} />
            ))}
            <tr className="bg-zinc-800 border-t-2 border-yellow-400/30 text-sm font-bold text-white">
              <td className="px-3 py-3" colSpan={2}>Sous-total — {activeItems.length}{excludedCount > 0 ? `/${allItems.length}` : ""} contrat{allItems.length > 1 ? "s" : ""}</td>
              <td className="px-3 py-3 text-right font-mono">{formatCHF(totalInitial)}</td>
              <td /><td />
              <td className="px-3 py-3 text-right font-mono">{totalAmort > 0 ? formatCHF(totalAmort) : "–"}</td>
              <td className="px-3 py-3 text-right font-mono text-yellow-400">{formatCHF(totalToday)}</td>
              <td className="px-3 py-3 text-right font-mono text-zinc-300">{formatCHF(totalEnd)}</td>
              <td className="px-3 py-3 text-right font-mono text-purple-400">{formatCHF(totalIntAnnual)}</td>
              <td className="px-3 py-3 text-right font-mono text-zinc-400">{formatCHF(totalIntRem)}</td>
              <td className="px-3 py-3 text-right font-mono text-zinc-300">
                {propValue > 0 ? formatCHF(propValue) : "–"}
                {propValue > 0 && <div className="text-xs font-normal text-emerald-400">+{formatCHF(propValue - totalToday)}</div>}
              </td>
              <td className="px-3 py-3 text-right font-mono text-emerald-400">
                {totalRent > 0 ? (
                  <>
                    <div>{formatCHF(totalRent)}</div>
                    <div className="text-xs font-normal text-red-400">–{formatCHF(totalCharges)} charges</div>
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

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: "yellow" | "purple" | "green" }) {
  const bg = accent === "yellow" ? "bg-yellow-400/10 border-yellow-400/20"
    : accent === "purple" ? "bg-purple-500/10 border-purple-500/20"
    : accent === "green" ? "bg-emerald-500/10 border-emerald-500/20"
    : "bg-zinc-800 border-zinc-700";
  const val = accent === "yellow" ? "text-yellow-400"
    : accent === "purple" ? "text-purple-400"
    : accent === "green" ? "text-emerald-400"
    : "text-white";
  return (
    <div className={`rounded-xl border p-2.5 ${bg}`}>
      <div className="text-[11px] text-zinc-400">{label}</div>
      <div className={`text-sm font-bold mt-0.5 ${val}`}>{value}</div>
    </div>
  );
}

function TotalCell({ label, value, yellow, purple, green }: { label: string; value: string; yellow?: boolean; purple?: boolean; green?: boolean }) {
  return (
    <div className="rounded-xl bg-zinc-800 p-2.5">
      <div className="text-zinc-400 text-[11px]">{label}</div>
      <div className={`font-bold text-sm mt-0.5 ${yellow ? "text-yellow-400" : purple ? "text-purple-400" : green ? "text-emerald-400" : "text-white"}`}>{value}</div>
    </div>
  );
}

// ── Grand summary cards ───────────────────────────────────────────────────────
function SummaryCards({ activeMortgages }: { activeMortgages: Mortgage[] }) {
  const all = mortgages;
  const totalInitial = activeMortgages.reduce((s, m) => s + eff(m, m.totalAmount), 0);
  const totalToday = activeMortgages.reduce((s, m) => s + eff(m, m.remainingToday), 0);
  const totalIntAnnual = activeMortgages.reduce((s, m) => s + calcAnnualInterest(m), 0);
  const totalIntRem = activeMortgages.reduce((s, m) => s + calcRemainingInterest(m), 0);
  const totalIntFull = activeMortgages.reduce((s, m) => s + calcTotalInterestFullPeriod(m), 0);
  const totalRentGlobal = activeMortgages.reduce((s, m) => s + annualRent(m), 0);
  const totalChargesGlobal = Math.round(totalRentGlobal * 0.1);
  const totalAmortA = activeMortgages.reduce((s, m) => s + eff(m, m.annualAmortization), 0);
  const totalAmortQ = activeMortgages.reduce((s, m) => s + eff(m, m.quarterlyAmortization), 0);
  const propValue = totalPropertyValue(activeMortgages);
  const expiredCount = activeMortgages.filter(isExpired).length;
  const soonCount = activeMortgages.filter(isExpiringSoon).length;
  const excludedCount = all.length - activeMortgages.length;

  const alertAccent = expiredCount > 0 ? "red" : soonCount > 0 ? "amber" : "green";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
      <KpiCard icon="🏦" title="Encours total" value={formatCHF(totalToday)} sub={`sur ${formatCHF(totalInitial)} initiaux`} accent="yellow" />
      <KpiCard icon="🏠" title="Valeur des biens" value={formatCHF(propValue)} sub={`LTV moy. ${propValue > 0 ? ((totalToday / propValue) * 100).toFixed(0) : "–"}%`} accent="zinc" />
      <KpiCard icon="💰" title="Fonds propres" value={formatCHF(propValue - totalToday)} sub={`${propValue > 0 ? (((propValue - totalToday) / propValue) * 100).toFixed(0) : "–"}% de la valeur`} accent="green" />
      <KpiCard icon="💶" title="Intérêts annuels" value={formatCHF(totalIntAnnual)} sub={`${formatCHF(totalIntRem)} restants`} accent="purple" />
      <KpiCard icon="📉" title="Amort. annuel" value={formatCHF(totalAmortA)} sub={`${formatCHF(totalAmortQ)} / trimestre`} accent="zinc" />
      <KpiCard icon="🏘️" title="Loyers annuels" value={formatCHF(totalRentGlobal)} sub={`Charges : –${formatCHF(totalChargesGlobal)}`} accent="emerald" />
      <KpiCard
        icon="⚠️"
        title="Alertes"
        value={`${expiredCount + soonCount} contrat${expiredCount + soonCount !== 1 ? "s" : ""}`}
        sub={`${expiredCount} expiré · ${soonCount} bientôt${excludedCount > 0 ? ` · ${excludedCount} exclu` : ""}`}
        accent={alertAccent}
      />
    </div>
  );
}

function KpiCard({ icon, title, value, sub, accent }: { icon: string; title: string; value: string; sub: string; accent: string }) {
  const border: Record<string, string> = {
    yellow: "border-yellow-400/40 bg-yellow-400/5",
    green:  "border-emerald-400/40 bg-emerald-400/5",
    purple: "border-purple-400/40 bg-purple-400/5",
    emerald:"border-emerald-500/40 bg-emerald-500/5",
    zinc:   "border-zinc-700 bg-zinc-800/60",
    red:    "border-red-500/40 bg-red-500/5",
    amber:  "border-amber-400/40 bg-amber-400/5",
  };
  const val: Record<string, string> = {
    yellow: "text-yellow-400", green: "text-emerald-400", purple: "text-purple-400",
    emerald: "text-emerald-400", zinc: "text-white", red: "text-red-400", amber: "text-amber-400",
  };
  return (
    <div className={`rounded-2xl p-3 border ${border[accent]} flex flex-col gap-1`}>
      <div className="text-xl leading-none">{icon}</div>
      <div className="text-[11px] font-medium text-zinc-400 leading-tight mt-1">{title}</div>
      <div className={`text-sm font-bold leading-tight ${val[accent]}`}>{value}</div>
      <div className="text-[10px] text-zinc-500 leading-tight">{sub}</div>
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
    <div className="min-h-screen bg-zinc-950">
      {/* header */}
      <header className="bg-black border-b border-zinc-800 sticky top-0 z-20">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-9 h-9 shrink-0">
              <Image src="/logo.png" alt="MBA Groupe SA" fill className="object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white leading-tight">MBA Groupe SA</h1>
              <div className="text-[11px] text-zinc-500 truncate">
                {TODAY.toLocaleDateString("fr-CH", { day: "2-digit", month: "long", year: "numeric" })}
                {excludedIds.size > 0 && <span className="ml-2 text-yellow-400 font-medium">· {excludedIds.size} exclu{excludedIds.size > 1 ? "s" : ""}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {excludedIds.size > 0 && (
              <button
                onClick={() => setExcludedIds(new Set())}
                className="text-xs rounded-full bg-yellow-400/20 text-yellow-400 px-3 py-1.5 font-medium border border-yellow-400/30"
              >
                ↺
              </button>
            )}
            <div className="text-right">
              <div className="text-[11px] text-zinc-500">Encours</div>
              <div className="text-lg font-bold text-yellow-400 leading-tight">{formatCHF(totalToday)}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-3 py-5">
        <SummaryCards activeMortgages={activeMortgages} />

        {/* Hint */}
        <div className="mb-4 rounded-xl bg-yellow-400/5 border border-yellow-400/15 px-3 py-2 text-[11px] text-yellow-400/70 flex items-start gap-2">
          <span className="mt-0.5">💡</span>
          <span className="md:hidden">Ouvrez une fiche et appuyez sur « Exclure des totaux » pour retirer un bien du calcul.</span>
          <span className="hidden md:inline">Cliquez sur une ligne du tableau pour l'exclure des totaux. Cliquez à nouveau pour la réinclure.</span>
        </div>

        {/* Filter buttons — horizontal scroll */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
          <FilterBtn label="Toutes" active={activeCompany === null} onClick={() => setActiveCompany(null)} />
          {companies.map((c) => (
            <FilterBtn key={c} label={c} active={activeCompany === c} onClick={() => setActiveCompany(activeCompany === c ? null : c)} />
          ))}
        </div>

        {visible.map((c) => (
          <CompanySection key={c} company={c} excludedIds={excludedIds} onToggle={toggleExclude} />
        ))}

        <div className="rounded-2xl bg-zinc-900 border border-zinc-700/60 p-4 mt-4 text-xs text-zinc-400 leading-relaxed">
          <strong className="text-yellow-400">Note — Taux Saron Flex :</strong> Les intérêts calculés pour les contrats à taux variable utilisent uniquement la marge (spread) indiquée. Le taux Saron réel peut varier — les montants sont une estimation minimale.
        </div>

        <footer className="mt-6 pb-4 text-center text-[11px] text-zinc-600">
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
        active ? "bg-yellow-400 text-black border-yellow-400 font-bold" : "bg-transparent border-zinc-700 text-zinc-300"
      }`}
    >
      {label}
    </button>
  );
}
