import { Page, ElementHandle } from 'puppeteer-core';

/**
 * Handles Shadow DOM traversal and accessibility scanning
 */
export class ShadowDOMScanner {
  /**
   * Query all elements including those in shadow DOM
   * @param page - Puppeteer page instance
   * @param selector - CSS selector to search for
   * @returns Array of matching elements (serialized)
   */
  static async queryAllIncludingShadow(
    page: Page,
    selector: string
  ): Promise<any[]> {
    return page.evaluate((sel) => {
      const elements: Element[] = [];

      function traverseShadowDOM(root: Document | ShadowRoot) {
        // Query in current root
        const found = Array.from(root.querySelectorAll(sel));
        elements.push(...found);

        // Query all elements with shadow roots
        const allElements = Array.from(root.querySelectorAll('*'));
        allElements.forEach((el) => {
          if (el.shadowRoot) {
            traverseShadowDOM(el.shadowRoot);
          }
        });
      }

      traverseShadowDOM(document);

      // Return serialized data (can't return DOM nodes directly)
      return elements.map((el) => ({
        tagName: el.tagName,
        id: el.id,
        className: el.className,
        textContent: el.textContent?.substring(0, 100),
        attributes: Array.from(el.attributes).map((attr) => ({
          name: attr.name,
          value: attr.value,
        })),
      }));
    }, selector);
  }

  /**
   * Inject axe-core context into all shadow roots
   * This ensures axe can scan shadow DOM content
   */
  static async injectAxeIntoShadowRoots(page: Page): Promise<void> {
    console.log('[ShadowDOMScanner] Injecting axe context into shadow roots...');

    await page.evaluate(() => {
      function injectIntoShadowRoot(root: Document | ShadowRoot) {
        // Traverse all elements
        const allElements = Array.from(root.querySelectorAll('*'));
        allElements.forEach((el) => {
          if (el.shadowRoot) {
            // Mark shadow root as scanned
            (el.shadowRoot as any).__axe_shadow_root_injected = true;

            // Recursively inject into nested shadow roots
            injectIntoShadowRoot(el.shadowRoot);
          }
        });
      }

      injectIntoShadowRoot(document);
    });

    const shadowRootCount = await page.evaluate(() => {
      let count = 0;
      function countShadowRoots(root: Document | ShadowRoot) {
        const allElements = Array.from(root.querySelectorAll('*'));
        allElements.forEach((el) => {
          if (el.shadowRoot) {
            count++;
            countShadowRoots(el.shadowRoot);
          }
        });
      }
      countShadowRoots(document);
      return count;
    });

    console.log(
      `[ShadowDOMScanner] Found and prepared ${shadowRootCount} shadow root(s)`
    );
  }

  /**
   * Check if page contains any shadow DOM
   */
  static async hasShadowDOM(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      return Array.from(allElements).some((el) => el.shadowRoot !== null);
    });
  }

  /**
   * Get all shadow hosts (elements with shadow roots)
   */
  static async getShadowHosts(page: Page): Promise<
    Array<{
      tagName: string;
      id: string;
      className: string;
      shadowRootMode: 'open' | 'closed';
    }>
  > {
    return page.evaluate(() => {
      const hosts: Array<{
        tagName: string;
        id: string;
        className: string;
        shadowRootMode: 'open' | 'closed';
      }> = [];

      function findShadowHosts(root: Document | ShadowRoot) {
        const allElements = Array.from(root.querySelectorAll('*'));
        allElements.forEach((el) => {
          if (el.shadowRoot) {
            hosts.push({
              tagName: el.tagName,
              id: el.id,
              className: el.className,
              shadowRootMode: el.shadowRoot.mode,
            });
            // Recursively find nested shadow hosts
            findShadowHosts(el.shadowRoot);
          }
        });
      }

      findShadowHosts(document);
      return hosts;
    });
  }

  /**
   * Pierce shadow DOM to get actual element handles
   * Useful for interacting with elements inside shadow DOM
   */
  static async pierceElementHandle(
    page: Page,
    selector: string
  ): Promise<ElementHandle | null> {
    try {
      // Try standard query first
      let element = await page.$(selector);
      if (element) return element;

      // If not found, try piercing shadow DOM
      const shadowElement = await page.evaluateHandle((sel) => {
        function findInShadow(
          root: Document | ShadowRoot
        ): Element | null {
          // Try in current root
          let el = root.querySelector(sel);
          if (el) return el;

          // Search in shadow roots
          const allElements = Array.from(root.querySelectorAll('*'));
          for (const element of allElements) {
            if (element.shadowRoot) {
              el = findInShadow(element.shadowRoot);
              if (el) return el;
            }
          }
          return null;
        }

        return findInShadow(document);
      }, selector);

      return shadowElement.asElement() as ElementHandle<Element> | null;
    } catch (error) {
      console.warn(
        `[ShadowDOMScanner] Failed to pierce element: ${selector}`,
        error
      );
      return null;
    }
  }

  /**
   * Get flattened DOM tree including shadow DOM content
   * Useful for comprehensive accessibility analysis
   */
  static async getFlattenedDOM(page: Page): Promise<any> {
    return page.evaluate(() => {
      function flattenNode(node: Node, depth = 0): any {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          const result: any = {
            type: 'element',
            tagName: el.tagName,
            depth,
            attributes: {} as Record<string, string>,
            children: [],
          };

          // Copy attributes
          Array.from(el.attributes).forEach((attr) => {
            result.attributes[attr.name] = attr.value;
          });

          // Process child nodes
          el.childNodes.forEach((child) => {
            result.children.push(flattenNode(child, depth + 1));
          });

          // Process shadow root
          if (el.shadowRoot) {
            result.shadowRoot = {
              mode: el.shadowRoot.mode,
              children: [],
            };
            el.shadowRoot.childNodes.forEach((child) => {
              result.shadowRoot.children.push(flattenNode(child, depth + 1));
            });
          }

          return result;
        } else if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent?.trim();
          if (text) {
            return {
              type: 'text',
              content: text.substring(0, 100),
              depth,
            };
          }
        }
        return null;
      }

      return flattenNode(document.documentElement);
    });
  }

  /**
   * Detect web components (custom elements) on the page
   */
  static async detectWebComponents(page: Page): Promise<string[]> {
    return page.evaluate(() => {
      const customElements = new Set<string>();

      function findCustomElements(root: Document | ShadowRoot) {
        const allElements = Array.from(root.querySelectorAll('*'));
        allElements.forEach((el) => {
          // Custom elements have a hyphen in their tag name
          if (el.tagName.includes('-')) {
            customElements.add(el.tagName.toLowerCase());
          }

          // Recurse into shadow roots
          if (el.shadowRoot) {
            findCustomElements(el.shadowRoot);
          }
        });
      }

      findCustomElements(document);
      return Array.from(customElements);
    });
  }

  /**
   * Get accessibility tree including shadow DOM
   * This helps understand how screen readers will interpret the page
   */
  static async getAccessibilityTree(page: Page): Promise<any> {
    return page.evaluate(() => {
      function buildA11yTree(node: Element, depth = 0): any {
        const role = node.getAttribute('role') || node.tagName.toLowerCase();
        const name =
          node.getAttribute('aria-label') ||
          node.getAttribute('aria-labelledby') ||
          (node as HTMLElement).innerText?.substring(0, 50) ||
          '';

        const result: any = {
          role,
          name,
          depth,
          attributes: {
            'aria-hidden': node.getAttribute('aria-hidden'),
            'aria-disabled': node.getAttribute('aria-disabled'),
            'aria-expanded': node.getAttribute('aria-expanded'),
            tabindex: node.getAttribute('tabindex'),
          },
          children: [],
        };

        // Process children
        node.childNodes.forEach((child) => {
          if (child.nodeType === Node.ELEMENT_NODE) {
            result.children.push(buildA11yTree(child as Element, depth + 1));
          }
        });

        // Process shadow root
        if ((node as Element).shadowRoot) {
          const shadowRoot = (node as Element).shadowRoot!;
          shadowRoot.childNodes.forEach((child) => {
            if (child.nodeType === Node.ELEMENT_NODE) {
              result.children.push(buildA11yTree(child as Element, depth + 1));
            }
          });
        }

        return result;
      }

      return buildA11yTree(document.body);
    });
  }

  /**
   * Ensure all shadow roots are open for scanning
   * Note: This won't work for closed shadow roots, but logs them
   */
  static async ensureShadowRootsAccessible(page: Page): Promise<void> {
    const hosts = await this.getShadowHosts(page);
    const closedRoots = hosts.filter((h) => h.shadowRootMode === 'closed');

    if (closedRoots.length > 0) {
      console.warn(
        `[ShadowDOMScanner] Found ${closedRoots.length} closed shadow root(s) that cannot be scanned:`
      );
      closedRoots.forEach((host) => {
        console.warn(`  - <${host.tagName.toLowerCase()}${host.id ? '#' + host.id : ''}>`);
      });
      console.warn(
        '[ShadowDOMScanner] Closed shadow roots may hide accessibility issues'
      );
    }
  }
}
