import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { getPlanningPerms } from "../_helpers";
import type { Assignment } from "../../../planning/data";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(r: any): Assignment {
  return {
    id: r.id,
    workerId: r.worker_id,
    siteId: r.site_id,
    dayDate: r.day_date,
  };
}

function toRow(a: Assignment) {
  return {
    id: a.id,
    worker_id: a.workerId,
    site_id: a.siteId,
    day_date: a.dayDate,
  };
}

// GET /api/planning/assignments?week=YYYY-MM-DD
// Renvoie les assignations sur les 5 jours ouvrés à partir du lundi indiqué.
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perms = await getPlanningPerms(user.id);
  if (!perms.view) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const weekStr = url.searchParams.get("week");
  if (!weekStr) return NextResponse.json({ error: "week required" }, { status: 400 });

  // Calcule le vendredi
  const monday = new Date(weekStr + "T00:00:00");
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const fridayStr = friday.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("planning_assignments")
    .select("*")
    .gte("day_date", weekStr)
    .lte("day_date", fridayStr);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map(fromRow));
}

// POST /api/planning/assignments → create
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perms = await getPlanningPerms(user.id);
  if (!perms.assign) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body: Assignment = await req.json();
  const admin = createAdminClient();

  // Refuse si le jour est férié
  const { data: holiday } = await admin
    .from("planning_holidays")
    .select("day_date")
    .eq("day_date", body.dayDate)
    .maybeSingle();
  if (holiday) return NextResponse.json({ error: "Jour férié" }, { status: 409 });

  const { data, error } = await admin
    .from("planning_assignments")
    .insert(toRow(body))
    .select()
    .single();
  if (error) {
    // Conflit unique key = doublon, on retourne l'existant comme succès
    if (error.code === "23505") {
      const { data: existing } = await admin
        .from("planning_assignments")
        .select("*")
        .eq("worker_id", body.workerId)
        .eq("site_id", body.siteId)
        .eq("day_date", body.dayDate)
        .single();
      if (existing) return NextResponse.json(fromRow(existing), { status: 200 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(fromRow(data), { status: 201 });
}
