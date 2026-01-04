import { AuditReport, AccessibilityViolation } from './types.js';

/**
 * AccessibilityStatementGenerator
 * 
 * Generuje prohlášení o přístupnosti (Accessibility Statement) dle EU direktivy 2019/882 (EAA).
 * Podporuje české a anglické jazyky.
 */
export class AccessibilityStatementGenerator {
  /**
   * Generate accessibility statement
   * 
   * @param report Audit report data
   * @param language Language code ('cs' | 'en' | 'de')
   * @param contactInfo Optional contact information
   * @returns Markdown and HTML versions of the statement
   */
  generate(
    report: AuditReport,
    language: Language = 'cs',
    contactInfo?: ContactInfo
  ): AccessibilityStatement {
    const domain = new URL(report.url).hostname;
    const date = new Date(report.timestamp).toLocaleDateString(
      language === 'cs' ? 'cs-CZ' : language === 'de' ? 'de-DE' : 'en-US'
    );
    const score = report.score;
    const critical = report.violations.critical;
    const serious = report.violations.serious;

    // Determine compliance level
    const isFullyCompliant = score === 100;
    const isPartiallyCompliant = score >= 70 && score < 100;
    const isNonCompliant = score < 70;

    // Generate markdown
    const markdown = this.generateMarkdown(
      domain,
      date,
      score,
      critical,
      serious,
      isFullyCompliant,
      isPartiallyCompliant,
      isNonCompliant,
      language,
      contactInfo
    );

    // Convert markdown to HTML
    const html = this.markdownToHTML(markdown);

    return { markdown, html };
  }

  /**
   * Generate markdown statement
   */
  private generateMarkdown(
    domain: string,
    date: string,
    score: number,
    critical: AccessibilityViolation[],
    serious: AccessibilityViolation[],
    isFullyCompliant: boolean,
    isPartiallyCompliant: boolean,
    isNonCompliant: boolean,
    language: Language,
    contactInfo?: ContactInfo
  ): string {
    const translations = this.getTranslations(language);

    if (isFullyCompliant) {
      return this.generateCompliantStatement(domain, date, language, contactInfo);
    } else {
      return this.generatePartialStatement(
        domain,
        date,
        score,
        critical,
        serious,
        language,
        contactInfo
      );
    }
  }

  /**
   * Generate statement for fully compliant website
   */
  private generateCompliantStatement(
    domain: string,
    date: string,
    language: Language,
    contactInfo?: ContactInfo
  ): string {
    const t = this.getTranslations(language);

    return `# ${t.title}

**${domain}** ${t.commitment}

## ${t.complianceStatusTitle}

${t.fullyCompliant}

**${t.testingDate}:** ${date}  
**${t.testingMethod}:** ${t.automatedTesting}

## ${t.technicalInfo}

${t.technicalDetails}

## ${t.contactTitle}

${t.contactIntro}

${contactInfo?.email ? `**${t.email}:** ${contactInfo.email}` : ''}
${contactInfo?.phone ? `**${t.phone}:** ${contactInfo.phone}` : ''}
${contactInfo?.address ? `**${t.address}:** ${contactInfo.address}` : ''}

---

${t.footer}
`;
  }

  /**
   * Generate statement for partially compliant website
   */
  private generatePartialStatement(
    domain: string,
    date: string,
    score: number,
    critical: AccessibilityViolation[],
    serious: AccessibilityViolation[],
    language: Language,
    contactInfo?: ContactInfo
  ): string {
    const t = this.getTranslations(language);

    // Create list of issues
    const issues = [...critical, ...serious]
      .slice(0, 10) // Limit to top 10
      .map((v) => `- **${v.title}** (${t.occurrences}: ${v.count})`)
      .join('\n');

    const deadlineDate = new Date();
    deadlineDate.setDate(deadlineDate.getDate() + 90); // 90 days from now
    const deadline = deadlineDate.toLocaleDateString(
      language === 'cs' ? 'cs-CZ' : language === 'de' ? 'de-DE' : 'en-US'
    );

    return `# ${t.title}

**${domain}** ${t.commitment}

## ${t.complianceStatusTitle}

${t.partiallyCompliant}

**${t.currentScore}:** ${score}/100

### ${t.identifiedIssues}

${issues}

${critical.length + serious.length > 10 ? `\n${t.andMore.replace('{count}', String(critical.length + serious.length - 10))}` : ''}

${t.remediationPlan.replace('{deadline}', deadline)}

**${t.testingDate}:** ${date}  
**${t.testingMethod}:** ${t.automatedTesting}

## ${t.technicalInfo}

${t.technicalDetails}

## ${t.contactTitle}

${t.contactIntro}

${contactInfo?.email ? `**${t.email}:** ${contactInfo.email}` : ''}
${contactInfo?.phone ? `**${t.phone}:** ${contactInfo.phone}` : ''}
${contactInfo?.address ? `**${t.address}:** ${contactInfo.address}` : ''}

${t.feedbackEncouraged}

---

${t.footer}
`;
  }

  /**
   * Get translations for specified language
   */
  private getTranslations(language: Language): Translations {
    const translations: Record<Language, Translations> = {
      cs: {
        title: 'Prohlášení o přístupnosti',
        commitment: 'se zavazuje k dodržování Směrnice EU 2019/882 o požadavcích na přístupnost pro produkty a služby.',
        complianceStatusTitle: 'Stav souladu',
        fullyCompliant: 'Tento web je **plně v souladu** s evropskou normou EN 301 549 a pokyny WCAG 2.1 úrovně AA.',
        partiallyCompliant: 'Tento web je **částečně v souladu** s požadavky EN 301 549 a WCAG 2.1 úrovně AA.',
        currentScore: 'Aktuální skóre přístupnosti',
        identifiedIssues: 'Identifikované nedostatky',
        occurrences: 'výskyty',
        andMore: '...a dalších {count} problémů',
        remediationPlan: 'Tyto nedostatky aktivně řešíme a plánujeme odstranit do **{deadline}**.',
        testingDate: 'Datum testování',
        testingMethod: 'Metoda testování',
        automatedTesting: 'Automatizované testování pomocí A11y-Flow (axe-core 4.8.3 + vlastní ACT testy)',
        technicalInfo: 'Technické informace',
        technicalDetails: 'Tento web byl testován s ohledem na:\n- WCAG 2.1 úroveň AA\n- EN 301 549\n- Směrnici EU 2019/882 (European Accessibility Act)',
        contactTitle: 'Kontakt',
        contactIntro: 'V případě zjištění problému s přístupností nás prosím kontaktujte:',
        email: 'E-mail',
        phone: 'Telefon',
        address: 'Adresa',
        feedbackEncouraged: 'Vaše připomínky nám pomohou zlepšit přístupnost našich služeb.',
        footer: '*Toto prohlášení bylo vygenerováno automaticky pomocí A11y-Flow. Doporučujeme konzultaci s právníkem pro úplné zajištění souladu s legislativou.*',
      },
      en: {
        title: 'Accessibility Statement',
        commitment: 'is committed to complying with EU Directive 2019/882 on accessibility requirements for products and services.',
        complianceStatusTitle: 'Compliance Status',
        fullyCompliant: 'This website is **fully compliant** with European standard EN 301 549 and WCAG 2.1 Level AA guidelines.',
        partiallyCompliant: 'This website is **partially compliant** with EN 301 549 and WCAG 2.1 Level AA requirements.',
        currentScore: 'Current accessibility score',
        identifiedIssues: 'Identified Issues',
        occurrences: 'occurrences',
        andMore: '...and {count} more issues',
        remediationPlan: 'We are actively addressing these issues and plan to resolve them by **{deadline}**.',
        testingDate: 'Testing date',
        testingMethod: 'Testing method',
        automatedTesting: 'Automated testing using A11y-Flow (axe-core 4.8.3 + custom ACT tests)',
        technicalInfo: 'Technical Information',
        technicalDetails: 'This website was tested against:\n- WCAG 2.1 Level AA\n- EN 301 549\n- EU Directive 2019/882 (European Accessibility Act)',
        contactTitle: 'Contact',
        contactIntro: 'If you encounter accessibility issues, please contact us:',
        email: 'Email',
        phone: 'Phone',
        address: 'Address',
        feedbackEncouraged: 'Your feedback helps us improve the accessibility of our services.',
        footer: '*This statement was automatically generated using A11y-Flow. We recommend consulting with legal counsel for full compliance assurance.*',
      },
      de: {
        title: 'Barrierefreiheitserklärung',
        commitment: 'verpflichtet sich zur Einhaltung der EU-Richtlinie 2019/882 über Barrierefreiheitsanforderungen für Produkte und Dienstleistungen.',
        complianceStatusTitle: 'Konformitätsstatus',
        fullyCompliant: 'Diese Website ist **vollständig konform** mit der europäischen Norm EN 301 549 und den WCAG 2.1 Level AA Richtlinien.',
        partiallyCompliant: 'Diese Website ist **teilweise konform** mit den Anforderungen der EN 301 549 und WCAG 2.1 Level AA.',
        currentScore: 'Aktueller Barrierefreiheits-Score',
        identifiedIssues: 'Identifizierte Mängel',
        occurrences: 'Vorkommen',
        andMore: '...und {count} weitere Probleme',
        remediationPlan: 'Wir arbeiten aktiv an der Behebung dieser Mängel und planen, sie bis zum **{deadline}** zu beheben.',
        testingDate: 'Testdatum',
        testingMethod: 'Testmethode',
        automatedTesting: 'Automatisierte Prüfung mit A11y-Flow (axe-core 4.8.3 + eigene ACT-Tests)',
        technicalInfo: 'Technische Informationen',
        technicalDetails: 'Diese Website wurde getestet gegen:\n- WCAG 2.1 Level AA\n- EN 301 549\n- EU-Richtlinie 2019/882 (European Accessibility Act)',
        contactTitle: 'Kontakt',
        contactIntro: 'Falls Sie auf Barrierefreiheitsprobleme stoßen, kontaktieren Sie uns bitte:',
        email: 'E-Mail',
        phone: 'Telefon',
        address: 'Adresse',
        feedbackEncouraged: 'Ihr Feedback hilft uns, die Barrierefreiheit unserer Dienste zu verbessern.',
        footer: '*Diese Erklärung wurde automatisch mit A11y-Flow generiert. Wir empfehlen die Konsultation eines Rechtsberaters für vollständige Konformitätsgarantie.*',
      },
    };

    return translations[language];
  }

  /**
   * Convert markdown to HTML
   * Simple implementation, for production consider using a proper markdown library
   */
  private markdownToHTML(markdown: string): string {
    let html = markdown
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      // Lists
      .replace(/^\- (.*$)/gim, '<li>$1</li>')
      // Line breaks
      .replace(/\n\n/g, '</p><p>')
      // Horizontal rule
      .replace(/^---$/gim, '<hr>');

    // Wrap in paragraphs
    html = '<p>' + html + '</p>';

    // Wrap list items in ul
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');

    return html;
  }
}

/**
 * Language codes
 */
export type Language = 'cs' | 'en' | 'de';

/**
 * Contact information for accessibility statement
 */
export interface ContactInfo {
  email?: string;
  phone?: string;
  address?: string;
}

/**
 * Accessibility statement output
 */
export interface AccessibilityStatement {
  markdown: string;
  html: string;
}

/**
 * Translation strings
 */
interface Translations {
  title: string;
  commitment: string;
  complianceStatusTitle: string;
  fullyCompliant: string;
  partiallyCompliant: string;
  currentScore: string;
  identifiedIssues: string;
  occurrences: string;
  andMore: string;
  remediationPlan: string;
  testingDate: string;
  testingMethod: string;
  automatedTesting: string;
  technicalInfo: string;
  technicalDetails: string;
  contactTitle: string;
  contactIntro: string;
  email: string;
  phone: string;
  address: string;
  feedbackEncouraged: string;
  footer: string;
}
