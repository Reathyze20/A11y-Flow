import { HumanReadableCategory, CodeSnippet, ViolationNode } from './types';
import snippetsData from './remediation-snippets.json';

/**
 * Služba pro překlad technických chyb do lidsky srozumitelných návodů.
 * Slouží jako "First Aid Kit" pro vývojáře i manažery.
 */
export class RemediationService {

  // Metadata for known rules – category + "what is wrong" + fix
  private static metaDatabase: Record<string, {
    category: HumanReadableCategory;
    what: string;
    fix: string;
    wcag?: string;
  }> = {
    'color-contrast': {
      category: 'Graphics',
      what: 'Low contrast between text and background.',
      fix: 'Increase contrast between text and background. For normal text, the ratio must be at least 4.5:1. Try darkening the font color or lightening the background.',
      wcag: '1.4.3 Contrast (Minimum)'
    },
    'image-alt': {
      category: 'Graphics',
      what: 'Images do not have a meaningful alt attribute.',
      fix: 'Every <img> image must have an alt="" attribute. If the image is purely decorative, use an empty alt="" or role="presentation". If it conveys information, describe it.',
      wcag: '1.1.1 Non-text Content'
    },
    'label': {
      category: 'Forms',
      what: 'Form fields do not have a visible or readable label.',
      fix: 'Every form field <input> must have a label. Use the <label for="id"> element or the aria-label attribute.',
      wcag: '3.3.2 Labels or Instructions'
    },
    'link-name': {
      category: 'Navigation',
      what: 'Links do not have understandable text (e.g., "click here").',
      fix: 'Links must have understandable text. Avoid texts like "click here". For icons, use aria-label or sr-only text.',
      wcag: '2.4.4 Link Purpose (In Context)'
    },
    'button-name': {
      category: 'Navigation',
      what: 'Buttons contain only an icon or empty content.',
      fix: 'Buttons must contain text. If you use only an icon, add an aria-label with a description of the action (e.g., "Search").',
      wcag: '4.1.2 Name, Role, Value'
    },
    'html-has-lang': {
      category: 'Structure',
      what: 'The page does not have a language set (lang="en").',
      fix: 'The <html> element is missing the lang attribute (e.g., <html lang="en">). This is critical for screen readers.',
      wcag: '3.1.1 Language of Page'
    },
    'list': {
      category: 'Structure',
      what: 'Lists are not correctly written using <ul>/<ol> and <li>.',
      fix: 'Lists <ul> and <ol> must contain only <li> elements. Check the HTML structure.',
      wcag: '1.3.1 Info and Relationships'
    },
    'aria-hidden-focus': {
      category: 'Technical',
      what: 'Focusable elements are hidden from screen readers (aria-hidden="true").',
      fix: 'Elements with aria-hidden="true" must not be interactive (focusable). Remove the tabindex or aria-hidden attribute.',
      wcag: '4.1.2 Name, Role, Value'
    },
    'frame-title': {
      category: 'Structure',
      what: 'Iframes do not have a title describing the content.',
      fix: 'Every <iframe> must have a title attribute that describes its content.',
      wcag: '2.4.1 Bypass Blocks'
    },
    'heading-order': {
      category: 'Structure',
      what: 'Headings on the page do not follow a logical order (H1 → H2 → H3).',
      fix: 'Headings should follow a sequence (H1 -> H2 -> H3). Do not skip levels (e.g., from H2 straight to H4).',
      wcag: '2.4.6 Headings and Labels'
    },
    'aria-required-children': {
      category: 'Technical',
      what: 'Element with ARIA role expects specific children, but they are missing in DOM (e.g., list without <li>, tablist without tabs).',
      fix: 'Check the documentation for the given ARIA role and add the required children – for example, for role="list" use role="listitem" for items, for role="tablist" add role="tab".',
      wcag: '1.3.1 Info and Relationships'
    },
    'aria-input-field-name': {
      category: 'Forms',
      what: 'Interactive input element has a role/type, but lacks an accessible name.',
      fix: 'Add a label using <label for="...">, aria-label, or aria-labelledby so that the screen reader announces a meaningful field name.',
      wcag: '4.1.2 Name, Role, Value'
    },
    'target-size': {
      category: 'Graphics',
      what: 'Click target (button, link, icon) is too small or has insufficient "hit area" for comfortable control.',
      fix: 'Increase the size of clickable elements to at least the recommended 24x24 CSS pixels or expand the clickable area so it can be easily activated even on touch screens.',
      wcag: '2.5.8 Target Size (Minimum)'
    }
  };

  public static getRuleMeta(ruleId: string): { category: HumanReadableCategory; what: string; fix: string; wcag?: string } {
    const meta = this.metaDatabase[ruleId];
    if (meta) return meta;

    return {
      category: 'Technical',
      what: `Technical accessibility issue (${ruleId}).`,
      fix: 'Study the documentation for this rule on Deque University (link in error detail) and adjust HTML / ARIA attributes.',
      wcag: undefined,
    };
  }

  // Zpětná kompatibilita – původní jednoduché API
  public static getFix(ruleId: string): string {
    return this.getRuleMeta(ruleId).fix;
  }

  /**
   * Get code snippet for a specific violation
   * Returns before/after code examples with explanation
   * 
   * @param ruleId Axe rule ID (e.g., 'image-alt', 'label')
   * @param context Optional context (HTML of the problematic element)
   * @returns Code snippet with before, after, and explanation
   */
  public static getCodeSnippet(ruleId: string, context?: any): CodeSnippet | undefined {
    // Load snippets from JSON
    const snippets = snippetsData as Record<string, any>;
    
    // Try direct lookup first
    let snippetTemplate = snippets[ruleId];
    
    // If not found, try common variations and patterns
    if (!snippetTemplate) {
      const variations = [
        // Remove common prefixes
        ruleId.replace(/^aria-/, ''),
        ruleId.replace(/^wcag2[a]{1,3}-/, ''),
        ruleId.replace(/^wcag-/, ''),
        // Try base concept (first word)
        ruleId.split('-')[0],
        // Try without last part (e.g., "color-contrast-enhanced" -> "color-contrast")
        ruleId.split('-').slice(0, -1).join('-'),
        // Map common rule patterns
        ruleId.includes('contrast') ? 'color-contrast' : null,
        ruleId.includes('label') ? 'label' : null,
        ruleId.includes('alt') ? 'image-alt' : null,
        ruleId.includes('lang') ? 'html-has-lang' : null,
        ruleId.includes('heading') ? 'heading-order' : null,
        ruleId.includes('landmark') ? 'landmark' : null,
        ruleId.includes('region') ? 'region' : null,
      ].filter(Boolean);
      
      for (const variation of variations) {
        if (snippets[variation as string]) {
          snippetTemplate = snippets[variation as string];
          console.log(`[RemediationService] Found snippet for "${ruleId}" using variation "${variation}"`);
          break;
        }
      }
    }
    
    if (!snippetTemplate) {
      console.log(`[RemediationService] No snippet found for rule "${ruleId}"`);
      return undefined;
    }

    // Try to make snippet context-aware if we have HTML
    let before = snippetTemplate.before;
    let after = snippetTemplate.after;

    if (context?.html) {
      before = this.extractRelevantHTML(context.html);
      after = this.generateContextAwareAfter(ruleId, before, snippetTemplate);
    }

    return {
      before,
      after,
      language: 'html',
      explanation: snippetTemplate.explanation,
    };
  }

  /**
   * Extract relevant HTML from violation node
   * Cleans up and formats HTML for display
   */
  private static extractRelevantHTML(html: string): string {
    // Remove excessive whitespace
    let cleaned = html.trim().replace(/\s+/g, ' ');
    
    // If too long, truncate intelligently
    if (cleaned.length > 200) {
      // Try to find a good breakpoint
      const tagEnd = cleaned.indexOf('>', 180);
      if (tagEnd > 0 && tagEnd < 250) {
        cleaned = cleaned.substring(0, tagEnd + 1);
      } else {
        cleaned = cleaned.substring(0, 200) + '...';
      }
    }
    
    return cleaned;
  }

  /**
   * Generate context-aware "after" code
   * Tries to apply fix to the actual problematic HTML
   */
  private static generateContextAwareAfter(
    ruleId: string,
    beforeHTML: string,
    template: any
  ): string {
    // For now, return template's after
    // In future, we could parse beforeHTML and apply fix
    // This would require HTML parsing library
    
    // Simple substitutions for common cases
    if (ruleId === 'image-alt' && beforeHTML.includes('<img')) {
      if (!beforeHTML.includes('alt=')) {
        // Extract src
        const srcMatch = beforeHTML.match(/src=["']([^"']+)["']/);
        const src = srcMatch ? srcMatch[1] : 'image.jpg';
        const filename = src.split('/').pop()?.split('.')[0] || 'image';
        return beforeHTML.replace('<img', `<img alt="${filename}"`);
      }
    }

    if (ruleId === 'html-has-lang' && beforeHTML.includes('<html')) {
      return beforeHTML.replace('<html', '<html lang="cs"');
    }

    // Fall back to template
    return template.after;
  }

  /**
   * Get all available code snippets
   * Useful for documentation or showing all examples
   */
  public static getAllSnippets(): Record<string, CodeSnippet> {
    const snippets = snippetsData as Record<string, any>;
    const result: Record<string, CodeSnippet> = {};

    for (const [key, value] of Object.entries(snippets)) {
      result[key] = {
        before: value.before,
        after: value.after,
        language: 'html',
        explanation: value.explanation,
      };
    }

    return result;
  }
}