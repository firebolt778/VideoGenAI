import { llmModels } from "@/lib/llms";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { cn } from "@/lib/utils";

interface Props {
  form: any;
  name: string;
  title: string;
  className?: string;
}

export default function PromptModelSelector({ form, name, title, className }: Props) {
  const onModelChange = (model: string) => {
    form.setValue(`${name}.model`, model);
    if (model.startsWith("gpt-5")) {
      form.unregister(`${name}.temperature`);
      form.unregister(`${name}.topP`);
      form.unregister(`${name}.frequencyPenalty`);
      form.unregister(`${name}.maxTokens`);
      form.setValue(`${name}.effort`, "low");
    } else {
      form.unregister(`${name}.effort`);
      form.setValue(`${name}.temperature`, 0.7);
      form.setValue(`${name}.topP`, 0.9);
      form.setValue(`${name}.frequencyPenalty`, 0);
      form.setValue(`${name}.maxTokens`, 8192);
    }
  }

  return (
    <div className={cn("border rounded-lg p-4 bg-muted", className)}>
      <div className="text-lg font-medium">{title}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        <FormField
          control={form.control}
          name={`${name}.model`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Model</FormLabel>
              <Select
                onValueChange={onModelChange}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {llmModels.map((model, index) => (
                    <SelectItem key={index} value={model.value}>{model.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.watch(`${name}.model`).startsWith("gpt-5") && (
          <FormField
            control={form.control}
            name={`${name}.effort`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reasoning Effort</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select effort" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="minimal">Minimal</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        {!form.watch(`${name}.model`).startsWith("gpt-5") && (
          <FormField
            control={form.control}
            name={`${name}.maxTokens`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Tokens</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    placeholder="e.g. 500"
                    value={field.value ?? 0}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>

      {!form.watch(`${name}.model`).startsWith("gpt-5") && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
          <FormField
            control={form.control}
            name={`${name}.temperature`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Temperature</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    placeholder="0.7"
                    disabled={form.watch(`${name}.model`) === "gpt-5"}
                    value={field.value ?? 0}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`${name}.topP`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Top P</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    placeholder="0.9"
                    value={field.value ?? 0}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`${name}.frequencyPenalty`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Frequency Penalty</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    placeholder="0.0"
                    value={field.value ?? 0}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </div>
  )
}