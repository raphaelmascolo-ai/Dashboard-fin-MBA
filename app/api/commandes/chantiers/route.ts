import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { getCommandePerms } from "../_helpers";

// GET /api/commandes/chantiers
// Retourne la liste des chantiers actifs (depuis planning_sites) pour
// alimenter le sélecteur du formulaire de déclaration de commande.
// Filtre: actifs + non-system. Permission: au moins commande_view.
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perms = await getCommandePerms(user.id);
  if (!perms.view) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Lecture via le client admin pour bypasser les RLS du module planning
  // (un utilisateur "commandes" n'a pas forcément accès au module planning).
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("planning_sites")
    .select("id, name, location")
    .eq("active", true)
    .eq("system", false)
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    (data ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      location: (r.location as string | null) ?? null,
    }))
  );
}
