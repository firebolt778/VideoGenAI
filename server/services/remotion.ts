import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import fs from 'fs/promises';

export interface RemotionVideoConfig {
  title: string;
  script: string;
  audioSegments: Array<{
    filename: string;
    text: string;
    duration: number;
  }>;
  images: Array<{
    filename: string;
    description: string;
    scriptSegment: string;
  }>;
  watermark?: {
    url: string;
    position: string;
    opacity: number;
    size: number;
  };
  effects?: {
    kenBurns?: boolean;
    kenBurnsSpeed?: number;
    kenBurnsDirection?: string;
    filmGrain?: boolean;
  };
  captions?: {
    enabled: boolean;
    font: string;
    color: string;
    position: string;
    wordsPerTime: number;
  };
}

export class RemotionService {
  private bundlePath: string | null = null;

  async initializeBundle(): Promise<void> {
    try {
      // Create Remotion composition directory if it doesn't exist
      const compositionsDir = path.join(process.cwd(), 'remotion');
      await fs.mkdir(compositionsDir, { recursive: true });

      // Create a basic composition file
      await this.createComposition(compositionsDir);

      // Bundle the composition
      this.bundlePath = await bundle({
        entryPoint: path.join(compositionsDir, 'index.ts'),
        webpackOverride: (config) => config,
      });
    } catch (error) {
      throw new Error(`Failed to initialize Remotion bundle: ${(error as Error).message}`);
    }
  }

  async renderVideo(config: RemotionVideoConfig, outputPath: string): Promise<string> {
    try {
      if (!this.bundlePath) {
        await this.initializeBundle();
      }

      if (!this.bundlePath) {
        throw new Error('Failed to create bundle');
      }

      const compositions = await selectComposition({
        serveUrl: this.bundlePath,
        id: 'StoryVideo',
        inputProps: config,
      });

      const composition = compositions[0];
      if (!composition) {
        throw new Error('No composition found');
      }

      // Calculate video duration based on audio segments
      const totalDuration = config.audioSegments.reduce((sum, segment) => sum + segment.duration, 0);
      const durationInFrames = Math.ceil((totalDuration / 1000) * 30); // 30 FPS

      await renderMedia({
        composition: {
          ...composition,
          durationInFrames,
        },
        serveUrl: this.bundlePath,
        codec: 'h264',
        outputLocation: outputPath,
        inputProps: config,
        overwrite: true,
      });

      return outputPath;
    } catch (error) {
      throw new Error(`Failed to render video: ${(error as Error).message}`);
    }
  }

  private async createComposition(compositionsDir: string): Promise<void> {
    // Create index.ts
    const indexContent = `
import { Composition } from 'remotion';
import { StoryVideo } from './StoryVideo';

export const RemotionVideo: React.FC = () => {
  return (
    <>
      <Composition
        id="StoryVideo"
        component={StoryVideo}
        durationInFrames={3000}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
`;

    await fs.writeFile(path.join(compositionsDir, 'index.ts'), indexContent);

    // Create StoryVideo component
    const storyVideoContent = `
import React from 'react';
import { useCurrentFrame, useVideoConfig, Img, Audio, AbsoluteFill } from 'remotion';

interface StoryVideoProps {
  title: string;
  script: string;
  audioSegments: Array<{
    filename: string;
    text: string;
    duration: number;
  }>;
  images: Array<{
    filename: string;
    description: string;
    scriptSegment: string;
  }>;
  watermark?: {
    url: string;
    position: string;
    opacity: number;
    size: number;
  };
  effects?: {
    kenBurns?: boolean;
    kenBurnsSpeed?: number;
    kenBurnsDirection?: string;
    filmGrain?: boolean;
  };
  captions?: {
    enabled: boolean;
    font: string;
    color: string;
    position: string;
    wordsPerTime: number;
  };
}

export const StoryVideo: React.FC<StoryVideoProps> = ({
  title,
  script,
  audioSegments,
  images,
  watermark,
  effects,
  captions
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Calculate which image should be shown based on current frame
  const currentTime = (frame / fps) * 1000; // Convert to milliseconds
  let currentImageIndex = 0;
  let audioOffset = 0;

  for (let i = 0; i < audioSegments.length; i++) {
    if (currentTime >= audioOffset && currentTime < audioOffset + audioSegments[i].duration) {
      currentImageIndex = Math.min(i, images.length - 1);
      break;
    }
    audioOffset += audioSegments[i].duration;
  }

  const currentImage = images[currentImageIndex];

  // Ken Burns effect calculation
  const kenBurnsScale = effects?.kenBurns 
    ? 1 + (frame / 3000) * 0.1 // Gradual zoom
    : 1;

  return (
    <AbsoluteFill>
      {/* Background Image */}
      {currentImage && (
        <Img
          src={'/uploads/images/' + currentImage.filename}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: \`scale(\${kenBurnsScale})\`,
            filter: effects?.filmGrain ? 'contrast(1.1) saturate(1.1)' : 'none'
          }}
        />
      )}

      {/* Audio */}
      {audioSegments.map((segment, index) => (
        <Audio
          key={index}
          src={'/uploads/audio/' + segment.filename}
          startFrom={(audioSegments.slice(0, index).reduce((sum, s) => sum + s.duration, 0) / 1000) * fps}
          endAt={((audioSegments.slice(0, index + 1).reduce((sum, s) => sum + s.duration, 0) / 1000) * fps)}
        />
      ))}

      {/* Watermark */}
      {watermark && (
        <Img
          src={watermark.url}
          style={{
            position: 'absolute',
            [watermark.position.includes('top') ? 'top' : 'bottom']: '20px',
            [watermark.position.includes('left') ? 'left' : 'right']: '20px',
            opacity: watermark.opacity / 100,
            width: \`\${watermark.size}%\`,
            height: 'auto',
          }}
        />
      )}

      {/* Captions */}
      {captions?.enabled && (
        <div
          style={{
            position: 'absolute',
            bottom: captions.position === 'bottom' ? '60px' : 'auto',
            top: captions.position === 'top' ? '60px' : 'auto',
            left: '50%',
            transform: 'translateX(-50%)',
            fontFamily: captions.font,
            color: captions.color,
            fontSize: '24px',
            fontWeight: 'bold',
            textAlign: 'center',
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
            maxWidth: '80%',
          }}
        >
          {/* Simple caption display - in production, this would be more sophisticated */}
          {script.substring(0, 100)}...
        </div>
      )}
    </AbsoluteFill>
  );
};
`;

    await fs.writeFile(path.join(compositionsDir, 'StoryVideo.tsx'), storyVideoContent);
  }

  async generateThumbnail(videoPath: string, outputPath: string, timeInSeconds: number = 5): Promise<string> {
    try {
      // This would typically use FFmpeg to extract a frame from the video
      // For now, we'll use a placeholder implementation
      const ffmpeg = await import('fluent-ffmpeg');
      
      return new Promise((resolve, reject) => {
        ffmpeg.default(videoPath)
          .screenshots({
            timestamps: [timeInSeconds],
            filename: path.basename(outputPath),
            folder: path.dirname(outputPath),
            size: '1280x720'
          })
          .on('end', () => resolve(outputPath))
          .on('error', reject);
      });
    } catch (error) {
      throw new Error(`Failed to generate thumbnail: ${(error as Error).message}`);
    }
  }
}

export const remotionService = new RemotionService();
