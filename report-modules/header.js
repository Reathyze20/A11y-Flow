/**
 * Header Component
 * Report title, URL, scan metadata, and theme toggle button
 */

const { escapeHtml } = require('./utils');

module.exports = function generateHeader(data, isCrawl) {
  const score = isCrawl ? (data.averageScore ?? 0) : (data.score ?? 0);
  const rootUrl = isCrawl ? (data.rootUrl || 'Unknown URL') : (data.url || 'Unknown URL');
  const scanDate = new Date().toLocaleString('en-US');
  
  return `
    <header class="flex justify-between items-start mb-8 border-b border-gray-700 pb-6 relative">
      <div class="flex items-start gap-4">
        <!-- Theme Toggle Button -->
        <button 
          onclick="toggleTheme()" 
          class="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors mt-1"
          title="Toggle theme"
        >
          <i id="theme-icon" class="fas fa-sun text-yellow-400"></i>
        </button>
        
        <div>
        <h1 class="text-3xl font-bold text-white mb-2">Accessibility Report</h1>
        <a href="${escapeHtml(rootUrl)}" target="_blank" class="text-brand hover:underline flex items-center gap-2">
          <i class="fas fa-external-link-alt text-sm"></i> ${escapeHtml(rootUrl)}
        </a>
        <p class="text-gray-400 text-sm mt-1">Generated: ${scanDate}</p>
        ${isCrawl ? `<p class="text-gray-400 text-sm">Pages scanned: ${(data.pages || []).length}</p>` : ''}
        </div>
      </div>
      
      <div class="flex items-center gap-6">
        <div class="text-right">
          <div class="text-sm text-gray-400 uppercase tracking-wider mb-1">${isCrawl ? 'Average' : 'Total'} Score</div>
          <div class="text-3xl font-bold text-success">${score} / 100</div>
          <div class="text-xs text-gray-500">WCAG 2.1 AA</div>
        </div>
        <div class="w-20 h-20">
          <svg viewBox="0 0 36 36" class="circular-chart">
            <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            <path class="circle stroke-success" stroke-dasharray="${score}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            <text x="18" y="20.35" class="percentage">${score}%</text>
          </svg>
        </div>
      </div>
    </header>
  `;
};
