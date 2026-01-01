import { HumanReadableCategory } from './types';

/**
 * Služba pro překlad technických chyb do lidsky srozumitelných návodů.
 * Slouží jako "First Aid Kit" pro vývojáře i manažery.
 */
export class RemediationService {

  // Metadata pro známá pravidla – kategorie + "co je špatně" + návod
  private static metaDatabase: Record<string, {
    category: HumanReadableCategory;
    what: string;
    fix: string;
    wcag?: string;
  }> = {
    'color-contrast': {
      category: 'Grafika',
      what: 'Nízký kontrast mezi textem a pozadím.',
      fix: 'Zvyšte kontrast mezi textem a pozadím. Pro běžný text musí být poměr alespoň 4.5:1. Zkuste ztmavit barvu písma nebo zesvětlit pozadí.',
      wcag: '1.4.3 Kontrast (minimální)'
    },
    'image-alt': {
      category: 'Grafika',
      what: 'Obrázky nemají smysluplný atribut alt.',
      fix: 'Každý obrázek <img> musí mít atribut alt="". Pokud je obrázek jen dekorativní, použijte prázdný alt="" nebo role="presentation". Pokud nese informaci, popište ji.',
      wcag: '1.1.1 Netextový obsah'
    },
    'label': {
      category: 'Formuláře',
      what: 'Formulářová pole nemají viditelný nebo čitelný popisek.',
      fix: 'Každé formulářové pole <input> musí mít popisek. Použijte element <label for="id"> nebo atribut aria-label.',
      wcag: '3.3.2 Popisky nebo instrukce'
    },
    'link-name': {
      category: 'Navigace',
      what: 'Odkazy nemají srozumitelný text (např. "klikněte zde").',
      fix: 'Odkazy musí mít srozumitelný text. Vyhněte se textům jako "klikněte zde". U ikonek použijte aria-label nebo sr-only text.',
      wcag: '2.4.4 Účel odkazu (v kontextu)'
    },
    'button-name': {
      category: 'Navigace',
      what: 'Tlačítka obsahují jen ikonu nebo prázdný obsah.',
      fix: 'Tlačítka musí obsahovat text. Pokud používáte jen ikonu, přidejte aria-label s popisem akce (např. "Vyhledat").',
      wcag: '4.1.2 Název, role, hodnota'
    },
    'html-has-lang': {
      category: 'Struktura',
      what: 'Stránka nemá nastaven jazyk (lang="cs").',
      fix: 'Elementu <html> chybí atribut lang (např. <html lang="cs">). Toto je kritické pro čtečky obrazovky.',
      wcag: '3.1.1 Jazyk stránky'
    },
    'list': {
      category: 'Struktura',
      what: 'Seznamy nejsou správně zapsané pomocí <ul>/<ol> a <li>.',
      fix: 'Seznamy <ul> a <ol> smí obsahovat pouze elementy <li>. Zkontrolujte strukturu HTML.',
      wcag: '1.3.1 Informace a vztahy'
    },
    'aria-hidden-focus': {
      category: 'Technické',
      what: 'Fokusovatelné prvky jsou skryté pro čtečky obrazovky (aria-hidden="true").',
      fix: 'Prvky s aria-hidden="true" nesmí být interaktivní (fokusovatelné). Odstraňte tabindex nebo aria-hidden atribut.',
      wcag: '4.1.2 Název, role, hodnota'
    },
    'frame-title': {
      category: 'Struktura',
      what: 'Iframy nemají title popisující obsah.',
      fix: 'Každý <iframe> musí mít atribut title, který popisuje jeho obsah.',
      wcag: '2.4.1 Bloky přeskočení'
    },
    'heading-order': {
      category: 'Struktura',
      what: 'Nadpisy na stránce nejdou logicky po sobě (H1 → H2 → H3).',
      fix: 'Nadpisy by měly jít popořadě (H1 -> H2 -> H3). Nepřeskakujte úrovně (např. z H2 rovnou na H4).',
      wcag: '2.4.6 Nadpisy a popisky'
    },
    'aria-required-children': {
      category: 'Technické',
      what: 'Prvek s ARIA rolí očekává konkrétní potomky, ale v DOMu chybí (např. list bez <li>, tablist bez tabů).',
      fix: 'Zkontrolujte dokumentaci k dané ARIA roli a doplňte požadované potomky – například u role="list" použijte role="listitem" pro položky, u role="tablist" doplňte role="tab".',
      wcag: '1.3.1 Informace a vztahy'
    },
    'aria-input-field-name': {
      category: 'Formuláře',
      what: 'Interaktivní vstupní prvek má roli/typ, ale chybí mu srozumitelný název (accessible name).',
      fix: 'Doplňte popisek pomocí <label for="...">, aria-label nebo aria-labelledby tak, aby čtečka obrazovky oznamovala smysluplný název pole.',
      wcag: '4.1.2 Název, role, hodnota'
    },
    'target-size': {
      category: 'Grafika',
      what: 'Klikací cíl (tlačítko, odkaz, ikona) je příliš malý nebo má nedostatečný „hit area“ pro pohodlné ovládání.',
      fix: 'Zvyšte velikost klikacích prvků alespoň na doporučených 24×24 CSS pixelů nebo rozšiřte klikací oblast tak, aby jej bylo možné snadno aktivovat i na dotykových displejích.',
      wcag: '2.5.8 Velikost cíle (minimální)'
    }
  };

  public static getRuleMeta(ruleId: string): { category: HumanReadableCategory; what: string; fix: string; wcag?: string } {
    const meta = this.metaDatabase[ruleId];
    if (meta) return meta;

    return {
      category: 'Technické',
      what: `Technický problém přístupnosti (${ruleId}).`,
      fix: 'Prostudujte dokumentaci k tomuto pravidlu na Deque University (odkaz v detailu chyby) a upravte HTML / ARIA atributy.',
      wcag: undefined,
    };
  }

  // Zpětná kompatibilita – původní jednoduché API
  public static getFix(ruleId: string): string {
    return this.getRuleMeta(ruleId).fix;
  }
}