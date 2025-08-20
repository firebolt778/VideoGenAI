import { storage } from "../storage";
import type { VideoTemplate, ThumbnailTemplate } from "@shared/schema";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface QualityCheckResult {
  passed: boolean;
  score: number; // 0-100
  issues: string[];
  recommendations: string[];
}

export class ValidationService {
  
  // Input validation for video generation
  async validateVideoGenerationInput(
    channelId: number,
    templateId: number,
    testMode: boolean = false
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      // Validate channel
      const channel = await storage.getChannel(channelId);
      if (!channel) {
        errors.push("Channel not found");
      } else {
        if (!channel.isActive) {
          errors.push("Channel is not active");
        }
        if (!testMode && !channel.youtubeAccessToken) {
          warnings.push("YouTube access token not configured - video will not be published");
        }
      }

      // Validate template
      const template = await storage.getVideoTemplate(templateId);
      if (!template) {
        errors.push("Video template not found");
      } else {
        const templateValidation = this.validateTemplate(template);
        errors.push(...templateValidation.errors);
        warnings.push(...templateValidation.warnings);
        suggestions.push(...templateValidation.suggestions);
      }

      // Check system resources
      const resourceCheck = await this.checkSystemResources();
      if (!resourceCheck.available) {
        errors.push(`Insufficient system resources: ${resourceCheck.reason}`);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation failed: ${error instanceof Error ? error.message : "Unknown error"}`],
        warnings: [],
        suggestions: []
      };
    }
  }

  // Template validation
  private validateTemplate(template: VideoTemplate): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check required fields
    if (!template.storyOutlinePrompt) {
      errors.push("Story outline prompt is required");
    }
    if (!template.fullScriptPrompt) {
      errors.push("Full script prompt is required");
    }
    if (!template.ideasList) {
      errors.push("Ideas list is required");
    }

    // Check ideas list quality
    if (template.ideasList) {
      const ideas = template.ideasList.split(template.ideasDelimiter || "---");
      if (ideas.length < 2) {
        warnings.push("Ideas list should contain at least 2 ideas");
      }
      if (ideas.length > 20) {
        warnings.push("Ideas list is very long - consider splitting into multiple templates");
      }
    }

    // Check prompt quality
    if (template.storyOutlinePrompt && template.storyOutlinePrompt.length < 50) {
      warnings.push("Story outline prompt seems too short - consider adding more detail");
    }
    if (template.videoLength && (template.videoLength < 5 || template.videoLength > 120)) {
      warnings.push("Video length should be between 5 and 120 minutes");
    }

    // Check image settings
    if (template.imageCount && (template.imageCount < 3 || template.imageCount > 20)) {
      warnings.push("Image count should be between 3 and 20 for optimal results");
    }

    // Check audio settings
    if (template.audioVoices && template.audioVoices.length === 0) {
      warnings.push("No audio voices configured");
    }

    return { isValid: errors.length === 0, errors, warnings, suggestions };
  }

  // System resource check
  private async checkSystemResources(): Promise<{ available: boolean; reason?: string }> {
    try {
      const fs = await import('fs/promises');
      const os = await import('os');

      // Check disk space
      const outputDir = 'output';
      try {
        await fs.access(outputDir);
      } catch {
        await fs.mkdir(outputDir, { recursive: true });
      }

      // Check available memory (simplified check)
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const memoryUsagePercent = ((totalMemory - freeMemory) / totalMemory) * 100;

      if (memoryUsagePercent > 90) {
        return { available: false, reason: "High memory usage" };
      }

      return { available: true };
    } catch (error) {
      return { available: false, reason: "Unable to check system resources" };
    }
  }

  // Content quality validation
  async validateGeneratedContent(
    script: string,
    images: any[],
    audioSegments: any[],
    title: string
  ): Promise<QualityCheckResult> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Script quality checks
    if (!script || script.length < 100) {
      issues.push("Script is too short");
      score -= 20;
    } else if (script.length > 10000) {
      issues.push("Script is very long");
      score -= 10;
    }

    if (script && script.includes("undefined") || script.includes("null")) {
      issues.push("Script contains placeholder text");
      score -= 15;
    }

    // Title quality checks
    if (!title || title.length < 5) {
      issues.push("Title is too short");
      score -= 10;
    } else if (title.length > 100) {
      issues.push("Title is too long");
      score -= 5;
    }

    // Image quality checks
    if (!images || images.length === 0) {
      issues.push("No images generated");
      score -= 30;
    } else if (images.length < 3) {
      issues.push("Very few images generated");
      score -= 10;
    }

    // Audio quality checks
    if (!audioSegments || audioSegments.length === 0) {
      issues.push("No audio segments generated");
      score -= 30;
    }

    // Generate recommendations
    if (score < 70) {
      recommendations.push("Consider regenerating the video with different settings");
    }
    if (script && script.length < 500) {
      recommendations.push("Consider increasing script length for better engagement");
    }
    if (images && images.length < 5) {
      recommendations.push("Consider increasing image count for better visual variety");
    }

    return {
      passed: score >= 70,
      score: Math.max(0, score),
      issues,
      recommendations
    };
  }

  // Validate video file
  async validateVideoFile(videoPath: string): Promise<QualityCheckResult> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    try {
      const fs = await import('fs/promises');
      const ffmpeg = await import('fluent-ffmpeg');

      // Check if file exists
      try {
        await fs.access(videoPath);
      } catch {
        issues.push("Video file does not exist");
        return { passed: false, score: 0, issues, recommendations };
      }

      // Check file size
      const stats = await fs.stat(videoPath);
      const fileSizeMB = stats.size / (1024 * 1024);
      
      if (fileSizeMB < 1) {
        issues.push("Video file is too small");
        score -= 20;
      } else if (fileSizeMB > 500) {
        issues.push("Video file is very large");
        score -= 10;
      }

      // Check video duration and properties
      return new Promise((resolve) => {
        ffmpeg.default.ffprobe(videoPath, (err, metadata) => {
          if (err) {
            issues.push("Unable to read video metadata");
            score -= 30;
            resolve({ passed: score >= 70, score, issues, recommendations });
            return;
          }

          const duration = metadata.format.duration;
          if (!duration || duration < 10) {
            issues.push("Video duration is too short");
            score -= 20;
          } else if (duration > 3600) {
            issues.push("Video duration is very long");
            score -= 10;
          }

          const videoStream = metadata.streams.find(s => s.codec_type === 'video');
          if (!videoStream) {
            issues.push("No video stream found");
            score -= 30;
          } else {
            const width = videoStream.width;
            const height = videoStream.height;
            if (!width || !height || width < 640 || height < 480) {
              issues.push("Video resolution is too low");
              score -= 15;
            }
          }

          resolve({ passed: score >= 70, score, issues, recommendations });
        });
      });
    } catch (error) {
      issues.push(`Video validation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      return { passed: false, score: 0, issues, recommendations };
    }
  }

  // Validate thumbnail
  async validateThumbnail(thumbnailPath: string): Promise<QualityCheckResult> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    try {
      const fs = await import('fs/promises');
      
      // Check if file exists
      try {
        await fs.access(thumbnailPath);
      } catch {
        issues.push("Thumbnail file does not exist");
        return { passed: false, score: 0, issues, recommendations };
      }

      // Check file size
      const stats = await fs.stat(thumbnailPath);
      const fileSizeKB = stats.size / 1024;
      
      if (fileSizeKB < 10) {
        issues.push("Thumbnail file is too small");
        score -= 20;
      } else if (fileSizeKB > 5000) {
        issues.push("Thumbnail file is very large");
        score -= 10;
      }

      return { passed: score >= 70, score, issues, recommendations };
    } catch (error) {
      issues.push(`Thumbnail validation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      return { passed: false, score: 0, issues, recommendations };
    }
  }
}

export const validationService = new ValidationService(); 