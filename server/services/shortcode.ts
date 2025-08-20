export interface ShortcodeContext {
  ideas?: string;
  selectedIdea?: string;
  outline?: string;
  script?: string;
  title?: string;
  images?: {
    index: number;
    description: string;
    url: string;
    filename: string;
    prompt: string;
  }[];
  channelName?: string;
  channelDescription?: string;
  imageCount?: number;
  // --- Added for new workflow ---
  visualStyle?: string;
  videoId?: number;
}

export class ShortcodeProcessor {
  static process(template: string, context: ShortcodeContext, chapter?: any): string {
    let processed = template;
    const outline = JSON.parse(context.outline || "{}");

    // Replace shortcodes with actual values
    const replacements = {
      '{{IDEAS}}': context.selectedIdea || context.ideas || '',
      '{{OUTLINE}}': context.outline || '',
      '{{SCRIPT}}': context.script || '',
      '{{TITLE}}': context.title || '',
      '{{SUMMARY}}': outline.summary || '',
      '{{IMAGES}}': JSON.stringify(context.images || []),
      '{{CHANNEL_NAME}}': context.channelName || '',
      '{{CHANNEL_DESCRIPTION}}': context.channelDescription || '',
      '{{imageCount}}': context.imageCount?.toString() || '8',
      '{{VISUAL_STYLE}}': context.visualStyle || '',
      '{{CHAPTER_NAME}}': chapter?.name || '',
      '{{CHAPTER_DESCRIPTION}}': chapter?.description || '',
      '{{CHAPTER_CONTENT}}': chapter?.content || '',
    };

    // Apply all replacements
    for (const [shortcode, value] of Object.entries(replacements)) {
      processed = processed.replace(new RegExp(shortcode.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    return processed;
  }

  static extractDataFromResponse(response: string, markers: { start?: string; end?: string } = {}): string {
    const { start = '---', end = '---' } = markers;
    
    if (start && end) {
      const startIndex = response.indexOf(start);
      const endIndex = response.lastIndexOf(end);
      
      if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        return response.substring(startIndex + start.length, endIndex).trim();
      }
    }
    
    return response.trim();
  }

  static extractTitle(response: string): string {
    const titleMatch = response.match(/Title:\s*(.+?)(?:\n|$)/i);
    return titleMatch ? titleMatch[1].trim() : '';
  }

  static extractChapters(response: string): Array<{ name: string; description: string }> {
    const chapters: Array<{ name: string; description: string }> = [];
    const chapterRegex = /Chapter \d+:\s*(.+?)\s*-\s*(.+?)(?:\n|$)/gi;
    let match: RegExpExecArray | null;
    while ((match = chapterRegex.exec(response)) !== null) {
      chapters.push({
        name: match[1].trim(),
        description: match[2].trim()
      });
    }
    
    return chapters;
  }

  static extractSummary(response: string): string {
    const summaryMatch = response.match(/Summary:\s*(.+?)(?:\n|$)/i);
    return summaryMatch ? summaryMatch[1].trim() : '';
  }

  static parseImageAssignments(response: string): Array<{
    imageIndex: number;
    scriptSegment: string;
    description: string;
    filename: string;
  }> {
    const assignments: Array<{
      imageIndex: number;
      scriptSegment: string;
      description: string;
      filename: string;
    }> = [];

    // Match patterns like: Image 1: [script segment] - [description] - filename: image_001.jpg
    const regex = /Image (\d+):\s*(.+?)\s*-\s*(.+?)\s*-\s*filename:\s*(.+?)(?:\n|$)/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(response)) !== null) {
      assignments.push({
        imageIndex: parseInt(match[1]),
        scriptSegment: match[2].trim(),
        description: match[3].trim(),
        filename: match[4].trim()
      });
    }
    
    return assignments;
  }

  static selectRandomIdea(ideasList: string, delimiter: string = '---', lastUsedIdea?: string): string {
    const ideas = ideasList.split(delimiter).map(idea => idea.trim()).filter(idea => idea.length > 0);
    
    if (ideas.length === 0) {
      return '';
    }
    
    if (ideas.length === 1) {
      return ideas[0];
    }
    
    // Avoid using the same idea consecutively
    let availableIdeas = ideas;
    if (lastUsedIdea) {
      availableIdeas = ideas.filter(idea => idea !== lastUsedIdea);
      if (availableIdeas.length === 0) {
        availableIdeas = ideas; // Fallback if all ideas are the same
      }
    }
    
    const randomIndex = Math.floor(Math.random() * availableIdeas.length);
    return availableIdeas[randomIndex];
  }

  static generateImagePrompts(count: number, basePrompt: string): string[] {
    const prompts: string[] = [];
    
    for (let i = 1; i <= count; i++) {
      prompts.push(`${basePrompt} (Image ${i}/${count})`);
    }
    
    return prompts;
  }

  static formatForAudioSegments(scriptSegments: string[]): Array<{
    text: string;
    index: number;
  }> {
    return scriptSegments.map((segment, index) => ({
      text: segment.trim(),
      index: index + 1
    }));
  }
}

export const shortcodeProcessor = new ShortcodeProcessor();