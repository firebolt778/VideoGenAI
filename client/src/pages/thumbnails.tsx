import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertThumbnailTemplateSchema, type InsertThumbnailTemplate, type ThumbnailTemplate } from "@shared/schema";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Trash2, Plus, TestTube } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Thumbnails() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ThumbnailTemplate | null>(null);
  const { toast } = useToast();

  const { data: templates, isLoading, refetch } = useQuery<ThumbnailTemplate[]>({
    queryKey: ['/api/thumbnail-templates'],
  });

  const form = useForm<InsertThumbnailTemplate>({
    resolver: zodResolver(insertThumbnailTemplateSchema),
    defaultValues: {
      name: "",
      type: "ai-generated",
      prompt: "",
      model: "gpt-4o",
      fallbackModel: "flux-schnell",
      fallbackStrategy: "first-image",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: InsertThumbnailTemplate) => {
      const url = editingTemplate ? `/api/thumbnail-templates/${editingTemplate.id}` : '/api/thumbnail-templates';
      const method = editingTemplate ? 'PUT' : 'POST';
      return await apiRequest(method, url, data);
    },
    onSuccess: () => {
      toast({
        title: editingTemplate ? "Template updated" : "Template created",
        description: editingTemplate 
          ? "Your thumbnail template has been successfully updated" 
          : "Your thumbnail template has been successfully created",
      });
      form.reset();
      setIsFormOpen(false);
      setEditingTemplate(null);
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: editingTemplate ? "Failed to update template" : "Failed to create template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/thumbnail-templates/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Template deleted",
        description: "Thumbnail template has been successfully deleted",
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRefresh = () => {
    refetch();
  };

  const handleAddTemplate = () => {
    setEditingTemplate(null);
    form.reset();
    setIsFormOpen(true);
  };

  const handleEditTemplate = (template: ThumbnailTemplate) => {
    setEditingTemplate(template);
    form.reset(template);
    setIsFormOpen(true);
  };

  const handleDeleteTemplate = (id: number) => {
    if (confirm("Are you sure you want to delete this thumbnail template?")) {
      deleteMutation.mutate(id);
    }
  };

  const onSubmit = (data: InsertThumbnailTemplate) => {
    mutation.mutate(data);
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'ai-generated':
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">AI Generated</Badge>;
      case 'first-image':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">First Image</Badge>;
      case 'last-image':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Last Image</Badge>;
      case 'random-image':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Random Image</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <>
        <Header
          title="Thumbnail Templates"
          description="Create and manage thumbnail generation templates"
          onRefresh={handleRefresh}
          onAdd={handleAddTemplate}
          addButtonText="Add Template"
        />

        <div className="p-6">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-medium">Your Thumbnail Templates</h3>
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
        title="Thumbnail Templates"
        description="Create and manage thumbnail generation templates"
        onRefresh={handleRefresh}
        onAdd={handleAddTemplate}
        addButtonText="Add Template"
      />

      <div className="p-6">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium">Your Thumbnail Templates</h3>
          </CardHeader>
          <CardContent className="p-0">
            {!templates || templates.length === 0 ? (
              <div className="text-center py-8 px-6">
                <p className="text-muted-foreground mb-4">No thumbnail templates found. Create your first template to get started.</p>
                <Button onClick={handleAddTemplate}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Thumbnail Template
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Fallback Strategy</TableHead>
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
                            {template.prompt && (
                              <div className="text-sm text-muted-foreground truncate max-w-xs">
                                {template.prompt.substring(0, 50)}...
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getTypeBadge(template.type || 'ai-generated')}
                        </TableCell>
                        <TableCell className="text-sm">
                          {template.model || 'gpt-4o'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {template.fallbackStrategy || 'first-image'}
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
                              title="Test Template"
                            >
                              <TestTube className="h-4 w-4" />
                            </Button>
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
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              title="Delete Template"
                              onClick={() => handleDeleteTemplate(template.id)}
                              disabled={deleteMutation.isPending}
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Thumbnail Template" : "Create Thumbnail Template"}
            </DialogTitle>
            <DialogDescription>
              Configure how thumbnails should be generated for your videos
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Ghost Stories Thumbnails" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Thumbnail Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ai-generated">AI Generated</SelectItem>
                        <SelectItem value="first-image">First Image</SelectItem>
                        <SelectItem value="last-image">Last Image</SelectItem>
                        <SelectItem value="random-image">Random Image</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch('type') === 'ai-generated' && (
                <>
                  <FormField
                    control={form.control}
                    name="prompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Generation Prompt</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Create a compelling thumbnail for this story that will grab viewers' attention. Include dramatic elements, clear text overlay, and emotional expressions..." 
                            rows={4} 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary Model</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                              <SelectItem value="flux-pro">Flux Pro</SelectItem>
                              <SelectItem value="flux-schnell">Flux Schnell</SelectItem>
                              <SelectItem value="dalle-3">DALL-E 3</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="fallbackModel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fallback Model</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="flux-schnell">Flux Schnell</SelectItem>
                              <SelectItem value="dalle-3">DALL-E 3</SelectItem>
                              <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                              <SelectItem value="none">None</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}

              <FormField
                control={form.control}
                name="fallbackStrategy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fallback Strategy</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="first-image">First Image from Video</SelectItem>
                        <SelectItem value="last-image">Last Image from Video</SelectItem>
                        <SelectItem value="random-image">Random Image from Video</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Saving..." : editingTemplate ? "Update Template" : "Create Template"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
