import { useQuery, useMutation } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tv, Play, Clock, AlertTriangle, PlayCircle, PauseCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";

interface DashboardStats {
  activeChannels: number;
  videosGenerated: number;
  queuedVideos: number;
  failedJobs: number;
}

interface ScheduledJob {
  id: string;
  channelId: number;
  templateId: number;
  scheduledAt: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  retryCount: number;
  maxRetries: number;
}

export default function Dashboard() {
  const { toast } = useToast();
  
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/stats'],
  });

  const { data: scheduledJobs, refetch: refetchJobs } = useQuery<ScheduledJob[]>({
    queryKey: ['/api/scheduler/jobs'],
  });

  const startSchedulerMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/scheduler/start');
    },
    onSuccess: () => {
      toast({
        title: "Scheduler started",
        description: "Automated video generation is now active",
      });
      refetchJobs();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to start scheduler",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const stopSchedulerMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/scheduler/stop');
    },
    onSuccess: () => {
      toast({
        title: "Scheduler stopped",
        description: "Automated video generation has been paused",
      });
      refetchJobs();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to stop scheduler",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const statCards = [
    {
      title: "Active Channels",
      value: stats?.activeChannels ?? 0,
      icon: Tv,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Videos Generated",
      value: stats?.videosGenerated ?? 0,
      icon: Play,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
    },
    {
      title: "Queued Videos",
      value: stats?.queuedVideos ?? 0,
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
    },
    {
      title: "Failed Jobs",
      value: stats?.failedJobs ?? 0,
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
  ];

  const pendingJobs = scheduledJobs?.filter(job => job.status === 'pending') || [];
  const runningJobs = scheduledJobs?.filter(job => job.status === 'running') || [];

  return (
    <>
      <Header
        title="Dashboard"
        description="Overview of your video automation system"
        showAddButton={false}
        showRefreshButton={false}
      />

      <div className="p-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            
            return (
              <Card key={index} className="stat-card">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className={`w-8 h-8 ${stat.bgColor} rounded-lg flex items-center justify-center`}>
                        <Icon className={`w-4 h-4 ${stat.color}`} />
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                      {isLoading ? (
                        <Skeleton className="h-8 w-16 mt-1" />
                      ) : (
                        <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Scheduler Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-medium text-foreground mb-4">Scheduler Control</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Automated Generation</span>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      onClick={() => startSchedulerMutation.mutate()}
                      disabled={startSchedulerMutation.isPending}
                    >
                      <PlayCircle className="w-4 h-4 mr-2" />
                      Start
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => stopSchedulerMutation.mutate()}
                      disabled={stopSchedulerMutation.isPending}
                    >
                      <PauseCircle className="w-4 h-4 mr-2" />
                      Stop
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Pending Jobs</span>
                  <span className="font-semibold">{pendingJobs.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Running Jobs</span>
                  <span className="font-semibold">{runningJobs.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-medium text-foreground mb-4">System Status</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">AI Services</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                    Operational
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Video Rendering</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                    Operational
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">YouTube API</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                    Operational
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-medium text-foreground mb-4">Recent Scheduled Jobs</h3>
            {scheduledJobs && scheduledJobs.length > 0 ? (
              <div className="space-y-3">
                {scheduledJobs.slice(0, 5).map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Channel {job.channelId}</p>
                      <p className="text-xs text-muted-foreground">
                        Scheduled: {new Date(job.scheduledAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant={job.status === 'completed' ? 'default' : job.status === 'failed' ? 'destructive' : 'secondary'}>
                      {job.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No scheduled jobs found.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
