import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { getPlanningPerms } from "../_helpers";
import type { Worker } from "../../../planning/data";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(r: any): Worker {
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    role: r.role,
    active: r.active,
  };
}

function toRow(w: Worker) {
  return {
    id: w.id,
    first_name: w.firstName,
    last_name: w.lastName,
    role: w.role,
    active: w.active,
  };
}

// GET /api/planning/workers
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perms = await getPlanningPerms(user.id);
  if (!perms.view) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("planning_workers")
    .select("*")
    .order("first_name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map(fromRow));
}

// POST /api/planning/workers
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perms = await getPlanningPerms(user.id);
  if (!perms.workers) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body: Worker = await req.json();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("planning_workers")
    .insert(toRow(body))
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(fromRow(data), { status: 201 });
}
