import { NextResponse } from "next/server";
import { createClient } from "../../lib/supabase/server";
import { createAdminClient } from "../../lib/supabase/admin";
import type { Mortgage } from "../../data";

// camelCase (frontend) → snake_case (DB)
function toRow(m: Mortgage) {
  return {
    id:                     m.id,
    label:                  m.label,
    company:                m.company,
    total_amount:           m.totalAmount,
    start_date:             m.startDate,
    end_date:               m.endDate,
    rate_type:              m.rateType,
    rate:                   m.rate,
    annual_amortization:    m.annualAmortization,
    quarterly_amortization: m.quarterlyAmortization,
    remaining_at_end:       m.remainingAtEnd,
    remaining_today:        m.remainingToday,
    property_value:         m.propertyValue ?? null,
    property_group:         m.propertyGroup ?? null,
    shared:                 m.shared ?? false,
    monthly_rent:           m.monthlyRent ?? 0,
  };
}

// snake_case (DB) → camelCase (frontend)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(r: any): Mortgage {
  return {
    id:                     r.id,
    label:                  r.label,
    company:                r.company,
    totalAmount:            r.total_amount,
    startDate:              r.start_date,
    endDate:                r.end_date,
    rateType:               r.rate_type,
    rate:                   r.rate,
    annualAmortization:     r.annual_amortization,
    quarterlyAmortization:  r.quarterly_amortization,
    remainingAtEnd:         r.remaining_at_end,
    remainingToday:         r.remaining_today,
    propertyValue:          r.property_value ?? null,
    propertyGroup:          r.property_group ?? undefined,
    shared:                 r.shared ?? false,
    monthlyRent:            r.monthly_rent ?? 0,
  };
}

// GET /api/mortgages
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("mortgages")
    .select("*")
    .order("company")
    .order("label");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map(fromRow));
}

// POST /api/mortgages — create (admin only)
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("user_profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body: Mortgage = await req.json();
  const { data, error } = await admin.from("mortgages").insert(toRow(body)).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(fromRow(data), { status: 201 });
}
