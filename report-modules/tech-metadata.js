/**
 * SPA & Shadow DOM Metadata Component
 * Technical information about detected frameworks and web components
 */

const { escapeHtml } = require('./utils');

module.exports = function generateTechMetadata(data) {
  const spa = data.spaMetadata;
  const shadow = data.shadowDOMMetadata;
  
  // Skip if no metadata
  if (!spa && !shadow) {
    return '';
  }

  return `
    <section class="space-y-4 mt-6">
      <h3 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <i class="fas fa-cogs text-brand"></i>
        Technical Details
      </h3>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${spa ? generateSPAMetadata(spa) : ''}
        ${shadow && shadow.hasShadowDOM ? generateShadowDOMMetadata(shadow) : ''}
      </div>
    </section>
  `;
};

function generateSPAMetadata(spa) {
  const frameworkIcons = {
    react: { icon: 'fab fa-react', color: 'text-blue-400', name: 'React' },
    vue: { icon: 'fab fa-vuejs', color: 'text-green-400', name: 'Vue.js' },
    angular: { icon: 'fab fa-angular', color: 'text-red-400', name: 'Angular' },
    unknown: { icon: 'fas fa-rocket', color: 'text-purple-400', name: 'SPA Framework' }
  };

  const framework = frameworkIcons[spa.detectedFramework || 'unknown'];
  const isPerformant = spa.hydrationTime && spa.hydrationTime < 1000;

  return `
    <div class="bg-cardDark rounded-xl p-6 border border-gray-700">
      <div class="flex items-start gap-4">
        <div class="${framework.color} text-4xl">
          <i class="${framework.icon}"></i>
        </div>
        <div class="flex-1">
          <h4 class="text-white font-bold text-lg mb-2">${framework.name}</h4>
          
          <div class="space-y-2">
            ${spa.hasClientSideRouting ? `
              <div class="flex items-center gap-2">
                <span class="bg-success/20 text-success px-2 py-1 rounded text-xs font-semibold">
                  <i class="fas fa-route mr-1"></i>Client-side Routing
                </span>
              </div>
            ` : `
              <div class="flex items-center gap-2">
                <span class="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs font-semibold">
                  <i class="fas fa-server mr-1"></i>Server Routing
                </span>
              </div>
            `}
            
            ${spa.hydrationTime != null ? `
              <div class="text-sm text-gray-300">
                <i class="fas fa-bolt mr-2 ${isPerformant ? 'text-success' : 'text-warning'}"></i>
                <span class="font-medium">Hydration:</span> ${spa.hydrationTime}ms
                ${!isPerformant ? '<span class="text-warning ml-2">(Consider optimization)</span>' : ''}
              </div>
            ` : ''}
            
            ${spa.stabilityTime != null ? `
              <div class="text-sm text-gray-300">
                <i class="fas fa-clock mr-2 text-blue-400"></i>
                <span class="font-medium">Page Stability:</span> ${spa.stabilityTime}ms
              </div>
            ` : ''}
          </div>

          <div class="mt-3 pt-3 border-t border-gray-700">
            <p class="text-xs text-gray-400">
              <i class="fas fa-info-circle mr-1"></i>
              Scanner detected SPA framework and waited for hydration before testing
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function generateShadowDOMMetadata(shadow) {
  const hasWarnings = shadow.closedShadowRoots > 0;
  const componentsList = shadow.webComponents && shadow.webComponents.length > 0
    ? shadow.webComponents.slice(0, 5).map(c => `<code class="text-xs">&lt;${escapeHtml(c)}&gt;</code>`).join(' ')
    : 'None detected';
  
  const moreComponents = shadow.webComponents && shadow.webComponents.length > 5
    ? ` <span class="text-gray-400">+${shadow.webComponents.length - 5} more</span>`
    : '';

  return `
    <div class="bg-cardDark rounded-xl p-6 border border-gray-700">
      <div class="flex items-start gap-4">
        <div class="text-purple-400 text-4xl">
          <i class="fas fa-cubes"></i>
        </div>
        <div class="flex-1">
          <h4 class="text-white font-bold text-lg mb-2">Shadow DOM</h4>
          
          <div class="space-y-2">
            <div class="text-sm text-gray-300">
              <i class="fas fa-layer-group mr-2 text-purple-400"></i>
              <span class="font-medium">${shadow.shadowHostCount}</span> shadow root${shadow.shadowHostCount !== 1 ? 's' : ''} detected
            </div>
            
            ${shadow.webComponents && shadow.webComponents.length > 0 ? `
              <div class="text-sm text-gray-300">
                <i class="fas fa-puzzle-piece mr-2 text-blue-400"></i>
                <span class="font-medium">${shadow.webComponents.length}</span> web component${shadow.webComponents.length !== 1 ? 's' : ''}
              </div>
            ` : ''}
            
            ${hasWarnings ? `
              <div class="flex items-start gap-2 bg-warning/10 border border-warning/30 rounded p-2">
                <i class="fas fa-exclamation-triangle text-warning mt-0.5"></i>
                <div class="text-xs text-gray-300">
                  <strong>${shadow.closedShadowRoots} closed shadow root${shadow.closedShadowRoots !== 1 ? 's' : ''}</strong>
                  <br>Cannot be scanned for accessibility issues
                </div>
              </div>
            ` : ''}
          </div>

          ${shadow.webComponents && shadow.webComponents.length > 0 ? `
            <div class="mt-3 pt-3 border-t border-gray-700">
              <p class="text-xs text-gray-400 mb-2">
                <i class="fas fa-code mr-1"></i>Components found:
              </p>
              <div class="flex flex-wrap gap-2">
                ${componentsList}${moreComponents}
              </div>
            </div>
          ` : ''}

          <div class="mt-3 pt-3 border-t border-gray-700">
            <p class="text-xs text-gray-400">
              <i class="fas fa-info-circle mr-1"></i>
              Scanner traversed shadow boundaries to test encapsulated content
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}
