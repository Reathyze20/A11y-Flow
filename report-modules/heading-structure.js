/**
 * Heading Structure Component
 * H1-H6 hierarchy analysis, issue detection, and visualization
 * Supports both single-page and crawl modes
 */

const { escapeHtml } = require('./utils');

function generateHeadingStructureSingleView(data) {
  const headingStructure = data.headingStructure || { headings: [], issues: [] };
  const headings = headingStructure.headings || [];
  const issues = headingStructure.issues || [];

  if (headings.length === 0) {
    return `
      <div class="bg-cardDark rounded-xl border border-gray-700 p-6">
        <h3 class="text-xl font-bold text-white mb-4">Heading Structure</h3>
        <div class="text-gray-400">No heading structure data available.</div>
      </div>
    `;
  }

  // Generate statistics
  const stats = {};
  headings.forEach(h => {
    stats[h.level] = (stats[h.level] || 0) + 1;
  });

  const getColorClass = (level) => {
    const colors = {
      1: 'text-blue-400 border-blue-400',
      2: 'text-green-400 border-green-400',
      3: 'text-yellow-400 border-yellow-400',
      4: 'text-purple-400 border-purple-400',
      5: 'text-pink-400 border-pink-400',
      6: 'text-gray-400 border-gray-400'
    };
    return colors[level] || 'text-gray-400 border-gray-400';
  };

  const issuesHtml = issues.length > 0 ? `
    <div class="bg-red-900/20 border border-red-900/50 rounded-xl p-4 mb-4">
      <div class="flex items-center gap-3 mb-3">
        <i class="fas fa-exclamation-triangle text-red-400"></i>
        <h4 class="text-white font-bold">Issues Found (${issues.length})</h4>
      </div>
      <div class="space-y-2">
        ${issues.map(issue => `
          <div class="text-sm text-gray-300">
            <i class="fas fa-times-circle text-red-400 mr-2"></i>${escapeHtml(issue.description)}
          </div>
        `).join('')}
      </div>
    </div>
  ` : `
    <div class="bg-green-900/20 border border-green-900/50 rounded-xl p-4 mb-4">
      <div class="flex items-center gap-3">
        <i class="fas fa-check-circle text-success"></i>
        <p class="text-white font-medium">Heading structure looks good!</p>
      </div>
    </div>
  `;

  return `
    <div class="bg-cardDark rounded-xl border border-gray-700 p-6">
      <div class="flex items-center gap-3 mb-6">
        <i class="fas fa-heading text-2xl text-brand"></i>
        <div>
          <h3 class="text-2xl font-bold text-white">Heading Structure</h3>
          <p class="text-sm text-gray-400">${headings.length} headings total</p>
        </div>
      </div>
      
      <!-- Statistics -->
      <div class="mb-6">
        <h4 class="text-white font-bold mb-3">Statistics</h4>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          ${[1, 2, 3, 4, 5, 6].map(level => {
            const count = stats[level] || 0;
            return `
              <div class="bg-bgDark rounded-lg p-3 border border-gray-700 text-center">
                <div class="text-xs text-gray-400 mb-1">H${level}</div>
                <div class="text-2xl font-bold ${getColorClass(level).split(' ')[0]}">${count}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      ${issuesHtml}

      <!-- Headings List -->
      <div>
        <h4 class="text-white font-bold mb-3">Hierarchy</h4>
        <div class="bg-bgDark rounded-lg p-4 border border-gray-700 max-h-96 overflow-y-auto">
          <div class="space-y-2">
            ${headings.map(h => {
              const indent = (h.level - 1) * 16;
              return `
                <div class="flex items-center gap-2" style="margin-left: ${indent}px">
                  <span class="px-2 py-0.5 rounded border ${getColorClass(h.level)} font-mono text-xs shrink-0">H${h.level}</span>
                  <span class="text-gray-300 text-sm ${!h.text ? 'italic text-gray-500' : ''}">${h.text ? escapeHtml(h.text) : '(empty)'}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function generateHeadingStructureCrawlView(data) {
  const pages = data.pages || [];
  
  // Aggregate stats
  let totalHeadings = 0;
  let totalIssues = 0;
  let pagesWithoutH1 = 0;
  let pagesWithMultipleH1 = 0;

  pages.forEach(page => {
    const hs = page.headingStructure;
    if (!hs) return;
    
    totalHeadings += (hs.headings || []).length;
    totalIssues += (hs.issues || []).length;
    
    (hs.issues || []).forEach(issue => {
      if (issue.type === 'missing-h1') pagesWithoutH1++;
      if (issue.type === 'multiple-h1') pagesWithMultipleH1++;
    });
  });

  return `
    <div class="bg-cardDark rounded-xl border border-gray-700 p-6">
      <div class="flex items-center gap-3 mb-6">
        <i class="fas fa-heading text-2xl text-brand"></i>
        <div>
          <h3 class="text-2xl font-bold text-white">Heading Structure Overview</h3>
          <p class="text-sm text-gray-400">${pages.length} pages analyzed</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-bgDark rounded-lg p-4 border border-gray-700 text-center">
          <div class="text-xs text-gray-400 mb-1">Total Headings</div>
          <div class="text-3xl font-bold text-white">${totalHeadings}</div>
        </div>
        <div class="bg-bgDark rounded-lg p-4 border ${totalIssues === 0 ? 'border-green-600' : 'border-red-600'} text-center">
          <div class="text-xs text-gray-400 mb-1">Total Issues</div>
          <div class="text-3xl font-bold ${totalIssues === 0 ? 'text-green-400' : 'text-red-400'}">${totalIssues}</div>
        </div>
        <div class="bg-bgDark rounded-lg p-4 border ${pagesWithoutH1 === 0 ? 'border-green-600' : 'border-red-600'} text-center">
          <div class="text-xs text-gray-400 mb-1">Without H1</div>
          <div class="text-3xl font-bold ${pagesWithoutH1 === 0 ? 'text-green-400' : 'text-red-400'}">${pagesWithoutH1}</div>
        </div>
        <div class="bg-bgDark rounded-lg p-4 border ${pagesWithMultipleH1 === 0 ? 'border-green-600' : 'border-orange-600'} text-center">
          <div class="text-xs text-gray-400 mb-1">Multiple H1</div>
          <div class="text-3xl font-bold ${pagesWithMultipleH1 === 0 ? 'text-green-400' : 'text-orange-400'}">${pagesWithMultipleH1}</div>
        </div>
      </div>

      <div class="text-sm text-gray-400 text-center">
        <i class="fas fa-info-circle mr-2"></i>
        View individual page details in the Overview tab for complete heading structure analysis
      </div>
    </div>
  `;
}

module.exports = function generateHeadingStructure(data, isCrawl) {
  if (isCrawl) {
    return generateHeadingStructureCrawlView(data);
  } else {
    return generateHeadingStructureSingleView(data);
  }
};
