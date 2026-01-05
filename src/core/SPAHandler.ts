import { Page } from 'puppeteer-core';

/**
 * Handles Single Page Application (SPA) specific waiting and state management
 */
export class SPAHandler {
  /**
   * Wait for SPA framework hydration and stability
   * @param page - Puppeteer page instance
   * @param framework - SPA framework type (auto-detected if not specified)
   * @param timeout - Maximum wait time in milliseconds
   */
  static async waitForSPAReady(
    page: Page,
    framework: 'react' | 'vue' | 'angular' | 'auto' = 'auto',
    timeout = 10000
  ): Promise<void> {
    console.log('[SPAHandler] Waiting for SPA framework to be ready...');

    // Auto-detect framework if needed
    if (framework === 'auto') {
      const detected = await this.detectFramework(page);
      if (detected) {
        framework = detected;
        console.log(`[SPAHandler] Detected framework: ${framework}`);
      }
    }

    // Framework-specific hydration waiting
    try {
      switch (framework) {
        case 'react':
          await this.waitForReactHydration(page);
          break;
        case 'vue':
          await this.waitForVueReady(page);
          break;
        case 'angular':
          await this.waitForAngularReady(page);
          break;
      }
    } catch (error) {
      console.warn(`[SPAHandler] Framework-specific wait failed: ${error}`);
    }

    // Generic stability wait (works for all SPAs)
    await this.waitForStable(page, timeout);
    console.log('[SPAHandler] SPA is ready');
  }

  /**
   * Detect which SPA framework is used on the page
   */
  static async detectFramework(
    page: Page
  ): Promise<'react' | 'vue' | 'angular' | undefined> {
    return page.evaluate(() => {
      // React detection
      if (
        (window as any).React ||
        (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ ||
        document.querySelector('[data-reactroot]') ||
        document.querySelector('[data-reactid]')
      ) {
        return 'react';
      }

      // Vue detection
      if (
        (window as any).Vue ||
        (window as any).__VUE__ ||
        document.querySelector('[data-v-]') ||
        document.querySelector('[data-vue-]')
      ) {
        return 'vue';
      }

      // Angular detection
      if (
        (window as any).ng ||
        (window as any).getAllAngularRootElements ||
        document.querySelector('[ng-version]') ||
        document.querySelector('app-root')
      ) {
        return 'angular';
      }

      return undefined;
    });
  }

  /**
   * Wait for React hydration to complete
   */
  private static async waitForReactHydration(page: Page): Promise<void> {
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        // React 18 concurrent features
        if ((window as any).requestIdleCallback) {
          (window as any).requestIdleCallback(() => resolve());
        } else {
          // Fallback for older browsers
          setTimeout(() => resolve(), 100);
        }
      });
    });
  }

  /**
   * Wait for Vue to be ready
   */
  private static async waitForVueReady(page: Page): Promise<void> {
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const checkVueReady = () => {
          const vue = (window as any).Vue || (window as any).__VUE__;
          if (vue) {
            // Vue instance exists, wait for next tick
            if (vue.nextTick) {
              vue.nextTick(() => resolve());
            } else {
              setTimeout(() => resolve(), 50);
            }
          } else {
            setTimeout(() => resolve(), 50);
          }
        };
        checkVueReady();
      });
    });
  }

  /**
   * Wait for Angular to be stable
   */
  private static async waitForAngularReady(page: Page): Promise<void> {
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const checkAngularStable = () => {
          const ng = (window as any).ng;
          if (ng && ng.getTestability) {
            try {
              const testability = ng.getTestability(document.body);
              if (testability) {
                testability.whenStable(() => resolve());
              } else {
                setTimeout(() => resolve(), 100);
              }
            } catch {
              setTimeout(() => resolve(), 100);
            }
          } else {
            setTimeout(() => resolve(), 100);
          }
        };
        checkAngularStable();
      });
    });
  }

  /**
   * Wait for page to be stable (no DOM mutations, no pending requests)
   * This works for any SPA framework
   */
  private static async waitForStable(
    page: Page,
    timeout = 5000,
    stabilityTime = 500
  ): Promise<void> {
    const startTime = Date.now();

    // Setup mutation observer
    await page.evaluate(() => {
      (window as any).__lastMutationTime = Date.now();
      (window as any).__mutationCount = 0;

      const observer = new MutationObserver(() => {
        (window as any).__lastMutationTime = Date.now();
        (window as any).__mutationCount++;
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });

      // Store observer for cleanup
      (window as any).__mutationObserver = observer;
    });

    try {
      // Wait for stability
      let lastMutationTime = Date.now();

      while (Date.now() - startTime < timeout) {
        const currentMutationTime = await page.evaluate(
          () => (window as any).__lastMutationTime || 0
        );

        if (currentMutationTime > lastMutationTime) {
          // New mutation detected
          lastMutationTime = currentMutationTime;
        } else if (Date.now() - lastMutationTime >= stabilityTime) {
          // Page has been stable for required time
          console.log(
            `[SPAHandler] Page stable after ${Date.now() - startTime}ms`
          );
          break;
        }

        // Check more frequently at start, less frequently later
        const waitTime = Date.now() - startTime < 1000 ? 50 : 100;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      if (Date.now() - startTime >= timeout) {
        console.warn(
          `[SPAHandler] Timeout waiting for stability after ${timeout}ms`
        );
      }
    } finally {
      // Cleanup observer
      await page
        .evaluate(() => {
          if ((window as any).__mutationObserver) {
            (window as any).__mutationObserver.disconnect();
            delete (window as any).__mutationObserver;
            delete (window as any).__lastMutationTime;
            delete (window as any).__mutationCount;
          }
        })
        .catch(() => {
          /* ignore cleanup errors */
        });
    }
  }

  /**
   * Trigger common SPA state changes for comprehensive scanning
   * (e.g., hover states, focus states)
   */
  static async exploreDynamicStates(page: Page): Promise<void> {
    console.log('[SPAHandler] Exploring dynamic states...');

    await page.evaluate(() => {
      // Trigger hover on interactive elements
      const interactiveElements = document.querySelectorAll(
        'button, a, [role="button"], [role="link"], input, select, textarea'
      );

      interactiveElements.forEach((el) => {
        if (el instanceof HTMLElement) {
          // Dispatch hover events
          el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        }
      });

      // Trigger focus on focusable elements
      const focusableElements = document.querySelectorAll(
        'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      focusableElements.forEach((el) => {
        if (el instanceof HTMLElement) {
          el.focus();
          el.blur();
        }
      });
    });

    // Wait for any triggered state changes to settle
    await this.waitForStable(page, 2000, 300);
  }

  /**
   * Check if page uses client-side routing
   */
  static async hasClientSideRouting(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      // Check for common routing libraries
      return !!(
        (window as any).React?.Router ||
        (window as any).VueRouter ||
        (window as any).__NEXT_DATA__ ||
        document.querySelector('[data-nextjs-router]') ||
        document.querySelector('router-outlet')
      );
    });
  }

  /**
   * Wait for lazy-loaded content (images, iframes, etc.)
   */
  static async waitForLazyContent(page: Page, timeout = 5000): Promise<void> {
    console.log('[SPAHandler] Waiting for lazy-loaded content...');

    await page.evaluate(
      (timeoutMs) => {
        return new Promise<void>((resolve) => {
          const loadingElements = new Set<Element>();
          const startTime = Date.now();

          // Find all lazy-loadable elements
          const findLazyElements = () => {
            document.querySelectorAll('img[loading="lazy"], iframe[loading="lazy"]').forEach((el) => {
              if (el instanceof HTMLImageElement) {
                if (!el.complete || !el.naturalHeight) {
                  loadingElements.add(el);
                }
              } else if (el instanceof HTMLIFrameElement) {
                // Iframes don't have complete/naturalHeight, just check if loaded
                loadingElements.add(el);
              }
            });
          };

          findLazyElements();

          const checkInterval = setInterval(() => {
            if (Date.now() - startTime > timeoutMs) {
              clearInterval(checkInterval);
              resolve();
              return;
            }

            if (loadingElements.size === 0) {
              clearInterval(checkInterval);
              resolve();
              return;
            }

            // Remove loaded elements
            loadingElements.forEach((el) => {
              if (
                (el as HTMLImageElement).complete &&
                (el as HTMLImageElement).naturalHeight
              ) {
                loadingElements.delete(el);
              }
            });
          }, 100);
        });
      },
      timeout
    );
  }
}
