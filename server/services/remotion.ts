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
  bgAudio?: string;
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
    fog?: boolean;
    fogIntensity?: number;
  };
  captions?: {
    enabled: boolean;
    font: string;
    color: string;
    position: string;
  };
  transitions?: {
    type: string;
    duration: number;
  };
  [key: string]: unknown;
}

export class RemotionService {
  private bundlePath: string | null = null;

  async initializeBundle(): Promise<void> {
    try {
      const compositionsDir = path.join(process.cwd(), 'remotion');
      await fs.mkdir(compositionsDir, { recursive: true });

      await this.createComposition(compositionsDir);

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

      const assetBaseUrl = process.env.ASSET_BASE_URL || "http://127.0.0.1:5000/";
      for (let i = 0; i < config.images.length; i++) {
        config.images[i].filename =
          `${assetBaseUrl}uploads/images/${config.images[i].filename}`;
      }
      for (let i = 0; i < config.audioSegments.length; i++) {
        config.audioSegments[i].filename =
          `${assetBaseUrl}uploads/audio/${config.audioSegments[i].filename}`;
      }
      if (config.watermark) {
        config.watermark.url = config.watermark.url.startsWith('http')
          ? config.watermark.url
          : `${assetBaseUrl}${config.watermark.url}`;
      }
      if (config.bgAudio) {
        config.bgAudio = `${assetBaseUrl}uploads/music/${config.bgAudio}`;
      }

      const composition = await selectComposition({
        serveUrl: this.bundlePath,
        id: 'StoryVideo',
        inputProps: config,
      });

      if (!composition) {
        throw new Error('No composition found');
      }

      const totalDuration = config.audioSegments.reduce((sum, segment) => sum + segment.duration, 0);
      const durationInFrames = Math.ceil((totalDuration / 1000) * 30);

      await renderMedia({
        composition: {
          ...composition,
          durationInFrames: durationInFrames || 1,
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
    const indexContent = `
import { registerRoot } from 'remotion';
import { RemotionVideo } from './Root';

registerRoot(RemotionVideo);
`;

    await fs.writeFile(path.join(compositionsDir, 'index.ts'), indexContent);

    const rootContent = `
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

    await fs.writeFile(path.join(compositionsDir, 'Root.tsx'), rootContent);

    const storyVideoContent = `
import React from 'react';
import { useCurrentFrame, useVideoConfig, Img, Audio, AbsoluteFill, Sequence, interpolate, spring } from 'remotion';

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
  bgAudio?: string;
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
    fog?: boolean;
    fogIntensity?: number;
  };
  captions?: {
    enabled: boolean;
    font: string;
    color: string;
    position: string;
    wordsPerTime: number;
  };
  transitions?: {
    type: string;
    duration: number;
  };
}

export const StoryVideo: React.FC<StoryVideoProps> = ({
  title,
  script,
  audioSegments,
  images,
  bgAudio,
  watermark,
  effects,
  captions,
  transitions
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const renderImage = (image: any, index: number) => {
    const segmentStart = audioSegments.slice(0, index).reduce((sum, seg) => sum + seg.duration, 0);
    const segmentDuration = audioSegments[index]?.duration || 0;
    const segmentFrames = Math.ceil((segmentDuration / 1000) * fps);
    
    const isActive = frame >= segmentStart / 1000 * fps && frame < (segmentStart + segmentDuration) / 1000 * fps;
    
    if (!isActive) return null;

    const kenBurnsScale = effects?.kenBurns ? 
      interpolate(frame, [segmentStart / 1000 * fps, (segmentStart + segmentDuration) / 1000 * fps], [1, 1.1]) : 1;
    
    const kenBurnsX = effects?.kenBurns ? 
      interpolate(frame, [segmentStart / 1000 * fps, (segmentStart + segmentDuration) / 1000 * fps], [0, 0.05]) : 0;
    
    const kenBurnsY = effects?.kenBurns ? 
      interpolate(frame, [segmentStart / 1000 * fps, (segmentStart + segmentDuration) / 1000 * fps], [0, 0.05]) : 0;

    return (
      <AbsoluteFill key={index}>
        <Img
          src={image.filename}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: \`scale(\${kenBurnsScale}) translate(\${kenBurnsX * 100}%, \${kenBurnsY * 100}%)\`,
            transition: 'transform 0.5s ease-in-out'
          }}
        />
        {effects?.fog && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: \`linear-gradient(45deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))\`,
              opacity: effects.fogIntensity || 0.3,
              pointerEvents: 'none'
            }}
          />
        )}
        {effects?.filmGrain && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: \`url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(%23noise)" opacity="0.1"/></svg>')\`,
              opacity: 0.1,
              pointerEvents: 'none'
            }}
          />
        )}
      </AbsoluteFill>
    );
  };

  const getCaptionChunks = (text: string, maxWordsPerChunk = 10) => {
    // Split text into words and group into chunks of maxWordsPerChunk
    const words = text.split(' ');
    const chunks = [];
    for (let i = 0; i < words.length; i += maxWordsPerChunk) {
      chunks.push(words.slice(i, i + maxWordsPerChunk).join(' '));
    }
    return chunks;
  };

  const renderCaptions = () => {
    if (!captions?.enabled) return null;

    const currentSegmentIndex = audioSegments.findIndex((_, index) => {
      const segmentStart = audioSegments.slice(0, index).reduce((sum, seg) => sum + seg.duration, 0);
      const segmentEnd = segmentStart + audioSegments[index]?.duration;
      return frame >= (segmentStart / 1000) * fps && frame < (segmentEnd / 1000) * fps;
    });

    if (currentSegmentIndex === -1) return null;

    const currentSegment = audioSegments[currentSegmentIndex];
    const segmentStart = audioSegments.slice(0, currentSegmentIndex).reduce((sum, seg) => sum + seg.duration, 0);
    const segmentDuration = currentSegment.duration;
    const segmentStartFrame = (segmentStart / 1000) * fps;
    const segmentEndFrame = ((segmentStart + segmentDuration) / 1000) * fps;

    // Split caption into chunks (tweak maxWordsPerChunk as needed for 2 lines)
    const chunks = getCaptionChunks(currentSegment.text, 10);

    // Calculate which chunk to show based on frame
    const framesPerChunk = (segmentEndFrame - segmentStartFrame) / chunks.length;
    const chunkIndex = Math.floor((frame - segmentStartFrame) / framesPerChunk);

    // Clamp chunkIndex to valid range
    const safeChunkIndex = Math.max(0, Math.min(chunkIndex, chunks.length - 1));

    return (
      <div
        style={{
          position: 'absolute',
          bottom: captions.position === 'bottom' ? '10%' : captions.position === 'top' ? '80%' : '45%',
          left: '50%',
          transform: 'translateX(-50%)',
          color: captions.color || '#ffffff',
          fontFamily: captions.font || 'Inter, sans-serif',
          fontSize: '48px',
          fontWeight: 'bold',
          textAlign: 'center',
          textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
          maxWidth: '80%',
          lineHeight: 1.2,
          background: 'rgba(0,0,0,0.4)',
          borderRadius: '12px',
          padding: '0.2em 0.6em'
        }}
      >
        {chunks[safeChunkIndex]}
      </div>
    );
  };

  const renderWatermark = () => {
    if (!watermark) return null;

    const position = watermark.position || 'bottom-right';
    const style: React.CSSProperties = {
      position: 'absolute',
      width: \`\${watermark.size}%\`,
      height: 'auto',
      opacity: watermark.opacity / 100,
      zIndex: 10
    };

    switch (position) {
      case 'top-left':
        style.top = '5%';
        style.left = '5%';
        break;
      case 'top-right':
        style.top = '5%';
        style.right = '5%';
        break;
      case 'bottom-left':
        style.bottom = '5%';
        style.left = '5%';
        break;
      case 'bottom-right':
      default:
        style.bottom = '5%';
        style.right = '5%';
        break;
    }

    return (
      <Img
        src={watermark.url}
        style={style}
      />
    );
  };

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Render images with effects */}
      {images.map((image, index) => renderImage(image, index))}
      
      {/* Render captions */}
      {renderCaptions()}
      
      {/* Render watermark */}
      {renderWatermark()}
      
      {/* Render audio segments */}
      {audioSegments.map((segment, index) => {
        const segmentStart = audioSegments.slice(0, index).reduce((sum, seg) => sum + seg.duration, 0);
        return (
          <Sequence key={index} from={segmentStart / 1000 * fps}>
            <Audio src={segment.filename} />
          </Sequence>
        );
      })}
      
      {!!bgAudio && (
        <Sequence from={0}>
          <Audio src={bgAudio} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
`;

    await fs.writeFile(path.join(compositionsDir, 'StoryVideo.tsx'), storyVideoContent);
  }

  async generateThumbnail(videoPath: string, outputPath: string, timeInSeconds: number = 5): Promise<string> {
    try {
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
