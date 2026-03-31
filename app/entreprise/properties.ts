// Charges annuelles par bien immobilier, par année
// Mappé aux hypothèques via le label

export interface Property {
  label: string;
  company: "MBA Immobilier SA" | "LAEMA Immobilier SA";
  chargesByYear: Record<number, number>; // { 2025: 18863.12, 2024: ... }
}

/** Années disponibles dans les données (ordre décroissant) */
export const availableYears = [2025];

export const properties: Property[] = [
  // LAEMA Immobilier SA
  { label: "Appartement Bellini à Uvrier", company: "LAEMA Immobilier SA", chargesByYear: { 2025: 18863.12 } },
  { label: "Appartement Laetitia", company: "LAEMA Immobilier SA", chargesByYear: { 2025: 6944.90 } },
  { label: "Appartement Milord à Saxon", company: "LAEMA Immobilier SA", chargesByYear: { 2025: 5794.90 } },
  { label: "Appartement Williams à Saxon", company: "LAEMA Immobilier SA", chargesByYear: { 2025: 15500 } },
  { label: "Bâtiment A – Guercet", company: "LAEMA Immobilier SA", chargesByYear: { 2025: 25840.45 } },
  { label: "En Saragoux B", company: "LAEMA Immobilier SA", chargesByYear: { 2025: 5281.55 } },
  // MBA Immobilier SA
  { label: "Appartement ImmoSwiss – Ardon", company: "MBA Immobilier SA", chargesByYear: { 2025: 3766.70 } },
  { label: "DDP 9390, Halle ASV Fenêtres et Portes", company: "MBA Immobilier SA", chargesByYear: { 2025: 12360.72 } },
  { label: "Dépôt Châble-Bet 24", company: "MBA Immobilier SA", chargesByYear: { 2025: 16581.70 } },
  { label: "Halle Praz-Prins – Châble-Bet 41", company: "MBA Immobilier SA", chargesByYear: { 2025: 33378.03 } },
  { label: "Immeuble Dorénaz A1", company: "MBA Immobilier SA", chargesByYear: { 2025: 12233.35 } },
];

// Mapping label normalisé -> label dans les hypothèques (pour gérer les petites différences)
export function matchMortgageLabel(propertyLabel: string, mortgageLabel: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[–—\-]/g, " ").replace(/\s+/g, " ").trim();
  const p = normalize(propertyLabel);
  const m = normalize(mortgageLabel);
  // Exact or starts-with match
  if (m === p || m.startsWith(p)) return true;
  // Special case: Bellini has two mortgages
  if (p.includes("bellini") && m.includes("bellini")) return true;
  return false;
}
