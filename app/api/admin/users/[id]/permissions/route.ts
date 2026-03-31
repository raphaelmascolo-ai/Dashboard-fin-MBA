import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";

async function requireAdmin(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("user_profiles").select("role").eq("id", userId).single();
  return data?.role === "admin";
}

// GET /api/admin/users/[id]/permissions
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await requireAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin.from("user_permissions").select("*").eq("user_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PUT /api/admin/users/[id]/permissions — replace all permissions for a user
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await requireAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const permissions: { type: string; value: string | null }[] = await req.json();

  const admin = createAdminClient();
  // Delete existing and insert new
  await admin.from("user_permissions").delete().eq("user_id", id);

  if (permissions.length > 0) {
    const rows = permissions.map(p => ({ user_id: id, type: p.type, value: p.value ?? null }));
    const { error } = await admin.from("user_permissions").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
