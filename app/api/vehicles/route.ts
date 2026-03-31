import { NextResponse } from "next/server";
import { createClient } from "../../lib/supabase/server";
import { createAdminClient } from "../../lib/supabase/admin";
import type { Vehicle } from "../../vehicules/data";

// camelCase (frontend) → snake_case (DB)
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

// snake_case (DB) → camelCase (frontend)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(r: any): Vehicle {
  return {
    id:               r.id,
    type:             r.type,
    brand:            r.brand,
    plate:            r.plate ?? null,
    year:             r.year,
    notes:            r.notes,
    lastExpertise:    r.last_expertise ?? null,
    lastService:      r.last_service ?? null,
    purchasePrice:    r.purchase_price,
    company:          r.company,
    billedToMBAS:     r.billed_to_mbas,
    leasingMonthly:   r.leasing_monthly,
    leasingNumber:    r.leasing_number ?? null,
    leasingEnd:       r.leasing_end ?? null,
    insuranceMonthly: r.insurance_monthly,
    resaleMonthly:    r.resale_monthly,
    refacturingRate:  r.refacturing_rate,
    refacturingUnit:  r.refacturing_unit,
    refacturingTo:    r.refacturing_to,
  };
}

// GET /api/vehicles
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .order("type")
    .order("brand");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map(fromRow));
}

// POST /api/vehicles — create (admin only)
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("user_profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body: Vehicle = await req.json();
  const { data, error } = await admin.from("vehicles").insert(toRow(body)).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(fromRow(data), { status: 201 });
}
