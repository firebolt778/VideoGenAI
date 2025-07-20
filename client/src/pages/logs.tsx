import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { AlertCircle, CheckCircle, Info, AlertTriangle, Filter, Download } from "lucide-react";
import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { JobLog } from "@shared/schema";

export default function Logs() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const { data: logs, isLoading, refetch } = useQuery<JobLog[]>({
    queryKey: ['/api/logs'],
  });

  const handleRefresh = () => {
    refetch();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-600" />;
      default:
        return <Info className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Success</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'warning':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Warning</Badge>;
      case 'info':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Info</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'channel':
        return <Badge variant="outline">Channel</Badge>;
      case 'video':
        return <Badge variant="outline">Video</Badge>;
      case 'template':
        return <Badge variant="outline">Template</Badge>;
      case 'thumbnail':
        return <Badge variant="outline">Thumbnail</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const filteredLogs = logs?.filter(log => {
    if (statusFilter !== "all" && log.status !== statusFilter) return false;
    if (typeFilter !== "all" && log.type !== typeFilter) return false;
    return true;
  }) || [];

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, typeFilter]);

  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (isLoading) {
    return (
      <>
        <Header
          title="Logs & Debug"
          description="View system logs and debug information"
          onRefresh={handleRefresh}
          showAddButton={false}
        />

        <div className="p-6">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-medium">System Logs</h3>
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
        title="Logs & Debug"
        description="View system logs and debug information"
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
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="channel">Channel</SelectItem>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="template">Template</SelectItem>
              <SelectItem value="thumbnail">Thumbnail</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1" />

          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Logs
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Success</p>
                  <p className="text-lg font-semibold">
                    {filteredLogs.filter(log => log.status === 'success').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Errors</p>
                  <p className="text-lg font-semibold">
                    {filteredLogs.filter(log => log.status === 'error').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Warnings</p>
                  <p className="text-lg font-semibold">
                    {filteredLogs.filter(log => log.status === 'warning').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Info className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Info</p>
                  <p className="text-lg font-semibold">
                    {filteredLogs.filter(log => log.status === 'info').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Recent Activity</h3>
              <span className="text-sm text-muted-foreground">
                Showing {filteredLogs.length} of {logs?.length || 0} logs
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No logs found matching the current filters.</p>
              </div>
            ) : (
              <>
                {/* Pagination Controls */}
                <div className="flex justify-between items-center p-4">
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                  <div className="space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Entity ID</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedLogs.map((log) => (
                        <TableRow key={log.id} className="hover:bg-muted/50">
                          <TableCell>
                            {getStatusIcon(log.status)}
                          </TableCell>
                          <TableCell>
                            {getTypeBadge(log.type)}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(log.status)}
                          </TableCell>
                          <TableCell className="max-w-md">
                            <div className="truncate" title={log.message}>
                              {log.message}
                            </div>
                            {!!log.details && (
                              <details className="mt-1">
                                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                  View details
                                </summary>
                                <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </details>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {log.entityId || '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatTime(log.createdAt.toString())}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
                {/* Pagination Controls */}
                <div className="flex justify-between items-center p-4">
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                  <div className="space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Auto-delete Notice */}
        <div className="mt-4">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">Automatic Cleanup</h4>
                  <p className="text-sm text-blue-800 mt-1">
                    Logs older than 7 days are automatically deleted to maintain system performance.
                    Export important logs if you need to keep them for longer periods.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
