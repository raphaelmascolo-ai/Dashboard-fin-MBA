import { NextResponse } from "next/server";
import { createClient } from "../../lib/supabase/server";
import { createAdminClient } from "../../lib/supabase/admin";
import type { Commande } from "../../commandes/data";

// camelCase (frontend) → snake_case (DB)
function toRow(c: Commande, userId?: string | null) {
  return {
    id:            c.id,
    order_date:    c.orderDate,
    chantier:      c.chantier,
    fournisseur:   c.fournisseur,
    description:   c.description,
    amount:        c.amount,
    delivery_date: c.deliveryDate ?? null,
    devis_path:    c.devisPath ?? null,
    devis_name:    c.devisName ?? null,
    comment:       c.comment ?? "",
    company:       c.company ?? "MBA Construction SA",
    ...(userId ? { created_by: userId } : {}),
  };
}

// snake_case (DB) → camelCase (frontend)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(r: any): Commande {
  return {
    id:           r.id,
    orderDate:    r.order_date,
    chantier:     r.chantier,
    fournisseur:  r.fournisseur,
    description:  r.description,
    amount:       Number(r.amount ?? 0),
    deliveryDate: r.delivery_date ?? null,
    devisPath:    r.devis_path ?? null,
    devisName:    r.devis_name ?? null,
    comment:      r.comment ?? "",
    company:      r.company ?? "MBA Construction SA",
    createdAt:    r.created_at ?? null,
    createdBy:    r.created_by ?? null,
  };
}

async function getRole(userId: string): Promise<"admin" | "viewer"> {
  const admin = createAdminClient();
  const { data } = await admin.from("user_profiles").select("role").eq("id", userId).single();
  return (data?.role as "admin" | "viewer") ?? "viewer";
}

async function hasPermission(userId: string, types: string[]): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_permissions")
    .select("type")
    .eq("user_id", userId)
    .in("type", types);
  return (data ?? []).length > 0;
}

// GET /api/commandes?company=MBA+Construction+SA
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getRole(user.id);
  if (role !== "admin") {
    const ok = await hasPermission(user.id, [
      "access_mba_construction", "access_asv_fenetres",
      "commande_view", "commande_create", "commande_edit",
    ]);
    if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const company = url.searchParams.get("company");

  let query = supabase.from("commandes").select("*").order("order_date", { ascending: false });
  if (company) query = query.eq("company", company);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map(fromRow));
}

// POST /api/commandes — créer une commande
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getRole(user.id);
  if (role !== "admin") {
    const ok = await hasPermission(user.id, ["commande_create"]);
    if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body: Commande = await req.json();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("commandes")
    .insert(toRow(body, user.id))
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(fromRow(data), { status: 201 });
}
