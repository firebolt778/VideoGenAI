import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import fs from 'fs/promises';

export interface RemotionVideoConfig {
  title: {
    text: string;
    font: string;
    color: string;
    bgColor: string;
  };
  audioSegments: Array<{
    filename: string;
    text: string;
    duration: number;
  }>;
  imageAssignments: Array<{
    chapter: string;
    images: Array<{
      filename: string;
      scriptSegment: string;
    }>;
  }>;
  bgAudio?: string;
  hookAudio?: {
    filename: string;
    text: string;
    duration: number;
  };
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
      for (let i = 0; i < config.imageAssignments.length; i++) {
        for (let j = 0; j < config.imageAssignments[i].images.length; j++) {
          config.imageAssignments[i].images[j].filename = `${assetBaseUrl}uploads/images/${config.imageAssignments[i].images[j].filename}`;
        }
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
      if (config.hookAudio) {
        config.hookAudio.filename =
          `${assetBaseUrl}uploads/audio/${config.hookAudio.filename}`;
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
      totalDuration += 2.5 * (config.chapterMarkers || []).length; // Add 2.5 seconds per chapter marker
      if (config.intro) {
        totalDuration += config.intro.duration || 0;
      }
      if (config.outro) {
        totalDuration += config.outro.duration || 0;
      }
      if (config.hookAudio) {
        totalDuration += config.hookAudio.duration;
      }
      totalDuration += 5; // Add 5 seconds for title
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
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { delayRender, continueRender, useCurrentFrame, useVideoConfig, Img, Audio, AbsoluteFill, Sequence, interpolate, OffthreadVideo } from 'remotion';

interface StoryVideoProps {
  title: {
    text: string;
    font: string;
    color: string;
    bgColor: string;
  };
  script: string;
  audioSegments: Array<{
    filename: string;
    text: string;
    duration: number;
  }>;
  imageAssignments: Array<{
    chapter: string;
    images: Array<{
      filename: string;
      scriptSegment: string;
    }>;
  }>;
  bgAudio?: string;
  hookAudio?: {
    filename: string;
    text: string;
    duration: number;
  };
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
    time: number;
    text: string;
  }>;
  chapterMarkerBgColor?: string;
  chapterMarkerFontColor?: string;
  chapterMarkerFont?: string;
  intro?: {
    url: string;
    dissolveTime: number;
    duration: number;
  };
  outro?: {
    url: string;
    dissolveTime: number;
    duration: number;
  };
}

// Memoized film grain SVG to avoid recreation
const FILM_GRAIN_SVG = \`data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(%23noise)" opacity="0.1"/></svg>\`;

export const StoryVideo: React.FC<StoryVideoProps> = ({
  title,
  audioSegments,
  imageAssignments,
  bgAudio,
  hookAudio,
  watermark,
  effects,
  captions,
  intro,
  outro,
  chapterMarkers = [],
  chapterMarkerBgColor = '#000',
  chapterMarkerFontColor = '#fff',
  chapterMarkerFont = 'Arial',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Memoize timing calculations to avoid recalculation on every frame
  // NEW ORDER: hook, intro, title, main, outro
  const timingData = useMemo(() => {
    const CHAPTER_MARKER_DURATION = 2.5;
    const TITLE_DURATION = 5;
    const DISSOLVE_FRAMES = intro?.dissolveTime ? Math.round(intro.dissolveTime * fps) : 0;

    const hookFrames = hookAudio ? Math.round(hookAudio.duration * fps) : 0;
    const introFrames = intro ? Math.round(intro.duration * fps) : 0;
    const outroFrames = outro ? Math.round(outro.duration * fps) : 0;
    const titleFrames = Math.round(TITLE_DURATION * fps);

    const totalMainAudioDuration = audioSegments.reduce((sum, seg) => sum + seg.duration, 0);
    const totalChapterMarkerDuration = chapterMarkers.length * CHAPTER_MARKER_DURATION * 1000;
    const mainContentDuration = totalMainAudioDuration + totalChapterMarkerDuration;
    const mainContentFrames = Math.round((mainContentDuration / 1000) * fps);

    // Timeline positions - NEW ORDER: hook, intro, title, main, outro
    const hookStartFrame = 0;
    const hookEndFrame = hookStartFrame + hookFrames;
    const introStartFrame = hookEndFrame;
    const introEndFrame = introStartFrame + introFrames;
    const titleStartFrame = introEndFrame;
    const titleEndFrame = titleStartFrame + titleFrames;
    const mainContentStartFrame = titleEndFrame;
    const mainContentEndFrame = mainContentStartFrame + mainContentFrames;
    const outroStartFrame = mainContentEndFrame;

    return {
      CHAPTER_MARKER_DURATION,
      TITLE_DURATION,
      DISSOLVE_FRAMES,
      hookFrames,
      introFrames,
      outroFrames,
      titleFrames,
      mainContentFrames,
      hookStartFrame,
      hookEndFrame,
      introStartFrame,
      introEndFrame,
      titleStartFrame,
      titleEndFrame,
      mainContentStartFrame,
      mainContentEndFrame,
      outroStartFrame,
    };
  }, [audioSegments, chapterMarkers, hookAudio, intro, outro, fps]);

  const images = useMemo(() => {
    return imageAssignments.flatMap(assignment => assignment.images);
  }, [imageAssignments]);

  // Memoize segment timing calculations
  const segmentTimings = useMemo(() => {
    return audioSegments.map((segment, index) => {
      const audioDuration = audioSegments.slice(0, index).reduce((sum, seg) => sum + seg.duration, 0);
      let segmentStartTime = audioDuration;
      for (let i = 0; i < chapterMarkers.length; i++) {
        if (chapterMarkers[i].time > audioDuration) {
          break;
        }
        segmentStartTime += timingData.CHAPTER_MARKER_DURATION * 1000;
      }

      const segmentDuration = segment.duration;
      const segmentStartFrame = timingData.mainContentStartFrame + Math.round((segmentStartTime / 1000) * fps);
      const segmentEndFrame = segmentStartFrame + Math.round((segmentDuration / 1000) * fps);

      return {
        startTime: segmentStartTime,
        duration: segmentDuration,
        startFrame: segmentStartFrame,
        endFrame: segmentEndFrame,
      };
    });
  }, [audioSegments, chapterMarkers, timingData, fps]);

  // Audio duration estimation function
  const estimateAudioDuration = useCallback((text: string): number => {
    // Rough estimation: ~150 words per minute, ~5 characters per word
    const wordsPerMinute = 150;
    const charactersPerWord = 5;
    const words = text.length / charactersPerWord;
    const minutes = words / wordsPerMinute;
    return Math.round(minutes * 60 * 1000); // Return milliseconds
  }, []);

  // Memoize caption chunks to avoid recalculation
  const captionChunks = useMemo(() => {
    const getCaptionChunks = (text: string, maxWordsPerChunk = 10) => {
      const words = text.split(' ');
      const chunks: string[] = [];
      const chunkDurations: number[] = [];

      for (let i = 0; i < words.length; i += maxWordsPerChunk) {
        const chunk = words.slice(i, i + maxWordsPerChunk).join(' ');
        chunks.push(chunk);
        chunkDurations.push(estimateAudioDuration(chunk));
      }

      return { chunks, durations: chunkDurations };
    };

    return {
      hook: hookAudio ? getCaptionChunks(hookAudio.text) : { chunks: [], durations: [] },
      segments: audioSegments.map(segment => getCaptionChunks(segment.text)),
    };
  }, [hookAudio, audioSegments, estimateAudioDuration]);

  // Find current active segment more efficiently
  const activeSegmentIndex = useMemo(() => {
    if (frame < timingData.mainContentStartFrame || frame >= timingData.mainContentEndFrame) {
      return -1;
    }

    return segmentTimings.findIndex(timing =>
      frame >= timing.startFrame && frame < timing.endFrame
    );
  }, [frame, timingData, segmentTimings]);

  // Memoize watermark styles
  const watermarkStyle = useMemo(() => {
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

    return style;
  }, [watermark]);

  const renderTitle = useCallback(() => {
    const isTitleActive = frame >= timingData.titleStartFrame && frame < timingData.titleEndFrame;
    if (!isTitleActive) return null;

    const fadeFrames = fps * 0.5;
    const localFrame = frame - timingData.titleStartFrame;
    const fadeIn = Math.min(1, localFrame / fadeFrames);
    const fadeOut = Math.min(1, (timingData.titleFrames - localFrame) / fadeFrames);
    const opacity = Math.min(fadeIn, fadeOut);

    const scaleProgress = localFrame / timingData.titleFrames;
    const scale = interpolate(scaleProgress, [0, 0.2, 0.8, 1], [0.8, 1.05, 1.02, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp'
    });

    return (
      <AbsoluteFill key="title-screen">
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: title.bgColor,
            opacity,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: \`translate(-50%, -50%) scale(\${scale})\`,
            color: title.color,
            fontFamily: title.font,
            fontSize: '84px',
            fontWeight: '900',
            textAlign: 'center',
            textShadow: '0 4px 20px rgba(0,0,0,0.8), 0 0 40px rgba(255,255,255,0.2)',
            maxWidth: '90%',
            lineHeight: 1.1,
            opacity,
          }}
        >
          {title.text}
        </div>
      </AbsoluteFill>
    );
  }, [frame, timingData, fps, title]);

  const renderHookImages = useCallback(() => {
    if (!hookAudio || timingData.hookFrames === 0) return null;

    const isHookActive = frame >= timingData.hookStartFrame && frame < timingData.hookEndFrame;
    if (!isHookActive) return null;

    const hookImageCount = Math.min(4, images.length);
    const framesPerHookImage = timingData.hookFrames / hookImageCount;
    const currentHookImageIndex = Math.floor((frame - timingData.hookStartFrame) / framesPerHookImage);
    const safeHookImageIndex = Math.max(0, Math.min(currentHookImageIndex, hookImageCount - 1));
    const currentHookImage = images[safeHookImageIndex];

    if (!currentHookImage) return null;

    const imageStartFrame = timingData.hookStartFrame + (safeHookImageIndex * framesPerHookImage);
    const imageEndFrame = imageStartFrame + framesPerHookImage;
    const imageProgress = (frame - imageStartFrame) / (imageEndFrame - imageStartFrame);

    const kenBurnsScale = effects?.kenBurns ?
      interpolate(imageProgress, [0, 1], [1.1, 1.3]) : 1;

    return (
      <AbsoluteFill key={\`hook-image-\${safeHookImageIndex}\`}>
        <Img
          src={currentHookImage.filename}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: \`scale(\${kenBurnsScale})\`,
            transformOrigin: 'center center',
          }}
        />
        {renderEffects()}
      </AbsoluteFill>
    );
  }, [frame, timingData, hookAudio, images, effects]);

  // Extract effects rendering to avoid duplication
  const renderEffects = useCallback(() => (
    <>
      {effects?.fog && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(45deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
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
            background: \`url('\${FILM_GRAIN_SVG}')\`,
            opacity: 0.1,
            pointerEvents: 'none'
          }}
        />
      )}
    </>
  ), [effects]);

  const renderImage = useCallback((image: any, index: number) => {
    const timing = segmentTimings[index];
    if (!timing) return null;

    const isActive = frame >= timing.startFrame && frame < timing.endFrame;
    if (!isActive) return null;

    const segmentProgress = (frame - timing.startFrame) / (timing.endFrame - timing.startFrame);
    const kenBurnsScale = effects?.kenBurns ?
      interpolate(segmentProgress, [0, 1], [1, 1.2]) : 1;

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
          }}
        />
        {renderEffects()}
      </AbsoluteFill>
    );
  }, [frame, segmentTimings, effects, renderEffects]);

  const renderCaptions = useCallback(() => {
    if (!captions?.enabled || activeSegmentIndex === -1) return null;

    const currentSegment = audioSegments[activeSegmentIndex];
    const timing = segmentTimings[activeSegmentIndex];
    const captionData = captionChunks.segments[activeSegmentIndex];

    if (!captionData || captionData.chunks.length === 0) return null;

    // Calculate which chunk should be displayed based on audio timing
    const frameInSegment = frame - timing.startFrame;
    const timeInSegmentMs = (frameInSegment / fps) * 1000;

    let accumulatedTime = 0;
    let chunkIndex = 0;

    for (let i = 0; i < captionData.durations.length; i++) {
      if (timeInSegmentMs >= accumulatedTime && timeInSegmentMs < accumulatedTime + captionData.durations[i]) {
        chunkIndex = i;
        break;
      }
      accumulatedTime += captionData.durations[i];
      chunkIndex = i + 1; // If we're past all chunks, show the last one
    }

    const safeChunkIndex = Math.max(0, Math.min(chunkIndex, captionData.chunks.length - 1));

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
        {captionData.chunks[safeChunkIndex]}
      </div>
    );
  }, [captions, activeSegmentIndex, audioSegments, segmentTimings, captionChunks, frame, timingData, fps]);

  const renderHookCaptions = useCallback(() => {
    if (!captions?.enabled || !hookAudio || timingData.hookFrames === 0) return null;

    const isHookActive = frame >= timingData.hookStartFrame && frame < timingData.hookEndFrame;
    if (!isHookActive) return null;

    const captionData = captionChunks.hook;
    if (!captionData || captionData.chunks.length === 0) return null;

    // Calculate which chunk should be displayed based on audio timing
    const frameInHook = frame - timingData.hookStartFrame;
    const timeInHookMs = (frameInHook / fps) * 1000;

    let accumulatedTime = 0;
    let chunkIndex = 0;

    for (let i = 0; i < captionData.durations.length; i++) {
      if (timeInHookMs >= accumulatedTime && timeInHookMs < accumulatedTime + captionData.durations[i]) {
        chunkIndex = i;
        break;
      }
      accumulatedTime += captionData.durations[i];
      chunkIndex = i + 1; // If we're past all chunks, show the last one
    }

    const safeChunkIndex = Math.max(0, Math.min(chunkIndex, captionData.chunks.length - 1));

    return (
      <div
        style={{
          position: 'absolute',
          bottom: captions.position === 'bottom' ? '10%' : captions.position === 'top' ? '80%' : '45%',
          left: '50%',
          transform: 'translateX(-50%)',
          color: captions.color || '#ffffff',
          fontFamily: captions.font || 'Inter, sans-serif',
          fontSize: '52px',
          fontWeight: 'bold',
          textAlign: 'center',
          textShadow: '3px 3px 6px rgba(0,0,0,0.9)',
          maxWidth: '85%',
          lineHeight: 1.2,
          background: 'rgba(0,0,0,0.5)',
          borderRadius: '12px',
          padding: '0.3em 0.7em'
        }}
      >
        {captionData.chunks[safeChunkIndex]}
      </div>
    );
  }, [captions, hookAudio, timingData, frame, captionChunks, fps]);

  const renderChapterMarker = useCallback((markerIndex: number) => {
    const marker = chapterMarkers[markerIndex];
    if (!marker) return null;

    const markerStartTime = marker.time + timingData.CHAPTER_MARKER_DURATION * 1000 * markerIndex;

    const markerStartFrame = timingData.mainContentStartFrame + Math.round((markerStartTime / 1000) * fps);
    const markerDuration = Math.round(timingData.CHAPTER_MARKER_DURATION * fps);

    const localFrame = frame - markerStartFrame;
    if (localFrame < 0 || localFrame >= markerDuration) return null;

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
  }, [chapterMarkers, timingData, audioSegments, fps, frame, chapterMarkerBgColor, chapterMarkerFontColor, chapterMarkerFont]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Hook Content - NOW FIRST */}
      {hookAudio && (
        <>
          {renderHookImages()}
          {renderHookCaptions()}
          <Sequence from={timingData.hookStartFrame} durationInFrames={timingData.hookFrames}>
            <Audio src={hookAudio.filename} />
          </Sequence>
        </>
      )}

      {/* Intro Video - NOW SECOND */}
      {intro && (
        <Sequence from={timingData.introStartFrame} durationInFrames={timingData.introFrames}>
          <div style={{
            opacity: !intro.dissolveTime ? 1 : (() => {
              const dissolveFrames = Math.round(intro.dissolveTime * fps);
              const fadeInEnd = Math.min(timingData.introStartFrame + dissolveFrames, timingData.introEndFrame - 1);
              const fadeOutStart = Math.max(timingData.introEndFrame - dissolveFrames, timingData.introStartFrame + 1);

              if (fadeInEnd >= fadeOutStart) {
                return interpolate(frame, [timingData.introStartFrame, timingData.introEndFrame], [0, 1]);
              }

              return interpolate(frame,
                [timingData.introStartFrame, fadeInEnd, fadeOutStart, timingData.introEndFrame],
                [0, 1, 1, 0],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              );
            })(),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
          }}>
            <MyVideoComponent
              src={intro.url}
              fadeOutDuration={intro.duration > 5 ? 5 : intro.duration}
              totalDuration={intro.duration}
            />
          </div>
        </Sequence>
      )}

      {/* Title Screen - NOW THIRD */}
      {renderTitle()}

      {/* Main Content - NOW FOURTH */}
      {frame >= timingData.mainContentStartFrame && frame < timingData.mainContentEndFrame && (
        <div style={{
          opacity: !outro?.dissolveTime ? undefined : frame < timingData.mainContentEndFrame - (outro.dissolveTime * fps) ? 1 :
            interpolate(frame, [timingData.mainContentEndFrame - (outro.dissolveTime * fps), timingData.mainContentEndFrame], [1, 0])
        }}>
          {images.map((image, index) => renderImage(image, index))}
          {renderCaptions()}
        </div>
      )}

      {/* Chapter Markers */}
      {chapterMarkers.map((_, index) => renderChapterMarker(index))}

      {/* Audio Segments */}
      {audioSegments.map((segment, index) => {
        const timing = segmentTimings[index];
        return (
          <Sequence key={\`audio-\${index}\`} from={timing.startFrame}>
            <Audio src={segment.filename} />
          </Sequence>
        );
      })}

      {/* Background Audio */}
      {bgAudio && (
        <Sequence from={timingData.mainContentStartFrame}>
          <Audio src={bgAudio} volume={0.3} />
        </Sequence>
      )}

      {/* Outro Video - REMAINS LAST */}
      {outro && (
        <Sequence from={timingData.outroStartFrame} durationInFrames={timingData.outroFrames}>
          <div style={{
            opacity: !outro.dissolveTime ? undefined : interpolate(frame, [0, fps * outro.dissolveTime], [0, 1]),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
          }}>
            <MyVideoComponent
              src={outro.url}
              fadeOutDuration={outro.duration > 5 ? 5 : outro.duration}
              totalDuration={outro.duration}
            />
          </div>
        </Sequence>
      )}

      {/* Watermark */}
      {watermark && watermarkStyle && (
        <Img
          src={watermark.url}
          style={watermarkStyle}
        />
      )}
    </AbsoluteFill>
  );
};

const MyVideoComponent = React.memo(({
  src,
  fadeOutDuration = 0, // Duration in seconds for fade out
  totalDuration // Total duration of the video in the sequence
}: {
  src: string;
  fadeOutDuration?: number;
  totalDuration?: number;
}) => {
  const [handle] = useState(() => delayRender());
  const { fps } = useVideoConfig();

  useEffect(() => {
    const video = document.createElement('video');
    video.src = src;
    video.onloadeddata = () => continueRender(handle);
    video.onerror = () => continueRender(handle);

    return () => {
      video.remove();
    };
  }, [src, handle]);

  const volume = useMemo(() => {
    if (!totalDuration || !fadeOutDuration) {
      return undefined;
    }
    return (frame: number) => {
      const fadeStart = Math.max(0, Math.round((totalDuration - fadeOutDuration) * fps));
      const fadeEnd = Math.round(Math.max(0, totalDuration - 1) * fps);

      return interpolate(
        frame,
        [fadeStart, fadeEnd],
        [1, 0],
        {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }
      );
    }
  }, [totalDuration, fadeOutDuration])

  return (
    <OffthreadVideo
      src={src}
      volume={volume}
      style={{
        width: '100%',
        height: 'auto',
        aspectRatio: '16 / 9'
      }}
    />
  );
});`;

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
