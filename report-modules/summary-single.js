/**
 * Single Page Summary Component
 * Overview statistics and top issues for single-page scans
 */

const { escapeHtml } = require('./utils');

module.exports = function generateSinglePageSummary(data, stats) {
  // Use flattened violations array
  const violations = data.violationsArray || [];
  
  return `
    <section id="tab-summary" class="space-y-6">
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-cardDark p-5 rounded-xl border-l-4 border-danger shadow-lg">
          <div class="text-gray-400 text-sm font-medium mb-1">Critical Issues</div>
          <div class="text-3xl font-bold text-white">${stats.critical || 0}</div>
          <div class="text-xs text-danger mt-2"><i class="fas fa-exclamation-circle"></i> Blocks screen readers</div>
        </div>
        <div class="bg-cardDark p-5 rounded-xl border-l-4 border-warning shadow-lg">
          <div class="text-gray-400 text-sm font-medium mb-1">Serious Issues</div>
          <div class="text-3xl font-bold text-white">${stats.serious || 0}</div>
          <div class="text-xs text-warning mt-2"><i class="fas fa-exclamation-triangle"></i> Hinders orientation</div>
        </div>
        <div class="bg-cardDark p-5 rounded-xl border-l-4 border-yellow-200 shadow-lg">
          <div class="text-gray-400 text-sm font-medium mb-1">Other Issues</div>
          <div class="text-3xl font-bold text-white">${(stats.moderate || 0) + (stats.minor || 0)}</div>
          <div class="text-xs text-yellow-200 mt-2"><i class="fas fa-info-circle"></i> Moderate & Minor</div>
        </div>
        <div class="bg-cardDark p-5 rounded-xl border-l-4 border-success shadow-lg">
          <div class="text-gray-400 text-sm font-medium mb-1">Total Score</div>
          <div class="text-3xl font-bold text-white">${data.score || 0}/100</div>
          <div class="text-xs text-success mt-2"><i class="fas fa-check-circle"></i> WCAG 2.1 AA</div>
        </div>
      </div>

      ${violations.length > 0 ? `
        <!-- Top Issues Preview -->
        <div class="bg-cardDark rounded-xl p-6 border border-gray-700">
          <h3 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <i class="fas fa-exclamation-triangle text-warning"></i>
            Top Priority Issues
          </h3>
          <div class="space-y-3">
            ${violations.slice(0, 5).map(violation => {
              const severity = (violation.impact || 'minor').toLowerCase();
              const severityClass = severity === 'critical' ? 'bg-danger' : severity === 'serious' ? 'bg-warning' : 'bg-blue-500';
              const severityLabel = severity.charAt(0).toUpperCase() + severity.slice(1);
              
              return `
                <div class="bg-bgDark rounded-lg border border-gray-700 p-4 flex items-start gap-3">
                  <span class="${severityClass} text-white px-2 py-1 rounded text-xs font-bold uppercase shrink-0">${severityLabel}</span>
                  <div class="flex-1">
                    <h4 class="font-bold text-white mb-1">${escapeHtml(violation.help || violation.description)}</h4>
                    <p class="text-sm text-gray-400">${escapeHtml(violation.description)}</p>
                    ${violation.nodes && violation.nodes.length > 0 ? `
                      <div class="text-xs text-gray-500 mt-2">
                        <i class="fas fa-layer-group mr-1"></i>${violation.nodes.length} element${violation.nodes.length > 1 ? 's' : ''} affected
                      </div>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
          <div class="mt-4 text-center">
            <p class="text-sm text-gray-400">Showing ${Math.min(5, violations.length)} of ${violations.length} total issues</p>
          </div>
        </div>
      ` : `
        <div class="bg-green-900/20 border border-green-900/50 rounded-xl p-8 text-center">
          <i class="fas fa-check-circle text-success text-5xl mb-4"></i>
          <h3 class="text-2xl font-bold text-white mb-2">Great Job!</h3>
          <p class="text-gray-300">No accessibility issues detected on this page.</p>
        </div>
      `}

      <!-- Quick Guide -->
      <div class="bg-cardDark rounded-xl p-6 border border-gray-700">
        <h3 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <i class="fas fa-lightbulb text-brand"></i>
          Quick Start Guide
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-bgDark rounded-lg p-4 border border-gray-700">
            <div class="text-brand text-2xl mb-2"><i class="fas fa-tachometer-alt"></i></div>
            <h4 class="text-white font-bold mb-1">Check Performance</h4>
            <p class="text-sm text-gray-400">Review Core Web Vitals and loading metrics</p>
          </div>
          <div class="bg-bgDark rounded-lg p-4 border border-gray-700">
            <div class="text-brand text-2xl mb-2"><i class="fas fa-sitemap"></i></div>
            <h4 class="text-white font-bold mb-1">Review Structure</h4>
            <p class="text-sm text-gray-400">Analyze heading hierarchy and semantic structure</p>
          </div>
          <div class="bg-bgDark rounded-lg p-4 border border-gray-700">
            <div class="text-brand text-2xl mb-2"><i class="fas fa-code"></i></div>
            <h4 class="text-white font-bold mb-1">Fix Issues</h4>
            <p class="text-sm text-gray-400">Use provided code examples to resolve violations</p>
          </div>
        </div>
      </div>
    </section>
  `;
};
