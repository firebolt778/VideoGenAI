import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TestTube, Play, Download, Eye, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Channel, VideoTemplate } from "@shared/schema";

interface VideoTestPanelProps {
  channel: Channel;
}

interface TestProgress {
  stage: string;
  progress: number;
  message: string;
}

export default function VideoTestPanel({ channel }: VideoTestPanelProps) {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [testProgress, setTestProgress] = useState<TestProgress | null>(null);
  const [currentVideoId, setCurrentVideoId] = useState<number | null>(null);
  const [isVideoPreviewOpen, setIsVideoPreviewOpen] = useState(false);

  const { data: templates } = useQuery<VideoTemplate[]>({
    queryKey: ['/api/video-templates'],
  });

  const { data: currentVideo } = useQuery({
    queryKey: ['/api/videos', currentVideoId],
    queryFn: async () => {
      if (!currentVideoId) return null;
      const response = await apiRequest("GET", `/api/videos/${currentVideoId}`);
      return response.json();
    },
    enabled: !!currentVideoId,
  });

  const generateTestVideoMutation = useMutation({
    mutationFn: async ({ channelId, templateId }: { channelId: number; templateId: number }) => {
      const response = await apiRequest("POST", "/api/generate-video", {
        channelId,
        templateId,
        testMode: true
      });
      return response;
    },
    onSuccess: (res) => {
      toast({ title: "Test video generation started" });
      res.json().then((data) => pollProgress(data.videoId));
    },
    onError: () => {
      toast({ title: "Failed to start test generation", variant: "destructive" });
    },
  });

  const pollProgress = (videoId: number) => {
    const interval = setInterval(async () => {
      try {
        const response = await apiRequest("GET", `/api/videos/${videoId}/progress`);
        const progress: TestProgress & { error?: string } = await response.json();
        setTestProgress(progress);
        
        if (progress.progress >= 100 || progress.error) {
          clearInterval(interval);
          if (progress.error) {
            toast({ title: "Test generation failed", variant: "destructive" });
          } else {
            setCurrentVideoId(videoId);
            toast({ title: "Test video completed successfully" });
          }
        }
      } catch (error) {
        console.error('Error polling progress:', error);
        clearInterval(interval);
      }
    }, 2000);
  };

  const handleGenerateTest = () => {
    if (!selectedTemplate) {
      toast({ title: "Please select a template", variant: "destructive" });
      return;
    }
    
    generateTestVideoMutation.mutate({
      channelId: channel.id,
      templateId: selectedTemplate
    });
  };

  const handleDownloadVideo = () => {
    if (!currentVideoId) {
      toast({ title: "No video available for download", variant: "destructive" });
      return;
    }

    // Create a temporary link to trigger download
    const link = document.createElement('a');
    link.href = `/api/videos/${currentVideoId}/download`;
    link.download = `test_video_${currentVideoId}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: "Download started" });
  };

  const handlePreviewVideo = () => {
    if (!currentVideoId) {
      toast({ title: "No video available for preview", variant: "destructive" });
      return;
    }

    // Open video preview modal
    setIsVideoPreviewOpen(true);
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case "complete":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      "initialization": "Initializing",
      "idea_selection": "Selecting Idea",
      "outline": "Creating Outline",
      "script": "Writing Script",
      "hook": "Generating Hook",
      "images": "Creating Images",
      "image_assignment": "Assigning Images",
      "audio": "Generating Audio",
      "rendering": "Rendering Video",
      "thumbnail": "Creating Thumbnail",
      "complete": "Complete"
    };
    return labels[stage] || stage;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          Test Video Generation
        </CardTitle>
        <CardDescription>
          Generate a test video locally without affecting your publishing schedule or using up ideas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Template Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Template</label>
          <Select 
            value={selectedTemplate?.toString() || ""} 
            onValueChange={(value) => setSelectedTemplate(parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a video template" />
            </SelectTrigger>
            <SelectContent>
              {templates?.map((template) => (
                <SelectItem key={template.id} value={template.id.toString()}>
                  <div className="flex items-center justify-between w-full">
                    <span>{template.name}</span>
                    <Badge variant="outline" className="ml-2">
                      {template.type}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Progress Display */}
        {testProgress && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStageIcon(testProgress.stage)}
                  <span className="text-sm font-medium">
                    {getStageLabel(testProgress.stage)}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {testProgress.progress}%
                </span>
              </div>
              <Progress value={testProgress.progress} className="h-2" />
              <p className="text-sm text-muted-foreground">
                {testProgress.message}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleGenerateTest}
            disabled={!selectedTemplate || generateTestVideoMutation.isPending || !!(testProgress?.progress && testProgress.progress < 100)}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            {generateTestVideoMutation.isPending ? "Generating..." : "Generate Test Video"}
          </Button>
          
          {testProgress?.progress === 100 && (
            <>
              <Button variant="outline" size="sm" onClick={handlePreviewVideo}>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadVideo}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </>
          )}
        </div>

        {/* Info Alert */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Test videos are generated locally and won't be published to YouTube. 
            This allows you to verify your template settings without consuming ideas or affecting your channel.
          </AlertDescription>
        </Alert>
      </CardContent>

      {/* Video Preview Modal */}
      <Dialog open={isVideoPreviewOpen} onOpenChange={setIsVideoPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                <span>Video Preview</span>
                {currentVideo?.title && (
                  <Badge variant="secondary" className="text-xs">
                    {currentVideo.title}
                  </Badge>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="relative">
            {currentVideoId && (
              <video
                controls
                className="w-full h-auto max-h-[70vh] rounded-lg"
                src={`/api/videos/${currentVideoId}/preview`}
              >
                Your browser does not support the video tag.
              </video>
            )}
            {currentVideo && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Video Details</h4>
                <div className="text-sm space-y-1">
                  <p><strong>Title:</strong> {currentVideo.title}</p>
                  <p><strong>Status:</strong> {currentVideo.status}</p>
                  <p><strong>Created:</strong> {new Date(currentVideo.createdAt).toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}