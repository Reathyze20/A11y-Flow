/**
 * Sidebar Navigation Component
 * Tab navigation for Summary, Performance, and Heading Structure sections
 */

module.exports = function generateSidebar(stats, isCrawl) {
  const totalIssues = isCrawl 
    ? (stats.totalCritical + stats.totalSerious + stats.totalModerate)
    : (stats.total || 0);
  
  return `
    <nav class="sidebar w-64 bg-cardDark border-r border-gray-700 flex flex-col justify-between shrink-0 transition-all duration-300">
      <div>
        <div class="p-6 border-b border-gray-700">
          <div class="flex items-center gap-3 mb-1">
            <i class="fas fa-universal-access text-2xl text-brand"></i>
            <span class="font-bold text-xl tracking-tight">A11y Flow</span>
          </div>
          <div class="text-xs text-gray-400">Report v2.0</div>
        </div>
        
        <div class="p-4 space-y-2">
          <button onclick="switchTab('summary')" class="nav-btn w-full text-left px-4 py-3 rounded-lg bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 transition-colors flex items-center gap-3">
            <i class="fas fa-chart-pie w-5"></i> ${isCrawl ? 'Overview' : 'Summary'}
          </button>
          <button onclick="switchTab('performance')" class="nav-btn w-full text-left px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-700/50 hover:text-white transition-colors flex items-center gap-3">
            <i class="fas fa-tachometer-alt w-5"></i> Performance
          </button>
          <button onclick="switchTab('structure')" class="nav-btn w-full text-left px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-700/50 hover:text-white transition-colors flex items-center gap-3">
            <i class="fas fa-sitemap w-5"></i> Structure
          </button>
          ${totalIssues > 0 ? `
            <div class="mt-4 pt-4 border-t border-gray-700">
              <div class="text-xs text-gray-500 uppercase tracking-wider mb-2 px-4">Issues</div>
              <div class="px-4 py-2 bg-red-900/20 border-l-2 border-red-500 rounded">
                <div class="text-xs text-gray-400">Total Issues</div>
                <div class="text-2xl font-bold text-red-400">${totalIssues}</div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
      
      <div class="p-4 border-t border-gray-700">
        <button onclick="window.print()" class="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white transition-colors">
          <i class="fas fa-file-pdf mr-2"></i> Export PDF
        </button>
      </div>
    </nav>
  `;
};
