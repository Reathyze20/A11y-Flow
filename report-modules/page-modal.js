/**
 * Page Detail Modal Component
 * Full-screen modal for detailed page analysis in crawl mode
 * Features: tabbed navigation, educational content, performance metrics
 */

const { escapeHtml, formatMs, getPerformanceRating } = require('./utils');

function generatePageModal() {
  return `
    <!-- Full-Screen Page Detail Modal -->
    <div id="page-modal" class="hidden fixed inset-0 z-50 bg-bgDark/95 backdrop-blur-sm overflow-y-auto">
      <div class="min-h-screen p-8">
        <!-- Modal Container -->
        <div class="max-w-7xl mx-auto bg-cardDark rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
          
          <!-- Modal Header -->
          <div class="sticky top-0 z-10 bg-cardDark border-b border-gray-700 px-8 py-6 flex items-center justify-between">
            <div class="flex-1">
              <h2 class="text-2xl font-bold text-white mb-1">Page Detail</h2>
              <p id="modal-page-url" class="text-brand text-sm truncate"></p>
            </div>
            <button 
              onclick="closePageModal()" 
              class="ml-4 w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            >
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>

          <!-- Modal Body with Sidebar -->
          <div class="flex">
            
            <!-- Modal Sidebar Navigation -->
            <nav class="w-64 bg-bgDark border-r border-gray-700 p-6 space-y-2 flex-shrink-0">
              <button 
                data-modal-tab="modal-tab-summary" 
                onclick="switchModalTab('modal-tab-summary')" 
                class="modal-nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-gray-400 hover:bg-gray-700"
              >
                <i class="fas fa-chart-pie w-5"></i>
                <span>Summary</span>
              </button>
              <button 
                data-modal-tab="modal-tab-violations" 
                onclick="switchModalTab('modal-tab-violations')" 
                class="modal-nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-gray-400 hover:bg-gray-700"
              >
                <i class="fas fa-bug w-5"></i>
                <span>Violations</span>
              </button>
              <button 
                data-modal-tab="modal-tab-performance" 
                onclick="switchModalTab('modal-tab-performance')" 
                class="modal-nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-gray-400 hover:bg-gray-700"
              >
                <i class="fas fa-tachometer-alt w-5"></i>
                <span>Performance</span>
              </button>
              <button 
                data-modal-tab="modal-tab-structure" 
                onclick="switchModalTab('modal-tab-structure')" 
                class="modal-nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-gray-400 hover:bg-gray-700"
              >
                <i class="fas fa-heading w-5"></i>
                <span>Heading Structure</span>
              </button>
            </nav>

            <!-- Modal Content Area -->
            <div class="flex-1 p-8 min-h-[600px] max-h-[calc(100vh-200px)] overflow-y-auto">
              <div id="modal-content-wrapper">
                <!-- Dynamic content injected here -->
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  `;
}

function generateModalScripts(pagesData) {
  return `
    <script>
      // Store pages data globally
      window.pagesData = ${JSON.stringify(pagesData)};

      // Open page modal with detail
      function openPageModal(pageIndex) {
        const page = window.pagesData[pageIndex];
        if (!page) return;

        // Update URL in header
        document.getElementById('modal-page-url').textContent = page.url || \`Page \${pageIndex + 1}\`;

        // Generate and inject content
        const contentWrapper = document.getElementById('modal-content-wrapper');
        contentWrapper.innerHTML = generatePageModalContent(page);

        // Show modal
        document.getElementById('page-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Initialize first tab
        switchModalTab('modal-tab-summary');
      }

      // Close modal
      function closePageModal() {
        document.getElementById('page-modal').classList.add('hidden');
        document.body.style.overflow = 'auto';
      }

      // Switch tabs within modal
      function switchModalTab(tabId) {
        // Hide all modal tabs
        document.querySelectorAll('[id^="modal-tab-"]').forEach(tab => {
          tab.classList.add('hidden');
        });

        // Remove active state from all nav buttons
        document.querySelectorAll('.modal-nav-btn').forEach(btn => {
          btn.classList.remove('bg-brand/10', 'text-brand', 'border-brand/20');
          btn.classList.add('text-gray-400');
        });

        // Show selected tab
        const selectedTab = document.getElementById(tabId);
        if (selectedTab) {
          selectedTab.classList.remove('hidden');
        }

        // Highlight active nav button
        const activeBtn = document.querySelector(\`[data-modal-tab="\${tabId}"]\`);
        if (activeBtn) {
          activeBtn.classList.remove('text-gray-400');
          activeBtn.classList.add('bg-brand/10', 'text-brand', 'border', 'border-brand/20');
        }
      }

      // Generate full modal content for a page
      function generatePageModalContent(page) {
        const stats = calculatePageStats(page);
        
        return \`
          \${generateModalSummaryTab(page, stats)}
          \${generateModalViolationsTab(page)}
          \${generateModalPerformanceTab(page)}
          \${generateModalStructureTab(page)}
        \`;
      }

      // Calculate statistics for a page
      function calculatePageStats(page) {
        const stats = { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0 };
        (page.violations || []).forEach(v => {
          const impact = (v.impact || 'minor').toLowerCase();
          stats.total++;
          if (stats[impact] !== undefined) stats[impact]++;
        });
        return stats;
      }

      // Summary Tab
      function generateModalSummaryTab(page, stats) {
        return \`
          <section id="modal-tab-summary" class="space-y-6">
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div class="bg-bgDark p-5 rounded-xl border-l-4 border-danger">
                <div class="text-gray-400 text-sm mb-1">Critical</div>
                <div class="text-3xl font-bold text-white">\${stats.critical}</div>
              </div>
              <div class="bg-bgDark p-5 rounded-xl border-l-4 border-warning">
                <div class="text-gray-400 text-sm mb-1">Serious</div>
                <div class="text-3xl font-bold text-white">\${stats.serious}</div>
              </div>
              <div class="bg-bgDark p-5 rounded-xl border-l-4 border-info">
                <div class="text-gray-400 text-sm mb-1">Other</div>
                <div class="text-3xl font-bold text-white">\${stats.moderate + stats.minor}</div>
              </div>
              <div class="bg-bgDark p-5 rounded-xl border-l-4 border-success">
                <div class="text-gray-400 text-sm mb-1">Score</div>
                <div class="text-3xl font-bold text-white">\${page.score || 0}/100</div>
              </div>
            </div>

            \${stats.total > 0 ? \`
              <div class="bg-bgDark rounded-xl p-6 border border-gray-700">
                <h3 class="text-xl font-bold text-white mb-4">Top Issues</h3>
                <div class="space-y-3">
                  \${(page.violations || []).slice(0, 5).map((v, idx) => \`
                    <div class="bg-cardDark p-4 rounded-lg border-l-4 border-\${v.impact === 'critical' ? 'danger' : v.impact === 'serious' ? 'warning' : 'info'}">
                      <h4 class="text-white font-semibold mb-1">\${escapeHtml(v.title || v.id)}</h4>
                      <p class="text-gray-400 text-sm">\${escapeHtml(v.description || '').substring(0, 150)}...</p>
                    </div>
                  \`).join('')}
                </div>
              </div>
            \` : '<div class="text-center py-12 text-gray-400"><i class="fas fa-check-circle text-5xl text-success mb-3"></i><p class="text-lg">No violations found!</p></div>'}
          </section>
        \`;
      }

      // Violations Tab
      function generateModalViolationsTab(page) {
        const violations = page.violations || [];
        
        const criticalCount = violations.filter(v => v.impact === 'critical').length;
        const seriousCount = violations.filter(v => v.impact === 'serious').length;
        
        const warningAlert = (violations.length > 0 && (criticalCount > 0 || seriousCount > 0)) ? \`
          <div class="bg-danger/10 border border-danger/30 rounded-xl p-5">
            <h3 class="text-white font-bold text-lg mb-2 flex items-center gap-2">
              <i class="fas fa-exclamation-triangle text-danger"></i>
              Prioritizujte opravy!
            </h3>
            <div class="text-gray-300 text-sm space-y-2">
              <p><strong class="text-danger">Critical violations</strong> blokují screen readery a asistivní technologie - uživatelé s postižením nemohou používat váš web.</p>
              <p><strong class="text-warning">Serious violations</strong> výrazně ztěžují orientaci a používání stránky.</p>
              <p class="text-xs text-gray-400 mt-2">Tip: Začněte opravou critical issues s nejvíce instancemi.</p>
            </div>
          </div>
        \` : '';
        
        return \`
          <section id="modal-tab-violations" class="hidden space-y-4">
            
            \${violations.length > 0 ? violations.map((v, idx) => \`
              <div class="bg-bgDark rounded-xl p-6 border-l-4 border-\${v.impact === 'critical' ? 'danger' : v.impact === 'serious' ? 'warning' : 'info'}">
                <div class="flex items-start justify-between mb-3">
                  <h3 class="text-white font-bold text-lg flex-1">\${escapeHtml(v.title || v.id)}</h3>
                  <span class="px-3 py-1 rounded-full text-xs font-semibold bg-\${v.impact === 'critical' ? 'danger' : v.impact === 'serious' ? 'warning' : 'info'}/20 text-\${v.impact === 'critical' ? 'danger' : v.impact === 'serious' ? 'warning' : 'info'}">
                    \${v.impact || 'minor'}
                  </span>
                </div>
                <p class="text-gray-400 mb-4">\${escapeHtml(v.description || '')}</p>
                <div class="flex items-center gap-4 text-sm text-gray-400">
                  <span><i class="fas fa-map-marker-alt"></i> \${(v.nodes || []).length} instances</span>
                  <span><i class="fas fa-tag"></i> \${v.id || 'N/A'}</span>
                </div>
                \${(v.nodes || []).length > 0 ? \`
                  <button 
                    onclick="toggleIssueDetails('modal-nodes-\${idx}')"
                    class="mt-4 text-brand hover:text-blue-400 text-sm flex items-center gap-2"
                  >
                    <i class="fas fa-chevron-down" id="icon-modal-nodes-\${idx}"></i>
                    Show affected elements
                  </button>
                  <div id="modal-nodes-\${idx}" class="hidden mt-3 space-y-2">
                    \${(v.nodes || []).slice(0, 5).map((node, nIdx) => \`
                      <div class="bg-cardDark p-3 rounded-lg font-mono text-xs text-gray-300 overflow-x-auto">
                        \${escapeHtml(node.html || node.target || 'N/A')}
                      </div>
                    \`).join('')}
                  </div>
                \` : ''}
              </div>
            \`).join('') : '<div class="text-center py-12 text-gray-400"><i class="fas fa-check-circle text-5xl text-success mb-3"></i><p class="text-lg">No violations detected!</p></div>'}
            
            \${warningAlert}
          </section>
        \`;
      }

      // Performance Tab
      function generateModalPerformanceTab(page) {
        const perf = page.performance || {};
        
        // Handle nested structure: coreWebVitals and navigation
        const metrics = {
          lcp: perf.coreWebVitals?.lcp || perf.lcp,
          cls: perf.coreWebVitals?.cls || perf.cls,
          tbt: perf.coreWebVitals?.tbt || perf.tbt,
          fcp: perf.navigation?.firstContentfulPaint || perf.fcp,
          ttfb: perf.navigation?.timeToFirstByte || perf.ttfb
        };
        
        const hasPerformanceData = Object.values(metrics).some(v => v !== undefined && v !== null);
        
        if (!hasPerformanceData) {
          return \`
            <section id="modal-tab-performance" class="hidden space-y-6">
              <div class="text-center py-12 text-gray-400">
                <i class="fas fa-tachometer-alt text-5xl mb-3 text-gray-600"></i>
                <p class="text-lg">Performance metrics not available</p>
                <p class="text-sm mt-2">Run a scan with performance monitoring enabled</p>
              </div>
            </section>
          \`;
        }

        const metricDefinitions = [
          { key: 'lcp', label: 'Largest Contentful Paint', icon: 'image', thresholds: { good: 2500, poor: 4000 } },
          { key: 'cls', label: 'Cumulative Layout Shift', icon: 'compress-arrows-alt', thresholds: { good: 0.1, poor: 0.25 } },
          { key: 'tbt', label: 'Total Blocking Time', icon: 'stopwatch', thresholds: { good: 300, poor: 600 } },
          { key: 'fcp', label: 'First Contentful Paint', icon: 'bolt', thresholds: { good: 1800, poor: 3000 } },
          { key: 'ttfb', label: 'Time to First Byte', icon: 'server', thresholds: { good: 800, poor: 1800 } }
        ];

        const metricCards = metricDefinitions
          .filter(metric => metrics[metric.key] !== undefined && metrics[metric.key] !== null)
          .map(metric => {
            const value = metrics[metric.key];
            const rating = value <= metric.thresholds.good ? 'success' : 
                           value <= metric.thresholds.poor ? 'warning' : 'danger';
            
            return \`
              <div class="bg-bgDark p-5 rounded-xl border border-gray-700">
                <div class="flex items-center justify-between mb-2">
                  <i class="fas fa-\${metric.icon} text-\${rating} text-xl"></i>
                  <span class="px-2 py-1 rounded text-xs font-semibold bg-\${rating}/20 text-\${rating}">
                    \${rating.toUpperCase()}
                  </span>
                </div>
                <div class="text-gray-400 text-sm mb-1">\${metric.label}</div>
                <div class="text-2xl font-bold text-white">
                  \${metric.key === 'cls' ? value.toFixed(3) : (value + 'ms')}
                </div>
              </div>
            \`;
          }).join('');

        return \`
          <section id="modal-tab-performance" class="hidden space-y-6">
            
            \${metricCards.length > 0 ? \`
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                \${metricCards}
              </div>
            \` : \`
              <div class="text-center py-12 text-gray-400">
                <i class="fas fa-tachometer-alt text-5xl mb-3 text-gray-600"></i>
                <p class="text-lg">No performance metrics recorded</p>
              </div>
            \`}

            <!-- Educational Info -->
            <div class="bg-info/10 border border-info/30 rounded-xl p-5">
              <h3 class="text-white font-bold text-lg mb-3 flex items-center gap-2">
                <i class="fas fa-lightbulb text-info"></i>
                Proč jsou Performance metriky důležité?
              </h3>
              <div class="text-gray-300 text-sm space-y-2">
                <p><strong>Core Web Vitals</strong> přímo ovlivňují uživatelskou zkušenost a SEO ranking:</p>
                <ul class="list-disc list-inside space-y-1 ml-2">
                  <li><strong>LCP (Largest Contentful Paint):</strong> Rychlost načtení hlavního obsahu</li>
                  <li><strong>CLS (Cumulative Layout Shift):</strong> Vizuální stabilita stránky</li>
                  <li><strong>TBT (Total Blocking Time):</strong> Responzivita během načítání</li>
                  <li><strong>FCP (First Contentful Paint):</strong> První vizuální feedback</li>
                  <li><strong>TTFB (Time to First Byte):</strong> Rychlost serveru</li>
                </ul>
                <p class="mt-3 text-gray-400">Pomalá stránka může vést k 53% bounce rate na mobilech (Google).</p>
              </div>
            </div>
          </section>
        \`;
      }

      // Heading Structure Tab
      function generateModalStructureTab(page) {
        const structure = page.headingStructure || {};
        const detections = structure.detections || [];
        const headings = structure.headings || [];
        const hasStructureData = headings.length > 0 || detections.length > 0;

        if (!hasStructureData) {
          return \`
            <section id="modal-tab-structure" class="hidden space-y-6">
              <div class="text-center py-12 text-gray-400">
                <i class="fas fa-heading text-5xl mb-3 text-gray-600"></i>
                <p class="text-lg">Heading structure not available</p>
                <p class="text-sm mt-2">This page may not have been scanned for heading structure</p>
              </div>
            </section>
          \`;
        }

        return \`
          <section id="modal-tab-structure" class="hidden space-y-6">
            
            <!-- Detections / Results -->
            \${detections.length > 0 ? \`
              <div class="bg-bgDark rounded-xl p-6 border border-gray-700">
                <h3 class="text-xl font-bold text-white mb-4">Detected Issues</h3>
                <div class="space-y-3">
                  \${detections.map(d => \`
                    <div class="bg-cardDark p-4 rounded-lg border-l-4 border-warning">
                      <h4 class="text-white font-semibold">\${d.type.replace(/-/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase())}</h4>
                      <p class="text-gray-400 text-sm mt-1">\${d.message}</p>
                    </div>
                  \`).join('')}
                </div>
              </div>
            \` : \`
              <div class="bg-green-900/20 border border-green-900/50 rounded-xl p-6 text-center">
                <i class="fas fa-check-circle text-success text-4xl mb-2"></i>
                <p class="text-white font-bold text-lg">Perfect heading structure!</p>
              </div>
            \`}

            <!-- Statistics -->
            <div class="grid grid-cols-3 md:grid-cols-6 gap-3">
              \${['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map(level => {
                const count = headings.filter(h => h.level === level.toUpperCase()).length;
                return \`
                  <div class="bg-bgDark p-4 rounded-lg text-center border border-gray-700">
                    <div class="text-brand font-bold text-2xl">\${count}</div>
                    <div class="text-gray-400 text-sm">\${level.toUpperCase()}</div>
                  </div>
                \`;
              }).join('')}
            </div>

            <!-- Heading Tree -->
            \${headings.length > 0 ? \`
              <div class="bg-bgDark rounded-xl p-6 border border-gray-700">
                <h3 class="text-xl font-bold text-white mb-4">Heading Hierarchy</h3>
                <div class="space-y-2">
                  \${headings.map(h => {
                    const level = String(h.level || 'H1').toUpperCase();
                    const levelNum = parseInt(level.replace(/[^0-9]/g, '')) || 1;
                    return \`
                      <div class="flex items-start gap-3 p-3 bg-cardDark rounded" style="margin-left: \${(levelNum - 1) * 20}px">
                        <span class="px-2 py-1 rounded text-xs font-mono bg-brand/20 text-brand">\${level}</span>
                        <span class="text-gray-300 flex-1">\${escapeHtml(h.text || '(empty)')}</span>
                      </div>
                    \`;
                  }).join('')}
                </div>
              </div>
            \` : ''}

            <!-- Educational Info -->
            <div class="bg-warning/10 border border-warning/30 rounded-xl p-5">
              <h3 class="text-white font-bold text-lg mb-3 flex items-center gap-2">
                <i class="fas fa-graduation-cap text-warning"></i>
                Proč je správná struktura nadpisů důležitá?
              </h3>
              <div class="text-gray-300 text-sm space-y-2">
                <p><strong>Heading structure</strong> je kritická pro navigaci a orientaci:</p>
                <ul class="list-disc list-inside space-y-1 ml-2">
                  <li><strong>Screen readery</strong> používají nadpisy pro rychlou navigaci po stránce</li>
                  <li><strong>SEO optimalizace</strong> - vyhledávače používají nadpisy pro pochopení struktury</li>
                  <li><strong>Hierarchie informací</strong> pomáhá všem uživatelům orientovat se v obsahu</li>
                  <li><strong>WCAG 2.1 požadavek:</strong> Správné použití H1-H6 podle logické struktury</li>
                </ul>
                <p class="mt-3 text-warning">68% uživatelů screen readerů naviguje stránku pomocí nadpisů.</p>
              </div>
            </div>
          </section>
        \`;
      }

      // Escape HTML helper
      function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }

      // Close modal on ESC key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePageModal();
      });
    </script>
  `;
}

module.exports = {
  generatePageModal,
  generateModalScripts
};
