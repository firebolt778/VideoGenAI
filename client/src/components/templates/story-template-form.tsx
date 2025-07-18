import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  insertVideoTemplateSchema,
  type InsertVideoTemplate,
  type VideoTemplate,
} from "@shared/schema";
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
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Save,
  Lightbulb,
  FileText,
  Image,
  Volume2,
  Music,
  Wand2,
  Type,
} from "lucide-react";

interface StoryTemplateFormProps {
  isOpen: boolean;
  onClose: () => void;
  editingTemplate?: VideoTemplate | null;
}

export default function StoryTemplateForm({
  isOpen,
  onClose,
  editingTemplate,
}: StoryTemplateFormProps) {
  const { toast } = useToast();
  const [audioPauseGapValue, setAudioPauseGapValue] = useState([500]);
  const [musicVolumeValue, setMusicVolumeValue] = useState([30]);
  const [transitionDurationValue, setTransitionDurationValue] = useState([2]);

  const form = useForm<InsertVideoTemplate>({
    resolver: zodResolver(insertVideoTemplateSchema),
    defaultValues: {
      name: editingTemplate?.name ?? "",
      type: editingTemplate?.type ?? "story",
      hookPrompt:
        editingTemplate?.hookPrompt ??
        "Create a compelling hook for this story that will grab viewers' attention in the first 10 seconds. Make it mysterious and intriguing without giving away the ending.",
      ideasList: editingTemplate?.ideasList ?? "",
      storyOutlinePrompt:
        editingTemplate?.storyOutlinePrompt ??
        "Based on the provided idea, create a detailed story outline with 3-5 chapters. Include chapter names and brief descriptions. Make it engaging and suitable for a 10-15 minute video.",
      imagePrompt:
        editingTemplate?.imagePrompt ??
        "Analyze the script and generate detailed image prompts for key scenes. Each prompt should include the main subject, artistic style (cinematic, dramatic, ethereal), mood, lighting, and color palette.",
      imageModel: editingTemplate?.imageModel ?? "flux-schnell",
      imageFallbackModel: editingTemplate?.imageFallbackModel ?? "dalle-3",
      audioModel: editingTemplate?.audioModel ?? "eleven_labs",
      audioVoices: editingTemplate?.audioVoices ?? [],
      audioPauseGap: editingTemplate?.audioPauseGap ?? 500,
      backgroundMusicPrompt:
        editingTemplate?.backgroundMusicPrompt ??
        "Select appropriate background music based on the story's mood and genre. Consider suspenseful, mysterious, or atmospheric tracks that enhance the narrative without overpowering the narration.",
      musicVolume: editingTemplate?.musicVolume ?? 30,
      videoEffects: editingTemplate?.videoEffects ?? {
        kenBurns: true,
        kenBurnsSpeed: 1,
        kenBurnsDirection: "zoom-in",
        filmGrain: false,
        fog: false,
      },
      captionsEnabled: editingTemplate?.captionsEnabled ?? true,
      captionsFont: editingTemplate?.captionsFont ?? "Inter",
      captionsColor: editingTemplate?.captionsColor ?? "#ffffff",
      captionsPosition: editingTemplate?.captionsPosition ?? "bottom",
      videoTransitions: editingTemplate?.videoTransitions ?? "mix-fade",
      transitionDuration: editingTemplate?.transitionDuration ?? 2,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: InsertVideoTemplate) => {
      const url = editingTemplate
        ? `/api/video-templates/${editingTemplate.id}`
        : "/api/video-templates";
      const method = editingTemplate ? "PUT" : "POST";
      return await apiRequest(method, url, data);
    },
    onSuccess: () => {
      toast({
        title: editingTemplate ? "Template updated" : "Template created",
        description: editingTemplate
          ? "Your template has been successfully updated"
          : "Your template has been successfully created",
      });
      form.reset();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: editingTemplate
          ? "Failed to update template"
          : "Failed to create template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertVideoTemplate) => {
    mutation.mutate({
      ...data,
      audioPauseGap: audioPauseGapValue[0],
      musicVolume: musicVolumeValue[0],
      transitionDuration: transitionDurationValue[0],
      videoEffects: {
        ...data.videoEffects,
        kenBurnsSpeed: data.videoEffects?.kenBurnsSpeed || 1,
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingTemplate ? "Edit Story Template" : "Create Story Template"}
          </DialogTitle>
          <DialogDescription>
            Configure all aspects of your story video template including AI
            prompts, media settings, and video effects
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Settings */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Save className="w-5 h-5 text-primary" />
                <h4 className="text-md font-medium">Template Settings</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Template Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Ghost Stories Template"
                          {...field}
                        />
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
                      <FormLabel>Template Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value ?? undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="story">Story</SelectItem>
                          <SelectItem value="news">News</SelectItem>
                          <SelectItem value="educational">
                            Educational
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* AI Content Generation */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Lightbulb className="w-5 h-5 text-primary" />
                <h4 className="text-md font-medium">Content Generation</h4>
              </div>

              <FormField
                control={form.control}
                name="hookPrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hook Generation Prompt</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Prompt for generating video hooks..."
                        rows={3}
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
                name="ideasList"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ideas List (separate with ---)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Idea 1: A mysterious house where time moves differently...&#10;---&#10;Idea 2: A photographer discovers their camera captures the future..."
                        rows={5}
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
                name="storyOutlinePrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Story Outline Prompt</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Prompt for generating story outlines..."
                        rows={3}
                        {...field}
                        value={field.value ?? undefined}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Image Generation */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Image className="w-5 h-5 text-primary" />
                <h4 className="text-md font-medium">Image Generation</h4>
              </div>

              <FormField
                control={form.control}
                name="imagePrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image Generation Prompt</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Prompt for generating image descriptions..."
                        rows={3}
                        {...field}
                        value={field.value ?? undefined}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="flux-schnell">
                            Flux Schnell
                          </SelectItem>
                          <SelectItem value="flux-pro">Flux Pro</SelectItem>
                          <SelectItem value="dalle-3">DALL-E 3</SelectItem>
                          <SelectItem value="midjourney">Midjourney</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="imageFallbackModel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fallback Image Model</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value ?? undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="dalle-3">DALL-E 3</SelectItem>
                          <SelectItem value="flux-schnell">
                            Flux Schnell
                          </SelectItem>
                          <SelectItem value="none">None</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Audio Settings */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Volume2 className="w-5 h-5 text-primary" />
                <h4 className="text-md font-medium">Audio Settings</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="eleven_labs">
                            ElevenLabs
                          </SelectItem>
                          <SelectItem value="openai_tts">OpenAI TTS</SelectItem>
                          <SelectItem value="azure_speech">
                            Azure Speech
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem>
                  <FormLabel>Pause Gap ({audioPauseGapValue[0]}ms)</FormLabel>
                  <FormControl>
                    <Slider
                      value={audioPauseGapValue}
                      onValueChange={setAudioPauseGapValue}
                      min={100}
                      max={2000}
                      step={100}
                      className="py-4"
                    />
                  </FormControl>
                </FormItem>
              </div>

              <FormField
                control={form.control}
                name="backgroundMusicPrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Background Music Selection Prompt</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Prompt for selecting background music..."
                        rows={2}
                        {...field}
                        value={field.value ?? undefined}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem>
                <FormLabel>Music Volume ({musicVolumeValue[0]}%)</FormLabel>
                <FormControl>
                  <Slider
                    value={musicVolumeValue}
                    onValueChange={setMusicVolumeValue}
                    min={0}
                    max={100}
                    step={5}
                    className="py-4"
                  />
                </FormControl>
              </FormItem>
            </div>

            {/* Video Effects */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Wand2 className="w-5 h-5 text-primary" />
                <h4 className="text-md font-medium">Video Effects</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="videoTransitions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Video Transitions</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value ?? undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="mix-fade">Mix Fade</SelectItem>
                          <SelectItem value="cross-dissolve">
                            Cross Dissolve
                          </SelectItem>
                          <SelectItem value="cut">Hard Cut</SelectItem>
                          <SelectItem value="push">Push</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem>
                  <FormLabel>
                    Transition Duration ({transitionDurationValue[0]}s)
                  </FormLabel>
                  <FormControl>
                    <Slider
                      value={transitionDurationValue}
                      onValueChange={setTransitionDurationValue}
                      min={0.5}
                      max={5}
                      step={0.5}
                      className="py-4"
                    />
                  </FormControl>
                </FormItem>
              </div>

              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="videoEffects.kenBurns"
                  render={({ field }) => (
                    <div className="flex items-center justify-between">
                      <FormLabel>Ken Burns Effect (Zoom)</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </div>
                  )}
                />

                <FormField
                  control={form.control}
                  name="videoEffects.filmGrain"
                  render={({ field }) => (
                    <div className="flex items-center justify-between">
                      <FormLabel>Film Grain</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </div>
                  )}
                />
              </div>
            </div>

            {/* Caption Settings */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Type className="w-5 h-5 text-primary" />
                <h4 className="text-md font-medium">Caption Settings</h4>
              </div>

              <FormField
                control={form.control}
                name="captionsEnabled"
                render={({ field }) => (
                  <div className="flex items-center justify-between">
                    <FormLabel>Enable Captions</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value ?? undefined}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </div>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="captionsFont"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Font</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value ?? undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Inter">Inter</SelectItem>
                          <SelectItem value="Arial">Arial</SelectItem>
                          <SelectItem value="Helvetica">Helvetica</SelectItem>
                          <SelectItem value="Roboto">Roboto</SelectItem>
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
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="bottom">Bottom</SelectItem>
                          <SelectItem value="top">Top</SelectItem>
                          <SelectItem value="center">Center</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending
                  ? "Saving..."
                  : editingTemplate
                  ? "Update Template"
                  : "Create Template"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
