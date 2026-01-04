/**
 * Interactive Scripts
 * Theme toggle, tab switching, page sorting, and modal management
 */

module.exports = function getScripts() {
  return `
    <script>
      // Theme management
      function initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);
      }

      function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
      }

      function updateThemeIcon(theme) {
        const icon = document.getElementById('theme-icon');
        if (icon) {
          if (theme === 'dark') {
            icon.className = 'fas fa-sun text-yellow-400';
          } else {
            icon.className = 'fas fa-moon text-blue-600';
          }
        }
      }

      // Initialize theme on load
      initTheme();

      // Tab switching
      function switchTab(tabId) {
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
          btn.classList.remove('bg-brand/10', 'text-brand', 'border-brand/20');
          btn.classList.add('text-gray-400');
        });
        event.currentTarget.classList.remove('text-gray-400');
        event.currentTarget.classList.add('bg-brand/10', 'text-brand', 'border', 'border-brand/20');

        // Hide all sections
        ['summary', 'performance', 'structure'].forEach(id => {
          const el = document.getElementById('tab-' + id);
          if (el) el.classList.add('hidden');
        });
        
        // Show selected
        const target = document.getElementById('tab-' + tabId);
        if (target) target.classList.remove('hidden');
      }

      // Toggle page detail for crawl mode
      function togglePageDetail(pageIndex) {
        const detail = document.getElementById(\`page-detail-\${pageIndex}\`);
        const chevron = document.getElementById(\`chevron-\${pageIndex}\`);
        
        if (detail) {
          detail.classList.toggle('hidden');
        }
        if (chevron) {
          chevron.classList.toggle('rotate-180');
        }
      }

      // Toggle issue/page details in heading structure
      function toggleIssueDetails(id) {
        const el = document.getElementById(id);
        const icon = document.getElementById('icon-' + id);
        if (el) el.classList.toggle('hidden');
        if (icon) icon.classList.toggle('rotate-180');
      }
      
      function togglePageDetails(id) {
        const el = document.getElementById(id);
        const icon = document.getElementById('icon-' + id);
        if (el) el.classList.toggle('hidden');
        if (icon) icon.classList.toggle('rotate-180');
      }

      // Copy to clipboard
      function copyToClipboard(elementId) {
        const el = document.getElementById(elementId);
        if (!el) return;
        
        el.select();
        document.execCommand('copy');
        
        // Show feedback
        const btn = event.currentTarget;
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check mr-1"></i> Copied!';
        btn.classList.add('bg-green-600');
        
        setTimeout(() => {
          btn.innerHTML = originalText;
          btn.classList.remove('bg-green-600');
        }, 2000);
      }

      // Initialize - show first tab on load
      document.addEventListener('DOMContentLoaded', () => {
        console.log('A11y Flow Report loaded');
      });
    </script>
  `;
};
