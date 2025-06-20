import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Edit, Copy, Trash2, Plus } from "lucide-react";
import EnhancedStoryTemplateForm from "@/components/templates/enhanced-story-template-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { VideoTemplate } from "@shared/schema";

export default function VideoTemplates() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<VideoTemplate | null>(null);

  const { data: templates, isLoading, refetch } = useQuery<VideoTemplate[]>({
    queryKey: ['/api/video-templates'],
  });

  const handleRefresh = () => {
    refetch();
  };

  const handleAddTemplate = () => {
    setEditingTemplate(null);
    setIsFormOpen(true);
  };

  const handleEditTemplate = (template: VideoTemplate) => {
    setEditingTemplate(template);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingTemplate(null);
    refetch();
  };

  const getTemplateTypeBadge = (type: string) => {
    switch (type) {
      case 'story':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Story</Badge>;
      case 'news':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">News</Badge>;
      case 'educational':
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Educational</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <>
        <Header
          title="Video Templates"
          description="Create and manage video templates for automated content generation"
          onRefresh={handleRefresh}
          onAdd={handleAddTemplate}
          addButtonText="Add Template"
        />

        <div className="p-6">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-medium">Your Templates</h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 p-4">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-20" />
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
        title="Video Templates"
        description="Create and manage video templates for automated content generation"
        onRefresh={handleRefresh}
        onAdd={handleAddTemplate}
        addButtonText="Add Template"
      />

      <div className="p-6">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium">Your Templates</h3>
          </CardHeader>
          <CardContent className="p-0">
            {!templates || templates.length === 0 ? (
              <div className="text-center py-8 px-6">
                <p className="text-muted-foreground mb-4">No templates found. Create your first template to get started.</p>
                <Button onClick={handleAddTemplate}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Story Template
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Image Model</TableHead>
                      <TableHead>Audio Model</TableHead>
                      <TableHead>Captions</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((template) => (
                      <TableRow key={template.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div>
                            <div className="font-medium text-foreground">{template.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {template.audioVoices?.length || 0} voice{(template.audioVoices?.length || 0) !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getTemplateTypeBadge(template.type || 'story')}
                        </TableCell>
                        <TableCell className="text-sm">
                          {template.imageModel || 'flux-schnell'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {template.audioModel || 'eleven_labs'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={template.captionsEnabled ? "default" : "secondary"}>
                            {template.captionsEnabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(template.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Edit Template"
                              onClick={() => handleEditTemplate(template)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Duplicate Template"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              title="Delete Template"
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
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Video Template' : 'Create New Video Template'}
            </DialogTitle>
          </DialogHeader>
          <EnhancedStoryTemplateForm
            templateId={editingTemplate?.id}
            onSuccess={handleFormClose}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
