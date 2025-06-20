import { openaiService } from "./openai";
import { elevenLabsService } from "./elevenlabs";
import { fluxService } from "./flux";
import { remotionService } from "./remotion";
import { youtubeService } from "./youtube";
import { ShortcodeProcessor, type ShortcodeContext } from "./shortcode";
import { storage } from "../storage";
import type { Channel, VideoTemplate, Video } from "@shared/schema";

export interface VideoGenerationProgress {
  videoId: number;
  stage: string;
  progress: number;
  message: string;
  error?: string;
}

export class VideoWorkflowService {
  private progressCallbacks: Map<number, (progress: VideoGenerationProgress) => void> = new Map();

  async generateVideo(channelId: number, templateId: number, testMode: boolean = false): Promise<Video> {
    const channel = await storage.getChannel(channelId);
    const template = await storage.getVideoTemplate(templateId);
    
    if (!channel || !template) {
      throw new Error("Channel or template not found");
    }

    // Create video record
    const video = await storage.createVideo({
      channelId,
      templateId,
      title: "Generating...",
      status: "generating",
    });

    try {
      await this.logProgress(video.id, "initialization", 0, "Starting video generation workflow");

      // Step 1: Select and process idea
      const selectedIdea = this.selectIdea(template);
      await this.logProgress(video.id, "idea_selection", 10, `Selected idea: ${selectedIdea.substring(0, 50)}...`);

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
      await storage.updateVideo(video.id, { title });
      await this.logProgress(video.id, "outline", 20, `Generated outline: ${title}`);

      // Step 3: Generate full script
      const script = await this.generateScript(template, context);
      context.script = script;
      context.title = title;
      await this.logProgress(video.id, "script", 30, "Generated full script");

      // Step 4: Generate hook (if enabled)
      let hook = "";
      if (template.hookPrompt) {
        hook = await this.generateHook(template, context);
        await this.logProgress(video.id, "hook", 35, "Generated video hook");
      }

      // Step 5: Generate images
      const images = await this.generateImages(template, context);
      context.images = images.map(img => img.description);
      await this.logProgress(video.id, "images", 50, `Generated ${images.length} images`);

      // Step 6: Assign images to script segments
      const imageAssignments = await this.assignImages(template, context, images);
      await this.logProgress(video.id, "image_assignment", 60, "Assigned images to script segments");

      // Step 7: Generate audio segments
      const audioSegments = await this.generateAudio(template, imageAssignments);
      await this.logProgress(video.id, "audio", 70, `Generated ${audioSegments.length} audio segments`);

      // Step 8: Render video with Remotion
      const videoConfig = this.buildVideoConfig(title, script, audioSegments, images, template, channel);
      const videoPath = await remotionService.renderVideo(videoConfig, `output/video_${video.id}.mp4`);
      await this.logProgress(video.id, "rendering", 85, "Video rendering completed");

      // Step 9: Generate thumbnail
      const thumbnailPath = await this.generateThumbnail(video.id, title, script, channel);
      await this.logProgress(video.id, "thumbnail", 90, "Generated thumbnail");

      // Step 10: Upload to YouTube (if not test mode)
      let youtubeId = "";
      if (!testMode && channel.youtubeAccessToken) {
        const description = await this.generateVideoDescription(title, script, channel);
        youtubeId = await this.uploadToYouTube(videoPath, thumbnailPath, title, description, channel);
        await this.logProgress(video.id, "upload", 95, "Uploaded to YouTube");
      }

      // Step 11: Update video record
      await storage.updateVideo(video.id, {
        script,
        videoUrl: videoPath,
        thumbnailUrl: thumbnailPath,
        youtubeId,
        status: testMode ? "test_complete" : (youtubeId ? "published" : "rendered"),
      });

      await this.logProgress(video.id, "complete", 100, testMode ? "Test video generation completed" : "Video published successfully");

      return await storage.getVideo(video.id) as Video;

    } catch (error) {
      await storage.updateVideo(video.id, {
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      
      await storage.createJobLog({
        type: "video",
        entityId: video.id,
        status: "error",
        message: `Video generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        details: { channelId, templateId, testMode, error: error instanceof Error ? error.stack : error }
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
    const response = await openaiService.generateFullScript({ title: context.title, chapters: [], summary: "" }, prompt);
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
    const audioSegments = [];
    
    for (let i = 0; i < imageAssignments.length; i++) {
      const assignment = imageAssignments[i];
      const voiceId = this.selectVoice(template.audioVoices || []);
      
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

    return audioSegments;
  }

  private selectVoice(voices: string[]): string {
    if (voices.length === 0) {
      return "rachel"; // Default voice
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
  ) {
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
      captions: template.captionsEnabled ? {
        enabled: true,
        font: template.captionsFont || "Inter",
        color: template.captionsColor || "#ffffff",
        position: template.captionsPosition || "bottom",
        wordsPerTime: template.captionsWordsPerTime || 3
      } : { enabled: false }
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