/**
 * Report Utilities
 * Helper functions for formatting, escaping, and rating calculations
 */

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMs(ms) {
  if (ms == null || isNaN(ms)) return '-';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatNumber(num, decimals = 2) {
  if (num == null || isNaN(num)) return '-';
  return Number(num).toFixed(decimals);
}

function getPerformanceRating(value, metric) {
  if (value == null) return { label: 'N/A', color: 'gray-500' };
  
  const thresholds = {
    lcp: { good: 2500, poor: 4000 },
    fcp: { good: 1800, poor: 3000 },
    cls: { good: 0.1, poor: 0.25 },
    tbt: { good: 200, poor: 600 },
    ttfb: { good: 800, poor: 1800 }
  };
  
  const t = thresholds[metric];
  if (!t) return { label: 'Unknown', color: 'gray-500' };
  
  if (value <= t.good) return { label: 'Good', color: 'green-500' };
  if (value > t.poor) return { label: 'Poor', color: 'red-500' };
  return { label: 'Needs Improvement', color: 'yellow-500' };
}

module.exports = {
  escapeHtml,
  formatMs,
  formatNumber,
  getPerformanceRating
};
