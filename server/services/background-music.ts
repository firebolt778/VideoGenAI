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
            // Log available audio codecs
            const audioCodecs = Object.keys(codecs).filter(key => 
              codecs[key].type === 'audio' && codecs[key].canEncode
            );
            console.log('Available audio codecs:', audioCodecs.slice(0, 10)); // Show first 10
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error('FFmpeg import failed:', error);
      return false;
    }
  }

  async getAvailableAudioCodecs(): Promise<string[]> {
    try {
      const ffmpeg = await import('fluent-ffmpeg');
      return new Promise((resolve) => {
        ffmpeg.default.getAvailableCodecs((err, codecs) => {
          if (err) {
            console.error('Failed to get codecs:', err.message);
            resolve([]);
          } else {
            const audioCodecs = Object.keys(codecs).filter(key => 
              codecs[key].type === 'audio' && codecs[key].canEncode
            );
            resolve(audioCodecs);
          }
        });
      });
    } catch (error) {
      console.error('Failed to get audio codecs:', error);
      return [];
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
          .audioCodec('aac') // Use AAC instead of MP3
          .audioBitrate(128)
          .output(filepath)
          .on('end', () => {
            console.log(`Successfully created placeholder audio file: ${filepath}`);
            resolve();
          })
          .on('error', (err) => {
            console.error(`FFmpeg error creating placeholder audio: ${err.message}`);
            // Try with different codec
            this.createPlaceholderWithWav(filepath, duration)
              .then(() => resolve())
              .catch(fallbackError => {
                console.error(`WAV fallback also failed: ${fallbackError.message}`);
                // Try minimal file creation
                this.createMinimalMP3File(filepath, duration)
                  .then(() => resolve())
                  .catch(minimalError => {
                    console.error(`All methods failed: ${minimalError.message}`);
                    reject(err); // Reject with original FFmpeg error
                  });
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

  private async createPlaceholderWithWav(filepath: string, duration: number): Promise<void> {
    try {
      const ffmpeg = await import('fluent-ffmpeg');
      const wavPath = filepath.replace('.mp3', '.wav');
      
      return new Promise((resolve, reject) => {
        ffmpeg.default()
          .input('anullsrc')
          .inputFormat('lavfi')
          .duration(duration)
          .audioCodec('pcm_s16le') // Use PCM WAV
          .output(wavPath)
          .on('end', async () => {
            console.log(`Created WAV file: ${wavPath}`);
            // Convert WAV to MP3 if possible
            try {
              await this.convertWavToMp3(wavPath, filepath);
              resolve();
            } catch (error) {
              console.error(`Failed to convert WAV to MP3: ${(error as Error).message}`);
              // Use WAV file as is
              await this.copyFile(wavPath, filepath);
              resolve();
            }
          })
          .on('error', (err) => {
            console.error(`WAV creation failed: ${err.message}`);
            reject(err);
          })
          .run();
      });
    } catch (error) {
      throw new Error(`WAV creation failed: ${(error as Error).message}`);
    }
  }

  private async convertWavToMp3(wavPath: string, mp3Path: string): Promise<void> {
    const ffmpeg = await import('fluent-ffmpeg');
    
    return new Promise((resolve, reject) => {
      ffmpeg.default(wavPath)
        .audioCodec('libmp3lame') // Try libmp3lame codec
        .output(mp3Path)
        .on('end', () => {
          console.log(`Converted WAV to MP3: ${mp3Path}`);
          resolve();
        })
        .on('error', (err) => {
          console.error(`WAV to MP3 conversion failed: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }

  private async copyFile(source: string, destination: string): Promise<void> {
    const fs = await import('fs/promises');
    await fs.copyFile(source, destination);
    console.log(`Copied ${source} to ${destination}`);
  }

  private async createMinimalMP3File(filepath: string, duration: number): Promise<void> {
    // Create a minimal valid WAV file with silence
    // This is a very basic fallback if FFmpeg is not available
    console.log(`Creating minimal WAV file as fallback: ${filepath}`);
    
    try {
      // Create a simple WAV file with silence
      const wavPath = filepath.replace('.mp3', '.wav');
      await this.createSimpleWavFile(wavPath, duration);
      
      // Try to copy it to the MP3 path (it will still be a WAV file but with .mp3 extension)
      await this.copyFile(wavPath, filepath);
      console.log(`Created minimal audio file: ${filepath}`);
    } catch (error) {
      console.error(`Failed to create minimal audio file: ${(error as Error).message}`);
      throw error;
    }
  }

  private async createSimpleWavFile(filepath: string, duration: number): Promise<void> {
    // Create a simple WAV file with silence
    const sampleRate = 44100;
    const channels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = channels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    
    // Calculate data size for the duration
    const dataSize = Math.ceil(sampleRate * duration * blockAlign);
    const fileSize = 44 + dataSize; // WAV header (44 bytes) + data
    
    // Create WAV header
    const buffer = Buffer.alloc(fileSize);
    let offset = 0;
    
    // RIFF header
    buffer.write('RIFF', offset); offset += 4;
    buffer.writeUInt32LE(fileSize - 8, offset); offset += 4; // File size - 8
    buffer.write('WAVE', offset); offset += 4;
    
    // fmt chunk
    buffer.write('fmt ', offset); offset += 4;
    buffer.writeUInt32LE(16, offset); offset += 4; // fmt chunk size
    buffer.writeUInt16LE(1, offset); offset += 2; // PCM format
    buffer.writeUInt16LE(channels, offset); offset += 2;
    buffer.writeUInt32LE(sampleRate, offset); offset += 4;
    buffer.writeUInt32LE(byteRate, offset); offset += 4;
    buffer.writeUInt16LE(blockAlign, offset); offset += 2;
    buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;
    
    // data chunk
    buffer.write('data', offset); offset += 4;
    buffer.writeUInt32LE(dataSize, offset); offset += 4;
    
    // Fill the rest with silence (zeros)
    buffer.fill(0, offset);
    
    await fs.writeFile(filepath, buffer);
    console.log(`Created simple WAV file: ${filepath}`);
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
        const command = ffmpeg.default()
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
            
            // Try a simpler mixing approach
            this.simpleMixAudio(audioPath, musicPath, musicVolume, outputPath)
              .then(() => resolve(outputPath))
              .catch(simpleError => {
                console.error(`Simple mixing also failed: ${simpleError.message}`);
                reject(new Error(`Failed to mix audio with music: ${err.message}`));
              });
          })
          .run();
      });
    } catch (error) {
      throw new Error(`Failed to mix audio with music: ${(error as Error).message}`);
    }
  }

  private async simpleMixAudio(audioPath: string, musicPath: string, musicVolume: number, outputPath: string): Promise<void> {
    const ffmpeg = await import('fluent-ffmpeg');
    
    return new Promise((resolve, reject) => {
      ffmpeg.default()
        .input(audioPath)
        .input(musicPath)
        .complexFilter([
          `[1:a]volume=${musicVolume / 100}[music]`,
          `[0:a][music]amix=inputs=2:duration=first`
        ])
        .audioCodec('aac') // Use AAC instead of MP3
        .output(outputPath)
        .on('end', () => {
          console.log(`Successfully mixed audio with simple method: ${outputPath}`);
          resolve();
        })
        .on('error', (err) => {
          console.error(`Simple mixing failed: ${err.message}`);
          reject(err);
        })
        .run();
    });
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