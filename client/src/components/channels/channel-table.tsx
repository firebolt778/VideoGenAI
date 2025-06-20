import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Edit, Play, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Channel } from "@shared/schema";

interface ChannelTableProps {
  channels: Channel[];
  isLoading: boolean;
  onRefresh: () => void;
}

export default function ChannelTable({ channels, isLoading, onRefresh }: ChannelTableProps) {
  const { toast } = useToast();
  const [testingChannelId, setTestingChannelId] = useState<number | null>(null);

  const testVideoMutation = useMutation({
    mutationFn: async (channelId: number) => {
      return await apiRequest('POST', `/api/videos/test/${channelId}`);
    },
    onSuccess: () => {
      toast({
        title: "Test video started",
        description: "Test video generation has been initiated",
      });
      setTestingChannelId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to start test video",
        description: error.message,
        variant: "destructive",
      });
      setTestingChannelId(null);
    },
  });

  const deleteChannelMutation = useMutation({
    mutationFn: async (channelId: number) => {
      return await apiRequest('DELETE', `/api/channels/${channelId}`);
    },
    onSuccess: () => {
      toast({
        title: "Channel deleted",
        description: "Channel has been successfully deleted",
      });
      onRefresh();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete channel",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleTestVideo = (channelId: number) => {
    setTestingChannelId(channelId);
    testVideoMutation.mutate(channelId);
  };

  const handleDeleteChannel = (channelId: number) => {
    if (confirm("Are you sure you want to delete this channel?")) {
      deleteChannelMutation.mutate(channelId);
    }
  };

  const getStatusBadge = (status: string, isActive: boolean) => {
    if (!isActive) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Active</Badge>;
      case 'processing':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Processing</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const formatSchedule = (schedule: string, videosMin: number, videosMax: number) => {
    if (videosMin === videosMax) {
      return `${videosMin} video${videosMin !== 1 ? 's' : ''}/${schedule === 'daily' ? 'day' : 'week'}`;
    }
    return `${videosMin}-${videosMax} videos/${schedule === 'daily' ? 'day' : 'week'}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-lg font-medium">Your Channels</h3>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4 p-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (channels.length === 0) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-lg font-medium">Your Channels</h3>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">No channels found. Add your first channel to get started.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-medium">Your Channels</h3>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Templates</TableHead>
                <TableHead>Last Video</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels.map((channel) => (
                <TableRow key={channel.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={channel.logoUrl || undefined} alt={channel.name} />
                        <AvatarFallback className="bg-gradient-to-r from-purple-400 to-pink-400 text-white">
                          {getInitials(channel.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-foreground">{channel.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {channel.url ? new URL(channel.url).pathname.replace('/', '@') : 'No URL set'}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(channel.status || 'inactive', channel.isActive || false)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatSchedule(channel.schedule || 'daily', channel.videosMin || 1, channel.videosMax || 2)}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      <Badge variant="secondary" className="text-xs">Story</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {channel.lastVideoGenerated 
                      ? new Date(channel.lastVideoGenerated).toLocaleDateString()
                      : 'Never'
                    }
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Edit Channel"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700"
                        title="Test Video"
                        onClick={() => handleTestVideo(channel.id)}
                        disabled={testingChannelId === channel.id}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        title="Delete Channel"
                        onClick={() => handleDeleteChannel(channel.id)}
                        disabled={deleteChannelMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
