import { storage } from "../storage";
import { videoWorkflowService } from "./video-workflow";
import type { Channel, VideoTemplate } from "@shared/schema";

export interface ScheduledJob {
  id: string;
  channelId: number;
  templateId: number;
  scheduledAt: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  retryCount: number;
  maxRetries: number;
}

export class SchedulerService {
  private jobs: Map<string, ScheduledJob> = new Map();
  private isRunning = false;
  private interval: NodeJS.Timeout | null = null;

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('Scheduler started');
    
    // Check for jobs every minute
    this.interval = setInterval(async () => {
      await this.processScheduledJobs();
    }, 60000);
    
    // Initial job processing
    await this.processScheduledJobs();
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    console.log('Scheduler stopped');
  }

  async scheduleChannelVideos(channel: Channel): Promise<void> {
    if (!channel.isActive || channel.status !== 'active') {
      return;
    }

    const templates = await storage.getVideoTemplates();
    if (!templates.length) {
      console.log(`No templates available for channel ${channel.name}`);
      return;
    }

    const videoCount = this.getVideoCount(channel);
    const nextScheduleTime = this.getNextScheduleTime(channel);

    for (let i = 0; i < videoCount; i++) {
      const template = templates[i % templates.length];
      const jobId = `channel_${channel.id}_${Date.now()}_${i}`;
      
      const job: ScheduledJob = {
        id: jobId,
        channelId: channel.id,
        templateId: template.id,
        scheduledAt: new Date(nextScheduleTime.getTime() + (i * 30 * 60 * 1000)), // 30 min apart
        status: 'pending',
        retryCount: 0,
        maxRetries: 3
      };

      this.jobs.set(jobId, job);
      
      await storage.createJobLog({
        type: 'scheduler',
        entityId: channel.id,
        status: 'info',
        message: `Scheduled ${videoCount} videos for channel "${channel.name}"`,
        details: {
          channelId: channel.id,
          templateId: template.id,
          scheduledAt: job.scheduledAt,
          jobId
        }
      });
    }
  }

  private async processScheduledJobs(): Promise<void> {
    const now = new Date();
    const pendingJobs = Array.from(this.jobs.values())
      .filter(job => job.status === 'pending' && job.scheduledAt <= now);

    for (const job of pendingJobs) {
      await this.executeJob(job);
    }
  }

  private async executeJob(job: ScheduledJob): Promise<void> {
    try {
      job.status = 'running';
      
      const channel = await storage.getChannel(job.channelId);
      const template = await storage.getVideoTemplate(job.templateId);
      
      if (!channel || !template) {
        throw new Error('Channel or template not found');
      }

      await storage.createJobLog({
        type: 'scheduler',
        entityId: job.channelId,
        status: 'info',
        message: `Starting scheduled video generation for channel "${channel.name}"`,
        details: { jobId: job.id, templateId: job.templateId }
      });

      // Create video record
      const video = await storage.createVideo({
        channelId: job.channelId,
        templateId: template.id,
        title: "Generating...",
        status: "generating",
      });

      // Generate video
      await videoWorkflowService.generateVideo(video.id, job.channelId, template, false);
      
      job.status = 'completed';
      
      // Update channel's last video generated time
      await storage.updateChannel(job.channelId, {
        lastVideoGenerated: new Date()
      });

      await storage.createJobLog({
        type: 'scheduler',
        entityId: job.channelId,
        status: 'success',
        message: `Successfully generated scheduled video for channel "${channel.name}"`,
        details: { jobId: job.id }
      });

    } catch (error) {
      job.status = 'failed';
      job.retryCount++;
      
      await storage.createJobLog({
        type: 'scheduler',
        entityId: job.channelId,
        status: 'error',
        message: `Failed to generate scheduled video: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { 
          jobId: job.id, 
          retryCount: job.retryCount,
          error: error instanceof Error ? error.stack : error
        }
      });

      // Retry if under max retries
      if (job.retryCount < job.maxRetries) {
        job.status = 'pending';
        job.scheduledAt = new Date(Date.now() + (5 * 60 * 1000)); // Retry in 5 minutes
      }
    }
  }

  private getVideoCount(channel: Channel): number {
    const min = channel.videosMin || 1;
    const max = channel.videosMax || 2;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private getNextScheduleTime(channel: Channel): Date {
    const now = new Date();
    
    switch (channel.schedule) {
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'custom':
        // For custom, we'll use a default of daily
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  async getScheduledJobs(): Promise<ScheduledJob[]> {
    return Array.from(this.jobs.values());
  }

  async getChannelJobs(channelId: number): Promise<ScheduledJob[]> {
    return Array.from(this.jobs.values())
      .filter(job => job.channelId === channelId);
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    
    job.status = 'failed';
    this.jobs.delete(jobId);
    
    await storage.createJobLog({
      type: 'scheduler',
      entityId: job.channelId,
      status: 'info',
      message: `Cancelled scheduled job ${jobId}`,
      details: { jobId }
    });
    
    return true;
  }
}

export const schedulerService = new SchedulerService(); 