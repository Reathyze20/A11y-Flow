/**
 * Performance Metrics Component
 * Core Web Vitals (LCP, CLS, TBT) and Navigation Timing display
 */

const { formatMs, formatNumber, getPerformanceRating } = require('./utils');

module.exports = function generatePerformance(data, isAggregated = false) {
  const perf = data.performance || {};
  const cwv = perf.coreWebVitals || {};
  const nav = perf.navigation || {};
  
  if (!perf || (!cwv.lcp && !cwv.cls && !cwv.tbt)) {
    return `
      <div class="bg-cardDark rounded-xl p-6 border border-gray-700">
        <h3 class="text-xl font-bold text-white mb-4">Performance Metrics</h3>
        <div class="text-gray-400">Performance data not available for this ${isAggregated ? 'crawl' : 'page'}.</div>
      </div>
    `;
  }

  const lcpRating = getPerformanceRating(cwv.lcp, 'lcp');
  const fcpRating = getPerformanceRating(nav.firstContentfulPaint, 'fcp');
  const clsRating = getPerformanceRating(cwv.cls, 'cls');
  const tbtRating = getPerformanceRating(cwv.tbt, 'tbt');
  const ttfbRating = getPerformanceRating(nav.timeToFirstByte, 'ttfb');
  
  return `
    <div class="bg-cardDark rounded-xl p-6 border border-gray-700">
      <div class="flex items-center gap-3 mb-6">
        <i class="fas fa-tachometer-alt text-2xl text-brand"></i>
        <div>
          <h3 class="text-2xl font-bold text-white">Performance Metrics</h3>
          <p class="text-sm text-gray-400">Core Web Vitals & Navigation Timing</p>
        </div>
      </div>
      
      <!-- Core Web Vitals -->
      <div class="mb-8">
        <h4 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <i class="fas fa-bolt text-warning"></i>
          Core Web Vitals
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- LCP -->
          <div class="bg-bgDark rounded-lg p-5 border border-gray-700">
            <div class="flex items-center justify-between mb-2">
              <div class="text-sm text-gray-400 font-medium">LCP</div>
              <span class="text-xs px-2 py-1 rounded bg-${lcpRating.color}/20 text-${lcpRating.color} border border-${lcpRating.color}/30">${lcpRating.label}</span>
            </div>
            <div class="text-3xl font-bold text-white mb-1">${formatMs(cwv.lcp)}</div>
            <div class="text-xs text-gray-500">Largest Contentful Paint</div>
            <div class="mt-3 text-xs text-gray-400">
              <div class="flex justify-between mb-1">
                <span>Good</span>
                <span class="text-success">≤ 2.5s</span>
              </div>
              <div class="flex justify-between">
                <span>Poor</span>
                <span class="text-danger">&gt; 4.0s</span>
              </div>
            </div>
          </div>
          
          <!-- CLS -->
          <div class="bg-bgDark rounded-lg p-5 border border-gray-700">
            <div class="flex items-center justify-between mb-2">
              <div class="text-sm text-gray-400 font-medium">CLS</div>
              <span class="text-xs px-2 py-1 rounded bg-${clsRating.color}/20 text-${clsRating.color} border border-${clsRating.color}/30">${clsRating.label}</span>
            </div>
            <div class="text-3xl font-bold text-white mb-1">${formatNumber(cwv.cls, 3)}</div>
            <div class="text-xs text-gray-500">Cumulative Layout Shift</div>
            <div class="mt-3 text-xs text-gray-400">
              <div class="flex justify-between mb-1">
                <span>Good</span>
                <span class="text-success">≤ 0.1</span>
              </div>
              <div class="flex justify-between">
                <span>Poor</span>
                <span class="text-danger">&gt; 0.25</span>
              </div>
            </div>
          </div>
          
          <!-- TBT -->
          <div class="bg-bgDark rounded-lg p-5 border border-gray-700">
            <div class="flex items-center justify-between mb-2">
              <div class="text-sm text-gray-400 font-medium">TBT</div>
              <span class="text-xs px-2 py-1 rounded bg-${tbtRating.color}/20 text-${tbtRating.color} border border-${tbtRating.color}/30">${tbtRating.label}</span>
            </div>
            <div class="text-3xl font-bold text-white mb-1">${formatMs(cwv.tbt)}</div>
            <div class="text-xs text-gray-500">Total Blocking Time</div>
            <div class="mt-3 text-xs text-gray-400">
              <div class="flex justify-between mb-1">
                <span>Good</span>
                <span class="text-success">≤ 200ms</span>
              </div>
              <div class="flex justify-between">
                <span>Poor</span>
                <span class="text-danger">&gt; 600ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Navigation Timing -->
      <div>
        <h4 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <i class="fas fa-stopwatch text-info"></i>
          Navigation Timing
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- FCP -->
          <div class="bg-bgDark rounded-lg p-4 border border-gray-700">
            <div class="flex items-center justify-between mb-2">
              <div class="text-sm text-gray-400 font-medium">FCP</div>
              <span class="text-xs px-2 py-1 rounded bg-${fcpRating.color}/20 text-${fcpRating.color} border border-${fcpRating.color}/30">${fcpRating.label}</span>
            </div>
            <div class="text-2xl font-bold text-white mb-1">${formatMs(nav.firstContentfulPaint)}</div>
            <div class="text-xs text-gray-500">First Contentful Paint</div>
          </div>
          
          <!-- TTFB -->
          <div class="bg-bgDark rounded-lg p-4 border border-gray-700">
            <div class="flex items-center justify-between mb-2">
              <div class="text-sm text-gray-400 font-medium">TTFB</div>
              <span class="text-xs px-2 py-1 rounded bg-${ttfbRating.color}/20 text-${ttfbRating.color} border border-${ttfbRating.color}/30">${ttfbRating.label}</span>
            </div>
            <div class="text-2xl font-bold text-white mb-1">${formatMs(nav.timeToFirstByte)}</div>
            <div class="text-xs text-gray-500">Time to First Byte</div>
          </div>
        </div>
      </div>
    </div>
  `;
};
