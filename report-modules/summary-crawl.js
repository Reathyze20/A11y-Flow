/**
 * Crawl Summary Component
 * Aggregate statistics and sortable page list for multi-page scans
 * Features: score filtering, issue sorting, quick preview stats
 */

const { escapeHtml } = require('./utils');

function generatePageListItem(page, pageIndex) {
  const violations = page.violations || [];
  const stats = {
    critical: violations.filter(v => v.impact === 'critical').length,
    serious: violations.filter(v => v.impact === 'serious').length,
    moderate: violations.filter(v => v.impact === 'moderate').length,
    minor: violations.filter(v => v.impact === 'minor').length
  };
  
  const totalIssues = stats.critical + stats.serious + stats.moderate + stats.minor;
  const score = page.score || 0;
  const scoreColor = score >= 90 ? 'success' : score >= 70 ? 'warning' : 'danger';
  
  return `
    <div class="bg-cardDark rounded-xl p-5 border border-gray-700 hover:border-gray-600 transition-all">
      <div class="flex items-center justify-between mb-4">
        <div class="flex-1 mr-4">
          <h4 class="text-white font-semibold text-lg mb-2 truncate" title="${escapeHtml(page.url)}">
            ${escapeHtml(page.url || `Page ${pageIndex + 1}`)}
          </h4>
          <div class="flex items-center gap-4 text-sm">
            <span class="text-${scoreColor} flex items-center gap-1">
              <i class="fas fa-check-circle"></i>
              <span class="font-semibold">${score}/100</span>
            </span>
            <span class="text-gray-400 flex items-center gap-1">
              <i class="fas fa-bug"></i>
              <span>${totalIssues} issues</span>
            </span>
          </div>
        </div>
        <button 
          onclick="openPageModal(${pageIndex})" 
          class="px-5 py-2.5 bg-brand hover:bg-blue-600 text-white rounded-lg transition-all flex items-center gap-2 font-medium shadow-lg hover:shadow-xl flex-shrink-0"
        >
          <i class="fas fa-external-link-alt"></i>
          <span>View Detail</span>
        </button>
      </div>

      <!-- Quick Preview Stats -->
      <div class="grid grid-cols-4 gap-2 pt-3 border-t border-gray-700">
        <div class="text-center p-2 ${stats.critical > 0 ? 'bg-danger/10 border border-danger/30' : 'bg-gray-700/10 border border-gray-700/30'} rounded">
          <div class="${stats.critical > 0 ? 'text-danger' : 'text-gray-500'} font-bold text-lg">${stats.critical}</div>
          <div class="text-xs text-gray-400">Critical</div>
        </div>
        <div class="text-center p-2 ${stats.serious > 0 ? 'bg-warning/10 border border-warning/30' : 'bg-gray-700/10 border border-gray-700/30'} rounded">
          <div class="${stats.serious > 0 ? 'text-warning' : 'text-gray-500'} font-bold text-lg">${stats.serious}</div>
          <div class="text-xs text-gray-400">Serious</div>
        </div>
        <div class="text-center p-2 ${stats.moderate > 0 ? 'bg-info/10 border border-info/30' : 'bg-gray-700/10 border border-gray-700/30'} rounded">
          <div class="${stats.moderate > 0 ? 'text-info' : 'text-gray-500'} font-bold text-lg">${stats.moderate}</div>
          <div class="text-xs text-gray-400">Moderate</div>
        </div>
        <div class="text-center p-2 ${stats.minor > 0 ? 'bg-gray-600/10 border border-gray-600/30' : 'bg-gray-700/10 border border-gray-700/30'} rounded">
          <div class="${stats.minor > 0 ? 'text-gray-300' : 'text-gray-500'} font-bold text-lg">${stats.minor}</div>
          <div class="text-xs text-gray-400">Minor</div>
        </div>
      </div>
    </div>
  `;
}

module.exports = function generateCrawlSummary(data) {
  const pages = data.pages || [];
  
  // Calculate aggregate stats
  let totalCritical = 0;
  let totalSerious = 0;
  let totalModerate = 0;
  
  pages.forEach(page => {
    (page.violations || []).forEach(v => {
      const impact = (v.impact || 'minor').toLowerCase();
      if (impact === 'critical') totalCritical++;
      else if (impact === 'serious') totalSerious++;
      else totalModerate++;
    });
  });

  const pagesWithIssues = pages.filter(p => (p.violations || []).length > 0).length;

  return `
    <section id="tab-summary" class="space-y-6">
      
      <!-- Aggregate Statistics -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-cardDark p-5 rounded-xl border-l-4 border-brand shadow-lg">
          <div class="text-gray-400 text-sm font-medium mb-1">Pages Scanned</div>
          <div class="text-3xl font-bold text-white">${pages.length}</div>
          <div class="text-xs text-brand mt-2"><i class="fas fa-sitemap"></i> Total pages analyzed</div>
        </div>
        <div class="bg-cardDark p-5 rounded-xl border-l-4 border-danger shadow-lg">
          <div class="text-gray-400 text-sm font-medium mb-1">Critical Issues</div>
          <div class="text-3xl font-bold text-white">${totalCritical}</div>
          <div class="text-xs text-danger mt-2"><i class="fas fa-exclamation-circle"></i> Across all pages</div>
        </div>
        <div class="bg-cardDark p-5 rounded-xl border-l-4 border-warning shadow-lg">
          <div class="text-gray-400 text-sm font-medium mb-1">Serious Issues</div>
          <div class="text-3xl font-bold text-white">${totalSerious}</div>
          <div class="text-xs text-warning mt-2"><i class="fas fa-exclamation-triangle"></i> Across all pages</div>
        </div>
        <div class="bg-cardDark p-5 rounded-xl border-l-4 border-yellow-200 shadow-lg">
          <div class="text-gray-400 text-sm font-medium mb-1">Pages with Issues</div>
          <div class="text-3xl font-bold text-white">${pagesWithIssues}</div>
          <div class="text-xs text-yellow-200 mt-2"><i class="fas fa-exclamation"></i> Need attention</div>
        </div>
      </div>

      <!-- Pages List -->
      <div class="bg-cardDark rounded-xl border border-gray-700 p-6">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <i class="fas fa-list text-2xl text-brand"></i>
            <div>
              <h3 class="text-2xl font-bold text-white">Scanned Pages</h3>
              <p class="text-sm text-gray-400">Click "View Detail" to see complete analysis for each page</p>
            </div>
          </div>
          
          <!-- Filter/Sort Controls -->
          <div class="flex items-center gap-3">
            <label class="text-sm text-gray-400">Sort by:</label>
            <select 
              id="page-sort" 
              onchange="sortPages(this.value)"
              class="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-brand focus:outline-none cursor-pointer"
            >
              <option value="default">Default Order</option>
              <option value="score-asc">Score: Low to High</option>
              <option value="score-desc">Score: High to Low</option>
              <option value="issues-desc">Most Issues First</option>
              <option value="issues-asc">Fewest Issues First</option>
              <option value="critical-desc">Most Critical Issues</option>
            </select>
          </div>
        </div>
        
        <div id="pages-container" class="space-y-4">
          ${pages.map((page, idx) => generatePageListItem(page, idx)).join('')}
        </div>
      </div>
    </section>
    
    <script>
      // Store original pages order
      window.originalPages = ${JSON.stringify(pages)};
      
      function sortPages(sortBy) {
        const container = document.getElementById('pages-container');
        let sortedPages = [...window.originalPages];
        
        switch(sortBy) {
          case 'score-asc':
            sortedPages.sort((a, b) => (a.score || 0) - (b.score || 0));
            break;
          case 'score-desc':
            sortedPages.sort((a, b) => (b.score || 0) - (a.score || 0));
            break;
          case 'issues-desc':
            sortedPages.sort((a, b) => {
              const aCount = (a.violations || []).length;
              const bCount = (b.violations || []).length;
              return bCount - aCount;
            });
            break;
          case 'issues-asc':
            sortedPages.sort((a, b) => {
              const aCount = (a.violations || []).length;
              const bCount = (b.violations || []).length;
              return aCount - bCount;
            });
            break;
          case 'critical-desc':
            sortedPages.sort((a, b) => {
              const aCritical = (a.violations || []).filter(v => v.impact === 'critical').length;
              const bCritical = (b.violations || []).filter(v => v.impact === 'critical').length;
              return bCritical - aCritical;
            });
            break;
          default:
            // Keep original order
            break;
        }
        
        // Re-render pages
        container.innerHTML = sortedPages.map((page, idx) => {
          return generatePageListItemHTML(page, idx);
        }).join('');
      }
      
      function generatePageListItemHTML(page, pageIndex) {
        const violations = page.violations || [];
        const stats = {
          critical: violations.filter(v => v.impact === 'critical').length,
          serious: violations.filter(v => v.impact === 'serious').length,
          moderate: violations.filter(v => v.impact === 'moderate').length,
          minor: violations.filter(v => v.impact === 'minor').length
        };
        
        const totalIssues = stats.critical + stats.serious + stats.moderate + stats.minor;
        const score = page.score || 0;
        const scoreColor = score >= 90 ? 'success' : score >= 70 ? 'warning' : 'danger';
        
        function escapeHtml(text) {
          const div = document.createElement('div');
          div.textContent = text;
          return div.innerHTML;
        }
        
        return \`
          <div class="bg-cardDark rounded-xl p-5 border border-gray-700 hover:border-gray-600 transition-all">
            <div class="flex items-center justify-between mb-4">
              <div class="flex-1 mr-4">
                <h4 class="text-white font-semibold text-lg mb-2 truncate" title="\${escapeHtml(page.url)}">
                  \${escapeHtml(page.url || \`Page \${pageIndex + 1}\`)}
                </h4>
                <div class="flex items-center gap-4 text-sm">
                  <span class="text-\${scoreColor} flex items-center gap-1">
                    <i class="fas fa-check-circle"></i>
                    <span class="font-semibold">\${score}/100</span>
                  </span>
                  <span class="text-gray-400 flex items-center gap-1">
                    <i class="fas fa-bug"></i>
                    <span>\${totalIssues} issues</span>
                  </span>
                </div>
              </div>
              <button 
                onclick="openPageModal(\${pageIndex})" 
                class="px-5 py-2.5 bg-brand hover:bg-blue-600 text-white rounded-lg transition-all flex items-center gap-2 font-medium shadow-lg hover:shadow-xl flex-shrink-0"
              >
                <i class="fas fa-external-link-alt"></i>
                <span>View Detail</span>
              </button>
            </div>

            <div class="grid grid-cols-4 gap-2 pt-3 border-t border-gray-700">
              <div class="text-center p-2 \${stats.critical > 0 ? 'bg-danger/10 border border-danger/30' : 'bg-gray-700/10 border border-gray-700/30'} rounded">
                <div class="\${stats.critical > 0 ? 'text-danger' : 'text-gray-500'} font-bold text-lg">\${stats.critical}</div>
                <div class="text-xs text-gray-400">Critical</div>
              </div>
              <div class="text-center p-2 \${stats.serious > 0 ? 'bg-warning/10 border border-warning/30' : 'bg-gray-700/10 border border-gray-700/30'} rounded">
                <div class="\${stats.serious > 0 ? 'text-warning' : 'text-gray-500'} font-bold text-lg">\${stats.serious}</div>
                <div class="text-xs text-gray-400">Serious</div>
              </div>
              <div class="text-center p-2 \${stats.moderate > 0 ? 'bg-info/10 border border-info/30' : 'bg-gray-700/10 border border-gray-700/30'} rounded">
                <div class="\${stats.moderate > 0 ? 'text-info' : 'text-gray-500'} font-bold text-lg">\${stats.moderate}</div>
                <div class="text-xs text-gray-400">Moderate</div>
              </div>
              <div class="text-center p-2 \${stats.minor > 0 ? 'bg-gray-600/10 border border-gray-600/30' : 'bg-gray-700/10 border border-gray-700/30'} rounded">
                <div class="\${stats.minor > 0 ? 'text-gray-300' : 'text-gray-500'} font-bold text-lg">\${stats.minor}</div>
                <div class="text-xs text-gray-400">Minor</div>
              </div>
            </div>
          </div>
        \`;
      }
    </script>
  `;
};

