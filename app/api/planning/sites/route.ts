import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { getPlanningPerms } from "../_helpers";
import type { Site } from "../../../planning/data";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(r: any): Site {
  return {
    id: r.id,
    name: r.name,
    location: r.location ?? null,
    color: r.color ?? null,
    active: r.active,
    system: r.system,
    sortOrder: r.sort_order ?? 0,
  };
}

function toRow(s: Site) {
  return {
    id: s.id,
    name: s.name,
    location: s.location ?? null,
    color: s.color ?? null,
    active: s.active,
    system: s.system,
    sort_order: s.sortOrder,
  };
}

// GET /api/planning/sites
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perms = await getPlanningPerms(user.id);
  if (!perms.view) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("planning_sites")
    .select("*")
    .order("sort_order")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map(fromRow));
}

// POST /api/planning/sites
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perms = await getPlanningPerms(user.id);
  if (!perms.sites) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body: Site = await req.json();
  // Empêche la création d'un site système via l'API publique
  body.system = false;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("planning_sites")
    .insert(toRow(body))
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(fromRow(data), { status: 201 });
}
