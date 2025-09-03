import { PromptModel } from "@shared/schema";
import OpenAI from "openai";
import { ReasoningEffort } from "openai/resources/shared.mjs";

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
      let additionalParams: { [key: string]: any } = {};
      if (!options?.model.startsWith("gpt-5")) {
        additionalParams = {
          temperature: options?.temperature ?? 0.7,
          frequency_penalty: options?.frequencyPenalty ?? 0,
          max_completion_tokens: options?.maxTokens || 4000,
          top_p: options?.topP || 1.0
        }
      }
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
        reasoning_effort: options?.effort as ReasoningEffort | undefined,
        response_format: { type: "json_object" },
        ...additionalParams
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
Each chapter must be separated by +++.
Enclose the script content between --- markers like this:
---
[Your script here]
---`;

    try {
      let additionalParams: { [key: string]: any } = {};
      if (!options?.model.startsWith("gpt-5")) {
        additionalParams = {
          temperature: options?.temperature ?? 0.7,
          frequency_penalty: options?.frequencyPenalty ?? 0,
          max_completion_tokens: options?.maxTokens || 4000,
          top_p: options?.topP || 1.0
        }
      }
      const response = await openai.chat.completions.create({
        model: options?.model || "gpt-5",
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
        reasoning_effort: options?.effort as ReasoningEffort | undefined,
        ...additionalParams
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
      let additionalParams: { [key: string]: any } = {};
      if (!options?.model.startsWith("gpt-5")) {
        additionalParams = {
          temperature: options?.temperature ?? 0.7,
          frequency_penalty: options?.frequencyPenalty ?? 0,
          max_completion_tokens: options?.maxTokens || 4000,
          top_p: options?.topP || 1.0
        }
      }
      const response = await openai.chat.completions.create({
        model: options?.model || "gpt-5",
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
        reasoning_effort: options?.effort as ReasoningEffort | undefined,
        ...additionalParams
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
      let additionalParams: { [key: string]: any } = {};
      if (!options?.model.startsWith("gpt-5")) {
        additionalParams = {
          temperature: options?.temperature ?? 0.7,
          frequency_penalty: options?.frequencyPenalty ?? 0,
          max_completion_tokens: options?.maxTokens || 300,
          top_p: options?.topP || 1.0
        }
      }
      const response = await openai.chat.completions.create({
        model: options?.model || "gpt-5",
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
        reasoning_effort: options?.effort as ReasoningEffort | undefined,
        ...additionalParams
      });

      return response.choices[0].message.content || "";
    } catch (error) {
      throw new Error(`Failed to generate video description: ${(error as Error).message}`);
    }
  }

  async generateVisualStyle(prompt: string, options?: PromptModel): Promise<string> {
    try {
      let additionalParams: { [key: string]: any } = {};
      if (!options?.model.startsWith("gpt-5")) {
        additionalParams = {
          temperature: options?.temperature ?? 0.7,
          frequency_penalty: options?.frequencyPenalty ?? 0,
          max_completion_tokens: options?.maxTokens || 4000,
          top_p: options?.topP || 1.0
        }
      }
      const response = await openai.chat.completions.create({
        model: options?.model || "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are a visual director who creates consistent visual styles for video content."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        reasoning_effort: options?.effort as ReasoningEffort | undefined,
        ...additionalParams
      });

      return response.choices[0].message.content || "";
    } catch (error) {
      throw new Error(`Failed to generate visual style: ${(error as Error).message}`);
    }
  }

  async generateChapterContent(prompt: string, options?: PromptModel): Promise<string> {
    try {
      let additionalParams: { [key: string]: any } = {};
      if (!options?.model.startsWith("gpt-5")) {
        additionalParams = {
          temperature: options?.temperature ?? 0.7,
          frequency_penalty: options?.frequencyPenalty ?? 0,
          max_completion_tokens: options?.maxTokens || 4000,
          top_p: options?.topP || 1.0
        }
      }
      const response = await openai.chat.completions.create({
        model: options?.model || "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are a creative writer who expands story outlines into engaging chapter content."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        reasoning_effort: options?.effort as ReasoningEffort | undefined,
        ...additionalParams
      });

      return response.choices[0].message.content || "";
    } catch (error) {
      throw new Error(`Failed to generate chapter content: ${(error as Error).message}`);
    }
  }

  async generateChapterImages(
    mainPrompt: string,
    imageCount: number,
    chapterContent: string, // Add chapter content parameter
    options?: PromptModel
  ): Promise<{
    images: Array<{ description: string; scriptSegment: string }>;
    anchors: Array<{ img: number; start: string; end: string }>;
  }> {
    try {
      let additionalParams: { [key: string]: any } = {};
      if (!options?.model.startsWith("gpt-5")) {
        additionalParams = {
          temperature: options?.temperature ?? 0.7,
          frequency_penalty: options?.frequencyPenalty ?? 0,
          max_completion_tokens: options?.maxTokens || 4000,
          top_p: options?.topP || 1.0
        }
      }
      const prompt = `${mainPrompt}

RESPOND WITH JSON ONLY. EXACT FORMAT (no markdown, no comments, no trailing commas):
{
  "anchors": [
    {
      "img":1,
      "start":"chapter_start",
      "end":"<exact phrase>",
      "description": "<STYLE LINE REPEATED VERBATIM>\n<CAMERA: shot scale, lens mm/FOV, camera height or distance with units, angle, exact position relative to stable landmarks>\n<LAYOUT: one-sentence spatial map naming landmarks/axes and their relative positions suited to this environment>\n<COMPOSITION: what is at frame left/center/right and foreground/midground/background, with at least one compositional anchor>\n<fully self-contained scene description that fits only between the start and end anchors for image 1, restating setting and fixed details, with no comparative terms across images>",
    },
    {
      "img":2,
      "start":"<exact phrase>",
      "end":"<exact phrase>",
      "description": "<STYLE LINE REPEATED VERBATIM>\n<CAMERA: shot scale, lens mm/FOV, camera height or distance with units, angle, exact position relative to stable landmarks>\n<LAYOUT: one-sentence spatial map naming landmarks/axes and their relative positions suited to this environment>\n<COMPOSITION: what is at frame left/center/right and foreground/midground/background, with at least one compositional anchor>\n<fully self-contained scene description that fits only between the start and end anchors for image 1, restating setting and fixed details, with no comparative terms across images>",
    },
    // ... continue sequentially for each i = 3…${imageCount - 1}
    {
      "img":${imageCount},
      "start":"<exact phrase>",
      "end":"chapter_end,
      "description": "<STYLE LINE REPEATED VERBATIM>\n<CAMERA: shot scale, lens mm/FOV, camera height or distance with units, angle, exact position relative to stable landmarks>\n<LAYOUT: one-sentence spatial map naming landmarks/axes and their relative positions suited to this environment>\n<COMPOSITION: what is at frame left/center/right and foreground/midground/background, with at least one compositional anchor>\n<fully self-contained scene description that fits only between the start and end anchors for image 1, restating setting and fixed details, with no comparative terms across images>",
    "}
  ]
}`;

      const response = await openai.chat.completions.create({
        model: options?.model || "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are an expert visual director who creates detailed image prompts with precise text anchors for AI art generation."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        reasoning_effort: options?.effort as ReasoningEffort | undefined,
        response_format: { type: "json_object" },
        ...additionalParams
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");

      // Generate scriptSegments programmatically
      const imagesWithScriptSegments = this.addScriptSegments(
        result.anchors || [],
        chapterContent
      );

      return {
        images: imagesWithScriptSegments,
        anchors: result.anchors || []
      };
    } catch (error) {
      throw new Error(`Failed to generate chapter images: ${(error as Error).message}`);
    }
  }

  // Helper function to extract script segments
  private addScriptSegments(
    anchors: Array<{ img: number; start: string; end: string; description: string }>,
    chapterContent: string
  ): Array<{ description: string; scriptSegment: string }> {
    return anchors.map((anchor) => {
      const scriptSegment = this.extractScriptSegment(
        chapterContent,
        anchor.start,
        anchor.end
      );

      return {
        description: anchor.description,
        scriptSegment
      };
    });
  }

  // Helper function to extract text between anchors
  private extractScriptSegment(
    chapterContent: string,
    startAnchor: string,
    endAnchor: string
  ): string {
    try {
      let startIndex = 0;
      let endIndex = chapterContent.length;

      // Handle start anchor
      if (startAnchor !== "chapter_start") {
        const startPos = chapterContent.indexOf(startAnchor);
        if (startPos !== -1) {
          startIndex = startPos;
        }
      }

      // Handle end anchor
      if (endAnchor !== "chapter_end") {
        const endPos = chapterContent.indexOf(endAnchor);
        if (endPos !== -1) {
          // Include the end phrase in the segment
          endIndex = endPos + endAnchor.length;
        }
      }

      // Extract the segment
      let segment = chapterContent.slice(startIndex, endIndex).trim();
      if (segment.endsWith(endAnchor)) {
        segment = segment.slice(0, -endAnchor.length).trim();
      }
      return segment.trim();
    } catch (error) {
      console.error(`Error extracting script segment: ${error}`);
      return "";
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
      let additionalParams: { [key: string]: any } = {};
      if (!options?.model.startsWith("gpt-5")) {
        additionalParams = {
          temperature: options?.temperature ?? 0.7,
          frequency_penalty: options?.frequencyPenalty ?? 0,
          max_completion_tokens: options?.maxTokens || 4000,
          top_p: options?.topP || 1.0
        }
      }
      const response = await openai.chat.completions.create({
        model: options?.model || "gpt-5",
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
        reasoning_effort: options?.effort as ReasoningEffort | undefined,
        ...additionalParams
      });

      return response.choices[0].message.content || "";
    } catch (error) {
      throw new Error(`Failed to generate thumbnail prompt: ${(error as Error).message}`);
    }
  }
}

export const openaiService = new OpenAIService();
