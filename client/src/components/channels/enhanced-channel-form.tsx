import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  insertChannelSchema,
  type InsertChannel,
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
import { Checkbox } from "@/components/ui/checkbox";
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
import { Upload, Settings, Video, Image, Calendar, Type } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { HookTemplate } from "@shared/schema";

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
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const isEditing = !!channel;

  const { data: thumbnailTemplates } = useQuery<ThumbnailTemplate[]>({
    queryKey: ["/api/thumbnail-templates"],
  });

  const { data: hookTemplates } = useQuery<HookTemplate[]>({
    queryKey: ["/api/hook-templates"],
  });

  // Multi-select state for hooks and thumbnails
  const [selectedHookIds, setSelectedHookIds] = useState<number[]>(
    channel && "hookIds" in channel && Array.isArray((channel as any).hookIds)
      ? (channel as any).hookIds
      : []
  );
  const [selectedThumbnailIds, setSelectedThumbnailIds] = useState<number[]>(
    channel && "thumbnailIds" in channel && Array.isArray((channel as any).thumbnailIds)
      ? (channel as any).thumbnailIds
      : []
  );

  const form = useForm<InsertChannel>({
    resolver: zodResolver(insertChannelSchema),
    defaultValues: {
      name: channel?.name ?? "",
      url: channel?.url ?? "",
      description: channel?.description ?? "",
      logoUrl: channel?.logoUrl ?? "",
      watermarkUrl: channel?.watermarkUrl ?? "",
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
      chapterMarkerBgColor: channel?.chapterMarkerBgColor ?? "#000000",
      chapterMarkerFont: channel?.chapterMarkerFont ?? "#Arial",
      chapterMarkerFontColor: channel?.chapterMarkerFontColor ?? "#FFFFFF",
      videoDescriptionPrompt: channel?.videoDescriptionPrompt ?? "",
      videoIntroUrl: channel?.videoIntroUrl ?? "",
      videoOutroUrl: channel?.videoOutroUrl ?? "",
      introDissolveTime: channel?.introDissolveTime ?? 1,
      outroDissolveTime: channel?.outroDissolveTime ?? 1,
      introDuration: channel?.introDuration ?? 0,
      outroDuration: channel?.outroDuration ?? 0,
      titleFont: channel?.titleFont ?? "Arial",
      titleColor: channel?.titleColor ?? "#FFFFFF",
      titleBgColor: channel?.titleBgColor ?? "#000000",
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

  const handleIntroVideoUpload = async (file: File) => {
    setUploadingVideo(true);
    const formData = new FormData();
    formData.append("video", file);

    try {
      const response = await fetch("/api/upload/video", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      form.setValue("videoIntroUrl", result.url);
      form.setValue("introDuration", Math.ceil(result.duration));
      toast({ title: "Video uploaded successfully" });
    } catch (error) {
      toast({ title: "Failed to upload video", variant: "destructive" });
    } finally {
      setUploadingVideo(false);
    }
  }

  const handleOutroVideoUpload = async (file: File) => {
    setUploadingVideo(true);
    const formData = new FormData();
    formData.append("video", file);

    try {
      const response = await fetch("/api/upload/video", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      form.setValue("videoOutroUrl", result.url);
      form.setValue("outroDuration", Math.ceil(result.duration));
      toast({ title: "Video uploaded successfully" });
    } catch (error) {
      toast({ title: "Failed to upload video", variant: "destructive" });
    } finally {
      setUploadingVideo(false);
    }
  }

  const onSubmit = (data: InsertChannel) => {
    if (data.videoIntro && !data.videoIntroUrl) {
      toast({
        title: "Please upload an intro video",
        variant: "destructive",
      });
      return;
    }
    if (data.videoOutro && !data.videoOutroUrl) {
      toast({
        title: "Please upload an outro video",
        variant: "destructive",
      });
      return;
    }
    if (!selectedThumbnailIds.length) {
      toast({
        title: "Please select at least one thumbnail template",
        variant: "destructive",
      });
      return;
    }
    createChannelMutation.mutate({
      ...data,
      hookIds: selectedHookIds,
      thumbnailIds: selectedThumbnailIds,
    });
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
                <div className="flex flex-col md:flex-row items-center gap-6">
                  {/* Logo Preview */}
                  <div className="flex flex-col items-center">
                    <div className="h-24 w-24 border-2 border-gray-200 rounded-lg flex items-center justify-center bg-white overflow-hidden">
                      {form.watch("logoUrl") ? (
                        <img
                          src={form.watch("logoUrl") ?? undefined}
                          alt="Logo preview"
                          className="h-20 w-20 object-contain"
                        />
                      ) : (
                        <Upload className="h-10 w-10 text-gray-300" />
                      )}
                    </div>
                    {form.watch("logoUrl") && (
                      <button
                        type="button"
                        className="mt-2 text-xs text-red-500 hover:underline"
                        onClick={() => form.setValue("logoUrl", "")}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {/* Upload Button */}
                  <div className="flex flex-col items-center gap-2">
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/png,image/jpeg,image/bmp,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoUpload(file);
                      }}
                    />
                    <label htmlFor="logo-upload">
                      <Button
                        asChild
                        type="button"
                        variant="outline"
                        disabled={uploadingLogo}
                        className="w-40"
                      >
                        <span>
                          {uploadingLogo ? "Uploading..." : form.watch("logoUrl") ? "Replace Logo" : "Upload Logo"}
                        </span>
                      </Button>
                    </label>
                    <span className="text-xs text-muted-foreground text-center max-w-xs">
                      PNG, JPEG, or SVG. Transparent background recommended.
                    </span>
                  </div>
                </div>
              </div>

              {/* Watermark Settings */}
              <div className="space-y-4">
                <label className="text-sm font-medium">Video Watermark</label>
                <div className="flex flex-col md:flex-row items-center gap-6">
                  {/* Watermark Preview */}
                  <div className="flex flex-col items-center">
                    <div className="h-24 w-24 border-2 border-gray-200 rounded-lg flex items-center justify-center bg-white overflow-hidden">
                      {form.watch("watermarkUrl") ? (
                        <img
                          src={form.watch("watermarkUrl") ?? undefined}
                          alt="Watermark preview"
                          className="h-20 w-20 object-contain"
                        />
                      ) : (
                        <Upload className="h-10 w-10 text-gray-300" />
                      )}
                    </div>
                    {form.watch("watermarkUrl") && (
                      <button
                        type="button"
                        className="mt-2 text-xs text-red-500 hover:underline"
                        onClick={() => form.setValue("watermarkUrl", "")}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {/* Upload Button */}
                  <div className="flex flex-col items-center gap-2">
                    <input
                      id="watermark-upload"
                      type="file"
                      accept="image/png,image/jpeg,image/bmp,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleWatermarkUpload(file);
                      }}
                    />
                    <label htmlFor="watermark-upload">
                      <Button
                        asChild
                        type="button"
                        variant="outline"
                        disabled={uploadingWatermark}
                        className="w-40"
                      >
                        <span>
                          {uploadingWatermark ? "Uploading..." : form.watch("watermarkUrl") ? "Replace Watermark" : "Upload Watermark"}
                        </span>
                      </Button>
                    </label>
                    <span className="text-xs text-muted-foreground text-center max-w-xs">
                      PNG, JPEG, SVG, etc. Transparent background recommended.
                    </span>
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
                                <SelectItem value="center">Center</SelectItem>
                                <SelectItem value="top-center">Top Center</SelectItem>
                                <SelectItem value="bottom-center">Bottom Center</SelectItem>
                                <SelectItem value="top-left">Top Left</SelectItem>
                                <SelectItem value="top-right">Top Right</SelectItem>
                                <SelectItem value="bottom-left">Bottom Left</SelectItem>
                                <SelectItem value="bottom-right">Bottom Right</SelectItem>
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
              <div className="flex flex-col gap-4">
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

                {/* Chapter Marker Style Controls */}
                {form.watch("chapterIndicators") && (
                  <div className="col-span-full grid grid-cols-1 md:grid-cols-3 gap-4 border rounded-lg p-4 bg-muted/30">
                    <FormField
                      control={form.control}
                      name="chapterMarkerBgColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Chapter Marker Background Color</FormLabel>
                          <FormControl className="flex flex-col justify-center">
                            <Input
                              type="color"
                              {...field}
                              value={field.value || "#000000"}
                              className="w-12 h-8 p-0 border-none bg-transparent"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="chapterMarkerFontColor"
                      render={({ field }) => (
                        <FormItem className="flex flex-col justify-center">
                          <FormLabel>Chapter Marker Font Color</FormLabel>
                          <FormControl>
                            <Input
                              type="color"
                              {...field}
                              value={field.value || "#FFFFFF"}
                              className="w-12 h-8 p-0 border-none bg-transparent"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="chapterMarkerFont"
                      render={({ field }) => (
                        <FormItem className="flex flex-col justify-center">
                          <FormLabel>Chapter Marker Font</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value ?? undefined}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select font" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Arial">Arial</SelectItem>
                              <SelectItem value="Roboto">Roboto</SelectItem>
                              <SelectItem value="Inter">Inter</SelectItem>
                              <SelectItem value="Georgia">Georgia</SelectItem>
                              <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                              <SelectItem value="Courier New">Courier New</SelectItem>
                              <SelectItem value="Verdana">Verdana</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Preview Panel for Title */}
                    <div className="mt-4 col-span-full">
                      <FormLabel>Text Preview</FormLabel>
                      <div
                        className="rounded-lg p-4 mt-2 border"
                        style={{
                          backgroundColor: form.watch("chapterMarkerBgColor") || "#000000",
                        }}
                      >
                        <div
                          className="text-4xl font-semibold text-center"
                          style={{
                            color: form.watch("chapterMarkerFontColor") || "#FFFFFF",
                            fontFamily: form.watch("chapterMarkerFont") || "Arial",
                          }}
                        >
                          Sample Text
                        </div>
                      </div>
                    </div>
                  </div>
                )}

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

                {/* Video Intro Settings */}
                {form.watch("videoIntro") && (
                  <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-4 border rounded-lg p-4 bg-muted/30">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Intro Video</label>
                      <div className="flex flex-col md:flex-row items-center gap-6">
                        <div className="flex flex-col items-center">
                          <div className="h-24 w-24 border-2 border-gray-200 rounded-lg flex items-center justify-center bg-white overflow-hidden">
                            {form.watch("videoIntroUrl") ? (
                              <video
                                src={form.watch("videoIntroUrl") ?? undefined}
                                className="h-20 w-20 object-contain"
                              />
                            ) : (
                              <Upload className="h-10 w-10 text-gray-300" />
                            )}
                          </div>
                          {form.watch("videoIntroUrl") && (
                            <button
                              type="button"
                              className="mt-2 text-xs text-red-500 hover:underline"
                              onClick={() => form.setValue("videoIntroUrl", "")}
                              disabled={uploadingVideo}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <input
                          id="intro-upload"
                          type="file"
                          accept="video/mp4,video/webm"
                          className="hidden"
                          disabled={uploadingVideo}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleIntroVideoUpload(file);
                          }}
                        />
                        <label htmlFor="intro-upload">
                          <Button
                            asChild
                            type="button"
                            variant="outline"
                            className="w-40"
                            disabled={uploadingVideo}
                          >
                            <span>
                              {form.watch("videoIntroUrl") ? "Replace Intro" : "Upload Intro"}
                            </span>
                          </Button>
                        </label>
                      </div>
                    </div>
                    <FormField
                      control={form.control}
                      name="introDissolveTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dissolve Time (seconds)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="10"
                              {...field}
                              value={field.value ?? 1}
                              onChange={(e) =>
                                field.onChange(parseFloat(e.target.value))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

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

              {/* Video Intro Settings */}
              {form.watch("videoOutro") && (
                <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-4 border rounded-lg p-4 bg-muted/30">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Outro Video</label>
                    <div className="flex flex-col md:flex-row items-center gap-6">
                      <div className="flex flex-col items-center">
                        <div className="h-24 w-24 border-2 border-gray-200 rounded-lg flex items-center justify-center bg-white overflow-hidden">
                          {form.watch("videoOutroUrl") ? (
                            <video
                              src={form.watch("videoOutroUrl") ?? undefined}
                              className="h-20 w-20 object-contain"
                            />
                          ) : (
                            <Upload className="h-10 w-10 text-gray-300" />
                          )}
                        </div>
                        {form.watch("videoOutroUrl") && (
                          <button
                            type="button"
                            className="mt-2 text-xs text-red-500 hover:underline"
                            onClick={() => form.setValue("videoOutroUrl", "")}
                            disabled={uploadingVideo}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <input
                        id="outro-upload"
                        type="file"
                        accept="video/mp4,video/webm"
                        className="hidden"
                        disabled={uploadingVideo}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleOutroVideoUpload(file);
                        }}
                      />
                      <label htmlFor="outro-upload">
                        <Button
                          asChild
                          type="button"
                          variant="outline"
                          className="w-40"
                          disabled={uploadingVideo}
                        >
                          <span>
                            {form.watch("videoOutroUrl") ? "Replace Outro" : "Upload Outro"}
                          </span>
                        </Button>
                      </label>
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="outroDissolveTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dissolve Time (seconds)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="10"
                            {...field}
                            value={field.value ?? 1}
                            onChange={(e) =>
                              field.onChange(parseFloat(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

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

          {/* Title Style Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5" />
                Title Style
              </CardTitle>
              <CardDescription>
                Customize the appearance of video titles for this channel
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="titleFont"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Font</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value ?? undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select font" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Arial">Arial</SelectItem>
                          <SelectItem value="Roboto">Roboto</SelectItem>
                          <SelectItem value="Inter">Inter</SelectItem>
                          <SelectItem value="Georgia">Georgia</SelectItem>
                          <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                          <SelectItem value="Courier New">Courier New</SelectItem>
                          <SelectItem value="Verdana">Verdana</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="titleColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title Color</FormLabel>
                      <FormControl>
                        <Input type="color" {...field} value={field.value ?? "#FFFFFF"} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="titleBgColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Background Color</FormLabel>
                      <FormControl>
                        <Input type="color" {...field} value={field.value ?? "#000000"} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Preview Panel for Title */}
              <div className="mt-4">
                <FormLabel>Title Preview</FormLabel>
                <div
                  className="rounded-lg p-4 mt-2 border"
                  style={{
                    backgroundColor: form.watch("titleBgColor") || "#000000",
                  }}
                >
                  <div
                    className="text-4xl font-semibold text-center"
                    style={{
                      color: form.watch("titleColor") || "#FFFFFF",
                      fontFamily: form.watch("titleFont") || "Arial",
                    }}
                  >
                    Video Generative AI
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hook Template Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Hook Templates
              </CardTitle>
              <CardDescription>
                Select which hook templates are enabled for this channel
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {hookTemplates?.map((hook) => (
                  <label key={hook.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedHookIds.includes(hook.id)}
                      onCheckedChange={(checked) => {
                        setSelectedHookIds((prev) =>
                          checked
                            ? [...prev, hook.id]
                            : prev.filter((id) => id !== hook.id)
                        );
                      }}
                    />
                    <span className="text-sm">{hook.name}</span>
                  </label>
                ))}
                {!hookTemplates?.length && (
                  <div className="text-muted-foreground text-sm col-span-2 py-2 px-3">
                    No hook templates found for this channel.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Thumbnail Template Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                Thumbnail Templates
              </CardTitle>
              <CardDescription>
                Select which thumbnail templates are enabled for this channel
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {thumbnailTemplates?.map((template) => (
                  <label key={template.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedThumbnailIds.includes(template.id)}
                      onCheckedChange={(checked) => {
                        setSelectedThumbnailIds((prev) =>
                          checked
                            ? [...prev, template.id]
                            : prev.filter((id) => id !== template.id)
                        );
                      }}
                    />
                    <span className="text-sm">{template.name}</span>
                  </label>
                ))}
                {!thumbnailTemplates?.length && (
                  <div className="text-muted-foreground text-sm col-span-2 py-2 px-3">
                    No thumbnail templates found for this channel.
                  </div>
                )}
              </div>
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

