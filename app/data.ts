export type RateType = "fixed" | "saron";

export interface Mortgage {
  id: string;
  label: string;
  company: string;
  totalAmount: number;
  startDate: string;
  endDate: string;
  rateType: RateType;
  rate: number; // margin for saron, fixed rate otherwise (as %)
  annualAmortization: number;
  quarterlyAmortization: number;
  remainingAtEnd: number;
  remainingToday: number;
  propertyValue: number | null;
  propertyGroup?: string; // group multiple mortgages on the same property
  shared?: boolean;       // 50/50 avec Gabriel Borgeat — on comptabilise 50%
}

/** Part MBA : 0.5 si partagé avec Borgeat, sinon 1 */
export function ratio(m: Mortgage): number {
  return m.shared ? 0.5 : 1;
}

export const TODAY = new Date("2026-03-27");

export const companies = [
  "MBA Immobilier SA",
  "MBA Construction SA et Gabriel Borgeat SA",
  "LAEMA Immobilier SA et Gabriel Borgeat SA",
  "LAEMA Immobilier SA",
  "MBA Immobilier SA et Gabriel Borgeat SA",
];

export const mortgages: Mortgage[] = [
  // MBA Immobilier SA
  {
    id: "501.660.385.2",
    label: "DDP 9390, Halle ASV Fenêtres et Portes",
    company: "MBA Immobilier SA",
    totalAmount: 250000,
    startDate: "2022-08-29",
    endDate: "2027-08-29",
    rateType: "saron",
    rate: 1.2,
    annualAmortization: 12000,
    quarterlyAmortization: 3000,
    remainingAtEnd: 190000,
    remainingToday: 211000,
    propertyValue: 1500000,
  },
  {
    id: "783.041.116.9",
    label: "Dépôt Châble-Bet 24",
    company: "MBA Immobilier SA",
    totalAmount: 800000,
    startDate: "2019-04-18",
    endDate: "2029-04-18",
    rateType: "fixed",
    rate: 1.6,
    annualAmortization: 30000,
    quarterlyAmortization: 7500,
    remainingAtEnd: 500000,
    remainingToday: 612500,
    propertyValue: 2500000,
  },
  {
    id: "157.912.972.8",
    label: "Halle Praz-Prins – Châble-Bet 41",
    company: "MBA Immobilier SA",
    totalAmount: 1300000,
    startDate: "2019-04-18",
    endDate: "2029-04-18",
    rateType: "fixed",
    rate: 1.6,
    annualAmortization: 35000,
    quarterlyAmortization: 8750,
    remainingAtEnd: 950000,
    remainingToday: 1081250,
    propertyValue: 3600000,
  },
  {
    id: "243.739.895.7",
    label: "Immeuble Dorénaz A1",
    company: "MBA Immobilier SA",
    totalAmount: 1080000,
    startDate: "2019-02-01",
    endDate: "2029-02-01",
    rateType: "fixed",
    rate: 1.45,
    annualAmortization: 12000,
    quarterlyAmortization: 3000,
    remainingAtEnd: 960000,
    remainingToday: 1014000,
    propertyValue: 2200000,
  },
  {
    id: "440.195.112.1",
    label: "Appartement ImmoSwiss – Ardon",
    company: "MBA Immobilier SA",
    totalAmount: 288000,
    startDate: "2022-12-12",
    endDate: "2027-02-01",
    rateType: "fixed",
    rate: 2.2,
    annualAmortization: 4000,
    quarterlyAmortization: 1000,
    remainingAtEnd: 268000,
    remainingToday: 284000,
    propertyValue: 480000,
  },
  // MBA Construction SA et Gabriel Borgeat SA
  {
    id: "267.937.166.2",
    label: "Location vente à Charrat – Picinno",
    company: "MBA Construction SA et Gabriel Borgeat SA",
    shared: true,
    totalAmount: 429100,
    startDate: "2024-01-31",
    endDate: "2026-05-31",
    rateType: "fixed",
    rate: 2.07,
    annualAmortization: 6600,
    quarterlyAmortization: 1650,
    remainingAtEnd: 415900,
    remainingToday: 418100,
    propertyValue: 667000,
  },
  // LAEMA Immobilier SA et Gabriel Borgeat SA
  {
    id: "528.888.288.2",
    label: "Parcelles 1206, 1207, 1211 à Vernayaz",
    company: "LAEMA Immobilier SA et Gabriel Borgeat SA",
    shared: true,
    totalAmount: 300000,
    startDate: "2024-06-11",
    endDate: "2027-06-11",
    rateType: "saron",
    rate: 1.2,
    annualAmortization: 0,
    quarterlyAmortization: 0,
    remainingAtEnd: 300000,
    remainingToday: 300000,
    propertyValue: 3000000,
  },
  // LAEMA Immobilier SA
  {
    id: "406.103.248.7",
    label: "Bâtiment A – Guercet",
    company: "LAEMA Immobilier SA",
    totalAmount: 1250000,
    startDate: "2022-01-20",
    endDate: "2027-01-20",
    rateType: "fixed",
    rate: 0.95,
    annualAmortization: 20000,
    quarterlyAmortization: 5000,
    remainingAtEnd: 1150000,
    remainingToday: 1185000,
    propertyValue: 2660000,
  },
  {
    id: "138.223.732.4",
    label: "Appartement Milord à Saxon",
    company: "LAEMA Immobilier SA",
    totalAmount: 305000,
    startDate: "2021-07-01",
    endDate: "2026-09-25",
    rateType: "fixed",
    rate: 1.85,
    annualAmortization: 0,
    quarterlyAmortization: 0,
    remainingAtEnd: 305000,
    remainingToday: 305000,
    propertyValue: 500000,
  },
  {
    id: "355.391.332.6",
    label: "En Saragoux B",
    company: "LAEMA Immobilier SA",
    totalAmount: 1500000,
    startDate: "2024-06-28",
    endDate: "2029-06-28",
    rateType: "saron",
    rate: 0.75,
    annualAmortization: 10000,
    quarterlyAmortization: 2500,
    remainingAtEnd: 1459500,
    remainingToday: 1459500,
    propertyValue: 2600000,
  },
  {
    id: "300.755.888.4",
    label: "Appartement Laetitia",
    company: "LAEMA Immobilier SA",
    totalAmount: 420000,
    startDate: "2024-06-17",
    endDate: "2029-02-01",
    rateType: "fixed",
    rate: 1.45,
    annualAmortization: 0,
    quarterlyAmortization: 0,
    remainingAtEnd: 420000,
    remainingToday: 420000,
    propertyValue: 800000,
  },
  {
    id: "730.826.391.5",
    label: "Appartement Bellini à Uvrier",
    company: "LAEMA Immobilier SA",
    totalAmount: 310000,
    startDate: "2025-06-13",
    endDate: "2027-04-30",
    rateType: "fixed",
    rate: 2.2,
    annualAmortization: 3020,
    quarterlyAmortization: 755,
    remainingAtEnd: 303960,
    remainingToday: 307735,
    propertyValue: 750000,
    propertyGroup: "bellini",
  },
  {
    id: "239.402.118.8",
    label: "Appartement Bellini à Uvrier – 2ème hypothèque",
    company: "LAEMA Immobilier SA",
    totalAmount: 154920,
    startDate: "2025-04-14",
    endDate: "2030-04-14",
    rateType: "saron",
    rate: 1.0,
    annualAmortization: 0,
    quarterlyAmortization: 0,
    remainingAtEnd: 154920,
    remainingToday: 154920,
    propertyValue: 750000,
    propertyGroup: "bellini",
  },
  {
    id: "951.084.130.3",
    label: "Appartement Williams à Saxon",
    company: "LAEMA Immobilier SA",
    totalAmount: 280000,
    startDate: "2021-09-23",
    endDate: "2031-09-23",
    rateType: "fixed",
    rate: 1.1,
    annualAmortization: 5000,
    quarterlyAmortization: 1250,
    remainingAtEnd: 230000,
    remainingToday: 258750,
    propertyValue: 500000,
  },
  // MBA Immobilier SA et Gabriel Borgeat SA
  {
    id: "528.389.035.6",
    label: "Bâtiment C au Guercet",
    company: "MBA Immobilier SA et Gabriel Borgeat SA",
    shared: true,
    totalAmount: 250000,
    startDate: "2024-02-16",
    endDate: "2026-11-25",
    rateType: "fixed",
    rate: 2.2,
    annualAmortization: 0,
    quarterlyAmortization: 0,
    remainingAtEnd: 250000,
    remainingToday: 250000,
    propertyValue: 517000,
  },
  {
    id: "979.111.419.7",
    label: "Projet Salvan",
    company: "MBA Immobilier SA et Gabriel Borgeat SA",
    shared: true,
    totalAmount: 520000,
    startDate: "2025-09-15",
    endDate: "2028-09-15",
    rateType: "saron",
    rate: 1.5,
    annualAmortization: 0,
    quarterlyAmortization: 0,
    remainingAtEnd: 520000,
    remainingToday: 520000,
    propertyValue: 1110000,
  },
  {
    id: "763.766.848.9",
    label: "Parcelle à Vérossaz 3048 et 479",
    company: "MBA Immobilier SA et Gabriel Borgeat SA",
    shared: true,
    totalAmount: 270000,
    startDate: "2023-12-05",
    endDate: "2026-12-05",
    rateType: "saron",
    rate: 1.2,
    annualAmortization: 0,
    quarterlyAmortization: 0,
    remainingAtEnd: 270000,
    remainingToday: 270000,
    propertyValue: 426600,
  },
];

/** Intérêts annuels sur la base du solde actuel et du taux (part MBA) */
export function calcAnnualInterest(m: Mortgage): number {
  if (new Date(m.endDate) <= TODAY) return 0;
  return Math.round(m.remainingToday * (m.rate / 100) * ratio(m));
}

// Calculate total interest remaining from today until end date
// Takes quarterly amortization and share ratio into account
export function calcRemainingInterest(m: Mortgage): number {
  const today = TODAY;
  const end = new Date(m.endDate);
  if (end <= today) return 0;

  const ratePerQuarter = m.rate / 100 / 4;
  let balance = m.remainingToday;
  let totalInterest = 0;

  const msPerQuarter = (365.25 / 4) * 24 * 3600 * 1000;
  const totalMs = end.getTime() - today.getTime();
  const quarters = Math.ceil(totalMs / msPerQuarter);

  for (let q = 0; q < quarters; q++) {
    if (balance <= 0) break;
    const interest = balance * ratePerQuarter;
    totalInterest += interest;
    balance = Math.max(0, balance - m.quarterlyAmortization);
  }

  return Math.round(totalInterest * ratio(m));
}

export function calcTotalInterestFullPeriod(m: Mortgage): number {
  // Interest over the FULL signed period (from start to end), on the amortizing schedule
  const start = new Date(m.startDate);
  const end = new Date(m.endDate);
  const ratePerQuarter = m.rate / 100 / 4;
  let balance = m.totalAmount;
  let totalInterest = 0;

  const msPerQuarter = (365.25 / 4) * 24 * 3600 * 1000;
  const totalMs = end.getTime() - start.getTime();
  const quarters = Math.ceil(totalMs / msPerQuarter);

  for (let q = 0; q < quarters; q++) {
    if (balance <= 0) break;
    const interest = balance * ratePerQuarter;
    totalInterest += interest;
    balance = Math.max(0, balance - m.quarterlyAmortization);
  }

  return Math.round(totalInterest * ratio(m));
}

export function yearsRemaining(m: Mortgage): number {
  const today = TODAY;
  const end = new Date(m.endDate);
  const diff = (end.getTime() - today.getTime()) / (365.25 * 24 * 3600 * 1000);
  return Math.max(0, diff);
}

export function isExpired(m: Mortgage): boolean {
  return new Date(m.endDate) <= TODAY;
}

export function isExpiringSoon(m: Mortgage): boolean {
  const end = new Date(m.endDate);
  const sixMonths = new Date(TODAY);
  sixMonths.setMonth(sixMonths.getMonth() + 6);
  return end > TODAY && end <= sixMonths;
}

// LTV: if the mortgage belongs to a group, sum all balances in the group
export function ltv(m: Mortgage, allMortgages: Mortgage[] = mortgages): number | null {
  if (!m.propertyValue) return null;
  if (m.propertyGroup) {
    const grouped = allMortgages.filter((x) => x.propertyGroup === m.propertyGroup);
    const totalBalance = grouped.reduce((s, x) => s + x.remainingToday, 0);
    return (totalBalance / m.propertyValue) * 100;
  }
  return (m.remainingToday / m.propertyValue) * 100;
}

export function formatCHF(n: number): string {
  return new Intl.NumberFormat("fr-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("fr-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
