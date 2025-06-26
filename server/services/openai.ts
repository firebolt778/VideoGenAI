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
  async generateStoryOutline(idea: string, customPrompt?: string): Promise<StoryOutline> {
    let prompt = customPrompt || `
Create a compelling story outline for a YouTube video based on this idea: "${idea}"

The story should be engaging, mysterious, and suitable for a 10-15 minute video.
Include 3-5 chapters with descriptive names.`
    prompt += `
Respond with JSON in this exact format:
{
  "title": "Video title",
  "chapters": [
    {"name": "Chapter name", "description": "Chapter description"}
  ],
  "summary": "Brief story summary"
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
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
        temperature: 0.8
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return result as StoryOutline;
    } catch (error) {
      throw new Error(`Failed to generate story outline: ${(error as Error).message}`);
    }
  }

  async generateFullScript(outline: StoryOutline, customPrompt?: string): Promise<string> {
    const prompt = customPrompt || `
Based on this story outline, write a complete, engaging script for a YouTube video:

Title: ${outline.title}
Summary: ${outline.summary}
Chapters: ${outline.chapters.map(c => `${c.name}: ${c.description}`).join('\n')}

Write a full narrative script that:
- Is engaging and keeps viewers hooked
- Has natural pacing and flow
- Is approximately 2000-3000 words
- Uses vivid, descriptive language
- Maintains suspense throughout

Enclose the script content between --- markers like this:
---
[Your script here]
---`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
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
        temperature: 0.7,
        max_tokens: 4000
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

  async generateImagePrompts(script: string, numImages: number, customPrompt?: string): Promise<ImagePrompt[]> {
    const prompt = customPrompt || `
Analyze this script and generate ${numImages} detailed image prompts that would visually represent key scenes:

Script:
\`\`\`
${script}
\`\`\`

For each image, create a detailed description that includes:
- Main subject/scene
- Artistic style (cinematic, dramatic, ethereal, etc.)
- Mood and atmosphere
- Lighting and color palette

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
        model: "gpt-4o",
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
        temperature: 0.7
      });

      console.log('============================')
      console.log(response.choices[0].message.content)

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return result.images || result.prompts || result.image_prompts || [];
    } catch (error) {
      throw new Error(`Failed to generate image prompts: ${(error as Error).message}`);
    }
  }

  async assignImagesToScript(script: string, imageDescriptions: string[], customPrompt?: string): Promise<ImageAssignment[]> {
    let prompt = customPrompt || `
Match these image descriptions to specific segments of the script for optimal visual storytelling:

Script: "${script}"

Available images:
${imageDescriptions.map((desc, i) => `${i + 1}. ${desc}`).join('\n')}`;
    prompt += `

For each image, determine:
- Which script segment it should accompany
- Why this pairing works best
Respond with JSON in this exact format:
{
  "assignments": [
    {
      "imageIndex": 1,
      "scriptSegment": "Exact text from script this image should accompany",
      "description": "Brief explanation of why this pairing works",
      "filename": "image_001.jpg"
    }
  ]
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert video editor who understands visual storytelling and pacing. Always respond with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.5
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return result.assignments || [];
    } catch (error) {
      throw new Error(`Failed to assign images to script: ${(error as Error).message}`);
    }
  }

  async generateVideoDescription(title: string, script: string, channelInfo?: any): Promise<string> {
    const prompt = `
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
        model: "gpt-4o",
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
        temperature: 0.7,
        max_tokens: 300
      });

      return response.choices[0].message.content || "";
    } catch (error) {
      throw new Error(`Failed to generate video description: ${(error as Error).message}`);
    }
  }

  async generateThumbnailPrompt(title: string, script: string): Promise<string> {
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
        model: "gpt-4o",
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
        temperature: 0.7,
        max_tokens: 200
      });

      return response.choices[0].message.content || "";
    } catch (error) {
      throw new Error(`Failed to generate thumbnail prompt: ${(error as Error).message}`);
    }
  }
}

export const openaiService = new OpenAIService();
