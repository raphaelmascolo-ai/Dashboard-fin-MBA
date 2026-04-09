import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { getCommandePerms } from "../_helpers";

// GET /api/commandes/fournisseurs
// Retourne la liste DISTINCTE des fournisseurs déjà saisis dans les
// commandes existantes (triée alphabétiquement). Sert à alimenter
// l'autocomplete du formulaire de déclaration de commande.
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perms = await getCommandePerms(user.id);
  if (!perms.view) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("commandes")
    .select("fournisseur");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const set = new Set<string>();
  (data ?? []).forEach((r) => {
    const f = (r.fournisseur as string | null)?.trim();
    if (f) set.add(f);
  });
  const fournisseurs = Array.from(set).sort((a, b) => a.localeCompare(b, "fr-CH", { sensitivity: "base" }));
  return NextResponse.json(fournisseurs);
}
