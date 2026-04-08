"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  type Worker,
  type WorkerRole,
  roleColor,
  roleLabel,
  roleShort,
  generateWorkerId,
} from "../data";
import NavButton from "../../components/NavButton";

interface Permissions {
  isAdmin: boolean;
  view: boolean;
  workers: boolean;
  sites: boolean;
  assign: boolean;
}

function inputCls(err?: string) {
  return `w-full px-3 py-2.5 rounded-xl border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 ${err ? "border-red-300" : "border-gray-200"}`;
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

function WorkerForm({
  worker,
  onSave,
  onClose,
  saving,
}: {
  worker: Worker;
  onSave: (w: Worker) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Worker>(() => ({ ...worker }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof Worker>(field: K, value: Worker[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((e) => {
      const n = { ...e };
      delete n[field as string];
      return n;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = "Requis";
    if (!form.lastName.trim()) errs.lastName = "Requis";
    setErrors(errs);
    if (Object.keys(errs).length === 0) onSave(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xl p-0 sm:p-4">
      <div className="bg-white/95 backdrop-blur-2xl rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden border border-white/50">
        <div className="bg-white/60 border-b border-white/40 px-5 py-4 flex items-center justify-between">
          <div className="font-semibold text-base text-[#1d1d1f]">
            {worker.firstName ? "Modifier l'ouvrier" : "Nouvel ouvrier"}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] hover:bg-white/60 transition-all text-lg"
          >
            ✕
          </button>
        </div>
        <form onSubmit={submit} className="px-5 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Prénom *</label>
            <input
              type="text"
              autoFocus
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              className={inputCls(errors.firstName)}
            />
            {errors.firstName && <div className="text-[11px] text-red-500 mt-1">⚠ {errors.firstName}</div>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nom *</label>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              className={inputCls(errors.lastName)}
            />
            {errors.lastName && <div className="text-[11px] text-red-500 mt-1">⚠ {errors.lastName}</div>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Rôle *</label>
            <select
              value={form.role}
              onChange={(e) => set("role", e.target.value as WorkerRole)}
              className={inputCls()}
            >
              <option value="ouvrier">Ouvrier</option>
              <option value="chef">Chef d&apos;équipe</option>
              <option value="grutier">Grutier</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="active"
              type="checkbox"
              checked={form.active}
              onChange={(e) => set("active", e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="active" className="text-sm text-gray-600">
              Actif
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-500 px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-[#1d1d1f] text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-[#333] disabled:opacity-50"
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function OuvriersPage() {
  const [perms, setPerms] = useState<Permissions>({
    isAdmin: false,
    view: false,
    workers: false,
    sites: false,
    assign: false,
  });
  const [accessError, setAccessError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const load = useCallback(async () => {
    try {
      const permsRes = await fetch("/api/planning/permissions");
      if (!permsRes.ok) {
        setAccessError("Vous n'avez pas accès à ce module.");
        setLoading(false);
        return;
      }
      const p: Permissions = await permsRes.json();
      setPerms(p);
      if (!p.workers && !p.isAdmin) {
        setAccessError("Vous n'avez pas la permission de gérer les ouvriers.");
        setLoading(false);
        return;
      }
      const wRes = await fetch("/api/planning/workers");
      if (wRes.ok) setWorkers(await wRes.json());
    } catch {
      setAccessError("Erreur de chargement.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function newWorker() {
    setEditing({
      id: generateWorkerId(),
      firstName: "",
      lastName: "",
      role: "ouvrier",
      active: true,
    });
  }

  async function handleSave(w: Worker) {
    setSaving(true);
    const isNew = !workers.some((x) => x.id === w.id);
    const url = isNew ? "/api/planning/workers" : `/api/planning/workers/${w.id}`;
    const method = isNew ? "POST" : "PUT";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(w),
    });
    setSaving(false);
    if (!res.ok) {
      showToast("Enregistrement échoué", "error");
      return;
    }
    showToast(isNew ? "Ouvrier ajouté" : "Ouvrier modifié", "success");
    setEditing(null);
    load();
  }

  async function handleDeactivate(w: Worker) {
    if (!window.confirm(`Désactiver ${w.firstName} ${w.lastName} ?`)) return;
    const res = await fetch(`/api/planning/workers/${w.id}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("Erreur", "error");
      return;
    }
    showToast("Ouvrier désactivé", "success");
    load();
  }

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
          <Link href="/planning" className="inline-block text-xs font-medium text-[#0071e3] hover:underline">
            ← Retour au planning
          </Link>
        </div>
      </div>
    );
  }

  const sortedWorkers = [...workers].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.firstName.localeCompare(b.firstName);
  });

  return (
    <div className="min-h-screen bg-warm">
      <header className="glass sticky top-0 z-20 border-b border-white/30">
        <div className="max-w-3xl mx-auto px-3 sm:px-5 py-2 sm:py-3 flex items-center justify-between gap-2">
          <NavButton href="/planning" label="Retour" />
          <div className="text-sm font-semibold text-[#1d1d1f] truncate text-center flex-1">
            Ouvriers
          </div>
          <div className="w-[44px]" aria-hidden />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-5 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[#1d1d1f]">{workers.length} ouvrier{workers.length > 1 ? "s" : ""}</h2>
          {perms.workers && (
            <button
              onClick={newWorker}
              className="bg-[#1d1d1f] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#333] active:scale-95 transition-all min-h-[40px]"
            >
              + Ajouter
            </button>
          )}
        </div>

        {sortedWorkers.length === 0 ? (
          <div className="glass-card rounded-2xl p-10 text-center text-sm text-gray-400">
            Aucun ouvrier — ajoutez-en un pour démarrer.
          </div>
        ) : (
          <div className="glass-card rounded-2xl overflow-hidden divide-y divide-gray-100">
            {sortedWorkers.map((w) => {
              const c = roleColor(w.role);
              return (
                <div
                  key={w.id}
                  className={`px-4 py-3 flex items-center gap-3 ${
                    w.active ? "" : "opacity-50"
                  }`}
                >
                  <span
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0"
                    style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
                  >
                    {roleShort(w.role)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#1d1d1f] truncate">
                      {w.firstName} {w.lastName}
                    </div>
                    <div className="text-xs text-[#86868b]">
                      {roleLabel(w.role)}
                      {!w.active && " · Désactivé"}
                    </div>
                  </div>
                  {perms.workers && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setEditing(w)}
                        className="text-xs text-[#0071e3] font-medium px-2 py-1 hover:underline"
                      >
                        Modifier
                      </button>
                      {w.active && (
                        <button
                          onClick={() => handleDeactivate(w)}
                          className="text-xs text-red-500 font-medium px-2 py-1 hover:underline"
                        >
                          Désactiver
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {editing && (
        <WorkerForm
          worker={editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
          saving={saving}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} />}
    </div>
  );
}
