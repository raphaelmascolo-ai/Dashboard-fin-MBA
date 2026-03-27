"use client";
import { useState, useEffect } from "react";
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

/** Total property value, counting grouped properties only once, applying share ratio */
function totalPropertyValue(ms: Mortgage[]): number {
  const seen = new Set<string>();
  let total = 0;
  for (const m of ms) {
    if (!m.propertyValue) continue;
    const key = m.propertyGroup ?? m.id;
    if (!seen.has(key)) {
      seen.add(key);
      total += m.propertyValue * ratio(m);
    }
  }
  return total;
}

/** Effective debt value for a mortgage, applying share ratio */
function eff(m: Mortgage, value: number): number {
  return value * ratio(m);
}

function StatusBadge({ m }: { m: Mortgage }) {
  if (isExpired(m))
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
        ⚠ Expiré
      </span>
    );
  if (isExpiringSoon(m))
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
        ⏳ Expire bientôt
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
      ✓ Actif
    </span>
  );
}

function LtvBar({ value }: { value: number }) {
  const color =
    value > 80 ? "bg-red-500" : value > 66 ? "bg-amber-400" : "bg-green-500";
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-500 mb-0.5">
        <span>LTV (dette / valeur du bien)</span>
        <span className={`font-semibold ${value > 80 ? "text-red-600" : value > 66 ? "text-amber-600" : "text-green-600"}`}>
          {value.toFixed(1)}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200">
        <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

// ── Mobile card ───────────────────────────────────────────────────────────────
function MortgageCard({
  m,
  excluded,
  onToggle,
}: {
  m: Mortgage;
  excluded: boolean;
  onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  const remInterest = calcRemainingInterest(m);
  const totalInterest = calcTotalInterestFullPeriod(m);
  const ltvVal = ltv(m);
  const yrs = yearsRemaining(m);

  const borderColor = excluded
    ? "border-gray-200"
    : isExpired(m)
    ? "border-red-300"
    : isExpiringSoon(m)
    ? "border-amber-300"
    : "border-gray-200";

  return (
    <div className={`rounded-xl border ${borderColor} shadow-sm overflow-hidden mb-3 transition-opacity ${excluded ? "opacity-40" : "bg-white"}`}>
      <button className="w-full text-left p-4" onClick={() => setOpen((v) => !v)}>
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className={`font-semibold text-sm leading-snug ${excluded ? "line-through text-gray-400" : "text-gray-900"}`}>
              {m.label}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-xs text-gray-400 font-mono">{m.id}</span>
              {m.shared && (
                <span className="inline-flex items-center rounded-full bg-orange-100 px-1.5 py-0.5 text-xs font-semibold text-orange-700">
                  50% MBA
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {!excluded && <StatusBadge m={m} />}
            {excluded && (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                Exclu
              </span>
            )}
          </div>
        </div>

        {!excluded && (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-blue-50 p-2.5">
                <div className="text-xs text-blue-600 font-medium">Solde actuel</div>
                <div className="text-sm font-bold text-blue-900 mt-0.5">{formatCHF(m.remainingToday)}</div>
              </div>
              <div className="rounded-lg bg-purple-50 p-2.5">
                <div className="text-xs text-purple-600 font-medium">Intérêts restants</div>
                <div className="text-sm font-bold text-purple-900 mt-0.5">{formatCHF(remInterest)}</div>
              </div>
            </div>
            {ltvVal !== null && <LtvBar value={ltvVal} />}
          </>
        )}

        <div className="mt-2 text-right text-xs text-blue-500">{open ? "▲ Réduire" : "▼ Voir tout"}</div>
      </button>

      {open && (
        <div className="border-t border-gray-100 p-4 space-y-2.5 text-sm bg-gray-50/60">
          <DataRow label="Montant initial" value={formatCHF(m.totalAmount)} />
          <DataRow label="Taux d'intérêt" value={m.rateType === "saron" ? `Saron + ${m.rate}% (variable)` : `${m.rate.toFixed(2)}% fixe`} />
          <DataRow label="Début du contrat" value={formatDate(m.startDate)} />
          <DataRow label="Fin du contrat" value={formatDate(m.endDate)} />
          <DataRow label="Durée restante" value={yrs > 0 ? `${yrs.toFixed(1)} ans` : "Expiré"} />
          <DataRow label="Amortissement annuel" value={m.annualAmortization > 0 ? formatCHF(m.annualAmortization) : "–"} />
          <DataRow label="Amortissement trimestriel" value={m.quarterlyAmortization > 0 ? formatCHF(m.quarterlyAmortization) : "–"} />
          <DataRow label="Solde à la fin du contrat" value={formatCHF(m.remainingAtEnd)} />
          <hr className="border-gray-200" />
          <DataRow label="Intérêts totaux (durée contrat)" value={formatCHF(totalInterest)} highlight="purple" />
          <DataRow label="Intérêts restants à payer" value={formatCHF(remInterest)} highlight="purple" />
          {m.propertyValue && (
            <>
              <hr className="border-gray-200" />
              <DataRow label="Valeur du bien" value={formatCHF(m.propertyValue)} />
            </>
          )}
          <hr className="border-gray-200" />
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className={`w-full rounded-lg py-2 text-xs font-semibold transition-colors ${
              excluded
                ? "bg-green-100 text-green-700 hover:bg-green-200"
                : "bg-red-50 text-red-600 hover:bg-red-100"
            }`}
          >
            {excluded ? "✓ Réinclure dans les totaux" : "✕ Exclure des totaux"}
          </button>
        </div>
      )}
    </div>
  );
}

function DataRow({ label, value, highlight }: { label: string; value: string; highlight?: "blue" | "purple" }) {
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className="text-gray-500 text-xs leading-snug">{label}</span>
      <span className={`font-semibold text-xs shrink-0 ${highlight === "blue" ? "text-blue-700" : highlight === "purple" ? "text-purple-700" : "text-gray-900"}`}>
        {value}
      </span>
    </div>
  );
}

// ── Desktop table row ─────────────────────────────────────────────────────────
function TableRow({
  m,
  idx,
  excluded,
  onToggle,
}: {
  m: Mortgage;
  idx: number;
  excluded: boolean;
  onToggle: () => void;
}) {
  const remInterest = calcRemainingInterest(m);
  const totalInterest = calcTotalInterestFullPeriod(m);
  const ltvVal = ltv(m);
  const yrs = yearsRemaining(m);

  return (
    <tr
      onClick={onToggle}
      title={excluded ? "Cliquer pour réinclure" : "Cliquer pour exclure des totaux"}
      className={`border-b border-gray-100 cursor-pointer transition-all select-none ${
        excluded
          ? "opacity-35 bg-gray-100 hover:opacity-50"
          : idx % 2 === 0
          ? "bg-white hover:bg-blue-50/40"
          : "bg-gray-50/70 hover:bg-blue-50/40"
      }`}
    >
      <td className="px-3 py-3">
        <div className={`font-medium text-sm leading-snug ${excluded ? "line-through text-gray-400" : "text-gray-900"}`}>
          {m.label}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-gray-400 font-mono">{m.id}</span>
          {m.shared && (
            <span className="inline-flex items-center rounded-full bg-orange-100 px-1.5 py-0.5 text-xs font-semibold text-orange-700">
              50% MBA
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-3 text-center">
        {excluded ? (
          <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-500">Exclu</span>
        ) : (
          <StatusBadge m={m} />
        )}
      </td>
      <td className={`px-3 py-3 text-right font-mono text-sm ${excluded ? "text-gray-400" : "text-gray-700"}`}>
        {formatCHF(eff(m, m.totalAmount))}
        {m.shared && <div className="text-xs text-gray-400">({formatCHF(m.totalAmount)} total)</div>}
      </td>
      <td className="px-3 py-3 text-center">
        {m.rateType === "saron" ? (
          <span className="inline-block rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-semibold text-indigo-700">
            Saron +{m.rate}%
          </span>
        ) : (
          <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-700">
            {m.rate.toFixed(2)}% fixe
          </span>
        )}
      </td>
      <td className="px-3 py-3 text-center text-xs text-gray-500">
        <div className="text-gray-400">{formatDate(m.startDate)}</div>
        <div className="font-semibold text-gray-900">{formatDate(m.endDate)}</div>
        <div className="text-gray-400 mt-0.5">{yrs > 0 ? `${yrs.toFixed(1)} ans restants` : "Expiré"}</div>
      </td>
      <td className={`px-3 py-3 text-right font-mono text-sm ${excluded ? "text-gray-400" : "text-gray-600"}`}>
        {m.annualAmortization > 0 ? formatCHF(m.annualAmortization) : "–"}
      </td>
      <td className={`px-3 py-3 text-right font-mono text-sm font-semibold ${excluded ? "text-gray-400" : "text-blue-700"}`}>
        {formatCHF(eff(m, m.remainingToday))}
        {m.shared && <div className="text-xs font-normal text-gray-400">({formatCHF(m.remainingToday)} total)</div>}
      </td>
      <td className={`px-3 py-3 text-right font-mono text-sm ${excluded ? "text-gray-400" : "text-gray-500"}`}>
        {formatCHF(eff(m, m.remainingAtEnd))}
      </td>
      <td className={`px-3 py-3 text-right font-mono text-sm font-semibold ${excluded ? "text-gray-400" : "text-purple-700"}`}>
        {formatCHF(calcAnnualInterest(m))}
      </td>
      <td className={`px-3 py-3 text-right font-mono text-sm ${excluded ? "text-gray-400" : "text-gray-500"}`}>
        {formatCHF(remInterest)}
      </td>
      <td className="px-3 py-3 text-right text-xs text-gray-500">
        {m.propertyValue ? (
          <>
            <div className="font-mono">{formatCHF(eff(m, m.propertyValue))}</div>
            {m.shared && <div className="text-gray-400">({formatCHF(m.propertyValue)} total)</div>}
            {ltvVal !== null && !excluded && (
              <div className={`font-bold mt-0.5 ${ltvVal > 80 ? "text-red-600" : ltvVal > 66 ? "text-amber-600" : "text-green-600"}`}>
                LTV {ltvVal.toFixed(0)}%
              </div>
            )}
          </>
        ) : "–"}
      </td>
      <td className={`px-3 py-3 text-right text-sm ${excluded ? "text-gray-400" : (m.monthlyRent ?? 0) > 0 ? "" : "text-gray-400"}`}>
        {(m.monthlyRent ?? 0) > 0 ? (
          <>
            <div className="font-mono font-semibold text-emerald-700">{formatCHF(annualRent(m))}</div>
            <div className="text-xs text-gray-400 font-mono">{formatCHF(m.monthlyRent!)}/mois</div>
            <div className="text-xs text-red-400 font-mono mt-0.5">–{formatCHF(Math.round(annualRent(m) * 0.1))} charges</div>
          </>
        ) : "–"}
      </td>
    </tr>
  );
}

// ── Company section ───────────────────────────────────────────────────────────
const companyColors = [
  "from-blue-600 to-blue-800",
  "from-orange-500 to-orange-700",
  "from-purple-600 to-purple-800",
  "from-teal-600 to-teal-800",
  "from-rose-600 to-rose-800",
];

function CompanySection({
  company,
  isMobile,
  excludedIds,
  onToggle,
}: {
  company: string;
  isMobile: boolean;
  excludedIds: Set<string>;
  onToggle: (id: string) => void;
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
  const colorIdx = companies.indexOf(company) % companyColors.length;
  const excludedCount = allItems.length - activeItems.length;

  return (
    <section className="mb-8">
      <div className={`rounded-xl bg-gradient-to-r ${companyColors[colorIdx]} p-4 mb-4 text-white shadow`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold leading-snug">{company}</h2>
            <div className="text-xs opacity-80 mt-1 flex flex-wrap gap-1.5">
              <span>{activeItems.length}/{allItems.length} hypothèque{allItems.length > 1 ? "s" : ""}</span>
              {excludedCount > 0 && (
                <span className="rounded-full bg-white/30 px-2 py-0.5 font-semibold">
                  {excludedCount} exclu{excludedCount > 1 ? "s" : ""}
                </span>
              )}
              {expiredCount > 0 && (
                <span className="rounded-full bg-red-400/70 px-2 py-0.5 font-semibold">
                  {expiredCount} expiré{expiredCount > 1 ? "s" : ""}
                </span>
              )}
              {soonCount > 0 && (
                <span className="rounded-full bg-amber-300/80 px-2 py-0.5 font-semibold text-amber-900">
                  {soonCount} expire bientôt
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatChip label="Solde actuel" value={formatCHF(totalToday)} />
            <StatChip label="Intérêts annuels" value={formatCHF(totalIntAnnual)} />
            {propValue > 0 && <StatChip label="Valeur des biens" value={formatCHF(propValue)} />}
          </div>
        </div>
      </div>

      {isMobile ? (
        <>
          {allItems.map((m) => (
            <MortgageCard
              key={m.id}
              m={m}
              excluded={excludedIds.has(m.id)}
              onToggle={() => onToggle(m.id)}
            />
          ))}
          <div className="rounded-xl bg-gray-100 p-3 grid grid-cols-2 gap-2 text-xs mt-1">
            <TotalCell label="Montant initial total" value={formatCHF(totalInitial)} />
            <TotalCell label="Solde aujourd'hui" value={formatCHF(totalToday)} blue />
            <TotalCell label="Solde à la fin" value={formatCHF(totalEnd)} />
            <TotalCell label="Intérêts annuels" value={formatCHF(totalIntAnnual)} purple />
            <TotalCell label="Intérêts restants" value={formatCHF(totalIntRem)} />
            {propValue > 0 && <TotalCell label="Valeur des biens" value={formatCHF(propValue)} green />}
            {propValue > 0 && <TotalCell label="Fonds propres" value={formatCHF(propValue - totalToday)} emerald />}
            {totalRent > 0 && <TotalCell label="Loyers annuels" value={formatCHF(totalRent)} emerald />}
            {totalRent > 0 && <TotalCell label="Charges (10%)" value={`–${formatCHF(totalCharges)}`} />}
            <TotalCell label="Intérêts totaux contrat" value={formatCHF(totalIntFull)} />
          </div>
        </>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-gray-100 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                {["Bien / Contrat", "Statut", "Montant initial", "Taux", "Période", "Amort. annuel", "Solde actuel", "Solde fin contrat", "Intérêts annuels", "Intérêts restants", "Valeur / LTV", "Loyers annuels"].map((h, i) => (
                  <th key={h} className={`px-3 py-2 ${i === 0 ? "text-left" : i <= 1 ? "text-center" : "text-right"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allItems.map((m, i) => (
                <TableRow
                  key={m.id}
                  m={m}
                  idx={i}
                  excluded={excludedIds.has(m.id)}
                  onToggle={() => onToggle(m.id)}
                />
              ))}
              <tr className="bg-gray-100 border-t-2 border-gray-300 text-sm font-bold">
                <td className="px-3 py-3 text-gray-700" colSpan={2}>
                  Sous-total — {activeItems.length}{excludedCount > 0 ? `/${allItems.length}` : ""} contrat{allItems.length > 1 ? "s" : ""}
                </td>
                <td className="px-3 py-3 text-right font-mono">{formatCHF(totalInitial)}</td>
                <td /><td />
                <td className="px-3 py-3 text-right font-mono">{totalAmort > 0 ? formatCHF(totalAmort) : "–"}</td>
                <td className="px-3 py-3 text-right font-mono text-blue-700">{formatCHF(totalToday)}</td>
                <td className="px-3 py-3 text-right font-mono">{formatCHF(totalEnd)}</td>
                <td className="px-3 py-3 text-right font-mono text-purple-700">{formatCHF(totalIntAnnual)}</td>
                <td className="px-3 py-3 text-right font-mono">{formatCHF(totalIntRem)}</td>
                <td className="px-3 py-3 text-right font-mono text-green-700">
                  {propValue > 0 ? formatCHF(propValue) : "–"}
                  {propValue > 0 && (
                    <div className="text-xs font-normal text-emerald-700">
                      +{formatCHF(propValue - totalToday)}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 text-right font-mono text-emerald-700">
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

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/20 px-3 py-1.5 text-center min-w-[100px]">
      <div className="text-xs opacity-80">{label}</div>
      <div className="text-sm font-bold mt-0.5">{value}</div>
    </div>
  );
}

function TotalCell({ label, value, blue, purple, green, emerald }: { label: string; value: string; blue?: boolean; purple?: boolean; green?: boolean; emerald?: boolean }) {
  return (
    <div className="rounded-lg bg-white p-2">
      <div className="text-gray-500 text-xs">{label}</div>
      <div className={`font-bold text-sm mt-0.5 ${blue ? "text-blue-700" : purple ? "text-purple-700" : green ? "text-green-700" : emerald ? "text-emerald-700" : "text-gray-900"}`}>
        {value}
      </div>
    </div>
  );
}

// ── Grand summary cards ───────────────────────────────────────────────────────
function SummaryCards({ activeMortgages }: { activeMortgages: Mortgage[] }) {
  const all = mortgages;
  const totalInitial = activeMortgages.reduce((s, m) => s + eff(m, m.totalAmount), 0);
  const totalToday = activeMortgages.reduce((s, m) => s + eff(m, m.remainingToday), 0);
  const totalEnd = activeMortgages.reduce((s, m) => s + eff(m, m.remainingAtEnd), 0);
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
  const alertColor = expiredCount > 0 ? "bg-red-600" : soonCount > 0 ? "bg-amber-500" : "bg-green-600";

  const cards = [
    {
      title: "Encours total",
      value: formatCHF(totalToday),
      sub: `sur ${formatCHF(totalInitial)} initiaux`,
      color: "bg-blue-600",
      icon: "🏦",
    },
    {
      title: "Valeur totale des biens",
      value: formatCHF(propValue),
      sub: `LTV moy. ${propValue > 0 ? ((totalToday / propValue) * 100).toFixed(0) : "–"}%`,
      color: "bg-green-600",
      icon: "🏠",
    },
    {
      title: "Fonds propres (Valeur – Encours)",
      value: formatCHF(propValue - totalToday),
      sub: `${propValue > 0 ? (((propValue - totalToday) / propValue) * 100).toFixed(0) : "–"}% de la valeur`,
      color: "bg-emerald-700",
      icon: "💰",
    },
    {
      title: "Intérêts annuels",
      value: formatCHF(totalIntAnnual),
      sub: `${formatCHF(totalIntRem)} restants au total`,
      color: "bg-purple-600",
      icon: "💶",
    },
    {
      title: "Amortissement annuel",
      value: formatCHF(totalAmortA),
      sub: `${formatCHF(totalAmortQ)} / trimestre`,
      color: "bg-teal-600",
      icon: "📉",
    },
    {
      title: "Loyers annuels",
      value: formatCHF(totalRentGlobal),
      sub: `Charges (10%) : ${formatCHF(totalChargesGlobal)}`,
      color: "bg-emerald-600",
      icon: "🏘️",
    },
    {
      title: "Alertes",
      value: `${expiredCount + soonCount} contrat${expiredCount + soonCount !== 1 ? "s" : ""}`,
      sub: `${expiredCount} expiré · ${soonCount} expire bientôt`,
      color: alertColor,
      icon: "⚠️",
    },
  ];

  return (
    <div className="flex gap-3 mb-8 overflow-x-auto pb-1">
      {cards.map((c) => (
        <div key={c.title} className={`${c.color} rounded-xl p-4 text-white shadow flex-1 min-w-[150px]`}>
          <div className="text-2xl mb-1">{c.icon}</div>
          <div className="text-xs font-medium opacity-80 leading-tight">{c.title}</div>
          <div className="text-base font-bold mt-1 leading-tight">{c.value}</div>
          <div className="text-xs opacity-70 mt-1 leading-tight">{c.sub}</div>
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
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const activeMortgages = mortgages.filter((m) => !excludedIds.has(m.id));
  const totalToday = activeMortgages.reduce((s, m) => s + eff(m, m.remainingToday), 0);
  const visible = activeCompany ? [activeCompany] : companies;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Hypothèques — MBA Groupe SA</h1>
            <div className="text-xs text-gray-500 mt-0.5">
              Tableau de bord au {TODAY.toLocaleDateString("fr-CH", { day: "2-digit", month: "long", year: "numeric" })}
              {excludedIds.size > 0 && (
                <span className="ml-2 text-amber-600 font-medium">
                  · {excludedIds.size} contrat{excludedIds.size > 1 ? "s" : ""} exclu{excludedIds.size > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {excludedIds.size > 0 && (
              <button
                onClick={() => setExcludedIds(new Set())}
                className="text-xs rounded-full bg-amber-100 text-amber-700 px-3 py-1.5 font-medium hover:bg-amber-200 transition-colors"
              >
                ↺ Réinitialiser
              </button>
            )}
            <div className="text-right">
              <div className="text-xs text-gray-500">Total encours</div>
              <div className="text-xl font-bold text-blue-700">{formatCHF(totalToday)}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 py-6">
        <SummaryCards activeMortgages={activeMortgages} />

        {/* hint */}
        <div className="mb-4 rounded-lg bg-blue-50 border border-blue-100 px-4 py-2 text-xs text-blue-700 flex items-center gap-2">
          <span>💡</span>
          <span>
            {isMobile
              ? "Ouvrez une fiche et appuyez sur « Exclure des totaux » pour retirer un bien du calcul."
              : "Cliquez sur une ligne du tableau pour l'exclure des totaux. Cliquez à nouveau pour la réinclure."}
          </span>
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

        <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-4 mt-4 text-sm text-indigo-800">
          <strong>Note sur les taux Saron Flex :</strong> Les intérêts calculés pour les contrats à taux variable utilisent uniquement la marge (spread) indiquée dans le contrat. Le taux Saron réel peut varier — les montants affichés sont donc une estimation minimale.
        </div>

        <footer className="mt-8 pb-4 text-center text-xs text-gray-400">
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
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${active ? "bg-gray-900 text-white shadow" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
    >
      {label}
    </button>
  );
}
