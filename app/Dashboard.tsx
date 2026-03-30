"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
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

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ m }: { m: Mortgage }) {
  if (isExpired(m))
    return <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700 uppercase tracking-wide">Expiré</span>;
  if (isExpiringSoon(m))
    return <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700 uppercase tracking-wide">Bientôt</span>;
  return <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Actif</span>;
}

// ── LTV bar ───────────────────────────────────────────────────────────────────
function LtvBar({ value }: { value: number }) {
  const color = value > 80 ? "bg-red-500" : value > 66 ? "bg-amber-400" : "bg-amber-500";
  const textColor = value > 80 ? "text-red-600" : value > 66 ? "text-amber-600" : "text-amber-600";
  return (
    <div>
      <div className="flex justify-between text-[11px] text-gray-400 mb-1">
        <span>LTV</span>
        <span className={`font-bold ${textColor}`}>{value.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-200">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

// ── Mobile expandable row ─────────────────────────────────────────────────────
function MobileRow({ m, excluded, onToggle }: { m: Mortgage; excluded: boolean; onToggle: () => void }) {
  const [open, setOpen] = useState(false);
  const annualInterest = calcAnnualInterest(m);
  const remInterest = calcRemainingInterest(m);
  const totalInterest = calcTotalInterestFullPeriod(m);
  const ltvVal = ltv(m);
  const yrs = yearsRemaining(m);
  const rent = annualRent(m);

  const leftBorder = excluded ? "border-l-gray-300"
    : isExpired(m) ? "border-l-red-400"
    : isExpiringSoon(m) ? "border-l-amber-400"
    : "border-l-emerald-500";

  return (
    <div className={`border-b border-gray-100 border-l-4 ${leftBorder} ${excluded ? "opacity-40" : ""}`}>
      <button className="w-full text-left px-4 py-3.5" onClick={() => setOpen(v => !v)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className={`font-semibold text-sm leading-snug ${excluded ? "line-through text-gray-400" : "text-gray-900"}`}>{m.label}</div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[11px] text-gray-400 font-mono">{m.id}</span>
              {m.shared && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">50% MBA</span>}
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            {excluded
              ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500 uppercase">Exclu</span>
              : <StatusBadge m={m} />}
            <span className="text-[10px] text-gray-400">{open ? "▲" : "▼"}</span>
          </div>
        </div>
        {!excluded && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">Solde actuel</div>
              <div className="text-sm font-bold text-gray-900 mt-0.5">{formatCHF(eff(m, m.remainingToday))}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">Intérêts annuels</div>
              <div className="text-sm font-bold text-amber-600 mt-0.5">{formatCHF(annualInterest)}</div>
            </div>
            {rent > 0 && (
              <div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wide">Loyer annuel</div>
                <div className="text-sm font-bold text-emerald-700 mt-0.5">{formatCHF(rent)}</div>
              </div>
            )}
            <div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">Taux</div>
              <div className="text-sm font-bold text-gray-700 mt-0.5">
                {m.rateType === "saron" ? `S+${m.rate}%` : `${m.rate.toFixed(2)}%`}
              </div>
            </div>
          </div>
        )}
        {!excluded && ltvVal !== null && <div className="mt-3"><LtvBar value={ltvVal} /></div>}
      </button>
      {open && (
        <div className="bg-stone-50 border-t border-gray-100 px-4 py-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 mb-4">
            <Field label="Montant initial" value={formatCHF(eff(m, m.totalAmount))} />
            <Field label="Solde à l'échéance" value={formatCHF(eff(m, m.remainingAtEnd))} />
            <Field label="Début" value={formatDate(m.startDate)} />
            <Field label="Fin" value={formatDate(m.endDate)} />
            <Field label="Durée restante" value={yrs > 0 ? `${yrs.toFixed(1)} ans` : "Expiré"} />
            <Field label="Amort. annuel" value={m.annualAmortization > 0 ? formatCHF(eff(m, m.annualAmortization)) : "–"} />
            <Field label="Intérêts annuels" value={formatCHF(annualInterest)} gold />
            <Field label="Intérêts restants" value={formatCHF(remInterest)} gold />
            <Field label="Intérêts totaux (contrat)" value={formatCHF(totalInterest)} />
            {rent > 0 && <>
              <Field label="Loyer mensuel" value={formatCHF(m.monthlyRent!)} green />
              <Field label="Loyer net annuel" value={formatCHF(Math.round(rent * 0.9))} green />
            </>}
            {m.propertyValue && <Field label="Valeur du bien" value={formatCHF(eff(m, m.propertyValue))} />}
          </div>
          <button
            onClick={e => { e.stopPropagation(); onToggle(); }}
            className={`w-full rounded-xl py-2.5 text-xs font-bold border transition-colors ${
              excluded ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-red-50 text-red-600 border-red-200"
            }`}
          >
            {excluded ? "✓ Réinclure dans les totaux" : "✕ Exclure des totaux"}
          </button>
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
function TableRow({ m, idx, excluded, onToggle }: { m: Mortgage; idx: number; excluded: boolean; onToggle: () => void }) {
  const remInterest = calcRemainingInterest(m);
  const ltvVal = ltv(m);
  const yrs = yearsRemaining(m);

  return (
    <tr
      onClick={onToggle}
      title={excluded ? "Cliquer pour réinclure" : "Cliquer pour exclure"}
      className={`border-b border-gray-100 cursor-pointer transition-all select-none text-sm ${
        excluded ? "opacity-30 hover:opacity-50"
        : idx % 2 === 0 ? "bg-white hover:bg-amber-50/40"
        : "bg-stone-50 hover:bg-amber-50/40"
      }`}
    >
      <td className="px-4 py-3">
        <div className={`font-semibold leading-snug ${excluded ? "line-through text-gray-400" : "text-gray-900"}`}>{m.label}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[11px] text-gray-400 font-mono">{m.id}</span>
          {m.shared && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">50% MBA</span>}
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        {excluded ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500 uppercase">Exclu</span> : <StatusBadge m={m} />}
      </td>
      <td className={`px-4 py-3 text-right font-mono ${excluded ? "text-gray-400" : "text-gray-700"}`}>
        {formatCHF(eff(m, m.totalAmount))}
        {m.shared && <div className="text-[11px] text-gray-400">({formatCHF(m.totalAmount)})</div>}
      </td>
      <td className="px-4 py-3 text-center">
        {m.rateType === "saron"
          ? <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">Saron +{m.rate}%</span>
          : <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-700">{m.rate.toFixed(2)}% fixe</span>}
      </td>
      <td className="px-4 py-3 text-center text-[11px] text-gray-500">
        <div>{formatDate(m.startDate)}</div>
        <div className="font-bold text-gray-900 text-xs">{formatDate(m.endDate)}</div>
        <div className="mt-0.5">{yrs > 0 ? `${yrs.toFixed(1)} ans` : "—"}</div>
      </td>
      <td className={`px-4 py-3 text-right font-mono ${excluded ? "text-gray-400" : "text-gray-600"}`}>
        {m.annualAmortization > 0 ? formatCHF(eff(m, m.annualAmortization)) : "—"}
      </td>
      <td className={`px-4 py-3 text-right font-mono font-bold ${excluded ? "text-gray-400" : "text-gray-900"}`}>
        {formatCHF(eff(m, m.remainingToday))}
        {m.shared && <div className="text-[11px] font-normal text-gray-400">({formatCHF(m.remainingToday)})</div>}
      </td>
      <td className={`px-4 py-3 text-right font-mono ${excluded ? "text-gray-400" : "text-gray-500"}`}>
        {formatCHF(eff(m, m.remainingAtEnd))}
      </td>
      <td className={`px-4 py-3 text-right font-mono font-semibold ${excluded ? "text-gray-400" : "text-amber-600"}`}>
        {formatCHF(calcAnnualInterest(m))}
      </td>
      <td className={`px-4 py-3 text-right font-mono ${excluded ? "text-gray-400" : "text-gray-500"}`}>
        {formatCHF(remInterest)}
      </td>
      <td className="px-4 py-3 text-right text-[11px]">
        {m.propertyValue ? (
          <>
            <div className={`font-mono ${excluded ? "text-gray-400" : "text-gray-700"}`}>{formatCHF(eff(m, m.propertyValue))}</div>
            {m.shared && <div className="text-gray-400">({formatCHF(m.propertyValue)})</div>}
            {ltvVal !== null && !excluded && (
              <div className={`font-bold mt-0.5 ${ltvVal > 80 ? "text-red-600" : ltvVal > 66 ? "text-amber-600" : "text-amber-500"}`}>
                LTV {ltvVal.toFixed(0)}%
              </div>
            )}
          </>
        ) : "—"}
      </td>
      <td className="px-4 py-3 text-right text-[11px]">
        {(m.monthlyRent ?? 0) > 0 ? (
          <>
            <div className={`font-mono font-semibold ${excluded ? "text-gray-400" : "text-emerald-700"}`}>{formatCHF(annualRent(m))}</div>
            <div className="text-gray-400 font-mono">{formatCHF(m.monthlyRent!)}/mois</div>
            <div className="text-red-500 font-mono mt-0.5">–{formatCHF(Math.round(annualRent(m) * 0.1))}</div>
          </>
        ) : <span className="text-gray-300">—</span>}
      </td>
    </tr>
  );
}

// ── Company section ───────────────────────────────────────────────────────────
function CompanySection({ company, excludedIds, onToggle }: {
  company: string; excludedIds: Set<string>; onToggle: (id: string) => void;
}) {
  const allItems = mortgages.filter(m => m.company === company);
  const activeItems = allItems.filter(m => !excludedIds.has(m.id));

  const totalInitial  = activeItems.reduce((s, m) => s + eff(m, m.totalAmount), 0);
  const totalToday    = activeItems.reduce((s, m) => s + eff(m, m.remainingToday), 0);
  const totalEnd      = activeItems.reduce((s, m) => s + eff(m, m.remainingAtEnd), 0);
  const totalIntA     = activeItems.reduce((s, m) => s + calcAnnualInterest(m), 0);
  const totalIntRem   = activeItems.reduce((s, m) => s + calcRemainingInterest(m), 0);
  const totalIntFull  = activeItems.reduce((s, m) => s + calcTotalInterestFullPeriod(m), 0);
  const totalAmort    = activeItems.reduce((s, m) => s + eff(m, m.annualAmortization), 0);
  const totalRent     = activeItems.reduce((s, m) => s + annualRent(m), 0);
  const totalCharges  = Math.round(totalRent * 0.1);
  const propValue     = totalPropertyValue(activeItems);
  const expiredCount  = activeItems.filter(isExpired).length;
  const soonCount     = activeItems.filter(isExpiringSoon).length;
  const excludedCount = allItems.length - activeItems.length;

  return (
    <section className="mb-6 rounded-2xl overflow-hidden border border-gray-200 shadow-md bg-white">

      {/* ── Black header ── */}
      <div className="bg-black px-5 py-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-white leading-snug">{company}</h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className="text-[11px] text-gray-400">{activeItems.length}/{allItems.length} hypothèque{allItems.length > 1 ? "s" : ""}</span>
              {excludedCount > 0 && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-gray-300">{excludedCount} exclu{excludedCount > 1 ? "s" : ""}</span>}
              {expiredCount > 0 && <span className="rounded-full bg-red-900/60 px-2 py-0.5 text-[11px] text-red-300">⚠ {expiredCount} expiré{expiredCount > 1 ? "s" : ""}</span>}
              {soonCount > 0 && <span className="rounded-full bg-amber-900/60 px-2 py-0.5 text-[11px] text-amber-300">⏳ {soonCount} bientôt</span>}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <HeaderStat label="Solde actuel" value={formatCHF(totalToday)} gold />
          <HeaderStat label="Intérêts annuels" value={formatCHF(totalIntA)} />
          {totalRent > 0 && <HeaderStat label="Loyers annuels" value={formatCHF(totalRent)} green />}
          {propValue > 0 && <HeaderStat label="Valeur des biens" value={formatCHF(propValue)} />}
        </div>
      </div>

      {/* ── Mobile rows ── */}
      <div className="md:hidden divide-y divide-gray-100">
        {allItems.map(m => (
          <MobileRow key={m.id} m={m} excluded={excludedIds.has(m.id)} onToggle={() => onToggle(m.id)} />
        ))}
        {/* Mobile totals */}
        <div className="bg-gray-900 px-4 py-4">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
            Sous-total — {activeItems.length}{excludedCount > 0 ? `/${allItems.length}` : ""} contrat{allItems.length > 1 ? "s" : ""}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MiniTotal label="Montant initial" value={formatCHF(totalInitial)} />
            <MiniTotal label="Solde aujourd'hui" value={formatCHF(totalToday)} gold />
            <MiniTotal label="Solde à la fin" value={formatCHF(totalEnd)} />
            <MiniTotal label="Intérêts annuels" value={formatCHF(totalIntA)} gold />
            {propValue > 0 && <MiniTotal label="Valeur des biens" value={formatCHF(propValue)} />}
            {propValue > 0 && <MiniTotal label="Fonds propres" value={formatCHF(propValue - totalToday)} green />}
            {totalRent > 0 && <MiniTotal label="Loyers annuels" value={formatCHF(totalRent)} green />}
            {totalRent > 0 && <MiniTotal label="Charges (10%)" value={`–${formatCHF(totalCharges)}`} />}
          </div>
        </div>
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[1100px]">
          <thead>
            <tr className="bg-stone-50 border-b border-gray-200 text-[11px] text-gray-400 uppercase tracking-wide">
              {["Bien / Contrat", "Statut", "Montant initial", "Taux", "Période", "Amort. annuel", "Solde actuel", "Solde fin contrat", "Intérêts annuels", "Intérêts restants", "Valeur / LTV", "Loyers annuels"].map((h, i) => (
                <th key={h} className={`px-4 py-3 font-semibold ${i === 0 ? "text-left" : i <= 1 ? "text-center" : "text-right"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allItems.map((m, i) => (
              <TableRow key={m.id} m={m} idx={i} excluded={excludedIds.has(m.id)} onToggle={() => onToggle(m.id)} />
            ))}
            {/* Subtotal row */}
            <tr className="bg-black text-white text-sm font-bold border-t-2 border-amber-500">
              <td className="px-4 py-3" colSpan={2}>
                Sous-total — {activeItems.length}{excludedCount > 0 ? `/${allItems.length}` : ""} contrat{allItems.length > 1 ? "s" : ""}
              </td>
              <td className="px-4 py-3 text-right font-mono text-gray-300">{formatCHF(totalInitial)}</td>
              <td /><td />
              <td className="px-4 py-3 text-right font-mono text-gray-300">{totalAmort > 0 ? formatCHF(totalAmort) : "—"}</td>
              <td className="px-4 py-3 text-right font-mono text-amber-400">{formatCHF(totalToday)}</td>
              <td className="px-4 py-3 text-right font-mono text-gray-400">{formatCHF(totalEnd)}</td>
              <td className="px-4 py-3 text-right font-mono text-amber-400">{formatCHF(totalIntA)}</td>
              <td className="px-4 py-3 text-right font-mono text-gray-400">{formatCHF(totalIntRem)}</td>
              <td className="px-4 py-3 text-right font-mono">
                {propValue > 0 ? <>
                  <div className="text-gray-300">{formatCHF(propValue)}</div>
                  <div className="text-xs font-normal text-emerald-400">+{formatCHF(propValue - totalToday)}</div>
                </> : "—"}
              </td>
              <td className="px-4 py-3 text-right font-mono">
                {totalRent > 0 ? <>
                  <div className="text-emerald-400">{formatCHF(totalRent)}</div>
                  <div className="text-xs font-normal text-red-400">–{formatCHF(totalCharges)}</div>
                </> : "—"}
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
    <div className="rounded-xl bg-white/8 border border-white/10 px-3 py-2.5">
      <div className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</div>
      <div className={`text-sm font-bold mt-0.5 ${gold ? "text-amber-400" : green ? "text-emerald-400" : "text-white"}`}>{value}</div>
    </div>
  );
}

function MiniTotal({ label, value, gold, green }: { label: string; value: string; gold?: boolean; green?: boolean }) {
  return (
    <div className="rounded-lg bg-gray-800 px-3 py-2">
      <div className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</div>
      <div className={`text-xs font-bold mt-0.5 ${gold ? "text-amber-400" : green ? "text-emerald-400" : "text-white"}`}>{value}</div>
    </div>
  );
}

// ── KPI cards ─────────────────────────────────────────────────────────────────
function SummarySection({ activeMortgages }: { activeMortgages: Mortgage[] }) {
  const all = mortgages;
  const totalInitial  = activeMortgages.reduce((s, m) => s + eff(m, m.totalAmount), 0);
  const totalToday    = activeMortgages.reduce((s, m) => s + eff(m, m.remainingToday), 0);
  const totalIntAnnual= activeMortgages.reduce((s, m) => s + calcAnnualInterest(m), 0);
  const totalIntRem   = activeMortgages.reduce((s, m) => s + calcRemainingInterest(m), 0);
  const totalRent     = activeMortgages.reduce((s, m) => s + annualRent(m), 0);
  const totalCharges  = Math.round(totalRent * 0.1);
  const totalAmortA   = activeMortgages.reduce((s, m) => s + eff(m, m.annualAmortization), 0);
  const totalAmortQ   = activeMortgages.reduce((s, m) => s + eff(m, m.quarterlyAmortization), 0);
  const propValue     = totalPropertyValue(activeMortgages);
  const equity        = propValue - totalToday;
  const expiredCount  = activeMortgages.filter(isExpired).length;
  const soonCount     = activeMortgages.filter(isExpiringSoon).length;
  const excludedCount = all.length - activeMortgages.length;

  return (
    <div className="mb-6">
      {/* Big total */}
      <div className="hidden md:block mb-5">
        <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Encours total</div>
        <div className="flex items-baseline gap-4">
          <div className="text-4xl font-bold text-gray-900">{formatCHF(totalToday)}</div>
          <div className="text-sm text-gray-400">sur {formatCHF(totalInitial)} initiaux</div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Valeur des biens" value={formatCHF(propValue)} sub={`LTV moy. ${propValue > 0 ? ((totalToday / propValue) * 100).toFixed(0) : "—"}%`} icon="🏠" />
        <KpiCard label="Fonds propres" value={formatCHF(equity)} sub={`${propValue > 0 ? ((equity / propValue) * 100).toFixed(0) : "—"}% de la valeur`} icon="💰" green />
        <KpiCard label="Intérêts annuels" value={formatCHF(totalIntAnnual)} sub={`${formatCHF(totalIntRem)} restants`} icon="💶" gold />
        <KpiCard label="Amort. annuel" value={formatCHF(totalAmortA)} sub={`${formatCHF(totalAmortQ)} / trimestre`} icon="📉" />
        <KpiCard label="Loyers annuels" value={formatCHF(totalRent)} sub={`Charges : –${formatCHF(totalCharges)}`} icon="🏘️" green />
        <KpiCard label="Loyers nets" value={formatCHF(totalRent - totalCharges)} sub="Après charges 10%" icon="✅" green />
        <KpiCard
          label="Alertes"
          value={`${expiredCount + soonCount} contrat${expiredCount + soonCount !== 1 ? "s" : ""}`}
          sub={`${expiredCount} expiré · ${soonCount} bientôt${excludedCount > 0 ? ` · ${excludedCount} exclu` : ""}`}
          icon="⚠️"
          red={expiredCount > 0}
          amber={!expiredCount && soonCount > 0}
        />
        <KpiCard label="Nb. hypothèques" value={`${activeMortgages.length}`} sub={`sur ${all.length} au total`} icon="📋" />
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, icon, gold, green, red, amber }: {
  label: string; value: string; sub: string; icon: string;
  gold?: boolean; green?: boolean; red?: boolean; amber?: boolean;
}) {
  const border = red ? "border-red-200 bg-red-50" : amber ? "border-amber-200 bg-amber-50" : gold ? "border-amber-200 bg-amber-50" : green ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-white";
  const valColor = red ? "text-red-700" : amber ? "text-amber-700" : gold ? "text-amber-700" : green ? "text-emerald-800" : "text-gray-900";
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

// ── Sidebar nav item ──────────────────────────────────────────────────────────
function NavItem({ icon, label, active }: { icon: string; label: string; active?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${active ? "bg-amber-500/15 text-amber-400" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
      <span className="text-base leading-none">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

// ── Mobile bottom nav item ────────────────────────────────────────────────────
function MobileTab({ icon, label, active }: { icon: string; label: string; active?: boolean }) {
  return (
    <div className={`flex-1 flex flex-col items-center py-2 gap-0.5 ${active ? "text-amber-600" : "text-gray-400"}`}>
      <span className="text-xl leading-none">{icon}</span>
      <span className="text-[10px] font-medium">{label}</span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [activeCompany, setActiveCompany] = useState<string | null>(null);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  function toggleExclude(id: string) {
    setExcludedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const activeMortgages = mortgages.filter(m => !excludedIds.has(m.id));
  const totalToday = activeMortgages.reduce((s, m) => s + eff(m, m.remainingToday), 0);
  const visible = activeCompany ? [activeCompany] : companies;

  return (
    <div className="flex h-screen bg-stone-100 overflow-hidden">

      {/* ══ Sidebar (desktop only) ══ */}
      <aside className="hidden md:flex flex-col w-56 bg-black text-white shrink-0 z-10">
        {/* Logo — lien retour accueil */}
        <Link href="/" className="px-5 py-5 border-b border-white/10 flex items-center gap-3 hover:bg-white/5 transition-colors">
          <div className="relative w-8 h-8 shrink-0">
            <Image src="/logo.png" alt="MBA" fill className="object-contain" />
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-tight">MBA Groupe SA</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">Wealth Management</div>
          </div>
        </Link>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <NavItem icon="🏦" label="Hypothèques" active />
        </nav>

        {/* Date */}
        <div className="px-4 pb-5">
          <div className="text-[11px] text-gray-500 text-center">
            Données au {TODAY.toLocaleDateString("fr-CH")}
          </div>
        </div>
      </aside>

      {/* ══ Main ══ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Desktop header */}
        <header className="hidden md:flex items-center justify-between bg-white border-b border-gray-200 px-6 py-3.5 shrink-0 shadow-sm">
          <div>
            <h1 className="text-base font-bold text-gray-900">Vue d'ensemble du portefeuille</h1>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Tableau de bord hypothèques · {TODAY.toLocaleDateString("fr-CH", { day: "2-digit", month: "long", year: "numeric" })}
              {excludedIds.size > 0 && <span className="ml-2 text-amber-600 font-semibold">· {excludedIds.size} exclu{excludedIds.size > 1 ? "s" : ""}</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {excludedIds.size > 0 && (
              <button onClick={() => setExcludedIds(new Set())} className="text-xs rounded-full bg-amber-100 text-amber-700 px-3 py-1.5 font-semibold border border-amber-200 hover:bg-amber-200 transition-colors">
                ↺ Réinitialiser
              </button>
            )}
            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-black font-bold text-sm">M</div>
          </div>
        </header>

        {/* Mobile header */}
        <header className="md:hidden bg-black text-white px-4 pt-4 pb-4 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 shrink-0">
              <Image src="/logo.png" alt="MBA" fill className="object-contain" />
            </div>
            <div>
              <div className="text-[10px] text-gray-400 uppercase tracking-widest">Encours total</div>
              <div className="text-xl font-bold text-amber-400 leading-tight">{formatCHF(totalToday)}</div>
            </div>
          </div>
          {excludedIds.size > 0 && (
            <button onClick={() => setExcludedIds(new Set())} className="text-xs rounded-full bg-white/10 text-amber-400 px-3 py-1.5 font-semibold border border-white/10">
              ↺
            </button>
          )}
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto px-4 md:px-6 py-5 pb-24 md:pb-6">
          <SummarySection activeMortgages={activeMortgages} />

          {/* Hint */}
          <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-[11px] text-amber-700 flex items-start gap-2">
            <span>💡</span>
            <span className="md:hidden">Ouvrez une fiche et appuyez sur « Exclure des totaux » pour retirer un bien du calcul.</span>
            <span className="hidden md:inline">Cliquez sur une ligne du tableau pour l'exclure des totaux. Cliquez à nouveau pour la réinclure.</span>
          </div>

          {/* Company filter */}
          <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
            <FilterBtn label="Toutes les sociétés" active={activeCompany === null} onClick={() => setActiveCompany(null)} />
            {companies.map(c => (
              <FilterBtn key={c} label={c} active={activeCompany === c} onClick={() => setActiveCompany(activeCompany === c ? null : c)} />
            ))}
          </div>

          {/* Active contracts */}
          <div className="mb-2 flex items-baseline gap-2">
            <h2 className="text-base font-bold text-gray-900">Contrats actifs</h2>
            <span className="text-xs text-gray-400">Gestion des engagements et échéances</span>
          </div>

          {visible.map(c => (
            <CompanySection key={c} company={c} excludedIds={excludedIds} onToggle={toggleExclude} />
          ))}

          <div className="rounded-2xl bg-white border border-gray-200 p-4 mt-2 text-xs text-gray-500 leading-relaxed shadow-sm">
            <strong className="text-gray-700">Note — Taux Saron Flex :</strong> Les intérêts pour les contrats à taux variable utilisent uniquement la marge indiquée. Le taux Saron réel peut varier — les montants sont une estimation minimale.
          </div>
          <div className="mt-4 pb-2 text-center text-[11px] text-gray-400">
            MBA Groupe SA · Données au {TODAY.toLocaleDateString("fr-CH")} · Financial data managed internally
          </div>
        </main>
      </div>

      {/* ══ Mobile bottom nav ══ */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 flex z-20 shadow-lg">
        <MobileTab icon="📊" label="Aperçu" active />
        <MobileTab icon="🏦" label="Hypothèques" />
        <MobileTab icon="🏠" label="Biens" />
        <MobileTab icon="📋" label="Rapports" />
      </nav>
    </div>
  );
}

function FilterBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors border shrink-0 ${
        active ? "bg-black text-amber-400 border-black font-bold" : "bg-white border-gray-200 text-gray-600 hover:border-gray-400 shadow-sm"
      }`}
    >
      {label}
    </button>
  );
}
