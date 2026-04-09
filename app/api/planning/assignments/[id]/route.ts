import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { getPlanningPerms } from "../../_helpers";

// PATCH /api/planning/assignments/[id] → change period
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perms = await getPlanningPerms(user.id);
  if (!perms.assign) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { period } = (await req.json()) as { period: string };
  if (!["journée", "matin", "après-midi"].includes(period)) {
    return NextResponse.json({ error: "Période invalide" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Récupère l'assignation actuelle
  const { data: current } = await admin
    .from("planning_assignments")
    .select("*")
    .eq("id", id)
    .single();
  if (!current) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });

  if (period === "journée") {
    // Supprime les éventuelles demi-journées du même ouvrier ce jour
    await admin
      .from("planning_assignments")
      .delete()
      .eq("worker_id", current.worker_id)
      .eq("day_date", current.day_date)
      .neq("id", id);
  } else {
    // Supprime la même demi-journée si doublon (autre site)
    await admin
      .from("planning_assignments")
      .delete()
      .eq("worker_id", current.worker_id)
      .eq("day_date", current.day_date)
      .eq("period", period)
      .neq("id", id);
  }

  const { error } = await admin
    .from("planning_assignments")
    .update({ period })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/planning/assignments/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perms = await getPlanningPerms(user.id);
  if (!perms.assign) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { error } = await admin.from("planning_assignments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
