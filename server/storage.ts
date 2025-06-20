import { 
  channels, 
  videoTemplates, 
  thumbnailTemplates, 
  hookTemplates,
  videos,
  jobLogs,
  channelTemplates,
  channelThumbnails,
  type Channel, 
  type InsertChannel,
  type VideoTemplate,
  type InsertVideoTemplate,
  type ThumbnailTemplate,
  type InsertThumbnailTemplate,
  type HookTemplate,
  type InsertHookTemplate,
  type Video,
  type InsertVideo,
  type JobLog,
  type InsertJobLog
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Channels
  getChannels(): Promise<Channel[]>;
  getChannel(id: number): Promise<Channel | undefined>;
  createChannel(channel: InsertChannel): Promise<Channel>;
  updateChannel(id: number, channel: Partial<InsertChannel>): Promise<Channel | undefined>;
  deleteChannel(id: number): Promise<boolean>;
  
  // Video Templates
  getVideoTemplates(): Promise<VideoTemplate[]>;
  getVideoTemplate(id: number): Promise<VideoTemplate | undefined>;
  createVideoTemplate(template: InsertVideoTemplate): Promise<VideoTemplate>;
  updateVideoTemplate(id: number, template: Partial<InsertVideoTemplate>): Promise<VideoTemplate | undefined>;
  deleteVideoTemplate(id: number): Promise<boolean>;
  
  // Thumbnail Templates
  getThumbnailTemplates(): Promise<ThumbnailTemplate[]>;
  getThumbnailTemplate(id: number): Promise<ThumbnailTemplate | undefined>;
  createThumbnailTemplate(template: InsertThumbnailTemplate): Promise<ThumbnailTemplate>;
  updateThumbnailTemplate(id: number, template: Partial<InsertThumbnailTemplate>): Promise<ThumbnailTemplate | undefined>;
  deleteThumbnailTemplate(id: number): Promise<boolean>;
  
  // Hook Templates
  getHookTemplates(): Promise<HookTemplate[]>;
  getHookTemplate(id: number): Promise<HookTemplate | undefined>;
  createHookTemplate(template: InsertHookTemplate): Promise<HookTemplate>;
  updateHookTemplate(id: number, template: Partial<InsertHookTemplate>): Promise<HookTemplate | undefined>;
  deleteHookTemplate(id: number): Promise<boolean>;
  
  // Videos
  getVideos(channelId?: number): Promise<Video[]>;
  getVideo(id: number): Promise<Video | undefined>;
  createVideo(video: InsertVideo): Promise<Video>;
  updateVideo(id: number, video: Partial<InsertVideo>): Promise<Video | undefined>;
  deleteVideo(id: number): Promise<boolean>;
  
  // Job Logs
  getJobLogs(limit?: number): Promise<JobLog[]>;
  createJobLog(log: InsertJobLog): Promise<JobLog>;
  deleteOldLogs(daysOld: number): Promise<void>;
  
  // Channel associations
  addTemplateToChannel(channelId: number, templateId: number): Promise<void>;
  removeTemplateFromChannel(channelId: number, templateId: number): Promise<void>;
  addThumbnailToChannel(channelId: number, thumbnailId: number): Promise<void>;
  removeThumbnailFromChannel(channelId: number, thumbnailId: number): Promise<void>;
  getChannelTemplates(channelId: number): Promise<VideoTemplate[]>;
  getChannelThumbnails(channelId: number): Promise<ThumbnailTemplate[]>;
}

export class DatabaseStorage implements IStorage {
  // Channels
  async getChannels(): Promise<Channel[]> {
    return await db.select().from(channels).orderBy(desc(channels.createdAt));
  }

  async getChannel(id: number): Promise<Channel | undefined> {
    const [channel] = await db.select().from(channels).where(eq(channels.id, id));
    return channel || undefined;
  }

  async createChannel(channel: InsertChannel): Promise<Channel> {
    const [newChannel] = await db
      .insert(channels)
      .values({ ...channel, updatedAt: new Date() })
      .returning();
    return newChannel;
  }

  async updateChannel(id: number, channel: Partial<InsertChannel>): Promise<Channel | undefined> {
    const [updatedChannel] = await db
      .update(channels)
      .set({ ...channel, updatedAt: new Date() })
      .where(eq(channels.id, id))
      .returning();
    return updatedChannel || undefined;
  }

  async deleteChannel(id: number): Promise<boolean> {
    const result = await db.delete(channels).where(eq(channels.id, id));
    return result.rowCount > 0;
  }

  // Video Templates
  async getVideoTemplates(): Promise<VideoTemplate[]> {
    return await db.select().from(videoTemplates).orderBy(desc(videoTemplates.createdAt));
  }

  async getVideoTemplate(id: number): Promise<VideoTemplate | undefined> {
    const [template] = await db.select().from(videoTemplates).where(eq(videoTemplates.id, id));
    return template || undefined;
  }

  async createVideoTemplate(template: InsertVideoTemplate): Promise<VideoTemplate> {
    const [newTemplate] = await db
      .insert(videoTemplates)
      .values({ ...template, updatedAt: new Date() })
      .returning();
    return newTemplate;
  }

  async updateVideoTemplate(id: number, template: Partial<InsertVideoTemplate>): Promise<VideoTemplate | undefined> {
    const [updatedTemplate] = await db
      .update(videoTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(videoTemplates.id, id))
      .returning();
    return updatedTemplate || undefined;
  }

  async deleteVideoTemplate(id: number): Promise<boolean> {
    const result = await db.delete(videoTemplates).where(eq(videoTemplates.id, id));
    return result.rowCount > 0;
  }

  // Thumbnail Templates
  async getThumbnailTemplates(): Promise<ThumbnailTemplate[]> {
    return await db.select().from(thumbnailTemplates).orderBy(desc(thumbnailTemplates.createdAt));
  }

  async getThumbnailTemplate(id: number): Promise<ThumbnailTemplate | undefined> {
    const [template] = await db.select().from(thumbnailTemplates).where(eq(thumbnailTemplates.id, id));
    return template || undefined;
  }

  async createThumbnailTemplate(template: InsertThumbnailTemplate): Promise<ThumbnailTemplate> {
    const [newTemplate] = await db
      .insert(thumbnailTemplates)
      .values(template)
      .returning();
    return newTemplate;
  }

  async updateThumbnailTemplate(id: number, template: Partial<InsertThumbnailTemplate>): Promise<ThumbnailTemplate | undefined> {
    const [updatedTemplate] = await db
      .update(thumbnailTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(thumbnailTemplates.id, id))
      .returning();
    return updatedTemplate || undefined;
  }

  async deleteThumbnailTemplate(id: number): Promise<boolean> {
    const result = await db.delete(thumbnailTemplates).where(eq(thumbnailTemplates.id, id));
    return result.rowCount > 0;
  }

  // Hook Templates
  async getHookTemplates(): Promise<HookTemplate[]> {
    return await db.select().from(hookTemplates).orderBy(desc(hookTemplates.createdAt));
  }

  async getHookTemplate(id: number): Promise<HookTemplate | undefined> {
    const [template] = await db.select().from(hookTemplates).where(eq(hookTemplates.id, id));
    return template || undefined;
  }

  async createHookTemplate(template: InsertHookTemplate): Promise<HookTemplate> {
    const [newTemplate] = await db
      .insert(hookTemplates)
      .values(template)
      .returning();
    return newTemplate;
  }

  async updateHookTemplate(id: number, template: Partial<InsertHookTemplate>): Promise<HookTemplate | undefined> {
    const [updatedTemplate] = await db
      .update(hookTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(hookTemplates.id, id))
      .returning();
    return updatedTemplate || undefined;
  }

  async deleteHookTemplate(id: number): Promise<boolean> {
    const result = await db.delete(hookTemplates).where(eq(hookTemplates.id, id));
    return result.rowCount > 0;
  }

  // Videos
  async getVideos(channelId?: number): Promise<Video[]> {
    const query = db.select().from(videos);
    if (channelId) {
      return await query.where(eq(videos.channelId, channelId)).orderBy(desc(videos.createdAt));
    }
    return await query.orderBy(desc(videos.createdAt));
  }

  async getVideo(id: number): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    return video || undefined;
  }

  async createVideo(video: InsertVideo): Promise<Video> {
    const [newVideo] = await db
      .insert(videos)
      .values({ ...video, updatedAt: new Date() })
      .returning();
    return newVideo;
  }

  async updateVideo(id: number, video: Partial<InsertVideo>): Promise<Video | undefined> {
    const [updatedVideo] = await db
      .update(videos)
      .set({ ...video, updatedAt: new Date() })
      .where(eq(videos.id, id))
      .returning();
    return updatedVideo || undefined;
  }

  async deleteVideo(id: number): Promise<boolean> {
    const result = await db.delete(videos).where(eq(videos.id, id));
    return result.rowCount > 0;
  }

  // Job Logs
  async getJobLogs(limit: number = 100): Promise<JobLog[]> {
    return await db.select().from(jobLogs).orderBy(desc(jobLogs.createdAt)).limit(limit);
  }

  async createJobLog(log: InsertJobLog): Promise<JobLog> {
    const [newLog] = await db
      .insert(jobLogs)
      .values(log)
      .returning();
    return newLog;
  }

  async deleteOldLogs(daysOld: number): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    await db.delete(jobLogs).where(eq(jobLogs.createdAt, cutoffDate));
  }

  // Channel associations
  async addTemplateToChannel(channelId: number, templateId: number): Promise<void> {
    await db.insert(channelTemplates).values({ channelId, templateId });
  }

  async removeTemplateFromChannel(channelId: number, templateId: number): Promise<void> {
    await db.delete(channelTemplates)
      .where(eq(channelTemplates.channelId, channelId))
      .where(eq(channelTemplates.templateId, templateId));
  }

  async addThumbnailToChannel(channelId: number, thumbnailId: number): Promise<void> {
    await db.insert(channelThumbnails).values({ channelId, thumbnailId });
  }

  async removeThumbnailFromChannel(channelId: number, thumbnailId: number): Promise<void> {
    await db.delete(channelThumbnails)
      .where(eq(channelThumbnails.channelId, channelId))
      .where(eq(channelThumbnails.thumbnailId, thumbnailId));
  }

  async getChannelTemplates(channelId: number): Promise<VideoTemplate[]> {
    const result = await db
      .select()
      .from(videoTemplates)
      .innerJoin(channelTemplates, eq(videoTemplates.id, channelTemplates.templateId))
      .where(eq(channelTemplates.channelId, channelId));
    return result.map(r => r.video_templates);
  }

  async getChannelThumbnails(channelId: number): Promise<ThumbnailTemplate[]> {
    const result = await db
      .select()
      .from(thumbnailTemplates)
      .innerJoin(channelThumbnails, eq(thumbnailTemplates.id, channelThumbnails.thumbnailId))
      .where(eq(channelThumbnails.channelId, channelId));
    return result.map(r => r.thumbnail_templates);
  }
}

export const storage = new DatabaseStorage();
