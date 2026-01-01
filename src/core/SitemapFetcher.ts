import https from 'https';
import { URL } from 'url';

export class SitemapFetcher {
  
  /**
   * Pokusí se najít a parsovat sitemapu pro danou URL.
   * Vrací seznam až 20 relevantních URL.
   */
  public static async fetchSitemapUrls(rootUrl: string): Promise<string[]> {
    try {
      // 1. Zkusíme standardní umístění
      const sitemapUrl = new URL('/sitemap.xml', rootUrl).toString();
      console.log(`🗺️ Checking sitemap at: ${sitemapUrl}`);

      const xml = await this.fetchContent(sitemapUrl);
      if (!xml) return [];

      // 2. Jednoduchý regex parsing (Spoon Theory: nechceme instalovat XML parser)
      // Hledáme tagy <loc>...</loc>
      const locRegex = /<loc>(.*?)<\/loc>/g;
      const urls: string[] = [];
      let match;

      while ((match = locRegex.exec(xml)) !== null) {
        const foundUrl = match[1].trim();
        // Bereme jen URL ze stejné domény
        if (foundUrl.includes(new URL(rootUrl).hostname)) {
          urls.push(foundUrl);
        }
      }

      console.log(`🗺️ Found ${urls.length} URLs in sitemap.`);
      
      // 3. Prioritizace důležitých stránek
      return this.prioritizeUrls(urls);

    } catch (e) {
      console.warn('⚠️ Sitemap fetch failed:', e);
      return [];
    }
  }

  private static fetchContent(url: string): Promise<string | null> {
    return new Promise((resolve) => {
      https.get(url, (res) => {
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', () => resolve(null));
    });
  }

  // Seřadí URL tak, aby nahoře byly ty "zajímavé" pro byznys
  private static prioritizeUrls(urls: string[]): string[] {
    const keywords = ['contact', 'kontakt', 'about', 'o-nas', 'pricing', 'cenik', 'sluzby', 'products'];
    
    return urls.sort((a, b) => {
      const scoreA = keywords.some(k => a.includes(k)) ? 1 : 0;
      const scoreB = keywords.some(k => b.includes(k)) ? 1 : 0;
      return scoreB - scoreA; // Ty s klíčovými slovy jdou dopředu
    });
  }
}