import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import type { Commande } from "../../../commandes/data";

function toRow(c: Commande) {
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

async function canEdit(userId: string): Promise<boolean> {
  const role = await getRole(userId);
  if (role === "admin") return true;
  return hasPermission(userId, ["commande_edit"]);
}

// PUT /api/commandes/[id]
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canEdit(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body: Commande = await req.json();
  const admin = createAdminClient();
  const { error } = await admin.from("commandes").update(toRow(body)).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/commandes/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canEdit(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Récupérer le devis pour le supprimer du storage
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("commandes")
    .select("devis_path")
    .eq("id", id)
    .single();

  if (existing?.devis_path) {
    await admin.storage.from("commandes-devis").remove([existing.devis_path]);
  }

  const { error } = await admin.from("commandes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
