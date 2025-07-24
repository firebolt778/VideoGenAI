import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertChannelSchema, insertVideoTemplateSchema, insertThumbnailTemplateSchema, insertHookTemplateSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import * as fsSync from "fs";
import { elevenLabsService } from "./services/elevenlabs";
import { getVideoDuration } from "./utils/video-metadata";

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  }
});

const uploadVideo = multer({
  dest: 'uploads/video/',
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["video/mp4", "video/mkv", "video/avi", "video/mov"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only video files are allowed."));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Dashboard stats
  app.get("/api/stats", async (req, res) => {
    try {
      const channels = await storage.getChannels();
      const videos = await storage.getVideos();
      const logs = await storage.getJobLogs(10);
      
      const activeChannels = channels.filter(c => c.isActive).length;
      const queuedVideos = videos.filter(v => v.status === 'queued').length;
      const failedJobs = logs.filter(l => l.status === 'error').length;
      const videosGenerated = videos.filter(v => v.status === 'published').length;
      
      res.json({
        activeChannels,
        videosGenerated,
        queuedVideos,
        failedJobs
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats" });
      console.error(error);
    }
  });

  // Channel routes
  app.get("/api/channels", async (req, res) => {
    try {
      const channels = await storage.getChannels();
      // Fetch hooks and thumbnails for each channel
      const channelsWithRelations = await Promise.all(channels.map(async (channel) => {
        const hooks = await storage.getChannelHooks(channel.id);
        const thumbnails = await storage.getChannelThumbnails(channel.id);
        return { ...channel, hookIds: hooks.map(h => h.id), hooks, thumbnailIds: thumbnails.map(t => t.id), thumbnails };
      }));
      res.json(channelsWithRelations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch channels" });
      console.error(error);
    }
  });

  app.get("/api/channels/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const channel = await storage.getChannel(id);
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }
      const hooks = await storage.getChannelHooks(channel.id);
      const thumbnails = await storage.getChannelThumbnails(channel.id);
      res.json({ ...channel, hookIds: hooks.map(h => h.id), hooks, thumbnailIds: thumbnails.map(t => t.id), thumbnails });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch channel" });
      console.error(error);
    }
  });

  app.post("/api/channels", async (req, res) => {
    try {
      const { hookIds, thumbnailIds, ...channelData } = req.body;
      const validatedData = insertChannelSchema.parse(channelData);
      const channel = await storage.createChannel(validatedData);
      // Add hooks
      if (Array.isArray(hookIds)) {
        for (const hookId of hookIds) {
          await storage.addHookToChannel(channel.id, hookId);
        }
      }
      // Add thumbnails
      if (Array.isArray(thumbnailIds)) {
        for (const thumbnailId of thumbnailIds) {
          await storage.addThumbnailToChannel(channel.id, thumbnailId);
        }
      }
      // Fetch hooks and thumbnails for response
      const hooks = await storage.getChannelHooks(channel.id);
      const thumbnails = await storage.getChannelThumbnails(channel.id);
      // Log channel creation
      await storage.createJobLog({
        type: 'channel',
        entityId: channel.id,
        status: 'success',
        message: `Channel "${channel.name}" created successfully`
      });
      res.status(201).json({ ...channel, hookIds: hooks.map(h => h.id), hooks, thumbnailIds: thumbnails.map(t => t.id), thumbnails });
    } catch (error) {
      res.status(400).json({ message: (error as Error).message || "Failed to create channel" });
      console.error(error);
    }
  });

  app.put("/api/channels/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { hookIds, thumbnailIds, ...channelData } = req.body;
      const validatedData = insertChannelSchema.partial().parse(channelData);
      const channel = await storage.updateChannel(id, validatedData);
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }
      // Update hooks
      if (Array.isArray(hookIds)) {
        // Remove all existing hooks first
        const existingHooks = await storage.getChannelHooks(id);
        for (const hook of existingHooks) {
          await storage.removeHookFromChannel(id, hook.id);
        }
        // Add new hooks
        for (const hookId of hookIds) {
          await storage.addHookToChannel(id, hookId);
        }
      }
      // Update thumbnails
      if (Array.isArray(thumbnailIds)) {
        // Remove all existing thumbnails first
        const existingThumbnails = await storage.getChannelThumbnails(id);
        for (const thumbnail of existingThumbnails) {
          await storage.removeThumbnailFromChannel(id, thumbnail.id);
        }
        // Add new thumbnails
        for (const thumbnailId of thumbnailIds) {
          await storage.addThumbnailToChannel(id, thumbnailId);
        }
      }
      // Fetch hooks and thumbnails for response
      const hooks = await storage.getChannelHooks(id);
      const thumbnails = await storage.getChannelThumbnails(id);
      // Log channel update
      await storage.createJobLog({
        type: 'channel',
        entityId: channel.id,
        status: 'success',
        message: `Channel "${channel.name}" updated successfully`
      });
      res.json({ ...channel, hookIds: hooks.map(h => h.id), hooks, thumbnailIds: thumbnails.map(t => t.id), thumbnails });
    } catch (error) {
      res.status(400).json({ message: (error as Error).message || "Failed to update channel" });
    }
  });

  app.delete("/api/channels/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const channel = await storage.getChannel(id);
      
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }
      
      // Get related data counts for logging
      const channelVideos = await storage.getVideos(id);
      const videoCount = channelVideos.length;
      
      const deleted = await storage.deleteChannel(id);
      
      if (deleted) {
        // Log channel deletion with details about what was deleted
        await storage.createJobLog({
          type: 'channel',
          entityId: id,
          status: 'success',
          message: `Channel "${channel.name}" and ${videoCount} associated videos deleted successfully`,
          details: {
            channelName: channel.name,
            videosDeleted: videoCount,
            channelId: id
          }
        });
        
        res.status(204).send();
      } else {
        res.status(500).json({ message: "Failed to delete channel" });
      }
    } catch (error) {
      console.error('Channel deletion error:', error);
      res.status(500).json({ 
        message: "Failed to delete channel and related data",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // File upload routes
  app.post("/api/upload/logo", upload.single('logo'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const filename = `logo_${Date.now()}_${req.file.originalname}`;
      const filepath = path.join('uploads', filename);
      
      await fs.rename(req.file.path, filepath);
      
      res.json({ url: `/uploads/${filename}` });
    } catch (error) {
      res.status(500).json({ message: "Failed to upload logo" });
    }
  });

  app.post("/api/upload/watermark", upload.single('watermark'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const filename = `watermark_${Date.now()}_${req.file.originalname}`;
      const filepath = path.join('uploads', filename);
      
      await fs.rename(req.file.path, filepath);
      
      res.json({ url: `/uploads/${filename}` });
    } catch (error) {
      res.status(500).json({ message: "Failed to upload watermark" });
    }
  });

  app.post("/api/upload/video", uploadVideo.single('video'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const filename = `video_${Date.now()}_${req.file.originalname}`;
      const filepath = path.join('uploads', 'video', filename);

      await fs.rename(req.file.path, filepath);
      const duration = await getVideoDuration(filepath);

      res.json({
        url: `/uploads/video/${filename}`,
        duration,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to upload video" });
    }
  });

  // Video template routes
  app.get("/api/video-templates", async (req, res) => {
    try {
      const templates = await storage.getVideoTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch video templates" });
    }
  });

  app.get("/api/video-templates/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const template = await storage.getVideoTemplate(id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch template" });
    }
  });

  app.post("/api/video-templates", async (req, res) => {
    try {
      const validatedData = insertVideoTemplateSchema.parse(req.body);
      const template = await storage.createVideoTemplate(validatedData);
      
      await storage.createJobLog({
        type: 'template',
        entityId: template.id,
        status: 'success',
        message: `Video template "${template.name}" created successfully`
      });
      
      res.status(201).json(template);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message || "Failed to create template" });
    }
  });

  app.put("/api/video-templates/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertVideoTemplateSchema.partial().parse(req.body);
      const template = await storage.updateVideoTemplate(id, validatedData);
      
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      res.json(template);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message || "Failed to update template" });
    }
  });

  app.delete("/api/video-templates/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteVideoTemplate(id);
      
      if (deleted) {
        res.status(204).send();
      } else {
        res.status(404).json({ message: "Template not found" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  // Thumbnail template routes
  app.get("/api/thumbnail-templates", async (req, res) => {
    try {
      const templates = await storage.getThumbnailTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch thumbnail templates" });
    }
  });

  app.post("/api/thumbnail-templates", async (req, res) => {
    try {
      const validatedData = insertThumbnailTemplateSchema.parse(req.body);
      const template = await storage.createThumbnailTemplate(validatedData);
      res.status(201).json(template);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message || "Failed to create thumbnail template" });
    }
  });

  // Hook template routes
  app.get("/api/hook-templates", async (req, res) => {
    try {
      const templates = await storage.getHookTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch hook templates" });
    }
  });

  app.post("/api/hook-templates", async (req, res) => {
    try {
      const validatedData = insertHookTemplateSchema.parse(req.body);
      const template = await storage.createHookTemplate(validatedData);
      res.status(201).json(template);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message || "Failed to create hook template" });
    }
  });

  app.get("/api/hook-templates/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const template = await storage.getHookTemplate(id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message || "Failed to fetch hook template" });
    }
  });

  app.put("/api/hook-templates/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertHookTemplateSchema.partial().parse(req.body);
      const template = await storage.updateHookTemplate(id, validatedData);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message || "Failed to update hook template" });
    }
  });

  app.delete("/api/hook-templates/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteHookTemplate(id);
      if (deleted) {
        res.status(204).send();
      } else {
        res.status(404).json({ message: "Template not found" });
      }
    } catch (error) {
      res.status(500).json({ message: (error as Error).message || "Failed to delete hook template" });
    }
  });

  // Video routes
  app.get("/api/videos", async (req, res) => {
    try {
      const videos = await storage.getVideos();
      res.json(videos);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch videos" });
    }
  });

  app.get("/api/videos/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const video = await storage.getVideo(id);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      res.json(video);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch video" });
    }
  });

  app.post("/api/videos/test/:channelId", async (req, res) => {
    try {
      const channelId = parseInt(req.params.channelId);
      const channel = await storage.getChannel(channelId);
      
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }

      const templates = await storage.getVideoTemplates();
      if (!templates.length) {
        return res.status(404).json({ message: "Templates not found" });
      }

      // Create test video entry
      const testVideo = await storage.createVideo({
        channelId,
        templateId: templates[0].id, // Default to first template for now
        title: "Test Video - " + new Date().toISOString(),
        description: "Test video generated locally",
        status: "generating"
      });
      
      // Log test video creation
      await storage.createJobLog({
        type: 'video',
        entityId: testVideo.id,
        status: 'info',
        message: `Test video generation started for channel "${channel.name}"`
      });
      
      res.json({ message: "Test video generation started", videoId: testVideo.id });
    } catch (error) {
      res.status(500).json({ message: `Failed to create test video: ${(error as Error).message}` });
    }
  });

  // Job logs routes
  app.get("/api/logs", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await storage.getJobLogs(limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch logs" });
    }
  });

  // File upload endpoint
  app.post("/api/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileExtension = path.extname(req.file.originalname);
      const newFilename = `${Date.now()}-${Math.random().toString(36).substring(7)}${fileExtension}`;
      const newPath = path.join('uploads', newFilename);
      
      // Move file to final location
      await fs.rename(req.file.path, newPath);
      
      const fileUrl = `/uploads/${newFilename}`;
      
      res.json({
        success: true,
        url: fileUrl,
        filename: newFilename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  // Video generation endpoint
  app.post("/api/generate-video", async (req, res) => {
    try {
      const { channelId, templateId, testMode = false } = req.body;
      
      if (!channelId || !templateId) {
        return res.status(400).json({ message: "Channel ID and Template ID are required" });
      }

      // Enhanced validation
      const { validationService } = await import("./services/validation");
      const validationResult = await validationService.validateVideoGenerationInput(
        channelId,
        templateId,
        testMode
      );

      if (!validationResult.isValid) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          suggestions: validationResult.suggestions
        });
      }

      const channel = await storage.getChannel(channelId);
      const template = await storage.getVideoTemplate(templateId);
      
      if (!channel || !template) {
        return res.status(404).json({ message: "Channel or template not found" });
      }

      // Create video record
      const video = await storage.createVideo({
        channelId,
        templateId: template.id,
        title: "Generating...",
        status: "generating",
      });

      // Import and start video generation workflow
      const { videoWorkflowService } = await import("./services/video-workflow");
      
      // Start generation in background
      setImmediate(async () => {
        try {
          await videoWorkflowService.generateVideo(video.id, channelId, template, testMode);
        } catch (err) {
          console.error('Video generation error:', err);
          throw err;
        }
      });

      res.json({
        success: true,
        videoId: video.id,
        message: testMode ? "Test video generation started" : "Video queued for generation",
        warnings: validationResult.warnings,
        suggestions: validationResult.suggestions
      });
    } catch (error) {
      const e = error as Error;
      console.error('Generate video error:', e);
      res.status(500).json({message: `Failed to start video generation: ${e.message || "Unknown error"}` });
    }
  });

  // Video progress endpoint
  app.get("/api/videos/:id/progress", async (req, res) => {
    try {
      const videoId = parseInt(req.params.id);
      const video = await storage.getVideo(videoId);
      
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }

      // Get latest logs for this video
      const logs = await storage.getJobLogs(10);
      const videoLogs = logs.filter(log => log.type === "video" && log.entityId === videoId);
      const latestLog = videoLogs[0];

      if (!latestLog) {
        return res.json({
          stage: "unknown",
          progress: 0,
          message: "No progress information available"
        });
      }

      const details = latestLog.details as ({ [key: string]: string } | undefined);

      res.json({
        stage: details?.stage || "unknown",
        progress: details?.progress || 0,
        message: latestLog.message,
        status: video.status,
        error: video.errorMessage
      });
    } catch (error) {
      console.error('Progress error:', error);
      res.status(500).json({ message: "Failed to fetch progress" });
    }
  });

  // Video download endpoint
  app.get("/api/videos/:id/download", async (req, res) => {
    try {
      const videoId = parseInt(req.params.id);
      const video = await storage.getVideo(videoId);
      
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }

      if (!video.videoUrl) {
        return res.status(404).json({ message: "Video file not found" });
      }

      const videoPath = path.resolve(video.videoUrl);
      
      // Check if file exists
      if (!fsSync.existsSync(videoPath)) {
        return res.status(404).json({ message: "Video file not found on disk" });
      }

      // Set headers for file download
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="${video.title || `video_${videoId}`}.mp4"`);
      
      // Stream the file
      const fileStream = fsSync.createReadStream(videoPath);
      fileStream.pipe(res);
    } catch (error) {
      console.error('Video download error:', error);
      res.status(500).json({ message: "Failed to download video" });
    }
  });

  // Video preview endpoint
  app.get("/api/videos/:id/preview", async (req, res) => {
    try {
      const videoId = parseInt(req.params.id);
      const video = await storage.getVideo(videoId);
      
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }

      if (!video.videoUrl) {
        return res.status(404).json({ message: "Video file not found" });
      }

      const videoPath = path.resolve(video.videoUrl);
      
      // Check if file exists
      if (!fsSync.existsSync(videoPath)) {
        return res.status(404).json({ message: "Video file not found on disk" });
      }

      // Get file stats
      const stats = fsSync.statSync(videoPath);
      const fileSize = stats.size;
      const range = req.headers.range;

      if (range) {
        // Handle range requests for video streaming
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'video/mp4',
        });

        const stream = fsSync.createReadStream(videoPath, { start, end });
        stream.pipe(res);
      } else {
        // Full file request
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
        });

        const stream = fsSync.createReadStream(videoPath);
        stream.pipe(res);
      }
    } catch (error) {
      console.error('Video preview error:', error);
      res.status(500).json({ message: "Failed to preview video" });
    }
  });

  // Testing endpoints
  app.post("/api/tests/run", async (req, res) => {
    try {
      const { testSuite } = req.body;
      const { testingService } = await import("./services/testing");
      
      let results;
      if (testSuite) {
        results = await testingService.runTestSuite(testSuite);
      } else {
        results = await testingService.runAllTests();
      }
      
      res.json({
        success: true,
        results,
        summary: {
          total: results.length,
          passed: results.filter(r => r.passed).length,
          failed: results.filter(r => !r.passed).length,
          successRate: (results.filter(r => r.passed).length / results.length) * 100
        }
      });
    } catch (error) {
      const e = error as Error;
      console.error('Test execution error:', e);
      res.status(500).json({ message: `Failed to run tests: ${e.message}` });
    }
  });

  app.get("/api/tests/statistics", async (req, res) => {
    try {
      const { testingService } = await import("./services/testing");
      const stats = await testingService.getTestStatistics();
      res.json(stats);
    } catch (error) {
      const e = error as Error;
      console.error('Test statistics error:', e);
      res.status(500).json({ message: `Failed to get test statistics: ${e.message}` });
    }
  });

  // Validation endpoints
  app.post("/api/validate/template", async (req, res) => {
    try {
      const { templateId } = req.body;
      const { validationService } = await import("./services/validation");
      
      const template = await storage.getVideoTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      const validationResult = await validationService.validateVideoGenerationInput(
        1, // dummy channel ID
        templateId,
        true // test mode
      );

      res.json({
        success: true,
        validation: validationResult
      });
    } catch (error) {
      const e = error as Error;
      console.error('Template validation error:', e);
      res.status(500).json({ message: `Failed to validate template: ${e.message}` });
    }
  });

  // Error statistics endpoint
  app.get("/api/errors/statistics", async (req, res) => {
    try {
      const { errorHandlerService } = await import("./services/error-handler");
      const stats = await errorHandlerService.getErrorStatistics();
      res.json(stats);
    } catch (error) {
      const e = error as Error;
      console.error('Error statistics error:', e);
      res.status(500).json({ message: `Failed to get error statistics: ${e.message}` });
    }
  });

  // Settings endpoints
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.listSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.get("/api/settings/:key", async (req, res) => {
    try {
      const setting = await storage.getSetting(req.params.key);
      if (!setting) return res.status(404).json({ message: "Setting not found" });
      res.json(setting);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch setting" });
    }
  });

  app.post("/api/settings/:key", async (req, res) => {
    try {
      const { value, jsonValue } = req.body;
      const setting = await storage.setSetting(req.params.key, value ?? null, jsonValue);
      res.status(201).json(setting);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message || "Failed to set setting" });
    }
  });

  app.delete("/api/settings/:key", async (req, res) => {
    try {
      // For simplicity, just set value and jsonValue to null
      const setting = await storage.setSetting(req.params.key, null, null);
      res.status(204).json(setting);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message || "Failed to delete setting" });
    }
  });

  // Serve uploaded files
  app.use('/uploads', express.static('uploads'));

  // Scheduler routes
  app.post("/api/scheduler/start", async (req, res) => {
    try {
      const { schedulerService } = await import("./services/scheduler");
      await schedulerService.start();
      res.json({ message: "Scheduler started successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to start scheduler" });
    }
  });

  app.post("/api/scheduler/stop", async (req, res) => {
    try {
      const { schedulerService } = await import("./services/scheduler");
      await schedulerService.stop();
      res.json({ message: "Scheduler stopped successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to stop scheduler" });
    }
  });

  app.get("/api/scheduler/jobs", async (req, res) => {
    try {
      const { schedulerService } = await import("./services/scheduler");
      const jobs = await schedulerService.getScheduledJobs();
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch scheduled jobs" });
    }
  });

  app.post("/api/scheduler/schedule/:channelId", async (req, res) => {
    try {
      const channelId = parseInt(req.params.channelId);
      const channel = await storage.getChannel(channelId);
      
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }

      const { schedulerService } = await import("./services/scheduler");
      await schedulerService.scheduleChannelVideos(channel);
      
      res.json({ message: "Channel videos scheduled successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to schedule channel videos" });
    }
  });

  app.delete("/api/scheduler/jobs/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      const { schedulerService } = await import("./services/scheduler");
      const cancelled = await schedulerService.cancelJob(jobId);
      
      if (cancelled) {
        res.json({ message: "Job cancelled successfully" });
      } else {
        res.status(404).json({ message: "Job not found" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to cancel job" });
    }
  });

  // Analytics routes
  app.get("/api/analytics", async (req, res) => {
    try {
      const channels = await storage.getChannels();
      const videos = await storage.getVideos();
      const logs = await storage.getJobLogs(100);
      
      const totalVideos = videos.length;
      const publishedVideos = videos.filter(v => v.status === 'published').length;
      const errorVideos = videos.filter(v => v.status === 'error').length;
      const successRate = totalVideos > 0 ? ((publishedVideos / totalVideos) * 100) : 0;
      
      // Mock analytics data for now
      const analytics = {
        totalVideos,
        totalViews: 15420, // Mock data
        totalLikes: 892, // Mock data
        totalComments: 156, // Mock data
        videosThisWeek: 7, // Mock data
        averageDuration: 180, // Mock data
        successRate: Math.round(successRate * 10) / 10,
        channelStats: channels.map(channel => ({
          name: channel.name,
          videos: videos.filter(v => v.channelId === channel.id).length,
          views: Math.floor(Math.random() * 10000) + 1000 // Mock data
        })),
        statusDistribution: [
          { status: "Published", count: publishedVideos },
          { status: "Generating", count: videos.filter(v => v.status === 'generating').length },
          { status: "Error", count: errorVideos }
        ],
        weeklyProgress: [
          { date: "Mon", videos: 2, views: 1200 },
          { date: "Tue", videos: 1, views: 800 },
          { date: "Wed", videos: 3, views: 2100 },
          { date: "Thu", videos: 2, views: 1500 },
          { date: "Fri", videos: 1, views: 900 },
          { date: "Sat", videos: 0, views: 600 },
          { date: "Sun", videos: 1, views: 1100 }
        ]
      };
      
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  app.post("/api/videos/:id/schedule", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { scheduledAt } = req.body;
      if (!scheduledAt) {
        return res.status(400).json({ message: "scheduledAt is required" });
      }
      const video = await storage.updateVideo(id, { scheduledAt: new Date(scheduledAt) });
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      res.json(video);
    } catch (error) {
      res.status(500).json({ message: "Failed to schedule video" });
    }
  });

  app.get("/api/elevenlabs-voices", async (req, res) => {
    try {
      const voices = await elevenLabsService.getAvailableVoices();
      res.json(voices);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch ElevenLabs voices" });
    }
  });

  // Preview the image
  app.get("/api/thumbnails/:id", async (req, res) => {
    try {
      const thumbnailId = parseInt(req.params.id);
      const thumbnailPath = path.resolve('thumbnails', `thumbnail_${thumbnailId}.jpg`);

      // Check if file exists
      if (!fsSync.existsSync(thumbnailPath)) {
        return res.status(404).json({ message: "Thumbnail file not found on disk" });
      }

      // Set headers for image preview
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Disposition', `inline; filename="thumbnail_${thumbnailId}.jpg"`);

      // Stream the file
      const fileStream = fsSync.createReadStream(thumbnailPath);
      fileStream.pipe(res);
    } catch (error) {
      console.error('Video download error:', error);
      res.status(500).json({ message: "Failed to download video" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
