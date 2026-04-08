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
  type WorkerRole,
  SYSTEM_LEAVE_ID,
  SYSTEM_INSURANCE_ID,
  SYSTEM_SITE_IDS,
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  startOfWeek,
  addDays,
  toIsoDate,
  fromIsoDate,
  weekDates,
  formatWeekRange,
  formatDayHeader,
  roleColor,
  roleShort,
  workerLabel,
  generateAssignmentId,
} from "./data";
import NavButton from "../components/NavButton";

interface Permissions {
  isAdmin: boolean;
  view: boolean;
  workers: boolean;
  sites: boolean;
  assign: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const POOL_DROPPABLE_ID = "POOL";

function cellId(siteId: string, dayDate: string) {
  return `cell:${siteId}:${dayDate}`;
}

function parseCellId(id: string): { siteId: string; dayDate: string } | null {
  if (!id.startsWith("cell:")) return null;
  const [, siteId, dayDate] = id.split(":");
  return { siteId, dayDate };
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

// ── WorkerCard (draggable) ────────────────────────────────────────────────────
function WorkerCard({
  worker,
  dragId,
  compact,
}: {
  worker: Worker;
  dragId: string;
  compact?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: { workerId: worker.id, fromAssignmentId: dragId.startsWith("a:") ? dragId.slice(2) : null },
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
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-semibold cursor-grab active:cursor-grabbing select-none shadow-sm hover:shadow ${
        compact ? "" : "min-h-[32px]"
      }`}
      title={`${worker.firstName} ${worker.lastName} (${worker.role})`}
    >
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold"
        style={{ background: c.text, color: c.bg }}
      >
        {roleShort(worker.role)}
      </span>
      <span className="whitespace-nowrap">{workerLabel(worker)}</span>
    </div>
  );
}

// ── DroppableCell ─────────────────────────────────────────────────────────────
function DroppableCell({
  id,
  isHoliday,
  children,
}: {
  id: string;
  isHoliday: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: isHoliday });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[60px] p-1.5 align-top transition-colors ${
        isHoliday
          ? "bg-stone-100/60"
          : isOver
          ? "bg-amber-100/70 ring-2 ring-amber-300 ring-inset"
          : "bg-white/40 hover:bg-white/60"
      }`}
    >
      <div className="flex flex-wrap gap-1 content-start">{children}</div>
    </div>
  );
}

// ── DroppablePool ─────────────────────────────────────────────────────────────
function DroppablePool({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL_DROPPABLE_ID });
  return (
    <div
      ref={setNodeRef}
      className={`glass-card rounded-2xl p-3 sm:p-4 min-h-[80px] transition-colors ${
        isOver ? "bg-blue-50/60 ring-2 ring-blue-300 ring-inset" : ""
      }`}
    >
      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Ouvriers
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
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

// ── Modal: Saisir un libellé pour le jour férié ──────────────────────────────
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
          <div className="text-[11px] text-[#86868b] mt-0.5">
            {date.toLocaleDateString("fr-CH", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
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
  });
  const [accessError, setAccessError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [monday, setMonday] = useState<Date>(() => startOfWeek(new Date()));
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

  // ── Sensors ────────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // ── Chargement initial: permissions + workers + sites ──────────────────────
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

  // ── Chargement par semaine: assignments + holidays ─────────────────────────
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

  // Active sites + system rows en haut (sortés par sort_order)
  const visibleSites = useMemo(() => {
    return sites
      .filter((s) => s.active || s.system)
      .sort((a, b) => {
        // System rows en bas
        if (a.system !== b.system) return a.system ? 1 : -1;
        return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
      });
  }, [sites]);

  // assignmentsByCell[siteId][dayDate] = Assignment[]
  const assignmentsByCell = useMemo(() => {
    const map: Record<string, Record<string, Assignment[]>> = {};
    assignments.forEach((a) => {
      if (!map[a.siteId]) map[a.siteId] = {};
      if (!map[a.siteId][a.dayDate]) map[a.siteId][a.dayDate] = [];
      map[a.siteId][a.dayDate].push(a);
    });
    return map;
  }, [assignments]);

  // Pool = tous les ouvriers actifs (vue "library")
  const activeWorkers = useMemo(() => workers.filter((w) => w.active), [workers]);

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
      | { workerId: string; fromAssignmentId: string | null }
      | undefined;
    if (!data) return;

    const overId = String(over.id);
    const toCell = parseCellId(overId);
    const toPool = overId === POOL_DROPPABLE_ID;
    if (!toCell && !toPool) return;

    // Drop sur jour férié → refusé
    if (toCell && holidaySet.has(toCell.dayDate)) {
      showToast("Jour férié — assignation impossible", "error");
      return;
    }

    // Drop sur le pool depuis une assignation existante = retrait
    if (toPool && data.fromAssignmentId) {
      const id = data.fromAssignmentId;
      // Optimistic
      setAssignments((prev) => prev.filter((a) => a.id !== id));
      const res = await fetch(`/api/planning/assignments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        showToast("Suppression échouée", "error");
        loadWeek();
      }
      return;
    }

    // Drop sur une cellule
    if (toCell) {
      // Si on déplace une assignation existante, on la retire d'abord (puis crée la nouvelle)
      const oldAssignment = data.fromAssignmentId
        ? assignments.find((a) => a.id === data.fromAssignmentId)
        : null;

      // Si même cellule, ne rien faire
      if (
        oldAssignment &&
        oldAssignment.siteId === toCell.siteId &&
        oldAssignment.dayDate === toCell.dayDate
      ) {
        return;
      }

      // Optimistic: ajoute la nouvelle assignation
      const newAssignment: Assignment = {
        id: generateAssignmentId(),
        workerId: data.workerId,
        siteId: toCell.siteId,
        dayDate: toCell.dayDate,
      };

      setAssignments((prev) => {
        const next = oldAssignment ? prev.filter((a) => a.id !== oldAssignment.id) : prev;
        return [...next, newAssignment];
      });

      // Appels API
      const tasks: Promise<Response>[] = [];
      if (oldAssignment) {
        tasks.push(fetch(`/api/planning/assignments/${oldAssignment.id}`, { method: "DELETE" }));
      }
      tasks.push(
        fetch("/api/planning/assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newAssignment),
        })
      );
      const results = await Promise.all(tasks);
      const createRes = results[results.length - 1];
      if (!createRes.ok) {
        showToast("Assignation échouée", "error");
        loadWeek();
        return;
      }
      // Récupère l'ID réel renvoyé par la DB
      try {
        const created = await createRes.json();
        setAssignments((prev) =>
          prev.map((a) => (a.id === newAssignment.id ? { ...a, id: created.id } : a))
        );
      } catch {
        loadWeek();
      }
    }
  }

  // ── Holidays ───────────────────────────────────────────────────────────────
  async function toggleHoliday(date: Date) {
    const iso = toIsoDate(date);
    if (holidaySet.has(iso)) {
      // Désactive
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
    // Vide les assignations locales pour ce jour
    setAssignments((prev) => prev.filter((a) => a.dayDate !== iso));
  }

  // ── Copy week ──────────────────────────────────────────────────────────────
  async function copyPreviousWeek() {
    const fromMonday = addDays(monday, -7);
    const fromWeek = toIsoDate(fromMonday);
    const toWeek = toIsoDate(monday);

    const hasExisting = assignments.length > 0;
    let replace = false;
    if (hasExisting) {
      replace = window.confirm(
        `Cette semaine contient déjà ${assignments.length} assignation${assignments.length > 1 ? "s" : ""}. Les remplacer par celles de la semaine précédente ?`
      );
      if (!replace) return;
    }

    const res = await fetch("/api/planning/copy-week", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromWeek, toWeek, replace }),
    });
    if (!res.ok) {
      showToast("Copie échouée", "error");
      return;
    }
    const data = await res.json();
    showToast(`${data.inserted} assignation${data.inserted > 1 ? "s" : ""} recopiée${data.inserted > 1 ? "s" : ""}`, "success");
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
        {/* Sélecteur de semaine */}
        <div className="glass-card rounded-2xl p-3 sm:p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonday((m) => addDays(m, -7))}
              className="w-10 h-10 rounded-xl bg-white/60 hover:bg-white border border-white/40 active:scale-95 transition-all text-lg"
              aria-label="Semaine précédente"
            >
              ‹
            </button>
            <button
              onClick={() => setMonday((m) => addDays(m, 7))}
              className="w-10 h-10 rounded-xl bg-white/60 hover:bg-white border border-white/40 active:scale-95 transition-all text-lg"
              aria-label="Semaine suivante"
            >
              ›
            </button>
            <button
              onClick={() => setMonday(startOfWeek(new Date()))}
              className="ml-1 px-3 py-2 rounded-xl bg-white/60 hover:bg-white border border-white/40 active:scale-95 transition-all text-xs font-medium min-h-[40px]"
            >
              Aujourd&apos;hui
            </button>
          </div>
          <div className="text-sm font-semibold text-[#1d1d1f]">{formatWeekRange(monday)}</div>
          <div className="flex items-center gap-2">
            {perms.assign && (
              <button
                onClick={copyPreviousWeek}
                className="px-3 py-2 rounded-xl bg-white/60 hover:bg-white border border-white/40 active:scale-95 transition-all text-xs font-medium min-h-[40px]"
              >
                ↺ Reprendre la semaine précédente
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

        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Pool des ouvriers */}
          <div className="mb-4">
            <DroppablePool>
              {activeWorkers.length === 0 && (
                <div className="text-xs text-gray-400 italic">
                  Aucun ouvrier — ajoutez-en via la page Ouvriers.
                </div>
              )}
              {activeWorkers.map((w) => (
                <WorkerCard key={w.id} worker={w} dragId={`pool:${w.id}`} />
              ))}
            </DroppablePool>
          </div>

          {/* Grille planning */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-white/50 border-b border-white/40">
                    <th className="sticky left-0 z-10 bg-white/70 backdrop-blur text-left px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-[160px] min-w-[140px]">
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
                          className={`px-2 py-2 text-center min-w-[120px] border-l border-white/40 ${
                            isHoliday ? "bg-stone-100/80" : isToday ? "bg-amber-50/60" : ""
                          }`}
                        >
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                              <span className="sm:hidden">{WEEKDAY_SHORT[i]}</span>
                              <span className="hidden sm:inline">{WEEKDAY_LABELS[i]}</span>
                            </div>
                            <div className="text-xs text-[#1d1d1f] font-mono">{formatDayHeader(d)}</div>
                            {isHoliday ? (
                              <div className="mt-1">
                                <span className="inline-block text-[9px] font-bold uppercase tracking-wide bg-stone-200 text-stone-700 px-1.5 py-0.5 rounded">
                                  Férié
                                </span>
                                {label && (
                                  <div className="text-[9px] text-stone-600 mt-0.5 max-w-[100px] truncate">
                                    {label}
                                  </div>
                                )}
                              </div>
                            ) : null}
                            {perms.assign && (
                              <button
                                onClick={() => toggleHoliday(d)}
                                className="text-[9px] text-[#0071e3] hover:underline mt-1 active:scale-95"
                              >
                                {isHoliday ? "Retirer férié" : "Marquer férié"}
                              </button>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {visibleSites.map((site) => {
                    const isSystem = SYSTEM_SITE_IDS.includes(site.id);
                    const rowBg = isSystem
                      ? site.id === SYSTEM_LEAVE_ID
                        ? "bg-stone-50/70"
                        : "bg-blue-50/50"
                      : "bg-white/30";
                    return (
                      <tr key={site.id} className={`border-t border-white/40 ${rowBg}`}>
                        <td
                          className={`sticky left-0 z-[5] px-3 py-2 text-xs font-semibold text-[#1d1d1f] min-w-[140px] backdrop-blur ${rowBg}`}
                          style={{
                            borderLeft: site.color
                              ? `3px solid ${site.color}`
                              : isSystem
                              ? `3px solid ${site.id === SYSTEM_LEAVE_ID ? "#9ca3af" : "#60a5fa"}`
                              : "3px solid transparent",
                          }}
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
                            <td key={iso} className="border-l border-white/40 align-top">
                              <DroppableCell id={cellId(site.id, iso)} isHoliday={isHoliday}>
                                {cellAssignments.map((a) => {
                                  const w = workerById.get(a.workerId);
                                  if (!w) return null;
                                  return (
                                    <WorkerCard
                                      key={a.id}
                                      worker={w}
                                      dragId={`a:${a.id}`}
                                      compact
                                    />
                                  );
                                })}
                              </DroppableCell>
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

          <DragOverlay>
            {activeDragWorker && (
              <div
                className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-semibold shadow-2xl rotate-2"
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
