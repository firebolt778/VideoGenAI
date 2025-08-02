import { openaiService } from "./openai";
import { AudioSegment, elevenLabsService } from "./elevenlabs";
import { fluxService } from "./flux";
import { remotionService, RemotionVideoConfig } from "./remotion";
import { youtubeService } from "./youtube";
import { backgroundMusicService } from "./background-music";
import { ShortcodeProcessor, type ShortcodeContext } from "./shortcode";
import { storage } from "../storage";
import { validationService } from "./validation";
import { errorHandlerService } from "./error-handler";
import type { Channel, VideoTemplate, ThumbnailTemplate, HookTemplate } from "@shared/schema";
import type { ErrorContext } from "./error-handler";
import fs from 'fs/promises';
import path from "path";

const aiResponseDir = path.join(process.cwd(), "ai-response");

export interface VideoGenerationProgress {
  videoId: number;
  stage: string;
  progress: number;
  message: string;
  error?: string;
}

export class VideoWorkflowService {
  private progressCallbacks: Map<number, (progress: VideoGenerationProgress) => void> = new Map();

  async generateVideo(videoId: number, channelId: number, template: VideoTemplate, testMode: boolean = false): Promise<void> {
    // Pre-validation
    const validationResult = await validationService.validateVideoGenerationInput(
      channelId,
      template.id,
      testMode
    );

    if (!validationResult.isValid) {
      throw new Error(`Validation failed: ${validationResult.errors.join(", ")}`);
    }

    if (validationResult.warnings.length > 0) {
      await this.logProgress(videoId, "validation", 5, `Validation warnings: ${validationResult.warnings.join(", ")}`);
    }

    const channel = await storage.getChannel(channelId);

    if (!channel || !template) {
      throw new Error("Channel or template not found");
    }

    try {
      const thumbnailTemplate = await this.selectRandomThumbnailTemplate(channel);
      if (!thumbnailTemplate) {
        throw new Error("No thumbnail template found");
      }

      const hookTemplate = await this.selectRandomHookTemplate(channel);
      const voiceId = await this.selectVoice(template.audioVoices || []);

      const compositionsDir = path.join(aiResponseDir, `${videoId}`)
      await fs.mkdir(compositionsDir, { recursive: true });

      // Step 1: Select and process idea
      const selectedIdea = await this.handleErrorWithRetry(
        () => this.selectIdea(template),
        { videoId, stage: "idea_selection", channelId, templateId: template.id, testMode, retryCount: 0, maxRetries: 3, error: new Error("Initial error"), timestamp: new Date() },
        "openai"
      ) as string;
      await fs.writeFile(path.join(compositionsDir, 'idea.txt'), selectedIdea);
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
      await fs.writeFile(path.join(compositionsDir, 'outline.txt'), JSON.stringify(structuredClone(outline), undefined, 2));
      context.outline = outline.raw;

      const title = outline.title || `${channel.name} Story`;
      context.title = title;
      await storage.updateVideo(videoId, { title });
      await this.logProgress(videoId, "outline", 15, `Generated outline: ${title}`);

      // Step 3: Generate full script
      const fullScript = await this.generateFullScript(template, context);
      context.script = fullScript;
      await fs.writeFile(path.join(compositionsDir, 'fullScript.txt'), fullScript);
      await this.logProgress(videoId, "script", 20, "Generated full script");

      // Step 4: Generate hook (if enabled)
      let hookAudio: AudioSegment | undefined = undefined;
      if (hookTemplate) {
        const hook = await this.generateHook(hookTemplate, context);
        await fs.writeFile(path.join(compositionsDir, 'hook.txt'), hook);
        hookAudio = await this.generateHookAudio(hookTemplate, hook, voiceId);
        await this.logProgress(videoId, "hook", 30, "Generated video hook");
      }

      // Step 5: Generate images
      const images = await this.generateImages(template, context);
      await fs.writeFile(path.join(compositionsDir, 'images.txt'), JSON.stringify(structuredClone(images), undefined, 2));
      context.images = images;
      await this.logProgress(videoId, "images", 45, `Generated ${images.length} images`);

      // Step 6: Assign images to script segments
      const imageAssignments = await this.assignImages(template, context);
      await fs.writeFile(path.join(compositionsDir, 'imageAssignments.txt'), JSON.stringify(structuredClone(imageAssignments), undefined, 2));
      await this.logProgress(videoId, "image_assignment", 50, "Assigned images to script segments");

      // Step 7: Generate audio segments
      const { audioSegments, bgAudio } = await this.generateAudio(template, imageAssignments, voiceId);
      await this.logProgress(videoId, "audio", 80, `Generated ${audioSegments.length} audio segments`);

      // Step 8: Render video with Remotion
      const videoConfig = this.buildVideoConfig(title, audioSegments, imageAssignments, template, channel, bgAudio, hookAudio);
      const videoPath = await remotionService.renderVideo(videoConfig, `output/video_${videoId}.mp4`);
      await this.logProgress(videoId, "rendering", 85, "Video rendering completed");

      // Step 9: Generate thumbnail
      const thumbnailPath = await this.generateThumbnail(videoId, title, fullScript, channel, images, thumbnailTemplate);
      await this.logProgress(videoId, "thumbnail", 90, "Generated thumbnail");

      // Step 10: Upload to YouTube (if not test mode)
      let youtubeId = "";
      if (!testMode) {
        const description = await this.generateVideoDescription(title, fullScript, channel);
        youtubeId = await this.uploadToYouTube(videoPath, thumbnailPath, title, description, channel);
        await this.logProgress(videoId, "upload", 95, "Uploaded to YouTube");
      }

      // Step 11: Update video record
      await storage.updateVideo(videoId, {
        script: fullScript,
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

  private async selectRandomThumbnailTemplate(channel: Channel): Promise<ThumbnailTemplate | null> {
    const thumbnails = await storage.getChannelThumbnails(channel.id);
    if (!thumbnails || thumbnails.length === 0) {
      return null;
    }
    if (thumbnails.length === 1) {
      return thumbnails[0];
    }
    const randomIndex = Math.floor(Math.random() * thumbnails.length);
    return thumbnails[randomIndex];
  }

  private async selectRandomHookTemplate(channel: Channel): Promise<HookTemplate | null> {
    const hooks = await storage.getChannelHooks(channel.id);
    if (!hooks || hooks.length === 0) {
      return null;
    }
    if (hooks.length === 1) {
      return hooks[0];
    }
    const randomIndex = Math.floor(Math.random() * hooks.length);
    return hooks[randomIndex];
  }

  private async generateOutline(template: VideoTemplate, context: ShortcodeContext) {
    if (!template.storyOutlinePrompt) {
      throw new Error("No story outline prompt configured");
    }

    const prompt = ShortcodeProcessor.process(template.storyOutlinePrompt, context);
    const response = await openaiService.generateStoryOutline(context.selectedIdea || "", prompt, template.outlinePromptModel || undefined);

    return {
      raw: JSON.stringify(response),
      title: response.title,
      chapters: response.chapters,
      summary: response.summary,
      mainCharacter: response.mainCharacter,
      environment: response.environment
    };
  }

  private async generateFullScript(template: VideoTemplate, context: ShortcodeContext): Promise<string> {
    const outline = JSON.parse(context.outline || "{}");
    const prompt = ShortcodeProcessor.process(template.fullScriptPrompt || "", context);
    return await openaiService.generateFullScript(outline, prompt, template.scriptPromptModel || undefined);
  }

  private async assignImages(template: VideoTemplate, context: ShortcodeContext) {
    const prompt = ShortcodeProcessor.process(template.imgAssignmentPrompt || "", context);
    return await openaiService.assignImagesToScript(context.outline || "", context.script || "", context.images || [], prompt, template.imgAssignmentModel || undefined);
  }

  private async generateHook(hookTemplate: HookTemplate, context: ShortcodeContext): Promise<string> {
    const prompt = ShortcodeProcessor.process(hookTemplate.prompt, context);

    // Use OpenAI to generate hook
    const response = await openaiService.generateHook(prompt, context.outline || "", hookTemplate.promptModel ?? undefined);
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
      { mainCharacter: context.mainCharacter, environment: context.environment },
      template.imgPromptModel || undefined,
    );

    const images = [];
    for (let i = 0; i < imagePrompts.length; i++) {
      const imagePrompt = imagePrompts[i];
      try {
        const image = await fluxService.generateImageWithFallback(imagePrompt.description, template.imageModel || undefined);
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

  private async generateAudio(template: VideoTemplate, imageAssignments: any[], voiceId: string) {
    const audioSegments: Array<{
      text: string;
      filename: string;
      duration?: number;
    }> = [];

    for (let i = 0; i < imageAssignments.length; i++) {
      const chapter = imageAssignments[i];
      for (let j = 0; j < chapter.images.length; j++) {
        const image = chapter.images[j];
        try {
          const segment = await elevenLabsService.generateAudio(
            image.scriptSegment,
            voiceId,
            `audio_segment_${i + 1}_${j + 1}.mp3`
          );
          audioSegments.push(segment);
        } catch (error) {
          console.error(`Failed to generate audio for segment ${i + 1}-${j + 1}:`, error);
          // Create a placeholder segment
          audioSegments.push({
            text: image.scriptSegment,
            filename: `placeholder_${i + 1}_${j + 1}.mp3`,
            duration: elevenLabsService.estimateAudioDuration(image.scriptSegment)
          });
        }
      }
    }

    let bgAudio: string | undefined = undefined;
    // Generate background music if enabled
    if (template.backgroundMusicPrompt) {
      try {
        const audioDuration = audioSegments.reduce((sum, seg) => sum + (seg.duration || 0), 0) / 1000; // Convert to seconds
        const totalDuration = audioDuration + 2.5 * audioSegments.length;

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

  private async generateHookAudio(hookTemplate: HookTemplate, hook: string, voiceId: string) {
    const hookSpeed = hookTemplate.editSpeed || "medium";
    const segment = await elevenLabsService.generateAudio(hook, voiceId, 'hook_audio.mp3', hookSpeed);
    return segment;
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
    audioSegments: any[],
    imageAssignments: any[],
    template: VideoTemplate,
    channel: Channel,
    bgAudio?: string,
    hookAudio?: AudioSegment
  ): RemotionVideoConfig {
    const config: RemotionVideoConfig = {
      title: {
        text: title,
        bgColor: channel.titleBgColor || "#000000",
        color: channel.titleColor || "#ffffff",
        font: channel.titleFont || "Arial",
      },
      audioSegments,
      imageAssignments,
      bgAudio,
      hookAudio: hookAudio ? {
        filename: hookAudio.filename || "",
        text: hookAudio.text || "",
        duration: Math.ceil((hookAudio.duration || 0) / 1000),
      } : undefined,
      watermark: channel.watermarkUrl ? {
        url: channel.watermarkUrl,
        position: channel.watermarkPosition || "bottom-right",
        opacity: (channel.watermarkOpacity || 80) / 100,
        size: channel.watermarkSize || 5
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
      },
      intro: (channel.videoIntro && channel.videoIntroUrl) ? {
        url: channel.videoIntroUrl,
        dissolveTime: channel.introDissolveTime || 0,
        duration: channel.introDuration || 0,
      } : undefined,
      outro: (channel.videoOutro && channel.videoOutroUrl) ? {
        url: channel.videoOutroUrl,
        dissolveTime: channel.outroDissolveTime || 0,
        duration: channel.outroDuration || 0,
      } : undefined,
    };
    if (channel.chapterIndicators) {
      const chapterMarkers: { text: string; time: number }[] = [];
      for (let i = 0; i < imageAssignments.length; i++) {
        const chapters = imageAssignments.slice(0, i).reduce((sum, chapter) => sum + chapter.images.length, 0);
        const audio = audioSegments.slice(0, chapters);
        chapterMarkers.push({
          text: imageAssignments[i].chapter,
          time: audio.reduce((sum, aud) => sum + (aud.duration || 0), 0),
        });
      }
      config.chapterMarkers = chapterMarkers;
      config.chapterMarkerBgColor = channel.chapterMarkerBgColor || undefined;
      config.chapterMarkerFont = channel.chapterMarkerFont || undefined;
      config.chapterMarkerFontColor = channel.chapterMarkerFontColor || undefined;
    }
    return config;
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
      } catch { }
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
      const prompt = ShortcodeProcessor.process(channel.videoDescriptionPrompt, context);
      return await openaiService.generateVideoDescription(title, script, {}, prompt);
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
    await youtubeService.refreshAccessToken();
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