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
        <Link href="/admin" className="flex items-center gap-1.5 text-xs font-medium text-[#1d1d1f] bg-white/60 hover:bg-white/80 border border-white/40 rounded-xl px-3 py-2 transition-all">
          <span>⚙</span>
          <span className="hidden sm:inline">Admin</span>
        </Link>
      )}
      <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs font-medium text-[#86868b] bg-white/40 hover:bg-white/60 hover:text-[#ff3b30] border border-white/30 rounded-xl px-3 py-2 transition-all">
        <span>⎋</span>
        <span className="hidden sm:inline">Déconnexion</span>
      </button>
    </div>
  );
}
