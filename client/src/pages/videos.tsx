import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Play, 
  ExternalLink, 
  Download, 
  Eye, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Filter,
  Calendar
} from "lucide-react";
import VideoPreview from "@/components/video-preview";
import type { Video, Channel, VideoTemplate } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface VideoWithDetails extends Video {
  channel?: Channel;
  template?: VideoTemplate;
}

export default function Videos() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [selectedVideo, setSelectedVideo] = useState<VideoWithDetails | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleVideo, setScheduleVideo] = useState<VideoWithDetails | null>(null);
  const [scheduledAt, setScheduledAt] = useState<string>("");

  const { data: videos, isLoading, refetch } = useQuery<VideoWithDetails[]>({
    queryKey: ['/api/videos'],
  });

  const { data: channels } = useQuery<Channel[]>({
    queryKey: ['/api/channels'],
  });

  const handleRefresh = () => {
    refetch();
  };

  const handlePreviewVideo = (video: VideoWithDetails) => {
    let videoUrl = video.videoUrl;
    if (videoUrl) {
      const id = videoUrl.split('_')[1].split('.')[0];
      videoUrl = `/api/videos/${id}/preview`;
    }
    setSelectedVideo({
      ...video,
      videoUrl
    });
    setPreviewOpen(true);
  };

  const handleDownloadVideo = (videoUrl: string) => {
    const id = videoUrl.split('_')[1].split('.')[0];
    window.open(`/api/videos/${id}/download`, '_blank');
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'queued':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Queued</Badge>;
      case 'generating':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Generating</Badge>;
      case 'rendering':
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Rendering</Badge>;
      case 'uploading':
        return <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100">Uploading</Badge>;
      case 'published':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Published</Badge>;
      case 'test_complete':
        return <Badge className="bg-cyan-100 text-cyan-800 hover:bg-cyan-100">Test Complete</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'generating':
      case 'rendering':
      case 'uploading':
        return <Play className="w-4 h-4 text-yellow-600" />;
      case 'published':
      case 'test_complete':
        return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const filteredVideos = videos?.filter(video => {
    if (statusFilter !== "all" && video.status !== statusFilter) return false;
    if (channelFilter !== "all" && video.channelId.toString() !== channelFilter) return false;
    return true;
  }) || [];

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "Unknown";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const scheduleMutation = useMutation({
    mutationFn: async ({ videoId, scheduledAt }: { videoId: number; scheduledAt: string }) => {
      const res = await fetch(`/api/videos/${videoId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt }),
      });
      if (!res.ok) throw new Error("Failed to schedule video");
      return res.json();
    },
    onSuccess: () => {
      setScheduleModalOpen(false);
      setScheduleVideo(null);
      setScheduledAt("");
      refetch();
    },
    onError: () => {
      toast({ title: "Failed to schedule video", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <>
        <Header
          title="Video Management"
          description="View and manage all generated videos"
          onRefresh={handleRefresh}
          showAddButton={false}
        />

        <div className="p-6">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-medium">Generated Videos</h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 p-4">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title="Video Management"
        description="View and manage all generated videos"
        onRefresh={handleRefresh}
        showAddButton={false}
      />

      <div className="p-6">
        {/* Filter Controls */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters:</span>
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="generating">Generating</SelectItem>
              <SelectItem value="rendering">Rendering</SelectItem>
              <SelectItem value="uploading">Uploading</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="test_complete">Test Complete</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>

          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Channels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              {channels?.map(channel => (
                <SelectItem key={channel.id} value={channel.id.toString()}>
                  {channel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex-1" />

          <div className="text-sm text-muted-foreground">
            {filteredVideos.length} video{filteredVideos.length !== 1 ? 's' : ''} found
          </div>
        </div>

        {/* Videos Table */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium">Generated Videos</h3>
          </CardHeader>
          <CardContent className="p-0">
            {!filteredVideos || filteredVideos.length === 0 ? (
              <div className="text-center py-8 px-6">
                <p className="text-muted-foreground mb-4">No videos found. Generate your first video to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVideos.map((video) => (
                      <TableRow key={video.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(video.status || '')}
                            {getStatusBadge(video.status || '')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-foreground">{video.title}</div>
                            {video.errorMessage && (
                              <div className="text-sm text-red-600 mt-1">
                                {video.errorMessage}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {video.channel?.name || `Channel ${video.channelId}`}
                        </TableCell>
                        <TableCell className="text-sm">
                          {video.template?.name || `Template ${video.templateId}`}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDuration(video.duration || 0)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(video.createdAt.toString())}
                        </TableCell>
                        <TableCell className="text-sm">
                          {video.scheduledAt ? formatDate(video.scheduledAt.toString()) : <span className="text-muted-foreground">Not scheduled</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {video.videoUrl && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title="Preview Video"
                                onClick={() => handlePreviewVideo(video)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            {video.youtubeId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title="View on YouTube"
                                onClick={() => window.open(`https://youtube.com/watch?v=${video.youtubeId}`, '_blank')}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                            {video.videoUrl && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title="Download Video"
                                onClick={() => handleDownloadVideo(video.videoUrl || '')}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Schedule Publish"
                              onClick={() => {
                                setScheduleVideo(video);
                                setScheduledAt(video.scheduledAt ? video.scheduledAt.toISOString().slice(0, 16) : "");
                                setScheduleModalOpen(true);
                              }}
                            >
                              <Calendar className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Video Preview Dialog */}
      {selectedVideo && (
        <VideoPreview
          video={selectedVideo}
          isOpen={previewOpen}
          onClose={() => {
            setPreviewOpen(false);
            setSelectedVideo(null);
          }}
        />
      )}

      <Dialog open={scheduleModalOpen} onOpenChange={setScheduleModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Video Publish</DialogTitle>
            <DialogDescription>
              Select a date and time to schedule this video for YouTube publication.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
            />
            <Button
              onClick={() => {
                if (scheduleVideo && scheduledAt) {
                  scheduleMutation.mutate({ videoId: scheduleVideo.id, scheduledAt });
                }
              }}
              disabled={!scheduledAt || scheduleMutation.isPending}
            >
              {scheduleMutation.isPending ? "Scheduling..." : "Schedule"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 