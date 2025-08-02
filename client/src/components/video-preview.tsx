import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Download, ExternalLink, Eye } from 'lucide-react';
import type { Video } from '@shared/schema';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useToast } from '@/hooks/use-toast';

interface VideoPreviewProps {
  video: Video;
  isOpen: boolean;
  onClose: () => void;
}

export default function VideoPreview({ video, isOpen, onClose }: VideoPreviewProps) {
  const [content, setContent] = useState<string>("");
  const { toast } = useToast();

  const fetchLog = async (type: string) => {
    setContent("");
    try {
      const response = await fetch(`/api/logs/${video.id}/${type}`);
      let text = await response.json() as string;
      text = text.replaceAll("\n", "<br />");
      text = text.replaceAll("  ", "&nbsp;&nbsp;");
      setContent(text);
    } catch (e) {
      console.error(e);
      toast({ title: `Failed to fetch AI response: ${(e as Error).message}`, variant: "destructive" });
    }
  }

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

  useEffect(() => {
    if (!video.id) return;
    fetchLog("idea");
  }, [video.id]);

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
              >
                <source src={video.videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
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
                      onClick={() => window.open(`${window.location.origin}/api/thumbnails/${video.id}` || '', '_blank')}
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
                <Tabs defaultValue="idea" className="w-full" onValueChange={(e) => fetchLog(e)}>
                  <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="idea" className="flex items-center gap-1">
                      Selected Idea
                    </TabsTrigger>
                    <TabsTrigger value="outline" className="flex items-center gap-1">
                      Outline
                    </TabsTrigger>
                    <TabsTrigger value="fullScript" className="flex items-center gap-1">
                      Full Script
                    </TabsTrigger>
                    <TabsTrigger value="hook" className="flex items-center gap-1">
                      Hook
                    </TabsTrigger>
                    <TabsTrigger value="images" className="flex items-center gap-1">
                      Image Prompt
                    </TabsTrigger>
                    <TabsTrigger value="imageAssignments" className="flex items-center gap-1">
                      Image Assignment
                    </TabsTrigger>
                  </TabsList>
                  <div className="rounded p-3 bg-muted mt-1">
                    <TabsContent value="idea" className="space-y-6">
                      <div dangerouslySetInnerHTML={{ __html: content }} />
                    </TabsContent>
                    <TabsContent value="outline" className="space-y-6 overflow-auto">
                      <div dangerouslySetInnerHTML={{ __html: content }} />
                    </TabsContent>
                    <TabsContent value="fullScript" className="space-y-6">
                      <div dangerouslySetInnerHTML={{ __html: content }} />
                    </TabsContent>
                    <TabsContent value="hook" className="space-y-6">
                      <div dangerouslySetInnerHTML={{ __html: content }} />
                    </TabsContent>
                    <TabsContent value="images" className="space-y-6">
                      <div dangerouslySetInnerHTML={{ __html: content }} />
                    </TabsContent>
                    <TabsContent value="imageAssignments" className="space-y-6">
                      <div dangerouslySetInnerHTML={{ __html: content }} />
                    </TabsContent>
                  </div>
                </Tabs>
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