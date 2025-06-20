import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertChannelSchema, insertVideoTemplateSchema, insertThumbnailTemplateSchema, insertHookTemplateSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs/promises";

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
    }
  });

  // Channel routes
  app.get("/api/channels", async (req, res) => {
    try {
      const channels = await storage.getChannels();
      res.json(channels);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch channels" });
    }
  });

  app.get("/api/channels/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const channel = await storage.getChannel(id);
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }
      res.json(channel);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch channel" });
    }
  });

  app.post("/api/channels", async (req, res) => {
    try {
      const validatedData = insertChannelSchema.parse(req.body);
      const channel = await storage.createChannel(validatedData);
      
      // Log channel creation
      await storage.createJobLog({
        type: 'channel',
        entityId: channel.id,
        status: 'success',
        message: `Channel "${channel.name}" created successfully`
      });
      
      res.status(201).json(channel);
    } catch (error) {
      res.status(400).json({ message: error.message || "Failed to create channel" });
    }
  });

  app.put("/api/channels/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertChannelSchema.partial().parse(req.body);
      const channel = await storage.updateChannel(id, validatedData);
      
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }
      
      // Log channel update
      await storage.createJobLog({
        type: 'channel',
        entityId: channel.id,
        status: 'success',
        message: `Channel "${channel.name}" updated successfully`
      });
      
      res.json(channel);
    } catch (error) {
      res.status(400).json({ message: error.message || "Failed to update channel" });
    }
  });

  app.delete("/api/channels/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const channel = await storage.getChannel(id);
      
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }
      
      const deleted = await storage.deleteChannel(id);
      
      if (deleted) {
        // Log channel deletion
        await storage.createJobLog({
          type: 'channel',
          entityId: id,
          status: 'success',
          message: `Channel "${channel.name}" deleted successfully`
        });
        
        res.status(204).send();
      } else {
        res.status(500).json({ message: "Failed to delete channel" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to delete channel" });
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
      res.status(400).json({ message: error.message || "Failed to create template" });
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
      res.status(400).json({ message: error.message || "Failed to update template" });
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
      res.status(400).json({ message: error.message || "Failed to create thumbnail template" });
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
      res.status(400).json({ message: error.message || "Failed to create hook template" });
    }
  });

  // Video routes
  app.get("/api/videos", async (req, res) => {
    try {
      const channelId = req.query.channelId ? parseInt(req.query.channelId as string) : undefined;
      const videos = await storage.getVideos(channelId);
      res.json(videos);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch videos" });
    }
  });

  app.post("/api/videos/test/:channelId", async (req, res) => {
    try {
      const channelId = parseInt(req.params.channelId);
      const channel = await storage.getChannel(channelId);
      
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }
      
      // Create test video entry
      const testVideo = await storage.createVideo({
        channelId,
        templateId: 1, // Default to first template for now
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
      res.status(500).json({ message: "Failed to create test video" });
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

      const channel = await storage.getChannel(channelId);
      const template = await storage.getVideoTemplate(templateId);
      
      if (!channel || !template) {
        return res.status(404).json({ message: "Channel or template not found" });
      }

      // Import and start video generation workflow
      const { videoWorkflowService } = await import("./services/video-workflow");
      
      // Start generation in background
      const video = await videoWorkflowService.generateVideo(channelId, templateId, testMode);

      res.json({
        success: true,
        videoId: video.id,
        message: testMode ? "Test video generation started" : "Video queued for generation"
      });
    } catch (error) {
      console.error('Generate video error:', error);
      res.status(500).json({ message: "Failed to start video generation" });
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

      res.json({
        stage: latestLog.details?.stage || "unknown",
        progress: latestLog.details?.progress || 0,
        message: latestLog.message,
        status: video.status,
        error: video.errorMessage
      });
    } catch (error) {
      console.error('Progress error:', error);
      res.status(500).json({ message: "Failed to fetch progress" });
    }
  });

  // Serve uploaded files
  app.use('/uploads', express.static('uploads'));

  const httpServer = createServer(app);
  return httpServer;
}
