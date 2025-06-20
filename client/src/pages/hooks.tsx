import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertHookTemplateSchema, type InsertHookTemplate, type HookTemplate } from "@shared/schema";
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
import { Edit, Trash2, Plus, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Hooks() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<HookTemplate | null>(null);
  const { toast } = useToast();

  const { data: templates, isLoading, refetch } = useQuery<HookTemplate[]>({
    queryKey: ['/api/hook-templates'],
  });

  const form = useForm<InsertHookTemplate>({
    resolver: zodResolver(insertHookTemplateSchema),
    defaultValues: {
      name: "",
      prompt: "",
      duration: 10,
      editSpeed: "medium",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: InsertHookTemplate) => {
      const url = editingTemplate ? `/api/hook-templates/${editingTemplate.id}` : '/api/hook-templates';
      const method = editingTemplate ? 'PUT' : 'POST';
      return await apiRequest(method, url, data);
    },
    onSuccess: () => {
      toast({
        title: editingTemplate ? "Hook updated" : "Hook created",
        description: editingTemplate 
          ? "Your hook template has been successfully updated" 
          : "Your hook template has been successfully created",
      });
      form.reset();
      setIsFormOpen(false);
      setEditingTemplate(null);
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: editingTemplate ? "Failed to update hook" : "Failed to create hook",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/hook-templates/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Hook deleted",
        description: "Hook template has been successfully deleted",
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete hook",
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

  const handleEditTemplate = (template: HookTemplate) => {
    setEditingTemplate(template);
    form.reset(template);
    setIsFormOpen(true);
  };

  const handleDeleteTemplate = (id: number) => {
    if (confirm("Are you sure you want to delete this hook template?")) {
      deleteMutation.mutate(id);
    }
  };

  const onSubmit = (data: InsertHookTemplate) => {
    mutation.mutate(data);
  };

  const getSpeedBadge = (speed: string) => {
    switch (speed) {
      case 'slow':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Slow</Badge>;
      case 'medium':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Medium</Badge>;
      case 'fast':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Fast</Badge>;
      default:
        return <Badge variant="secondary">{speed}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <>
        <Header
          title="Hook Templates"
          description="Create and manage video hook templates for capturing viewer attention"
          onRefresh={handleRefresh}
          onAdd={handleAddTemplate}
          addButtonText="Add Hook"
        />

        <div className="p-6">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-medium">Your Hook Templates</h3>
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
        title="Hook Templates"
        description="Create and manage video hook templates for capturing viewer attention"
        onRefresh={handleRefresh}
        onAdd={handleAddTemplate}
        addButtonText="Add Hook"
      />

      <div className="p-6">
        <div className="mb-6">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <Play className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">About Video Hooks</h4>
                  <p className="text-sm text-blue-800 mt-1">
                    Hooks are short, compelling video segments (5-15 seconds) shown at the very beginning of your videos to capture viewer attention. 
                    They typically include a cliffhanger, surprising fact, or preview of the main content.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium">Your Hook Templates</h3>
          </CardHeader>
          <CardContent className="p-0">
            {!templates || templates.length === 0 ? (
              <div className="text-center py-8 px-6">
                <p className="text-muted-foreground mb-4">No hook templates found. Create your first hook template to get started.</p>
                <Button onClick={handleAddTemplate}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Hook Template
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Edit Speed</TableHead>
                      <TableHead>Preview</TableHead>
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
                            <div className="text-sm text-muted-foreground truncate max-w-xs">
                              {template.prompt.substring(0, 60)}...
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {template.duration}s
                        </TableCell>
                        <TableCell>
                          {getSpeedBadge(template.editSpeed || 'medium')}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-blue-600 hover:text-blue-700"
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Preview
                          </Button>
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
                              title="Edit Hook"
                              onClick={() => handleEditTemplate(template)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              title="Delete Hook"
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
              {editingTemplate ? "Edit Hook Template" : "Create Hook Template"}
            </DialogTitle>
            <DialogDescription>
              Create compelling video hooks that capture viewer attention in the first few seconds
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hook Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Mystery Cliffhanger Hook" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hook Generation Prompt *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Create a compelling hook for this story that will grab viewers' attention in the first 10 seconds. Make it mysterious and intriguing without giving away the ending. Include a cliffhanger or surprising element that makes viewers want to continue watching..." 
                        rows={5} 
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
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (seconds)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={5}
                          max={30}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="editSpeed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Edit Speed</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="slow">Slow - Dramatic, contemplative pace</SelectItem>
                          <SelectItem value="medium">Medium - Standard storytelling pace</SelectItem>
                          <SelectItem value="fast">Fast - Quick cuts, high energy</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">Hook Tips</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Start with a question or surprising statement</li>
                  <li>• Use quick cuts and dynamic visuals</li>
                  <li>• Tease the most interesting part of your story</li>
                  <li>• Keep it under 15 seconds for maximum retention</li>
                  <li>• Match the energy to your content type</li>
                </ul>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Saving..." : editingTemplate ? "Update Hook" : "Create Hook"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
