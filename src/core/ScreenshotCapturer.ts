import { Page, ElementHandle } from 'puppeteer-core';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ViolationNode } from './types';
import crypto from 'crypto';

export class ScreenshotCapturer {
  private s3Client: S3Client | null = null;
  private bucketName: string | undefined;

  constructor() {
    this.bucketName = process.env.A11Y_SCREENSHOT_BUCKET;
    
    // Inicializujeme S3 klienta jen pokud máme Bucket Name
    // To umožňuje "Spoon Theory" přístup - funguje to i bez konfigurace (jen neukládá)
    if (this.bucketName) {
      this.s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
    }
  }

  /**
   * Pokusí se vytvořit screenshot pro daný node a vrátit veřejnou URL.
   */
  public async captureAndUpload(page: Page, node: ViolationNode): Promise<string | undefined> {
    if (!this.s3Client || !this.bucketName) {
      return undefined; // Feature disabled
    }

    try {
      // 1. Najít element (podpora pro pole selektorů kvůli Shadow DOM)
      const element = await this.findElement(page, node.target);
      
      if (!element) return undefined;

      // 2. Screenshot do bufferu
      // Encoding 'binary' vrací Buffer, což potřebuje S3
      const imageBuffer = await element.screenshot({ type: 'jpeg', quality: 60 });

      // 3. Generování unikátního klíče
      const fileKey = `violations/${crypto.randomUUID()}.jpg`;

      // 4. Upload na S3
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        Body: imageBuffer,
        ContentType: 'image/jpeg',
        // ACL: 'public-read' // Pozor: Mnoho S3 bucketů dnes blokuje ACL. 
        // Lepší je mít bucket policy nebo CloudFront. Pro demo nechme bez ACL.
      });

      await this.s3Client.send(command);

      // Vrátíme URL (předpokládáme standardní S3 URL pattern)
      return `https://${this.bucketName}.s3.amazonaws.com/${fileKey}`;

    } catch (error) {
      console.warn('Screenshot capture failed (non-fatal):', error);
      return undefined;
    }
  }

  /**
   * Helper pro nalezení elementu. Axe vrací pole selektorů, pokud je element v Shadow DOM.
   * Např: ['#app', 'custom-input', '.error-icon']
   */
  private async findElement(page: Page, selectors: string[]): Promise<ElementHandle | null> {
    if (selectors.length === 0) return null;

    // Začneme od rootu stránky
    let currentHandle: ElementHandle | null = await page.$(selectors[0]);

    // Procházíme zbytek řetězce selektorů (Shadow DOM traversal)
    for (let i = 1; i < selectors.length; i++) {
      if (!currentHandle) return null;
      
      // Získáme shadowRoot aktuálního elementu
      const shadowRoot = await currentHandle.evaluateHandle((el: any) => el.shadowRoot);
      if (!shadowRoot) return null;

      // Najdeme další element v hierarchii
      // as ElementHandle je nutné přetypování v Puppeteeru
      currentHandle = await shadowRoot.$(selectors[i]) as ElementHandle;
    }

    return currentHandle;
  }
}