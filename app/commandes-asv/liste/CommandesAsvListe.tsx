"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import {
  type Commande,
  formatCHF,
  formatDate,
  DEVIS_MAX_BYTES,
} from "../../commandes/data";
import { createClient } from "../../lib/supabase/client";
import NavButton from "../../components/NavButton";

// ── Helpers ───────────────────────────────────────────────────────────────────
function inputCls(err?: string) {
  return `w-full px-3 py-2.5 rounded-xl border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 ${err ? "border-red-300" : "border-gray-200"}`;
}

function FormField({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
      {children}
      {hint && !error && <div className="text-[11px] text-gray-400 mt-1">{hint}</div>}
      {error && <div className="text-[11px] text-red-500 mt-1">⚠ {error}</div>}
    </div>
  );
}

function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium border backdrop-blur-xl ${
        type === "success"
          ? "bg-green-50/90 border-green-200 text-green-800"
          : "bg-red-50/90 border-red-200 text-red-800"
      }`}
    >
      {message}
    </div>
  );
}

// ── Edit / detail modal ───────────────────────────────────────────────────────
function CommandeDetail({
  commande,
  saving,
  chantierOptions,
  fournisseurOptions,
  onSave,
  onDelete,
  onClose,
  onDownloadDevis,
}: {
  commande: Commande;
  saving: boolean;
  chantierOptions: { id: string; name: string; location: string | null }[];
  fournisseurOptions: string[];
  onSave: (c: Commande, devisFile: File | null, removeDevis: boolean) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onDownloadDevis: (c: Commande) => void;
}) {
  const [form, setForm] = useState<Commande>(() => ({ ...commande }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [devisFile, setDevisFile] = useState<File | null>(null);
  const [removeDevis, setRemoveDevis] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof Commande>(field: K, value: Commande[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((e) => {
      const n = { ...e };
      delete n[field as string];
      return n;
    });
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setErrors((er) => {
      const n = { ...er };
      delete n.devis;
      return n;
    });
    if (f && f.size > DEVIS_MAX_BYTES) {
      setErrors((er) => ({ ...er, devis: "Fichier trop volumineux (max 10 Mo)" }));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setDevisFile(f);
    if (f) setRemoveDevis(false);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.orderDate) e.orderDate = "Requis";
    if (!form.chantier.trim()) e.chantier = "Requis";
    if (!form.fournisseur.trim()) e.fournisseur = "Requis";
    if (!form.description.trim()) e.description = "Requis";
    else if (form.description.length > 200) e.description = "Max 200 caractères";
    if (!form.amount || form.amount <= 0) e.amount = "Montant requis";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({ ...form }, devisFile, removeDevis);
  }

  function handleDelete() {
    if (window.confirm("Supprimer cette commande ?\n\nCette action est irréversible.")) {
      onDelete(form.id);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xl p-0 sm:p-4">
      <div className="bg-white/95 backdrop-blur-2xl rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-white/50">
        {/* Header */}
        <div className="bg-white/60 border-b border-white/40 px-5 py-4 flex items-center justify-between shrink-0">
          <div>
            <div className="font-semibold text-base text-[#1d1d1f]">Modifier commande</div>
            <div className="text-[11px] text-[#86868b] mt-0.5 font-mono">{commande.id}</div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] hover:bg-white/60 transition-all text-lg"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <FormField label="Date de la commande *" error={errors.orderDate}>
            <input
              type="date"
              value={form.orderDate}
              onChange={(e) => set("orderDate", e.target.value)}
              className={inputCls(errors.orderDate)}
            />
          </FormField>

          <FormField label="Chantier *" error={errors.chantier}>
            <select
              value={form.chantier}
              onChange={(e) => set("chantier", e.target.value)}
              className={inputCls(errors.chantier)}
            >
              <option value="">Sélectionner un chantier…</option>
              {/* Conserve la valeur historique si le chantier n'est plus dans la liste active */}
              {form.chantier && !chantierOptions.some((c) => c.name === form.chantier) && (
                <option value={form.chantier}>{form.chantier} (archivé)</option>
              )}
              {chantierOptions.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                  {c.location ? ` — ${c.location}` : ""}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Fournisseur *" error={errors.fournisseur}>
            <input
              type="text"
              list="fournisseurs-edit-list"
              value={form.fournisseur}
              onChange={(e) => set("fournisseur", e.target.value)}
              autoComplete="off"
              className={inputCls(errors.fournisseur)}
            />
            <datalist id="fournisseurs-edit-list">
              {fournisseurOptions.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </FormField>

          <FormField
            label="Description *"
            error={errors.description}
            hint={`${form.description.length}/200 caractères`}
          >
            <input
              type="text"
              maxLength={200}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className={inputCls(errors.description)}
            />
          </FormField>

          <FormField label="Montant estimé (CHF, TTC) *" error={errors.amount}>
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={form.amount || ""}
              onChange={(e) => set("amount", parseFloat(e.target.value) || 0)}
              className={inputCls(errors.amount)}
            />
          </FormField>

          <FormField label="Délai de livraison prévu">
            <input
              type="date"
              value={form.deliveryDate ?? ""}
              onChange={(e) => set("deliveryDate", e.target.value || null)}
              className={inputCls()}
            />
          </FormField>

          <FormField label="Devis joint" error={errors.devis} hint="PDF, JPG, PNG, etc. — max 10 Mo">
            {form.devisPath && !removeDevis && !devisFile && (
              <div className="flex items-center justify-between bg-stone-50 rounded-lg px-3 py-2 mb-2">
                <button
                  type="button"
                  onClick={() => onDownloadDevis(form)}
                  className="text-xs text-blue-600 hover:underline truncate text-left"
                >
                  📎 {form.devisName ?? "devis"}
                </button>
                <button
                  type="button"
                  onClick={() => setRemoveDevis(true)}
                  className="text-xs text-red-500 hover:underline ml-2 shrink-0"
                >
                  Retirer
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
              onChange={handleFile}
              className="block w-full text-xs text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
            />
            {devisFile && (
              <div className="text-[11px] text-gray-500 mt-1 truncate">
                📎 Nouveau : {devisFile.name}
              </div>
            )}
          </FormField>

          <FormField label="Commentaire">
            <textarea
              rows={3}
              value={form.comment}
              onChange={(e) => set("comment", e.target.value)}
              className={inputCls()}
            />
          </FormField>
        </div>

        {/* Footer */}
        <div className="border-t border-white/40 bg-white/60 px-5 py-4 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={handleDelete}
            disabled={saving}
            className="text-xs text-red-500 hover:text-red-700 font-medium px-3 py-2 rounded-lg hover:bg-red-50 disabled:opacity-50"
          >
            Supprimer
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-sm text-gray-500 px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#1d1d1f] text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-[#333] disabled:opacity-50"
            >
              {saving ? "Enregistrement…" : "Mettre à jour"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
type SortKey = "orderDate" | "amount" | "fournisseur" | "chantier";
type SortDir = "asc" | "desc";

export default function CommandesAsvListe() {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string>("");

  // Filters
  const [filterChantier, setFilterChantier] = useState("");
  const [filterFournisseur, setFilterFournisseur] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("orderDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Detail modal
  const [editing, setEditing] = useState<Commande | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Listes pour le formulaire d'édition (chantiers actifs + fournisseurs déjà saisis)
  const [chantierOptions, setChantierOptions] = useState<{ id: string; name: string; location: string | null }[]>([]);
  const [fournisseurOptions, setFournisseurOptions] = useState<string[]>([]);

  const showToast = useCallback((msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      // Vérifie que le user est admin via /api/admin/users (403 sinon)
      const adminRes = await fetch("/api/admin/users");
      if (!adminRes.ok) {
        setAccessError("Cette page est réservée aux administrateurs.");
        setLoading(false);
        return;
      }
      const [res, cRes, fRes] = await Promise.all([
        fetch("/api/commandes?company=ASV+Fen%C3%AAtres+et+Portes+SA"),
        fetch("/api/commandes/chantiers"),
        fetch("/api/commandes/fournisseurs"),
      ]);
      if (!res.ok) {
        setAccessError("Erreur de chargement des commandes.");
        setLoading(false);
        return;
      }
      setCommandes(await res.json());
      if (cRes.ok) setChantierOptions(await cRes.json());
      if (fRes.ok) setFournisseurOptions(await fRes.json());
    } catch {
      setAccessError("Erreur de chargement.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const fournisseurs = useMemo(
    () => Array.from(new Set(commandes.map((c) => c.fournisseur).filter(Boolean))).sort(),
    [commandes]
  );
  const chantiers = useMemo(
    () => Array.from(new Set(commandes.map((c) => c.chantier).filter(Boolean))).sort(),
    [commandes]
  );

  const filtered = useMemo(() => {
    const list = commandes.filter((c) => {
      if (filterChantier && c.chantier !== filterChantier) return false;
      if (filterFournisseur && c.fournisseur !== filterFournisseur) return false;
      if (filterFrom && c.orderDate < filterFrom) return false;
      if (filterTo && c.orderDate > filterTo) return false;
      return true;
    });
    list.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sortKey) {
        case "orderDate": av = a.orderDate; bv = b.orderDate; break;
        case "amount": av = a.amount; bv = b.amount; break;
        case "fournisseur": av = a.fournisseur.toLowerCase(); bv = b.fournisseur.toLowerCase(); break;
        case "chantier": av = a.chantier.toLowerCase(); bv = b.chantier.toLowerCase(); break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [commandes, filterChantier, filterFournisseur, filterFrom, filterTo, sortKey, sortDir]);

  const totalAmount = useMemo(() => filtered.reduce((s, c) => s + c.amount, 0), [filtered]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir(k === "orderDate" || k === "amount" ? "desc" : "asc");
    }
  }

  function sortIcon(k: SortKey) {
    if (sortKey !== k) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  function resetFilters() {
    setFilterChantier("");
    setFilterFournisseur("");
    setFilterFrom("");
    setFilterTo("");
  }

  async function downloadDevis(c: Commande) {
    if (!c.devisPath) return;
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from("commandes-devis")
      .createSignedUrl(c.devisPath, 60);
    if (error || !data) {
      showToast("Téléchargement impossible", "error");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function uploadDevis(commandeId: string, file: File): Promise<{ path: string; name: string }> {
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${commandeId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("commandes-devis").upload(path, file, {
      upsert: true,
      contentType: file.type || undefined,
    });
    if (error) throw new Error(error.message);
    return { path, name: file.name };
  }

  async function deleteDevisStorage(path: string) {
    const supabase = createClient();
    await supabase.storage.from("commandes-devis").remove([path]);
  }

  async function handleSave(c: Commande, devisFile: File | null, removeDevis: boolean) {
    setSaving(true);
    try {
      const toSave = { ...c };
      if (removeDevis && c.devisPath) {
        await deleteDevisStorage(c.devisPath);
        toSave.devisPath = null;
        toSave.devisName = null;
      }
      if (devisFile) {
        if (c.devisPath && !removeDevis) await deleteDevisStorage(c.devisPath);
        const { path, name } = await uploadDevis(c.id, devisFile);
        toSave.devisPath = path;
        toSave.devisName = name;
      }
      const res = await fetch(`/api/commandes/${c.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSave),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Erreur" }));
        throw new Error(error || "Mise à jour impossible");
      }
      showToast("Commande mise à jour", "success");
      setEditing(null);
      await loadAll();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erreur", "error");
    }
    setSaving(false);
  }

  async function quickValidate(c: Commande, e: React.MouseEvent) {
    e.stopPropagation();
    if (
      !window.confirm(
        `Valider cette commande ?\n\n${c.fournisseur} — ${formatCHF(c.amount)}\n${c.description}\n\nElle sera retirée de la liste.`
      )
    )
      return;
    setSaving(true);
    try {
      const res = await fetch(`/api/commandes/${c.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Suppression impossible");
      showToast("Commande validée ✓", "success");
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erreur", "error");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/commandes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Suppression impossible");
      showToast("Commande supprimée", "success");
      setEditing(null);
      await loadAll();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erreur", "error");
    }
    setSaving(false);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-warm flex items-center justify-center">
        <div className="text-sm text-gray-400">Chargement…</div>
      </div>
    );
  }

  if (accessError) {
    return (
      <div className="min-h-screen bg-warm flex items-center justify-center px-6">
        <div className="glass-card rounded-2xl p-8 text-center max-w-sm">
          <div className="text-3xl mb-3">🔒</div>
          <div className="text-base font-semibold text-[#1d1d1f] mb-2">Accès refusé</div>
          <div className="text-sm text-[#86868b] mb-5">{accessError}</div>
          <Link href="/" className="inline-block text-xs font-medium text-[#0071e3] hover:underline">
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm">
      <header className="glass sticky top-0 z-20 border-b border-white/30">
        <div className="max-w-6xl mx-auto px-3 sm:px-5 py-2 sm:py-3 flex items-center justify-between gap-2">
          <NavButton href="/commandes-asv" label="Retour" />
          <div className="text-sm font-semibold text-[#1d1d1f] truncate text-center flex-1">
            <span className="sm:hidden">Commandes ASV</span>
            <span className="hidden sm:inline">Commandes — ASV Fenêtres et Portes SA</span>
          </div>
          <div className="w-[44px]" aria-hidden />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-6 sm:py-8">
        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <div className="glass-card rounded-2xl p-4">
            <div className="text-[11px] text-[#86868b] uppercase tracking-wide">Commandes</div>
            <div className="text-xl font-bold text-[#1d1d1f] mt-1">{filtered.length}</div>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <div className="text-[11px] text-[#86868b] uppercase tracking-wide">Montant total</div>
            <div className="text-xl font-bold text-[#bf5f1a] mt-1">{formatCHF(totalAmount)}</div>
          </div>
          <div className="glass-card rounded-2xl p-4 col-span-2 sm:col-span-1">
            <div className="text-[11px] text-[#86868b] uppercase tracking-wide">Fournisseurs</div>
            <div className="text-xl font-bold text-[#1d1d1f] mt-1">{fournisseurs.length}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="glass-card rounded-2xl p-4 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Chantier</label>
              <select
                value={filterChantier}
                onChange={(e) => setFilterChantier(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
              >
                <option value="">Tous</option>
                {chantiers.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Fournisseur</label>
              <select
                value={filterFournisseur}
                onChange={(e) => setFilterFournisseur(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
              >
                <option value="">Tous</option>
                {fournisseurs.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Du</label>
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Au</label>
              <input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
              />
            </div>
          </div>
          {(filterChantier || filterFournisseur || filterFrom || filterTo) && (
            <button
              onClick={resetFilters}
              className="mt-3 text-[11px] text-[#0071e3] hover:underline font-medium"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>

        {/* Liste */}
        {filtered.length === 0 ? (
          <div className="glass-card rounded-2xl p-10 text-center text-sm text-gray-400">
            Aucune commande à afficher.
          </div>
        ) : (
          <div className="glass-card rounded-2xl overflow-hidden">
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/50 border-b border-white/40">
                  <tr className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    <th
                      className="px-4 py-3 cursor-pointer hover:text-[#1d1d1f]"
                      onClick={() => toggleSort("orderDate")}
                    >
                      Date{sortIcon("orderDate")}
                    </th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:text-[#1d1d1f]"
                      onClick={() => toggleSort("chantier")}
                    >
                      Chantier{sortIcon("chantier")}
                    </th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:text-[#1d1d1f]"
                      onClick={() => toggleSort("fournisseur")}
                    >
                      Fournisseur{sortIcon("fournisseur")}
                    </th>
                    <th className="px-4 py-3">Description</th>
                    <th
                      className="px-4 py-3 text-right cursor-pointer hover:text-[#1d1d1f]"
                      onClick={() => toggleSort("amount")}
                    >
                      Montant{sortIcon("amount")}
                    </th>
                    <th className="px-4 py-3 text-center">Devis</th>
                    <th className="px-4 py-3 text-right">Action</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-white/40 transition-colors">
                      <td className="px-4 py-3 text-xs text-[#86868b] font-mono whitespace-nowrap">
                        {formatDate(c.orderDate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#1d1d1f] truncate max-w-[160px]">
                        {c.chantier}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-[#1d1d1f] truncate max-w-[180px]">
                        {c.fournisseur}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-[260px]">
                        {c.description}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-[#bf5f1a] text-right whitespace-nowrap">
                        {formatCHF(c.amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.devisPath ? (
                          <button
                            onClick={() => downloadDevis(c)}
                            className="text-[10px] bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full hover:bg-blue-100"
                            title={c.devisName ?? "Devis"}
                          >
                            📎 PDF
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => quickValidate(c, e)}
                          disabled={saving}
                          className="text-xs font-semibold bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100 active:bg-green-200 disabled:opacity-50 whitespace-nowrap"
                          title="Valider et retirer de la liste"
                        >
                          ✓ Valider
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setEditing(c)}
                          className="text-xs text-[#0071e3] hover:underline font-medium"
                        >
                          Ouvrir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {filtered.map((c) => (
                <div key={c.id} className="px-4 py-3 hover:bg-white/40 flex gap-3">
                  <div
                    onClick={() => setEditing(c)}
                    className="flex-1 min-w-0 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="text-xs font-mono text-[#86868b] whitespace-nowrap shrink-0">{formatDate(c.orderDate)}</div>
                      <div className="text-sm font-semibold text-[#bf5f1a] whitespace-nowrap shrink-0">{formatCHF(c.amount)}</div>
                    </div>
                    <div className="text-sm font-semibold text-[#1d1d1f] truncate">{c.fournisseur}</div>
                    <div className="text-xs text-gray-500 truncate">{c.chantier} · {c.description}</div>
                    {c.devisPath && (
                      <button
                        onClick={(e) => { e.stopPropagation(); downloadDevis(c); }}
                        className="mt-1 text-[10px] bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full hover:bg-blue-100"
                      >
                        📎 Devis
                      </button>
                    )}
                  </div>
                  <button
                    onClick={(e) => quickValidate(c, e)}
                    disabled={saving}
                    className="self-center shrink-0 text-sm font-semibold bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg hover:bg-green-100 active:bg-green-200 disabled:opacity-50"
                    title="Valider et retirer"
                  >
                    ✓
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {editing && (
        <CommandeDetail
          commande={editing}
          saving={saving}
          chantierOptions={chantierOptions}
          fournisseurOptions={fournisseurOptions}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
          onDownloadDevis={downloadDevis}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} />}
    </div>
  );
}
