"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { companies as defaultCompanies } from "../data";

interface UserProfile {
  id: string;
  email: string;
  role: "admin" | "viewer";
  display_name: string | null;
  created_at: string;
}

interface Permission {
  type:
    | "all"
    | "company"
    | "vehicle_all"
    | "card"
    | "commande_view"
    | "commande_create"
    | "commande_edit";
  value: string | null;
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // New user form
  const [showNewUser, setShowNewUser] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "viewer">("viewer");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Permission editing
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [savingPerms, setSavingPerms] = useState(false);

  async function loadUsers() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (!res.ok) { setError("Accès refusé ou erreur serveur."); setLoading(false); return; }
    setUsers(await res.json());
    setLoading(false);
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true); setCreateError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail, password: newPassword, display_name: newDisplayName, role: newRole }),
    });
    setCreating(false);
    if (!res.ok) { setCreateError((await res.json()).error); return; }
    setShowNewUser(false); setNewEmail(""); setNewPassword(""); setNewDisplayName(""); setNewRole("viewer");
    loadUsers();
  }

  async function handleDeleteUser(id: string, email: string) {
    if (!confirm(`Supprimer l'utilisateur ${email} ?`)) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    loadUsers();
  }

  async function openPermissions(userId: string) {
    setEditingUserId(userId);
    const res = await fetch(`/api/admin/users/${userId}/permissions`);
    setPermissions(await res.json());
  }

  async function savePermissions() {
    if (!editingUserId) return;
    setSavingPerms(true);
    await fetch(`/api/admin/users/${editingUserId}/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(permissions),
    });
    setSavingPerms(false);
    setEditingUserId(null);
  }

  function addPermission(type: Permission["type"], value: string | null) {
    if (permissions.some(p => p.type === type && p.value === value)) return;
    setPermissions([...permissions, { type, value }]);
  }

  function removePermission(idx: number) {
    setPermissions(permissions.filter((_, i) => i !== idx));
  }

  const editingUser = users.find(u => u.id === editingUserId);
  const allCompanies = Array.from(new Set(defaultCompanies));

  const companyCards = [
    "MBA Immobilier SA",
    "LAEMA Immobilier SA",
    "MBA Construction SA",
    "ASV Construction Générale SA",
    "ASV Fenêtres et Portes SA",
    "MBA Services SA",
    "Promotion",
  ];

  function permLabel(p: Permission): string {
    switch (p.type) {
      case "all": return "Hypothèques : Tout voir";
      case "company": return `Hypothèques — Société : ${p.value}`;
      case "vehicle_all": return "Véhicules : Tout voir";
      case "card": return `Carte : ${p.value}`;
      case "commande_view": return "Commandes MBA Construction : Voir";
      case "commande_create": return "Commandes MBA Construction : Créer";
      case "commande_edit": return "Commandes MBA Construction : Modifier / Supprimer";
      default: return `${p.type}: ${p.value}`;
    }
  }

  return (
    <div className="min-h-screen bg-warm">
      <header className="glass border-b border-white/30">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative w-9 h-9 shrink-0">
              <Image src="/logo.png" alt="MBA Groupe SA" fill className="object-contain" />
            </div>
            <div>
              <div className="text-base font-semibold text-[#1d1d1f] leading-tight">MBA Groupe SA</div>
              <div className="text-[11px] text-[#86868b] tracking-wide mt-0.5">Administration</div>
            </div>
          </div>
          <Link href="/" className="text-xs text-[#0071e3] font-medium hover:underline">← Accueil</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">Gestion des accès</h1>
          <button
            onClick={() => setShowNewUser(true)}
            className="bg-[#1d1d1f] text-white text-xs font-medium px-4 py-2 rounded-xl hover:bg-[#333] transition-colors"
          >
            + Nouvel utilisateur
          </button>
        </div>

        {error && <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>}

        {/* New user form */}
        {showNewUser && (
          <div className="glass-card rounded-2xl mb-6 overflow-hidden">
            <div className="bg-white/40 border-b border-white/40 px-5 py-3 flex items-center justify-between">
              <span className="text-[#1d1d1f] font-semibold text-sm">Nouvel utilisateur</span>
              <button onClick={() => setShowNewUser(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
            </div>
            <form onSubmit={handleCreateUser} className="px-5 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Email</label>
                <input type="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Mot de passe</label>
                <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Nom affiché</label>
                <input type="text" value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Rôle</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value as "admin" | "viewer")}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                  <option value="viewer">Viewer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {createError && <div className="sm:col-span-2 text-red-600 text-sm">{createError}</div>}
              <div className="sm:col-span-2 flex gap-3">
                <button type="submit" disabled={creating}
                  className="bg-black text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50">
                  {creating ? "Création…" : "Créer"}
                </button>
                <button type="button" onClick={() => setShowNewUser(false)}
                  className="text-sm text-gray-500 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Users list */}
        {loading ? (
          <div className="text-sm text-gray-400 py-8 text-center">Chargement…</div>
        ) : (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="bg-white/40 border-b border-white/40 px-5 py-3">
              <span className="text-[#1d1d1f] font-semibold text-sm">Utilisateurs ({users.length})</span>
            </div>
            <div className="divide-y divide-gray-100">
              {users.map(u => (
                <div key={u.id} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900">{u.display_name || u.email}</div>
                    <div className="text-xs text-gray-400">{u.email}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.role === "admin" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                      {u.role}
                    </span>
                    {u.role !== "admin" && (
                      <button onClick={() => openPermissions(u.id)}
                        className="text-xs text-amber-600 hover:underline font-semibold">
                        Permissions
                      </button>
                    )}
                    <button onClick={() => handleDeleteUser(u.id, u.email)}
                      className="text-xs text-red-500 hover:underline">
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Permission editor modal */}
        {editingUserId && editingUser && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xl flex items-center justify-center z-50 px-4">
            <div className="bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-white/50">
              <div className="bg-white/40 border-b border-white/40 px-5 py-4 flex items-center justify-between">
                <div>
                  <div className="text-[#1d1d1f] font-semibold text-sm">Permissions</div>
                  <div className="text-gray-500 text-xs mt-0.5">{editingUser.display_name || editingUser.email}</div>
                </div>
                <button onClick={() => setEditingUserId(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
              </div>
              <div className="px-5 py-5">
                <p className="text-xs text-gray-500 mb-4">
                  Définissez ce que cet utilisateur peut voir. Sans permission, il ne voit rien.
                </p>

                {/* Current permissions */}
                {permissions.length === 0 ? (
                  <p className="text-xs text-gray-400 italic mb-4">Aucune permission — accès vide.</p>
                ) : (
                  <div className="mb-4 space-y-2">
                    {permissions.map((p, i) => (
                      <div key={i} className="flex items-center justify-between bg-stone-50 rounded-lg px-3 py-2">
                        <span className="text-sm">
                          {permLabel(p)}
                        </span>
                        <button onClick={() => removePermission(i)} className="text-red-400 hover:text-red-600 text-lg leading-none ml-3">×</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add permission */}
                <div className="border-t border-gray-100 pt-4">
                  {/* Hypothèques permissions */}
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Hypothèques</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => addPermission("all", null)}
                      className="text-xs bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-100">
                      Toutes les hypothèques
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-3 mb-2">Par société :</p>
                  <div className="flex flex-wrap gap-2">
                    {allCompanies.map(c => (
                      <button key={c} onClick={() => addPermission("company", c)}
                        className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100">
                        {c}
                      </button>
                    ))}
                  </div>

                  {/* Véhicules permissions */}
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-6 mb-3">Véhicules</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => addPermission("vehicle_all", null)}
                      className="text-xs bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-100">
                      Accès véhicules
                    </button>
                  </div>

                  {/* Commandes MBA Construction SA */}
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-6 mb-3">Commandes MBA Construction SA</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => addPermission("commande_view", null)}
                      className="text-xs bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100">
                      Voir le module
                    </button>
                    <button onClick={() => addPermission("commande_create", null)}
                      className="text-xs bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100">
                      Créer
                    </button>
                    <button onClick={() => addPermission("commande_edit", null)}
                      className="text-xs bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100">
                      Modifier / Supprimer
                    </button>
                  </div>

                  {/* Cartes entreprises */}
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-6 mb-3">Cartes entreprises</p>
                  <div className="flex flex-wrap gap-2">
                    {companyCards.map(c => (
                      <button key={`card-${c}`} onClick={() => addPermission("card", c)}
                        className="text-xs bg-purple-50 border border-purple-200 text-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-100">
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button onClick={savePermissions} disabled={savingPerms}
                    className="bg-[#1d1d1f] text-white text-sm font-medium px-5 py-2 rounded-xl hover:bg-[#333] disabled:opacity-50">
                    {savingPerms ? "Enregistrement…" : "Enregistrer"}
                  </button>
                  <button onClick={() => setEditingUserId(null)}
                    className="text-sm text-gray-500 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
