export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
}

export interface AudioSegment {
  text: string;
  filename: string;
  duration?: number;
  timestamps?: WordTimestamp[];
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
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

      // Use the new endpoint with timestamps
      const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}/with-timestamps`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
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

      const responseData = await response.json();

      // Extract audio data and timestamps from the response
      const audioBase64 = responseData.audio_base64;
      const alignment = responseData.alignment || {};
      const startTimes = alignment.character_start_times_seconds || [];
      const endTimes = alignment.character_end_times_seconds || [];

      // Convert base64 audio to buffer
      const audioBuffer = Buffer.from(audioBase64, 'base64');

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
      await fs.writeFile(filepath, audioBuffer);

      // Calculate total duration from timestamps if available
      let duration = this.estimateAudioDuration(text); // Fallback estimation
      if (endTimes.length > 0) {
        const lastEndTime = endTimes[endTimes.length - 1];
        duration = Math.round(lastEndTime * 1000); // Convert to milliseconds
      }

      // Convert character-level timestamps to word-level timestamps
      const wordTimestamps = this.convertCharacterTimestampsToWords(
        alignment.characters || [],
        startTimes,
        endTimes
      );

      return {
        text,
        filename,
        duration,
        timestamps: wordTimestamps
      };
    } catch (error) {
      console.error(error);
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
        console.log("Retrying...");
        const audioSegment = await this.generateAudio(segment, voiceId, filename);
        segments.push(audioSegment);
        if (i < scriptSegments.length - 1) {
          await this.sleep(pauseGap);
        }
      }
    }

    return segments;
  }

  estimateAudioDuration(text: string): number {
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

  private convertCharacterTimestampsToWords(
    characters: string[],
    startTimes: number[],
    endTimes: number[]
  ): WordTimestamp[] {
    const wordTimestamps: WordTimestamp[] = [];

    if (characters.length === 0 || startTimes.length === 0 || endTimes.length === 0) {
      return wordTimestamps;
    }

    // Reconstruct the original text from characters
    const fullText = characters.join('');

    // Split into words (simple word boundary detection)
    const words = fullText.split(/\s+/).filter(word => word.length > 0);

    let charIndex = 0;

    for (const word of words) {
      // Skip whitespace characters
      while (charIndex < characters.length && /\s/.test(characters[charIndex])) {
        charIndex++;
      }

      if (charIndex >= characters.length) break;

      const actualWordStartIndex = charIndex;
      const actualWordEndIndex = Math.min(charIndex + word.length, characters.length);

      // Get timestamps for this word
      const wordStartTime = startTimes[actualWordStartIndex] || 0;
      const wordEndTime = endTimes[actualWordEndIndex - 1] || wordStartTime;

      wordTimestamps.push({
        word: word,
        start: Math.round(wordStartTime * 1000), // Convert to milliseconds
        end: Math.round(wordEndTime * 1000) // Convert to milliseconds
      });

      charIndex = actualWordEndIndex;
    }

    return wordTimestamps;
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
