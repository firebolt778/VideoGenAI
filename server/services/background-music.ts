import { openaiService } from "./openai";
import { storage } from "../storage";
import fs from "fs/promises";
import path from "path";

export interface MusicGenerationRequest {
  prompt: string;
  duration: number; // in seconds
  style: string;
  mood: string;
  volume: number; // 0-100
}

export interface GeneratedMusic {
  filename: string;
  duration: number;
  style: string;
  mood: string;
  volume: number;
}

export class BackgroundMusicService {
  private musicCache: Map<string, GeneratedMusic> = new Map();

  async generateMusic(request: MusicGenerationRequest): Promise<GeneratedMusic> {
    try {
      // Check cache first
      const cacheKey = `${request.prompt}_${request.duration}_${request.style}_${request.mood}`;
      if (this.musicCache.has(cacheKey)) {
        return this.musicCache.get(cacheKey)!;
      }

      // Generate music prompt
      const musicPrompt = this.buildMusicPrompt(request);
      
      // For now, we'll use a placeholder implementation
      // In production, this would integrate with music generation APIs like:
      // - Mubert API
      // - AIVA
      // - Amper Music
      // - OpenAI's Audio API (if available)
      
      const music = await this.generatePlaceholderMusic(request);
      
      // Cache the result
      this.musicCache.set(cacheKey, music);
      
      return music;
    } catch (error) {
      console.error('Background music generation error:', error);
      throw new Error(`Failed to generate background music: ${(error as Error).message}`);
    }
  }

  async validateFFmpeg(): Promise<boolean> {
    try {
      const ffmpeg = await import('fluent-ffmpeg');
      return new Promise((resolve) => {
        ffmpeg.default.getAvailableCodecs((err, codecs) => {
          if (err) {
            console.error('FFmpeg validation failed:', err.message);
            resolve(false);
          } else {
            console.log('FFmpeg is available and working');
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error('FFmpeg import failed:', error);
      return false;
    }
  }

  private async ensureDirectories(): Promise<void> {
    const directories = [
      path.join(process.cwd(), 'uploads'),
      path.join(process.cwd(), 'uploads', 'music'),
      path.join(process.cwd(), 'uploads', 'audio')
    ];
    
    for (const dir of directories) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.error(`Failed to create directory ${dir}:`, error);
      }
    }
  }

  private buildMusicPrompt(request: MusicGenerationRequest): string {
    return `Generate background music with the following characteristics:
- Style: ${request.style}
- Mood: ${request.mood}
- Duration: ${request.duration} seconds
- Context: ${request.prompt}
- Volume: ${request.volume}%

The music should be:
- Non-intrusive and suitable for voice-over
- Looping-friendly for seamless playback
- Emotionally appropriate for the content
- Professional quality suitable for video content`;
  }

  private async generatePlaceholderMusic(request: MusicGenerationRequest): Promise<GeneratedMusic> {
    // Create a placeholder music file
    const filename = `background_music_${Date.now()}.mp3`;
    const musicDir = path.join(process.cwd(), 'uploads', 'music');
    
    // Ensure music directory exists
    await this.ensureDirectories();
    
    const filepath = path.join(musicDir, filename);
    
    // For now, we'll create a placeholder file
    // In production, this would be replaced with actual music generation
    await this.createPlaceholderAudioFile(filepath, request.duration);
    
    return {
      filename,
      duration: request.duration,
      style: request.style,
      mood: request.mood,
      volume: request.volume
    };
  }

  private async createPlaceholderAudioFile(filepath: string, duration: number): Promise<void> {
    // This is a placeholder implementation
    // In production, you would integrate with a music generation service
    console.log(`Creating placeholder music file: ${filepath} (${duration}s)`);
    
    try {
      const ffmpeg = await import('fluent-ffmpeg');
      
      return new Promise((resolve, reject) => {
        ffmpeg.default()
          .input('anullsrc') // Generate silence
          .inputFormat('lavfi')
          .duration(duration)
          .audioCodec('mp3')
          .audioBitrate(128)
          .output(filepath)
          .on('end', () => {
            console.log(`Successfully created placeholder audio file: ${filepath}`);
            resolve();
          })
          .on('error', (err) => {
            console.error(`FFmpeg error creating placeholder audio: ${err.message}`);
            // Try fallback method instead of rejecting
            this.createMinimalMP3File(filepath, duration)
              .then(() => resolve())
              .catch(fallbackError => {
                console.error(`Fallback method also failed: ${fallbackError.message}`);
                reject(err); // Reject with original FFmpeg error
              });
          })
          .run();
      });
    } catch (error) {
      console.error(`Failed to import FFmpeg or create placeholder audio file: ${(error as Error).message}`);
      // Fallback: create a minimal valid MP3 file
      await this.createMinimalMP3File(filepath, duration);
    }
  }

  private async createMinimalMP3File(filepath: string, duration: number): Promise<void> {
    // Create a minimal valid MP3 file with silence
    // This is a very basic fallback if FFmpeg is not available
    console.log(`Creating minimal MP3 file as fallback: ${filepath}`);
    
    // MP3 header for a silent file (very basic implementation)
    const sampleRate = 44100;
    const channels = 1;
    const bitRate = 128000;
    
    // Calculate frame size for the duration
    const frameSize = Math.ceil((bitRate * duration) / 8);
    
    // Create a minimal MP3 file with silence
    const buffer = Buffer.alloc(frameSize);
    buffer.fill(0); // Fill with zeros (silence)
    
    await fs.writeFile(filepath, buffer);
    console.log(`Created minimal MP3 file: ${filepath}`);
  }

  async adjustVolume(musicPath: string, volume: number): Promise<string> {
    try {
      const ffmpeg = await import('fluent-ffmpeg');
      const fs = await import('fs/promises');
      
      // Check if input file exists
      try {
        await fs.access(musicPath);
      } catch (error) {
        throw new Error(`Input file not found: ${musicPath}`);
      }
      
      const outputPath = musicPath.replace('.mp3', `_vol_${volume}.mp3`);
      
      return new Promise((resolve, reject) => {
        ffmpeg.default(musicPath)
          .audioFilters(`volume=${volume / 100}`)
          .output(outputPath)
          .on('end', () => {
            console.log(`Successfully adjusted volume: ${outputPath}`);
            resolve(outputPath);
          })
          .on('error', (err) => {
            console.error(`FFmpeg error adjusting volume: ${err.message}`);
            reject(new Error(`Failed to adjust music volume: ${err.message}`));
          })
          .run();
      });
    } catch (error) {
      throw new Error(`Failed to adjust music volume: ${(error as Error).message}`);
    }
  }

  async mixAudioWithMusic(audioPath: string, musicPath: string, musicVolume: number): Promise<string> {
    try {
      const ffmpeg = await import('fluent-ffmpeg');
      const fs = await import('fs/promises');
      
      // Check if input files exist
      try {
        await fs.access(audioPath);
        await fs.access(musicPath);
      } catch (error) {
        throw new Error(`Input file not found: ${(error as Error).message}`);
      }
      
      const outputPath = audioPath.replace('.mp3', '_with_music.mp3');
      
      return new Promise((resolve, reject) => {
        ffmpeg.default()
          .input(audioPath)
          .input(musicPath)
          .complexFilter([
            `[1:a]volume=${musicVolume / 100}[music]`,
            `[0:a][music]amix=inputs=2:duration=longest`
          ])
          .output(outputPath)
          .on('end', () => {
            console.log(`Successfully mixed audio with music: ${outputPath}`);
            resolve(outputPath);
          })
          .on('error', (err) => {
            console.error(`FFmpeg error mixing audio: ${err.message}`);
            reject(new Error(`Failed to mix audio with music: ${err.message}`));
          })
          .run();
      });
    } catch (error) {
      throw new Error(`Failed to mix audio with music: ${(error as Error).message}`);
    }
  }

  async getMusicStyles(): Promise<string[]> {
    return [
      'Ambient',
      'Cinematic',
      'Corporate',
      'Electronic',
      'Folk',
      'Jazz',
      'Pop',
      'Rock',
      'Classical',
      'World',
      'Hip Hop',
      'Country'
    ];
  }

  async getMusicMoods(): Promise<string[]> {
    return [
      'Energetic',
      'Calm',
      'Dramatic',
      'Happy',
      'Melancholic',
      'Mysterious',
      'Romantic',
      'Tense',
      'Uplifting',
      'Somber',
      'Playful',
      'Serious'
    ];
  }
}

export const backgroundMusicService = new BackgroundMusicService(); 