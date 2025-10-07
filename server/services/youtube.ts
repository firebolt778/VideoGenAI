import { google, youtube_v3 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

export interface YouTubeVideoUpload {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  privacyStatus: 'private' | 'public' | 'unlisted';
  videoFilePath: string;
  thumbnailPath?: string;
  scheduledAt?: Date;
}

export interface YouTubeChannel {
  id: string;
  title: string;
  subscriberCount: string;
  viewCount: string;
  videoCount: string;
}

export interface YouTubeScheduleSettings {
  defaultPrivacy: 'private' | 'public' | 'unlisted';
  defaultCategory: string;
  defaultTags: string[];
  scheduleBuffer: number; // minutes before scheduled time
  autoPublish: boolean;
}

export class YouTubeService {
  private youtube: youtube_v3.Youtube | undefined;
  private oauth2Client: OAuth2Client | undefined;

  constructor() {}

  private async ensureClientInitialized() {
    if (this.youtube && this.oauth2Client) return;
    const { storage } = await import("../storage");
    const idSetting = await storage.getSetting("youtube_client_id");
    const secretSetting = await storage.getSetting("youtube_client_secret");
    const refreshSetting = await storage.getSetting("youtube_refresh_token");
    const redirectSetting = await storage.getSetting("youtube_redirect_uri");

    const clientId = (idSetting?.value || process.env.YOUTUBE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID_ENV_VAR || "").trim();
    const clientSecret = (secretSetting?.value || process.env.YOUTUBE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET_ENV_VAR || "").trim();
    const redirectUri = (redirectSetting?.value || process.env.YOUTUBE_REDIRECT_URI || process.env.YOUTUBE_REDIRECT_URI_ENV_VAR || "http://localhost:5000/callback").trim();
    const refreshToken = (refreshSetting?.value || process.env.YOUTUBE_REFRESH_TOKEN || "").trim();

    if (!clientId || !clientSecret) {
      throw new Error("YouTube client credentials are not configured. Set them in Settings or environment.");
    }

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    if (refreshToken) {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
    }

    this.youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });
  }

  private async getClients(): Promise<{ yt: youtube_v3.Youtube; oauth: OAuth2Client }> {
    await this.ensureClientInitialized();
    return { yt: this.youtube as youtube_v3.Youtube, oauth: this.oauth2Client as OAuth2Client };
  }

  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
    ];

    // Note: This method does not require DB values; will use default client if ensureClientInitialized not called yet.
    if (!this.oauth2Client) {
      // Fallback ephemeral client for URL generation using env vars
      const clientId = process.env.YOUTUBE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID_ENV_VAR || '';
      const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET_ENV_VAR || '';
      const redirectUri = process.env.YOUTUBE_REDIRECT_URI || process.env.YOUTUBE_REDIRECT_URI_ENV_VAR || 'http://localhost:5000/callback';
      this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    }
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // Ensures refresh token is sent every time
      scope: scopes,
    });
  }

  async setCredentials(code: string): Promise<void> {
    try {
      const { oauth } = await this.getClients();
      const { tokens } = await oauth.getToken(code);
      oauth.setCredentials(tokens);
    } catch (error) {
      throw new Error(`Failed to set YouTube credentials: ${(error as Error).message}`);
    }
  }

  async refreshAccessToken() {
    const { oauth } = await this.getClients();
    const tokenResponse = await oauth.getAccessToken();
    if (!tokenResponse.token) {
      throw new Error("Failed to refresh access token.");
    }
    oauth.setCredentials({
      refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
      access_token: tokenResponse.token,
    });
  }

  async uploadVideo(upload: YouTubeVideoUpload): Promise<string> {
    try {
      const { yt } = await this.getClients();
      const fs = await import('fs');

      const filePath = upload.videoFilePath;
      if (!fs.existsSync(filePath)) {
        throw new Error(`Video file not found: ${filePath}`);
      }
      const stream = fs.createReadStream(filePath);

      const requestParameters = {
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: upload.title,
            description: upload.description,
            tags: upload.tags,
            categoryId: upload.categoryId,
          },
          status: {
            privacyStatus: upload.scheduledAt ? 'private' : upload.privacyStatus,
            publishAt: upload.scheduledAt?.toISOString(),
          },
        },
        media: {
          body: stream,
        },
        uploadType: 'resumable',
      };

      const response = await yt.videos.insert(requestParameters);
      const videoId = response.data.id;

      // Upload thumbnail if provided
      // if (upload.thumbnailPath && videoId) {
      //   console.log("Uploading thumbnail for video ID:", videoId);
      //   await this.uploadThumbnail(videoId, upload.thumbnailPath);
      // }

      return videoId || "No Video ID returned from upload";
    } catch (error) {
      throw new Error(`Failed to upload video to YouTube: ${(error as Error).message}`);
    }
  }

  async uploadThumbnail(videoId: string, thumbnailPath: string): Promise<void> {
    try {
      const { yt } = await this.getClients();
      let path = thumbnailPath;
      if (!path) {
        throw new Error('Thumbnail path is required');
      }
      if (!thumbnailPath.startsWith('thumbnails/')) {
        path = `uploads/images/${thumbnailPath}`;
      }
      const fs = await import('fs');
      if (!fs.existsSync(path)) {
        throw new Error(`Thumbnail file not found: ${thumbnailPath}`);
      }
      
      await yt.thumbnails.set({
        videoId: videoId,
        media: {
          body: fs.createReadStream(path),
        },
      });
    } catch (error) {
      throw new Error(`Failed to upload thumbnail: ${(error as Error).message}`);
    }
  }

  // async getChannelInfo(channelId?: string): Promise<YouTubeChannel | null> {
  //   try {
  //     const response = await this.youtube.channels.list({
  //       part: ['snippet', 'statistics'],
  //       id: channelId || undefined,
  //       mine: !channelId,
  //     });

  //     const channel = response.data.items?.[0];
  //     if (!channel) {
  //       return null;
  //     }

  //     return {
  //       id: channel.id,
  //       title: channel.snippet.title,
  //       subscriberCount: channel.statistics.subscriberCount,
  //       viewCount: channel.statistics.viewCount,
  //       videoCount: channel.statistics.videoCount,
  //     };
  //   } catch (error) {
  //     throw new Error(`Failed to get channel info: ${(error as Error).message}`);
  //   }
  // }

  async getVideoStats(videoId: string): Promise<any> {
    try {
      const { yt } = await this.getClients();
      const response = await yt.videos.list({
        part: ['statistics', 'snippet'],
        id: [videoId],
      });

      return response.data.items?.[0] || null;
    } catch (error) {
      throw new Error(`Failed to get video stats: ${(error as Error).message}`);
    }
  }

  async scheduleVideo(videoId: string, publishAt: Date): Promise<void> {
    try {
      const { yt } = await this.getClients();
      await yt.videos.update({
        part: ['status'],
        requestBody: {
          id: videoId,
          status: {
            privacyStatus: 'private',
            publishAt: publishAt.toISOString(),
          },
        },
      });
    } catch (error) {
      throw new Error(`Failed to schedule video: ${(error as Error).message}`);
    }
  }

  async updateVideoPrivacy(videoId: string, privacyStatus: 'private' | 'public' | 'unlisted'): Promise<void> {
    try {
      const { yt } = await this.getClients();
      await yt.videos.update({
        part: ['status'],
        requestBody: {
          id: videoId,
          status: {
            privacyStatus,
          },
        },
      });
    } catch (error) {
      throw new Error(`Failed to update video privacy: ${(error as Error).message}`);
    }
  }

  async updateVideoMetadata(videoId: string, metadata: {
    title?: string;
    description?: string;
    tags?: string[];
    categoryId?: string;
  }): Promise<void> {
    try {
      const { yt } = await this.getClients();
      const updateData: any = { id: videoId };
      
      if (metadata.title || metadata.description || metadata.tags || metadata.categoryId) {
        updateData.snippet = {};
        if (metadata.title) updateData.snippet.title = metadata.title;
        if (metadata.description) updateData.snippet.description = metadata.description;
        if (metadata.tags) updateData.snippet.tags = metadata.tags;
        if (metadata.categoryId) updateData.snippet.categoryId = metadata.categoryId;
      }

      await yt.videos.update({
        part: ['snippet'],
        requestBody: updateData,
      });
    } catch (error) {
      throw new Error(`Failed to update video metadata: ${(error as Error).message}`);
    }
  }

  async getScheduledVideos(): Promise<any[]> {
    try {
      const { yt } = await this.getClients();
      const response = await yt.search.list({
        part: ['snippet'],
        forMine: true,
        type: ['video'],
        eventType: 'upcoming',
        maxResults: 50,
      });

      return response.data.items || [];
    } catch (error) {
      throw new Error(`Failed to get scheduled videos: ${(error as Error).message}`);
    }
  }

  async deleteVideo(videoId: string): Promise<void> {
    try {
      const { yt } = await this.getClients();
      await yt.videos.delete({
        id: videoId,
      });
    } catch (error) {
      throw new Error(`Failed to delete video: ${(error as Error).message}`);
    }
  }

  getDefaultScheduleSettings(): YouTubeScheduleSettings {
    return {
      defaultPrivacy: 'private',
      defaultCategory: '24', // Entertainment
      defaultTags: ['AI Generated', 'Automated', 'Story'],
      scheduleBuffer: 15, // 15 minutes buffer
      autoPublish: false,
    };
  }
}
