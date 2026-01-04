/**
 * Report Styles
 * CSS theme variables, custom scrollbar, and responsive design
 * Supports light/dark theme switching
 */

module.exports = function getStyles() {
  return `
    <style>
      /* Theme Variables */
      :root {
        --bg-primary: #0f172a;
        --bg-secondary: #1e293b;
        --bg-tertiary: #334155;
        --text-primary: #f1f5f9;
        --text-secondary: #cbd5e1;
        --text-tertiary: #94a3b8;
        --border-color: #475569;
        --scrollbar-track: #1e293b;
        --scrollbar-thumb: #475569;
      }

      /* Light Theme */
      [data-theme="light"] {
        --bg-primary: #ffffff;
        --bg-secondary: #f8fafc;
        --bg-tertiary: #e2e8f0;
        --text-primary: #0f172a;
        --text-secondary: #334155;
        --text-tertiary: #64748b;
        --border-color: #cbd5e1;
        --scrollbar-track: #e2e8f0;
        --scrollbar-thumb: #94a3b8;
      }

      /* Apply theme variables */
      body { background-color: var(--bg-primary) !important; color: var(--text-primary) !important; }
      .bg-bgDark { background-color: var(--bg-primary) !important; }
      .bg-cardDark { background-color: var(--bg-secondary) !important; }
      .text-white { color: var(--text-primary) !important; }
      .text-gray-200 { color: var(--text-primary) !important; }
      .text-gray-300 { color: var(--text-secondary) !important; }
      .text-gray-400 { color: var(--text-tertiary) !important; }
      .text-gray-500 { color: var(--text-tertiary) !important; }
      .border-gray-700 { border-color: var(--border-color) !important; }
      .bg-gray-700 { background-color: var(--bg-tertiary) !important; }
      .hover\:bg-gray-700:hover { background-color: var(--bg-tertiary) !important; }
      .bg-gray-600 { background-color: var(--bg-tertiary) !important; }
      .hover\:bg-gray-600:hover { background-color: var(--border-color) !important; }
      .bg-gray-800 { background-color: var(--bg-tertiary) !important; }
      .hover\:bg-gray-800:hover { background-color: var(--border-color) !important; }
      
      /* Modal overlay background */
      .bg-black\/80 { background-color: var(--bg-primary) !important; opacity: 0.95; }
      #page-modal { background-color: rgba(0, 0, 0, 0.8) !important; }
      [data-theme="light"] #page-modal { background-color: rgba(0, 0, 0, 0.5) !important; }

      /* Custom Scrollbar Design */
      * { scrollbar-width: thin; scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track); }
      *::-webkit-scrollbar { width: 10px; height: 10px; }
      *::-webkit-scrollbar-track { background: var(--scrollbar-track); border-radius: 5px; }
      *::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 5px; border: 2px solid var(--scrollbar-track); }
      *::-webkit-scrollbar-thumb:hover { background: #64748b; }
      *::-webkit-scrollbar-corner { background: var(--scrollbar-track); }
      
      .code-snippet::-webkit-scrollbar { height: 8px; }
      .code-snippet::-webkit-scrollbar-track { background: #2d3748; }
      .code-snippet::-webkit-scrollbar-thumb { background: #4a5568; border-radius: 4px; }
      *:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
      
      /* Circular chart for score */
      .circular-chart { display: block; margin: 0 auto; max-width: 80%; max-height: 250px; }
      .circle-bg { fill: none; stroke: #334155; stroke-width: 3.8; }
      .circle { fill: none; stroke-width: 2.8; stroke-linecap: round; animation: progress 1s ease-out forwards; }
      @keyframes progress { 0% { stroke-dasharray: 0 100; } }
      .percentage { fill: #fff; font-family: sans-serif; font-weight: bold; font-size: 0.5em; text-anchor: middle; }

      /* Rotate chevron on expand */
      .rotate-180 { transform: rotate(180deg); }
      
      /* Print styles */
      @media print {
        body { background-color: white !important; color: black !important; }
        .sidebar, .no-print { display: none !important; }
        main { margin-left: 0 !important; width: 100% !important; }
        .bg-cardDark { background-color: white !important; border: 1px solid #ddd; color: black !important; }
        .text-gray-400 { color: #666 !important; }
        .bg-bgDark { background-color: white !important; }
        code, pre { border: 1px solid #ccc; color: black !important; }
      }
    </style>
  `;
};
