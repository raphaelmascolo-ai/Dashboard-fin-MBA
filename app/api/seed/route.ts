import { NextResponse } from "next/server";
import { createClient } from "../../lib/supabase/server";
import { createAdminClient } from "../../lib/supabase/admin";
import { mortgages as defaultMortgages, type Mortgage } from "../../data";

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

// POST /api/seed — seeds default mortgages (admin only, safe to run multiple times)
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("user_profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = defaultMortgages.map(toRow);
  const { error } = await admin
    .from("mortgages")
    .upsert(rows, { onConflict: "id", ignoreDuplicates: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ seeded: rows.length });
}
