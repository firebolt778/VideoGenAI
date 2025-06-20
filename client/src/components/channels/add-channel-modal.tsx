import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertChannelSchema, type InsertChannel } from "@shared/schema";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import FileUpload from "@/components/ui/file-upload";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Info, Palette, Settings, Film } from "lucide-react";

interface AddChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const formSchema = insertChannelSchema.extend({
  videosMin: insertChannelSchema.shape.videosMin.default(1),
  videosMax: insertChannelSchema.shape.videosMax.default(2),
});

export default function AddChannelModal({ isOpen, onClose }: AddChannelModalProps) {
  const { toast } = useToast();
  const [watermarkOpacityValue, setWatermarkOpacityValue] = useState([80]);
  const [watermarkSizeValue, setWatermarkSizeValue] = useState([15]);

  const form = useForm<InsertChannel>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      url: "",
      description: "",
      watermarkPosition: "bottom-right",
      watermarkOpacity: 80,
      watermarkSize: 15,
      schedule: "daily",
      videosMin: 1,
      videosMax: 2,
      chapterIndicators: false,
      videoIntro: false,
      videoOutro: false,
      isActive: true,
    },
  });

  const createChannelMutation = useMutation({
    mutationFn: async (data: InsertChannel) => {
      return await apiRequest('POST', '/api/channels', data);
    },
    onSuccess: () => {
      toast({
        title: "Channel created",
        description: "Your channel has been successfully created",
      });
      form.reset();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create channel",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertChannel) => {
    createChannelMutation.mutate({
      ...data,
      watermarkOpacity: watermarkOpacityValue[0],
      watermarkSize: watermarkSizeValue[0],
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Channel</DialogTitle>
          <DialogDescription>
            Create a new YouTube channel for automated video generation
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Info className="w-5 h-5 text-primary" />
                <h4 className="text-md font-medium">Basic Information</h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Channel Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Ghost Stories Channel" {...field} />
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
                      <FormLabel>YouTube URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://youtube.com/@channel" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Channel Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Brief description of your channel..." 
                        rows={3} 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Branding & Assets */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Palette className="w-5 h-5 text-primary" />
                <h4 className="text-md font-medium">Branding & Assets</h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Channel Logo</FormLabel>
                      <FormControl>
                        <FileUpload
                          endpoint="/api/upload/logo"
                          accept="image/*"
                          onUpload={(url) => field.onChange(url)}
                          placeholder="Upload logo or drag and drop"
                          description="PNG, JPG up to 2MB"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="watermarkUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Watermark</FormLabel>
                      <FormControl>
                        <FileUpload
                          endpoint="/api/upload/watermark"
                          accept="image/*"
                          onUpload={(url) => field.onChange(url)}
                          placeholder="Upload watermark or drag and drop"
                          description="PNG with transparency"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="watermarkPosition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Watermark Position</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="bottom-right">Bottom Right</SelectItem>
                          <SelectItem value="bottom-left">Bottom Left</SelectItem>
                          <SelectItem value="top-right">Top Right</SelectItem>
                          <SelectItem value="top-left">Top Left</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormItem>
                  <FormLabel>Opacity ({watermarkOpacityValue[0]}%)</FormLabel>
                  <FormControl>
                    <Slider
                      value={watermarkOpacityValue}
                      onValueChange={setWatermarkOpacityValue}
                      min={10}
                      max={100}
                      step={5}
                      className="py-4"
                    />
                  </FormControl>
                </FormItem>
                
                <FormItem>
                  <FormLabel>Size ({watermarkSizeValue[0]}%)</FormLabel>
                  <FormControl>
                    <Slider
                      value={watermarkSizeValue}
                      onValueChange={setWatermarkSizeValue}
                      min={5}
                      max={50}
                      step={1}
                      className="py-4"
                    />
                  </FormControl>
                </FormItem>
              </div>
            </div>

            {/* Automation Settings */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Settings className="w-5 h-5 text-primary" />
                <h4 className="text-md font-medium">Automation Settings</h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="schedule"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Publishing Schedule</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="space-y-2">
                  <FormLabel>Videos per Period</FormLabel>
                  <div className="flex items-center space-x-2">
                    <FormField
                      control={form.control}
                      name="videosMin"
                      render={({ field }) => (
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={10}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                      )}
                    />
                    <span className="text-muted-foreground">to</span>
                    <FormField
                      control={form.control}
                      name="videosMax"
                      render={({ field }) => (
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                      )}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <FormLabel>Video Templates</FormLabel>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="story-template" defaultChecked />
                    <label htmlFor="story-template" className="text-sm">Story Video Template</label>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <FormLabel>Thumbnail Types</FormLabel>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="first-image" defaultChecked />
                    <label htmlFor="first-image" className="text-sm">First Image</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="last-image" />
                    <label htmlFor="last-image" className="text-sm">Last Image</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="ai-generated" />
                    <label htmlFor="ai-generated" className="text-sm">AI Generated</label>
                  </div>
                </div>
              </div>
            </div>

            {/* Video Elements */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Film className="w-5 h-5 text-primary" />
                <h4 className="text-md font-medium">Video Elements</h4>
              </div>
              
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="chapterIndicators"
                  render={({ field }) => (
                    <div className="flex items-center justify-between">
                      <FormLabel>Chapter Indicators</FormLabel>
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
                  name="videoIntro"
                  render={({ field }) => (
                    <div className="flex items-center justify-between">
                      <FormLabel>Video Intro</FormLabel>
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
                  name="videoOutro"
                  render={({ field }) => (
                    <div className="flex items-center justify-between">
                      <FormLabel>Video Outro</FormLabel>
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

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createChannelMutation.isPending}>
                {createChannelMutation.isPending ? "Creating..." : "Create Channel"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
