import * as crypto from 'crypto';

/**
 * BadgeService
 * 
 * Generuje SVG badges pro embedding na websites.
 * Badges zobrazují aktuální accessibility score a linkují zpět na report.
 */
export class BadgeService {
  /**
   * Generate SVG badge for accessibility score
   * 
   * @param score Accessibility score (0-100)
   * @param domain Domain name (for display)
   * @param style Badge style variant
   * @returns SVG string
   */
  generateSVG(score: number, domain?: string, style: BadgeStyle = 'default'): string {
    const color = this.getColorFromScore(score);
    const emoji = this.getEmojiFromScore(score);
    const label = this.getLabelFromScore(score);

    switch (style) {
      case 'flat':
        return this.generateFlatBadge(score, label, color, emoji);
      case 'compact':
        return this.generateCompactBadge(score, color);
      case 'shield':
        return this.generateShieldBadge(score, label, color);
      default:
        return this.generateDefaultBadge(score, label, color, emoji);
    }
  }

  /**
   * Generate domain hash for badge lookup
   * Uses SHA-256 and takes first 16 characters for URL-friendly hash
   */
  generateDomainHash(domain: string): string {
    const normalized = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  }

  /**
   * Get color based on score
   */
  private getColorFromScore(score: number): string {
    if (score >= 90) return '#10b981'; // Green
    if (score >= 70) return '#f59e0b'; // Orange
    if (score >= 50) return '#eab308'; // Yellow
    return '#ef4444'; // Red
  }

  /**
   * Get emoji based on score
   */
  private getEmojiFromScore(score: number): string {
    if (score >= 90) return '✓';
    if (score >= 70) return '⚠';
    return '✗';
  }

  /**
   * Get label based on score
   */
  private getLabelFromScore(score: number): string {
    if (score >= 95) return 'Excellent';
    if (score >= 85) return 'Good';
    if (score >= 70) return 'Fair';
    if (score >= 50) return 'Poor';
    return 'Critical';
  }

  /**
   * Default badge style (modern, with emoji)
   */
  private generateDefaultBadge(score: number, label: string, color: string, emoji: string): string {
    const width = 200;
    const height = 24;

    return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" role="img" aria-label="Accessibility: ${score}/100 ${label}">
  <title>Accessibility Score: ${score}/100 (${label})</title>
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#555;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#333;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="score" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${this.darkenColor(color)};stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="100" height="${height}" fill="url(#bg)" rx="3"/>
  <rect x="100" width="100" height="${height}" fill="url(#score)" rx="3"/>
  
  <!-- Text -->
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="50" y="16" fill="#fff">Accessibility</text>
    <text x="150" y="16" fill="#fff" font-weight="bold">${emoji} ${score}/100</text>
  </g>
</svg>
    `.trim();
  }

  /**
   * Flat badge style (simple, clean)
   */
  private generateFlatBadge(score: number, label: string, color: string, emoji: string): string {
    const width = 180;
    const height = 20;

    return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" role="img" aria-label="Accessibility: ${score}/100">
  <title>Accessibility: ${score}/100</title>
  <rect width="90" height="${height}" fill="#555"/>
  <rect x="90" width="90" height="${height}" fill="${color}"/>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,sans-serif" font-size="10">
    <text x="45" y="14">accessibility</text>
    <text x="135" y="14" font-weight="bold">${score}</text>
  </g>
</svg>
    `.trim();
  }

  /**
   * Compact badge style (smaller, score only)
   */
  private generateCompactBadge(score: number, color: string): string {
    const size = 44;

    return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" role="img" aria-label="Score: ${score}">
  <title>Accessibility Score: ${score}/100</title>
  <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="${color}" stroke="#fff" stroke-width="2"/>
  <text x="${size/2}" y="${size/2 + 4}" fill="#fff" font-family="Verdana,sans-serif" font-size="14" font-weight="bold" text-anchor="middle">${score}</text>
</svg>
    `.trim();
  }

  /**
   * Shield badge style (GitHub-style)
   */
  private generateShieldBadge(score: number, label: string, color: string): string {
    const leftWidth = 90;
    const rightWidth = 60;
    const totalWidth = leftWidth + rightWidth;
    const height = 20;

    return `
<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" role="img" aria-label="accessibility: ${score}">
  <title>accessibility: ${score}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="${height}" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${leftWidth}" height="${height}" fill="#555"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="${height}" fill="${color}"/>
    <rect width="${totalWidth}" height="${height}" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,sans-serif" font-size="11">
    <text x="${leftWidth/2}" y="15" fill="#010101" fill-opacity=".3">accessibility</text>
    <text x="${leftWidth/2}" y="14">accessibility</text>
    <text x="${leftWidth + rightWidth/2}" y="15" fill="#010101" fill-opacity=".3">${score}</text>
    <text x="${leftWidth + rightWidth/2}" y="14">${score}</text>
  </g>
</svg>
    `.trim();
  }

  /**
   * Darken color for gradient effect
   */
  private darkenColor(hex: string): string {
    const rgb = parseInt(hex.slice(1), 16);
    const r = Math.max(0, ((rgb >> 16) & 0xff) - 30);
    const g = Math.max(0, ((rgb >> 8) & 0xff) - 30);
    const b = Math.max(0, (rgb & 0xff) - 30);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }

  /**
   * Generate embed code for website
   */
  generateEmbedCode(domainHash: string, reportUrl?: string, style: BadgeStyle = 'default'): string {
    const badgeUrl = `https://api.a11yflow.com/badge/${domainHash}.svg`;
    const linkUrl = reportUrl || `https://a11yflow.com/report/${domainHash}`;

    return `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer">
  <img src="${badgeUrl}" alt="Accessibility Score" />
</a>`;
  }

  /**
   * Generate Markdown embed code
   */
  generateMarkdownEmbed(domainHash: string, reportUrl?: string): string {
    const badgeUrl = `https://api.a11yflow.com/badge/${domainHash}.svg`;
    const linkUrl = reportUrl || `https://a11yflow.com/report/${domainHash}`;

    return `[![Accessibility Score](${badgeUrl})](${linkUrl})`;
  }
}

/**
 * Badge style variants
 */
export type BadgeStyle = 'default' | 'flat' | 'compact' | 'shield';
