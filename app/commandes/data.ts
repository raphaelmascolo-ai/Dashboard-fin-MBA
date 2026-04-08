// Module Commande MBA Construction SA
// Toutes les commandes sont rattachées à la société MBA Construction SA (codée en dur).

export const COMMANDE_COMPANY = "MBA Construction SA";

export interface Commande {
  id: string;
  orderDate: string;            // ISO date YYYY-MM-DD
  chantier: string;             // TODO: brancher sur le module Chantiers quand il existera
  fournisseur: string;
  description: string;
  amount: number;               // Montant estimé CHF TTC
  deliveryDate: string | null;  // ISO date YYYY-MM-DD
  devisPath: string | null;     // chemin dans le bucket Supabase commandes-devis
  devisName: string | null;     // nom original du fichier
  comment: string;
  createdAt: string | null;
  createdBy: string | null;
}

export function emptyCommande(): Commande {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: generateCommandeId(),
    orderDate: today,
    chantier: "",
    fournisseur: "",
    description: "",
    amount: 0,
    deliveryDate: null,
    devisPath: null,
    devisName: null,
    comment: "",
    createdAt: null,
    createdBy: null,
  };
}

export function generateCommandeId(): string {
  return `CMD-${Date.now().toString(36).toUpperCase()}`;
}

export function formatCHF(n: number): string {
  if (!n) return "CHF 0.–";
  return new Intl.NumberFormat("fr-CH", {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export const DEVIS_MAX_BYTES = 10 * 1024 * 1024; // 10 Mo
