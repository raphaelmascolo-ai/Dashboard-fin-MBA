"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
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
  type Worker,
  type Site,
  type Assignment,
  type Holiday,
  type Period,
  SYSTEM_LEAVE_ID,
  SYSTEM_INSURANCE_ID,
  SYSTEM_SITE_IDS,
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  startOfWeek,
  addDays,
  toIsoDate,
  weekDates,
  formatWeekRange,
  formatDayHeader,
  formatDayLong,
  formatDayShort,
  nextWorkday,
  previousWorkday,
  clampToWorkday,
  roleColor,
  roleShort,
  workerLabel,
  periodLabel,
  generateAssignmentId,
} from "./data";
import NavButton from "../components/NavButton";

interface Permissions {
  isAdmin: boolean;
  view: boolean;
  workers: boolean;
  sites: boolean;
  assign: boolean;
  yearView: boolean;
  yearPlace: boolean;
}

type ViewMode = "day" | "week";

// ── Helpers ───────────────────────────────────────────────────────────────────
const POOL_DROPPABLE_ID = "POOL";
const SITE_DROPPABLE_PREFIX = "site:";

function siteDropId(siteId: string) {
  return `${SITE_DROPPABLE_PREFIX}${siteId}`;
}
function parseSiteDropId(id: string): string | null {
  return id.startsWith(SITE_DROPPABLE_PREFIX) ? id.slice(SITE_DROPPABLE_PREFIX.length) : null;
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

// ── WorkerChip (read-only badge, used in week view) ─────────────────────────
function WorkerChip({ worker, period }: { worker: Worker; period?: Period }) {
  const c = roleColor(worker.role);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold whitespace-nowrap"
      style={{ background: c.bg, color: c.text, borderColor: c.border }}
    >
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold"
        style={{ background: c.text, color: c.bg }}
      >
        {roleShort(worker.role)}
      </span>
      {workerLabel(worker)}
      {period && period !== "journée" && (
        <span className="text-[9px] font-bold opacity-70">{periodLabel(period)}</span>
      )}
    </span>
  );
}

// ── DraggableWorker ───────────────────────────────────────────────────────────
function DraggableWorker({
  worker,
  dragId,
  period,
  availPeriod,
  onTogglePeriod,
}: {
  worker: Worker;
  dragId: string;
  period?: Period;
  availPeriod?: "matin" | "après-midi";
  onTogglePeriod?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: {
      workerId: worker.id,
      fromAssignmentId: dragId.startsWith("a:") ? dragId.slice(2) : null,
      period: availPeriod ?? period ?? "journée",
    },
  });
  const c = roleColor(worker.role);
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        background: c.bg,
        color: c.text,
        borderColor: c.border,
        opacity: isDragging ? 0.4 : 1,
        touchAction: "none",
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold cursor-grab active:cursor-grabbing select-none shadow-sm hover:shadow min-h-[34px]"
      title={`${worker.firstName} ${worker.lastName}${period ? ` (${period})` : ""}`}
    >
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold"
        style={{ background: c.text, color: c.bg }}
      >
        {roleShort(worker.role)}
      </span>
      <span className="whitespace-nowrap">{workerLabel(worker)}</span>
      {period && onTogglePeriod && (
        <button
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onTogglePeriod();
          }}
          className="ml-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/60 hover:bg-white border border-current/20 active:scale-95 cursor-pointer"
          title="Cliquer pour changer: Journée / Matin / Après-midi"
        >
          {periodLabel(period)}
        </button>
      )}
      {availPeriod && (
        <span className="text-[9px] font-bold opacity-60">
          {availPeriod === "matin" ? "Matin" : "Après-midi"}
        </span>
      )}
    </div>
  );
}

// ── DroppableArea (générique pour pool ou site card) ─────────────────────────
function DroppableArea({
  id,
  isHoliday,
  className,
  children,
}: {
  id: string;
  isHoliday?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: isHoliday });
  return (
    <div
      ref={setNodeRef}
      className={`${className ?? ""} transition-colors ${
        isHoliday
          ? "bg-stone-100/60"
          : isOver
          ? "bg-amber-100/70 ring-2 ring-amber-300"
          : ""
      }`}
    >
      {children}
    </div>
  );
}

// ── Modal: Nouveau chantier rapide ────────────────────────────────────────────
function QuickSiteModal({
  saving,
  onSave,
  onClose,
}: {
  saving: boolean;
  onSave: (name: string, location: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [err, setErr] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErr("Le nom est requis");
      return;
    }
    onSave(name.trim(), location.trim());
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

// ── Modal: libellé jour férié ────────────────────────────────────────────────
function HolidayLabelModal({
  date,
  onSave,
  onClose,
}: {
  date: Date;
  onSave: (label: string) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xl p-0 sm:p-4">
      <div className="bg-white/95 backdrop-blur-2xl rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden border border-white/50">
        <div className="bg-white/60 border-b border-white/40 px-5 py-4">
          <div className="font-semibold text-base text-[#1d1d1f]">Marquer comme férié</div>
          <div className="text-[11px] text-[#86868b] mt-0.5">{formatDayLong(date)}</div>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Libellé (optionnel)
            </label>
            <input
              type="text"
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Vendredi Saint, 1er août, …"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              onKeyDown={(e) => {
                if (e.key === "Enter") onSave(label);
              }}
            />
          </div>
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ⚠ Toutes les assignations existantes sur ce jour seront retirées.
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-sm text-gray-500 px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={() => onSave(label)}
              className="flex-1 bg-[#1d1d1f] text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-[#333]"
            >
              Marquer férié
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function PlanningDashboard() {
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

  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [currentDay, setCurrentDay] = useState<Date>(() => clampToWorkday(new Date()));

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  const [activeDragWorker, setActiveDragWorker] = useState<Worker | null>(null);
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [savingSite, setSavingSite] = useState(false);
  const [holidayDateModal, setHolidayDateModal] = useState<Date | null>(null);

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Sensors avec délai tactile pour éviter les drags accidentels en scroll
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
        if (!p.view) {
          setAccessError("Vous n'avez pas accès à ce module.");
          setLoading(false);
          return;
        }
        const [wRes, sRes] = await Promise.all([
          fetch("/api/planning/workers"),
          fetch("/api/planning/sites"),
        ]);
        if (wRes.ok) setWorkers(await wRes.json());
        if (sRes.ok) setSites(await sRes.json());
      } catch {
        setAccessError("Erreur de chargement.");
      }
      setLoading(false);
    })();
  }, []);

  // Charge la semaine englobant le currentDay (la vue jour utilise un sous-ensemble)
  const monday = useMemo(() => startOfWeek(currentDay), [currentDay]);

  const loadWeek = useCallback(async () => {
    const week = toIsoDate(monday);
    const [aRes, hRes] = await Promise.all([
      fetch(`/api/planning/assignments?week=${week}`),
      fetch(`/api/planning/holidays?week=${week}`),
    ]);
    if (aRes.ok) setAssignments(await aRes.json());
    if (hRes.ok) setHolidays(await hRes.json());
  }, [monday]);

  useEffect(() => {
    if (perms.view) loadWeek();
  }, [monday, perms.view, loadWeek]);

  // ── Indexes ────────────────────────────────────────────────────────────────
  const days = useMemo(() => weekDates(monday), [monday]);
  const dayIsoList = useMemo(() => days.map(toIsoDate), [days]);
  const currentDayIso = useMemo(() => toIsoDate(currentDay), [currentDay]);
  const holidaySet = useMemo(() => new Set(holidays.map((h) => h.dayDate)), [holidays]);
  const holidayMap = useMemo(() => {
    const m = new Map<string, string>();
    holidays.forEach((h) => m.set(h.dayDate, h.label));
    return m;
  }, [holidays]);

  const workerById = useMemo(() => {
    const m = new Map<string, Worker>();
    workers.forEach((w) => m.set(w.id, w));
    return m;
  }, [workers]);

  // Sites visibles: actifs + system, system en bas
  const visibleSites = useMemo(() => {
    return sites
      .filter((s) => s.active || s.system)
      .sort((a, b) => {
        if (a.system !== b.system) return a.system ? 1 : -1;
        return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
      });
  }, [sites]);

  // Assignations indexées par site/jour
  const assignmentsByCell = useMemo(() => {
    const map: Record<string, Record<string, Assignment[]>> = {};
    assignments.forEach((a) => {
      if (!map[a.siteId]) map[a.siteId] = {};
      if (!map[a.siteId][a.dayDate]) map[a.siteId][a.dayDate] = [];
      map[a.siteId][a.dayDate].push(a);
    });
    return map;
  }, [assignments]);

  // Pool jour-courant: ouvriers pas encore fully assignés
  // Un ouvrier en "journée" n'est pas dans le pool.
  // Un ouvrier en "matin" seul est dans le pool comme dispo "après-midi".
  // Un ouvrier en "après-midi" seul est dans le pool comme dispo "matin".
  // Un ouvrier en matin + après-midi n'est pas dans le pool.
  const dayPool = useMemo(() => {
    const todayAssignments = assignments.filter((a) => a.dayDate === currentDayIso);
    const byWorker = new Map<string, Set<string>>();
    todayAssignments.forEach((a) => {
      if (!byWorker.has(a.workerId)) byWorker.set(a.workerId, new Set());
      byWorker.get(a.workerId)!.add(a.period);
    });
    return workers
      .filter((w) => w.active)
      .map((w) => {
        const periods = byWorker.get(w.id);
        if (!periods) return { worker: w, availPeriod: undefined as "matin" | "après-midi" | undefined };
        if (periods.has("journée")) return null; // fully booked
        if (periods.has("matin") && periods.has("après-midi")) return null; // fully booked
        if (periods.has("matin")) return { worker: w, availPeriod: "après-midi" as const };
        if (periods.has("après-midi")) return { worker: w, availPeriod: "matin" as const };
        return { worker: w, availPeriod: undefined };
      })
      .filter(Boolean) as { worker: Worker; availPeriod: "matin" | "après-midi" | undefined }[];
  }, [workers, assignments, currentDayIso]);

  const isCurrentDayHoliday = holidaySet.has(currentDayIso);
  const currentDayHolidayLabel = holidayMap.get(currentDayIso) ?? "";

  // ── Drag handlers ──────────────────────────────────────────────────────────
  function handleDragStart(e: DragStartEvent) {
    const data = e.active.data.current as { workerId: string } | undefined;
    if (data?.workerId) {
      const w = workerById.get(data.workerId);
      if (w) setActiveDragWorker(w);
    }
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveDragWorker(null);
    const { active, over } = e;
    if (!over) return;
    const data = active.data.current as
      | { workerId: string; fromAssignmentId: string | null; period?: Period }
      | undefined;
    if (!data) return;

    const overId = String(over.id);
    const dragPeriod: Period = data.period ?? "journée";

    // Drop sur le pool = retrait
    if (overId === POOL_DROPPABLE_ID) {
      if (!data.fromAssignmentId) return;
      const id = data.fromAssignmentId;
      setAssignments((prev) => prev.filter((a) => a.id !== id));
      const res = await fetch(`/api/planning/assignments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        showToast("Suppression échouée", "error");
        loadWeek();
      }
      return;
    }

    // Drop sur un site
    const targetSiteId = parseSiteDropId(overId);
    if (!targetSiteId) return;

    if (isCurrentDayHoliday) {
      showToast("Jour férié — assignation impossible", "error");
      return;
    }

    const oldAssignment = data.fromAssignmentId
      ? assignments.find((a) => a.id === data.fromAssignmentId)
      : null;

    // Si on drop sur le même site avec la même période, ne rien faire
    if (oldAssignment && oldAssignment.siteId === targetSiteId && oldAssignment.period === dragPeriod) return;

    const newAssignment: Assignment = {
      id: generateAssignmentId(),
      workerId: data.workerId,
      siteId: targetSiteId,
      dayDate: currentDayIso,
      period: dragPeriod,
    };

    // Optimistic: retire l'ancienne assignation du même ouvrier/même période + ajoute la nouvelle
    setAssignments((prev) => {
      let next = oldAssignment ? prev.filter((a) => a.id !== oldAssignment.id) : prev;
      // Si "journée", supprime aussi les demi-journées
      if (dragPeriod === "journée") {
        next = next.filter(
          (a) => !(a.workerId === data.workerId && a.dayDate === currentDayIso)
        );
      }
      return [...next, newAssignment];
    });

    const res = await fetch("/api/planning/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newAssignment),
    });
    if (!res.ok) {
      showToast("Assignation échouée", "error");
      loadWeek();
      return;
    }
    try {
      const created = await res.json();
      setAssignments((prev) =>
        prev.map((a) => (a.id === newAssignment.id ? { ...a, id: created.id } : a))
      );
    } catch {
      loadWeek();
    }
  }

  // ── Toggle period (J → M → AM → J) ─────────────────────────────────────────
  async function togglePeriod(assignmentId: string) {
    const a = assignments.find((x) => x.id === assignmentId);
    if (!a) return;
    const nextPeriod: Period =
      a.period === "journée" ? "matin" : a.period === "matin" ? "après-midi" : "journée";

    // Optimistic
    setAssignments((prev) =>
      prev.map((x) => (x.id === assignmentId ? { ...x, period: nextPeriod } : x))
    );

    const res = await fetch(`/api/planning/assignments/${assignmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: nextPeriod }),
    });
    if (!res.ok) {
      showToast("Changement échoué", "error");
      loadWeek();
    }
  }

  // ── Holidays ───────────────────────────────────────────────────────────────
  async function toggleHoliday(date: Date) {
    const iso = toIsoDate(date);
    if (holidaySet.has(iso)) {
      const res = await fetch(`/api/planning/holidays/${iso}`, { method: "DELETE" });
      if (!res.ok) {
        showToast("Erreur", "error");
        return;
      }
      setHolidays((prev) => prev.filter((h) => h.dayDate !== iso));
    } else {
      setHolidayDateModal(date);
    }
  }

  async function confirmHoliday(label: string) {
    if (!holidayDateModal) return;
    const iso = toIsoDate(holidayDateModal);
    setHolidayDateModal(null);
    const res = await fetch("/api/planning/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dayDate: iso, label }),
    });
    if (!res.ok) {
      showToast("Erreur", "error");
      return;
    }
    setHolidays((prev) => [...prev, { dayDate: iso, label }]);
    setAssignments((prev) => prev.filter((a) => a.dayDate !== iso));
  }

  // ── Copy day (vue jour) ────────────────────────────────────────────────────
  async function copyPreviousDay() {
    const prev = previousWorkday(currentDay);
    const fromDay = toIsoDate(prev);
    const toDay = currentDayIso;
    if (isCurrentDayHoliday) {
      showToast("Jour férié — copie impossible", "error");
      return;
    }
    const todayCount = assignments.filter((a) => a.dayDate === toDay).length;
    let replace = false;
    if (todayCount > 0) {
      replace = window.confirm(
        `Ce jour contient déjà ${todayCount} assignation${todayCount > 1 ? "s" : ""}. Les remplacer par celles de ${formatDayShort(prev).toLowerCase()} ?`
      );
      if (!replace) return;
    }
    const res = await fetch("/api/planning/copy-day", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromDay, toDay, replace }),
    });
    if (!res.ok) {
      showToast("Copie échouée", "error");
      return;
    }
    const data = await res.json();
    showToast(
      `${data.inserted} assignation${data.inserted > 1 ? "s" : ""} reprise${data.inserted > 1 ? "s" : ""}`,
      "success"
    );
    await loadWeek();
  }

  // ── Quick site creation ────────────────────────────────────────────────────
  async function createQuickSite(name: string, location: string) {
    setSavingSite(true);
    const newSite: Site = {
      id: `SITE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
      name,
      location: location || null,
      color: null,
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

  // ── Désactivation chantier (depuis la vue jour) ─────────────────────────────
  async function deactivateSite(site: Site) {
    if (site.system) return;
    if (!window.confirm(`Désactiver le chantier « ${site.name} » ?\n\nIl ne sera plus visible dans le planning courant. L'historique reste préservé.`)) return;
    const res = await fetch(`/api/planning/sites/${site.id}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("Désactivation échouée", "error");
      return;
    }
    setSites((prev) => prev.map((s) => (s.id === site.id ? { ...s, active: false } : s)));
    showToast("Chantier désactivé", "success");
  }

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

  return (
    <div className="min-h-screen bg-warm">
      <header className="glass sticky top-0 z-30 border-b border-white/30">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-5 py-2 sm:py-3 flex items-center justify-between gap-2">
          <NavButton href="/mba-construction" label="Retour" />
          <div className="text-sm font-semibold text-[#1d1d1f] truncate text-center flex-1">
            Planning Chantiers
          </div>
          <div className="flex items-center gap-1">
            {perms.yearView && (
              <Link
                href="/planning/annuel"
                className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-[#1d1d1f] bg-white/60 border border-white/40 rounded-xl hover:bg-white/80 active:scale-95 transition-all min-h-[44px]"
                title="Vue annuelle Kanban"
              >
                <span className="hidden sm:inline">🗓️ Annuel</span>
                <span className="sm:hidden">🗓️</span>
              </Link>
            )}
            {perms.workers && (
              <Link
                href="/planning/ouvriers"
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-[#1d1d1f] bg-white/60 border border-white/40 rounded-xl hover:bg-white/80 active:scale-95 transition-all min-h-[44px]"
              >
                👷 Ouvriers
              </Link>
            )}
            {perms.sites && (
              <Link
                href="/planning/chantiers"
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-[#1d1d1f] bg-white/60 border border-white/40 rounded-xl hover:bg-white/80 active:scale-95 transition-all min-h-[44px]"
              >
                🏗️ Chantiers
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-3 sm:px-5 py-4 sm:py-6">
        {/* Toggle Jour / Semaine */}
        <div className="flex justify-center mb-4">
          <div className="inline-flex bg-white/60 border border-white/40 rounded-xl p-1 shadow-sm">
            <button
              onClick={() => setViewMode("day")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all min-h-[40px] ${
                viewMode === "day"
                  ? "bg-[#1d1d1f] text-white shadow"
                  : "text-[#86868b] hover:text-[#1d1d1f]"
              }`}
            >
              📅 Jour
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all min-h-[40px] ${
                viewMode === "week"
                  ? "bg-[#1d1d1f] text-white shadow"
                  : "text-[#86868b] hover:text-[#1d1d1f]"
              }`}
            >
              🗓️ Semaine (lecture)
            </button>
          </div>
        </div>

        {viewMode === "day" ? (
          /* ═══════════════════ VUE JOUR ═══════════════════ */
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            {/* Sélecteur de jour */}
            <div className="glass-card rounded-2xl p-3 sm:p-4 mb-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <button
                  onClick={() => setCurrentDay(previousWorkday(currentDay))}
                  className="w-11 h-11 rounded-xl bg-white/60 hover:bg-white border border-white/40 active:scale-95 transition-all text-lg shrink-0"
                  aria-label="Jour précédent"
                >
                  ‹
                </button>
                <div className="flex-1 text-center min-w-0">
                  <div className="text-base sm:text-lg font-bold text-[#1d1d1f] truncate">
                    {formatDayLong(currentDay)}
                  </div>
                  {isCurrentDayHoliday && (
                    <div className="mt-1">
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wide bg-stone-200 text-stone-700 px-2 py-0.5 rounded">
                        Férié
                      </span>
                      {currentDayHolidayLabel && (
                        <span className="text-[11px] text-stone-600 ml-2">{currentDayHolidayLabel}</span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setCurrentDay(nextWorkday(currentDay))}
                  className="w-11 h-11 rounded-xl bg-white/60 hover:bg-white border border-white/40 active:scale-95 transition-all text-lg shrink-0"
                  aria-label="Jour suivant"
                >
                  ›
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentDay(clampToWorkday(new Date()))}
                  className="px-3 py-2 rounded-xl bg-white/60 hover:bg-white border border-white/40 active:scale-95 transition-all text-xs font-medium min-h-[40px]"
                >
                  Aujourd&apos;hui
                </button>
                {perms.assign && !isCurrentDayHoliday && (
                  <button
                    onClick={copyPreviousDay}
                    className="px-3 py-2 rounded-xl bg-white/60 hover:bg-white border border-white/40 active:scale-95 transition-all text-xs font-medium min-h-[40px]"
                  >
                    ↺ Reprendre {formatDayShort(previousWorkday(currentDay)).toLowerCase()}
                  </button>
                )}
                {perms.assign && (
                  <button
                    onClick={() => toggleHoliday(currentDay)}
                    className={`px-3 py-2 rounded-xl border active:scale-95 transition-all text-xs font-medium min-h-[40px] ${
                      isCurrentDayHoliday
                        ? "bg-stone-200 border-stone-300 text-stone-700"
                        : "bg-white/60 border-white/40 hover:bg-white"
                    }`}
                  >
                    {isCurrentDayHoliday ? "✕ Retirer férié" : "🚫 Marquer férié"}
                  </button>
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

            {/* Pool ouvriers disponibles */}
            <DroppableArea
              id={POOL_DROPPABLE_ID}
              className="glass-card rounded-2xl p-3 sm:p-4 mb-4 min-h-[88px]"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  Ouvriers disponibles
                </div>
                <div className="text-[11px] font-semibold text-gray-400">
                  {dayPool.length} / {workers.filter((w) => w.active).length}
                </div>
              </div>
              {dayPool.length === 0 ? (
                <div className="text-xs text-gray-400 italic py-2">
                  {workers.filter((w) => w.active).length === 0
                    ? "Aucun ouvrier — ajoutez-en via la page Ouvriers."
                    : "Tous les ouvriers sont placés."}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {dayPool.map((item) => (
                    <DraggableWorker
                      key={`${item.worker.id}-${item.availPeriod ?? "full"}`}
                      worker={item.worker}
                      dragId={`pool:${item.worker.id}:${item.availPeriod ?? "journée"}`}
                      availPeriod={item.availPeriod}
                    />
                  ))}
                </div>
              )}
            </DroppableArea>

            {/* Liste des chantiers (cards verticales) */}
            <div className="space-y-3">
              {visibleSites.map((site) => {
                const isSystem = SYSTEM_SITE_IDS.includes(site.id);
                const cellAssignments = assignmentsByCell[site.id]?.[currentDayIso] ?? [];
                const workerCount = cellAssignments.length;
                const sideColor = site.color ?? (
                  site.id === SYSTEM_LEAVE_ID ? "#9ca3af" :
                  site.id === SYSTEM_INSURANCE_ID ? "#60a5fa" :
                  site.id === "SYS-DEPOT" ? "#a78bfa" :
                  "#d4d4d4"
                );
                const cardBg = isSystem
                  ? site.id === SYSTEM_LEAVE_ID
                    ? "bg-stone-50/80"
                    : site.id === "SYS-DEPOT"
                    ? "bg-purple-50/50"
                    : "bg-blue-50/60"
                  : "bg-white/70";

                return (
                  <DroppableArea
                    key={site.id}
                    id={siteDropId(site.id)}
                    isHoliday={isCurrentDayHoliday}
                    className={`rounded-2xl border border-white/60 shadow-sm overflow-hidden ${cardBg}`}
                  >
                    <div
                      className="flex items-stretch"
                      style={{ borderLeft: `4px solid ${sideColor}` }}
                    >
                      <div className="flex-1 min-w-0 p-3 sm:p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0 flex-1 flex items-center gap-2">
                            <div className="text-sm font-bold text-[#1d1d1f] truncate">{site.name}</div>
                            <span
                              className={`shrink-0 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[10px] font-bold ${
                                workerCount > 0
                                  ? "bg-[#facc15] text-[#1a1a1a]"
                                  : "bg-gray-100 text-gray-400"
                              }`}
                              title={`${workerCount} ouvrier${workerCount > 1 ? "s" : ""}`}
                            >
                              {workerCount}
                            </span>
                            {site.location && (
                              <div className="text-[11px] text-[#86868b] truncate hidden sm:block">{site.location}</div>
                            )}
                          </div>
                          {perms.sites && !isSystem && (
                            <button
                              onClick={() => deactivateSite(site)}
                              className="text-[10px] text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded-lg hover:bg-red-50 active:scale-95 transition-all shrink-0"
                              title="Désactiver ce chantier"
                            >
                              ✕ Désactiver
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5 min-h-[40px]">
                          {cellAssignments.length === 0 ? (
                            <div className="text-[11px] text-gray-300 italic self-center">
                              {isCurrentDayHoliday ? "—" : "Glissez un ouvrier ici"}
                            </div>
                          ) : (
                            cellAssignments.map((a) => {
                              const w = workerById.get(a.workerId);
                              if (!w) return null;
                              return (
                                <DraggableWorker
                                  key={a.id}
                                  worker={w}
                                  dragId={`a:${a.id}`}
                                  period={a.period}
                                  onTogglePeriod={perms.assign ? () => togglePeriod(a.id) : undefined}
                                />
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </DroppableArea>
                );
              })}
            </div>

            <DragOverlay>
              {activeDragWorker && (
                <div
                  className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold shadow-2xl rotate-2"
                  style={{
                    background: roleColor(activeDragWorker.role).bg,
                    color: roleColor(activeDragWorker.role).text,
                    borderColor: roleColor(activeDragWorker.role).border,
                  }}
                >
                  <span
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold"
                    style={{
                      background: roleColor(activeDragWorker.role).text,
                      color: roleColor(activeDragWorker.role).bg,
                    }}
                  >
                    {roleShort(activeDragWorker.role)}
                  </span>
                  <span className="whitespace-nowrap">{workerLabel(activeDragWorker)}</span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        ) : (
          /* ═══════════════════ VUE SEMAINE (lecture seule) ═══════════════════ */
          <div>
            {/* Sélecteur de semaine */}
            <div className="glass-card rounded-2xl p-3 sm:p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentDay(addDays(monday, -7))}
                  className="w-11 h-11 rounded-xl bg-white/60 hover:bg-white border border-white/40 active:scale-95 transition-all text-lg"
                  aria-label="Semaine précédente"
                >
                  ‹
                </button>
                <button
                  onClick={() => setCurrentDay(addDays(monday, 7))}
                  className="w-11 h-11 rounded-xl bg-white/60 hover:bg-white border border-white/40 active:scale-95 transition-all text-lg"
                  aria-label="Semaine suivante"
                >
                  ›
                </button>
                <button
                  onClick={() => setCurrentDay(clampToWorkday(new Date()))}
                  className="ml-1 px-3 py-2 rounded-xl bg-white/60 hover:bg-white border border-white/40 active:scale-95 transition-all text-xs font-medium min-h-[40px]"
                >
                  Aujourd&apos;hui
                </button>
              </div>
              <div className="text-sm font-semibold text-[#1d1d1f]">{formatWeekRange(monday)}</div>
              <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                Lecture seule — passez en vue Jour pour modifier
              </div>
            </div>

            {/* Grille semaine read-only */}
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-stone-50 border-b-2 border-gray-300">
                      <th className="sticky left-0 z-10 bg-stone-50 text-left px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-[160px] min-w-[140px] border-r-2 border-gray-300">
                        Chantier
                      </th>
                      {days.map((d, i) => {
                        const iso = dayIsoList[i];
                        const isHoliday = holidaySet.has(iso);
                        const label = holidayMap.get(iso) ?? "";
                        const isToday = toIsoDate(new Date()) === iso;
                        return (
                          <th
                            key={iso}
                            className={`px-2 py-3 text-center min-w-[120px] border-r border-gray-200 last:border-r-0 ${
                              isHoliday ? "bg-stone-200" : isToday ? "bg-amber-100/60" : ""
                            }`}
                          >
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                                <span className="sm:hidden">{WEEKDAY_SHORT[i]}</span>
                                <span className="hidden sm:inline">{WEEKDAY_LABELS[i]}</span>
                              </div>
                              <div className="text-xs text-[#1d1d1f] font-mono">{formatDayHeader(d)}</div>
                              {isHoliday && (
                                <div className="mt-1">
                                  <span className="inline-block text-[9px] font-bold uppercase tracking-wide bg-stone-300 text-stone-700 px-1.5 py-0.5 rounded">
                                    Férié
                                  </span>
                                  {label && (
                                    <div className="text-[9px] text-stone-600 mt-0.5 max-w-[100px] truncate">
                                      {label}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSites.map((site, rowIdx) => {
                      const isSystem = SYSTEM_SITE_IDS.includes(site.id);
                      const sideColor = site.color ?? (
                        site.id === SYSTEM_LEAVE_ID ? "#9ca3af" :
                        site.id === SYSTEM_INSURANCE_ID ? "#60a5fa" :
                        "#d4d4d4"
                      );
                      const rowBg = isSystem
                        ? site.id === SYSTEM_LEAVE_ID
                          ? "bg-stone-50"
                          : "bg-blue-50/40"
                        : rowIdx % 2 === 0
                        ? "bg-white"
                        : "bg-stone-50/60";
                      return (
                        <tr key={site.id} className={`border-b-2 border-gray-200 ${rowBg}`}>
                          <td
                            className={`sticky left-0 z-[5] px-3 py-3 text-xs font-semibold text-[#1d1d1f] min-w-[140px] border-r-2 border-gray-300 ${rowBg}`}
                            style={{ borderLeft: `4px solid ${sideColor}` }}
                          >
                            <div className="truncate">{site.name}</div>
                            {site.location && (
                              <div className="text-[10px] text-gray-400 font-normal truncate">
                                {site.location}
                              </div>
                            )}
                          </td>
                          {dayIsoList.map((iso) => {
                            const cellAssignments = assignmentsByCell[site.id]?.[iso] ?? [];
                            const isHoliday = holidaySet.has(iso);
                            return (
                              <td
                                key={iso}
                                className={`border-r border-gray-200 last:border-r-0 align-top p-1.5 min-h-[60px] ${
                                  isHoliday ? "bg-stone-100" : ""
                                }`}
                              >
                                <div className="flex flex-wrap gap-1 content-start">
                                  {cellAssignments.map((a) => {
                                    const w = workerById.get(a.workerId);
                                    if (!w) return null;
                                    return <WorkerChip key={a.id} worker={w} period={a.period} />;
                                  })}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Liens vers pages secondaires sur mobile */}
        <div className="sm:hidden mt-4 flex gap-2">
          {perms.workers && (
            <Link
              href="/planning/ouvriers"
              className="flex-1 text-center px-3 py-3 text-xs font-medium text-[#1d1d1f] bg-white/60 border border-white/40 rounded-xl active:scale-95 transition-all"
            >
              👷 Ouvriers
            </Link>
          )}
          {perms.sites && (
            <Link
              href="/planning/chantiers"
              className="flex-1 text-center px-3 py-3 text-xs font-medium text-[#1d1d1f] bg-white/60 border border-white/40 rounded-xl active:scale-95 transition-all"
            >
              🏗️ Chantiers
            </Link>
          )}
        </div>
      </main>

      {showSiteModal && (
        <QuickSiteModal
          saving={savingSite}
          onSave={createQuickSite}
          onClose={() => setShowSiteModal(false)}
        />
      )}

      {holidayDateModal && (
        <HolidayLabelModal
          date={holidayDateModal}
          onSave={confirmHoliday}
          onClose={() => setHolidayDateModal(null)}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} />}
    </div>
  );
}
