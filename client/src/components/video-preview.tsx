import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Download, 
  ExternalLink,
  Clock,
  Eye
} from 'lucide-react';
import type { Video } from '@shared/schema';

interface VideoPreviewProps {
  video: Video;
  isOpen: boolean;
  onClose: () => void;
}

export default function VideoPreview({ video, isOpen, onClose }: VideoPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const handlePlayPause = () => {
    const videoElement = document.getElementById('video-player') as HTMLVideoElement;
    if (videoElement) {
      if (isPlaying) {
        videoElement.pause();
      } else {
        videoElement.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleMuteToggle = () => {
    const videoElement = document.getElementById('video-player') as HTMLVideoElement;
    if (videoElement) {
      videoElement.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleTimeUpdate = () => {
    const videoElement = document.getElementById('video-player') as HTMLVideoElement;
    if (videoElement) {
      setCurrentTime(videoElement.currentTime);
      setDuration(videoElement.duration);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-emerald-100 text-emerald-800">Published</Badge>;
      case 'rendering':
        return <Badge className="bg-blue-100 text-blue-800">Rendering</Badge>;
      case 'generating':
        return <Badge className="bg-yellow-100 text-yellow-800">Generating</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Video Preview</span>
            {getStatusBadge(video.status || '')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Video Player */}
          {video.videoUrl && (
            <div className="relative">
              <video
                id="video-player"
                className="w-full aspect-video bg-black rounded-lg"
                controls
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              >
                <source src={video.videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>

              {/* Custom Controls Overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePlayPause}
                      className="text-white hover:bg-white/20"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleMuteToggle}
                      className="text-white hover:bg-white/20"
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </Button>
                    <span className="text-sm">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Video Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-2">Video Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Title:</span>
                    <span className="font-medium">{video.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="font-medium">
                      {video.duration ? formatTime(video.duration) : 'Unknown'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created:</span>
                    <span className="font-medium">
                      {new Date(video.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {video.youtubeId && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">YouTube ID:</span>
                      <span className="font-medium">{video.youtubeId}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-2">Actions</h3>
                <div className="space-y-2">
                  {video.videoUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => window.open(video.videoUrl || '', '_blank')}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Video
                    </Button>
                  )}
                  {video.youtubeId && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => window.open(`https://youtube.com/watch?v=${video.youtubeId}`, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View on YouTube
                    </Button>
                  )}
                  {video.thumbnailUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => window.open(video.thumbnailUrl || '', '_blank')}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Thumbnail
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Script Preview */}
          {video.script && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-2">Script</h3>
                <div className="bg-muted p-3 rounded-lg text-sm max-h-40 overflow-y-auto">
                  {video.script}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Message */}
          {video.errorMessage && (
            <Card className="border-red-200">
              <CardContent className="p-4">
                <h3 className="font-medium mb-2 text-red-800">Error</h3>
                <div className="bg-red-50 p-3 rounded-lg text-sm text-red-700">
                  {video.errorMessage}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 