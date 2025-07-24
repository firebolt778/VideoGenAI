export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
}

export interface AudioSegment {
  text: string;
  filename: string;
  duration?: number;
}

export class ElevenLabsService {
  private apiKey: string;
  private baseUrl = "https://api.elevenlabs.io/v1";
  private availableVoices: ElevenLabsVoice[] = [];

  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY_ENV_VAR || "default_key";
  }

  async getAvailableVoices(): Promise<ElevenLabsVoice[]> {
    if (this.availableVoices.length) {
      return this.availableVoices;
    }
    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.statusText}`);
      }

      const data = await response.json();
      const voices = data.voices || [];
      this.availableVoices = voices;
      return voices;
    } catch (error) {
      throw new Error(`Failed to fetch voices: ${(error as Error).message}`);
    }
  }

  async generateAudio(text: string, voiceId: string, filename: string, editSpeed: string = "medium"): Promise<AudioSegment> {
    try {
      let speed = 1;
      switch (editSpeed) {
        case "slow":
          speed = 0.7;
          break;
        case "medium":
          speed = 1; 
          break;
        case "fast":
          speed = 1.2;
          break;
      }
      const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            speed: speed,
            stability: 0.5,
            similarity_boost: 0.5,
            style: 0.0,
            use_speaker_boost: true
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${await response.text()}`);
      }

      const audioBuffer = await response.arrayBuffer();
      
      // Save audio file
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const audioDir = path.join(process.cwd(), 'uploads', 'audio');
      await fs.mkdir(audioDir, { recursive: true });
      
      const filepath = path.join(audioDir, filename);
      // If file exists, delete it before writing new audio
      try {
        await fs.unlink(filepath);
      } catch (err: any) {
        // Ignore error if file does not exist
        if (err.code !== 'ENOENT') {
          throw err;
        }
      }
      await fs.writeFile(filepath, Buffer.from(audioBuffer));

      return {
        text,
        filename,
        duration: this.estimateAudioDuration(text) // Rough estimation
      };
    } catch (error) {
      throw new Error(`Failed to generate audio: ${(error as Error).message}`);
    }
  }

  async generateAudioSegments(
    scriptSegments: string[], 
    voiceId: string, 
    pauseGap: number = 500
  ): Promise<AudioSegment[]> {
    const segments: AudioSegment[] = [];

    for (let i = 0; i < scriptSegments.length; i++) {
      const segment = scriptSegments[i];
      const filename = `segment_${i + 1}_${Date.now()}.mp3`;
      
      try {
        const audioSegment = await this.generateAudio(segment, voiceId, filename);
        segments.push(audioSegment);
        
        // Add pause between segments (except for the last one)
        if (i < scriptSegments.length - 1) {
          await this.sleep(pauseGap);
        }
      } catch (error) {
        console.error(`Failed to generate audio for segment ${i + 1}:`, error);
        // Continue with other segments even if one fails
      }
    }

    return segments;
  }

  private estimateAudioDuration(text: string): number {
    // Rough estimation: ~150 words per minute, ~5 characters per word
    const wordsPerMinute = 150;
    const charactersPerWord = 5;
    const words = text.length / charactersPerWord;
    const minutes = words / wordsPerMinute;
    return Math.round(minutes * 60 * 1000); // Return milliseconds
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async combineAudioSegments(segments: AudioSegment[], outputFilename: string): Promise<string> {
    // This would typically use FFmpeg or similar tool to combine audio files
    // For now, we'll return the first segment as a placeholder
    console.log(`Combining ${segments.length} audio segments into ${outputFilename}`);
    
    // TODO: Implement actual audio combining logic using FFmpeg
    // This is a placeholder implementation
    if (segments.length > 0) {
      return segments[0].filename;
    }
    
    throw new Error("No audio segments to combine");
  }
}

export const elevenLabsService = new ElevenLabsService();
