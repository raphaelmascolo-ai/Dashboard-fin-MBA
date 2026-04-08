import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { getPlanningPerms } from "../_helpers";
import type { YearPlacement } from "../../../planning/data";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(r: any): YearPlacement {
  return {
    id: r.id,
    siteId: r.site_id,
    year: r.year,
    isoWeek: r.iso_week,
  };
}

function toRow(p: YearPlacement, userId?: string | null) {
  return {
    id: p.id,
    site_id: p.siteId,
    year: p.year,
    iso_week: p.isoWeek,
    ...(userId ? { created_by: userId } : {}),
  };
}

// GET /api/planning/year-placements?year=YYYY
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perms = await getPlanningPerms(user.id);
  if (!perms.yearView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const yearStr = url.searchParams.get("year");
  if (!yearStr) return NextResponse.json({ error: "year required" }, { status: 400 });
  const year = parseInt(yearStr, 10);
  if (isNaN(year)) return NextResponse.json({ error: "year invalid" }, { status: 400 });

  const { data, error } = await supabase
    .from("planning_year_placements")
    .select("*")
    .eq("year", year)
    .order("iso_week");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map(fromRow));
}

// POST /api/planning/year-placements
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perms = await getPlanningPerms(user.id);
  if (!perms.yearPlace) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body: YearPlacement = await req.json();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("planning_year_placements")
    .insert(toRow(body, user.id))
    .select()
    .single();
  if (error) {
    // Conflit unique = même chantier déjà placé sur cette semaine
    if (error.code === "23505") {
      const { data: existing } = await admin
        .from("planning_year_placements")
        .select("*")
        .eq("site_id", body.siteId)
        .eq("year", body.year)
        .eq("iso_week", body.isoWeek)
        .single();
      if (existing) return NextResponse.json(fromRow(existing), { status: 200 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(fromRow(data), { status: 201 });
}
