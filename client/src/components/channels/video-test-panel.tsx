import { useEffect, useRef, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

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
  const [logs, setLogs] = useState<TestProgress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [testProgress, setTestProgress] = useState<TestProgress | null>(null);
  const [currentVideoId, setCurrentVideoId] = useState<number | null>(null);
  const [isVideoPreviewOpen, setIsVideoPreviewOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const consoleRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!testProgress) return;
    const lastLog = logs[logs.length - 1];
    if (!lastLog || lastLog.progress !== testProgress.progress) {
      setLogs(prev => [...prev, testProgress]);
    }
  }, [testProgress, logs]);
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current?.scrollTo({
        top: consoleRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [logs, consoleRef.current]);

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
          setIsGenerating(false);
          if (progress.error) {
            setError(progress.error);
            toast({ title: "Test generation failed", variant: "destructive" });
          } else {
            setCurrentVideoId(videoId);
            toast({ title: "Test video completed successfully" });
          }
        }
      } catch (error) {
        console.error('Error polling progress:', error);
        clearInterval(interval);
        setIsGenerating(false);
      }
    }, 2000);
  };

  const getNextStepMessage = (stage: string) => {
    const labels: Record<string, string> = {
      "initialization": "Initializing ...",
      "idea_selection": "Creating Outline ...",
      "outline": "Writing Script ...",
      "script": "Generating Hook ...",
      "hook": "Creating Images ...",
      "images": "Assigning Images ...",
      "image_assignment": "Generating Audio ...",
      "audio": "Rendering Video ...",
      "rendering": "Creating Thumbnail ...",
      "thumbnail": "Finalizing ...",
      "complete": "Completed"
    };
    return labels[stage] || stage;
  }

  const handleGenerateTest = () => {
    if (!selectedTemplate) {
      toast({ title: "Please select a template", variant: "destructive" });
      return;
    }
    setTestProgress(null);
    setLogs([]);
    setIsGenerating(true);
    generateTestVideoMutation.mutate({
      channelId: channel.id,
      templateId: selectedTemplate,
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
        {isGenerating && (
          <div className="space-y-4">
            <Progress value={testProgress?.progress || 0} className="h-2" />
            <div
              className="space-y-2 bg-gray-800 text-white rounded-lg p-4 max-h-36 overflow-auto"
              ref={consoleRef}
            >
              {logs.map((log, index) => (
                <div key={index}>{log.message}</div>
              ))}
              <div className="flex items-center gap-2">
                {getStageIcon(testProgress?.stage || "initialization")}
                <span>{testProgress?.progress || 0}%</span>
                <span>{getNextStepMessage(testProgress?.stage || "initialization")}</span>
              </div>
              {!!error && (
                <div className="text-red-400">{error}</div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleGenerateTest}
            disabled={!selectedTemplate || isGenerating || !!(testProgress?.progress && testProgress.progress < 100)}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            {isGenerating ? "Generating..." : testProgress?.progress === 100 ? "Generate Again" : "Generate Test Video"}
          </Button>

          {testProgress?.progress === 100 && !isGenerating && (
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
        <DialogContent className="max-w-4xl max-h-full overflow-auto">
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
              <>
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Video Details</h4>
                  <div className="text-sm space-y-1">
                    <p><strong>Title:</strong> {currentVideo.title}</p>
                    <p><strong>Created:</strong> {new Date(currentVideo.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <h3 className="mt-4">View Logs:</h3>
                <AiResponse videoId={currentVideo.id} />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

const AiResponse = ({ videoId }: { videoId: number }) => {
  const [content, setContent] = useState<string>("");
  const { toast } = useToast();

  const fetchLog = async (type: string) => {
    setContent("");
    try {
      const response = await fetch(`/api/logs/${videoId}/${type}`);
      let text = await response.json() as string;
      if (type === "outline") {
        text = text.replaceAll("\n", "<br />");
        text = text.replaceAll("  ", "&nbsp;&nbsp;");
      }
      setContent(text);
    } catch (e) {
      console.error(e);
      toast({ title: `Failed to fetch AI response: ${(e as Error).message}`, variant: "destructive" });
    }
  }

  useEffect(() => {
    if (!videoId) return;
    fetchLog("idea");
  }, [videoId]);

  return (
    <div className="border rounded-lg p-4 bg-muted/30 mt-2">
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
        </TabsList>
        <div className="rounded p-3 bg-muted mt-1">
          <TabsContent value="idea" className="space-y-6">
            {content}
          </TabsContent>
          <TabsContent value="outline" className="space-y-6 overflow-auto">
            <div dangerouslySetInnerHTML={{ __html: content }} />
          </TabsContent>
          <TabsContent value="fullScript" className="space-y-6">
            {content}
          </TabsContent>
          <TabsContent value="hook" className="space-y-6">
            {content}
          </TabsContent>
          <TabsContent value="images" className="space-y-6">
            {content}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
