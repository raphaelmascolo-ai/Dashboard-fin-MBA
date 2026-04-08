import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { getPlanningPerms } from "../../_helpers";

// POST /api/planning/year-placements/batch
// Body: { siteId, year, weeksToAdd: number[], weeksToRemove: number[] }
// Permet d'ajouter/retirer plusieurs placements en un seul appel
// (utilisé par le redimensionnement des barres dans la vue annuelle).
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perms = await getPlanningPerms(user.id);
  if (!perms.yearPlace) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    siteId: string;
    year: number;
    weeksToAdd?: number[];
    weeksToRemove?: number[];
  };
  if (!body.siteId || !body.year) {
    return NextResponse.json({ error: "siteId/year requis" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Suppression d'abord
  if (body.weeksToRemove && body.weeksToRemove.length > 0) {
    const { error } = await admin
      .from("planning_year_placements")
      .delete()
      .eq("site_id", body.siteId)
      .eq("year", body.year)
      .in("iso_week", body.weeksToRemove);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Insertion ensuite (upsert pour ignorer les doublons)
  if (body.weeksToAdd && body.weeksToAdd.length > 0) {
    const rows = body.weeksToAdd.map((w) => ({
      id: `YP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      site_id: body.siteId,
      year: body.year,
      iso_week: w,
      created_by: user.id,
    }));
    const { error } = await admin
      .from("planning_year_placements")
      .upsert(rows, { onConflict: "site_id,year,iso_week", ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
