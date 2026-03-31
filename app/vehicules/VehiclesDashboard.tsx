"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  isLeasingExpired,
  isLeasingEndingSoon,
  needsExpertise,
  formatCHF,
  formatDate,
  TODAY_VHC,
  type Vehicle,
  type VehicleType,
  type RateUnit,
} from "./data";
import { createClient } from "../lib/supabase/client";

// ── ID generator ──────────────────────────────────────────────────────────────
function generateId(): string {
  return `VHC-${Date.now().toString(36).toUpperCase()}`;
}

// ── Empty vehicle factory ─────────────────────────────────────────────────────
const emptyVehicle = (): Vehicle => ({
  id: generateId(),
  type: "VHC Exploit",
  brand: "",
  plate: null,
  year: new Date().getFullYear(),
  notes: "",
  lastExpertise: null,
  lastService: null,
  purchasePrice: 0,
  company: "",
  billedToMBAS: 0,
  leasingMonthly: 0,
  leasingNumber: null,
  leasingEnd: null,
  insuranceMonthly: 0,
  resaleMonthly: 0,
  refacturingRate: 0,
  refacturingUnit: "",
  refacturingTo: "",
});

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  icon,
  red,
  amber,
  blue,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  red?: boolean;
  amber?: boolean;
  blue?: boolean;
}) {
  const border = red
    ? "border-[#ff3b30]/20 bg-[#ff3b30]/5"
    : amber
    ? "border-[#ff9f0a]/20 bg-[#ff9f0a]/5"
    : blue
    ? "border-[#0071e3]/20 bg-[#0071e3]/5"
    : "glass-card";
  const valColor = red
    ? "text-[#ff3b30]"
    : amber
    ? "text-[#bf5f1a]"
    : blue
    ? "text-[#0071e3]"
    : "text-[#1d1d1f]";
  const subColor = red
    ? "text-[#ff3b30]/70"
    : amber
    ? "text-[#bf5f1a]/70"
    : blue
    ? "text-[#0071e3]/70"
    : "text-[#86868b]";

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${border}`}>
      <div className="text-xl mb-2">{icon}</div>
      <div className="text-[11px] text-[#86868b] uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-bold mt-1 leading-tight ${valColor}`}>{value}</div>
      {sub && <div className={`text-[11px] mt-1 ${subColor}`}>{sub}</div>}
    </div>
  );
}

// ── Leasing Status Badge ───────────────────────────────────────────────────────
function LeasingBadge({ v }: { v: Vehicle }) {
  if (v.leasingMonthly <= 0) {
    return <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-400">Aucun</span>;
  }
  if (isLeasingExpired(v)) {
    return <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700 uppercase tracking-wide">Expiré</span>;
  }
  if (isLeasingEndingSoon(v)) {
    return <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700 uppercase tracking-wide">Bientôt</span>;
  }
  return <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700 uppercase tracking-wide">Leasing</span>;
}

// ── Filter Button ─────────────────────────────────────────────────────────────
function FilterBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all border shrink-0 ${
        active
          ? "bg-[#1d1d1f] text-white border-[#1d1d1f]"
          : "bg-white/60 border-white/40 text-[#86868b] hover:bg-white/80 hover:text-[#1d1d1f]"
      }`}
    >
      {label}
    </button>
  );
}

// ── Form helpers ──────────────────────────────────────────────────────────────
function inputCls(err?: string) {
  return `w-full px-3 py-2.5 rounded-xl border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 ${err ? "border-red-300" : "border-gray-200"}`;
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

// ── Vehicle Form Modal ────────────────────────────────────────────────────────
function VehicleForm({
  vehicle,
  isNew,
  allVehicles,
  saving,
  onSave,
  onDelete,
  onClose,
}: {
  vehicle: Vehicle;
  isNew: boolean;
  allVehicles: Vehicle[];
  saving: boolean;
  onSave: (v: Vehicle) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Vehicle>(() => ({ ...vehicle }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const allCompanies = useMemo(
    () => Array.from(new Set(allVehicles.map((v) => v.company).filter(Boolean))),
    [allVehicles]
  );

  function set<K extends keyof Vehicle>(field: K, value: Vehicle[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((e) => {
      const n = { ...e };
      delete n[field as string];
      return n;
    });
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.id.trim()) e.id = "Requis";
    else if (allVehicles.some((v) => v.id === form.id.trim() && v.id !== vehicle.id))
      e.id = "Cet ID est déjà utilisé par un autre véhicule";
    if (!form.brand.trim()) e.brand = "Requis";
    if (!form.type) e.type = "Requis";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({ ...form });
  }

  function handleDelete() {
    if (window.confirm(`Supprimer « ${form.brand} » ?\n\nCette action est irréversible.`)) {
      onDelete(form.id);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xl p-0 sm:p-4">
      <div className="bg-white/90 backdrop-blur-2xl rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-white/50">
        {/* Header */}
        <div className="bg-white/50 border-b border-white/40 px-5 py-4 flex items-center justify-between shrink-0">
          <div>
            <div className="font-semibold text-base text-[#1d1d1f]">
              {isNew ? "Nouveau véhicule" : `Modifier — ${vehicle.brand}`}
            </div>
            {!isNew && (
              <div className="text-[11px] text-[#86868b] mt-0.5 font-mono">{vehicle.id}</div>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] hover:bg-white/60 transition-all text-lg"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Identification */}
          <FormSection title="Identification">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="ID *" error={errors.id}>
                <input
                  type="text"
                  value={form.id}
                  onChange={(e) => set("id", e.target.value.toUpperCase().replace(/\s+/g, "-"))}
                  placeholder="Ex: TESLA-RAPHAEL"
                  className={inputCls(errors.id)}
                />
              </FormField>
              <FormField label="Type *" error={errors.type}>
                <select
                  value={form.type}
                  onChange={(e) => set("type", e.target.value as VehicleType)}
                  className={inputCls(errors.type)}
                >
                  <option value="VHC Exploit">VHC Exploit</option>
                  <option value="VHC Admin">VHC Admin</option>
                  <option value="Machines">Machines</option>
                </select>
              </FormField>
              <FormField label="Marque / Modèle *" error={errors.brand}>
                <input
                  type="text"
                  value={form.brand}
                  onChange={(e) => set("brand", e.target.value)}
                  placeholder="Ex: IVECO Daily"
                  className={inputCls(errors.brand)}
                />
              </FormField>
              <FormField label="Plaque">
                <input
                  type="text"
                  value={form.plate ?? ""}
                  onChange={(e) => set("plate", e.target.value || null)}
                  placeholder="Ex: VS 336 406"
                  className={inputCls()}
                />
              </FormField>
              <FormField label="Année">
                <input
                  type="number"
                  value={form.year || ""}
                  onChange={(e) => set("year", parseInt(e.target.value) || 0)}
                  placeholder={String(new Date().getFullYear())}
                  className={inputCls()}
                />
              </FormField>
              <FormField label="Société">
                <input
                  type="text"
                  list="vehicle-companies-list"
                  value={form.company}
                  onChange={(e) => set("company", e.target.value)}
                  placeholder="Sélectionner ou saisir"
                  className={inputCls()}
                />
                <datalist id="vehicle-companies-list">
                  {allCompanies.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </FormField>
            </div>
          </FormSection>

          {/* Contrat de leasing */}
          <FormSection title="Contrat de leasing">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Loyer mensuel leasing (CHF)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.leasingMonthly || ""}
                  onChange={(e) => set("leasingMonthly", parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className={inputCls()}
                />
              </FormField>
              <FormField label="N° de contrat">
                <input
                  type="text"
                  value={form.leasingNumber ?? ""}
                  onChange={(e) => set("leasingNumber", e.target.value || null)}
                  placeholder="Ex: 85117-2002 / Raiff"
                  className={inputCls()}
                />
              </FormField>
              <FormField label="Fin de leasing">
                <input
                  type="date"
                  value={form.leasingEnd ?? ""}
                  onChange={(e) => set("leasingEnd", e.target.value || null)}
                  className={inputCls()}
                />
              </FormField>
            </div>
          </FormSection>

          {/* Financier */}
          <FormSection title="Financier">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Prix d'achat (CHF)">
                <input
                  type="number"
                  step="100"
                  min="0"
                  value={form.purchasePrice || ""}
                  onChange={(e) => set("purchasePrice", parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className={inputCls()}
                />
              </FormField>
              <FormField label="Facturé à MBA S (CHF)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.billedToMBAS || ""}
                  onChange={(e) => set("billedToMBAS", parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className={inputCls()}
                />
              </FormField>
              <FormField label="Assurance mensuelle (CHF)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.insuranceMonthly || ""}
                  onChange={(e) => set("insuranceMonthly", parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className={inputCls()}
                />
              </FormField>
              <FormField label="Revente mensuelle (CHF)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.resaleMonthly || ""}
                  onChange={(e) => set("resaleMonthly", parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className={inputCls()}
                />
              </FormField>
            </div>
          </FormSection>

          {/* Refacturation */}
          <FormSection title="Refacturation">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Taux (CHF)">
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={form.refacturingRate || ""}
                  onChange={(e) => set("refacturingRate", parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className={inputCls()}
                />
              </FormField>
              <FormField label="Unité">
                <select
                  value={form.refacturingUnit}
                  onChange={(e) => set("refacturingUnit", e.target.value as RateUnit)}
                  className={inputCls()}
                >
                  <option value="">—</option>
                  <option value="mois">mois</option>
                  <option value="jours">jours</option>
                </select>
              </FormField>
              <FormField label="Refacturé à">
                <input
                  type="text"
                  value={form.refacturingTo}
                  onChange={(e) => set("refacturingTo", e.target.value)}
                  placeholder="Ex: MBA + essence"
                  className={inputCls()}
                />
              </FormField>
            </div>
          </FormSection>

          {/* Entretien */}
          <FormSection title="Entretien">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <FormField label="Dernière expertise">
                <input
                  type="date"
                  value={form.lastExpertise ?? ""}
                  onChange={(e) => set("lastExpertise", e.target.value || null)}
                  className={inputCls()}
                />
              </FormField>
              <FormField label="Dernier service">
                <input
                  type="date"
                  value={form.lastService ?? ""}
                  onChange={(e) => set("lastService", e.target.value || null)}
                  className={inputCls()}
                />
              </FormField>
            </div>
            <FormField label="Notes">
              <textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Remarques, historique d'entretien…"
                rows={3}
                className={`${inputCls()} resize-none`}
              />
            </FormField>
          </FormSection>
        </div>

        {/* Footer */}
        <div
          className={`px-5 py-4 border-t border-gray-100 flex gap-2 shrink-0 ${
            !isNew ? "justify-between" : "justify-end"
          }`}
        >
          {!isNew && (
            <button
              onClick={handleDelete}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
            >
              🗑 Supprimer
            </button>
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-[#1d1d1f] hover:bg-[#333] transition-colors disabled:opacity-50"
            >
              {saving ? "…" : isNew ? "✓ Créer" : "✓ Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Company Vehicle Section ───────────────────────────────────────────────────
function CompanyVehicleSection({
  company,
  companyVehicles,
  isAdmin,
  onEdit,
  onNew,
}: {
  company: string;
  companyVehicles: Vehicle[];
  isAdmin: boolean;
  onEdit: (v: Vehicle) => void;
  onNew: () => void;
}) {
  const totalLeasing = companyVehicles.reduce((s, v) => s + v.leasingMonthly, 0);
  const activeLeasingCount = companyVehicles.filter((v) => v.leasingMonthly > 0).length;
  const expiredCount = companyVehicles.filter(isLeasingExpired).length;
  const soonCount = companyVehicles.filter(isLeasingEndingSoon).length;
  const expertiseAlerts = companyVehicles.filter(needsExpertise).length;

  return (
    <section className="mb-6 rounded-2xl overflow-hidden glass-card">
      {/* Header */}
      <div className="bg-white/40 border-b border-white/40 px-5 py-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            {company !== "Tous les véhicules" && (
              <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">Refacturé à</div>
            )}
            <h2 className="text-sm font-semibold text-[#1d1d1f]">{company}</h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="text-[11px] text-[#86868b]">
                {companyVehicles.length} véhicule{companyVehicles.length > 1 ? "s" : ""}
              </span>
              {activeLeasingCount > 0 && (
                <span className="rounded-full bg-[#0071e3]/10 px-2 py-0.5 text-[11px] text-[#0071e3]">
                  {activeLeasingCount} leasing{activeLeasingCount > 1 ? "s" : ""}
                </span>
              )}
              {expiredCount > 0 && (
                <span className="rounded-full bg-[#ff3b30]/10 px-2 py-0.5 text-[11px] text-[#ff3b30]">
                  ⚠ {expiredCount} expiré{expiredCount > 1 ? "s" : ""}
                </span>
              )}
              {soonCount > 0 && (
                <span className="rounded-full bg-[#ff9f0a]/10 px-2 py-0.5 text-[11px] text-[#bf5f1a]">
                  ⏳ {soonCount} bientôt
                </span>
              )}
              {expertiseAlerts > 0 && (
                <span className="rounded-full bg-[#ff9f0a]/10 px-2 py-0.5 text-[11px] text-[#bf5f1a]">
                  🔧 {expertiseAlerts} expertise
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {totalLeasing > 0 && (
              <div className="text-right">
                <div className="text-[10px] text-[#86868b] uppercase tracking-wide">Leasing/mois</div>
                <div className="text-sm font-bold text-[#0071e3]">{formatCHF(totalLeasing)}</div>
              </div>
            )}
            {isAdmin && (
              <button
                onClick={onNew}
                className="flex items-center gap-1.5 bg-[#1d1d1f] hover:bg-[#333] text-white rounded-xl px-3 py-1.5 text-xs font-medium transition-colors"
              >
                + Ajouter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y-2 divide-[#1d1d1f]/8">
        {companyVehicles.map((v) => (
          <div key={v.id} className="px-4 py-3.5">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-gray-900 leading-snug">{v.brand}</div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[11px] text-gray-400 font-mono">{v.id}</span>
                  {v.plate && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-mono text-gray-600">
                      {v.plate}
                    </span>
                  )}
                  {v.year > 0 && (
                    <span className="text-[11px] text-gray-400">{v.year}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <LeasingBadge v={v} />
                {isAdmin && (
                  <button
                    onClick={() => onEdit(v)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-amber-100 hover:text-amber-700 transition-colors"
                    title="Modifier"
                  >
                    ✏
                  </button>
                )}
              </div>
            </div>
            {v.leasingMonthly > 0 && (
              <div className="flex items-center gap-3 mt-1">
                <div>
                  <span className="text-[11px] text-gray-400">Leasing: </span>
                  <span className="text-xs font-bold text-blue-700">{formatCHF(v.leasingMonthly)}/mois</span>
                </div>
                {v.leasingEnd && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      isLeasingExpired(v)
                        ? "bg-red-100 text-red-600"
                        : isLeasingEndingSoon(v)
                        ? "bg-amber-100 text-amber-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    fin {formatDate(v.leasingEnd)}
                  </span>
                )}
              </div>
            )}
            {v.refacturingRate > 0 && (
              <div className="mt-1 text-[11px] text-gray-500">
                Refact:{" "}
                <span className="font-semibold text-gray-700">
                  {v.refacturingRate} CHF/{v.refacturingUnit}
                </span>
                {v.refacturingTo && <span className="ml-1 text-gray-400">→ {v.refacturingTo}</span>}
              </div>
            )}
            {v.notes && (
              <div className="mt-1 text-[11px] text-gray-400 italic">{v.notes}</div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="bg-stone-50 border-b border-gray-200 text-[11px] text-gray-400 uppercase tracking-wide">
              {isAdmin && <th className="w-8 px-2 py-3" />}
              <th className="px-3 py-3 text-left font-semibold">ID</th>
              <th className="px-3 py-3 text-left font-semibold">Véhicule</th>
              <th className="px-3 py-3 text-left font-semibold">Plaque</th>
              <th className="px-3 py-3 text-center font-semibold">Année</th>
              <th className="px-3 py-3 text-center font-semibold">Statut leasing</th>
              <th className="px-3 py-3 text-right font-semibold">Fin leasing</th>
              <th className="px-3 py-3 text-right font-semibold">Assurance/mois</th>
              <th className="px-3 py-3 text-right font-semibold">Refacturation</th>
            </tr>
          </thead>
          <tbody>
            {companyVehicles.map((v, i) => (
              <tr
                key={v.id}
                className={`border-b-2 border-[#1d1d1f]/8 text-sm transition-all ${
                  i % 2 === 0 ? "bg-white" : "bg-stone-50"
                }`}
              >
                {isAdmin && (
                  <td className="px-2 py-3 w-8">
                    <button
                      onClick={() => onEdit(v)}
                      title="Modifier"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-amber-100 hover:text-amber-700 transition-colors"
                    >
                      ✏
                    </button>
                  </td>
                )}
                <td className="px-3 py-3 font-mono text-[11px] text-gray-400 whitespace-nowrap">{v.id}</td>
                <td className="px-3 py-3">
                  <div className="font-semibold text-gray-900 leading-snug">{v.brand}</div>
                  {v.notes && (
                    <div className="text-[11px] text-gray-400 mt-0.5 italic">{v.notes}</div>
                  )}
                </td>
                <td className="px-3 py-3">
                  {v.plate ? (
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-mono text-gray-600">
                      {v.plate}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center text-sm text-gray-600">
                  {v.year > 0 ? v.year : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-3 text-center">
                  <LeasingBadge v={v} />
                  {v.leasingMonthly > 0 && (
                    <div className="text-[11px] text-blue-600 font-mono mt-0.5">
                      {formatCHF(v.leasingMonthly)}/mois
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 text-right text-[11px]">
                  {v.leasingEnd ? (
                    <span
                      className={`font-semibold ${
                        isLeasingExpired(v)
                          ? "text-red-600"
                          : isLeasingEndingSoon(v)
                          ? "text-amber-600"
                          : "text-gray-600"
                      }`}
                    >
                      {formatDate(v.leasingEnd)}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-right font-mono text-[11px] text-gray-600">
                  {v.insuranceMonthly > 0 ? formatCHF(v.insuranceMonthly) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-3 text-right text-[11px]">
                  {v.refacturingRate > 0 ? (
                    <div>
                      <span className="font-semibold text-gray-900">
                        {v.refacturingRate} CHF/{v.refacturingUnit}
                      </span>
                      {v.refacturingTo && (
                        <div className="text-[10px] text-gray-400 mt-0.5">{v.refacturingTo}</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              </tr>
            ))}
            {/* Subtotal row */}
            {totalLeasing > 0 && (
              <tr className="bg-white/40 text-[#1d1d1f] text-sm font-semibold border-t border-white/40">
                <td colSpan={isAdmin ? 5 : 4} className="px-3 py-3">
                  Sous-total — {companyVehicles.length} véhicule{companyVehicles.length > 1 ? "s" : ""}
                </td>
                <td className="px-3 py-3 text-center text-[#0071e3] font-mono">
                  {formatCHF(totalLeasing)}/mois
                </td>
                <td colSpan={3} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function VehiclesDashboard() {
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isNewForm, setIsNewForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Vehicle | null>(null);

  const [simMonth, setSimMonth] = useState<string>(() => {
    const d = TODAY_VHC;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [activeType, setActiveType] = useState<VehicleType | null>(null);
  const [leasingOnly, setLeasingOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"default" | "leasingEnd" | "expertise" | "year" | "refact">("default");
  const [sortAsc, setSortAsc] = useState(true);
  const [search, setSearch] = useState("");
  const [simOpen, setSimOpen] = useState(false);

  const fetchVehicles = useCallback(async () => {
    setLoadingData(true);
    const res = await fetch("/api/vehicles");
    if (!res.ok) { setLoadingData(false); return; }
    setAllVehicles(await res.json());
    setLoadingData(false);
  }, []);

  useEffect(() => {
    fetchVehicles();
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single()
        .then(({ data }) => setIsAdmin(data?.role === "admin"));
    });
  }, [fetchVehicles]);

  // Filtered + sorted vehicles
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = allVehicles.filter((v) => {
      if (activeType && v.type !== activeType) return false;
      if (leasingOnly && v.leasingMonthly <= 0) return false;
      if (q) {
        const hay = [v.brand, v.plate, v.id, v.company, v.refacturingTo, v.notes]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortBy === "default") return list;

    return [...list].sort((a, b) => {
      let valA: number;
      let valB: number;
      if (sortBy === "leasingEnd") {
        valA = a.leasingEnd ? new Date(a.leasingEnd).getTime() : Infinity;
        valB = b.leasingEnd ? new Date(b.leasingEnd).getTime() : Infinity;
      } else if (sortBy === "expertise") {
        valA = a.lastExpertise ? new Date(a.lastExpertise).getTime() : 0;
        valB = b.lastExpertise ? new Date(b.lastExpertise).getTime() : 0;
      } else if (sortBy === "refact") {
        return sortAsc
          ? (a.refacturingTo || "").localeCompare(b.refacturingTo || "")
          : (b.refacturingTo || "").localeCompare(a.refacturingTo || "");
      } else {
        // year
        valA = a.year;
        valB = b.year;
      }
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [allVehicles, activeType, leasingOnly, sortBy, sortAsc, search]);

  // KPIs
  const totalCount = allVehicles.length;
  const totalLeasing = allVehicles.reduce((s, v) => s + v.leasingMonthly, 0);
  const activeLeasingCount = allVehicles.filter((v) => v.leasingMonthly > 0).length;
  const alertCount =
    allVehicles.filter(isLeasingExpired).length +
    allVehicles.filter(isLeasingEndingSoon).length;

  const leasingAt = (year: number) =>
    allVehicles
      .filter(
        (v) =>
          v.leasingMonthly > 0 &&
          v.leasingEnd &&
          new Date(v.leasingEnd) > new Date(`${year}-12-31`)
      )
      .reduce((s, v) => s + v.leasingMonthly, 0);

  // Simulation : véhicules encore en leasing au mois sélectionné
  const simActive = useMemo(() => {
    if (!simMonth) return [];
    return allVehicles.filter(
      (v) => v.leasingMonthly > 0 && v.leasingEnd && v.leasingEnd >= `${simMonth}-01`
    );
  }, [allVehicles, simMonth]);
  const simTotal = simActive.reduce((s, v) => s + v.leasingMonthly, 0);

  function openNew() {
    setEditTarget(emptyVehicle());
    setIsNewForm(true);
    setFormOpen(true);
  }

  function openEdit(v: Vehicle) {
    setEditTarget(v);
    setIsNewForm(false);
    setFormOpen(true);
  }

  async function handleSave(v: Vehicle) {
    setSaving(true);
    if (isNewForm) {
      const res = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      setSaving(false);
      if (!res.ok) { alert("Erreur lors de l'enregistrement."); return; }
    } else {
      const originalId = editTarget!.id;
      const idChanged = v.id !== originalId;
      if (idChanged) {
        // Delete old record then insert new one with new ID
        const [delRes, postRes] = await Promise.all([
          fetch(`/api/vehicles/${originalId}`, { method: "DELETE" }),
          fetch("/api/vehicles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(v),
          }),
        ]);
        setSaving(false);
        if (!delRes.ok || !postRes.ok) { alert("Erreur lors du changement d'ID."); return; }
      } else {
        const res = await fetch(`/api/vehicles/${v.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(v),
        });
        setSaving(false);
        if (!res.ok) { alert("Erreur lors de l'enregistrement."); return; }
      }
    }
    setFormOpen(false);
    fetchVehicles();
  }

  async function handleDelete(id: string) {
    setSaving(true);
    const res = await fetch(`/api/vehicles/${id}`, { method: "DELETE" });
    setSaving(false);
    if (!res.ok) { alert("Erreur lors de la suppression."); return; }
    setFormOpen(false);
    fetchVehicles();
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
            <Link
              href="/"
              className="flex items-center gap-1.5 text-[#86868b] hover:text-[#1d1d1f] transition-all shrink-0 border border-white/40 rounded-xl px-2.5 py-1.5 hover:bg-white/40"
            >
              <span className="text-sm">←</span>
              <span className="text-xs font-medium hidden sm:inline">Accueil</span>
            </Link>
            <div className="relative w-7 h-7 shrink-0">
              <Image src="/logo.png" alt="MBA" fill className="object-contain" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#1d1d1f] leading-tight">Véhicules &amp; Machines</div>
              <div className="text-[11px] text-[#86868b] hidden sm:block">
                {TODAY_VHC.toLocaleDateString("fr-CH", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <button
                onClick={openNew}
                className="flex items-center gap-1.5 bg-[#1d1d1f] hover:bg-[#333] text-white rounded-xl px-3 py-2 text-xs font-medium transition-colors"
              >
                + <span className="hidden sm:inline">Nouveau véhicule</span>
              </button>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs font-medium text-[#86868b] bg-white/30 hover:bg-white/50 hover:text-[#ff3b30] border border-white/30 rounded-xl px-3 py-2 transition-all"
            >
              <span>⎋</span>
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 md:px-6 py-5 pb-8">
        {loadingData ? (
          <div className="py-20 text-center text-sm text-gray-400">Chargement des données…</div>
        ) : (
          <>
            {/* KPIs */}
            <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard
                label="Total véhicules"
                value={`${totalCount}`}
                sub={`${activeLeasingCount} en leasing`}
                icon="🚗"
              />
              <KpiCard
                label="Leasing mensuel actuel"
                value={formatCHF(totalLeasing)}
                sub={alertCount > 0 ? `⚠ ${alertCount} expirant bientôt` : "Aucune alerte"}
                icon="💳"
                blue={alertCount === 0}
                amber={alertCount > 0}
              />
              {[2026, 2027].map((year) => {
                const count = allVehicles.filter(
                  (v) =>
                    v.leasingMonthly > 0 &&
                    v.leasingEnd &&
                    new Date(v.leasingEnd) > new Date(`${year}-12-31`)
                ).length;
                return (
                  <KpiCard
                    key={year}
                    label={`Leasing fin ${year}`}
                    value={formatCHF(leasingAt(year))}
                    sub={`${count} contrat${count > 1 ? "s" : ""} restant${count > 1 ? "s" : ""}`}
                    icon="📅"
                  />
                );
              })}
            </div>

            {/* Simulation leasing */}
            {(() => {
              const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
              const simYear = parseInt(simMonth.split("-")[0]);
              const simM = parseInt(simMonth.split("-")[1]);
              const setYM = (y: number, m: number) => setSimMonth(`${y}-${String(m).padStart(2, "0")}`);
              return (
                <div className="mb-6 glass-card rounded-2xl overflow-hidden">
                  {/* Header compact */}
                  <div className="px-4 py-3 flex items-center gap-3">
                    <span className="text-sm font-semibold text-[#1d1d1f] shrink-0">Simulation</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setYM(simYear - 1, simM)} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#86868b] hover:bg-white/50 transition-all text-xs">◀</button>
                      <span className="text-sm font-semibold text-[#1d1d1f] w-10 text-center">{simYear}</span>
                      <button onClick={() => setYM(simYear + 1, simM)} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#86868b] hover:bg-white/50 transition-all text-xs">▶</button>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-[10px] text-[#86868b] uppercase tracking-wide">{simActive.length} contrat{simActive.length > 1 ? "s" : ""}</div>
                        <div className="text-base font-bold text-[#0071e3]">{formatCHF(simTotal)}/mois</div>
                      </div>
                      <button onClick={() => setSimOpen((v) => !v)} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#86868b] hover:bg-white/50 transition-all">
                        <span className={`text-xs transition-transform ${simOpen ? "rotate-180" : ""}`}>▼</span>
                      </button>
                    </div>
                  </div>
                  {/* Month pills */}
                  <div className="px-4 pb-3 flex gap-1 flex-wrap">
                    {MOIS.map((label, i) => {
                      const m = i + 1;
                      const active = m === simM;
                      return (
                        <button
                          key={m}
                          onClick={() => setYM(simYear, m)}
                          className={`rounded-lg px-2 py-1 text-[11px] font-medium transition-all ${
                            active
                              ? "bg-[#0071e3] text-white"
                              : "bg-white/40 text-[#86868b] hover:bg-white/70 hover:text-[#1d1d1f]"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  {/* Expandable list */}
                  {simOpen && (
                    <div className="border-t border-white/30">
                      {simActive.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-[#86868b]">Aucun leasing actif ce mois-là.</div>
                      ) : (
                        <div className="divide-y divide-white/20">
                          {simActive.map((v) => (
                            <div key={v.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <span className="text-sm font-medium text-[#1d1d1f]">{v.brand}</span>
                                {v.plate && (
                                  <span className="ml-2 rounded-lg bg-[#0071e3]/8 px-1.5 py-0.5 text-[11px] font-mono text-[#0071e3]">{v.plate}</span>
                                )}
                                {v.leasingEnd && (
                                  <span className="ml-2 text-[11px] text-[#86868b]">fin {formatDate(v.leasingEnd)}</span>
                                )}
                              </div>
                              <span className="font-mono text-sm font-semibold text-[#0071e3] shrink-0">{formatCHF(v.leasingMonthly)}/mois</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {isAdmin && (
              <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-[11px] text-amber-700 flex items-start gap-2">
                <span>💡</span>
                <span className="md:hidden">Appuyez ✏ sur une ligne pour modifier un véhicule.</span>
                <span className="hidden md:inline">Cliquez ✏ pour modifier un véhicule · + Ajouter dans une section ou + Nouveau véhicule en haut.</span>
              </div>
            )}

            {/* Search */}
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par marque, plaque, ID, société…"
                className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-sm"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filters — Row 1: Type + Leasing */}
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
              <FilterBtn
                label="Tous les types"
                active={activeType === null}
                onClick={() => setActiveType(null)}
              />
              {(["VHC Exploit", "VHC Admin", "Machines"] as VehicleType[]).map((t) => (
                <FilterBtn
                  key={t}
                  label={t}
                  active={activeType === t}
                  onClick={() => setActiveType(activeType === t ? null : t)}
                />
              ))}
              <div className="w-px bg-gray-200 shrink-0 mx-1" />
              <button
                onClick={() => setLeasingOnly((v) => !v)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors border shrink-0 ${
                  leasingOnly
                    ? "bg-blue-600 text-white border-blue-600 font-bold"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-400 shadow-sm"
                }`}
              >
                💳 Avec leasing
              </button>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide shrink-0">Trier par :</span>
              {(
                [
                  { key: "default", label: "Par défaut" },
                  { key: "leasingEnd", label: "Fin de leasing" },
                  { key: "expertise", label: "Dernière expertise" },
                  { key: "year", label: "Année" },
                  { key: "refact", label: "Refacturation" },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => {
                    if (sortBy === key) setSortAsc((v) => !v);
                    else {
                      setSortBy(key);
                      setSortAsc(true);
                    }
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all border shrink-0 ${
                    sortBy === key
                      ? "bg-[#1d1d1f] text-white border-[#1d1d1f]"
                      : "bg-white/60 border-white/40 text-[#86868b] hover:bg-white/80 hover:text-[#1d1d1f]"
                  }`}
                >
                  {label}
                  {sortBy === key ? (sortAsc ? " ↑" : " ↓") : ""}
                </button>
              ))}
            </div>

            {/* Result count */}
            <div className="mb-3 flex items-baseline gap-2">
              <h2 className="text-base font-bold text-gray-900">Flotte MBA Groupe SA</h2>
              <span className="text-xs text-gray-400">
                {filtered.length} véhicule{filtered.length !== 1 ? "s" : ""} affiché
                {filtered.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Vehicles */}
            {filtered.length > 0 ? (
              <CompanyVehicleSection
                company="Tous les véhicules"
                companyVehicles={filtered}
                isAdmin={isAdmin}
                onEdit={openEdit}
                onNew={openNew}
              />
            ) : (
              <div className="rounded-2xl bg-white border border-gray-200 p-10 text-center text-sm text-gray-400 shadow-sm">
                Aucun véhicule ne correspond aux filtres sélectionnés.
              </div>
            )}

            <div className="mt-4 pb-2 text-center text-[11px] text-gray-400">
              MBA Groupe SA · Données au{" "}
              {TODAY_VHC.toLocaleDateString("fr-CH")}
            </div>
          </>
        )}
      </main>

      {/* Form modal */}
      {formOpen && editTarget && (
        <VehicleForm
          vehicle={editTarget}
          isNew={isNewForm}
          allVehicles={allVehicles}
          saving={saving}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setFormOpen(false)}
        />
      )}
    </div>
  );
}
