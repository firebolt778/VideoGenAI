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
  imageIndex: number;
  scriptSegment: string;
  description: string;
  filename: string;
}

export class OpenAIService {
  async generateStoryOutline(idea: string, imageCount: number, customPrompt?: string, options?: PromptModel): Promise<StoryOutline> {
    let prompt = customPrompt || `
Create a compelling story outline for a YouTube video based on this idea: "${idea}"

The story should be engaging, and mysterious.
The story should be suitable for 60-70 minutes video: 7500-9000 word.`
    prompt += `
Include ${imageCount} chapters with descriptive names.
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

  async generateFullScript(customPrompt: string, outline: string, options?: PromptModel): Promise<string> {
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

  async generateScriptForChapter(outline: StoryOutline, chapter: { name: string, description: string }, previousScript?: string, videoLength?: number, customPrompt?: string, options?: PromptModel): Promise<string> {
    const len = (videoLength || 60) / outline.chapters.length;
    let prompt = customPrompt || `
Write a spoken-word script for a YouTube video chapter. The tone should be natural, engaging, and suited for voiceover narration—imagine someone speaking directly to the audience.

Here’s the context:
Title: ${outline.title}
Summary: ${outline.summary}

Guidelines:
- Use conversational language, as if a person is explaining something to a friend.
- Vary sentence length and pacing to sound more natural when read aloud.
- Use rhetorical questions, pauses, or brief asides for a dynamic spoken effect.
- Make transitions smooth and logical to maintain flow between ideas.
- Avoid overly complex or literary phrasing—keep it simple and human.
- Do **not** include scene directions or camera cues—just spoken narration.
- End with a sentence that leads naturally into the next chapter (if applicable).
`;
    prompt += `
Here’s the chapter:
Chapter: ${chapter.name} - ${chapter.description}
${previousScript ? `Previous script:\n${previousScript}\n` : ""}

Target word count: ${len * 135}-${len * 150} words.

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
      throw new Error(`Failed to generate script for chapter: ${(error as Error).message}`);
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
