import { PromptModel } from "@shared/schema";
import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
export const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export interface StoryOutline {
  title: string;
  chapters: Array<{
    name: string;
    description: string;
  }>;
  summary: string;
  mainCharacter?: string;
  environment?: string;
}

export interface ImagePrompt {
  description: string;
  style: string;
  mood: string;
}

export interface ImageAssignment {
  chapter: string;
  images: Array<{
    filename: string;
    scriptSegment: string;
  }>;
}

export class OpenAIService {
  async generateStoryOutline(idea: string, customPrompt?: string, options?: PromptModel): Promise<StoryOutline> {
    let prompt = customPrompt || `
Create a compelling story outline for a YouTube video based on this idea: "${idea}"
Include 5 chapters with descriptive names.
The story should be engaging, and mysterious.`
    prompt += `
Respond with JSON in this exact format:
{
  "title": "Video title",
  "chapters": [
    {"name": "Chapter name", "description": "Chapter description"}
  ],
  "summary": "Brief story summary",
  "mainCharacter": "Main character description",
  "environment": "Environment description"
}`;

    try {
      const response = await openai.chat.completions.create({
        model: options?.model || "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a creative writer specializing in engaging YouTube video stories. Always respond with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: options?.temperature ?? 0.7,
        frequency_penalty: options?.frequencyPenalty ?? 0,
        max_completion_tokens: options?.maxTokens || 4000,
        top_p: options?.topP || 1.0
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return result as StoryOutline;
    } catch (error) {
      console.error(error);
      throw new Error(`Failed to generate story outline: ${(error as Error).message}`);
    }
  }

  async generateFullScript(outline: StoryOutline, customPrompt?: string, options?: PromptModel): Promise<string> {
    let prompt = customPrompt || `
Based on this story outline, write a complete, engaging script for a YouTube video:
"""
${JSON.stringify(outline, null, 2)}
"""

Write a full narrative script that:
- Is engaging and keeps viewers hooked
- Has natural pacing and flow
- Is approximately 2000-3000 words
- Uses vivid, descriptive language
- Maintains suspense throughout
`;
    prompt += `
Enclose the script content between --- markers like this:
---
[Your script here]
---`;

    try {
      const response = await openai.chat.completions.create({
        model: options?.model || "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a professional scriptwriter specializing in engaging YouTube content."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: options?.temperature ?? 0.7,
        frequency_penalty: options?.frequencyPenalty ?? 0,
        max_completion_tokens: options?.maxTokens || 4000,
        top_p: options?.topP || 1.0
      });

      const content = response.choices[0].message.content || "";
      const scriptMatch = content.match(/---\s*([\s\S]*?)\s*---/);
      
      if (scriptMatch) {
        return scriptMatch[1].trim();
      }
      
      return content;
    } catch (error) {
      throw new Error(`Failed to generate full script: ${(error as Error).message}`);
    }
  }

  async generateHook(customPrompt: string, outline: string, options?: PromptModel): Promise<string> {
    const prompt = customPrompt || `
Write a hook for a story video outline listed below.
The hook should:
Set up the main conflict and stakes, hinting at what’s going to happen, without giving away major twists or specific plot details.
Be intriguing and compelling, encouraging the audience to want to know more.
End with a cliffhanger line that poses an implicit question or offers a sense of discovery, but without directly referencing YouTube, “stay tuned,” or similar phrases.
Avoid summarizing the story or revealing key secrets.
Read like a tagline or teaser - evocative, concise, and cinematic.
Keep it short, it should take no more than 10 seconds to read aloud.

Here's the outline:
"""
${outline}
"""`;

    try {
      const response = await openai.chat.completions.create({
        model: options?.model || "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a professional scriptwriter specializing in engaging YouTube content."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: options?.temperature ?? 0.7,
        frequency_penalty: options?.frequencyPenalty ?? 0,
        max_completion_tokens: options?.maxTokens || 4000,
        top_p: options?.topP || 1.0
      });

      const content = response.choices[0].message.content || "";
      const scriptMatch = content.match(/---\s*([\s\S]*?)\s*---/);
      
      if (scriptMatch) {
        return scriptMatch[1].trim();
      }
      
      return content;
    } catch (error) {
      throw new Error(`Failed to generate full script: ${(error as Error).message}`);
    }
  }

  async assignImagesToScript(outline: string, script: string, images: any[], customPrompt?: string, options?: PromptModel): Promise<ImageAssignment[]> {
    let prompt = customPrompt || `
Match these image descriptions to specific segments of the script for optimal visual storytelling:

Outline:
"""
${outline}
"""

Full Script:
"""
${script}
"""

Available images:
${JSON.stringify(images, undefined, 2)}
`;
    prompt += `
Requirements:
- Include all images in the response unless they don't match any script segment.
- Include all chapters in the response.
- Each chapter must include at least 1 image.
- The result scriptSegments must include all of the original script.

Respond with JSON in this exact format:
{
  "assignments": [
    {
      "chapter": "Chapter 1. Exact title from the outline",
      "images": [
        {
          "filename": "Exact filename from the images list",
          "scriptSegment": "Texts from script this image should accompany",
        },
        {
          "filename": "Exact filename from the images list",
          "scriptSegment": "Texts from script this image should accompany",
        },
        ...
      ]
    }
  ]
}`;
console.log(prompt);
    try {
      const response = await openai.chat.completions.create({
        model: options?.model || "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert video editor who understands visual storytelling and pacing."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: options?.temperature ?? 0.7,
        frequency_penalty: options?.frequencyPenalty ?? 0,
        max_completion_tokens: options?.maxTokens || 4000,
        top_p: options?.topP || 1.0
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return result.assignments || [];
    } catch (error) {
      throw new Error(`Failed to assign images to script: ${(error as Error).message}`);
    }
  }

  async generateImagePrompts(script: string, numImages: number, customPrompt?: string, context?: { mainCharacter?: string, environment?: string }, options?: PromptModel): Promise<ImagePrompt[]> {
    let prompt = customPrompt || `
Analyze this script and generate ${numImages} detailed image prompts that would visually represent key scenes:

Script:
\`\`\`
${script}
\`\`\``;
    prompt += `

For each image, create a detailed description that includes:
- Main subject/scene
- Artistic style (cinematic, dramatic, ethereal, etc.)
- Mood and atmosphere
- Lighting and color palette`;
    // --- Add character/environment consistency ---
    if (context?.mainCharacter && context?.environment) {
      prompt += `\n\nIMPORTANT: Every image must feature the same main character: ${context.mainCharacter}, and the same environment: ${context.environment}.`;
    }
    prompt += `
Respond with JSON in this exact format:
{
  "images": [
    {
      "description": "Detailed scene description",
      "style": "Art style",
      "mood": "Mood description"
    }
  ]
}`;

    try {
      const response = await openai.chat.completions.create({
        model: options?.model || "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert visual director who creates detailed image prompts for AI art generation. Always respond with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: options?.temperature ?? 0.7,
        frequency_penalty: options?.frequencyPenalty ?? 0,
        max_completion_tokens: options?.maxTokens || 4000,
        top_p: options?.topP || 1.0
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return result.images || result.prompts || result.image_prompts || [];
    } catch (error) {
      throw new Error(`Failed to generate image prompts: ${(error as Error).message}`);
    }
  }

  async generateVideoDescription(title: string, script: string, channelInfo?: any, customPrompt?: string, options?: PromptModel): Promise<string> {
    const prompt = customPrompt || `
Create an engaging YouTube video description for this video:

Title: ${title}
Script summary: ${script.substring(0, 500)}...
${channelInfo ? `Channel info: ${JSON.stringify(channelInfo)}` : ''}

The description should:
- Hook viewers in the first line
- Provide context about the video content
- Include relevant hashtags
- Encourage engagement (likes, comments, subscribe)
- Be optimized for YouTube SEO

Keep it under 1000 characters.`;

    try {
      const response = await openai.chat.completions.create({
        model: options?.model || "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a YouTube content strategist who writes compelling video descriptions that drive engagement."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: options?.temperature ?? 0.7,
        frequency_penalty: options?.frequencyPenalty ?? 0,
        max_completion_tokens: options?.maxTokens || 300,
        top_p: options?.topP || 1.0
      });

      return response.choices[0].message.content || "";
    } catch (error) {
      throw new Error(`Failed to generate video description: ${(error as Error).message}`);
    }
  }

  async generateThumbnailPrompt(title: string, script: string, options?: PromptModel): Promise<string> {
    const prompt = `
Create a compelling thumbnail prompt for this YouTube video:

Title: ${title}
Script preview: ${script.substring(0, 300)}...

The thumbnail should be:
- Eye-catching and dramatic
- Clearly readable at small sizes
- Emotionally engaging
- Suitable for the story content

Create a single, detailed prompt for thumbnail generation.`;

    try {
      const response = await openai.chat.completions.create({
        model: options?.model || "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a YouTube thumbnail design expert who understands what drives clicks."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: options?.temperature ?? 0.7,
        frequency_penalty: options?.frequencyPenalty ?? 0,
        max_completion_tokens: options?.maxTokens || 4000,
        top_p: options?.topP || 1.0
      });

      return response.choices[0].message.content || "";
    } catch (error) {
      throw new Error(`Failed to generate thumbnail prompt: ${(error as Error).message}`);
    }
  }
}

export const openaiService = new OpenAIService();
