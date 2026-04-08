import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { getPlanningPerms } from "../_helpers";
import type { Holiday } from "../../../planning/data";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(r: any): Holiday {
  return { dayDate: r.day_date, label: r.label ?? "" };
}

// GET /api/planning/holidays?week=YYYY-MM-DD
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perms = await getPlanningPerms(user.id);
  if (!perms.view) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const weekStr = url.searchParams.get("week");
  if (!weekStr) return NextResponse.json({ error: "week required" }, { status: 400 });

  const monday = new Date(weekStr + "T00:00:00");
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const fridayStr = friday.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("planning_holidays")
    .select("*")
    .gte("day_date", weekStr)
    .lte("day_date", fridayStr);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map(fromRow));
}

// POST /api/planning/holidays  → upsert + supprime les assignations du jour
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perms = await getPlanningPerms(user.id);
  if (!perms.assign) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body: Holiday = await req.json();
  const admin = createAdminClient();

  // Upsert le jour férié
  const { error: upErr } = await admin
    .from("planning_holidays")
    .upsert({ day_date: body.dayDate, label: body.label ?? "" });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Supprime toutes les assignations de ce jour
  await admin.from("planning_assignments").delete().eq("day_date", body.dayDate);

  return NextResponse.json({ ok: true });
}
