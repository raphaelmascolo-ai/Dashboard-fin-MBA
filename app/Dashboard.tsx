"use client";
import { useState, useEffect } from "react";
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
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-900/60 px-2 py-0.5 text-xs font-semibold text-amber-400">⏳ Expire bientôt</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-green-900/60 px-2 py-0.5 text-xs font-semibold text-green-400">✓ Actif</span>;
}

function LtvBar({ value }: { value: number }) {
  const color = value > 80 ? "bg-red-500" : value > 66 ? "bg-amber-400" : "bg-yellow-400";
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-zinc-400 mb-0.5">
        <span>LTV (dette / valeur du bien)</span>
        <span className={`font-semibold ${value > 80 ? "text-red-400" : value > 66 ? "text-amber-400" : "text-yellow-400"}`}>
          {value.toFixed(1)}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-700">
        <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

// ── Mobile card ───────────────────────────────────────────────────────────────
function MortgageCard({ m, excluded, onToggle }: { m: Mortgage; excluded: boolean; onToggle: () => void }) {
  const [open, setOpen] = useState(false);
  const remInterest = calcRemainingInterest(m);
  const totalInterest = calcTotalInterestFullPeriod(m);
  const ltvVal = ltv(m);
  const yrs = yearsRemaining(m);

  const borderColor = excluded ? "border-zinc-700"
    : isExpired(m) ? "border-red-800"
    : isExpiringSoon(m) ? "border-amber-700"
    : "border-zinc-700";

  return (
    <div className={`rounded-xl border ${borderColor} overflow-hidden mb-3 transition-opacity ${excluded ? "opacity-40 bg-zinc-900" : "bg-zinc-900"}`}>
      <button className="w-full text-left p-4" onClick={() => setOpen((v) => !v)}>
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className={`font-semibold text-sm leading-snug ${excluded ? "line-through text-zinc-500" : "text-white"}`}>{m.label}</div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-xs text-zinc-500 font-mono">{m.id}</span>
              {m.shared && <span className="inline-flex items-center rounded-full bg-yellow-900/50 px-1.5 py-0.5 text-xs font-semibold text-yellow-400">50% MBA</span>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {!excluded ? <StatusBadge m={m} /> : <span className="inline-flex items-center rounded-full bg-zinc-700 px-2 py-0.5 text-xs font-semibold text-zinc-400">Exclu</span>}
          </div>
        </div>
        {!excluded && (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-yellow-400/10 border border-yellow-400/20 p-2.5">
                <div className="text-xs text-yellow-400 font-medium">Solde actuel</div>
                <div className="text-sm font-bold text-yellow-300 mt-0.5">{formatCHF(eff(m, m.remainingToday))}</div>
              </div>
              <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-2.5">
                <div className="text-xs text-purple-400 font-medium">Intérêts restants</div>
                <div className="text-sm font-bold text-purple-300 mt-0.5">{formatCHF(remInterest)}</div>
              </div>
            </div>
            {(m.monthlyRent ?? 0) > 0 && (
              <div className="mt-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2.5">
                <div className="text-xs text-emerald-400 font-medium">Loyer mensuel</div>
                <div className="text-sm font-bold text-emerald-300 mt-0.5">{formatCHF(m.monthlyRent!)}/mois</div>
              </div>
            )}
            {ltvVal !== null && <LtvBar value={ltvVal} />}
          </>
        )}
        <div className="mt-2 text-right text-xs text-yellow-500">{open ? "▲ Réduire" : "▼ Voir tout"}</div>
      </button>
      {open && (
        <div className="border-t border-zinc-800 p-4 space-y-2.5 bg-zinc-950/60">
          <DataRow label="Montant initial" value={formatCHF(eff(m, m.totalAmount))} />
          <DataRow label="Taux d'intérêt" value={m.rateType === "saron" ? `Saron + ${m.rate}% (variable)` : `${m.rate.toFixed(2)}% fixe`} />
          <DataRow label="Début du contrat" value={formatDate(m.startDate)} />
          <DataRow label="Fin du contrat" value={formatDate(m.endDate)} />
          <DataRow label="Durée restante" value={yrs > 0 ? `${yrs.toFixed(1)} ans` : "Expiré"} />
          <DataRow label="Amortissement annuel" value={m.annualAmortization > 0 ? formatCHF(eff(m, m.annualAmortization)) : "–"} />
          <DataRow label="Amortissement trimestriel" value={m.quarterlyAmortization > 0 ? formatCHF(eff(m, m.quarterlyAmortization)) : "–"} />
          <DataRow label="Solde à la fin du contrat" value={formatCHF(eff(m, m.remainingAtEnd))} />
          <hr className="border-zinc-800" />
          <DataRow label="Intérêts totaux (durée contrat)" value={formatCHF(totalInterest)} highlight="purple" />
          <DataRow label="Intérêts restants à payer" value={formatCHF(remInterest)} highlight="purple" />
          {(m.monthlyRent ?? 0) > 0 && <>
            <hr className="border-zinc-800" />
            <DataRow label="Loyer mensuel" value={formatCHF(m.monthlyRent!)} highlight="green" />
            <DataRow label="Loyer annuel" value={formatCHF(annualRent(m))} highlight="green" />
            <DataRow label="Charges (10%)" value={`–${formatCHF(Math.round(annualRent(m) * 0.1))}`} />
          </>}
          {m.propertyValue && <>
            <hr className="border-zinc-800" />
            <DataRow label="Valeur du bien" value={formatCHF(eff(m, m.propertyValue))} />
          </>}
          <hr className="border-zinc-800" />
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className={`w-full rounded-lg py-2 text-xs font-semibold transition-colors ${excluded ? "bg-yellow-400/20 text-yellow-400 hover:bg-yellow-400/30" : "bg-red-900/40 text-red-400 hover:bg-red-900/60"}`}
          >
            {excluded ? "✓ Réinclure dans les totaux" : "✕ Exclure des totaux"}
          </button>
        </div>
      )}
    </div>
  );
}

function DataRow({ label, value, highlight }: { label: string; value: string; highlight?: "blue" | "purple" | "green" }) {
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className="text-zinc-400 text-xs leading-snug">{label}</span>
      <span className={`font-semibold text-xs shrink-0 ${highlight === "purple" ? "text-purple-400" : highlight === "green" ? "text-emerald-400" : "text-white"}`}>
        {value}
      </span>
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
        <div className="mt-0.5">{yrs > 0 ? `${yrs.toFixed(1)} ans restants` : "Expiré"}</div>
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
function CompanySection({ company, isMobile, excludedIds, onToggle }: {
  company: string; isMobile: boolean; excludedIds: Set<string>; onToggle: (id: string) => void;
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
      {/* company header */}
      <div className="rounded-xl bg-zinc-900 border border-yellow-400/30 p-4 mb-4 shadow">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white leading-snug">{company}</h2>
            <div className="text-xs text-zinc-400 mt-1 flex flex-wrap gap-1.5">
              <span>{activeItems.length}/{allItems.length} hypothèque{allItems.length > 1 ? "s" : ""}</span>
              {excludedCount > 0 && <span className="rounded-full bg-zinc-700 px-2 py-0.5 font-semibold text-zinc-300">{excludedCount} exclu{excludedCount > 1 ? "s" : ""}</span>}
              {expiredCount > 0 && <span className="rounded-full bg-red-900/60 px-2 py-0.5 font-semibold text-red-400">{expiredCount} expiré{expiredCount > 1 ? "s" : ""}</span>}
              {soonCount > 0 && <span className="rounded-full bg-amber-900/60 px-2 py-0.5 font-semibold text-amber-400">{soonCount} expire bientôt</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatChip label="Solde actuel" value={formatCHF(totalToday)} yellow />
            <StatChip label="Intérêts annuels" value={formatCHF(totalIntAnnual)} />
            {totalRent > 0 && <StatChip label="Loyers annuels" value={formatCHF(totalRent)} green />}
            {propValue > 0 && <StatChip label="Valeur des biens" value={formatCHF(propValue)} />}
          </div>
        </div>
      </div>

      {isMobile ? (
        <>
          {allItems.map((m) => (
            <MortgageCard key={m.id} m={m} excluded={excludedIds.has(m.id)} onToggle={() => onToggle(m.id)} />
          ))}
          <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-3 grid grid-cols-2 gap-2 text-xs mt-1">
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
        </>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800 shadow">
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
      )}
    </section>
  );
}

function StatChip({ label, value, yellow, green }: { label: string; value: string; yellow?: boolean; green?: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-1.5 text-center min-w-[100px] border ${yellow ? "bg-yellow-400/10 border-yellow-400/30" : green ? "bg-emerald-500/10 border-emerald-500/30" : "bg-zinc-800 border-zinc-700"}`}>
      <div className="text-xs text-zinc-400">{label}</div>
      <div className={`text-sm font-bold mt-0.5 ${yellow ? "text-yellow-400" : green ? "text-emerald-400" : "text-white"}`}>{value}</div>
    </div>
  );
}

function TotalCell({ label, value, yellow, purple, green }: { label: string; value: string; yellow?: boolean; purple?: boolean; green?: boolean }) {
  return (
    <div className="rounded-lg bg-zinc-800 p-2">
      <div className="text-zinc-400 text-xs">{label}</div>
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

  const cards = [
    { title: "Encours total", value: formatCHF(totalToday), sub: `sur ${formatCHF(totalInitial)} initiaux`, accent: "yellow", icon: "🏦" },
    { title: "Valeur totale des biens", value: formatCHF(propValue), sub: `LTV moy. ${propValue > 0 ? ((totalToday / propValue) * 100).toFixed(0) : "–"}%`, accent: "zinc", icon: "🏠" },
    { title: "Fonds propres", value: formatCHF(propValue - totalToday), sub: `${propValue > 0 ? (((propValue - totalToday) / propValue) * 100).toFixed(0) : "–"}% de la valeur`, accent: "green", icon: "💰" },
    { title: "Intérêts annuels", value: formatCHF(totalIntAnnual), sub: `${formatCHF(totalIntRem)} restants au total`, accent: "purple", icon: "💶" },
    { title: "Amortissement annuel", value: formatCHF(totalAmortA), sub: `${formatCHF(totalAmortQ)} / trimestre`, accent: "zinc", icon: "📉" },
    { title: "Loyers annuels", value: formatCHF(totalRentGlobal), sub: `Charges (10%) : ${formatCHF(totalChargesGlobal)}`, accent: "emerald", icon: "🏘️" },
    {
      title: "Alertes",
      value: `${expiredCount + soonCount} contrat${expiredCount + soonCount !== 1 ? "s" : ""}`,
      sub: `${expiredCount} expiré · ${soonCount} expire bientôt${excludedCount > 0 ? ` · ${excludedCount} exclu` : ""}`,
      accent: expiredCount > 0 ? "red" : soonCount > 0 ? "amber" : "green",
      icon: "⚠️",
    },
  ];

  const accentMap: Record<string, string> = {
    yellow: "border-yellow-400/40 bg-yellow-400/5",
    green:  "border-emerald-400/40 bg-emerald-400/5",
    purple: "border-purple-400/40 bg-purple-400/5",
    emerald:"border-emerald-500/40 bg-emerald-500/5",
    zinc:   "border-zinc-600 bg-zinc-800/60",
    red:    "border-red-500/40 bg-red-500/5",
    amber:  "border-amber-400/40 bg-amber-400/5",
  };
  const valueMap: Record<string, string> = {
    yellow: "text-yellow-400", green: "text-emerald-400", purple: "text-purple-400",
    emerald: "text-emerald-400", zinc: "text-white", red: "text-red-400", amber: "text-amber-400",
  };

  return (
    <div className="flex gap-3 mb-8 overflow-x-auto pb-1">
      {cards.map((c) => (
        <div key={c.title} className={`rounded-xl p-4 border shadow flex-1 min-w-[150px] ${accentMap[c.accent]}`}>
          <div className="text-2xl mb-1">{c.icon}</div>
          <div className="text-xs font-medium text-zinc-400 leading-tight">{c.title}</div>
          <div className={`text-base font-bold mt-1 leading-tight ${valueMap[c.accent]}`}>{c.value}</div>
          <div className="text-xs text-zinc-500 mt-1 leading-tight">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [activeCompany, setActiveCompany] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 shrink-0">
              <Image src="/logo.png" alt="MBA Groupe SA" fill className="object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">MBA Groupe SA</h1>
              <div className="text-xs text-zinc-400 mt-0.5">
                Tableau de bord au {TODAY.toLocaleDateString("fr-CH", { day: "2-digit", month: "long", year: "numeric" })}
                {excludedIds.size > 0 && <span className="ml-2 text-yellow-400 font-medium">· {excludedIds.size} contrat{excludedIds.size > 1 ? "s" : ""} exclu{excludedIds.size > 1 ? "s" : ""}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {excludedIds.size > 0 && (
              <button onClick={() => setExcludedIds(new Set())} className="text-xs rounded-full bg-yellow-400/20 text-yellow-400 px-3 py-1.5 font-medium hover:bg-yellow-400/30 transition-colors border border-yellow-400/30">
                ↺ Réinitialiser
              </button>
            )}
            <div className="text-right">
              <div className="text-xs text-zinc-400">Total encours</div>
              <div className="text-xl font-bold text-yellow-400">{formatCHF(totalToday)}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 py-6">
        <SummaryCards activeMortgages={activeMortgages} />

        {/* hint */}
        <div className="mb-4 rounded-lg bg-yellow-400/5 border border-yellow-400/20 px-4 py-2 text-xs text-yellow-400/80 flex items-center gap-2">
          <span>💡</span>
          <span>{isMobile ? "Ouvrez une fiche et appuyez sur « Exclure des totaux » pour retirer un bien du calcul." : "Cliquez sur une ligne du tableau pour l'exclure des totaux. Cliquez à nouveau pour la réinclure."}</span>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <FilterBtn label="Toutes les sociétés" active={activeCompany === null} onClick={() => setActiveCompany(null)} />
          {companies.map((c) => (
            <FilterBtn key={c} label={c} active={activeCompany === c} onClick={() => setActiveCompany(activeCompany === c ? null : c)} />
          ))}
        </div>

        {visible.map((c) => (
          <CompanySection key={c} company={c} isMobile={isMobile} excludedIds={excludedIds} onToggle={toggleExclude} />
        ))}

        <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-4 mt-4 text-sm text-zinc-300">
          <strong className="text-yellow-400">Note sur les taux Saron Flex :</strong> Les intérêts calculés pour les contrats à taux variable utilisent uniquement la marge (spread) indiquée dans le contrat. Le taux Saron réel peut varier — les montants affichés sont donc une estimation minimale.
        </div>

        <footer className="mt-8 pb-4 text-center text-xs text-zinc-600">
          MBA Groupe SA · Données au {TODAY.toLocaleDateString("fr-CH")}
        </footer>
      </main>
    </div>
  );
}

function FilterBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors border ${active ? "bg-yellow-400 text-black border-yellow-400 font-bold" : "bg-transparent border-zinc-700 text-zinc-300 hover:border-yellow-400/50 hover:text-yellow-400"}`}>
      {label}
    </button>
  );
}
