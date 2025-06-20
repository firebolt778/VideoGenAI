import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tv, Play, Clock, AlertTriangle } from "lucide-react";

interface DashboardStats {
  activeChannels: number;
  videosGenerated: number;
  queuedVideos: number;
  failedJobs: number;
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/stats'],
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

        {/* Recent Activity or Additional Dashboard Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-medium text-foreground mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent transition-colors">
                  <div className="font-medium text-foreground">Create Test Video</div>
                  <div className="text-sm text-muted-foreground">Generate a test video without publishing</div>
                </button>
                <button className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent transition-colors">
                  <div className="font-medium text-foreground">View Logs</div>
                  <div className="text-sm text-muted-foreground">Check recent system activity</div>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
