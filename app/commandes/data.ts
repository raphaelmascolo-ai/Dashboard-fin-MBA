// Module Commandes — partagé entre MBA Construction SA et ASV Fenêtres et Portes SA.
// Chaque formulaire fixe la société en dur dans le champ company.

export const COMMANDE_COMPANY_MBA = "MBA Construction SA";
export const COMMANDE_COMPANY_ASV = "ASV Fenêtres et Portes SA";

// Alias legacy (utilisé par le formulaire MBA existant)
export const COMMANDE_COMPANY = COMMANDE_COMPANY_MBA;

export interface Commande {
  id: string;
  orderDate: string;            // ISO date YYYY-MM-DD
  chantier: string;
  fournisseur: string;
  description: string;
  amount: number;               // Montant estimé CHF TTC
  deliveryDate: string | null;  // ISO date YYYY-MM-DD
  devisPath: string | null;     // chemin dans le bucket Supabase commandes-devis
  devisName: string | null;     // nom original du fichier
  comment: string;
  company: string;
  createdAt: string | null;
  createdBy: string | null;
}

export function emptyCommande(company: string = COMMANDE_COMPANY_MBA): Commande {
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
    company,
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
