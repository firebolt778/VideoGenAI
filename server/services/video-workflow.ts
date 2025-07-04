import { openaiService } from "./openai";
import { elevenLabsService } from "./elevenlabs";
import { fluxService } from "./flux";
import { remotionService, RemotionVideoConfig } from "./remotion";
import { youtubeService } from "./youtube";
import { backgroundMusicService } from "./background-music";
import { ShortcodeProcessor, type ShortcodeContext } from "./shortcode";
import { storage } from "../storage";
import type { Channel, VideoTemplate, Video } from "@shared/schema";
import path from "path";

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
    const channel = await storage.getChannel(channelId);
  
    if (!channel || !template) {
      throw new Error("Channel or template not found");
    }

    try {
      await this.logProgress(videoId, "initialization", 0, "Starting video generation workflow");

      // Step 1: Select and process idea
      const selectedIdea = this.selectIdea(template);
      await this.logProgress(videoId, "idea_selection", 10, `Selected idea: ${selectedIdea.substring(0, 50)}...`);

      // Step 2: Generate story outline
      const context: ShortcodeContext = {
        selectedIdea,
        channelName: channel.name,
        channelDescription: channel.description || "",
        imageCount: template.imageCount || 8,
      };

      const outline = await this.generateOutline(template, context);
      context.outline = outline.raw;
      
      const title = outline.title || `${channel.name} Story`;
      await storage.updateVideo(videoId, { title });
      await this.logProgress(videoId, "outline", 20, `Generated outline: ${title}`);

      // Step 3: Generate full script
      const script = await this.generateScript(template, context);
      context.script = script;
      context.title = title;
      await this.logProgress(videoId, "script", 30, "Generated full script");

      // Step 4: Generate hook (if enabled)
      let hook = "";
      if (template.hookPrompt) {
        hook = await this.generateHook(template, context);
        await this.logProgress(videoId, "hook", 35, "Generated video hook");
      }

      // Step 5: Generate images
      const images = await this.generateImages(template, context);
      context.images = images.map(img => img.description);
      await this.logProgress(videoId, "images", 50, `Generated ${images.length} images`);

      // Step 6: Assign images to script segments
      const imageAssignments = await this.assignImages(template, context, images);
      await this.logProgress(videoId, "image_assignment", 60, "Assigned images to script segments");

      // Step 7: Generate audio segments
      const audioSegments = await this.generateAudio(template, imageAssignments);
      await this.logProgress(videoId, "audio", 70, `Generated ${audioSegments.length} audio segments`);

      if (audioSegments.length !== imageAssignments.length) {
        throw new Error("Audio segments and image assignments do not match");
      }

      // Step 8: Render video with Remotion
      const videoConfig = this.buildVideoConfig(title, script, audioSegments, images, template, channel);
      const videoPath = await remotionService.renderVideo(videoConfig, `output/video_${videoId}.mp4`);
      await this.logProgress(videoId, "rendering", 85, "Video rendering completed");

      // Step 9: Generate thumbnail
      const thumbnailPath = await this.generateThumbnail(videoId, title, script, channel);
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

  private selectIdea(template: VideoTemplate): string {
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
    const response = await openaiService.generateStoryOutline(context.selectedIdea || "", prompt);
    
    return {
      raw: JSON.stringify(response),
      title: response.title,
      chapters: response.chapters,
      summary: response.summary
    };
  }

  private async generateScript(template: VideoTemplate, context: ShortcodeContext): Promise<string> {
    if (!template.fullStoryPrompt) {
      throw new Error("No full story prompt configured");
    }

    const prompt = ShortcodeProcessor.process(template.fullStoryPrompt, context);
    const outline = JSON.parse(context.outline || "{}");
    
    const script = await openaiService.generateFullScript(outline, prompt);
    return ShortcodeProcessor.extractDataFromResponse(script);
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
    const imagePrompts = await openaiService.generateImagePrompts(context.script!, context.imageCount || 8, prompt);
    
    const images = [];
    for (let i = 0; i < imagePrompts.length; i++) {
      const imagePrompt = imagePrompts[i];
      try {
        const image = await fluxService.generateImageWithFallback(imagePrompt.description);
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

  private async assignImages(template: VideoTemplate, context: ShortcodeContext, images: any[]) {
    if (!template.imageAssignmentPrompt) {
      throw new Error("No image assignment prompt configured");
    }

    const imageDescriptions = images.map(img => img.description);
    const assignmentContext = {
      ...context,
      images: imageDescriptions
    };
    
    const prompt = ShortcodeProcessor.process(template.imageAssignmentPrompt, assignmentContext);
    const assignments = await openaiService.assignImagesToScript(context.script!, imageDescriptions, prompt);
    
    return assignments.map((assignment, index) => ({
      ...assignment,
      image: images[assignment.imageIndex - 1] || images[index % images.length]
    }));
  }

  private async generateAudio(template: VideoTemplate, imageAssignments: any[]) {
    const audioSegments: Array<{
      text: string;
      filename: string;
      duration?: number;
    }> = [];
    
    for (let i = 0; i < imageAssignments.length; i++) {
      const assignment = imageAssignments[i];
      const voiceId = await this.selectVoice(template.audioVoices || []);
      
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

        // Mix background music with audio segments
        for (let i = 0; i < audioSegments.length; i++) {
          const segment = audioSegments[i];
          const audioFilePath = path.join(process.cwd(), 'uploads', 'audio', segment.filename);
          const musicFilePath = path.join(process.cwd(), 'uploads', 'music', music.filename);
          
          console.log(`Mixing audio segment ${i + 1} with background music`);
          
          const mixedAudioPath = await backgroundMusicService.mixAudioWithMusic(
            audioFilePath,
            musicFilePath,
            music.volume
          );
          
          // Update segment filename to point to mixed audio
          audioSegments[i] = {
            ...segment,
            filename: path.basename(mixedAudioPath)
          };
        }
      } catch (error) {
        console.error('Failed to generate background music:', error);
        console.error('Continuing without background music...');
        // Continue without background music - the audio segments will be used as-is
      }
    }

    return audioSegments;
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
    channel: Channel
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
        wordsPerTime: template.captionsWordsPerTime || 3
      }
    };
  }

  private async generateThumbnail(videoId: number, title: string, script: string, channel: Channel): Promise<string> {
    try {
      const thumbnailPrompt = await openaiService.generateThumbnailPrompt(title, script);
      const thumbnail = await fluxService.generateImageWithFallback(thumbnailPrompt);
      return thumbnail.filename;
    } catch (error) {
      console.error("Failed to generate AI thumbnail, using video frame:", error);
      // Fallback to video frame
      return await remotionService.generateThumbnail(
        `output/video_${videoId}.mp4`,
        `thumbnails/thumbnail_${videoId}.jpg`
      );
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
}

export const videoWorkflowService = new VideoWorkflowService();