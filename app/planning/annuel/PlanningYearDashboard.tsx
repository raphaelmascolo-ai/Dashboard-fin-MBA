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

const COL_W = 72;
const ROW_H = 48;
const SIDEBAR_W = 180;

const POOL_DROPPABLE_ID = "POOL";

// ── Bars: groupes de semaines consécutives pour un même chantier ──────────────
interface Bar {
  siteId: string;
  startWeek: number;
  endWeek: number;
  placementIds: string[];
}

function computeBarsForSite(siteId: string, placements: YearPlacement[]): Bar[] {
  const filtered = placements
    .filter((p) => p.siteId === siteId)
    .sort((a, b) => a.isoWeek - b.isoWeek);
  if (filtered.length === 0) return [];
  const bars: Bar[] = [];
  let cur: Bar = {
    siteId,
    startWeek: filtered[0].isoWeek,
    endWeek: filtered[0].isoWeek,
    placementIds: [filtered[0].id],
  };
  for (let i = 1; i < filtered.length; i++) {
    const p = filtered[i];
    if (p.isoWeek === cur.endWeek + 1) {
      cur.endWeek = p.isoWeek;
      cur.placementIds.push(p.id);
    } else {
      bars.push(cur);
      cur = {
        siteId,
        startWeek: p.isoWeek,
        endWeek: p.isoWeek,
        placementIds: [p.id],
      };
    }
  }
  bars.push(cur);
  return bars;
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

// ── PoolSiteCard (draggable depuis le pool) ──────────────────────────────────
function PoolSiteCard({ site }: { site: Site }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pool:${site.id}`,
    data: { type: "pool", siteId: site.id },
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
      className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-[#facc15] cursor-grab active:cursor-grabbing select-none px-2.5 py-2 text-xs shrink-0 min-w-[150px] transition-all"
      title={site.name}
    >
      <div className="font-bold text-[#1a1a1a] truncate leading-tight">{site.name}</div>
      {site.location && (
        <div className="text-[10px] text-[#6b7280] truncate leading-tight mt-0.5">{site.location}</div>
      )}
    </div>
  );
}

// ── ResizeHandle (poignée gauche/droite d'une barre) ─────────────────────────
function ResizeHandle({ bar, side }: { bar: Bar; side: "left" | "right" }) {
  const id = `resize:${side}:${bar.siteId}:${bar.startWeek}:${bar.endWeek}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: {
      type: "resize",
      side,
      siteId: bar.siteId,
      startWeek: bar.startWeek,
      endWeek: bar.endWeek,
    },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`absolute top-0 bottom-0 ${side === "left" ? "left-0" : "right-0"} w-3 cursor-ew-resize z-20 flex items-center justify-center group ${
        isDragging ? "bg-[#1a1a1a]" : "hover:bg-[#1a1a1a]/15"
      }`}
      style={{ touchAction: "none", pointerEvents: "auto" }}
      title="Glissez pour étendre / réduire"
    >
      <div className="w-0.5 h-5 bg-[#1a1a1a]/60 group-hover:bg-[#1a1a1a] rounded" />
    </div>
  );
}

// ── BarComponent ─────────────────────────────────────────────────────────────
function BarComponent({
  bar,
  site,
  onRemove,
  canEdit,
}: {
  bar: Bar;
  site: Site;
  onRemove: (placementIds: string[]) => void;
  canEdit: boolean;
}) {
  const left = (bar.startWeek - 1) * COL_W;
  const width = (bar.endWeek - bar.startWeek + 1) * COL_W;
  const sideColor = site.color ?? "#9ca3af";
  const span = bar.endWeek - bar.startWeek + 1;
  return (
    <div
      className="absolute top-1 bottom-1 rounded-md shadow-sm flex items-center overflow-hidden"
      style={{
        left: left + 2,
        width: width - 4,
        background: "#facc15",
        border: "1px solid #ca8a04",
        borderLeft: `4px solid ${sideColor}`,
        pointerEvents: "none",
      }}
    >
      {canEdit && <ResizeHandle bar={bar} side="left" />}
      <div
        className="flex-1 px-2 truncate text-[11px] font-bold text-[#1a1a1a] min-w-0"
        style={{ pointerEvents: "auto" }}
      >
        <span className="truncate">{site.name}</span>
        {span > 1 && (
          <span className="text-[10px] text-[#3f3f3f] ml-1 font-semibold">({span} sem.)</span>
        )}
      </div>
      {canEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(bar.placementIds);
          }}
          className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded text-xs leading-none px-1 py-0.5 mx-0.5 shrink-0"
          style={{ pointerEvents: "auto" }}
          title="Retirer ce chantier de cette plage"
        >
          ✕
        </button>
      )}
      {canEdit && <ResizeHandle bar={bar} side="right" />}
    </div>
  );
}

// ── DropCell (cellule semaine, dans une ligne) ───────────────────────────────
function DropCell({
  week,
  rowKey,
  isCurrent,
}: {
  week: number;
  rowKey: string;
  isCurrent: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell:${rowKey}:${week}`,
    data: { type: "cell", week },
  });
  return (
    <div
      ref={setNodeRef}
      className={`border-r border-gray-100 transition-colors ${
        isOver ? "bg-[#fef3c7] ring-2 ring-[#facc15] ring-inset" : isCurrent ? "bg-[#fffbeb]" : ""
      }`}
      style={{ width: COL_W, height: "100%" }}
    />
  );
}

// ── PoolDropZone (retrait d'un placement en glissant vers le pool) ───────────
function PoolDropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL_DROPPABLE_ID });
  return (
    <div
      ref={setNodeRef}
      className={`glass-card rounded-2xl p-4 transition-all ${
        isOver ? "bg-[#fef3c7] ring-2 ring-[#facc15] ring-inset" : ""
      }`}
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
              className={`w-full px-3 py-2.5 rounded-xl border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#facc15] ${
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
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#facc15]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Couleur (optionnel)</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setColor(null)}
                className={`w-8 h-8 rounded-full border-2 ${
                  color === null ? "border-[#1d1d1f] ring-2 ring-[#facc15]" : "border-gray-200"
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
                    color === c ? "border-[#1d1d1f] ring-2 ring-[#facc15]" : "border-white/60"
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
              className="flex-1 btn-mba text-sm px-5 py-2.5 rounded-xl disabled:opacity-50"
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

  const loadYear = useCallback(async () => {
    const res = await fetch(`/api/planning/year-placements?year=${year}`);
    if (res.ok) setPlacements(await res.json());
  }, [year]);

  useEffect(() => {
    if (perms.yearView) loadYear();
  }, [year, perms.yearView, loadYear]);

  // ── Indexes ────────────────────────────────────────────────────────────────
  const weeks: IsoWeekInfo[] = useMemo(() => listWeeksOfYear(year), [year]);
  const totalWeeks = weeks.length;

  const siteById = useMemo(() => {
    const m = new Map<string, Site>();
    sites.forEach((s) => m.set(s.id, s));
    return m;
  }, [sites]);

  const activeSites = useMemo(
    () => sites.filter((s) => s.active && !SYSTEM_SITE_IDS.includes(s.id)),
    [sites]
  );

  const filteredPoolSites = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeSites;
    return activeSites.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.location ?? "").toLowerCase().includes(q)
    );
  }, [activeSites, search]);

  // Chantiers ayant au moins 1 placement = lignes affichées
  const placedSites = useMemo(() => {
    const ids = new Set(placements.map((p) => p.siteId));
    return activeSites.filter((s) => ids.has(s.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [placements, activeSites]);

  // Bars par site
  const barsBySite = useMemo(() => {
    const m = new Map<string, Bar[]>();
    placedSites.forEach((s) => {
      m.set(s.id, computeBarsForSite(s.id, placements));
    });
    return m;
  }, [placements, placedSites]);

  const currentIso = useMemo(() => getIsoWeek(new Date()), []);

  // ── Drag handlers ──────────────────────────────────────────────────────────
  function handleDragStart(e: DragStartEvent) {
    const data = e.active.data.current as { type: string; siteId?: string } | undefined;
    if (data?.type === "pool" && data.siteId) {
      const s = siteById.get(data.siteId);
      if (s) setActiveDragSite(s);
    }
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveDragSite(null);
    const { active, over } = e;
    const data = active.data.current as
      | {
          type: "pool" | "resize";
          siteId?: string;
          side?: "left" | "right";
          startWeek?: number;
          endWeek?: number;
        }
      | undefined;
    if (!data) return;

    // ── Resize d'une barre ──────────────────────────────────────────────────
    if (data.type === "resize" && data.siteId && data.startWeek != null && data.endWeek != null) {
      const weekDelta = Math.round(e.delta.x / COL_W);
      if (weekDelta === 0) return;
      await applyResize(data.siteId, data.startWeek, data.endWeek, data.side!, weekDelta);
      return;
    }

    // ── Drop depuis le pool ─────────────────────────────────────────────────
    if (data.type === "pool" && data.siteId) {
      if (!over) return;
      const overId = String(over.id);

      // Drop sur le pool = no-op (le chantier est déjà dans le pool)
      if (overId === POOL_DROPPABLE_ID) return;

      const overData = over.data.current as { type?: string; week?: number } | undefined;
      if (overData?.type !== "cell" || overData.week == null) return;

      await createPlacement(data.siteId, overData.week);
    }
  }

  // ── Operations ─────────────────────────────────────────────────────────────
  async function createPlacement(siteId: string, week: number) {
    // Optimistic
    const newP: YearPlacement = {
      id: generateYearPlacementId(),
      siteId,
      year,
      isoWeek: week,
    };
    // Évite les doublons locaux
    if (placements.some((p) => p.siteId === siteId && p.isoWeek === week)) return;
    setPlacements((prev) => [...prev, newP]);
    const res = await fetch("/api/planning/year-placements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newP),
    });
    if (!res.ok) {
      showToast("Placement échoué", "error");
      loadYear();
      return;
    }
    try {
      const created = await res.json();
      setPlacements((prev) => prev.map((p) => (p.id === newP.id ? { ...p, id: created.id } : p)));
    } catch {
      loadYear();
    }
  }

  async function removePlacements(ids: string[]) {
    if (ids.length === 0) return;
    setPlacements((prev) => prev.filter((p) => !ids.includes(p.id)));
    await Promise.all(
      ids.map((id) => fetch(`/api/planning/year-placements/${id}`, { method: "DELETE" }))
    );
  }

  async function applyResize(
    siteId: string,
    startWeek: number,
    endWeek: number,
    side: "left" | "right",
    weekDelta: number
  ) {
    let newStart = startWeek;
    let newEnd = endWeek;
    if (side === "right") {
      newEnd = Math.max(startWeek, Math.min(totalWeeks, endWeek + weekDelta));
    } else {
      newStart = Math.max(1, Math.min(endWeek, startWeek + weekDelta));
    }

    const weeksToAdd: number[] = [];
    const weeksToRemove: number[] = [];

    if (side === "right") {
      if (newEnd > endWeek) {
        for (let w = endWeek + 1; w <= newEnd; w++) weeksToAdd.push(w);
      } else if (newEnd < endWeek) {
        for (let w = newEnd + 1; w <= endWeek; w++) weeksToRemove.push(w);
      }
    } else {
      if (newStart < startWeek) {
        for (let w = newStart; w < startWeek; w++) weeksToAdd.push(w);
      } else if (newStart > startWeek) {
        for (let w = startWeek; w < newStart; w++) weeksToRemove.push(w);
      }
    }

    if (weeksToAdd.length === 0 && weeksToRemove.length === 0) return;

    // Optimistic
    setPlacements((prev) => {
      let next = prev;
      if (weeksToRemove.length > 0) {
        next = next.filter(
          (p) => !(p.siteId === siteId && p.year === year && weeksToRemove.includes(p.isoWeek))
        );
      }
      if (weeksToAdd.length > 0) {
        const adds = weeksToAdd.map((w) => ({
          id: generateYearPlacementId(),
          siteId,
          year,
          isoWeek: w,
        }));
        next = [...next, ...adds];
      }
      return next;
    });

    const res = await fetch("/api/planning/year-placements/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, year, weeksToAdd, weeksToRemove }),
    });
    if (!res.ok) {
      showToast("Redimensionnement échoué", "error");
      loadYear();
      return;
    }
    // Recharge pour récupérer les vrais IDs
    loadYear();
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

  // ── Scroll auto vers la semaine en cours ──────────────────────────────────
  useEffect(() => {
    if (year === currentIso.year && scrollRef.current) {
      const container = scrollRef.current;
      const target = (currentIso.week - 1) * COL_W;
      container.scrollLeft = Math.max(0, target - container.clientWidth / 2 + COL_W / 2);
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

  // Groupes de mois pour la barre supérieure
  const monthGroups: { monthIndex: number; weeks: IsoWeekInfo[] }[] = [];
  for (const w of weeks) {
    const last = monthGroups[monthGroups.length - 1];
    if (last && last.monthIndex === w.monthIndex) last.weeks.push(w);
    else monthGroups.push({ monthIndex: w.monthIndex, weeks: [w] });
  }

  return (
    <div className="min-h-screen bg-warm flex flex-col">
      <header className="glass sticky top-0 z-30">
        <div className="max-w-[1800px] mx-auto px-3 sm:px-5 py-2 sm:py-3 flex items-center justify-between gap-2">
          <NavButton href="/mba-construction" label="Retour" />
          <div className="text-sm font-bold text-[#1a1a1a] truncate text-center flex-1">
            Vue annuelle chantiers
          </div>
          <Link
            href="/planning"
            className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-[#1a1a1a] bg-white border border-gray-200 hover:bg-[#fef3c7] hover:border-[#facc15] rounded-xl active:scale-95 transition-all min-h-[44px]"
            title="Vue planning hebdomadaire"
          >
            <span className="hidden sm:inline">📅 Hebdo</span>
            <span className="sm:hidden">📅</span>
          </Link>
        </div>
        <div className="mba-accent-bar" />
      </header>

      <main className="flex-1 max-w-[1800px] w-full mx-auto px-3 sm:px-5 py-3 sm:py-4 flex flex-col min-h-0">
        {/* Sélecteur d'année */}
        <div className="glass-card rounded-2xl p-3 mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setYear((y) => y - 1)}
              className="w-10 h-10 rounded-xl bg-white hover:bg-[#fef3c7] hover:border-[#facc15] border border-gray-200 active:scale-95 transition-all text-base font-bold text-[#1a1a1a]"
              aria-label="Année précédente"
            >
              ‹
            </button>
            <button
              onClick={() => setYear((y) => y + 1)}
              className="w-10 h-10 rounded-xl bg-white hover:bg-[#fef3c7] hover:border-[#facc15] border border-gray-200 active:scale-95 transition-all text-base font-bold text-[#1a1a1a]"
              aria-label="Année suivante"
            >
              ›
            </button>
            <button
              onClick={() => setYear(new Date().getFullYear())}
              className="ml-1 px-3 py-2 rounded-xl bg-white hover:bg-[#fef3c7] hover:border-[#facc15] border border-gray-200 active:scale-95 transition-all text-xs font-semibold text-[#1a1a1a] min-h-[40px]"
            >
              Année en cours
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1 h-7 rounded bg-[#facc15]" />
            <div className="text-2xl font-bold text-[#1a1a1a] tracking-tight">{year}</div>
          </div>
          <div className="flex items-center gap-1.5">
            {perms.sites && (
              <Link
                href="/planning/chantiers"
                className="px-3 py-2 rounded-xl bg-white hover:bg-[#fef3c7] hover:border-[#facc15] border border-gray-200 active:scale-95 transition-all text-xs font-semibold text-[#1a1a1a] min-h-[40px]"
              >
                🏗️ Gérer
              </Link>
            )}
            {perms.sites && (
              <button
                onClick={() => setShowSiteModal(true)}
                className="px-3 py-2 rounded-xl btn-mba active:scale-95 text-xs min-h-[40px]"
              >
                + Chantier
              </button>
            )}
          </div>
        </div>

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {/* Pool des chantiers en haut */}
          <div className="mb-3">
            <PoolDropZone>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-[11px] font-bold text-[#1a1a1a] uppercase tracking-wide">
                    Chantiers
                  </div>
                  <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#facc15] text-[#1a1a1a] text-[11px] font-bold">
                    {filteredPoolSites.length}
                  </span>
                </div>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  className="flex-1 max-w-[280px] px-3 py-2 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#facc15] focus:border-[#facc15] transition-all"
                />
                <div className="text-[10px] text-[#9ca3af] italic hidden md:block">
                  Glissez sur une semaine, puis tirez les poignées pour étendre
                </div>
              </div>
              {filteredPoolSites.length === 0 ? (
                <div className="text-xs text-[#9ca3af] italic py-2">
                  {activeSites.length === 0
                    ? "Aucun chantier — créez-en un avec « + Chantier »."
                    : "Aucun résultat."}
                </div>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {filteredPoolSites.map((s) => (
                    <PoolSiteCard key={s.id} site={s} />
                  ))}
                </div>
              )}
            </PoolDropZone>
          </div>

          {/* Grille Kanban annuel */}
          <div className="flex-1 min-h-0 glass-card rounded-2xl overflow-hidden">
            <div ref={scrollRef} className="overflow-auto max-h-[68vh]">
              <div style={{ minWidth: SIDEBAR_W + totalWeeks * COL_W }}>
                {/* Bande mois */}
                <div className="flex sticky top-0 z-20 bg-[#fafaf7] border-b-2 border-[#facc15]">
                  <div
                    className="sticky left-0 z-30 bg-[#fafaf7] border-r-2 border-gray-200 px-3 py-2.5 text-[10px] font-bold text-[#1a1a1a] uppercase tracking-wider flex items-center"
                    style={{ width: SIDEBAR_W, minWidth: SIDEBAR_W }}
                  >
                    Chantier
                  </div>
                  {monthGroups.map((g, gi) => (
                    <div
                      key={`${g.monthIndex}-${gi}`}
                      className={`shrink-0 px-2 py-2.5 text-[11px] font-bold uppercase tracking-wider text-center border-r border-gray-200 text-[#1a1a1a] ${
                        gi % 2 === 0 ? "bg-[#fafaf7]" : "bg-white"
                      }`}
                      style={{ width: g.weeks.length * COL_W }}
                    >
                      {monthLabel(g.monthIndex)}
                    </div>
                  ))}
                </div>

                {/* En-têtes semaines */}
                <div className="flex sticky top-[37px] z-10 bg-white border-b-2 border-gray-200">
                  <div
                    className="sticky left-0 z-20 bg-white border-r-2 border-gray-200"
                    style={{ width: SIDEBAR_W, minWidth: SIDEBAR_W }}
                  />
                  {weeks.map((w) => {
                    const isCurrent = w.year === currentIso.year && w.week === currentIso.week;
                    return (
                      <div
                        key={`h-${w.week}`}
                        data-week={w.week}
                        className={`shrink-0 px-1 py-2 text-center border-r border-gray-100 ${
                          isCurrent ? "bg-[#fef3c7] border-l-2 border-l-[#facc15]" : ""
                        }`}
                        style={{ width: COL_W }}
                      >
                        <div className={`text-[10px] font-bold uppercase tracking-wide leading-none ${
                          isCurrent ? "text-[#854d0e]" : "text-[#1a1a1a]"
                        }`}>
                          S{w.week}
                        </div>
                        <div className={`text-[9px] mt-1 leading-none ${
                          isCurrent ? "text-[#854d0e]" : "text-[#9ca3af]"
                        }`}>
                          {formatWeekDates(w.monday, w.sunday)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Lignes chantiers */}
                {placedSites.map((site, rowIdx) => {
                  const bars = barsBySite.get(site.id) ?? [];
                  const rowBg = rowIdx % 2 === 0 ? "bg-white" : "bg-[#fafaf7]";
                  return (
                    <div key={site.id} className={`flex border-b border-gray-100 hover:bg-[#fef3c7]/30 transition-colors ${rowBg}`}>
                      {/* Sticky name column */}
                      <div
                        className={`sticky left-0 z-[5] border-r-2 border-gray-200 px-3 py-2 flex items-center ${rowBg}`}
                        style={{
                          width: SIDEBAR_W,
                          minWidth: SIDEBAR_W,
                          height: ROW_H,
                          borderLeft: `4px solid ${site.color ?? "#9ca3af"}`,
                        }}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#1a1a1a] truncate">
                            {site.name}
                          </div>
                          {site.location && (
                            <div className="text-[10px] text-[#6b7280] truncate">
                              {site.location}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Cells + bars */}
                      <div
                        className="relative flex"
                        style={{ height: ROW_H, width: totalWeeks * COL_W }}
                      >
                        {weeks.map((w) => (
                          <DropCell
                            key={`c-${site.id}-${w.week}`}
                            week={w.week}
                            rowKey={site.id}
                            isCurrent={w.year === currentIso.year && w.week === currentIso.week}
                          />
                        ))}
                        {bars.map((bar) => (
                          <BarComponent
                            key={`bar-${bar.startWeek}-${bar.endWeek}`}
                            bar={bar}
                            site={site}
                            onRemove={removePlacements}
                            canEdit={perms.yearPlace}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Phantom row pour ajouter un nouveau chantier */}
                <div className="flex border-b-2 border-dashed border-[#facc15]/40 bg-[#fffbeb]">
                  <div
                    className="sticky left-0 z-[5] bg-[#fffbeb] border-r-2 border-gray-200 px-3 py-2 flex items-center"
                    style={{
                      width: SIDEBAR_W,
                      minWidth: SIDEBAR_W,
                      height: ROW_H,
                      borderLeft: "4px dashed #facc15",
                    }}
                  >
                    <div className="text-[10px] font-semibold text-[#854d0e] italic truncate">
                      ✨ Glissez un chantier ici
                    </div>
                  </div>
                  <div
                    className="relative flex"
                    style={{ height: ROW_H, width: totalWeeks * COL_W }}
                  >
                    {weeks.map((w) => (
                      <DropCell
                        key={`phantom-${w.week}`}
                        week={w.week}
                        rowKey="phantom"
                        isCurrent={w.year === currentIso.year && w.week === currentIso.week}
                      />
                    ))}
                  </div>
                </div>

                {placedSites.length === 0 && (
                  <div className="px-6 py-12 text-center">
                    <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[#fef3c7] flex items-center justify-center text-2xl">
                      🗓️
                    </div>
                    <div className="text-sm font-semibold text-[#1a1a1a] mb-1">Aucun chantier placé</div>
                    <div className="text-xs text-[#6b7280]">Glissez un chantier depuis le pool ci-dessus pour démarrer.</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DragOverlay>
            {activeDragSite && (
              <div
                className="bg-white rounded-lg border border-gray-200 shadow-2xl px-2.5 py-1.5 text-xs rotate-2"
                style={{
                  borderLeft: `4px solid ${activeDragSite.color ?? "#9ca3af"}`,
                  width: 160,
                }}
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
