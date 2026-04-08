import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { getPlanningPerms } from "../_helpers";

// POST /api/planning/copy-day  { fromDay, toDay, replace }
// Recopie les assignations d'un jour vers un autre.
// Filtre: ouvriers/chantiers inactifs + jour cible férié.
// Si replace=true, vide d'abord le jour cible.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perms = await getPlanningPerms(user.id);
  if (!perms.assign) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { fromDay, toDay, replace } = (await req.json()) as {
    fromDay: string;
    toDay: string;
    replace?: boolean;
  };
  if (!fromDay || !toDay) {
    return NextResponse.json({ error: "fromDay/toDay requis" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Refuse si le jour cible est férié
  const { data: holiday } = await admin
    .from("planning_holidays")
    .select("day_date")
    .eq("day_date", toDay)
    .maybeSingle();
  if (holiday) {
    return NextResponse.json({ error: "Jour férié — copie impossible" }, { status: 409 });
  }

  // Source: assignations du jour d'origine, avec ouvriers + chantiers actifs
  const { data: src, error: srcErr } = await admin
    .from("planning_assignments")
    .select("*, planning_workers!inner(active), planning_sites!inner(active)")
    .eq("day_date", fromDay);
  if (srcErr) return NextResponse.json({ error: srcErr.message }, { status: 500 });

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

  // Si replace, on vide d'abord le jour cible
  if (replace) {
    await admin.from("planning_assignments").delete().eq("day_date", toDay);
  }

  // Récupère les ouvriers déjà assignés au jour cible (pour skip)
  const { data: existing } = await admin
    .from("planning_assignments")
    .select("worker_id")
    .eq("day_date", toDay);
  const existingWorkerIds = new Set((existing ?? []).map((e) => e.worker_id as string));

  const rows = valid
    .filter((r) => !existingWorkerIds.has(r.worker_id))
    .map((r) => ({
      id: `AS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      worker_id: r.worker_id,
      site_id: r.site_id,
      day_date: toDay,
    }));

  if (rows.length === 0) return NextResponse.json({ inserted: 0 });

  const { error: insErr } = await admin.from("planning_assignments").insert(rows);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ inserted: rows.length });
}
