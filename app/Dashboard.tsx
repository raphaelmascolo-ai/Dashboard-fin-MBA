"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
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
  type RateType,
} from "./data";
import { createClient } from "./lib/supabase/client";

function generateId(): string {
  const r = () => String(Math.floor(Math.random() * 900) + 100);
  return `${r()}.${r()}.${r()}.${Math.floor(Math.random() * 9) + 1}`;
}

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
function eff(m: Mortgage, value: number) { return value * ratio(m); }

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ m }: { m: Mortgage }) {
  if (isExpired(m))    return <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700 uppercase tracking-wide">Expiré</span>;
  if (isExpiringSoon(m)) return <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-[#bf5f1a] uppercase tracking-wide">Bientôt</span>;
  return <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Actif</span>;
}

function LtvBar({ value }: { value: number }) {
  const color = value > 80 ? "bg-red-500" : value > 66 ? "bg-amber-400" : "bg-amber-500";
  const textColor = value > 80 ? "text-red-600" : "text-amber-600";
  return (
    <div>
      <div className="flex justify-between text-[11px] text-gray-400 mb-1">
        <span>LTV</span><span className={`font-bold ${textColor}`}>{value.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-200">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

// ── Mobile row ────────────────────────────────────────────────────────────────
function MobileRow({ m, allMortgages, excluded, onToggle, onEdit, isAdmin }: {
  m: Mortgage; allMortgages: Mortgage[]; excluded: boolean; onToggle: () => void; onEdit: () => void; isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const annualInterest = calcAnnualInterest(m);
  const remInterest    = calcRemainingInterest(m);
  const totalInterest  = calcTotalInterestFullPeriod(m);
  const ltvVal         = ltv(m, allMortgages);
  const yrs            = yearsRemaining(m);
  const rent           = annualRent(m);

  const leftBorder = excluded ? "border-l-gray-300"
    : isExpired(m) ? "border-l-red-400"
    : isExpiringSoon(m) ? "border-l-amber-400"
    : "border-l-emerald-500";

  return (
    <div className={`border-b-2 border-[#1d1d1f]/8 border-l-4 ${leftBorder} ${excluded ? "opacity-40" : ""}`}>
      <button className="w-full text-left px-4 py-3.5" onClick={() => setOpen(v => !v)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className={`font-semibold text-sm leading-snug ${excluded ? "line-through text-gray-400" : "text-gray-900"}`}>{m.label}</div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[11px] text-gray-400 font-mono">{m.id}</span>
              {m.shared && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-[#bf5f1a]">50% MBA</span>}
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            {excluded ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500 uppercase">Exclu</span> : <StatusBadge m={m} />}
            <span className="text-[10px] text-gray-400">{open ? "▲" : "▼"}</span>
          </div>
        </div>
        {!excluded && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div><div className="text-[10px] text-gray-400 uppercase tracking-wide">Solde actuel</div><div className="text-sm font-bold text-gray-900 mt-0.5">{formatCHF(eff(m, m.remainingToday))}</div></div>
            <div><div className="text-[10px] text-gray-400 uppercase tracking-wide">Intérêts annuels</div><div className="text-sm font-bold text-amber-600 mt-0.5">{formatCHF(annualInterest)}</div></div>
            {rent > 0 && <div><div className="text-[10px] text-gray-400 uppercase tracking-wide">Loyer annuel</div><div className="text-sm font-bold text-emerald-700 mt-0.5">{formatCHF(rent)}</div></div>}
            <div><div className="text-[10px] text-gray-400 uppercase tracking-wide">Taux</div><div className="text-sm font-bold text-gray-700 mt-0.5">{m.rateType === "saron" ? `S+${m.rate}%` : `${m.rate.toFixed(2)}%`}</div></div>
          </div>
        )}
        {!excluded && ltvVal !== null && <div className="mt-3"><LtvBar value={ltvVal} /></div>}
      </button>
      {open && (
        <div className="bg-stone-50 border-t border-gray-100 px-4 py-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 mb-4">
            <Field label="Montant initial"         value={formatCHF(eff(m, m.totalAmount))} />
            <Field label="Solde à l'échéance"      value={formatCHF(eff(m, m.remainingAtEnd))} />
            <Field label="Début"                   value={formatDate(m.startDate)} />
            <Field label="Fin"                     value={formatDate(m.endDate)} />
            <Field label="Durée restante"          value={yrs > 0 ? `${yrs.toFixed(1)} ans` : "Expiré"} />
            <Field label="Amort. annuel"           value={m.annualAmortization > 0 ? formatCHF(eff(m, m.annualAmortization)) : "–"} />
            <Field label="Intérêts annuels"        value={formatCHF(annualInterest)} gold />
            <Field label="Intérêts restants"       value={formatCHF(remInterest)} gold />
            <Field label="Intérêts totaux contrat" value={formatCHF(totalInterest)} />
            {rent > 0 && <>
              <Field label="Loyer mensuel"   value={formatCHF(m.monthlyRent!)} green />
              <Field label="Loyer net annuel" value={formatCHF(Math.round(rent * 0.9))} green />
            </>}
            {m.propertyValue && <Field label="Valeur du bien" value={formatCHF(eff(m, m.propertyValue))} />}
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <button onClick={e => { e.stopPropagation(); onEdit(); }} className="flex-1 rounded-xl py-2.5 text-xs font-medium border bg-[#1d1d1f] text-white border-[#1d1d1f] hover:bg-[#333]">
                ✏ Modifier
              </button>
            )}
            <button onClick={e => { e.stopPropagation(); onToggle(); }} className={`flex-1 rounded-xl py-2.5 text-xs font-bold border transition-colors ${excluded ? "bg-amber-50 text-[#bf5f1a] border-amber-200" : "bg-red-50 text-red-600 border-red-200"}`}>
              {excluded ? "✓ Réinclure" : "✕ Exclure"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, gold, green }: { label: string; value: string; gold?: boolean; green?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</div>
      <div className={`text-xs font-semibold ${gold ? "text-amber-600" : green ? "text-emerald-700" : "text-gray-900"}`}>{value}</div>
    </div>
  );
}

// ── Desktop table row ─────────────────────────────────────────────────────────
function TableRow({ m, idx, allMortgages, excluded, onToggle, onEdit, isAdmin }: {
  m: Mortgage; idx: number; allMortgages: Mortgage[]; excluded: boolean; onToggle: () => void; onEdit: () => void; isAdmin: boolean;
}) {
  const remInterest = calcRemainingInterest(m);
  const ltvVal      = ltv(m, allMortgages);
  const yrs         = yearsRemaining(m);

  return (
    <tr className={`border-b-2 border-[#1d1d1f]/8 select-none text-sm transition-all ${
      excluded ? "opacity-30" : idx % 2 === 0 ? "bg-white" : "bg-stone-50"
    }`}>
      {/* Edit button */}
      <td className="px-2 py-3 w-8">
        {isAdmin && (
          <button onClick={onEdit} title="Modifier" className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-amber-100 hover:text-[#bf5f1a] transition-colors">
            ✏
          </button>
        )}
      </td>
      {/* Label */}
      <td className="px-3 py-3 cursor-pointer hover:bg-amber-50/40" onClick={onToggle} title={excluded ? "Réinclure" : "Exclure"}>
        <div className={`font-semibold leading-snug ${excluded ? "line-through text-gray-400" : "text-gray-900"}`}>{m.label}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[11px] text-gray-400 font-mono">{m.id}</span>
          {m.shared && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-[#bf5f1a]">50% MBA</span>}
        </div>
      </td>
      <td className="px-3 py-3 text-center">
        {excluded ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500 uppercase">Exclu</span> : <StatusBadge m={m} />}
      </td>
      <td className={`px-3 py-3 text-right font-mono ${excluded ? "text-gray-400" : "text-gray-700"}`}>
        {formatCHF(eff(m, m.totalAmount))}
        {m.shared && <div className="text-[11px] text-gray-400">({formatCHF(m.totalAmount)})</div>}
      </td>
      <td className="px-3 py-3 text-center">
        {m.rateType === "saron"
          ? <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">Saron +{m.rate}%</span>
          : <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-700">{m.rate.toFixed(2)}% fixe</span>}
      </td>
      <td className="px-3 py-3 text-center text-[11px] text-gray-500">
        <div>{formatDate(m.startDate)}</div>
        <div className="font-bold text-gray-900 text-xs">{formatDate(m.endDate)}</div>
        <div className="mt-0.5">{yrs > 0 ? `${yrs.toFixed(1)} ans` : "—"}</div>
      </td>
      <td className={`px-3 py-3 text-right font-mono ${excluded ? "text-gray-400" : "text-gray-600"}`}>
        {m.annualAmortization > 0 ? formatCHF(eff(m, m.annualAmortization)) : "—"}
      </td>
      <td className={`px-3 py-3 text-right font-mono font-bold ${excluded ? "text-gray-400" : "text-gray-900"}`}>
        {formatCHF(eff(m, m.remainingToday))}
        {m.shared && <div className="text-[11px] font-normal text-gray-400">({formatCHF(m.remainingToday)})</div>}
      </td>
      <td className={`px-3 py-3 text-right font-mono ${excluded ? "text-gray-400" : "text-gray-500"}`}>
        {formatCHF(eff(m, m.remainingAtEnd))}
      </td>
      <td className={`px-3 py-3 text-right font-mono font-semibold ${excluded ? "text-gray-400" : "text-amber-600"}`}>
        {formatCHF(calcAnnualInterest(m))}
      </td>
      <td className={`px-3 py-3 text-right font-mono ${excluded ? "text-gray-400" : "text-gray-500"}`}>
        {formatCHF(remInterest)}
      </td>
      <td className="px-3 py-3 text-right text-[11px]">
        {m.propertyValue ? (
          <>
            <div className={`font-mono ${excluded ? "text-gray-400" : "text-gray-700"}`}>{formatCHF(eff(m, m.propertyValue))}</div>
            {ltvVal !== null && !excluded && <div className={`font-bold mt-0.5 ${ltvVal > 80 ? "text-red-600" : "text-amber-600"}`}>LTV {ltvVal.toFixed(0)}%</div>}
          </>
        ) : "—"}
      </td>
      <td className="px-3 py-3 text-right text-[11px]">
        {(m.monthlyRent ?? 0) > 0 ? (
          <>
            <div className={`font-mono font-semibold ${excluded ? "text-gray-400" : "text-emerald-700"}`}>{formatCHF(annualRent(m))}</div>
            <div className="text-gray-400 font-mono">{formatCHF(m.monthlyRent!)}/mois</div>
            <div className="text-red-500 font-mono">–{formatCHF(Math.round(annualRent(m) * 0.1))}</div>
          </>
        ) : <span className="text-gray-300">—</span>}
      </td>
    </tr>
  );
}

// ── Company section ───────────────────────────────────────────────────────────
function CompanySection({ company, allMortgages, excludedIds, onToggle, onEdit, onNew, isAdmin }: {
  company: string; allMortgages: Mortgage[]; excludedIds: Set<string>;
  onToggle: (id: string) => void; onEdit: (m: Mortgage) => void; onNew: (company: string) => void;
  isAdmin: boolean;
}) {
  const allItems    = allMortgages.filter(m => m.company === company);
  const activeItems = allItems.filter(m => !excludedIds.has(m.id));

  const totalInitial = activeItems.reduce((s, m) => s + eff(m, m.totalAmount), 0);
  const totalToday   = activeItems.reduce((s, m) => s + eff(m, m.remainingToday), 0);
  const totalEnd     = activeItems.reduce((s, m) => s + eff(m, m.remainingAtEnd), 0);
  const totalIntA    = activeItems.reduce((s, m) => s + calcAnnualInterest(m), 0);
  const totalIntRem  = activeItems.reduce((s, m) => s + calcRemainingInterest(m), 0);
  const totalIntFull = activeItems.reduce((s, m) => s + calcTotalInterestFullPeriod(m), 0);
  const totalAmort   = activeItems.reduce((s, m) => s + eff(m, m.annualAmortization), 0);
  const totalRent    = activeItems.reduce((s, m) => s + annualRent(m), 0);
  const totalCharges = Math.round(totalRent * 0.1);
  const propValue    = totalPropertyValue(activeItems);
  const expiredCount = activeItems.filter(isExpired).length;
  const soonCount    = activeItems.filter(isExpiringSoon).length;
  const excludedCount = allItems.length - activeItems.length;

  return (
    <section className="mb-6 rounded-2xl overflow-hidden glass-card">
      {/* Header */}
      <div className="bg-white/40 border-b border-white/40 px-5 py-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-[#1d1d1f]">{company}</h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="text-[11px] text-[#86868b]">{activeItems.length}/{allItems.length} hypothèque{allItems.length > 1 ? "s" : ""}</span>
              {excludedCount > 0 && <span className="rounded-full bg-white/50 px-2 py-0.5 text-[11px] text-[#86868b]">{excludedCount} exclu{excludedCount > 1 ? "s" : ""}</span>}
              {expiredCount > 0 && <span className="rounded-full bg-[#ff3b30]/10 px-2 py-0.5 text-[11px] text-[#ff3b30]">⚠ {expiredCount} expiré{expiredCount > 1 ? "s" : ""}</span>}
              {soonCount > 0 && <span className="rounded-full bg-[#ff9f0a]/10 px-2 py-0.5 text-[11px] text-[#bf5f1a]">⏳ {soonCount} bientôt</span>}
            </div>
          </div>
          {isAdmin && (
            <button onClick={() => onNew(company)} className="shrink-0 flex items-center gap-1.5 bg-[#1d1d1f] hover:bg-[#333] text-white rounded-xl px-3 py-1.5 text-xs font-medium transition-colors">
              + Ajouter
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <HeaderStat label="Solde actuel"    value={formatCHF(totalToday)} gold />
          <HeaderStat label="Intérêts annuels" value={formatCHF(totalIntA)} />
          {totalRent > 0 && <HeaderStat label="Loyers annuels" value={formatCHF(totalRent)} green />}
          {propValue > 0 && <HeaderStat label="Valeur des biens" value={formatCHF(propValue)} />}
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden divide-y divide-gray-100">
        {allItems.map(m => (
          <MobileRow key={m.id} m={m} allMortgages={allMortgages} excluded={excludedIds.has(m.id)} onToggle={() => onToggle(m.id)} onEdit={() => onEdit(m)} isAdmin={isAdmin} />
        ))}
        <div className="bg-white/30 border-t border-white/40 px-4 py-4">
          <div className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-3">
            Sous-total — {activeItems.length}{excludedCount > 0 ? `/${allItems.length}` : ""} contrat{allItems.length > 1 ? "s" : ""}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MiniTotal label="Montant initial"    value={formatCHF(totalInitial)} />
            <MiniTotal label="Solde aujourd'hui"  value={formatCHF(totalToday)} gold />
            <MiniTotal label="Solde à la fin"     value={formatCHF(totalEnd)} />
            <MiniTotal label="Intérêts annuels"   value={formatCHF(totalIntA)} gold />
            {propValue > 0 && <MiniTotal label="Valeur des biens" value={formatCHF(propValue)} />}
            {propValue > 0 && <MiniTotal label="Fonds propres"    value={formatCHF(propValue - totalToday)} green />}
            {totalRent > 0 && <MiniTotal label="Loyers annuels"   value={formatCHF(totalRent)} green />}
            {totalRent > 0 && <MiniTotal label="Charges (10%)"    value={`–${formatCHF(totalCharges)}`} />}
          </div>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[1100px]">
          <thead>
            <tr className="bg-stone-50 border-b border-gray-200 text-[11px] text-gray-400 uppercase tracking-wide">
              <th className="w-8 px-2 py-3" />
              {["Bien / Contrat", "Statut", "Montant initial", "Taux", "Période", "Amort. annuel", "Solde actuel", "Solde fin contrat", "Intérêts annuels", "Intérêts restants", "Valeur / LTV", "Loyers annuels"].map((h, i) => (
                <th key={h} className={`px-3 py-3 font-semibold ${i === 0 ? "text-left" : i <= 1 ? "text-center" : "text-right"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allItems.map((m, i) => (
              <TableRow key={m.id} m={m} idx={i} allMortgages={allMortgages} excluded={excludedIds.has(m.id)} onToggle={() => onToggle(m.id)} onEdit={() => onEdit(m)} isAdmin={isAdmin} />
            ))}
            <tr className="bg-white/40 text-[#1d1d1f] text-sm font-semibold border-t border-white/40">
              <td />
              <td className="px-3 py-3" colSpan={2}>Sous-total — {activeItems.length}{excludedCount > 0 ? `/${allItems.length}` : ""} contrat{allItems.length > 1 ? "s" : ""}</td>
              <td className="px-3 py-3 text-right font-mono text-gray-500">{formatCHF(totalInitial)}</td>
              <td /><td />
              <td className="px-3 py-3 text-right font-mono text-gray-500">{totalAmort > 0 ? formatCHF(totalAmort) : "—"}</td>
              <td className="px-3 py-3 text-right font-mono text-[#bf5f1a]">{formatCHF(totalToday)}</td>
              <td className="px-3 py-3 text-right font-mono text-gray-500">{formatCHF(totalEnd)}</td>
              <td className="px-3 py-3 text-right font-mono text-[#bf5f1a]">{formatCHF(totalIntA)}</td>
              <td className="px-3 py-3 text-right font-mono text-gray-500">{formatCHF(totalIntRem)}</td>
              <td className="px-3 py-3 text-right font-mono">
                {propValue > 0 ? <><div className="text-gray-600">{formatCHF(propValue)}</div><div className="text-xs font-normal text-emerald-600">+{formatCHF(propValue - totalToday)}</div></> : "—"}
              </td>
              <td className="px-3 py-3 text-right font-mono">
                {totalRent > 0 ? <><div className="text-emerald-600">{formatCHF(totalRent)}</div><div className="text-xs font-normal text-red-500">–{formatCHF(totalCharges)}</div></> : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HeaderStat({ label, value, gold, green }: { label: string; value: string; gold?: boolean; green?: boolean }) {
  return (
    <div className="rounded-xl bg-white/50 border border-white/40 px-3 py-2.5">
      <div className="text-[10px] text-[#86868b] uppercase tracking-wide">{label}</div>
      <div className={`text-sm font-bold mt-0.5 ${gold ? "text-[#bf5f1a]" : green ? "text-[#34c759]" : "text-[#1d1d1f]"}`}>{value}</div>
    </div>
  );
}
function MiniTotal({ label, value, gold, green }: { label: string; value: string; gold?: boolean; green?: boolean }) {
  return (
    <div className="rounded-xl bg-white/50 border border-white/40 px-3 py-2">
      <div className="text-[10px] text-[#86868b] uppercase tracking-wide">{label}</div>
      <div className={`text-xs font-bold mt-0.5 ${gold ? "text-[#bf5f1a]" : green ? "text-[#34c759]" : "text-[#1d1d1f]"}`}>{value}</div>
    </div>
  );
}

// ── Summary KPIs ──────────────────────────────────────────────────────────────
function SummarySection({ activeMortgages, allMortgages }: { activeMortgages: Mortgage[]; allMortgages: Mortgage[] }) {
  const totalInitial  = activeMortgages.reduce((s, m) => s + eff(m, m.totalAmount), 0);
  const totalToday    = activeMortgages.reduce((s, m) => s + eff(m, m.remainingToday), 0);
  const totalIntAnnual = activeMortgages.reduce((s, m) => s + calcAnnualInterest(m), 0);
  const totalIntRem   = activeMortgages.reduce((s, m) => s + calcRemainingInterest(m), 0);
  const totalRent     = activeMortgages.reduce((s, m) => s + annualRent(m), 0);
  const totalCharges  = Math.round(totalRent * 0.1);
  const totalAmortA   = activeMortgages.reduce((s, m) => s + eff(m, m.annualAmortization), 0);
  const totalAmortQ   = activeMortgages.reduce((s, m) => s + eff(m, m.quarterlyAmortization), 0);
  const propValue     = totalPropertyValue(activeMortgages);
  const equity        = propValue - totalToday;
  const expiredCount  = activeMortgages.filter(isExpired).length;
  const soonCount     = activeMortgages.filter(isExpiringSoon).length;
  const excludedCount = allMortgages.length - activeMortgages.length;

  return (
    <div className="mb-6">
      <div className="hidden md:block mb-5">
        <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Encours total</div>
        <div className="flex items-baseline gap-4">
          <div className="text-4xl font-bold text-gray-900">{formatCHF(totalToday)}</div>
          <div className="text-sm text-gray-400">sur {formatCHF(totalInitial)} initiaux</div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Valeur des biens"  value={formatCHF(propValue)} sub={`LTV moy. ${propValue > 0 ? ((totalToday / propValue) * 100).toFixed(0) : "—"}%`} icon="🏠" />
        <KpiCard label="Fonds propres"     value={formatCHF(equity)} sub={`${propValue > 0 ? ((equity / propValue) * 100).toFixed(0) : "—"}% de la valeur`} icon="💰" green />
        <KpiCard label="Intérêts annuels"  value={formatCHF(totalIntAnnual)} sub={`${formatCHF(totalIntRem)} restants`} icon="💶" gold />
        <KpiCard label="Amort. annuel"     value={formatCHF(totalAmortA)} sub={`${formatCHF(totalAmortQ)} / trimestre`} icon="📉" />
        <KpiCard label="Loyers annuels"    value={formatCHF(totalRent)} sub={`Charges : –${formatCHF(totalCharges)}`} icon="🏘️" green />
        <KpiCard label="Loyers nets"       value={formatCHF(totalRent - totalCharges)} sub="Après charges 10%" icon="✅" green />
        <KpiCard label="Alertes" value={`${expiredCount + soonCount} contrat${expiredCount + soonCount !== 1 ? "s" : ""}`} sub={`${expiredCount} expiré · ${soonCount} bientôt${excludedCount > 0 ? ` · ${excludedCount} exclu` : ""}`} icon="⚠️" red={expiredCount > 0} amber={!expiredCount && soonCount > 0} />
        <KpiCard label="Nb. hypothèques"   value={`${activeMortgages.length}`} sub={`sur ${allMortgages.length} au total`} icon="📋" />
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, icon, gold, green, red, amber }: {
  label: string; value: string; sub: string; icon: string; gold?: boolean; green?: boolean; red?: boolean; amber?: boolean;
}) {
  const border = red ? "border-red-200 bg-red-50" : amber ? "border-amber-200 bg-amber-50" : gold ? "border-amber-200 bg-amber-50" : green ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-white";
  const valColor = red ? "text-red-700" : amber ? "text-[#bf5f1a]" : gold ? "text-[#bf5f1a]" : green ? "text-emerald-800" : "text-gray-900";
  const subColor = red ? "text-red-500" : amber ? "text-amber-600" : gold ? "text-amber-500" : green ? "text-emerald-600" : "text-gray-400";
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${border}`}>
      <div className="text-xl mb-2">{icon}</div>
      <div className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-bold mt-1 leading-tight ${valColor}`}>{value}</div>
      <div className={`text-[11px] mt-1 ${subColor}`}>{sub}</div>
    </div>
  );
}

// ── Mortgage form modal ───────────────────────────────────────────────────────
const emptyForm = (): Mortgage => ({
  id: generateId(),
  label: "", company: "",
  totalAmount: 0, startDate: "", endDate: "",
  rateType: "fixed", rate: 0,
  annualAmortization: 0, quarterlyAmortization: 0,
  remainingAtEnd: 0, remainingToday: 0,
  propertyValue: null, propertyGroup: "", shared: false, monthlyRent: 0,
});

function inputCls(err?: string) {
  return `w-full px-3 py-2.5 rounded-xl border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 ${err ? "border-red-300" : "border-gray-200"}`;
}

function MortgageForm({ mortgage, isNew, allMortgages, saving, onSave, onDelete, onClose }: {
  mortgage: Mortgage; isNew: boolean; allMortgages: Mortgage[]; saving: boolean;
  onSave: (m: Mortgage) => void; onDelete: (id: string) => void; onClose: () => void;
}) {
  const [form, setForm] = useState<Mortgage>(() => ({ ...mortgage }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const allCompanies = useMemo(() => Array.from(new Set(allMortgages.map(m => m.company))), [allMortgages]);

  function set<K extends keyof Mortgage>(field: K, value: Mortgage[K]) {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === "annualAmortization" && typeof value === "number") {
        next.quarterlyAmortization = Math.round(value / 4);
      }
      return next;
    });
    setErrors(e => { const n = { ...e }; delete n[field as string]; return n; });
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.label.trim()) e.label = "Requis";
    if (!form.company.trim()) e.company = "Requis";
    if (!form.totalAmount || form.totalAmount <= 0) e.totalAmount = "Doit être > 0";
    if (!form.startDate) e.startDate = "Requis";
    if (!form.endDate) e.endDate = "Requis";
    if (form.startDate && form.endDate && form.endDate <= form.startDate) e.endDate = "Doit être après la date de début";
    if (form.rate < 0) e.rate = "Doit être ≥ 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({ ...form, propertyGroup: form.propertyGroup || undefined, monthlyRent: form.monthlyRent ?? 0, propertyValue: form.propertyValue || null });
  }

  function handleDelete() {
    if (window.confirm(`Supprimer « ${form.label} » ?\n\nCette action est irréversible.`)) onDelete(form.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xl p-0 sm:p-4">
      <div className="bg-white/90 backdrop-blur-2xl rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-white/50">
        {/* Header */}
        <div className="bg-white/50 border-b border-white/40 px-5 py-4 flex items-center justify-between shrink-0">
          <div>
            <div className="font-semibold text-base text-[#1d1d1f]">{isNew ? "Nouvelle hypothèque" : `Modifier — ${mortgage.label}`}</div>
            {!isNew && <div className="text-[11px] text-[#86868b] mt-0.5 font-mono">{mortgage.id}</div>}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] hover:bg-white/60 transition-all text-lg">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Identification */}
          <FormSection title="Identification">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Nom du bien *" error={errors.label}>
                <input type="text" value={form.label} onChange={e => set("label", e.target.value)} placeholder="Ex: Immeuble Dorénaz A1" className={inputCls(errors.label)} />
              </FormField>
              <FormField label="Société *" error={errors.company}>
                <input type="text" list="companies-list" value={form.company} onChange={e => set("company", e.target.value)} placeholder="Sélectionner ou saisir" className={inputCls(errors.company)} />
                <datalist id="companies-list">{allCompanies.map(c => <option key={c} value={c} />)}</datalist>
              </FormField>
            </div>
          </FormSection>

          {/* Contrat */}
          <FormSection title="Contrat">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Date de début *" error={errors.startDate}>
                <input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)} className={inputCls(errors.startDate)} />
              </FormField>
              <FormField label="Date de fin *" error={errors.endDate}>
                <input type="date" value={form.endDate} onChange={e => set("endDate", e.target.value)} className={inputCls(errors.endDate)} />
              </FormField>
              <FormField label="Type de taux">
                <select value={form.rateType} onChange={e => set("rateType", e.target.value as RateType)} className={inputCls()}>
                  <option value="fixed">Fixe</option>
                  <option value="saron">Saron (variable)</option>
                </select>
              </FormField>
              <FormField label={form.rateType === "saron" ? "Marge Saron (%)" : "Taux fixe (%)"} error={errors.rate}>
                <input type="number" step="0.01" min="0" value={form.rate || ""} onChange={e => set("rate", parseFloat(e.target.value) || 0)} placeholder="0.00" className={inputCls(errors.rate)} />
              </FormField>
            </div>
          </FormSection>

          {/* Montants */}
          <FormSection title="Montants (CHF)">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Montant initial *" error={errors.totalAmount}>
                <input type="number" step="1000" min="0" value={form.totalAmount || ""} onChange={e => set("totalAmount", parseFloat(e.target.value) || 0)} placeholder="0" className={inputCls(errors.totalAmount)} />
              </FormField>
              <FormField label="Solde aujourd'hui">
                <input type="number" step="1000" min="0" value={form.remainingToday || ""} onChange={e => set("remainingToday", parseFloat(e.target.value) || 0)} placeholder="0" className={inputCls()} />
              </FormField>
              <FormField label="Solde à l'échéance">
                <input type="number" step="1000" min="0" value={form.remainingAtEnd || ""} onChange={e => set("remainingAtEnd", parseFloat(e.target.value) || 0)} placeholder="0" className={inputCls()} />
              </FormField>
            </div>
          </FormSection>

          {/* Amortissement */}
          <FormSection title="Amortissement">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Amortissement annuel (CHF)">
                <input type="number" step="1000" min="0" value={form.annualAmortization || ""} onChange={e => set("annualAmortization", parseFloat(e.target.value) || 0)} placeholder="0" className={inputCls()} />
              </FormField>
              <FormField label="Amortissement trimestriel (CHF)">
                <input type="number" step="250" min="0" value={form.quarterlyAmortization || ""} onChange={e => set("quarterlyAmortization", parseFloat(e.target.value) || 0)} placeholder="Auto (annuel ÷ 4)" className={inputCls()} />
              </FormField>
            </div>
          </FormSection>

          {/* Bien immobilier */}
          <FormSection title="Bien immobilier">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <FormField label="Valeur du bien (CHF)">
                <input type="number" step="10000" min="0" value={form.propertyValue || ""} onChange={e => set("propertyValue", parseFloat(e.target.value) || null)} placeholder="Optionnel" className={inputCls()} />
              </FormField>
              <FormField label="Groupe de biens (optionnel)">
                <input type="text" value={form.propertyGroup || ""} onChange={e => set("propertyGroup", e.target.value || undefined)} placeholder="Ex: bellini" className={inputCls()} />
              </FormField>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={form.shared || false} onChange={e => set("shared", e.target.checked)} className="w-4 h-4 rounded accent-amber-500" />
              <span className="text-sm text-gray-700">Partagé 50/50 avec Gabriel Borgeat — comptabiliser 50% MBA</span>
            </label>
          </FormSection>

          {/* Revenus locatifs */}
          <FormSection title="Revenus locatifs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Loyer mensuel (CHF)">
                <input type="number" step="100" min="0" value={form.monthlyRent || ""} onChange={e => set("monthlyRent", parseFloat(e.target.value) || 0)} placeholder="0 si non loué" className={inputCls()} />
              </FormField>
              {(form.monthlyRent ?? 0) > 0 && (
                <FormField label="Loyer annuel (calculé)">
                  <div className="px-3 py-2.5 bg-emerald-50 rounded-xl text-sm font-bold text-emerald-700 border border-emerald-200">
                    {formatCHF(Math.round((form.monthlyRent ?? 0) * 12 * (form.shared ? 0.5 : 1)))} / an
                  </div>
                </FormField>
              )}
            </div>
          </FormSection>
        </div>

        {/* Footer */}
        <div className={`px-5 py-4 border-t border-gray-100 flex gap-2 shrink-0 ${!isNew ? "justify-between" : "justify-end"}`}>
          {!isNew && (
            <button onClick={handleDelete} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 transition-colors">
              🗑 Supprimer
            </button>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-[#1d1d1f] hover:bg-[#333] transition-colors disabled:opacity-50">
              {saving ? "…" : isNew ? "✓ Créer" : "✓ Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 pb-1 border-b border-gray-100">{title}</div>
      {children}
    </div>
  );
}
function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
      {children}
      {error && <div className="text-[11px] text-red-500 mt-1">⚠ {error}</div>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  // ── data state ──
  const [allMortgages, setAllMortgages] = useState<Mortgage[]>([]);
  const [loadingData, setLoadingData]   = useState(true);
  const [dataError, setDataError]       = useState("");
  const [isAdmin, setIsAdmin]           = useState(false);
  const [isNewForm, setIsNewForm]       = useState(false);
  const [saving, setSaving]             = useState(false);

  const allCompanies = useMemo(() => Array.from(new Set(allMortgages.map(m => m.company))), [allMortgages]);

  // ── ui state ──
  const [activeCompany, setActiveCompany] = useState<string | null>(null);
  const [excludedIds, setExcludedIds]     = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen]           = useState(false);
  const [editTarget, setEditTarget]       = useState<Mortgage | null>(null);

  const activeMortgages = allMortgages.filter(m => !excludedIds.has(m.id));
  const totalToday      = activeMortgages.reduce((s, m) => s + eff(m, m.remainingToday), 0);
  const visible         = activeCompany ? [activeCompany] : allCompanies;

  const fetchMortgages = useCallback(async () => {
    setLoadingData(true);
    setDataError("");
    const res = await fetch("/api/mortgages");
    if (!res.ok) { setDataError("Impossible de charger les données."); setLoadingData(false); return; }
    setAllMortgages(await res.json());
    setLoadingData(false);
  }, []);

  useEffect(() => {
    fetchMortgages();
    // Check if current user is admin
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("user_profiles").select("role").eq("id", user.id).single()
        .then(({ data }) => setIsAdmin(data?.role === "admin"));
    });
  }, [fetchMortgages]);

  function toggleExclude(id: string) {
    setExcludedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function openNew(company = "") {
    const blank = emptyForm();
    blank.company = company;
    setEditTarget(blank);
    setIsNewForm(true);
    setFormOpen(true);
  }

  function openEdit(m: Mortgage) {
    setEditTarget(m);
    setIsNewForm(false);
    setFormOpen(true);
  }

  async function handleSave(m: Mortgage) {
    setSaving(true);
    const method = isNewForm ? "POST" : "PUT";
    const url = isNewForm ? "/api/mortgages" : `/api/mortgages/${m.id}`;
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(m),
    });
    setSaving(false);
    if (!res.ok) { alert("Erreur lors de l'enregistrement."); return; }
    setFormOpen(false);
    fetchMortgages();
  }

  async function handleDelete(id: string) {
    setSaving(true);
    const res = await fetch(`/api/mortgages/${id}`, { method: "DELETE" });
    setSaving(false);
    if (!res.ok) { alert("Erreur lors de la suppression."); return; }
    setFormOpen(false);
    setExcludedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    fetchMortgages();
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-warm">
      {/* Header */}
      <header className="glass sticky top-0 z-20 border-b border-white/30">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="flex items-center gap-1.5 text-[#86868b] hover:text-[#1d1d1f] transition-colors shrink-0 border border-white/40 rounded-xl px-2.5 py-1.5 hover:bg-white/40">
              <span className="text-sm">←</span>
              <span className="text-xs font-medium hidden sm:inline">Accueil</span>
            </Link>
            <div className="relative w-7 h-7 shrink-0">
              <Image src="/logo.png" alt="MBA" fill className="object-contain" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#1d1d1f] leading-tight">Hypothèques</div>
              <div className="text-[11px] text-[#86868b] hidden sm:block">
                {TODAY.toLocaleDateString("fr-CH", { day: "2-digit", month: "long", year: "numeric" })}
                {excludedIds.size > 0 && <span className="ml-2 text-[#bf5f1a] font-semibold">· {excludedIds.size} exclu{excludedIds.size > 1 ? "s" : ""}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {excludedIds.size > 0 && (
              <button onClick={() => setExcludedIds(new Set())} className="text-xs rounded-full bg-white/50 text-[#86868b] px-3 py-1.5 font-medium border border-white/40 hover:bg-white/70 transition-all">
                ↺ <span className="hidden sm:inline">Reset</span>
              </button>
            )}
            <div className="text-right hidden sm:block">
              <div className="text-[10px] text-[#86868b] uppercase tracking-wide">Encours</div>
              <div className="text-base font-bold text-[#bf5f1a] leading-tight">{formatCHF(totalToday)}</div>
            </div>
            {isAdmin && (
              <button onClick={() => openNew()} className="flex items-center gap-1.5 bg-[#1d1d1f] hover:bg-[#333] text-white rounded-xl px-3 py-2 text-xs font-medium transition-colors">
                + <span className="hidden sm:inline">Nouvelle hypothèque</span>
              </button>
            )}
            <div className="w-px h-6 bg-white/30 hidden sm:block" />
            {isAdmin && (
              <Link href="/admin" className="flex items-center gap-1.5 text-xs font-medium text-[#1d1d1f] bg-white/50 hover:bg-white/70 border border-white/40 rounded-xl px-3 py-2 transition-all">
                <span>⚙</span>
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs font-medium text-[#86868b] bg-white/30 hover:bg-white/50 hover:text-[#ff3b30] border border-white/30 rounded-xl px-3 py-2 transition-all">
              <span>⎋</span>
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 md:px-6 py-5 pb-8">
        {dataError && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{dataError}</div>
        )}
        {loadingData ? (
          <div className="py-20 text-center text-sm text-gray-400">Chargement des données…</div>
        ) : (
          <>
            <SummarySection activeMortgages={activeMortgages} allMortgages={allMortgages} />

            {isAdmin && (
              <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-[11px] text-[#bf5f1a] flex items-start gap-2">
                <span>💡</span>
                <span className="md:hidden">Ouvrez une fiche, puis « Modifier » pour éditer ou « Exclure » pour retirer du calcul.</span>
                <span className="hidden md:inline">Cliquez ✏ pour modifier une hypothèque · Cliquez sur la ligne pour l'exclure des totaux · + Ajouter pour créer dans une société.</span>
              </div>
            )}

            <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
              <FilterBtn label="Toutes les sociétés" active={activeCompany === null} onClick={() => setActiveCompany(null)} />
              {allCompanies.map(c => (
                <FilterBtn key={c} label={c} active={activeCompany === c} onClick={() => setActiveCompany(activeCompany === c ? null : c)} />
              ))}
            </div>

            <div className="mb-3 flex items-baseline gap-2">
              <h2 className="text-base font-bold text-gray-900">Contrats actifs</h2>
              <span className="text-xs text-gray-400">Gestion des engagements et échéances</span>
            </div>

            {visible.map(c => (
              <CompanySection key={c} company={c} allMortgages={allMortgages} excludedIds={excludedIds} onToggle={toggleExclude} onEdit={isAdmin ? openEdit : () => {}} onNew={isAdmin ? openNew : () => {}} isAdmin={isAdmin} />
            ))}

            <div className="rounded-2xl bg-white border border-gray-200 p-4 mt-2 text-xs text-gray-500 shadow-sm">
              <strong className="text-gray-700">Note — Taux Saron Flex :</strong> Les intérêts pour les contrats à taux variable utilisent uniquement la marge indiquée. Le taux Saron réel peut varier — les montants sont une estimation minimale.
            </div>
            <div className="mt-4 pb-2 text-center text-[11px] text-gray-400">MBA Groupe SA · Données au {TODAY.toLocaleDateString("fr-CH")}</div>
          </>
        )}
      </main>

      {/* Form modal */}
      {formOpen && editTarget && (
        <MortgageForm
          mortgage={editTarget}
          isNew={isNewForm}
          allMortgages={allMortgages}
          saving={saving}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setFormOpen(false)}
        />
      )}
    </div>
  );
}

function FilterBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all border shrink-0 ${active ? "bg-[#1d1d1f] text-white border-[#1d1d1f]" : "bg-white/60 border-white/40 text-[#86868b] hover:bg-white/80 hover:text-[#1d1d1f]"}`}>
      {label}
    </button>
  );
}
