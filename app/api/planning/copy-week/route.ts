import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { getPlanningPerms } from "../_helpers";

// POST /api/planning/copy-week  { fromWeek, toWeek, replace }
// fromWeek / toWeek = lundi YYYY-MM-DD
// Recopie les assignations actives, en sautant les jours fériés de toWeek.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perms = await getPlanningPerms(user.id);
  if (!perms.assign) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { fromWeek, toWeek, replace } = (await req.json()) as {
    fromWeek: string;
    toWeek: string;
    replace?: boolean;
  };
  if (!fromWeek || !toWeek) {
    return NextResponse.json({ error: "fromWeek/toWeek requis" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Bornes des deux semaines
  const addDays = (s: string, n: number) => {
    const d = new Date(s + "T00:00:00");
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const fromFri = addDays(fromWeek, 4);
  const toFri = addDays(toWeek, 4);

  // 1. Source: assignations de la semaine d'origine
  const { data: src, error: srcErr } = await admin
    .from("planning_assignments")
    .select("*, planning_workers!inner(active), planning_sites!inner(active)")
    .gte("day_date", fromWeek)
    .lte("day_date", fromFri);
  if (srcErr) return NextResponse.json({ error: srcErr.message }, { status: 500 });

  // 2. Filtre: ouvrier + chantier toujours actifs
  type Row = {
    id: string;
    worker_id: string;
    site_id: string;
    day_date: string;
    planning_workers: { active: boolean };
    planning_sites: { active: boolean };
  };
  const valid = ((src ?? []) as Row[]).filter(
    (r) => r.planning_workers?.active && r.planning_sites?.active
  );

  // 3. Jours fériés de la semaine cible
  const { data: holidays } = await admin
    .from("planning_holidays")
    .select("day_date")
    .gte("day_date", toWeek)
    .lte("day_date", toFri);
  const holidaySet = new Set((holidays ?? []).map((h) => h.day_date as string));

  // 4. Si replace, on vide les assignations actuelles de la semaine cible
  if (replace) {
    await admin
      .from("planning_assignments")
      .delete()
      .gte("day_date", toWeek)
      .lte("day_date", toFri);
  }

  // 5. Récupère les ouvriers déjà assignés dans la semaine cible
  // (pour ne pas violer la contrainte unique worker/day)
  const { data: existing } = await admin
    .from("planning_assignments")
    .select("worker_id, day_date")
    .gte("day_date", toWeek)
    .lte("day_date", toFri);
  const existingKeys = new Set(
    (existing ?? []).map((e) => `${e.worker_id}|${e.day_date}`)
  );

  // 6. Construit les nouvelles lignes en décalant les dates
  const dayDelta =
    (new Date(toWeek + "T00:00:00").getTime() -
      new Date(fromWeek + "T00:00:00").getTime()) /
    86400000;

  const rows = valid
    .map((r) => {
      const newDay = addDays(r.day_date, dayDelta);
      if (holidaySet.has(newDay)) return null;
      if (existingKeys.has(`${r.worker_id}|${newDay}`)) return null;
      // Marque comme déjà pris pour éviter doublons dans la même requête
      existingKeys.add(`${r.worker_id}|${newDay}`);
      return {
        id: `AS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        worker_id: r.worker_id,
        site_id: r.site_id,
        day_date: newDay,
      };
    })
    .filter(Boolean) as { id: string; worker_id: string; site_id: string; day_date: string }[];

  if (rows.length === 0) return NextResponse.json({ inserted: 0 });

  const { error: insErr } = await admin.from("planning_assignments").insert(rows);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ inserted: rows.length });
}
