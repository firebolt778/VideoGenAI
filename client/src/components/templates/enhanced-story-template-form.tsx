import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  insertVideoTemplateSchema,
  VideoTemplate,
  type InsertVideoTemplate,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Image,
  Mic,
  Music,
  Sparkles,
  Type,
  Camera,
  Lightbulb,
  Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EnhancedStoryTemplateFormProps {
  template?: VideoTemplate | null;
  onSuccess?: () => void;
}

const SHORTCODE_INFO = [
  { code: "{{IDEAS}}", description: "Current selected idea from ideas list" },
  { code: "{{OUTLINE}}", description: "Generated story outline" },
  { code: "{{SCRIPT}}", description: "Full generated script" },
  { code: "{{TITLE}}", description: "Video title" },
  { code: "{{IMAGES}}", description: "List of generated image descriptions" },
  { code: "{{CHANNEL_NAME}}", description: "Channel name" },
];

const VOICE_OPTIONS = [
  { id: "rachel", name: "Rachel - Calm Female" },
  { id: "drew", name: "Drew - News Male" },
  { id: "clyde", name: "Clyde - Warm Male" },
  { id: "bella", name: "Bella - Soft Female" },
  { id: "josh", name: "Josh - Deep Male" },
  { id: "arnold", name: "Arnold - Crisp Male" },
  { id: "charlotte", name: "Charlotte - Seductive Female" },
  { id: "matilda", name: "Matilda - Pleasant Female" },
];

export default function EnhancedStoryTemplateForm({
  template,
  onSuccess,
}: EnhancedStoryTemplateFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedVoices, setSelectedVoices] = useState<string[]>([]);
  const isEditing = !!template;

  const form = useForm<InsertVideoTemplate>({
    resolver: zodResolver(insertVideoTemplateSchema),
    defaultValues: {
      name: template?.name || "",
      type: template?.type || "story",
      hookPrompt: template?.hookPrompt || "",
      ideasList: template?.ideasList || "",
      ideasDelimiter: template?.ideasDelimiter || "---",
      storyOutlinePrompt: template?.storyOutlinePrompt || "",
      videoLength: template?.videoLength || 60,
      imagePrompt: template?.imagePrompt || "",
      imageCount: template?.imageCount || 8,
      imageModel: template?.imageModel || "flux-schnell",
      imageFallbackModel: template?.imageFallbackModel || "dalle-3",
      heroImageModel: template?.heroImageModel || "flux-pro",
      heroImageEnabled: template?.heroImageEnabled || false,
      audioModel: template?.audioModel || "eleven_labs",
      audioVoices: template?.audioVoices || [],
      audioPauseGap: template?.audioPauseGap || 500,
      backgroundMusicPrompt: template?.backgroundMusicPrompt || "",
      musicVolume: template?.musicVolume || 30,
      videoEffects: template?.videoEffects || {
        kenBurns: true,
        kenBurnsSpeed: 1,
        kenBurnsDirection: "random",
        filmGrain: false,
        fog: false,
      },
      captionsEnabled: template?.captionsEnabled ?? true,
      captionsFont: template?.captionsFont || "Inter",
      captionsColor: template?.captionsColor || "#ffffff",
      captionsPosition: template?.captionsPosition || "bottom",
      videoTransitions: template?.videoTransitions || "mix-fade",
      transitionDuration: template?.transitionDuration ?? 2,
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: InsertVideoTemplate) => {
      const method = isEditing ? "PUT" : "POST";
      const url = isEditing
        ? `/api/video-templates/${template.id}`
        : "/api/video-templates";
      return apiRequest(method, url, {
        ...data,
        audioVoices: selectedVoices,
        videoEffects: form.getValues("videoEffects"),
      });
    },
    onSuccess: () => {
      toast({
        title: `Video template ${
          isEditing ? "updated" : "created"
        } successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/video-templates"] });
      onSuccess?.();
    },
    onError: () => {
      toast({
        title: `Failed to ${isEditing ? "update" : "create"} template`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertVideoTemplate) => {
    createTemplateMutation.mutate(data);
  };

  const ShortcodeInfo = () => (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Info className="h-4 w-4" />
          Available Shortcodes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
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
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Template Name */}
          <Card>
            <CardHeader>
              <CardTitle>Template Settings</CardTitle>
              <CardDescription>
                Create and save your video template configuration
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
                      <Input
                        placeholder="e.g., Ghost Stories, True Crime, etc."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Tabs defaultValue="content" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="content" className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                Content
              </TabsTrigger>
              <TabsTrigger value="images" className="flex items-center gap-1">
                <Image className="h-4 w-4" />
                Images
              </TabsTrigger>
              <TabsTrigger value="audio" className="flex items-center gap-1">
                <Mic className="h-4 w-4" />
                Audio
              </TabsTrigger>
              <TabsTrigger value="music" className="flex items-center gap-1">
                <Music className="h-4 w-4" />
                Music
              </TabsTrigger>
              <TabsTrigger value="effects" className="flex items-center gap-1">
                <Sparkles className="h-4 w-4" />
                Effects
              </TabsTrigger>
              <TabsTrigger value="captions" className="flex items-center gap-1">
                <Type className="h-4 w-4" />
                Captions
              </TabsTrigger>
            </TabsList>

            {/* Content Generation Tab */}
            <TabsContent value="content" className="space-y-6">
              <ShortcodeInfo />

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5" />
                    Ideas List *
                  </CardTitle>
                  <CardDescription>
                    Manual list of ideas for video generation, separated by
                    delimiter
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="col-span-3">
                      <FormField
                        control={form.control}
                        name="ideasList"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Ideas (one per line or separated by delimiter)
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="A haunted mansion with moving shadows&#10;---&#10;A mysterious disappearance in a small town&#10;---&#10;An urban legend that turns out to be real"
                                className="min-h-[120px] font-mono text-sm"
                                {...field}
                                value={field.value ?? undefined}
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
                        name="ideasDelimiter"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Delimiter</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="---"
                                {...field}
                                value={field.value ?? undefined}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Hook Generation</CardTitle>
                  <CardDescription>
                    Generate compelling hooks for the beginning of videos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="hookPrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hook Prompt</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Create a 15-second hook for a {{IDEAS}} story. Make it a cliffhanger that captures attention immediately. Use dynamic visuals and suspenseful language."
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

              <Card>
                <CardHeader>
                  <CardTitle>Story Outline Generation</CardTitle>
                  <CardDescription>
                    Create story outlines with title and chapter structure
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="storyOutlinePrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Story Outline Prompt</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Create a story outline for: {{IDEAS}}"
                            className="min-h-[120px]"
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

              <Card>
                <CardHeader>
                  <CardTitle>Video Length (minutes) *</CardTitle>
                  <CardDescription>
                    Specify the desired duration for the generated video in minutes. This helps tailor the script and pacing to fit your preferred video length.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="videoLength"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Video Length (minutes)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter video length"
                            type="number"
                            min={5}
                            max={120}
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
            </TabsContent>

            {/* Images Tab */}
            <TabsContent value="images" className="space-y-6">
              <ShortcodeInfo />

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="h-5 w-5" />
                    Image Generation
                  </CardTitle>
                  <CardDescription>
                    Configure AI image generation for your videos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="imageCount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Number of Images</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="4"
                              max="20"
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
                      name="imageModel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary Image Model</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value ?? undefined}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select model" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="flux-schnell">
                                Flux Schnell (Fast)
                              </SelectItem>
                              <SelectItem value="flux-pro">
                                Flux Pro (High Quality)
                              </SelectItem>
                              <SelectItem value="dalle-3">DALL-E 3</SelectItem>
                              <SelectItem value="midjourney">
                                Midjourney
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="imagePrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Image Generation Prompt *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Generate {{imageCount}} image prompts for this script: {{SCRIPT}}&#10;&#10;Create atmospheric, cinematic images that match the story mood. Each image should be described in detail with style, lighting, and composition notes."
                            className="min-h-[100px]"
                            {...field}
                            value={field.value ?? undefined}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <FormField
                        control={form.control}
                        name="heroImageEnabled"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <Switch
                                checked={field.value ?? false}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Enhanced Hero Images</FormLabel>
                              <p className="text-sm text-muted-foreground">
                                Use higher quality model for first and last
                                images
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>

                    {form.watch("heroImageEnabled") && (
                      <FormField
                        control={form.control}
                        name="heroImageModel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hero Image Model</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value ?? undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select model" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="flux-pro">
                                  Flux Pro
                                </SelectItem>
                                <SelectItem value="dalle-3">
                                  DALL-E 3
                                </SelectItem>
                                <SelectItem value="midjourney">
                                  Midjourney
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Audio Tab */}
            <TabsContent value="audio" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mic className="h-5 w-5" />
                    Voice Settings
                  </CardTitle>
                  <CardDescription>
                    Configure text-to-speech and voice options
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="audioModel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Audio Model</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value ?? undefined}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select audio model" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="eleven_labs">
                              ElevenLabs (Premium)
                            </SelectItem>
                            <SelectItem value="openai_tts">
                              OpenAI TTS
                            </SelectItem>
                            <SelectItem value="azure_speech">
                              Azure Speech
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4">
                    <FormLabel>
                      Voice Selection (Multiple voices will rotate per video)
                    </FormLabel>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {VOICE_OPTIONS.map((voice) => (
                        <div
                          key={voice.id}
                          className="flex items-center space-x-2"
                        >
                          <input
                            type="checkbox"
                            id={voice.id}
                            checked={selectedVoices.includes(voice.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedVoices([
                                  ...selectedVoices,
                                  voice.id,
                                ]);
                              } else {
                                setSelectedVoices(
                                  selectedVoices.filter((v) => v !== voice.id)
                                );
                              }
                            }}
                            className="rounded"
                          />
                          <label
                            htmlFor={voice.id}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {voice.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="audioPauseGap"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Pause Between Audio Clips: {field.value}ms
                        </FormLabel>
                        <FormControl>
                          <Slider
                            min={100}
                            max={2000}
                            step={100}
                            value={[field.value || 500]}
                            onValueChange={(value) => field.onChange(value[0])}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Music Tab */}
            <TabsContent value="music" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Music className="h-5 w-5" />
                    Background Music
                  </CardTitle>
                  <CardDescription>
                    Configure background music selection and settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="backgroundMusicPrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Music Selection Prompt</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Select appropriate background music for: {{OUTLINE}}&#10;&#10;Choose from horror, suspense, ambient, or cinematic tracks that match the mood. Consider the story's emotional arc."
                            className="min-h-[100px]"
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
                    name="musicVolume"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Music Volume: {field.value}%</FormLabel>
                        <FormControl>
                          <Slider
                            min={0}
                            max={100}
                            step={5}
                            value={[field.value || 30]}
                            onValueChange={(value) => field.onChange(value[0])}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Effects Tab */}
            <TabsContent value="effects" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Video Effects
                  </CardTitle>
                  <CardDescription>
                    Configure visual effects and transitions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="videoTransitions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Transition Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value ?? undefined}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select transition" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="mix-fade">Mix Fade</SelectItem>
                              <SelectItem value="cross-dissolve">
                                Cross Dissolve
                              </SelectItem>
                              <SelectItem value="cut">Hard Cut</SelectItem>
                              <SelectItem value="slide">Slide</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="transitionDuration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Transition Duration: {field.value}s
                          </FormLabel>
                          <FormControl>
                            <Slider
                              min={0.5}
                              max={5}
                              step={0.5}
                              value={[field.value || 2]}
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

                  <div className="space-y-4">
                    <h4 className="font-medium">Ken Burns Effect</h4>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={form.watch("videoEffects")?.kenBurns}
                          onCheckedChange={(checked) => {
                            const effects =
                              form.getValues("videoEffects") || {};
                            form.setValue("videoEffects", {
                              ...effects,
                              kenBurns: checked,
                            });
                          }}
                        />
                        <label className="text-sm font-medium">
                          Enable Ken Burns zoom effect
                        </label>
                      </div>

                      {form.watch("videoEffects")?.kenBurns && (
                        <div className="grid grid-cols-2 gap-4 pl-6">
                          <div>
                            <label className="text-sm font-medium">
                              Speed: {form.watch("videoEffects")?.kenBurnsSpeed}
                            </label>
                            <Slider
                              min={0.5}
                              max={3}
                              step={0.1}
                              value={[
                                form.watch("videoEffects")?.kenBurnsSpeed || 1,
                              ]}
                              onValueChange={(value) => {
                                const effects =
                                  form.getValues("videoEffects") || {};
                                form.setValue("videoEffects", {
                                  ...effects,
                                  kenBurnsSpeed: value[0],
                                });
                              }}
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">
                              Direction
                            </label>
                            <Select
                              value={
                                form.watch("videoEffects")?.kenBurnsDirection
                              }
                              onValueChange={(value) => {
                                const effects =
                                  form.getValues("videoEffects") || {};
                                form.setValue("videoEffects", {
                                  ...effects,
                                  kenBurnsDirection: value,
                                });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select direction" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="random">Random</SelectItem>
                                <SelectItem value="zoom-in">Zoom In</SelectItem>
                                <SelectItem value="zoom-out">
                                  Zoom Out
                                </SelectItem>
                                <SelectItem value="pan-left">
                                  Pan Left
                                </SelectItem>
                                <SelectItem value="pan-right">
                                  Pan Right
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={form.watch("videoEffects")?.filmGrain}
                        onCheckedChange={(checked) => {
                          const effects = form.getValues("videoEffects") || {};
                          form.setValue("videoEffects", {
                            ...effects,
                            filmGrain: checked,
                          });
                        }}
                      />
                      <label className="text-sm font-medium">
                        Film Grain Effect
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={form.watch("videoEffects")?.fog}
                        onCheckedChange={(checked) => {
                          const effects = form.getValues("videoEffects") || {};
                          form.setValue("videoEffects", {
                            ...effects,
                            fog: checked,
                          });
                        }}
                      />
                      <label className="text-sm font-medium">
                        Fog/Atmospheric Effect
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Captions Tab */}
            <TabsContent value="captions" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Type className="h-5 w-5" />
                    Caption Settings
                  </CardTitle>
                  <CardDescription>
                    Configure video captions and text styling
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="captionsEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Enable Captions
                          </FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Add synchronized text captions to videos
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

                  {form.watch("captionsEnabled") && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="captionsFont"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Font Family</FormLabel>
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
                                  <SelectItem value="Inter">Inter</SelectItem>
                                  <SelectItem value="Roboto">Roboto</SelectItem>
                                  <SelectItem value="Open Sans">
                                    Open Sans
                                  </SelectItem>
                                  <SelectItem value="Montserrat">
                                    Montserrat
                                  </SelectItem>
                                  <SelectItem value="Oswald">Oswald</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="captionsPosition"
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
                                  <SelectItem value="top">Top</SelectItem>
                                  <SelectItem value="center">Center</SelectItem>
                                  <SelectItem value="bottom">Bottom</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="captionsColor"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Text Color</FormLabel>
                              <FormControl>
                                <Input type="color" {...field} value={field.value ?? undefined} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={onSuccess}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTemplateMutation.isPending}>
              {createTemplateMutation.isPending
                ? isEditing
                  ? "Updating..."
                  : "Creating..."
                : "Save Template"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
