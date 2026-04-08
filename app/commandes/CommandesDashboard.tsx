"use client";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  type Commande,
  COMMANDE_COMPANY,
  emptyCommande,
  formatCHF,
  formatDate,
  DEVIS_MAX_BYTES,
} from "./data";
import { createClient } from "../lib/supabase/client";

interface Permissions { view: boolean; create: boolean; edit: boolean }

// ── Form helpers ──────────────────────────────────────────────────────────────
function inputCls(err?: string) {
  return `w-full px-3 py-2.5 rounded-xl border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 ${err ? "border-red-300" : "border-gray-200"}`;
}

function FormField({ label, error, children, hint }: { label: string; error?: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
      {children}
      {hint && !error && <div className="text-[11px] text-gray-400 mt-1">{hint}</div>}
      {error && <div className="text-[11px] text-red-500 mt-1">⚠ {error}</div>}
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
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

// ── Commande Form (modal/inline) ──────────────────────────────────────────────
function CommandeForm({
  commande,
  isNew,
  saving,
  fournisseurs,
  chantiers,
  canEdit,
  onSave,
  onDelete,
  onClose,
}: {
  commande: Commande;
  isNew: boolean;
  saving: boolean;
  fournisseurs: string[];
  chantiers: string[];
  canEdit: boolean;
  onSave: (c: Commande, devisFile: File | null, removeDevis: boolean) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
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

  function validate() {
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

  const readOnly = !isNew && !canEdit;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xl p-0 sm:p-4">
      <div className="bg-white/90 backdrop-blur-2xl rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-white/50">
        {/* Header */}
        <div className="bg-white/50 border-b border-white/40 px-5 py-4 flex items-center justify-between shrink-0">
          <div>
            <div className="font-semibold text-base text-[#1d1d1f]">
              {isNew ? "Nouvelle commande" : readOnly ? "Détail commande" : "Modifier commande"}
            </div>
            <div className="text-[11px] text-[#86868b] mt-0.5">{COMMANDE_COMPANY}</div>
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
              disabled={readOnly}
              onChange={(e) => set("orderDate", e.target.value)}
              className={inputCls(errors.orderDate)}
            />
          </FormField>

          <FormField label="Chantier *" error={errors.chantier}>
            {/* TODO: brancher sur le module Chantiers quand il existera */}
            <input
              type="text"
              list="chantiers-list"
              value={form.chantier}
              disabled={readOnly}
              onChange={(e) => set("chantier", e.target.value)}
              placeholder="Nom du chantier"
              className={inputCls(errors.chantier)}
            />
            <datalist id="chantiers-list">
              {chantiers.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </FormField>

          <FormField label="Fournisseur *" error={errors.fournisseur}>
            <input
              type="text"
              list="fournisseurs-list"
              value={form.fournisseur}
              disabled={readOnly}
              onChange={(e) => set("fournisseur", e.target.value)}
              placeholder="Nom du fournisseur"
              className={inputCls(errors.fournisseur)}
            />
            <datalist id="fournisseurs-list">
              {fournisseurs.map((f) => (
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
              disabled={readOnly}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Béton C25/30, 15 m³"
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
              disabled={readOnly}
              onChange={(e) => set("amount", parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className={inputCls(errors.amount)}
            />
          </FormField>

          <FormField label="Délai de livraison prévu">
            <input
              type="date"
              value={form.deliveryDate ?? ""}
              disabled={readOnly}
              onChange={(e) => set("deliveryDate", e.target.value || null)}
              className={inputCls()}
            />
          </FormField>

          <FormField label="Devis joint" error={errors.devis} hint="PDF, JPG, PNG, etc. — max 10 Mo">
            {form.devisPath && !removeDevis && !devisFile && (
              <div className="flex items-center justify-between bg-stone-50 rounded-lg px-3 py-2 mb-2">
                <span className="text-xs text-gray-600 truncate">📎 {form.devisName ?? "devis"}</span>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setRemoveDevis(true)}
                    className="text-xs text-red-500 hover:underline ml-2 shrink-0"
                  >
                    Retirer
                  </button>
                )}
              </div>
            )}
            {!readOnly && (
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
                onChange={handleFile}
                className="block w-full text-xs text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
              />
            )}
          </FormField>

          <FormField label="Commentaire">
            <textarea
              rows={3}
              value={form.comment}
              disabled={readOnly}
              onChange={(e) => set("comment", e.target.value)}
              placeholder="Commentaire libre…"
              className={inputCls()}
            />
          </FormField>
        </div>

        {/* Footer */}
        <div className="border-t border-white/40 bg-white/50 px-5 py-4 flex items-center justify-between gap-3 shrink-0">
          {!isNew && canEdit ? (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="text-xs text-red-500 hover:text-red-700 font-medium px-3 py-2 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              Supprimer
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-sm text-gray-500 px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
            >
              {readOnly ? "Fermer" : "Annuler"}
            </button>
            {!readOnly && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-[#1d1d1f] text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-[#333] disabled:opacity-50"
              >
                {saving ? "Enregistrement…" : isNew ? "Enregistrer" : "Mettre à jour"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function CommandesDashboard() {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [perms, setPerms] = useState<Permissions>({ view: false, create: false, edit: false });
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);

  // Filters
  const [filterChantier, setFilterChantier] = useState<string>("");
  const [filterFournisseur, setFilterFournisseur] = useState<string>("");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Commande | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [permsRes, listRes] = await Promise.all([
        fetch("/api/commandes/permissions"),
        fetch("/api/commandes"),
      ]);
      if (!permsRes.ok) {
        setAccessError("Vous n'avez pas accès à ce module.");
        setLoading(false);
        return;
      }
      const p: Permissions = await permsRes.json();
      setPerms(p);
      if (!p.view) {
        setAccessError("Vous n'avez pas accès à ce module.");
        setLoading(false);
        return;
      }
      if (listRes.ok) {
        setCommandes(await listRes.json());
      }
    } catch {
      setAccessError("Erreur de chargement.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
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
    return commandes.filter((c) => {
      if (filterChantier && c.chantier !== filterChantier) return false;
      if (filterFournisseur && c.fournisseur !== filterFournisseur) return false;
      if (filterFrom && c.orderDate < filterFrom) return false;
      if (filterTo && c.orderDate > filterTo) return false;
      return true;
    });
  }, [commandes, filterChantier, filterFournisseur, filterFrom, filterTo]);

  const totalAmount = useMemo(() => filtered.reduce((s, c) => s + c.amount, 0), [filtered]);

  function openNew() {
    setEditing(emptyCommande());
    setIsNew(true);
    setShowForm(true);
  }

  function openEdit(c: Commande) {
    setEditing(c);
    setIsNew(false);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
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

  async function deleteDevis(path: string) {
    const supabase = createClient();
    await supabase.storage.from("commandes-devis").remove([path]);
  }

  async function handleSave(c: Commande, devisFile: File | null, removeDevis: boolean) {
    setSaving(true);
    try {
      const toSave = { ...c };

      if (removeDevis && c.devisPath) {
        await deleteDevis(c.devisPath);
        toSave.devisPath = null;
        toSave.devisName = null;
      }

      if (devisFile) {
        // Si on remplace, supprimer l'ancien
        if (c.devisPath) await deleteDevis(c.devisPath);
        const { path, name } = await uploadDevis(c.id, devisFile);
        toSave.devisPath = path;
        toSave.devisName = name;
      }

      const url = isNew ? "/api/commandes" : `/api/commandes/${c.id}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSave),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Erreur" }));
        throw new Error(error || "Erreur lors de l'enregistrement");
      }
      showToast(isNew ? "Commande enregistrée" : "Commande mise à jour", "success");
      await loadAll();
      if (isNew) {
        // Réouvrir un nouveau formulaire vide pour saisie rapide
        setEditing(emptyCommande());
      } else {
        closeForm();
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erreur", "error");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/commandes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Suppression impossible");
      showToast("Commande supprimée", "success");
      closeForm();
      await loadAll();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erreur", "error");
    }
    setSaving(false);
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

  // ── Render ──────────────────────────────────────────────────────────────────
  if (accessError) {
    return (
      <div className="min-h-screen bg-warm flex items-center justify-center px-6">
        <div className="glass-card rounded-2xl p-8 text-center max-w-sm">
          <div className="text-3xl mb-3">🔒</div>
          <div className="text-base font-semibold text-[#1d1d1f] mb-2">Accès refusé</div>
          <div className="text-sm text-[#86868b] mb-5">{accessError}</div>
          <Link
            href="/"
            className="inline-block text-xs font-medium text-[#0071e3] hover:underline"
          >
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm">
      <header className="glass sticky top-0 z-20 border-b border-white/30">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative w-9 h-9 shrink-0">
              <Image src="/logo.png" alt="MBA Groupe SA" fill className="object-contain" />
            </div>
            <div className="min-w-0">
              <div className="text-base font-semibold text-[#1d1d1f] truncate">Commandes</div>
              <div className="text-[11px] text-[#86868b] tracking-wide">{COMMANDE_COMPANY}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/"
              className="text-xs font-medium text-[#86868b] hover:text-[#1d1d1f] bg-white/40 hover:bg-white/60 border border-white/30 rounded-xl px-3 py-2 transition-all"
            >
              ← Accueil
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className="text-xs font-medium text-[#1d1d1f] bg-white/60 hover:bg-white/80 border border-white/40 rounded-xl px-3 py-2 transition-all"
              >
                ⚙ Admin
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* KPI strip */}
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

        {/* Action bar */}
        <div className="flex items-center justify-between mb-4 gap-3">
          <h2 className="text-base font-semibold text-[#1d1d1f]">Toutes les commandes</h2>
          {perms.create && (
            <button
              onClick={openNew}
              className="bg-[#1d1d1f] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#333] transition-colors"
            >
              + Nouvelle commande
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="glass-card rounded-2xl p-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
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

        {/* List */}
        {loading ? (
          <div className="text-center text-sm text-gray-400 py-12">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="glass-card rounded-2xl p-10 text-center text-sm text-gray-400">
            Aucune commande à afficher.
          </div>
        ) : (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="divide-y divide-gray-100">
              {filtered.map((c) => (
                <div
                  key={c.id}
                  className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 hover:bg-white/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-[#86868b]">{formatDate(c.orderDate)}</span>
                      <span className="text-sm font-semibold text-[#1d1d1f] truncate">{c.fournisseur}</span>
                      {c.devisPath && (
                        <button
                          onClick={() => downloadDevis(c)}
                          className="text-[10px] bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full hover:bg-blue-100"
                          title={c.devisName ?? "Devis"}
                        >
                          📎 Devis
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">
                      {c.chantier} · {c.description}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-sm font-semibold text-[#bf5f1a]">{formatCHF(c.amount)}</div>
                    <button
                      onClick={() => openEdit(c)}
                      className="text-xs text-[#0071e3] hover:underline font-medium"
                    >
                      {perms.edit ? "Ouvrir" : "Voir"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {showForm && editing && (
        <CommandeForm
          commande={editing}
          isNew={isNew}
          saving={saving}
          fournisseurs={fournisseurs}
          chantiers={chantiers}
          canEdit={perms.edit || isNew}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={closeForm}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} />}
    </div>
  );
}
