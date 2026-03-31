import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";

async function requireAdmin(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("user_profiles").select("role").eq("id", userId).single();
  return data?.role === "admin";
}

// GET /api/admin/users — list all users with their profiles
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await requireAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data: profiles, error } = await admin
    .from("user_profiles")
    .select("id, email, role, display_name, created_at")
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(profiles);
}

// POST /api/admin/users — create a new user
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await requireAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email, password, display_name, role } = await req.json();
  if (!email || !password) return NextResponse.json({ error: "email and password required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: newUser, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update profile role and display_name (trigger creates the row)
  await admin.from("user_profiles").update({ role: role ?? "viewer", display_name }).eq("id", newUser.user.id);

  return NextResponse.json({ id: newUser.user.id, email }, { status: 201 });
}
