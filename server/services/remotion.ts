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
  // --- Chapter marker additions ---
  chapterMarkers?: Array<{
    time: number; // seconds
    text: string;
  }>;
  chapterMarkerBgColor?: string;
  chapterMarkerFontColor?: string;
  chapterMarkerFont?: string;
  intro?: {
    url: string;
    dissolveTime: number; // seconds
    duration: number;
  };
  outro?: {
    url: string;
    dissolveTime: number; // seconds
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
        config.watermark.url = config.watermark.url.replace('//uploads/', '/uploads/');
      }
      if (config.bgAudio) {
        config.bgAudio = `${assetBaseUrl}uploads/music/${config.bgAudio}`;
      }

      if (config.intro) {
        config.intro.url = `${assetBaseUrl}${config.intro.url}`;
        config.intro.url = config.intro.url.replace('//uploads/', '/uploads/');
      }
      if (config.outro) {
        config.outro.url = `${assetBaseUrl}${config.outro.url}`;
        config.outro.url = config.outro.url.replace('//uploads/', '/uploads/');
      }
      const composition = await selectComposition({
        serveUrl: this.bundlePath,
        id: 'StoryVideo',
        inputProps: config,
      });

      if (!composition) {
        throw new Error('No composition found');
      }

      let totalDuration = config.audioSegments.reduce((sum, segment) => sum + segment.duration, 0) / 1000;
      totalDuration += 2.5 * config.audioSegments.length; // Add 2.5 seconds per segment for transitions
      if (config.intro) {
        totalDuration += config.intro.duration || 0;
      }
      if (config.outro) {
        totalDuration += config.outro.duration || 0;
      }
      const durationInFrames = Math.ceil(totalDuration * 30);

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
        timeoutInMilliseconds: 120000,
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
import React, { useEffect, useState } from 'react';
import { delayRender, continueRender, useCurrentFrame, useVideoConfig, Img, Audio, AbsoluteFill, Sequence, interpolate, Video } from 'remotion';

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
  chapterMarkers?: Array<{
    time: number; // seconds
    text: string;
  }>;
  chapterMarkerBgColor?: string;
  chapterMarkerFontColor?: string;
  chapterMarkerFont?: string;
  intro?: {
    url: string;
    dissolveTime: number; // seconds
    duration: number;
  };
  outro?: {
    url: string;
    dissolveTime: number; // seconds
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
  intro,
  outro,
  transitions,
  chapterMarkers = [],
  chapterMarkerBgColor = '#000',
  chapterMarkerFontColor = '#fff',
  chapterMarkerFont = 'Arial',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Timing calculations
  const CHAPTER_MARKER_DURATION = 2.5; // seconds
  const DISSOLVE_FRAMES = intro?.dissolveTime ? Math.round(intro.dissolveTime * fps) : 0;
  
  const introFrames = intro ? Math.round(intro.duration * fps) : 0;
  const outroFrames = outro ? Math.round(outro.duration * fps) : 0;
  
  // Calculate main content timing
  const totalMainAudioDuration = audioSegments.reduce((sum, seg) => sum + seg.duration, 0);
  const totalChapterMarkerDuration = chapterMarkers.length * CHAPTER_MARKER_DURATION * 1000; // in ms
  const mainContentDuration = totalMainAudioDuration + totalChapterMarkerDuration;
  const mainContentFrames = Math.round((mainContentDuration / 1000) * fps);
  
  // Timeline positions
  const introStartFrame = 0;
  const introEndFrame = introFrames;
  const dissolveInStartFrame = Math.max(0, introEndFrame - DISSOLVE_FRAMES);
  const mainContentStartFrame = introEndFrame;
  const mainContentEndFrame = mainContentStartFrame + mainContentFrames;
  const dissolveOutStartFrame = mainContentEndFrame;
  const outroStartFrame = mainContentEndFrame;

  const renderImage = (image: any, index: number) => {
    // Calculate timing for this specific image segment
    let segmentStartTime = 0; // in milliseconds
    
    // Add time from previous audio segments
    for (let i = 0; i < index; i++) {
      segmentStartTime += audioSegments[i].duration;
      // Add chapter marker time if it exists for this segment
      if (chapterMarkers[i]) {
        segmentStartTime += CHAPTER_MARKER_DURATION * 1000;
      }
    }
    
    // Add current segment's chapter marker time
    if (chapterMarkers[index]) {
      segmentStartTime += CHAPTER_MARKER_DURATION * 1000;
    }
    
    const segmentDuration = audioSegments[index]?.duration || 0;
    const segmentStartFrame = mainContentStartFrame + Math.round((segmentStartTime / 1000) * fps);
    const segmentEndFrame = segmentStartFrame + Math.round((segmentDuration / 1000) * fps);
    
    const isActive = frame >= segmentStartFrame && frame < segmentEndFrame;
    
    if (!isActive) return null;

    // Ken Burns effect calculations
    const segmentProgress = (frame - segmentStartFrame) / (segmentEndFrame - segmentStartFrame);
    const kenBurnsScale = effects?.kenBurns ? 
      interpolate(segmentProgress, [0, 1], [1, 1.2]) : 1;

    const kenBurnsX = effects?.kenBurns ? 
      interpolate(segmentProgress, [0, 1], [0, -50]) : 0;
    
    const kenBurnsY = effects?.kenBurns ? 
      interpolate(segmentProgress, [0, 1], [0, -30]) : 0;

    return (
      <AbsoluteFill key={\`image-\${index}\`}>
        <Img
          src={image.filename}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: \`scale(\${kenBurnsScale})\`,
            transformOrigin: 'center center',
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
    const words = text.split(' ');
    const chunks = [];
    for (let i = 0; i < words.length; i += maxWordsPerChunk) {
      chunks.push(words.slice(i, i + maxWordsPerChunk).join(' '));
    }
    return chunks;
  };

  const renderCaptions = () => {
    if (!captions?.enabled) return null;

    // Find current segment based on main content timing
    const frameInMainContent = frame - mainContentStartFrame;
    if (frameInMainContent < 0) return null;

    let currentTime = 0; // in milliseconds
    let currentSegmentIndex = -1;

    for (let i = 0; i < audioSegments.length; i++) {
      // Add chapter marker time
      if (chapterMarkers[i]) {
        currentTime += CHAPTER_MARKER_DURATION * 1000;
      }
      
      const segmentStartTime = currentTime;
      const segmentEndTime = currentTime + audioSegments[i].duration;
      const segmentStartFrame = Math.round((segmentStartTime / 1000) * fps);
      const segmentEndFrame = Math.round((segmentEndTime / 1000) * fps);
      
      if (frameInMainContent >= segmentStartFrame && frameInMainContent < segmentEndFrame) {
        currentSegmentIndex = i;
        break;
      }
      
      currentTime += audioSegments[i].duration;
    }

    if (currentSegmentIndex === -1) return null;

    const currentSegment = audioSegments[currentSegmentIndex];
    
    // Calculate segment timing for caption chunking
    let segmentStartTime = 0;
    for (let i = 0; i < currentSegmentIndex; i++) {
      if (chapterMarkers[i]) {
        segmentStartTime += CHAPTER_MARKER_DURATION * 1000;
      }
      segmentStartTime += audioSegments[i].duration;
    }
    if (chapterMarkers[currentSegmentIndex]) {
      segmentStartTime += CHAPTER_MARKER_DURATION * 1000;
    }
    
    const segmentStartFrame = Math.round((segmentStartTime / 1000) * fps);
    const segmentDuration = currentSegment.duration;
    const segmentFrames = Math.round((segmentDuration / 1000) * fps);

    // Split caption into chunks
    const chunks = getCaptionChunks(currentSegment.text, 10);
    const framesPerChunk = segmentFrames / chunks.length;
    const chunkIndex = Math.floor((frameInMainContent - segmentStartFrame) / framesPerChunk);
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
      width: \`\${watermark.size || 5}%\`,
      height: 'auto',
      opacity: watermark.opacity,
      zIndex: 1000
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
        style.bottom = '5%';
        style.right = '5%';
        break;
      case 'top-center':
        style.top = '5%';
        style.left = '50%';
        style.transform = 'translateX(-50%)';
        break;
      case 'bottom-center':
        style.bottom = '5%';
        style.left = '50%';
        style.transform = 'translateX(-50%)';
        break;
      case 'center':
      default:
        style.top = '50%';
        style.left = '50%';
        style.transform = 'translate(-50%, -50%)';
        break;
    }

    return (
      <Img
        src={watermark.url}
        style={style}
      />
    );
  };

  const renderChapterMarker = (markerIndex: number) => {
    const marker = chapterMarkers[markerIndex];
    if (!marker) return null;

    // Calculate when this chapter marker should appear
    let markerStartTime = 0; // in milliseconds
    
    // Add time from previous segments and their chapter markers
    for (let i = 0; i < markerIndex; i++) {
      if (chapterMarkers[i]) {
        markerStartTime += CHAPTER_MARKER_DURATION * 1000;
      }
      markerStartTime += audioSegments[i]?.duration || 0;
    }
    
    const markerStartFrame = mainContentStartFrame + Math.round((markerStartTime / 1000) * fps);
    const markerDuration = Math.round(CHAPTER_MARKER_DURATION * fps);
    
    const localFrame = frame - markerStartFrame;
    if (localFrame < 0 || localFrame >= markerDuration) return null;
    
    // Fade in/out
    const fadeInFrames = fps * 0.5;
    const fadeOutFrames = fps * 0.5;
    const fadeIn = Math.min(1, localFrame / fadeInFrames);
    const fadeOut = Math.max(0, (markerDuration - localFrame) / fadeOutFrames);
    const opacity = Math.max(0, Math.min(1, Math.min(fadeIn, fadeOut)));

    return (
      <AbsoluteFill key={\`chapter-\${markerIndex}\`}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: chapterMarkerBgColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            opacity,
          }}
        >
          <div
            style={{
              color: chapterMarkerFontColor,
              fontFamily: chapterMarkerFont + ', sans-serif',
              fontSize: '72px',
              fontWeight: 'bold',
              textAlign: 'center',
              padding: '0.5em 1em',
              borderRadius: '24px',
              boxShadow: '0 4px 32px rgba(0,0,0,0.5)',
              maxWidth: '80%',
              lineHeight: 1.1,
            }}
          >
            {marker.text}
          </div>
        </div>
      </AbsoluteFill>
    );
  };

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* 1. Intro Video */}
      {intro && (
        <Sequence from={introStartFrame} durationInFrames={introFrames}>
          <div style={{
            opacity: !intro.dissolveTime ? undefined : interpolate(frame, 
              [introStartFrame, introStartFrame + (intro.dissolveTime * fps), introEndFrame - (intro.dissolveTime * fps), introEndFrame], 
              [0, 1, 1, 0])
          }}>
            <MyVideoComponent src={intro.url} />
          </div>
        </Sequence>
      )}

      {/* 3. Main Content - Images */}
      {frame >= mainContentStartFrame && frame < mainContentEndFrame && (
        <div style={{
          opacity: !outro?.dissolveTime ? undefined : frame < mainContentEndFrame - (outro.dissolveTime * fps) ? 1 : 
            interpolate(frame, [mainContentEndFrame - (outro.dissolveTime * fps), mainContentEndFrame], [1, 0])
        }}>
          {images.map((image, index) => renderImage(image, index))}
          {renderCaptions()}
        </div>
      )}

      {/* 4. Chapter Markers */}
      {chapterMarkers.map((_, index) => renderChapterMarker(index))}

      {/* 5. Audio Segments */}
      {audioSegments.map((segment, index) => {
        let audioStartTime = 0;
        
        // Add time from previous segments and chapter markers
        for (let i = 0; i < index; i++) {
          if (chapterMarkers[i]) {
            audioStartTime += CHAPTER_MARKER_DURATION * 1000;
          }
          audioStartTime += audioSegments[i].duration;
        }
        
        // Add current chapter marker time
        if (chapterMarkers[index]) {
          audioStartTime += CHAPTER_MARKER_DURATION * 1000;
        }
        
        const audioStartFrame = mainContentStartFrame + Math.round((audioStartTime / 1000) * fps);
        
        return (
          <Sequence key={\`audio-\${index}\`} from={audioStartFrame}>
            <Audio src={segment.filename} />
          </Sequence>
        );
      })}

      {/* 6. Background Audio */}
      {bgAudio && (
        <Sequence from={0}>
          <Audio src={bgAudio} volume={0.3} />
        </Sequence>
      )}

      {/* 8. Outro Video */}
      {outro && (
        <Sequence from={outroStartFrame} durationInFrames={outroFrames}>
          <div style={{
            opacity: !outro.dissolveTime ? undefined : interpolate(frame, [0, fps * outro.dissolveTime], [0, 1])
          }}>
            <MyVideoComponent src={outro.url} />
          </div>
        </Sequence>
      )}

      {/* 9. Watermark - Always visible */}
      {renderWatermark()}
    </AbsoluteFill>
  );
};

const MyVideoComponent = ({ src }: { src: string }) => {
  const [handle] = useState(() => delayRender());

  useEffect(() => {
    const video = document.createElement('video');
    video.src = src;
    video.onloadeddata = () => continueRender(handle);
    video.onerror = () => continueRender(handle);
    
    return () => {
      video.remove();
    };
  }, [src, handle]);

  return <Video src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
};`;

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
