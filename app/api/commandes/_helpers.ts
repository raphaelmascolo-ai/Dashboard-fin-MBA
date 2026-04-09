import { createAdminClient } from "../../lib/supabase/admin";

export interface CommandePerms {
  isAdmin: boolean;
  view: boolean;
  create: boolean;
  edit: boolean;
}

export async function getCommandePerms(userId: string): Promise<CommandePerms> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (profile?.role === "admin") {
    return { isAdmin: true, view: true, create: true, edit: true };
  }
  const { data: perms } = await admin
    .from("user_permissions")
    .select("type")
    .eq("user_id", userId)
    .in("type", [
      "access_mba_construction",
      "access_asv_fenetres",
      "commande_view",
      "commande_create",
      "commande_edit",
    ]);
  const types = new Set((perms ?? []).map((p) => p.type as string));

  // access_mba_construction ou access_asv_fenetres = accès complet aux commandes
  const fullAccess = types.has("access_mba_construction") || types.has("access_asv_fenetres");

  const create = fullAccess || types.has("commande_create");
  const edit = fullAccess || types.has("commande_edit");
  const view = fullAccess || create || edit || types.has("commande_view");
  return { isAdmin: false, view, create, edit };
}
