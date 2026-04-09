"use client";
import Link from "next/link";
import { createClient } from "../lib/supabase/client";

export default function HeaderActions({ isAdmin }: { isAdmin: boolean }) {
  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="flex items-center gap-2">
      {isAdmin && (
        <Link
          href="/admin"
          className="flex items-center gap-1.5 text-xs font-semibold text-[#1a1a1a] bg-white hover:bg-[#fef3c7] border border-gray-200 hover:border-[#facc15] rounded-xl px-3 py-2 transition-all min-h-[40px]"
        >
          <span>⚙</span>
          <span className="hidden sm:inline">Admin</span>
        </Link>
      )}
      <button
        onClick={handleLogout}
        className="flex items-center gap-1.5 text-xs font-semibold text-[#6b7280] bg-white hover:bg-red-50 hover:text-[#dc2626] border border-gray-200 hover:border-red-200 rounded-xl px-3 py-2 transition-all min-h-[40px]"
      >
        <span>⎋</span>
        <span className="hidden sm:inline">Déconnexion</span>
      </button>
    </div>
  );
}
