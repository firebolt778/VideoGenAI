import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { insertThumbnailTemplateSchema, type InsertThumbnailTemplate } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Image, Sparkles, Settings, TestTube, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EnhancedThumbnailFormProps {
  thumbnailId?: number;
  onSuccess?: () => void;
}

const SHORTCODE_INFO = [
  { code: "{{TITLE}}", description: "Video title" },
  { code: "{{SCRIPT}}", description: "Full script content" },
  { code: "{{OUTLINE}}", description: "Story outline" },
  { code: "{{CHANNEL_NAME}}", description: "Channel name" },
];

const THUMBNAIL_TYPES = [
  { 
    value: "first-image", 
    label: "First Image", 
    description: "Use the first generated image from the video" 
  },
  { 
    value: "last-image", 
    label: "Last Image", 
    description: "Use the last generated image from the video" 
  },
  { 
    value: "random-image", 
    label: "Random Image", 
    description: "Use a random image from the video" 
  },
  { 
    value: "ai-generated", 
    label: "AI Generated", 
    description: "Generate a custom thumbnail using AI prompts" 
  },
];

export default function EnhancedThumbnailForm({ thumbnailId, onSuccess }: EnhancedThumbnailFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const createTemplateMutation = useMutation({
    mutationFn: async (data: InsertThumbnailTemplate) => {
      return apiRequest("/api/thumbnail-templates", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: "Thumbnail template created successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/thumbnail-templates'] });
      onSuccess?.();
    },
    onError: () => {
      toast({ title: "Failed to create thumbnail template", variant: "destructive" });
    },
  });

  const onSubmit = (data: InsertThumbnailTemplate) => {
    createTemplateMutation.mutate(data);
  };

  const selectedType = form.watch('type');
  const requiresPrompt = selectedType === 'ai-generated';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Template Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Thumbnail Template Settings
              </CardTitle>
              <CardDescription>
                Create custom thumbnail generation templates for your channels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Ghost Stories Thumbnail, Horror Style, etc." {...field} />
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
                    <FormLabel>Thumbnail Type *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select thumbnail type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {THUMBNAIL_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex flex-col">
                              <span>{type.label}</span>
                              <span className="text-xs text-muted-foreground">{type.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* AI Generation Settings (only for ai-generated type) */}
          {requiresPrompt && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Available Shortcodes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    {SHORTCODE_INFO.map((item) => (
                      <div key={item.code} className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {item.code}
                        </Badge>
                        <span className="text-muted-foreground">{item.description}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    AI Generation Settings
                  </CardTitle>
                  <CardDescription>
                    Configure AI image generation for custom thumbnails
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="prompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Thumbnail Generation Prompt *</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Create a compelling YouTube thumbnail for: {{TITLE}}

Based on this story: {{SCRIPT}}

Generate a dramatic, eye-catching thumbnail with:
- Bold, readable text overlay
- High contrast colors
- Mysterious/horror atmosphere
- Cinematic composition
- 16:9 aspect ratio optimized for YouTube

Style: Dark, atmospheric, professional thumbnail design"
                            className="min-h-[200px]"
                            {...field} 
                          />
                        </FormControl>
                        <p className="text-sm text-muted-foreground">
                          Use shortcodes to include dynamic content from your videos
                        </p>
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
                          <FormLabel>Primary Image Model</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select model" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="gpt-4o">GPT-4o (DALL-E 3)</SelectItem>
                              <SelectItem value="flux-pro">Flux Pro</SelectItem>
                              <SelectItem value="flux-schnell">Flux Schnell</SelectItem>
                              <SelectItem value="midjourney">Midjourney</SelectItem>
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
                                <SelectValue placeholder="Select fallback model" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="flux-schnell">Flux Schnell</SelectItem>
                              <SelectItem value="flux-pro">Flux Pro</SelectItem>
                              <SelectItem value="dalle-3">DALL-E 3</SelectItem>
                              <SelectItem value="none">None</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  <FormField
                    control={form.control}
                    name="fallbackStrategy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fallback Strategy (if AI generation fails)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select fallback strategy" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="first-image">Use First Video Image</SelectItem>
                            <SelectItem value="last-image">Use Last Video Image</SelectItem>
                            <SelectItem value="random-image">Use Random Video Image</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">
                          Automatic fallback when AI generation fails
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </>
          )}

          {/* Testing Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                Thumbnail Testing
              </CardTitle>
              <CardDescription>
                Test your thumbnail template locally before applying to channels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">Preview Generation</h4>
                  <p className="text-sm text-muted-foreground">
                    Generate test thumbnails without affecting live channels
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm">
                  <Image className="h-4 w-4 mr-2" />
                  Generate Preview
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={onSuccess}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTemplateMutation.isPending}>
              {createTemplateMutation.isPending ? "Creating..." : "Save Template"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}