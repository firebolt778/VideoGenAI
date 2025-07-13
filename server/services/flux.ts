import { openai } from "./openai";

export interface FluxImageOptions {
  prompt: string;
  width?: number;
  height?: number;
  num_outputs?: number;
  num_inference_steps?: number;
  guidance_scale?: number;
  scheduler?: string;
  seed?: number;
  image?: string;
}

export interface GeneratedImage {
  url: string;
  filename: string;
  prompt: string;
}

export class FluxService {
  private apiToken: string;
  private baseUrl = "https://api.replicate.com/v1";

  constructor() {
    this.apiToken = process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_TOKEN_ENV_VAR || "default_key";
  }

  async generateImage(options: FluxImageOptions): Promise<GeneratedImage> {
    try {
      const response = await fetch(`${this.baseUrl}/predictions`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: "black-forest-labs/flux-schnell",
          input: {
            prompt: options.prompt,
            width: options.width || 1024,
            height: options.height || 768,
            num_outputs: options.num_outputs || 1,
            num_inference_steps: options.num_inference_steps || 4,
            guidance_scale: options.guidance_scale || 0,
            scheduler: options.scheduler || "K_EULER",
            seed: options.seed
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Flux API error: ${response.statusText}`);
      }

      const prediction = await response.json();
      
      // Poll for completion
      const result = await this.pollPrediction(prediction.id);
      
      if (result.status === 'succeeded' && result.output && result.output.length > 0) {
        const imageUrl = result.output[0];
        const filename = await this.downloadAndSaveImage(imageUrl, options.prompt);
        
        return {
          url: imageUrl,
          filename,
          prompt: options.prompt
        };
      } else {
        throw new Error(`Image generation failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      throw new Error(`Failed to generate image with Flux: ${(error as Error).message}`);
    }
  }

  async generateMultipleImages(prompts: string[]): Promise<GeneratedImage[]> {
    const results: GeneratedImage[] = [];
    
    for (const prompt of prompts) {
      try {
        const image = await this.generateImage({ prompt });
        results.push(image);
        
        // Small delay to avoid rate limiting
        await this.sleep(1000);
      } catch (error) {
        console.error(`Failed to generate image for prompt: ${prompt}`, error);
        // Continue with other images even if one fails
      }
    }
    
    return results;
  }

  private async pollPrediction(predictionId: string, maxAttempts: number = 30): Promise<any> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/predictions/${predictionId}`, {
          headers: {
            'Authorization': `Token ${this.apiToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch prediction: ${response.statusText}`);
        }

        const prediction = await response.json();
        
        if (prediction.status === 'succeeded' || prediction.status === 'failed') {
          return prediction;
        }
        
        // Wait before next attempt
        await this.sleep(2000);
      } catch (error) {
        console.error(`Polling attempt ${attempt + 1} failed:`, error);
      }
    }
    
    throw new Error('Prediction polling timed out');
  }

  private async downloadAndSaveImage(imageUrl: string, prompt: string): Promise<string> {
    try {
      const response = await fetch(imageUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const imageDir = path.join(process.cwd(), 'uploads', 'images');
      await fs.mkdir(imageDir, { recursive: true });
      
      const filename = `flux_${Date.now()}_${Math.random().toString(36).substring(2, 15)}.jpg`;
      const filepath = path.join(imageDir, filename);
      
      await fs.writeFile(filepath, Buffer.from(buffer));
      
      return filename;
    } catch (error) {
      throw new Error(`Failed to save image: ${(error as Error).message}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Fallback to DALL-E 3 if Flux fails
  async generateImageWithFallback(prompt: string, image?: string): Promise<GeneratedImage> {
    try {
      return await this.generateImage({ prompt, image });
    } catch (fluxError) {
      console.log('Flux generation failed, falling back to DALL-E 3:', (fluxError as Error).message);

      try {
        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt: prompt,
          n: 1,
          size: "1024x1024",
          quality: "standard",
        });

        const imageUrl = response.data?.[0].url;
        if (!imageUrl) {
          throw new Error('No image URL returned from DALL-E');
        }

        const filename = await this.downloadAndSaveImage(imageUrl, prompt);
        
        return {
          url: imageUrl,
          filename,
          prompt
        };
      } catch (dalleError) {
        throw new Error(`Both Flux and DALL-E generation failed: ${(fluxError as Error).message}, ${(dalleError as Error).message}`);
      }
    }
  }
}

export const fluxService = new FluxService();
