import { createAdminClient } from "../../lib/supabase/admin";

export type PlanningPerm = "view" | "workers" | "sites" | "assign" | "yearView" | "yearPlace";

export interface PlanningPerms {
  isAdmin: boolean;
  view: boolean;
  workers: boolean;
  sites: boolean;
  assign: boolean;
  yearView: boolean;
  yearPlace: boolean;
}

export async function getRole(userId: string): Promise<"admin" | "viewer"> {
  const admin = createAdminClient();
  const { data } = await admin.from("user_profiles").select("role").eq("id", userId).single();
  return (data?.role as "admin" | "viewer") ?? "viewer";
}

export async function getPlanningPerms(userId: string): Promise<PlanningPerms> {
  const role = await getRole(userId);
  if (role === "admin") {
    return {
      isAdmin: true,
      view: true,
      workers: true,
      sites: true,
      assign: true,
      yearView: true,
      yearPlace: true,
    };
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_permissions")
    .select("type")
    .eq("user_id", userId)
    .in("type", [
      "access_mba_construction",
      "planning_view",
      "planning_workers",
      "planning_sites",
      "planning_assign",
      "planning_year_view",
      "planning_year_place",
    ]);
  const types = new Set((data ?? []).map((p) => p.type as string));

  // access_mba_construction = accès complet à tous les modules MBA Construction
  const fullAccess = types.has("access_mba_construction");

  const workers = fullAccess || types.has("planning_workers");
  const sites = fullAccess || types.has("planning_sites");
  const assign = fullAccess || types.has("planning_assign");
  const view = fullAccess || workers || sites || assign || types.has("planning_view");
  const yearPlace = fullAccess || types.has("planning_year_place");
  const yearView = fullAccess || yearPlace || types.has("planning_year_view");
  return { isAdmin: false, view, workers, sites, assign, yearView, yearPlace };
}
