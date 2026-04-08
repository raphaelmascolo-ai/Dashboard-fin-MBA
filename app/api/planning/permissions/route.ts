import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { getPlanningPerms } from "../_helpers";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const perms = await getPlanningPerms(user.id);
  return NextResponse.json(perms);
}
