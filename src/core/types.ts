/**
 * DTO (Data Transfer Objects) pro A11yFlow.
 * Tyto typy definují kontrakt mezi Lambdou a konzumentem (Make.com/Frontend).
 */

export type ImpactLevel = 'minor' | 'moderate' | 'serious' | 'critical';

// Reprezentuje jeden konkrétní výskyt chyby v HTML
export interface ViolationNode {
  html: string;       // HTML snippet
  target: string[];   // CSS selektor
  failureSummary: string; // Proč to selhalo
}

// Agregovaný typ chyby (např. "Chybí alt text u obrázků")
export interface AccessibilityViolation {
  id: string;             // rule-id (např. image-alt)
  title: string;          // Krátký název
  description: string;    // Dlouhý popis
  impact: ImpactLevel | null;
  helpUrl: string;        // Odkaz na dokumentaci (Deque/WCAG)
  nodes: ViolationNode[]; // Seznam elementů s touto chybou
  count: number;          // Počet výskytů
}

// Hlavní výstupní report z Lambdy
export interface AuditReport {
  url: string;
  timestamp: string;
  score: number; // 0-100 Health Score
  meta: {
    browserVersion: string;
    engineVersion: string; // axe-core verze
  };
  violations: {
    critical: AccessibilityViolation[];
    serious: AccessibilityViolation[];
    moderate: AccessibilityViolation[];
    minor: AccessibilityViolation[];
  };
  stats: {
    totalViolations: number;
    criticalCount: number;
  };
}