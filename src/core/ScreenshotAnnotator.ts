import { Jimp, loadFont, measureText } from 'jimp';
import { AccessibilityViolation, ViolationNode, ImpactLevel } from './types.js';

// Type pro Jimp instanci
type JimpInstance = Awaited<ReturnType<typeof Jimp.read>>;

/**
 * ScreenshotAnnotator
 * 
 * Zpracovává full-page screenshoty a přidává vizuální anotace pro accessibility violations.
 * Kreslí poloprůhledné červené/oranžové obdélníky kolem problémových prvků
 * a čísluje je pro snadnou referenci v reportu.
 */
export class ScreenshotAnnotator {
  /**
   * Anotuje screenshot s violations
   * 
   * @param screenshotBase64 Base64 encoded screenshot (JPEG)
   * @param violations Všechny violations z reportu
   * @param includeImpacts Které impact levels zahrnout (default: critical + serious)
   * @returns Base64 encoded annotated screenshot
   */
  async annotateScreenshot(
    screenshotBase64: string,
    violations: {
      critical: AccessibilityViolation[];
      serious: AccessibilityViolation[];
      moderate: AccessibilityViolation[];
      minor: AccessibilityViolation[];
    },
    includeImpacts: ImpactLevel[] = ['critical', 'serious']
  ): Promise<string> {
    try {
      // Parse base64 screenshot
      const buffer = Buffer.from(screenshotBase64, 'base64');
      const image = await Jimp.read(buffer);

      // Collect všechny nodes s bounding boxes
      const nodesToAnnotate = this.collectNodesToAnnotate(violations, includeImpacts);

      // Pokud není co anotovat, vracíme originál
      if (nodesToAnnotate.length === 0) {
        return screenshotBase64;
      }

      // Seřadit podle pozice (top to bottom, left to right) pro konzistentní číslování
      nodesToAnnotate.sort((a, b) => {
        if (!a.boundingBox || !b.boundingBox) return 0;
        const yDiff = a.boundingBox.y - b.boundingBox.y;
        if (Math.abs(yDiff) > 50) return yDiff; // Pokud jsou výrazně pod sebou, seřaď podle Y
        return a.boundingBox.x - b.boundingBox.x; // Jinak seřaď podle X
      });

      // Nakreslit anotace
      let annotationNumber = 1;
      for (const node of nodesToAnnotate) {
        if (node.boundingBox) {
          await this.drawAnnotation(
            image,
            node.boundingBox,
            annotationNumber,
            node.impact || 'serious'
          );
          node.annotationNumber = annotationNumber;
          annotationNumber++;
        }
      }

      // Convert back to base64
      const annotatedBuffer = await image.getBuffer('image/jpeg');
      return annotatedBuffer.toString('base64');

    } catch (error) {
      console.error('Failed to annotate screenshot:', error);
      // V případě chyby vrátíme originál
      return screenshotBase64;
    }
  }

  /**
   * Shromáždí všechny nodes které chceme anotovat
   */
  private collectNodesToAnnotate(
    violations: {
      critical: AccessibilityViolation[];
      serious: AccessibilityViolation[];
      moderate: AccessibilityViolation[];
      minor: AccessibilityViolation[];
    },
    includeImpacts: ImpactLevel[]
  ): ViolationNode[] {
    const nodes: ViolationNode[] = [];

    // Helper pro přidání nodes z jedné kategorie
    const addNodes = (viols: AccessibilityViolation[], impact: ImpactLevel) => {
      if (includeImpacts.includes(impact)) {
        viols.forEach(v => {
          v.nodes.forEach(node => {
            if (node.boundingBox) {
              nodes.push({ ...node, impact } as ViolationNode & { impact: ImpactLevel });
            }
          });
        });
      }
    };

    addNodes(violations.critical, 'critical');
    addNodes(violations.serious, 'serious');
    addNodes(violations.moderate, 'moderate');
    addNodes(violations.minor, 'minor');

    return nodes;
  }

  /**
   * Nakreslí jednu anotaci (box + číslo) na screenshot
   */
  private async drawAnnotation(
    image: JimpInstance,
    box: { x: number; y: number; width: number; height: number },
    number: number,
    impact: ImpactLevel
  ): Promise<void> {
    const { x, y, width, height } = box;

    // Barvy podle impact level
    const colors = {
      critical: { r: 220, g: 38, b: 38, alpha: 0.3 },   // Červená
      serious: { r: 249, g: 115, b: 22, alpha: 0.3 },    // Oranžová
      moderate: { r: 245, g: 158, b: 11, alpha: 0.25 },  // Žlutá
      minor: { r: 59, g: 130, b: 246, alpha: 0.2 }       // Modrá
    };

    const color = colors[impact];
    const borderColor = { ...color, alpha: 0.8 }; // Plnější barva pro border

    // Convert RGBA to Jimp hex color
    const bgHex = this.rgbaToInt(color.r, color.g, color.b, Math.floor(color.alpha * 255));
    const borderHex = this.rgbaToInt(borderColor.r, borderColor.g, borderColor.b, Math.floor(borderColor.alpha * 255));

    // Nakreslit poloprůhledný obdélník (fill)
    for (let i = Math.max(0, Math.floor(y)); i < Math.min(image.bitmap.height, Math.floor(y + height)); i++) {
      for (let j = Math.max(0, Math.floor(x)); j < Math.min(image.bitmap.width, Math.floor(x + width)); j++) {
        const originalColor = image.getPixelColor(j, i);
        const blended = this.blendColors(originalColor, bgHex);
        image.setPixelColor(blended, j, i);
      }
    }

    // Nakreslit border (3px silný)
    const borderWidth = 3;
    for (let t = 0; t < borderWidth; t++) {
      // Top border
      for (let j = Math.max(0, Math.floor(x)); j < Math.min(image.bitmap.width, Math.floor(x + width)); j++) {
        const i = Math.max(0, Math.floor(y + t));
        if (i < image.bitmap.height) {
          image.setPixelColor(borderHex, j, i);
        }
      }
      // Bottom border
      for (let j = Math.max(0, Math.floor(x)); j < Math.min(image.bitmap.width, Math.floor(x + width)); j++) {
        const i = Math.min(image.bitmap.height - 1, Math.floor(y + height - t - 1));
        if (i >= 0) {
          image.setPixelColor(borderHex, j, i);
        }
      }
      // Left border
      for (let i = Math.max(0, Math.floor(y)); i < Math.min(image.bitmap.height, Math.floor(y + height)); i++) {
        const j = Math.max(0, Math.floor(x + t));
        if (j < image.bitmap.width) {
          image.setPixelColor(borderHex, j, i);
        }
      }
      // Right border
      for (let i = Math.max(0, Math.floor(y)); i < Math.min(image.bitmap.height, Math.floor(y + height)); i++) {
        const j = Math.min(image.bitmap.width - 1, Math.floor(x + width - t - 1));
        if (j >= 0) {
          image.setPixelColor(borderHex, j, i);
        }
      }
    }

    // Nakreslit číslo v levém horním rohu
    await this.drawNumber(image, number, Math.floor(x), Math.floor(y), impact);
  }

  /**
   * Nakreslí číslo anotace s pozadím
   */
  private async drawNumber(
    image: JimpInstance,
    number: number,
    x: number,
    y: number,
    impact: ImpactLevel
  ): Promise<void> {
    // Barvy pro číslo
    const bgColors = {
      critical: this.rgbaToInt(220, 38, 38, 255),
      serious: this.rgbaToInt(249, 115, 22, 255),
      moderate: this.rgbaToInt(245, 158, 11, 255),
      minor: this.rgbaToInt(59, 130, 246, 255)
    };

    const bgColor = bgColors[impact];
    const textColor = this.rgbaToInt(255, 255, 255, 255); // Bílá

    // Velikost badge
    const badgeSize = 30;
    const fontSize = 16;

    // Pozice badge (posunout o border width dovnitř)
    const badgeX = Math.max(0, x + 5);
    const badgeY = Math.max(0, y + 5);

    // Nakreslit kruhový badge (nebo čtvercový s rounded corners simulací)
    for (let i = badgeY; i < Math.min(image.bitmap.height, badgeY + badgeSize); i++) {
      for (let j = badgeX; j < Math.min(image.bitmap.width, badgeX + badgeSize); j++) {
        // Zkontrolovat jestli jsme uvnitř kruhu
        const centerX = badgeX + badgeSize / 2;
        const centerY = badgeY + badgeSize / 2;
        const distance = Math.sqrt(Math.pow(j - centerX, 2) + Math.pow(i - centerY, 2));
        
        if (distance <= badgeSize / 2) {
          image.setPixelColor(bgColor, j, i);
        }
      }
    }

    // Pro vykreslení čísla použijeme font z Jimp
    // Poznámka: Jimp má omezené fonty, pro production bychom chtěli lepší řešení
    const font = await loadFont('FONT_SANS_16_WHITE');
    
    const numberText = number.toString();
    const textWidth = measureText(font, numberText);
    const textX = badgeX + (badgeSize - textWidth) / 2;
    const textY = badgeY + (badgeSize - fontSize) / 2;

    image.print({
      font,
      x: Math.floor(textX),
      y: Math.floor(textY),
      text: numberText
    });
  }

  /**
   * Blend two colors (alpha compositing)
   */
  private blendColors(bottomColor: number, topColor: number): number {
    const bottom = this.intToRGBA(bottomColor);
    const top = this.intToRGBA(topColor);

    const alpha = top.a / 255;
    const r = Math.floor(top.r * alpha + bottom.r * (1 - alpha));
    const g = Math.floor(top.g * alpha + bottom.g * (1 - alpha));
    const b = Math.floor(top.b * alpha + bottom.b * (1 - alpha));

    return this.rgbaToInt(r, g, b, bottom.a);
  }

  /**
   * Helper metody pro Jimp color conversion
   */
  private rgbaToInt(r: number, g: number, b: number, a: number): number {
    // Ujistíme se, že hodnoty jsou v rozsahu 0-255
    r = Math.max(0, Math.min(255, Math.floor(r)));
    g = Math.max(0, Math.min(255, Math.floor(g)));
    b = Math.max(0, Math.min(255, Math.floor(b)));
    a = Math.max(0, Math.min(255, Math.floor(a)));
    
    // Použití unsigned right shift pro správné hodnoty
    return ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
  }

  private intToRGBA(color: number): { r: number; g: number; b: number; a: number } {
    return {
      r: (color >>> 24) & 0xff,
      g: (color >>> 16) & 0xff,
      b: (color >>> 8) & 0xff,
      a: color & 0xff,
    };
  }
}
