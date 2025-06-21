import React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Header from "@/components/layout/header";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { z } from "zod";

const apiKeys = [
  { key: "openai_api_key", label: "OpenAI API Key" },
  { key: "replicate_api_key", label: "Replicate API Key" },
  { key: "elevenlabs_api_key", label: "ElevenLabs API Key" },
  { key: "youtube_api_key", label: "YouTube API Key" },
];

const modelListKey = "model_list";

const modelSchema = z.object({
  model: z.string().min(1, "Model name is required"),
});

type ModelForm = z.infer<typeof modelSchema>;

type Setting = {
  key: string;
  value: string | null;
  jsonValue?: any;
};

export default function Settings() {
  const { toast } = useToast();
  const [modelInputOpen, setModelInputOpen] = useState(false);

  // Fetch all settings
  const { data: settings, refetch } = useQuery<Setting[]>({
    queryKey: ["/api/settings"],
  });

  // API key form logic
  const apiKeyForm = useForm<{ [key: string]: string }>({
    defaultValues: Object.fromEntries(apiKeys.map(a => [a.key, ""])),
  });

  // Model add form
  const modelForm = useForm<ModelForm>({
    resolver: zodResolver(modelSchema),
    defaultValues: { model: "" },
  });

  // Save API key
  const saveApiKey = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      await fetch(`/api/settings/${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
    },
    onSuccess: () => {
      toast({ title: "API Key Saved" });
      refetch();
    },
    onError: () => toast({ title: "Failed to save API key", variant: "destructive" }),
  });

  // Add model
  const addModel = useMutation({
    mutationFn: async (model: string) => {
      const current = settings?.find(s => s.key === modelListKey)?.jsonValue || [];
      await fetch(`/api/settings/${modelListKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonValue: [...current, model] }),
      });
    },
    onSuccess: () => {
      toast({ title: "Model added" });
      modelForm.reset();
      setModelInputOpen(false);
      refetch();
    },
    onError: () => toast({ title: "Failed to add model", variant: "destructive" }),
  });

  // Remove model
  const removeModel = useMutation({
    mutationFn: async (model: string) => {
      const current = settings?.find(s => s.key === modelListKey)?.jsonValue || [];
      await fetch(`/api/settings/${modelListKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonValue: current.filter((m: string) => m !== model) }),
      });
    },
    onSuccess: () => {
      toast({ title: "Model removed" });
      refetch();
    },
    onError: () => toast({ title: "Failed to remove model", variant: "destructive" }),
  });

  // Handle API key save
  const handleApiKeySave = (key: string) => {
    const value = apiKeyForm.getValues(key);
    saveApiKey.mutate({ key, value });
  };

  // Get current model list
  const modelList: string[] = settings?.find(s => s.key === modelListKey)?.jsonValue || [];

  // Set form values from settings
  React.useEffect(() => {
    if (settings) {
      apiKeys.forEach(({ key }) => {
        const val = settings.find(s => s.key === key)?.value || "";
        apiKeyForm.setValue(key, val);
      });
    }
    // eslint-disable-next-line
  }, [settings]);

  return (
    <>
      <Header
        title="Settings"
        description="Manage API keys and available models for dropdowns."
        showAddButton={false}
      />
      <div className="p-6 space-y-8">
        {/* API Keys */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium">API Keys</h3>
          </CardHeader>
          <CardContent>
            <Form {...apiKeyForm}>
              {apiKeys.map(({ key, label }) => (
                <FormField
                  key={key}
                  control={apiKeyForm.control}
                  name={key}
                  render={({ field }) => (
                    <FormItem className="mb-4">
                      <FormLabel>{label}</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input type="password" {...field} autoComplete="off" />
                        </FormControl>
                        <Button type="button" onClick={() => handleApiKeySave(key)}>
                          Save
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </Form>
          </CardContent>
        </Card>

        {/* Model List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Available Models</h3>
              <Button variant="outline" onClick={() => setModelInputOpen(v => !v)}>
                <Plus className="w-4 h-4 mr-2" /> Add Model
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {modelInputOpen && (
              <Form {...modelForm}>
                <div className="flex gap-2 mb-4">
                  <FormField
                    control={modelForm.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="Model name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    onClick={modelForm.handleSubmit(data => addModel.mutate(data.model))}
                  >
                    Add
                  </Button>
                </div>
              </Form>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model Name</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modelList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      No models added yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  modelList.map((model) => (
                    <TableRow key={model}>
                      <TableCell>{model}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          title="Remove Model"
                          onClick={() => removeModel.mutate(model)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
} 