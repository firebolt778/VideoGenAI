import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Eye, ThumbsUp, MessageSquare, Clock, Users } from "lucide-react";
import { useState } from "react";
import type { Channel, Video } from "@shared/schema";

interface ChannelWithStats extends Channel {
  videoCount?: number;
  totalViews?: number;
  totalLikes?: number;
  avgDuration?: number;
}

export default function Analytics() {
  const [timeRange, setTimeRange] = useState("30d");
  const [selectedChannel, setSelectedChannel] = useState<string>("all");

  const { data: channels, isLoading: channelsLoading } = useQuery<ChannelWithStats[]>({
    queryKey: ['/api/channels'],
  });

  const { data: videos, isLoading: videosLoading } = useQuery<Video[]>({
    queryKey: ['/api/videos'],
  });

  const handleRefresh = () => {
    // In a real app, this would refetch analytics data
    window.location.reload();
  };

  const isLoading = channelsLoading || videosLoading;

  // Mock analytics data - in production this would come from YouTube API
  const getChannelStats = (channelId: number) => {
    const channelVideos = videos?.filter(v => v.channelId === channelId) || [];
    return {
      videoCount: channelVideos.length,
      totalViews: Math.floor(Math.random() * 100000) + 10000, // Mock data
      totalLikes: Math.floor(Math.random() * 5000) + 500, // Mock data
      avgDuration: Math.floor(Math.random() * 600) + 300, // Mock data
    };
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <>
        <Header
          title="Analytics"
          description="Performance insights and statistics for your channels"
          onRefresh={handleRefresh}
          showAddButton={false}
        />

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </>
    );
  }

  // Calculate overall stats
  const totalChannels = channels?.length || 0;
  const totalVideos = videos?.length || 0;
  const activeChannels = channels?.filter(c => c.isActive).length || 0;
  const totalViews = channels?.reduce((sum, channel) => {
    const stats = getChannelStats(channel.id);
    return sum + stats.totalViews;
  }, 0) || 0;

  const overallStats = [
    {
      title: "Total Views",
      value: formatNumber(totalViews),
      icon: Eye,
      trend: "+12.3%",
      isPositive: true,
    },
    {
      title: "Active Channels",
      value: activeChannels.toString(),
      icon: Users,
      trend: `${totalChannels} total`,
      isPositive: true,
    },
    {
      title: "Videos Published",
      value: totalVideos.toString(),
      icon: TrendingUp,
      trend: "+5 this week",
      isPositive: true,
    },
    {
      title: "Avg. Watch Time",
      value: "8:42",
      icon: Clock,
      trend: "+15.2%",
      isPositive: true,
    },
  ];

  return (
    <>
      <Header
        title="Analytics"
        description="Performance insights and statistics for your channels"
        onRefresh={handleRefresh}
        showAddButton={false}
      />

      <div className="p-6">
        {/* Filter Controls */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedChannel} onValueChange={setSelectedChannel}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              {channels?.map((channel) => (
                <SelectItem key={channel.id} value={channel.id.toString()}>
                  {channel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Overall Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {overallStats.map((stat, index) => {
            const Icon = stat.icon;
            
            return (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                      <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
                      <div className="flex items-center mt-1">
                        {stat.isPositive ? (
                          <TrendingUp className="w-3 h-3 text-emerald-600 mr-1" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-red-600 mr-1" />
                        )}
                        <span className={`text-xs ${stat.isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                          {stat.trend}
                        </span>
                      </div>
                    </div>
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Channel Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-medium">Channel Performance</h3>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel</TableHead>
                    <TableHead>Videos</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {channels?.map((channel) => {
                    const stats = getChannelStats(channel.id);
                    return (
                      <TableRow key={channel.id}>
                        <TableCell>
                          <div className="font-medium">{channel.name}</div>
                        </TableCell>
                        <TableCell>{stats.videoCount}</TableCell>
                        <TableCell>{formatNumber(stats.totalViews)}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={channel.isActive ? "default" : "secondary"}
                            className={channel.isActive ? "bg-emerald-100 text-emerald-800" : ""}
                          >
                            {channel.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-lg font-medium">Recent Videos</h3>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videos?.slice(0, 5).map((video) => (
                    <TableRow key={video.id}>
                      <TableCell>
                        <div className="font-medium truncate max-w-xs" title={video.title}>
                          {video.title}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={video.status === 'published' ? "default" : "secondary"}
                          className={
                            video.status === 'published' 
                              ? "bg-emerald-100 text-emerald-800" 
                              : video.status === 'error' 
                              ? "bg-red-100 text-red-800"
                              : ""
                          }
                        >
                          {video.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(video.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* YouTube API Notice */}
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <TrendingUp className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-900">Analytics Data</h4>
                <p className="text-sm text-amber-800 mt-1">
                  Detailed analytics data will be available once YouTube API integration is configured. 
                  Current data shown is for demonstration purposes. Real metrics will include views, 
                  watch time, subscriber growth, and engagement rates.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
