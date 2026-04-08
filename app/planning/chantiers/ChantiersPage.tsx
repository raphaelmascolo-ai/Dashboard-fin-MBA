"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { type Site, generateSiteId, SYSTEM_SITE_IDS } from "../data";
import NavButton from "../../components/NavButton";

interface Permissions {
  isAdmin: boolean;
  view: boolean;
  workers: boolean;
  sites: boolean;
  assign: boolean;
}

const PRESET_COLORS = [
  "#0071e3", "#34c759", "#ff9500", "#ff2d55", "#af52de",
  "#5856d6", "#bf5f1a", "#1e7d3a", "#86868b",
];

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

function SiteForm({
  site,
  onSave,
  onClose,
  saving,
}: {
  site: Site;
  onSave: (s: Site) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Site>(() => ({ ...site }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof Site>(field: K, value: Site[K]) {
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
    if (!form.name.trim()) errs.name = "Requis";
    setErrors(errs);
    if (Object.keys(errs).length === 0) onSave(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xl p-0 sm:p-4">
      <div className="bg-white/95 backdrop-blur-2xl rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden border border-white/50">
        <div className="bg-white/60 border-b border-white/40 px-5 py-4 flex items-center justify-between">
          <div className="font-semibold text-base text-[#1d1d1f]">
            {site.name ? "Modifier le chantier" : "Nouveau chantier"}
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
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nom *</label>
            <input
              type="text"
              autoFocus
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Villa Martin – Sion"
              className={inputCls(errors.name)}
            />
            {errors.name && <div className="text-[11px] text-red-500 mt-1">⚠ {errors.name}</div>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Lieu (optionnel)</label>
            <input
              type="text"
              value={form.location ?? ""}
              onChange={(e) => set("location", e.target.value || null)}
              placeholder="Sion"
              className={inputCls()}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Couleur (optionnel)</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => set("color", null)}
                className={`w-8 h-8 rounded-full border-2 ${
                  form.color === null ? "border-[#1d1d1f] ring-2 ring-amber-300" : "border-gray-200"
                } bg-white text-xs text-gray-400`}
              >
                ✕
              </button>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set("color", c)}
                  className={`w-8 h-8 rounded-full border-2 ${
                    form.color === c ? "border-[#1d1d1f] ring-2 ring-amber-300" : "border-white/60"
                  }`}
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
            </div>
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

export default function ChantiersPage() {
  const [perms, setPerms] = useState<Permissions>({
    isAdmin: false,
    view: false,
    workers: false,
    sites: false,
    assign: false,
  });
  const [accessError, setAccessError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<Site[]>([]);
  const [editing, setEditing] = useState<Site | null>(null);
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
      if (!p.sites && !p.isAdmin) {
        setAccessError("Vous n'avez pas la permission de gérer les chantiers.");
        setLoading(false);
        return;
      }
      const sRes = await fetch("/api/planning/sites");
      if (sRes.ok) setSites(await sRes.json());
    } catch {
      setAccessError("Erreur de chargement.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function newSite() {
    setEditing({
      id: generateSiteId(),
      name: "",
      location: null,
      color: null,
      active: true,
      system: false,
      sortOrder: 0,
    });
  }

  async function handleSave(s: Site) {
    setSaving(true);
    const isNew = !sites.some((x) => x.id === s.id);
    const url = isNew ? "/api/planning/sites" : `/api/planning/sites/${s.id}`;
    const method = isNew ? "POST" : "PUT";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    setSaving(false);
    if (!res.ok) {
      showToast("Enregistrement échoué", "error");
      return;
    }
    showToast(isNew ? "Chantier ajouté" : "Chantier modifié", "success");
    setEditing(null);
    load();
  }

  async function handleDeactivate(s: Site) {
    if (!window.confirm(`Désactiver « ${s.name} » ?`)) return;
    const res = await fetch(`/api/planning/sites/${s.id}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("Erreur", "error");
      return;
    }
    showToast("Chantier désactivé", "success");
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

  // Affichage : non-system d'abord, puis system, sinon par nom
  const sortedSites = [...sites].sort((a, b) => {
    if (a.system !== b.system) return a.system ? 1 : -1;
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const userSitesCount = sites.filter((s) => !s.system).length;

  return (
    <div className="min-h-screen bg-warm">
      <header className="glass sticky top-0 z-20 border-b border-white/30">
        <div className="max-w-3xl mx-auto px-3 sm:px-5 py-2 sm:py-3 flex items-center justify-between gap-2">
          <NavButton href="/planning" label="Retour" />
          <div className="text-sm font-semibold text-[#1d1d1f] truncate text-center flex-1">
            Chantiers
          </div>
          <div className="w-[44px]" aria-hidden />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-5 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[#1d1d1f]">
            {userSitesCount} chantier{userSitesCount > 1 ? "s" : ""}
          </h2>
          {perms.sites && (
            <button
              onClick={newSite}
              className="bg-[#1d1d1f] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#333] active:scale-95 transition-all min-h-[40px]"
            >
              + Ajouter
            </button>
          )}
        </div>

        {sortedSites.length === 0 ? (
          <div className="glass-card rounded-2xl p-10 text-center text-sm text-gray-400">
            Aucun chantier — ajoutez-en un pour démarrer.
          </div>
        ) : (
          <div className="glass-card rounded-2xl overflow-hidden divide-y divide-gray-100">
            {sortedSites.map((s) => {
              const isSystem = SYSTEM_SITE_IDS.includes(s.id);
              return (
                <div
                  key={s.id}
                  className={`px-4 py-3 flex items-center gap-3 ${s.active ? "" : "opacity-50"}`}
                >
                  <div
                    className="w-3 h-10 rounded shrink-0"
                    style={{ background: s.color ?? (isSystem ? "#9ca3af" : "#d4d4d4") }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#1d1d1f] truncate">{s.name}</div>
                    <div className="text-xs text-[#86868b]">
                      {s.location || "—"}
                      {isSystem && " · Système"}
                      {!s.active && " · Désactivé"}
                    </div>
                  </div>
                  {perms.sites && !isSystem && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setEditing(s)}
                        className="text-xs text-[#0071e3] font-medium px-2 py-1 hover:underline"
                      >
                        Modifier
                      </button>
                      {s.active && (
                        <button
                          onClick={() => handleDeactivate(s)}
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
        <SiteForm
          site={editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
          saving={saving}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} />}
    </div>
  );
}
