"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  type Site,
  type YearPlacement,
  type IsoWeekInfo,
  SYSTEM_SITE_IDS,
  listWeeksOfYear,
  formatWeekDates,
  monthLabel,
  getIsoWeek,
  generateYearPlacementId,
  generateSiteId,
} from "../data";
import NavButton from "../../components/NavButton";

interface Permissions {
  isAdmin: boolean;
  view: boolean;
  workers: boolean;
  sites: boolean;
  assign: boolean;
  yearView: boolean;
  yearPlace: boolean;
}

const POOL_DROPPABLE_ID = "POOL";
const WEEK_PREFIX = "week:";

function weekDropId(year: number, week: number) {
  return `${WEEK_PREFIX}${year}:${week}`;
}
function parseWeekDropId(id: string): { year: number; week: number } | null {
  if (!id.startsWith(WEEK_PREFIX)) return null;
  const [, y, w] = id.split(":");
  return { year: parseInt(y, 10), week: parseInt(w, 10) };
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

// ── SiteCard (draggable) ──────────────────────────────────────────────────────
function SiteCard({
  site,
  dragId,
}: {
  site: Site;
  dragId: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: {
      siteId: site.id,
      fromPlacementId: dragId.startsWith("p:") ? dragId.slice(2) : null,
    },
  });
  const sideColor = site.color ?? "#9ca3af";
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        opacity: isDragging ? 0.4 : 1,
        touchAction: "none",
        borderLeft: `4px solid ${sideColor}`,
      }}
      className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow cursor-grab active:cursor-grabbing select-none px-2 py-1.5 text-xs"
      title={site.name}
    >
      <div className="font-semibold text-[#1d1d1f] truncate leading-tight">{site.name}</div>
      {site.location && (
        <div className="text-[10px] text-[#86868b] truncate leading-tight">{site.location}</div>
      )}
    </div>
  );
}

// ── DroppableArea ─────────────────────────────────────────────────────────────
function DroppableArea({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`${className ?? ""} transition-colors ${isOver ? "bg-amber-100/70 ring-2 ring-amber-300 ring-inset" : ""}`}
    >
      {children}
    </div>
  );
}

// ── Modal: nouveau chantier rapide ────────────────────────────────────────────
function QuickSiteModal({
  saving,
  onSave,
  onClose,
}: {
  saving: boolean;
  onSave: (name: string, location: string, color: string | null) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const PRESET_COLORS = ["#0071e3", "#34c759", "#ff9500", "#ff2d55", "#af52de", "#5856d6", "#bf5f1a"];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErr("Le nom est requis");
      return;
    }
    onSave(name.trim(), location.trim(), color);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xl p-0 sm:p-4">
      <div className="bg-white/95 backdrop-blur-2xl rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden border border-white/50">
        <div className="bg-white/60 border-b border-white/40 px-5 py-4 flex items-center justify-between">
          <div className="font-semibold text-base text-[#1d1d1f]">Nouveau chantier</div>
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
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErr("");
              }}
              placeholder="Villa Martin – Sion"
              className={`w-full px-3 py-2.5 rounded-xl border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                err ? "border-red-300" : "border-gray-200"
              }`}
            />
            {err && <div className="text-[11px] text-red-500 mt-1">⚠ {err}</div>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Lieu (optionnel)</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Sion"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Couleur (optionnel)</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setColor(null)}
                className={`w-8 h-8 rounded-full border-2 ${
                  color === null ? "border-[#1d1d1f] ring-2 ring-amber-300" : "border-gray-200"
                } bg-white text-xs text-gray-400`}
              >
                ✕
              </button>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 ${
                    color === c ? "border-[#1d1d1f] ring-2 ring-amber-300" : "border-white/60"
                  }`}
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
            </div>
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
              {saving ? "Création…" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function PlanningYearDashboard() {
  const [perms, setPerms] = useState<Permissions>({
    isAdmin: false,
    view: false,
    workers: false,
    sites: false,
    assign: false,
    yearView: false,
    yearPlace: false,
  });
  const [accessError, setAccessError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [year, setYear] = useState<number>(() => new Date().getFullYear());
  const [sites, setSites] = useState<Site[]>([]);
  const [placements, setPlacements] = useState<YearPlacement[]>([]);

  const [activeDragSite, setActiveDragSite] = useState<Site | null>(null);
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [savingSite, setSavingSite] = useState(false);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // ── Chargement initial ─────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const permsRes = await fetch("/api/planning/permissions");
        if (!permsRes.ok) {
          setAccessError("Vous n'avez pas accès à ce module.");
          setLoading(false);
          return;
        }
        const p: Permissions = await permsRes.json();
        setPerms(p);
        if (!p.yearView) {
          setAccessError("Vous n'avez pas accès à ce module.");
          setLoading(false);
          return;
        }
        const sRes = await fetch("/api/planning/sites");
        if (sRes.ok) setSites(await sRes.json());
      } catch {
        setAccessError("Erreur de chargement.");
      }
      setLoading(false);
    })();
  }, []);

  // ── Chargement par année ───────────────────────────────────────────────────
  const loadYear = useCallback(async () => {
    const res = await fetch(`/api/planning/year-placements?year=${year}`);
    if (res.ok) setPlacements(await res.json());
  }, [year]);

  useEffect(() => {
    if (perms.yearView) loadYear();
  }, [year, perms.yearView, loadYear]);

  // ── Indexes ────────────────────────────────────────────────────────────────
  const weeks: IsoWeekInfo[] = useMemo(() => listWeeksOfYear(year), [year]);

  const siteById = useMemo(() => {
    const m = new Map<string, Site>();
    sites.forEach((s) => m.set(s.id, s));
    return m;
  }, [sites]);

  // Chantiers actifs et non-système (utilisables dans la vue annuelle)
  const activeSites = useMemo(
    () => sites.filter((s) => s.active && !SYSTEM_SITE_IDS.includes(s.id)),
    [sites]
  );

  const filteredSites = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeSites;
    return activeSites.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.location ?? "").toLowerCase().includes(q)
    );
  }, [activeSites, search]);

  // placements indexés par semaine
  const placementsByWeek = useMemo(() => {
    const map: Record<number, YearPlacement[]> = {};
    placements.forEach((p) => {
      if (!map[p.isoWeek]) map[p.isoWeek] = [];
      map[p.isoWeek].push(p);
    });
    return map;
  }, [placements]);

  // Semaine courante (pour highlight)
  const currentIso = useMemo(() => getIsoWeek(new Date()), []);

  // ── Drag handlers ──────────────────────────────────────────────────────────
  function handleDragStart(e: DragStartEvent) {
    const data = e.active.data.current as { siteId: string } | undefined;
    if (data?.siteId) {
      const s = siteById.get(data.siteId);
      if (s) setActiveDragSite(s);
    }
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveDragSite(null);
    const { active, over } = e;
    if (!over) return;
    const data = active.data.current as
      | { siteId: string; fromPlacementId: string | null }
      | undefined;
    if (!data) return;

    const overId = String(over.id);

    // Drop sur le pool = retrait
    if (overId === POOL_DROPPABLE_ID) {
      if (!data.fromPlacementId) return;
      const id = data.fromPlacementId;
      setPlacements((prev) => prev.filter((p) => p.id !== id));
      const res = await fetch(`/api/planning/year-placements/${id}`, { method: "DELETE" });
      if (!res.ok) {
        showToast("Suppression échouée", "error");
        loadYear();
      }
      return;
    }

    // Drop sur une semaine
    const target = parseWeekDropId(overId);
    if (!target) return;

    const oldPlacement = data.fromPlacementId
      ? placements.find((p) => p.id === data.fromPlacementId)
      : null;

    // Same week? do nothing
    if (oldPlacement && oldPlacement.isoWeek === target.week && oldPlacement.year === target.year) {
      return;
    }

    // Already present in target week? on the rule "le chantier est unique par semaine"
    const alreadyThere = placements.some(
      (p) => p.siteId === data.siteId && p.year === target.year && p.isoWeek === target.week
    );
    if (alreadyThere) {
      // Si on déplace depuis une autre semaine, on retire l'ancien et on garde la cible existante
      if (oldPlacement) {
        setPlacements((prev) => prev.filter((p) => p.id !== oldPlacement.id));
        await fetch(`/api/planning/year-placements/${oldPlacement.id}`, { method: "DELETE" });
      }
      return;
    }

    const newPlacement: YearPlacement = {
      id: generateYearPlacementId(),
      siteId: data.siteId,
      year: target.year,
      isoWeek: target.week,
    };

    // Optimistic
    setPlacements((prev) => {
      const next = oldPlacement ? prev.filter((p) => p.id !== oldPlacement.id) : prev;
      return [...next, newPlacement];
    });

    const tasks: Promise<Response>[] = [];
    if (oldPlacement) {
      tasks.push(fetch(`/api/planning/year-placements/${oldPlacement.id}`, { method: "DELETE" }));
    }
    tasks.push(
      fetch("/api/planning/year-placements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPlacement),
      })
    );
    const results = await Promise.all(tasks);
    const createRes = results[results.length - 1];
    if (!createRes.ok) {
      showToast("Placement échoué", "error");
      loadYear();
      return;
    }
    try {
      const created = await createRes.json();
      setPlacements((prev) =>
        prev.map((p) => (p.id === newPlacement.id ? { ...p, id: created.id } : p))
      );
    } catch {
      loadYear();
    }
  }

  // ── Création rapide chantier ───────────────────────────────────────────────
  async function createQuickSite(name: string, location: string, color: string | null) {
    setSavingSite(true);
    const newSite: Site = {
      id: generateSiteId(),
      name,
      location: location || null,
      color,
      active: true,
      system: false,
      sortOrder: 0,
    };
    const res = await fetch("/api/planning/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSite),
    });
    setSavingSite(false);
    if (!res.ok) {
      showToast("Création échouée", "error");
      return;
    }
    const created = await res.json();
    setSites((prev) => [...prev, created]);
    setShowSiteModal(false);
  }

  // ── Scroll auto vers la semaine en cours quand on charge l'année courante ──
  useEffect(() => {
    if (year === currentIso.year && scrollRef.current) {
      const target = scrollRef.current.querySelector<HTMLElement>(
        `[data-week="${currentIso.week}"]`
      );
      if (target) {
        target.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
      }
    }
  }, [year, currentIso, weeks]);

  // ── Render ─────────────────────────────────────────────────────────────────
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

  // Groupes de mois pour la barre supérieure (même mois consécutifs fusionnés)
  const monthGroups: { monthIndex: number; weeks: IsoWeekInfo[] }[] = [];
  for (const w of weeks) {
    const last = monthGroups[monthGroups.length - 1];
    if (last && last.monthIndex === w.monthIndex) {
      last.weeks.push(w);
    } else {
      monthGroups.push({ monthIndex: w.monthIndex, weeks: [w] });
    }
  }

  const COL_W = 140; // largeur d'une colonne semaine en px

  return (
    <div className="min-h-screen bg-warm flex flex-col">
      <header className="glass sticky top-0 z-30 border-b border-white/30">
        <div className="max-w-[1800px] mx-auto px-3 sm:px-5 py-2 sm:py-3 flex items-center justify-between gap-2">
          <NavButton href="/mba-construction" label="Retour" />
          <div className="text-sm font-semibold text-[#1d1d1f] truncate text-center flex-1">
            Vue annuelle chantiers
          </div>
          <Link
            href="/planning"
            className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-[#1d1d1f] bg-white/60 border border-white/40 rounded-xl hover:bg-white/80 active:scale-95 transition-all min-h-[44px]"
            title="Vue planning hebdomadaire"
          >
            <span className="hidden sm:inline">📅 Hebdo</span>
            <span className="sm:hidden">📅</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-[1800px] w-full mx-auto px-3 sm:px-5 py-4 sm:py-6 flex flex-col min-h-0">
        {/* Sélecteur d'année */}
        <div className="glass-card rounded-2xl p-3 sm:p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setYear((y) => y - 1)}
              className="w-11 h-11 rounded-xl bg-white/60 hover:bg-white border border-white/40 active:scale-95 transition-all text-lg"
              aria-label="Année précédente"
            >
              ‹
            </button>
            <button
              onClick={() => setYear((y) => y + 1)}
              className="w-11 h-11 rounded-xl bg-white/60 hover:bg-white border border-white/40 active:scale-95 transition-all text-lg"
              aria-label="Année suivante"
            >
              ›
            </button>
            <button
              onClick={() => setYear(new Date().getFullYear())}
              className="ml-1 px-3 py-2 rounded-xl bg-white/60 hover:bg-white border border-white/40 active:scale-95 transition-all text-xs font-medium min-h-[40px]"
            >
              Année en cours
            </button>
          </div>
          <div className="text-2xl font-bold text-[#1d1d1f]">{year}</div>
          <div className="flex items-center gap-2">
            {perms.sites && (
              <Link
                href="/planning/chantiers"
                className="px-3 py-2 rounded-xl bg-white/60 hover:bg-white border border-white/40 active:scale-95 transition-all text-xs font-medium min-h-[40px]"
              >
                🏗️ Gérer
              </Link>
            )}
            {perms.sites && (
              <button
                onClick={() => setShowSiteModal(true)}
                className="px-3 py-2 rounded-xl bg-[#1d1d1f] text-white hover:bg-[#333] active:scale-95 transition-all text-xs font-semibold min-h-[40px]"
              >
                + Chantier
              </button>
            )}
          </div>
        </div>

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
            {/* Pool des chantiers disponibles (sticky desktop, top mobile) */}
            <div className="lg:w-[260px] lg:shrink-0">
              <DroppableArea
                id={POOL_DROPPABLE_ID}
                className="glass-card rounded-2xl p-3 lg:sticky lg:top-[88px]"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                    Chantiers disponibles
                  </div>
                  <div className="text-[11px] font-semibold text-gray-400">
                    {filteredSites.length}
                  </div>
                </div>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 mb-3"
                />
                <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible lg:max-h-[60vh] lg:overflow-y-auto">
                  {filteredSites.length === 0 ? (
                    <div className="text-xs text-gray-400 italic py-2">
                      {activeSites.length === 0
                        ? "Aucun chantier — créez-en un avec « + Chantier »."
                        : "Aucun résultat."}
                    </div>
                  ) : (
                    filteredSites.map((s) => (
                      <div key={s.id} className="lg:w-full shrink-0 w-[180px]">
                        <SiteCard site={s} dragId={`pool:${s.id}`} />
                      </div>
                    ))
                  )}
                </div>
              </DroppableArea>
            </div>

            {/* Grille Kanban annuel */}
            <div className="flex-1 min-w-0 glass-card rounded-2xl overflow-hidden">
              <div ref={scrollRef} className="overflow-x-auto overflow-y-auto max-h-[75vh]">
                {/* Bande mois */}
                <div className="flex sticky top-0 z-20 bg-stone-100 border-b-2 border-gray-300">
                  {monthGroups.map((g, gi) => (
                    <div
                      key={`${g.monthIndex}-${gi}`}
                      className={`shrink-0 px-2 py-2 text-[11px] font-bold text-[#1d1d1f] uppercase tracking-wide text-center border-r border-gray-300 ${
                        gi % 2 === 0 ? "bg-stone-100" : "bg-stone-50"
                      }`}
                      style={{ width: `${g.weeks.length * COL_W}px` }}
                    >
                      {monthLabel(g.monthIndex)}
                    </div>
                  ))}
                </div>

                {/* En-têtes semaines */}
                <div className="flex sticky top-[36px] z-10 bg-white border-b-2 border-gray-300">
                  {weeks.map((w) => {
                    const isCurrent = w.year === currentIso.year && w.week === currentIso.week;
                    return (
                      <div
                        key={`h-${w.week}`}
                        data-week={w.week}
                        className={`shrink-0 px-2 py-2 text-center border-r border-gray-200 ${
                          isCurrent ? "bg-amber-100" : ""
                        }`}
                        style={{ width: `${COL_W}px` }}
                      >
                        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          S{w.week}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                          {formatWeekDates(w.monday, w.sunday)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Colonnes (cellules droppables) */}
                <div className="flex">
                  {weeks.map((w) => {
                    const isCurrent = w.year === currentIso.year && w.week === currentIso.week;
                    const wPlacements = placementsByWeek[w.week] ?? [];
                    return (
                      <DroppableArea
                        key={`c-${w.week}`}
                        id={weekDropId(w.year, w.week)}
                        className={`shrink-0 border-r border-gray-200 p-1.5 min-h-[400px] ${
                          isCurrent ? "bg-amber-50/40" : "bg-white/50"
                        }`}
                      >
                        <div className="flex flex-col gap-1.5" style={{ width: `${COL_W - 12}px` }}>
                          {wPlacements.map((p) => {
                            const s = siteById.get(p.siteId);
                            if (!s) return null;
                            return <SiteCard key={p.id} site={s} dragId={`p:${p.id}`} />;
                          })}
                        </div>
                      </DroppableArea>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <DragOverlay>
            {activeDragSite && (
              <div
                className="bg-white rounded-lg border border-gray-200 shadow-2xl px-2 py-1.5 text-xs rotate-2"
                style={{ borderLeft: `4px solid ${activeDragSite.color ?? "#9ca3af"}`, width: `${COL_W - 12}px` }}
              >
                <div className="font-semibold text-[#1d1d1f] truncate">{activeDragSite.name}</div>
                {activeDragSite.location && (
                  <div className="text-[10px] text-[#86868b] truncate">{activeDragSite.location}</div>
                )}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </main>

      {showSiteModal && (
        <QuickSiteModal
          saving={savingSite}
          onSave={createQuickSite}
          onClose={() => setShowSiteModal(false)}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} />}
    </div>
  );
}
