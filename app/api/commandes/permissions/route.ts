import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";

// GET /api/commandes/permissions
// Renvoie les capacités de l'utilisateur courant pour le module Commandes.
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") {
    return NextResponse.json({ view: true, create: true, edit: true });
  }

  const { data: perms } = await admin
    .from("user_permissions")
    .select("type")
    .eq("user_id", user.id)
    .in("type", ["commande_view", "commande_create", "commande_edit"]);

  const types = new Set((perms ?? []).map((p) => p.type as string));
  const create = types.has("commande_create");
  const edit = types.has("commande_edit");
  const view = create || edit || types.has("commande_view");

  return NextResponse.json({ view, create, edit });
}
