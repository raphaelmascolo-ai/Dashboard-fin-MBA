import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { getPlanningPerms } from "../../_helpers";
import type { Site } from "../../../../planning/data";

function toRow(s: Site) {
  return {
    name: s.name,
    location: s.location ?? null,
    color: s.color ?? null,
    active: s.active,
    sort_order: s.sortOrder,
  };
}

// PUT /api/planning/sites/[id]
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perms = await getPlanningPerms(user.id);
  if (!perms.sites) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Vérifie que ce n'est pas un site système (lecture seule sauf admin)
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("planning_sites")
    .select("system")
    .eq("id", id)
    .single();
  if (existing?.system && !perms.isAdmin) {
    return NextResponse.json({ error: "Site système non modifiable" }, { status: 403 });
  }

  const body: Site = await req.json();
  const { error } = await admin.from("planning_sites").update(toRow(body)).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/planning/sites/[id]  → soft delete (active=false)
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perms = await getPlanningPerms(user.id);
  if (!perms.sites) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("planning_sites")
    .select("system")
    .eq("id", id)
    .single();
  if (existing?.system) {
    return NextResponse.json({ error: "Site système non supprimable" }, { status: 403 });
  }

  const { error } = await admin.from("planning_sites").update({ active: false }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
