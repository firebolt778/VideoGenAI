import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { imageModels } from "@/lib/imgModels";
import {
  defaultPromptModel,
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
import { ElevenLabsVoice } from "server/services/elevenlabs";
import PromptModelSelector from "../prompt-model";

interface EnhancedStoryTemplateFormProps {
  template?: VideoTemplate | null;
  onSuccess?: () => void;
}

interface ShortcodeProps {
  includeChapter?: boolean;
  includeChapterContent?: boolean;
}

function ShortcodeHelper({ includeChapter, includeChapterContent }: ShortcodeProps) {
  const { toast } = useToast();

  const onClick = (code: string) => {
    // Copy the code
    if (navigator && navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        toast({ description: `Code ${code} copied` });
      }).catch((err) => {
        console.error(`Failed to copy code ${code}:`, err);
      });
    }
  }

  const shortcodes = [
    { code: "{{IDEAS}}", description: "Current selected idea from ideas list" },
    { code: "{{OUTLINE}}", description: "Generated story outline" },
    { code: "{{SCRIPT}}", description: "Full generated script" },
    { code: "{{TITLE}}", description: "Video title" },
    { code: "{{SUMMARY}}", description: "Story summary from outline" },
    { code: "{{IMAGES}}", description: "List of generated image descriptions" },
    { code: "{{CHANNEL_NAME}}", description: "Channel name" },
    { code: "{{CHANNEL_DESCRIPTION}}", description: "Channel description" },
    { code: "{{imageCount}}", description: "Number of images to generate" },
    { code: "{{VISUAL_STYLE}}", description: "Visual style description" },
  ];

  // Add chapter-related shortcodes conditionally
  if (includeChapter) {
    shortcodes.push(
      { code: "{{CHAPTER_NAME}}", description: "Current chapter name" },
      { code: "{{CHAPTER_DESCRIPTION}}", description: "Current chapter description" }
    );
  }

  if (includeChapterContent) {
    shortcodes.push(
      { code: "{{CHAPTER_CONTENT}}", description: "Current chapter content" }
    );
  }

  return (
    <div className="mt-2 bg-primary/90 backdrop-blur-sm border border-primary/20 rounded-lg px-3 py-1.5">
      <div className="flex items-center gap-1.5">
        <Info className="size-4" />
        <span className="font-medium">Shortcodes</span>
      </div>
      <div className="flex flex-wrap gap-1 mt-1">
        {shortcodes.map((item, index) => (
          <div
            key={index}
            className="group relative"
            title={item.description}
          >
            <Badge
              variant="secondary"
              className="text-xs font-mono bg-primary-foreground/20 border-primary-foreground/30 cursor-help"
              onClick={() => onClick(item.code)}
            >
              {item.code}
            </Badge>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
              {item.description}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EnhancedStoryTemplateForm({
  template,
  onSuccess,
}: EnhancedStoryTemplateFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedVoices, setSelectedVoices] = useState<string[]>(template?.audioVoices || []);
  const isEditing = !!template;

  const { data: elevenVoices } = useQuery<ElevenLabsVoice[]>({
    queryKey: ["/api/elevenlabs-voices"],
  });

  const form = useForm<InsertVideoTemplate>({
    resolver: zodResolver(insertVideoTemplateSchema),
    defaultValues: {
      name: template?.name || "",
      type: template?.type || "story",
      ideasList: template?.ideasList || "",
      ideasDelimiter: template?.ideasDelimiter || "---",
      storyOutlinePrompt: template?.storyOutlinePrompt || "",
      outlinePromptModel: template?.outlinePromptModel || defaultPromptModel,
      fullScriptPrompt: template?.fullScriptPrompt || "",
      visualStylePrompt: template?.visualStylePrompt || "",
      visualStyleModel: template?.visualStyleModel || defaultPromptModel,
      scriptPromptModel: template?.scriptPromptModel || defaultPromptModel,
      videoLength: template?.videoLength || 60,
      chapterImagePrompt: template?.chapterImagePrompt || "",
      chapterImageModel: template?.chapterImageModel || defaultPromptModel,
      chapterImageFallbackModel: template?.chapterImageFallbackModel || defaultPromptModel,
      chapterContentPrompt: template?.chapterContentPrompt || "",
      chapterContentModel: template?.chapterContentModel || defaultPromptModel,
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
        title: `Video template ${isEditing ? "updated" : "created"
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
                          <div className="relative">
                            <Textarea
                              placeholder={"Give me a story outline that follows this concept:\n\"\"\"\n{{IDEAS}}\"\"\"\n\nInclude 5 chapters with descriptive names.\n\nThe story should be engaging, and mysterious.\n\nTry to make it shocking or compelling. Consider real stories, novels or movies that have a similar premise, and use a similar twist or reveal. Don't confuse things by having multiple things happen. Add a little foreshadowing too, if appropriate. Make it clear in your outline, the important plot points, so that there is no confusion or contradictions in the story\n\nIt needs specifics, a title, characters, plot etc. Break the plot outline down into chapters, listing multiple things that happen in each chapter. Be original and creative. Make it really shocking. This is a horror. You will be writing this ultimately, so you need to come up with a good storyline. Your title MUST be unique, and fit the story, rather than create a story to fit the title.\n"}
                              className="min-h-[120px]"
                              {...field}
                              value={field.value ?? undefined}
                            />
                            <ShortcodeHelper includeChapter={false} includeChapterContent={false} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <PromptModelSelector
                    form={form}
                    name="outlinePromptModel"
                    className="mt-4"
                    title="Outline Generation Model"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Full Script Generation *</CardTitle>
                  <CardDescription>
                    Convert outline into complete narration script
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="fullScriptPrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Story Prompt</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Textarea
                              placeholder={"Based on this story outline, write a complete, engaging script for a YouTube video:\n\"\"\"\n{{OUTLINE}}\n\"\"\"\n\nWrite a full narrative script that:\n- Is approximately 2000-3000 words\n- Use conversational language, as if a person is explaining something to a friend.\n- Vary sentence length and pacing to sound more natural when read aloud.\n- Make transitions smooth and logical to maintain flow between ideas.\n- Avoid overly complex or literary phrasing—keep it simple and human.\n- Do **not** include scene directions or camera cues—just spoken narration."}
                              className="min-h-[120px]"
                              {...field}
                              value={field.value ?? undefined}
                            />
                            <ShortcodeHelper includeChapter={false} includeChapterContent={false} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <PromptModelSelector
                    form={form}
                    name="scriptPromptModel"
                    className="mt-4"
                    title="Full Script Generation Model"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Chapter Content Generation *</CardTitle>
                  <CardDescription>
                    Generate detailed content for each chapter based on the full script
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="chapterContentPrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chapter Content Prompt</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Textarea
                              className="min-h-[120px]"
                              {...field}
                              value={field.value ?? undefined}
                            />
                            <ShortcodeHelper includeChapter={true} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <PromptModelSelector
                    form={form}
                    name="chapterContentModel"
                    className="mt-4"
                    title="Chapter Content Model"
                  />
                </CardContent>
              </Card>

              {/* <Card>
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
                </CardContent>
              </Card> */}
            </TabsContent>

            {/* Images Tab */}
            <TabsContent value="images" className="space-y-6">
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
                              {imageModels.map((model, index) => (
                                <SelectItem value={model.value} key={index}>
                                  {model.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="visualStylePrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Visual Style Prompt *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Textarea
                              className="min-h-[100px]"
                              {...field}
                              value={field.value ?? undefined}
                            />
                            <ShortcodeHelper includeChapter={false} includeChapterContent={false} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <PromptModelSelector
                    form={form}
                    name="visualStyleModel"
                    className="mt-4"
                    title="Visual Style Model"
                  />

                  <FormField
                    control={form.control}
                    name="chapterImagePrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chapter Image Prompt</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Textarea
                              className="min-h-[120px]"
                              {...field}
                              value={field.value ?? undefined}
                            />
                            <ShortcodeHelper includeChapter={true} includeChapterContent={true} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <PromptModelSelector
                    form={form}
                    name="chapterImageModel"
                    className="mt-4"
                    title="Chapter Image Model"
                  />

                  <PromptModelSelector
                    form={form}
                    name="chapterImageFallbackModel"
                    className="mt-4"
                    title="Chapter Image Fallback Model"
                  />

                  {/* <Separator />

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
                  </div> */}
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
                  {/* <FormField
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
                  /> */}

                  <VoiceSelectionDropdown
                    elevenVoices={elevenVoices || []}
                    selectedVoices={selectedVoices}
                    setSelectedVoices={setSelectedVoices}
                  />

                  {/* <FormField
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
                  /> */}
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
                          <div className="relative">
                            <Textarea
                              placeholder="Select appropriate background music for: {{OUTLINE}}&#10;&#10;Choose from horror, suspense, ambient, or cinematic tracks that match the mood. Consider the story's emotional arc."
                              className="min-h-[100px]"
                              {...field}
                              value={field.value ?? undefined}
                            />
                            <ShortcodeHelper includeChapter={false} includeChapterContent={false} />
                          </div>
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

                      {/* {form.watch("videoEffects")?.kenBurns && (
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
                      )} */}
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

const VoiceSelectionDropdown: React.FC<{
  elevenVoices: ElevenLabsVoice[];
  selectedVoices: string[];
  setSelectedVoices: React.Dispatch<React.SetStateAction<string[]>>;
}> = ({ elevenVoices, selectedVoices, setSelectedVoices }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: any) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Filter voices based on search term
  const filteredVoices = elevenVoices.filter(voice =>
    voice.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    voice.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleVoiceToggle = (voiceId: string) => {
    if (selectedVoices.includes(voiceId)) {
      setSelectedVoices(selectedVoices.filter(v => v !== voiceId));
    } else {
      setSelectedVoices([...selectedVoices, voiceId]);
    }
  };

  const getSelectedVoiceNames = () => {
    return elevenVoices
      .filter(voice => selectedVoices.includes(voice.voice_id))
      .map(voice => voice.name);
  };

  const clearAll = () => {
    setSelectedVoices([]);
  };

  const selectAll = () => {
    setSelectedVoices(elevenVoices.map(voice => voice.voice_id));
  };

  const selectAllFiltered = () => {
    const filteredIds = filteredVoices.map(voice => voice.voice_id);
    // Avoid using Set to prevent iteration issues; use array filter instead
    const newSelection = selectedVoices.concat(
      filteredIds.filter(id => !selectedVoices.includes(id))
    );
    setSelectedVoices(newSelection);
  };

  const handleDropdownToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchTerm(''); // Clear search when opening
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <FormLabel className="text-lg font-semibold">
          Voice Selection
        </FormLabel>
        <p className="text-sm text-muted-foreground">
          Select multiple voices to rotate between videos.
        </p>
      </div>

      {elevenVoices && elevenVoices.length > 0 && (
        <div className="space-y-2">
          <FormLabel className="text-base font-medium">
            ElevenLabs Voices
          </FormLabel>

          <div className="relative" ref={dropdownRef}>
            {/* Dropdown Trigger */}
            <button
              type="button"
              onClick={handleDropdownToggle}
              className="w-full flex items-center justify-between px-3 py-2 text-sm border border-input bg-background rounded-md hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <div className="flex-1 text-left">
                {selectedVoices.length === 0 ? (
                  <span className="text-muted-foreground">Select voices...</span>
                ) : selectedVoices.length === 1 ? (
                  <span>{getSelectedVoiceNames()[0]}</span>
                ) : (
                  <span>{selectedVoices.length} voices selected</span>
                )}
              </div>

              <svg
                className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg">
                {/* Search Input */}
                <div className="p-3 border-b border-border">
                  <div className="relative">
                    <svg
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search voices..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Header with actions */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
                  <span className="text-xs font-medium text-muted-foreground">
                    {searchTerm ? (
                      <>
                        {filteredVoices.filter(voice => selectedVoices.includes(voice.voice_id)).length} of {filteredVoices.length} filtered selected
                      </>
                    ) : (
                      <>
                        {selectedVoices.length} of {elevenVoices.length} selected
                      </>
                    )}
                  </span>
                  <div className="flex gap-2">
                    {searchTerm ? (
                      <button
                        type="button"
                        onClick={selectAllFiltered}
                        className="text-xs text-primary hover:text-primary/80"
                      >
                        Select Filtered
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={selectAll}
                        className="text-xs text-primary hover:text-primary/80"
                      >
                        Select All
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={clearAll}
                      className="text-xs text-primary hover:text-primary/80"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Voice Options */}
                <div className="max-h-64 overflow-y-auto">
                  {filteredVoices.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                      No voices found matching "{searchTerm}"
                    </div>
                  ) : (
                    filteredVoices.map((voice) => {
                      const isSelected = selectedVoices.includes(voice.voice_id);
                      return (
                        <div
                          key={voice.voice_id}
                          onClick={() => handleVoiceToggle(voice.voice_id)}
                          className="flex items-center px-3 py-2 hover:bg-accent hover:text-accent-foreground cursor-pointer"
                        >
                          <div className={`
                          w-4 h-4 border-2 rounded flex items-center justify-center mr-3 flex-shrink-0
                          ${isSelected
                              ? 'border-primary bg-primary'
                              : 'border-muted-foreground/30'
                            }
                        `}>
                            {isSelected && (
                              <svg
                                className="w-2.5 h-2.5 text-primary-foreground"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {voice.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {voice.category}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
