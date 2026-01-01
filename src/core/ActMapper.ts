import axe from 'axe-core';

/**
 * Mapování mezi interními ID pravidel axe-core a oficiálními W3C ACT Rules.
 *
 * Poznámka: axe-core v novějších verzích publikuje metadata k pravidlům,
 * včetně vazeb na ACT Rules. Tady je čteme přímo z definic pravidel,
 * takže není třeba udržovat ruční statickou tabulku.
 */

export interface ActRuleMapping {
  actRuleIds: string[];
  actRuleUrls: string[];
}

export class ActMapper {
  private static cache: Record<string, ActRuleMapping> | null = null;

  /**
   * Vrátí mapu "axeRuleId -> ACT metadata".
   * Výsledek je cachovaný na úrovni procesu (Lambda cold start / lokální běh).
   */
  public static getAxeToActMap(): Record<string, ActRuleMapping> {
    if (this.cache) return this.cache;

    const rules = (axe as any).getRules ? (axe as any).getRules() : [];
    const map: Record<string, ActRuleMapping> = {};

    for (const rule of rules) {
      const meta = (rule as any).metadata || {};
      const tags: string[] = Array.isArray((rule as any).tags)
        ? (rule as any).tags
        : [];

      let actIds: string[] = [];

      // 1) Preferované oficiální metadata, pokud je axe poskytne
      if (Array.isArray(meta.actIds)) {
        actIds = meta.actIds.filter((id: unknown): id is string => typeof id === 'string');
      } else if (typeof meta.actId === 'string') {
        actIds = [meta.actId];
      }

      // 2) Fallback: některé buildy používají ACT ID v tagu (např. "act-b4f0c3")
      if (!actIds.length) {
        actIds = tags
          .filter((t) => /^act-[0-9a-f]{6}$/i.test(t))
          .map((t) => t.replace(/^act-/i, ''));
      }

      if (!actIds.length) continue;

      const uniqueActIds = Array.from(new Set(actIds));
      const actRuleUrls = uniqueActIds.map(
        (id) => `https://www.w3.org/WAI/standards-guidelines/act/rules/${id}/`
      );

      const axeRuleId: string = (rule as any).ruleId || (rule as any).id;
      if (!axeRuleId) continue;

      map[axeRuleId] = {
        actRuleIds: uniqueActIds,
        actRuleUrls,
      };
    }

    this.cache = map;
    return map;
  }

  /**
   * Pohodlné API pro zjištění ACT metadat pro jedno axe pravidlo.
   */
  public static getActInfoForAxeRule(
    axeRuleId: string
  ): ActRuleMapping | undefined {
    const map = this.getAxeToActMap();
    return map[axeRuleId];
  }
}
