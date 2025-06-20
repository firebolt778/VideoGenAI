import { google } from 'googleapis';

export interface YouTubeVideoUpload {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  privacyStatus: 'private' | 'public' | 'unlisted';
  videoFilePath: string;
  thumbnailPath?: string;
}

export interface YouTubeChannel {
  id: string;
  title: string;
  subscriberCount: string;
  viewCount: string;
  videoCount: string;
}

export class YouTubeService {
  private youtube: any;
  private oauth2Client: any;

  constructor() {
    const clientId = process.env.YOUTUBE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID_ENV_VAR || "default_client_id";
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET_ENV_VAR || "default_client_secret";
    const redirectUri = process.env.YOUTUBE_REDIRECT_URI || process.env.YOUTUBE_REDIRECT_URI_ENV_VAR || "http://localhost:5000/auth/youtube/callback";

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    this.youtube = google.youtube({
      version: 'v3',
      auth: this.oauth2Client
    });
  }

  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
    });
  }

  async setCredentials(code: string): Promise<void> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
    } catch (error) {
      throw new Error(`Failed to set YouTube credentials: ${error.message}`);
    }
  }

  async uploadVideo(upload: YouTubeVideoUpload): Promise<string> {
    try {
      const fs = await import('fs');
      
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
            privacyStatus: upload.privacyStatus,
          },
        },
        media: {
          body: fs.createReadStream(upload.videoFilePath),
        },
      };

      const response = await this.youtube.videos.insert(requestParameters);
      const videoId = response.data.id;

      // Upload thumbnail if provided
      if (upload.thumbnailPath && videoId) {
        await this.uploadThumbnail(videoId, upload.thumbnailPath);
      }

      return videoId;
    } catch (error) {
      throw new Error(`Failed to upload video to YouTube: ${error.message}`);
    }
  }

  async uploadThumbnail(videoId: string, thumbnailPath: string): Promise<void> {
    try {
      const fs = await import('fs');
      
      await this.youtube.thumbnails.set({
        videoId: videoId,
        media: {
          body: fs.createReadStream(thumbnailPath),
        },
      });
    } catch (error) {
      throw new Error(`Failed to upload thumbnail: ${error.message}`);
    }
  }

  async getChannelInfo(channelId?: string): Promise<YouTubeChannel | null> {
    try {
      const response = await this.youtube.channels.list({
        part: ['snippet', 'statistics'],
        id: channelId || undefined,
        mine: !channelId,
      });

      const channel = response.data.items?.[0];
      if (!channel) {
        return null;
      }

      return {
        id: channel.id,
        title: channel.snippet.title,
        subscriberCount: channel.statistics.subscriberCount,
        viewCount: channel.statistics.viewCount,
        videoCount: channel.statistics.videoCount,
      };
    } catch (error) {
      throw new Error(`Failed to get channel info: ${error.message}`);
    }
  }

  async getVideoStats(videoId: string): Promise<any> {
    try {
      const response = await this.youtube.videos.list({
        part: ['statistics', 'snippet'],
        id: [videoId],
      });

      return response.data.items?.[0] || null;
    } catch (error) {
      throw new Error(`Failed to get video stats: ${error.message}`);
    }
  }

  async scheduleVideo(videoId: string, publishAt: Date): Promise<void> {
    try {
      await this.youtube.videos.update({
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
      throw new Error(`Failed to schedule video: ${error.message}`);
    }
  }
}

export const youtubeService = new YouTubeService();
