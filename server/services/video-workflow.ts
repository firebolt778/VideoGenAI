import { openaiService } from "./openai";
import { elevenLabsService } from "./elevenlabs";
import { fluxService } from "./flux";
import { remotionService, RemotionVideoConfig } from "./remotion";
import { youtubeService } from "./youtube";
import { backgroundMusicService } from "./background-music";
import { ShortcodeProcessor, type ShortcodeContext } from "./shortcode";
import { storage } from "../storage";
import { validationService } from "./validation";
import { errorHandlerService } from "./error-handler";
import type { Channel, VideoTemplate, ThumbnailTemplate } from "@shared/schema";
import type { ErrorContext } from "./error-handler";

export interface VideoGenerationProgress {
  videoId: number;
  stage: string;
  progress: number;
  message: string;
  error?: string;
}

export class VideoWorkflowService {
  private progressCallbacks: Map<number, (progress: VideoGenerationProgress) => void> = new Map();

  async generateVideo(videoId: number, channelId: number, template: VideoTemplate, thumbnailTemplate: ThumbnailTemplate, testMode: boolean = false): Promise<void> {
    // Pre-validation
    const validationResult = await validationService.validateVideoGenerationInput(
      channelId,
      template.id,
      thumbnailTemplate.id,
      testMode
    );

    if (!validationResult.isValid) {
      throw new Error(`Validation failed: ${validationResult.errors.join(", ")}`);
    }

    if (validationResult.warnings.length > 0) {
      await this.logProgress(videoId, "validation", 5, `Validation warnings: ${validationResult.warnings.join(", ")}`);
    }

    const channel = await storage.getChannel(channelId);
  
    if (!channel || !template || !thumbnailTemplate) {
      throw new Error("Channel, template or thumbnail template not found");
    }

    try {
      // Step 1: Select and process idea
      const selectedIdea = await this.handleErrorWithRetry(
        () => this.selectIdea(template),
        { videoId, stage: "idea_selection", channelId, templateId: template.id, testMode, retryCount: 0, maxRetries: 3, error: new Error("Initial error"), timestamp: new Date() },
        "openai"
      ) as string;
      await this.logProgress(videoId, "idea_selection", 10, `Selected idea: ${selectedIdea.substring(0, 80)}...`);

      // Step 2: Generate story outline
      const context: ShortcodeContext = {
        selectedIdea,
        channelName: channel.name,
        channelDescription: channel.description || "",
        imageCount: template.imageCount || 8
      };

      const outline = await this.handleErrorWithRetry(
        () => this.generateOutline(template, context),
        { videoId, stage: "outline", channelId, templateId: template.id, testMode, retryCount: 0, maxRetries: 3, error: new Error("Initial error"), timestamp: new Date() },
        "openai"
      );
      context.outline = outline.raw;
      if (outline.chapters.length !== template.imageCount) {
        throw new Error(`OpenAI API Error: The number of chapters is invalid.`);
      }
      
      const title = outline.title || `${channel.name} Story`;
      await storage.updateVideo(videoId, { title });
      await this.logProgress(videoId, "outline", 15, `Generated outline: ${title}`);

      // Step 3: Generate full script
      const { fullScript: script, chapterSegments } = await this.generateScriptAndAssignImages(template, context);
      context.script = script;
      context.title = title;
      await this.logProgress(videoId, "script", 45, "Generated full script");

      // Step 4: Generate hook (if enabled)
      let hook = "";
      if (template.hookPrompt) {
        hook = await this.generateHook(template, context);
        await this.logProgress(videoId, "hook", 50, "Generated video hook");
      }

      // Step 5: Generate images
      const images = await this.generateImages(template, context);
      context.images = images.map(img => img.description);
      await this.logProgress(videoId, "images", 60, `Generated ${images.length} images`);

      // Step 6: Assign images to script segments
      const imageAssignments = chapterSegments.map((segment, i) => ({
        ...segment,
        image: images[i] || images[images.length - 1]
      }));

      // Step 7: Generate audio segments
      const { audioSegments, bgAudio } = await this.generateAudio(template, imageAssignments);
      await this.logProgress(videoId, "audio", 80, `Generated ${audioSegments.length} audio segments`);

      // Step 8: Render video with Remotion
      const videoConfig = this.buildVideoConfig(title, script, audioSegments, images, template, channel, bgAudio);
      const videoPath = await remotionService.renderVideo(videoConfig, `output/video_${videoId}.mp4`);
      await this.logProgress(videoId, "rendering", 85, "Video rendering completed");

      // Step 9: Generate thumbnail
      const thumbnailPath = await this.generateThumbnail(videoId, title, script, channel, images, thumbnailTemplate);
      await this.logProgress(videoId, "thumbnail", 90, "Generated thumbnail");

      // Step 10: Upload to YouTube (if not test mode)
      let youtubeId = "";
      if (!testMode && channel.youtubeAccessToken) {
        const description = await this.generateVideoDescription(title, script, channel);
        youtubeId = await this.uploadToYouTube(videoPath, thumbnailPath, title, description, channel);
        await this.logProgress(videoId, "upload", 95, "Uploaded to YouTube");
      }

      // Step 11: Update video record
      await storage.updateVideo(videoId, {
        script,
        videoUrl: videoPath,
        thumbnailUrl: thumbnailPath,
        youtubeId,
        status: testMode ? "test_complete" : (youtubeId ? "published" : "rendered"),
      });

      await this.logProgress(videoId, "complete", 100, testMode ? "Test video generation completed" : "Video published successfully");
    } catch (error) {
      await storage.updateVideo(videoId, {
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      
      await storage.createJobLog({
        type: "video",
        entityId: videoId,
        status: "error",
        message: `Video generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        details: {
          channelId,
          templateId: template.id,
          testMode,
          error: error instanceof Error ? error.stack : error
        }
      });

      throw error;
    }
  }

  private async logProgress(videoId: number, stage: string, progress: number, message: string) {
    await storage.createJobLog({
      type: "video",
      entityId: videoId,
      status: "info",
      message,
      details: { stage, progress }
    });

    const callback = this.progressCallbacks.get(videoId);
    if (callback) {
      callback({ videoId, stage, progress, message });
    }
  }

  private async selectIdea(template: VideoTemplate): Promise<string> {
    if (!template.ideasList) {
      throw new Error("No ideas list configured for template");
    }

    return ShortcodeProcessor.selectRandomIdea(
      template.ideasList,
      template.ideasDelimiter || "---"
    );
  }

  private async generateOutline(template: VideoTemplate, context: ShortcodeContext) {
    if (!template.storyOutlinePrompt) {
      throw new Error("No story outline prompt configured");
    }

    const prompt = ShortcodeProcessor.process(template.storyOutlinePrompt, context);
    const response = await openaiService.generateStoryOutline(context.selectedIdea || "", template.imageCount || 5, prompt);
    
    return {
      raw: JSON.stringify(response),
      title: response.title,
      chapters: response.chapters,
      summary: response.summary,
      mainCharacter: response.mainCharacter,
      environment: response.environment
    };
  }

  private async generateScriptAndAssignImages(
    template: VideoTemplate,
    context: ShortcodeContext,
  ): Promise<{ fullScript: string, chapterSegments: { scriptSegment: string, chapterIndex: number, chapter: any }[] }> {
    const outline = JSON.parse(context.outline || "{}");
    let fullScript = "";
    let previousScript = "";
    const chapterSegments: { scriptSegment: string, chapterIndex: number, chapter: any }[] = [];
  
    for (let i = 0; i < outline.chapters.length; i++) {
      const chapter = outline.chapters[i];
      const chapterScript = await openaiService.generateScriptForChapter(
        outline,
        chapter,
        previousScript,
        template.videoLength || undefined
      );
      fullScript += chapterScript + "\n\n";
      previousScript += chapterScript + "\n\n";
      chapterSegments.push({
        scriptSegment: chapterScript,
        chapterIndex: i,
        chapter
      });
    }
  
    return { fullScript: fullScript.trim(), chapterSegments };
  }

  private async generateHook(template: VideoTemplate, context: ShortcodeContext): Promise<string> {
    const prompt = ShortcodeProcessor.process(template.hookPrompt!, context);
    
    // Use OpenAI to generate hook
    const response = await openaiService.generateFullScript({ title: context.title || "", chapters: [], summary: "" }, prompt);
    return response;
  }

  private async generateImages(template: VideoTemplate, context: ShortcodeContext) {
    if (!template.imagePrompt) {
      throw new Error("No image prompt configured");
    }

    const prompt = ShortcodeProcessor.process(template.imagePrompt, context);
    const imagePrompts = await openaiService.generateImagePrompts(
      context.script!,
      context.imageCount || 8,
      prompt,
      { mainCharacter: context.mainCharacter, environment: context.environment }
    );

    const images = [];
    for (let i = 0; i < imagePrompts.length; i++) {
      const imagePrompt = imagePrompts[i];
      try {
        const image = await fluxService.generateImageWithFallback(imagePrompt.description, images[i - 1]?.url);
        images.push({
          ...image,
          index: i + 1,
          description: imagePrompt.description
        });
      } catch (error) {
        console.error(`Failed to generate image ${i + 1}:`, error);
        // Continue with other images
      }
    }

    return images;
  }

  private async generateAudio(template: VideoTemplate, imageAssignments: any[]) {
    const audioSegments: Array<{
      text: string;
      filename: string;
      duration?: number;
    }> = [];
    
    for (let i = 0; i < imageAssignments.length; i++) {
      const assignment = imageAssignments[i];
      // const voiceId = await this.selectVoice(template.audioVoices || []);
      const voiceId = await this.selectVoice([]);
      
      try {
        const segment = await elevenLabsService.generateAudio(
          assignment.scriptSegment,
          voiceId,
          `audio_segment_${i + 1}.mp3`
        );
        audioSegments.push(segment);
      } catch (error) {
        console.error(`Failed to generate audio for segment ${i + 1}:`, error);
        // Create a placeholder segment
        audioSegments.push({
          text: assignment.scriptSegment,
          filename: `placeholder_${i + 1}.mp3`,
          duration: assignment.scriptSegment.length * 0.1 // Rough estimate
        });
      }
    }

    let bgAudio: string | undefined = undefined;
    // Generate background music if enabled
    if (template.backgroundMusicPrompt) {
      try {
        const totalDuration = audioSegments.reduce((sum, seg) => sum + (seg.duration || 0), 0) / 1000; // Convert to seconds
        
        console.log(`Generating background music for ${totalDuration}s duration`);
        
        const music = await backgroundMusicService.generateMusic({
          prompt: template.backgroundMusicPrompt,
          duration: Math.ceil(totalDuration),
          style: template.musicStyle || 'Ambient',
          mood: template.musicMood || 'Calm',
          volume: template.musicVolume || 30
        });

        console.log(`Background music generated: ${music.filename}`);
        bgAudio = music.filename;
      } catch (error) {
        console.error('Failed to generate background music:', error);
        console.error('Continuing without background music...');
        // Continue without background music - the audio segments will be used as-is
      }
    }

    return { audioSegments, bgAudio };
  }

  private async selectVoice(voices: string[]): Promise<string> {
    if (voices.length === 0) {
      const voices = await elevenLabsService.getAvailableVoices();
      return voices[0].voice_id;
    }
    
    const randomIndex = Math.floor(Math.random() * voices.length);
    return voices[randomIndex];
  }

  private buildVideoConfig(
    title: string,
    script: string,
    audioSegments: any[],
    images: any[],
    template: VideoTemplate,
    channel: Channel,
    bgAudio?: string
  ): RemotionVideoConfig {
    return {
      title,
      script,
      audioSegments,
      images: images.map(img => ({
        filename: img.filename,
        description: img.description,
        scriptSegment: img.prompt || ""
      })),
      bgAudio,
      watermark: channel.watermarkUrl ? {
        url: channel.watermarkUrl,
        position: channel.watermarkPosition || "bottom-right",
        opacity: (channel.watermarkOpacity || 80) / 100,
        size: (channel.watermarkSize || 15) / 100
      } : undefined,
      effects: template.videoEffects || {
        kenBurns: true,
        kenBurnsSpeed: 1,
        kenBurnsDirection: "random",
        filmGrain: false,
        fog: false
      },
      captions: {
        enabled: !!template.captionsEnabled,
        font: template.captionsFont || "Inter",
        color: template.captionsColor || "#ffffff",
        position: template.captionsPosition || "bottom",
      }
    };
  }

  // --- UPDATED: Accept images and thumbnailTemplate, support granular fallback ---
  private async generateThumbnail(
    videoId: number,
    title: string,
    script: string,
    channel: Channel,
    images: any[],
    thumbnailTemplate?: any
  ): Promise<string> {
    // Helper to fallback to a video frame at a specific time
    const fallbackToVideoFrame = async (position: 'first' | 'last' | 'random' = 'first') => {
      const videoPath = `output/video_${videoId}.mp4`;
      const outputPath = `thumbnails/thumbnail_${videoId}.jpg`;
      let timeInSeconds = 5; // default
      try {
        // Try to get video duration if possible
        const ffmpeg = await import('fluent-ffmpeg');
        const getDuration = () => new Promise<number>((resolve, reject) => {
          ffmpeg.default(videoPath).ffprobe((err, metadata) => {
            if (err) return resolve(10); // fallback
            resolve(metadata.format.duration || 10);
          });
        });
        const duration = await getDuration();
        if (position === 'first') timeInSeconds = 0.5;
        else if (position === 'last') timeInSeconds = Math.max(duration - 1, 0.5);
        else if (position === 'random') timeInSeconds = Math.max(Math.random() * (duration - 1), 0.5);
      } catch {}
      return await remotionService.generateThumbnail(videoPath, outputPath, timeInSeconds);
    };

    // Helper to fallback to a generated image
    const fallbackToGeneratedImage = async (which: 'first' | 'last' | 'random') => {
      if (!images || images.length === 0) return undefined;
      let selected;
      if (which === 'first') selected = images[0];
      else if (which === 'last') selected = images[images.length - 1];
      else if (which === 'random') selected = images[Math.floor(Math.random() * images.length)];
      // Copy image to thumbnails folder
      const fs = await import('fs/promises');
      const path = await import('path');
      const srcPath = path.join(process.cwd(), 'uploads', 'images', selected.filename);
      const destDir = path.join(process.cwd(), 'thumbnails');
      await fs.mkdir(destDir, { recursive: true });
      const destPath = path.join(destDir, `thumbnail_${videoId}.jpg`);
      await fs.copyFile(srcPath, destPath);
      return `thumbnails/thumbnail_${videoId}.jpg`;
    };

    // --- Main logic ---
    const type = thumbnailTemplate?.type || 'ai-generated';
    const fallbackStrategy = thumbnailTemplate?.fallbackStrategy || 'first-image';
    try {
      if (type === 'ai-generated') {
        try {
          const thumbnailPrompt = await openaiService.generateThumbnailPrompt(title, script);
          const thumbnail = await fluxService.generateImageWithFallback(thumbnailPrompt);
          return thumbnail.filename;
        } catch (error) {
          console.error("Failed to generate AI thumbnail, using fallback strategy:", error);
          // Fallback below
        }
      }
      // If not ai-generated, or fallback from AI
      if (type === 'first-image' || (type === 'ai-generated' && fallbackStrategy === 'first-image')) {
        // Try generated image first, else video frame
        return (await fallbackToGeneratedImage('first')) || (await fallbackToVideoFrame('first'));
      } else if (type === 'last-image' || (type === 'ai-generated' && fallbackStrategy === 'last-image')) {
        return (await fallbackToGeneratedImage('last')) || (await fallbackToVideoFrame('last'));
      } else if (type === 'random-image' || (type === 'ai-generated' && fallbackStrategy === 'random-image')) {
        return (await fallbackToGeneratedImage('random')) || (await fallbackToVideoFrame('random'));
      } else {
        // Default fallback: video frame at 5s
        return await fallbackToVideoFrame('first');
      }
    } catch (error) {
      console.error("All thumbnail generation methods failed, using video frame:", error);
      return await fallbackToVideoFrame('first');
    }
  }

  private async generateVideoDescription(title: string, script: string, channel: Channel): Promise<string> {
    if (channel.videoDescriptionPrompt) {
      const context = {
        title,
        script,
        channelName: channel.name,
        channelDescription: channel.description || ""
      };
      return ShortcodeProcessor.process(channel.videoDescriptionPrompt, context);
    }
    
    return await openaiService.generateVideoDescription(title, script, {
      name: channel.name,
      description: channel.description
    });
  }

  private async uploadToYouTube(
    videoPath: string,
    thumbnailPath: string,
    title: string,
    description: string,
    channel: Channel
  ): Promise<string> {
    const videoId = await youtubeService.uploadVideo({
      title,
      description,
      tags: ["AI Generated", "Story", "Automated"],
      categoryId: "24", // Entertainment
      privacyStatus: "public",
      videoFilePath: videoPath,
      thumbnailPath
    });

    return videoId;
  }

  onProgress(videoId: number, callback: (progress: VideoGenerationProgress) => void) {
    this.progressCallbacks.set(videoId, callback);
  }

  offProgress(videoId: number) {
    this.progressCallbacks.delete(videoId);
  }

  // Enhanced error handling with retry logic
  private async handleErrorWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    service: string
  ): Promise<T> {
    return errorHandlerService.handleErrorWithRetry(operation, context, service);
  }

  // Handle content generation with quality checks
  private async handleContentGeneration<T>(
    operation: () => Promise<T>,
    qualityCheck: (result: T) => Promise<boolean>,
    context: ErrorContext,
    service: string
  ): Promise<T> {
    return errorHandlerService.handleContentGeneration(operation, qualityCheck, context, service);
  }
}

export const videoWorkflowService = new VideoWorkflowService();