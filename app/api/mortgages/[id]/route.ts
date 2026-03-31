import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import type { Mortgage } from "../../../data";

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

async function requireAdmin(userId: string) {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("user_profiles").select("role").eq("id", userId).single();
  return profile?.role === "admin";
}

// PUT /api/mortgages/[id]
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body: Mortgage = await req.json();
  const admin = createAdminClient();
  const { error } = await admin.from("mortgages").update(toRow(body)).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/mortgages/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { error } = await admin.from("mortgages").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
