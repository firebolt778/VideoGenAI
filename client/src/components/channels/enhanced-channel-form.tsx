import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  insertChannelSchema,
  type InsertChannel,
  type VideoTemplate,
  type ThumbnailTemplate,
  Channel,
} from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Upload, Settings, Video, Image, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EnhancedChannelFormProps {
  channel: Channel | null;
  onSuccess?: () => void;
}

export default function EnhancedChannelForm({
  channel,
  onSuccess,
}: EnhancedChannelFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingWatermark, setUploadingWatermark] = useState(false);
  const isEditing = !!channel;

  const { data: videoTemplates } = useQuery<VideoTemplate[]>({
    queryKey: ["/api/video-templates"],
  });

  const { data: thumbnailTemplates } = useQuery<ThumbnailTemplate[]>({
    queryKey: ["/api/thumbnail-templates"],
  });

  const form = useForm<InsertChannel>({
    resolver: zodResolver(insertChannelSchema),
    defaultValues: {
      name: channel?.name ?? "",
      url: channel?.url ?? "",
      description: channel?.description ?? "",
      watermarkPosition: channel?.watermarkPosition ?? "bottom-right",
      watermarkOpacity: channel?.watermarkOpacity ?? 80,
      watermarkSize: channel?.watermarkSize ?? 15,
      schedule: channel?.schedule ?? "daily",
      videosMin: channel?.videosMin ?? 1,
      videosMax: channel?.videosMax ?? 2,
      chapterIndicators: channel?.chapterIndicators ?? false,
      videoIntro: channel?.videoIntro ?? false,
      videoOutro: channel?.videoOutro ?? false,
      isActive: channel?.isActive ?? true,
    },
  });

  const createChannelMutation = useMutation({
    mutationFn: async (data: InsertChannel) => {
      const method = isEditing ? "PUT" : "POST";
      const url = isEditing ? `/api/channels/${channel.id}` : "/api/channels";
      return apiRequest(method, url, data);
    },
    onSuccess: () => {
      toast({
        title: `Channel ${isEditing ? "updated" : "created"} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
      onSuccess?.();
    },
    onError: () => {
      toast({
        title: `Failed to ${isEditing ? "update" : "create"} channel`,
        variant: "destructive",
      });
    },
  });

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      form.setValue("logoUrl", result.url);
      toast({ title: "Logo uploaded successfully" });
    } catch (error) {
      toast({ title: "Failed to upload logo", variant: "destructive" });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleWatermarkUpload = async (file: File) => {
    setUploadingWatermark(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      form.setValue("watermarkUrl", result.url);
      toast({ title: "Watermark uploaded successfully" });
    } catch (error) {
      toast({ title: "Failed to upload watermark", variant: "destructive" });
    } finally {
      setUploadingWatermark(false);
    }
  };

  const onSubmit = (data: InsertChannel) => {
    createChannelMutation.mutate(data);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Basic Information
              </CardTitle>
              <CardDescription>
                Configure the basic settings for your YouTube channel
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Channel Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter channel name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>YouTube Channel URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://youtube.com/@channel"
                        {...field}
                        value={field.value ?? undefined}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Channel Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter channel description for branding and video descriptions"
                        className="min-h-[100px]"
                        {...field}
                        value={field.value ?? undefined}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Media Assets */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                Media Assets
              </CardTitle>
              <CardDescription>
                Upload logo and watermark images for branding
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo Upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Channel Logo</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="mt-4">
                    <label htmlFor="logo-upload" className="cursor-pointer">
                      <span className="mt-2 block text-sm font-medium text-gray-900">
                        Upload PNG logo with transparent background
                      </span>
                      <input
                        id="logo-upload"
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleLogoUpload(file);
                        }}
                      />
                    </label>
                  </div>
                </div>
                {form.watch("logoUrl") && (
                  <div className="mt-2">
                    <img
                      src={form.watch("logoUrl") ?? undefined}
                      alt="Logo preview"
                      className="h-16 w-16 object-contain"
                    />
                  </div>
                )}
              </div>

              {/* Watermark Settings */}
              <div className="space-y-4">
                <label className="text-sm font-medium">Video Watermark</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="mt-4">
                    <label
                      htmlFor="watermark-upload"
                      className="cursor-pointer"
                    >
                      <span className="mt-2 block text-sm font-medium text-gray-900">
                        Upload watermark image for videos
                      </span>
                      <input
                        id="watermark-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleWatermarkUpload(file);
                        }}
                      />
                    </label>
                  </div>
                </div>

                {form.watch("watermarkUrl") && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <FormField
                        control={form.control}
                        name="watermarkPosition"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Position</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value ?? undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select position" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="top-left">
                                  Top Left
                                </SelectItem>
                                <SelectItem value="top-right">
                                  Top Right
                                </SelectItem>
                                <SelectItem value="bottom-left">
                                  Bottom Left
                                </SelectItem>
                                <SelectItem value="bottom-right">
                                  Bottom Right
                                </SelectItem>
                                <SelectItem value="center">Center</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div>
                      <FormField
                        control={form.control}
                        name="watermarkOpacity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Opacity: {field.value}%</FormLabel>
                            <FormControl>
                              <Slider
                                min={0}
                                max={100}
                                step={5}
                                value={[field.value || 80]}
                                onValueChange={(value) =>
                                  field.onChange(value[0])
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div>
                      <FormField
                        control={form.control}
                        name="watermarkSize"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Size: {field.value}%</FormLabel>
                            <FormControl>
                              <Slider
                                min={5}
                                max={50}
                                step={1}
                                value={[field.value || 15]}
                                onValueChange={(value) =>
                                  field.onChange(value[0])
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Video Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Video Settings
              </CardTitle>
              <CardDescription>
                Configure intro, outro, and chapter settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="chapterIndicators"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Chapter Indicators
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Add fade and chapter screens between sections
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value ?? false}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="videoIntro"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Video Intro</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Add branded intro after hook
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value ?? false}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="videoOutro"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Video Outro</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Add subscribe reminder at end
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value ?? false}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="videoDescriptionPrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Video Description Prompt *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter prompt to generate video descriptions. Use shortcodes like {{TITLE}}, {{SCRIPT}}, {{CHANNEL_NAME}} to include dynamic content."
                        className="min-h-[120px]"
                        {...field}
                        value={field.value ?? undefined}
                      />
                    </FormControl>
                    <p className="text-sm text-muted-foreground">
                      {
                        "Available shortcodes: {{TITLE}}, {{SCRIPT}}, {{CHANNEL_NAME}}, {{CHANNEL_DESCRIPTION}}"
                      }
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Publishing Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Publishing Schedule
              </CardTitle>
              <CardDescription>
                Configure how often videos are generated and published
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="schedule"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Schedule Period</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value ?? undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select schedule" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="videosMin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Videos</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="10"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value))
                          }
                          value={field.value ?? undefined}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="videosMax"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Videos</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="10"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value))
                          }
                          value={field.value ?? undefined}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Channel Status */}
          <Card>
            <CardHeader>
              <CardTitle>Channel Status</CardTitle>
              <CardDescription>
                Control whether this channel is actively generating videos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Active Channel
                      </FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Enable automatic video generation for this channel
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value ?? false}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={onSuccess}>
              Cancel
            </Button>
            <Button type="submit" disabled={createChannelMutation.isPending}>
              {createChannelMutation.isPending
                ? isEditing
                  ? "Updating..."
                  : "Creating..."
                : isEditing
                ? "Update Channel"
                : "Create Channel"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
