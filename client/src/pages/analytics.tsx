import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { 
  Play, 
  Eye, 
  ThumbsUp, 
  MessageCircle, 
  TrendingUp,
  Calendar,
  Clock
} from "lucide-react";

interface AnalyticsData {
  totalVideos: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  videosThisWeek: number;
  averageDuration: number;
  successRate: number;
  channelStats: Array<{
    name: string;
    videos: number;
    views: number;
  }>;
  statusDistribution: Array<{
    status: string;
    count: number;
  }>;
  weeklyProgress: Array<{
    date: string;
    videos: number;
    views: number;
  }>;
}

export default function Analytics() {
  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['/api/analytics'],
    initialData: {
      totalVideos: 24,
      totalViews: 15420,
      totalLikes: 892,
      totalComments: 156,
      videosThisWeek: 7,
      averageDuration: 180,
      successRate: 94.2,
      channelStats: [
        { name: "Story Channel", videos: 12, views: 8200 },
        { name: "News Channel", videos: 8, views: 5600 },
        { name: "Educational", videos: 4, views: 1620 }
      ],
      statusDistribution: [
        { status: "Published", count: 20 },
        { status: "Generating", count: 2 },
        { status: "Error", count: 2 }
      ],
      weeklyProgress: [
        { date: "Mon", videos: 2, views: 1200 },
        { date: "Tue", videos: 1, views: 800 },
        { date: "Wed", videos: 3, views: 2100 },
        { date: "Thu", videos: 2, views: 1500 },
        { date: "Fri", videos: 1, views: 900 },
        { date: "Sat", videos: 0, views: 600 },
        { date: "Sun", videos: 1, views: 1100 }
      ]
    }
  });

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  const statCards = [
    {
      title: "Total Videos",
      value: analytics?.totalVideos || 0,
      icon: Play,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Total Views",
      value: analytics?.totalViews?.toLocaleString() || 0,
      icon: Eye,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Total Likes",
      value: analytics?.totalLikes?.toLocaleString() || 0,
      icon: ThumbsUp,
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
    {
      title: "Success Rate",
      value: `${analytics?.successRate || 0}%`,
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
  ];

  return (
    <>
      <Header
        title="Analytics"
        description="Track your video performance and system statistics"
        showAddButton={false}
        showRefreshButton={false}
      />

      <div className="p-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            
            return (
              <Card key={index}>
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

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Weekly Progress */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly Video Generation</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics?.weeklyProgress}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="videos" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Channel Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Channel Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics?.channelStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="videos" fill="#82ca9d" />
                  <Bar dataKey="views" fill="#ffc658" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Status Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Video Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics?.statusDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ status, percent }) => `${status} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {analytics?.statusDistribution?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Additional Stats */}
          <Card>
            <CardHeader>
              <CardTitle>System Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Videos This Week</span>
                  </div>
                  <span className="font-semibold">{analytics?.videosThisWeek}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Average Duration</span>
                  </div>
                  <span className="font-semibold">{Math.floor((analytics?.averageDuration || 0) / 60)}:{(analytics?.averageDuration || 0) % 60}s</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MessageCircle className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Total Comments</span>
                  </div>
                  <span className="font-semibold">{analytics?.totalComments?.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </>
  );
}
