import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import type { Vehicle } from "../../../vehicules/data";

function toRow(v: Vehicle) {
  return {
    id:               v.id,
    type:             v.type,
    brand:            v.brand,
    plate:            v.plate ?? null,
    year:             v.year,
    notes:            v.notes,
    last_expertise:   v.lastExpertise ?? null,
    last_service:     v.lastService ?? null,
    purchase_price:   v.purchasePrice,
    company:          v.company,
    billed_to_mbas:   v.billedToMBAS,
    leasing_monthly:  v.leasingMonthly,
    leasing_number:   v.leasingNumber ?? null,
    leasing_end:      v.leasingEnd ?? null,
    insurance_monthly: v.insuranceMonthly,
    resale_monthly:   v.resaleMonthly,
    refacturing_rate: v.refacturingRate,
    refacturing_unit: v.refacturingUnit,
    refacturing_to:   v.refacturingTo,
  };
}

async function requireAdmin(userId: string) {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("user_profiles").select("role").eq("id", userId).single();
  return profile?.role === "admin";
}

// PUT /api/vehicles/[id]
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body: Vehicle = await req.json();
  const admin = createAdminClient();
  const { error } = await admin.from("vehicles").update(toRow(body)).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/vehicles/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { error } = await admin.from("vehicles").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
