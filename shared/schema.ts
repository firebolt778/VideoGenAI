import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export type PromptModel = {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  effort?: string;
}

export const defaultPromptModel: PromptModel = {
  model: "gpt-5",
  effort: "low",
}

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url"),
  description: text("description"),
  logoUrl: text("logo_url"),
  watermarkUrl: text("watermark_url"),
  watermarkPosition: text("watermark_position").default("bottom-right"),
  watermarkOpacity: integer("watermark_opacity").default(80),
  watermarkSize: integer("watermark_size").default(15),
  schedule: text("schedule").default("daily"), // daily, weekly, custom
  videosMin: integer("videos_min").default(1),
  videosMax: integer("videos_max").default(2),
  chapterIndicators: boolean("chapter_indicators").default(false),
  // --- Chapter Marker Style Fields ---
  chapterMarkerBgColor: text("chapter_marker_bg_color").default("#000000"), // default black
  chapterMarkerFontColor: text("chapter_marker_font_color").default("#FFFFFF"), // default white
  chapterMarkerFont: text("chapter_marker_font").default("Arial"), // default Arial
  // --- Title Style Fields ---
  titleFont: text("title_font").default("Arial"),
  titleColor: text("title_color").default("#FFFFFF"),
  titleBgColor: text("title_bg_color").default("#000000"),
  // --- End Title Style Fields ---
  videoIntro: boolean("video_intro").default(false),
  videoIntroUrl: text("video_intro_url"),
  introDissolveTime: integer("intro_dissolve_time").default(1), // seconds
  introDuration: integer("intro_duration").default(5), // seconds
  videoOutro: boolean("video_outro").default(false),
  videoOutroUrl: text("video_outro_url"),
  outroDissolveTime: integer("outro_dissolve_time").default(1), // seconds
  outroDuration: integer("outro_duration").default(5), // seconds
  videoDescriptionPrompt: text("video_description_prompt"),
  status: text("status").default("inactive"), // active, inactive, processing, error
  currentTask: text("current_task"),
  isActive: boolean("is_active").default(true),
  lastVideoGenerated: timestamp("last_video_generated"),
  youtubeChannelId: text("youtube_channel_id"),
  youtubeAccessToken: text("youtube_access_token"),
  youtubeRefreshToken: text("youtube_refresh_token"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const videoTemplates = pgTable("video_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").default("story"), // story, news, educational, etc.
  ideasList: text("ideas_list"),
  ideasDelimiter: text("ideas_delimiter").default("---"),
  storyOutlinePrompt: text("story_outline_prompt"),
  outlinePromptModel: jsonb("outline_prompt_model").$type<PromptModel>().default(defaultPromptModel),
  fullScriptPrompt: text("full_script_prompt"),
  scriptPromptModel: jsonb("script_prompt_model").$type<PromptModel>().default(defaultPromptModel),
  videoLength: integer("video_length"),
  imageCount: integer("image_count").default(8),
  imageCountRange: jsonb("image_count_range").$type<{ min: number; max: number }>().default({ min: 3, max: 6 }),
  imageModel: text("image_model").default("flux-schnell"),
  imageFallbackModel: text("image_fallback_model").default("dalle-3"),
  imageSettings: jsonb("image_settings"),
  heroImageModel: text("hero_image_model").default("flux-pro"),
  heroImageEnabled: boolean("hero_image_enabled").default(false),
  // --- New workflow properties ---
  visualStylePrompt: text("visual_style_prompt"),
  visualStyleModel: jsonb("visual_style_model").$type<PromptModel>().default(defaultPromptModel),
  chapterContentPrompt: text("chapter_content_prompt"),
  chapterContentModel: jsonb("chapter_content_model").$type<PromptModel>().default(defaultPromptModel),
  chapterImagePrompt: text("chapter_image_prompt"),
  chapterImageModel: jsonb("chapter_image_model").$type<PromptModel>().default(defaultPromptModel),
  chapterImageFallbackModel: jsonb("chapter_image_fallback_model").$type<PromptModel>().default({ ...defaultPromptModel, model: "gpt-5-mini" }),
  audioModel: text("audio_model").default("eleven_labs"),
  audioVoices: text("audio_voices").array(),
  audioPauseGap: integer("audio_pause_gap").default(500), // milliseconds
  backgroundMusicPrompt: text("background_music_prompt"),
  musicStyle: text("music_style").default("Ambient"),
  musicMood: text("music_mood").default("Calm"),
  musicVolume: integer("music_volume").default(30),
  videoEffects: jsonb("video_effects").$type<{
    kenBurns: boolean;
    kenBurnsSpeed: number;
    kenBurnsDirection: string;
    filmGrain: boolean;
    fog: boolean;
  }>(),
  captionsEnabled: boolean("captions_enabled").default(true),
  captionsFont: text("captions_font").default("Inter"),
  captionsColor: text("captions_color").default("#ffffff"),
  captionsPosition: text("captions_position").default("bottom"),
  wordPerCaption: integer("word_per_caption").default(6).notNull(),
  videoTransitions: text("video_transitions").default("mix-fade"),
  transitionDuration: integer("transition_duration").default(2),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const thumbnailTemplates = pgTable("thumbnail_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").default("ai-generated"), // first-image, last-image, random-image, ai-generated
  prompt: text("prompt"),
  model: text("model").default("gpt-4o"),
  fallbackModel: text("fallback_model").default("flux-schnell"),
  fallbackStrategy: text("fallback_strategy").default("first-image"), // first-image, last-image
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const hookTemplates = pgTable("hook_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  prompt: text("prompt").notNull(),
  promptModel: jsonb("prompt_model").$type<PromptModel>().default(defaultPromptModel),
  editSpeed: text("edit_speed").default("medium"), // slow, medium, fast
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const channelTemplates = pgTable("channel_templates", {
  channelId: integer("channel_id").references(() => channels.id).notNull(),
  templateId: integer("template_id").references(() => videoTemplates.id).notNull(),
});

export const channelThumbnails = pgTable("channel_thumbnails", {
  channelId: integer("channel_id").references(() => channels.id).notNull(),
  thumbnailId: integer("thumbnail_id").references(() => thumbnailTemplates.id).notNull(),
});

export const channelHooks = pgTable("channel_hooks", {
  channelId: integer("channel_id").references(() => channels.id).notNull(),
  hookId: integer("hook_id").references(() => hookTemplates.id).notNull(),
});

export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").references(() => channels.id).notNull(),
  templateId: integer("template_id").references(() => videoTemplates.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  script: text("script"),
  thumbnailUrl: text("thumbnail_url"),
  videoUrl: text("video_url"),
  youtubeId: text("youtube_id"),
  status: text("status").default("queued"), // queued, generating, rendering, uploading, published, error
  errorMessage: text("error_message"),
  duration: integer("duration"), // seconds
  scheduledAt: timestamp("scheduled_at"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const jobLogs = pgTable("job_logs", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // channel, video, template, etc.
  entityId: integer("entity_id"),
  status: text("status").notNull(), // success, error, warning, info
  message: text("message").notNull(),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const uploadedAssets = pgTable("uploaded_assets", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  filePath: text("file_path").notNull(),
  fileType: text("file_type").notNull(), // image, video, audio
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  description: text("description"),
  category: text("category"), // Horror, Comedy, etc.
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(), // e.g. 'openai_api_key', 'replicate_api_key', 'model_list'
  value: text("value"), // for string values like API keys
  jsonValue: jsonb("json_value"), // for storing lists or objects (e.g. model lists)
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const channelsRelations = relations(channels, ({ many }) => ({
  videos: many(videos),
  templates: many(channelTemplates),
  thumbnails: many(channelThumbnails),
  hooks: many(channelHooks),
}));

export const videoTemplatesRelations = relations(videoTemplates, ({ many }) => ({
  channels: many(channelTemplates),
  videos: many(videos),
}));

export const thumbnailTemplatesRelations = relations(thumbnailTemplates, ({ many }) => ({
  channels: many(channelThumbnails),
}));

export const channelHooksRelations = relations(channelHooks, ({ one }) => ({
  channel: one(channels, {
    fields: [channelHooks.channelId],
    references: [channels.id],
  }),
  hook: one(hookTemplates, {
    fields: [channelHooks.hookId],
    references: [hookTemplates.id],
  }),
}));

export const videosRelations = relations(videos, ({ one }) => ({
  channel: one(channels, {
    fields: [videos.channelId],
    references: [channels.id],
  }),
  template: one(videoTemplates, {
    fields: [videos.templateId],
    references: [videoTemplates.id],
  }),
}));

export const channelTemplatesRelations = relations(channelTemplates, ({ one }) => ({
  channel: one(channels, {
    fields: [channelTemplates.channelId],
    references: [channels.id],
  }),
  template: one(videoTemplates, {
    fields: [channelTemplates.templateId],
    references: [videoTemplates.id],
  }),
}));

export const channelThumbnailsRelations = relations(channelThumbnails, ({ one }) => ({
  channel: one(channels, {
    fields: [channelThumbnails.channelId],
    references: [channels.id],
  }),
  thumbnail: one(thumbnailTemplates, {
    fields: [channelThumbnails.thumbnailId],
    references: [thumbnailTemplates.id],
  }),
}));

// Insert schemas
export const insertChannelSchema = createInsertSchema(channels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVideoTemplateSchema = createInsertSchema(videoTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertThumbnailTemplateSchema = createInsertSchema(thumbnailTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHookTemplateSchema = createInsertSchema(hookTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVideoSchema = createInsertSchema(videos).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJobLogSchema = createInsertSchema(jobLogs).omit({
  id: true,
  createdAt: true,
});

export const insertUploadedAssetSchema = createInsertSchema(uploadedAssets).omit({
  id: true,
  createdAt: true,
});

export const insertSettingsSchema = createInsertSchema(settings);
export const updateSettingsSchema = insertSettingsSchema.partial();

// Types
export type Channel = typeof channels.$inferSelect;
export type InsertChannel = z.infer<typeof insertChannelSchema>;
export type VideoTemplate = typeof videoTemplates.$inferSelect;
export type InsertVideoTemplate = z.infer<typeof insertVideoTemplateSchema>;
export type ThumbnailTemplate = typeof thumbnailTemplates.$inferSelect;
export type InsertThumbnailTemplate = z.infer<typeof insertThumbnailTemplateSchema>;
export type HookTemplate = typeof hookTemplates.$inferSelect;
export type InsertHookTemplate = z.infer<typeof insertHookTemplateSchema>;
export type Video = typeof videos.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type JobLog = typeof jobLogs.$inferSelect;
export type InsertJobLog = z.infer<typeof insertJobLogSchema>;
export type UploadedAsset = typeof uploadedAssets.$inferSelect;
export type InsertUploadedAsset = z.infer<typeof insertUploadedAssetSchema>;
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingsSchema>;
