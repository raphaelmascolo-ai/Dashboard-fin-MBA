"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  type Commande,
  COMMANDE_COMPANY,
  emptyCommande,
  DEVIS_MAX_BYTES,
} from "./data";
import { createClient } from "../lib/supabase/client";

// ── Form helpers ──────────────────────────────────────────────────────────────
function inputCls(err?: string) {
  return `w-full px-3 py-3 rounded-xl border text-base sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 ${err ? "border-red-300" : "border-gray-200"}`;
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

// ── Dashboard (form-only) ─────────────────────────────────────────────────────
export default function CommandesDashboard() {
  const [form, setForm] = useState<Commande>(() => emptyCommande());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [devisFile, setDevisFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [accessError, setAccessError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Vérification d'accès au chargement
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/commandes/permissions");
        if (!res.ok) {
          setAccessError("Vous n'avez pas accès à ce module.");
          setLoading(false);
          return;
        }
        const p: { view: boolean; create: boolean; edit: boolean } = await res.json();
        if (!p.create) {
          setAccessError("Vous n'avez pas la permission de créer des commandes.");
        }
      } catch {
        setAccessError("Erreur de chargement.");
      }
      setLoading(false);
    })();

    // Détection du rôle admin (pour afficher le lien vers la liste)
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
  }, []);

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

  function resetForm() {
    setForm(emptyCommande());
    setDevisFile(null);
    setErrors({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const toSave = { ...form };
      if (devisFile) {
        const { path, name } = await uploadDevis(form.id, devisFile);
        toSave.devisPath = path;
        toSave.devisName = name;
      }
      const res = await fetch("/api/commandes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSave),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Erreur" }));
        throw new Error(error || "Erreur lors de l'envoi");
      }
      showToast("Commande envoyée ✓", "success");
      resetForm();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erreur", "error");
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
        <div className="max-w-xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-9 h-9 shrink-0">
              <Image src="/logo.png" alt="MBA Groupe SA" fill className="object-contain" />
            </div>
            <div className="min-w-0">
              <div className="text-base font-semibold text-[#1d1d1f] truncate">Déclarer une commande</div>
              <div className="text-[11px] text-[#86868b] tracking-wide">{COMMANDE_COMPANY}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <Link
                href="/commandes/liste"
                className="text-xs font-medium text-[#1d1d1f] bg-white/60 hover:bg-white/80 border border-white/40 rounded-xl px-3 py-2 transition-all"
              >
                ☰ Liste
              </Link>
            )}
            <Link
              href="/"
              className="text-xs font-medium text-[#86868b] hover:text-[#1d1d1f] bg-white/40 hover:bg-white/60 border border-white/30 rounded-xl px-3 py-2 transition-all"
            >
              ← Accueil
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-5 py-6 sm:py-8">
        <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-5 sm:p-6 space-y-4">
          <FormField label="Date de la commande *" error={errors.orderDate}>
            <input
              type="date"
              value={form.orderDate}
              onChange={(e) => set("orderDate", e.target.value)}
              className={inputCls(errors.orderDate)}
            />
          </FormField>

          <FormField label="Chantier *" error={errors.chantier}>
            {/* TODO: brancher sur le module Chantiers quand il existera */}
            <input
              type="text"
              value={form.chantier}
              onChange={(e) => set("chantier", e.target.value)}
              placeholder="Nom du chantier"
              className={inputCls(errors.chantier)}
            />
          </FormField>

          <FormField label="Fournisseur *" error={errors.fournisseur}>
            <input
              type="text"
              value={form.fournisseur}
              onChange={(e) => set("fournisseur", e.target.value)}
              placeholder="Nom du fournisseur"
              autoComplete="off"
              className={inputCls(errors.fournisseur)}
            />
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
              onChange={(e) => set("amount", parseFloat(e.target.value) || 0)}
              placeholder="0.00"
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
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
              onChange={handleFile}
              className="block w-full text-xs text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
            />
            {devisFile && (
              <div className="text-[11px] text-gray-500 mt-1 truncate">📎 {devisFile.name}</div>
            )}
          </FormField>

          <FormField label="Commentaire">
            <textarea
              rows={3}
              value={form.comment}
              onChange={(e) => set("comment", e.target.value)}
              placeholder="Commentaire libre…"
              className={inputCls()}
            />
          </FormField>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#1d1d1f] text-white text-base font-semibold py-3.5 rounded-xl hover:bg-[#333] active:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Envoi…" : "Envoyer"}
          </button>
        </form>
      </main>

      {toast && <Toast message={toast.msg} type={toast.type} />}
    </div>
  );
}
