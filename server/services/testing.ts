import { videoWorkflowService } from "./video-workflow";
import { storage } from "../storage";
import { openaiService } from "./openai";
import { fluxService } from "./flux";
import fs from 'fs/promises';
import path from "path";

const testOutputDir = path.join(process.cwd(), "test-output");

export class WorkflowTestService {
  async testNewWorkflow(testVideoId: number = 999999): Promise<void> {
    console.log("🚀 Starting new workflow test...");

    try {
      // Ensure test output directory exists
      await fs.mkdir(testOutputDir, { recursive: true });

      // Step 1: Test idea selection
      console.log("\n📝 Step 1: Testing idea selection...");
      const idea = await this.testIdeaSelection();
      console.log("✅ Idea selected:", idea.substring(0, 100) + "...");

      // Step 2: Test outline generation
      console.log("\n📋 Step 2: Testing outline generation...");
      const outline = await this.testOutlineGeneration(idea);
      console.log("✅ Outline generated with", outline.chapters.length, "chapters");
      console.log("📖 Title:", outline.title);

      // Step 3: Test full script generation
      console.log("\n📜 Step 3: Testing full script generation...");
      const fullScript = await this.testFullScriptGeneration(outline);
      console.log("✅ Full script generated:", fullScript.length, "characters");

      // Step 4: Test visual style generation
      console.log("\n🎨 Step 4: Testing visual style generation...");
      const visualStyle = await this.testVisualStyleGeneration(outline);
      console.log("✅ Visual style generated:", visualStyle.substring(0, 100) + "...");

      // Step 5: Test chapter content generation
      console.log("\n📚 Step 5: Testing chapter content generation...");
      const chapterContents = await this.testChapterContentGeneration(outline, fullScript);
      console.log("✅ Chapter contents generated for", chapterContents.length, "chapters");

      // Step 6: Test image generation for each chapter
      console.log("\n🖼️ Step 6: Testing image generation for chapters...");
      const chapterImageData = await this.testChapterImageGeneration(chapterContents, visualStyle);
      console.log("✅ Images generated for", chapterImageData.length, "chapters");

      // Step 7: Save all test results
      console.log("\n💾 Step 7: Saving test results...");
      await this.saveTestResults({
        testVideoId,
        idea,
        outline,
        fullScript,
        visualStyle,
        chapterContents,
        chapterImageData
      });

      console.log("\n🎉 New workflow test completed successfully!");
      console.log("📁 Test results saved to:", testOutputDir);

    } catch (error) {
      console.error("❌ Test failed:", error);
      throw error;
    }
  }

  private async testIdeaSelection(): Promise<string> {
    const testIdeas = [
      "A mysterious package arrives at a remote cabin",
      "An ancient map leads to a hidden treasure",
      "A scientist discovers a time-traveling device",
      "A detective solves a century-old mystery",
      "An astronaut finds an abandoned space station"
    ];

    const randomIdea = testIdeas[Math.floor(Math.random() * testIdeas.length)];
    return randomIdea;
  }

  private async testOutlineGeneration(idea: string) {
    const prompt = `
Create a compelling story outline for a YouTube video based on this idea: "${idea}"
Include 5 chapters with descriptive names.
The story should be engaging, mysterious, and suitable for visual storytelling.`;

    const outline = await openaiService.generateStoryOutline(idea, prompt, {
      model: "gpt-5",
      temperature: 0.7,
      maxTokens: 4000,
      topP: 1.0,
      frequencyPenalty: 0
    });

    return outline;
  }

  private async testFullScriptGeneration(outline: any): Promise<string> {
    const prompt = `
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
- Is divided into clear chapters
- Provides rich visual descriptions for image generation`;

    const script = await openaiService.generateFullScript(outline, prompt, {
      model: "gpt-5",
      temperature: 0.7,
      maxTokens: 4000,
      topP: 1.0,
      frequencyPenalty: 0
    });

    return script;
  }

  private async testVisualStyleGeneration(outline: any): Promise<string> {
    const prompt = `
Based on this story outline, generate a single paragraph describing a consistent visual style for the entire video:

Outline:
${JSON.stringify(outline, null, 2)}

Generate a visual style description that includes:
- Overall artistic style and aesthetic
- Color palette and mood
- Lighting approach
- Visual elements and motifs
- Aspect ratio and technical considerations

This style will be used consistently across all images in the video.`;

    const visualStyle = await openaiService.generateVisualStyle(prompt, {
      model: "gpt-5",
      temperature: 0.7,
      maxTokens: 4000,
      topP: 1.0,
      frequencyPenalty: 0
    });

    return visualStyle;
  }

  private async testChapterContentGeneration(outline: any, fullScript: string): Promise<Array<{ name: string; content: string }>> {
    const chapters = outline.chapters || [];
    const chapterContents = [];

    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      console.log(`  📖 Generating content for chapter ${i + 1}: ${chapter.name}`);

      const prompt = `
Based on the story outline and the full script, generate the complete content for this specific chapter:

Chapter: ${chapter.name}
Description: ${chapter.description}

Full Script Context:
${fullScript}

Generate a detailed, engaging chapter that:
- Expands on the chapter description
- Maintains narrative flow
- Is approximately 300-500 words
- Uses vivid, descriptive language
- Provides clear visual cues for image generation`;

      const content = await openaiService.generateChapterContent(prompt, {
        model: "gpt-5",
        temperature: 0.7,
        maxTokens: 4000,
        topP: 1.0,
        frequencyPenalty: 0
      });

      chapterContents.push({
        name: chapter.name,
        content: content
      });
    }

    return chapterContents;
  }

  private async testChapterImageGeneration(
    chapterContents: Array<{ name: string; content: string }>,
    visualStyle: string
  ): Promise<Array<{ chapter: string; images: Array<{ filename: string; scriptSegment: string; anchors: Array<{ img: number; start: string; end: string }> }> }>> {

    const chapterImageData = [];
    const imageCountRange = { min: 3, max: 5 }; // Test with smaller range

    for (let i = 0; i < chapterContents.length; i++) {
      const chapter = chapterContents[i];
      console.log(`  🖼️ Generating images for chapter ${i + 1}: ${chapter.name}`);

      // Select random image count for this chapter
      const imageCount = Math.floor(Math.random() * (imageCountRange.max - imageCountRange.min + 1)) + imageCountRange.min;

      const mainPrompt = `Produce ${imageCount} image prompts that stay in one consistent visual style and align to precise beats in the chapter using exact-phrase text anchors. No timestamps. Image 1 starts at chapter_start. Image ${imageCount} runs until chapter_end. Each image must not preview events past its end anchor.

HARD CONSTRAINTS
- Lengths: anchors.length = ${imageCount}; images.length = ${imageCount}.
- Order: anchors and images are aligned 1:1 by index (first anchor maps to first image, etc.).
- Fields: only the fields shown above. Do not include additional fields.
- Valid JSON: escape quotes from chapter text; no comments in final JSON; no markdown fencing.

ANCHOR RULES
- Use exact-phrase text anchors pulled verbatim from the chapter.
- Length per anchor phrase: 5–7 consecutive words.
- Choose phrases that occur only once in the chapter. If a phrase repeats, extend it until unique.
- Preserve case and punctuation. Ensure valid JSON by escaping quotes.
- For i = 1: {"img":1, "start":"chapter_start", "end":"<exact phrase>"}
- For 1 < i < ${imageCount}: {"img":i, "start":"<exact phrase>", "end":"<exact phrase>"}
- For i = ${imageCount}: {"img":${imageCount}, "start":"<exact phrase>", "end":"chapter_end"}
- Anchors must be in strict reading order, non-overlapping, and collectively cover the chapter from start to end.

STYLE RULES
- Start every image prompt with one identical single-line style string and repeat it verbatim.
- Include aspect ratio and any technical traits here.
- Example style line you may replace: "${visualStyle}"

SCENE RULES
- Scene must depict only what is plausible within its anchor range.
- Make each scene distinct from one another.
- No text overlays. Avoid spoilers beyond the end anchor.
- Do not depict people.
- Keep each scene simple, with minimal elements that are not complex or difficult to generate with AI.
- Describe everything in the shot in minute detail to remove ambiguity.
- Use concrete subjects and settings named or implied before each end anchor (objects, landmarks, terrain, structures, vehicles, tools, artifacts, celestial features, symbols).

AD-SAFETY RULES
- Do not depict: weapons of any kind (knives, guns, improvised weapons), broken glass, blood, gore, wounds, or graphic injury.
- Do not depict violence, self-harm, restraint devices, or law-enforcement/military gear.
- Do not depict hate or extremist symbols, sexual or suggestive content, nudity, drugs, smoking, or alcohol.
- If unsafe items are mentioned in the text, imply only via environment or aftermath without showing the item itself.

CONTINUITY AND SELF-CONTAINMENT RULES
- CRITICAL: Each image prompt must stand alone. Do not reference any other image or use comparative terms like "before", "continued", "again", "still", or "another view of".
- The image generation tool will not know what any of the other image prompts contain. If a scene repeats across separate image prompts, fully re-describe the setting and elements as if new, without using any comparative language or referring back to prior descriptions.
- If a setting or subject repeats, explicitly name it each time and describe stable layout cues so scenes match across images.

FRAMING AND LAYOUT RULES
- Describe precise camera setup in every image prompt: shot scale (macro/close/medium/wide/aerial), lens equivalent in mm or field-of-view, camera height or distance with units, camera angle (eye-level, low, high, top-down, oblique), and camera position relative to stable landmarks.
- Provide a one-sentence spatial map naming key landmarks or axes and their relative positions suitable for any environment: horizon line, shoreline, road, river, ridge, skyline, façade, vehicle, machinery, tree line, boulder, corridor, archway, desk, shelf, instrument panel, star field, planet limb, diagram axes, abstract shapes.
- Specify composition unambiguously: what occupies frame left/center/right and foreground/midground/background (or near/mid/far). Include at least one compositional anchor such as "horizon on upper third", "river diagonal bottom-left to top-right", "door centered", "console dominating foreground right".
- Ensure line-of-sight realism. Do not describe seeing through opaque objects or around corners. Keep scales, perspective, and occlusions physically plausible.
- If layout is unspecified, choose a conservative vantage typical for the setting category and keep all elements consistent with that choice.

CHAPTER TEXT:
"""
${chapter.content}
"""`;

      const response = await openaiService.generateChapterImages(mainPrompt, imageCount, {
        model: "gpt-5",
        temperature: 0.7,
        maxTokens: 4000,
        topP: 1.0,
        frequencyPenalty: 0
      });

      // Generate actual images using Flux (for testing, we'll just simulate this)
      const images = [];
      for (let j = 0; j < response.images.length; j++) {
        const imagePrompt = response.images[j];
        try {
          // For testing, we'll create a mock image filename
          const mockImage = {
            filename: `test_chapter_${i + 1}_image_${j + 1}.jpg`,
            scriptSegment: imagePrompt.scriptSegment,
            anchors: response.anchors || []
          };
          images.push(mockImage);

          console.log(`    ✅ Generated image ${j + 1} for chapter ${i + 1}`);
        } catch (error) {
          console.error(`    ❌ Failed to generate image ${j + 1} for chapter ${i + 1}:`, error);
        }
      }

      chapterImageData.push({
        chapter: chapter.name,
        images: images
      });
    }

    return chapterImageData;
  }

  private async saveTestResults(results: {
    testVideoId: number;
    idea: string;
    outline: any;
    fullScript: string;
    visualStyle: string;
    chapterContents: Array<{ name: string; content: string }>;
    chapterImageData: Array<{ chapter: string; images: Array<{ filename: string; scriptSegment: string; anchors: Array<{ img: number; start: string; end: string }> }> }>;
  }): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const testDir = path.join(testOutputDir, `workflow-test-${timestamp}`);

    await fs.mkdir(testDir, { recursive: true });

    // Save individual files
    await fs.writeFile(path.join(testDir, '01-idea.txt'), results.idea);
    await fs.writeFile(path.join(testDir, '02-outline.json'), JSON.stringify(results.outline, null, 2));
    await fs.writeFile(path.join(testDir, '03-full-script.txt'), results.fullScript);
    await fs.writeFile(path.join(testDir, '04-visual-style.txt'), results.visualStyle);
    await fs.writeFile(path.join(testDir, '05-chapter-contents.json'), JSON.stringify(results.chapterContents, null, 2));
    await fs.writeFile(path.join(testDir, '06-chapter-images.json'), JSON.stringify(results.chapterImageData, null, 2));

    // Create a summary report
    const summary = {
      testVideoId: results.testVideoId,
      timestamp: timestamp,
      idea: results.idea,
      outline: {
        title: results.outline.title,
        chapterCount: results.outline.chapters?.length || 0,
        chapters: results.outline.chapters?.map((c: any) => c.name) || []
      },
      fullScript: {
        characterCount: results.fullScript.length,
        wordCount: results.fullScript.split(' ').length
      },
      visualStyle: results.visualStyle.substring(0, 200) + "...",
      chapterContents: results.chapterContents.map(c => ({
        name: c.name,
        characterCount: c.content.length,
        wordCount: c.content.split(' ').length
      })),
      chapterImages: results.chapterImageData.map(c => ({
        chapter: c.chapter,
        imageCount: c.images.length,
        images: c.images.map(img => ({
          filename: img.filename,
          scriptSegmentLength: img.scriptSegment.length,
          anchorCount: img.anchors.length
        }))
      })),
      totalImages: results.chapterImageData.reduce((sum, c) => sum + c.images.length, 0)
    };

    await fs.writeFile(path.join(testDir, '00-summary.json'), JSON.stringify(summary, null, 2));

    console.log(`📊 Test Summary:`);
    console.log(`   📝 Idea: ${results.idea.substring(0, 50)}...`);
    console.log(`   📖 Title: ${results.outline.title}`);
    console.log(`   📚 Chapters: ${results.outline.chapters?.length || 0}`);
    console.log(`   📜 Script: ${results.fullScript.length} characters`);
    console.log(`   🎨 Visual Style: ${results.visualStyle.substring(0, 50)}...`);
    console.log(`   🖼️ Total Images: ${summary.totalImages}`);
    console.log(`   📁 Results saved to: ${testDir}`);
  }

  // Utility method to run a quick test
  async runQuickTest(): Promise<void> {
    console.log("⚡ Running quick workflow test...");
    await this.testNewWorkflow();
  }

  // Utility method to run multiple tests
  async runMultipleTests(count: number = 3): Promise<void> {
    console.log(`🔄 Running ${count} workflow tests...`);

    for (let i = 1; i <= count; i++) {
      console.log(`\n📋 Test ${i}/${count}`);
      try {
        await this.testNewWorkflow(999999 + i);
        console.log(`✅ Test ${i} completed successfully`);
      } catch (error) {
        console.error(`❌ Test ${i} failed:`, error);
      }
    }

    console.log(`\n🎉 Completed ${count} tests`);
  }

  // ---- Endpoint compatibility helpers ----
  // The routes expect an object with an array of results where each item has { passed: boolean }
  async runAllTests(): Promise<Array<{ name: string; passed: boolean; durationMs: number; error?: string }>> {
    const results: Array<{ name: string; passed: boolean; durationMs: number; error?: string }> = [];
    const start = Date.now();
    try {
      await this.testNewWorkflow();
      results.push({ name: "new-workflow-before-audio", passed: true, durationMs: Date.now() - start });
    } catch (e) {
      const err = e as Error;
      results.push({ name: "new-workflow-before-audio", passed: false, durationMs: Date.now() - start, error: err.message });
    }
    return results;
  }

  async runTestSuite(testSuite: string): Promise<Array<{ name: string; passed: boolean; durationMs: number; error?: string }>> {
    const suite = (testSuite || "").toLowerCase();
    switch (suite) {
      case "new-workflow":
      case "new-workflow-before-audio": {
        const start = Date.now();
        try {
          await this.testNewWorkflow();
          return [{ name: "new-workflow-before-audio", passed: true, durationMs: Date.now() - start }];
        } catch (e) {
          const err = e as Error;
          return [{ name: "new-workflow-before-audio", passed: false, durationMs: Date.now() - start, error: err.message }];
        }
      }
      case "smoke": {
        // Minimal smoke test: outline + visual style only
        const start = Date.now();
        try {
          const idea = await this.testIdeaSelection();
          const outline = await this.testOutlineGeneration(idea);
          await this.testVisualStyleGeneration(outline);
          return [{ name: "smoke", passed: true, durationMs: Date.now() - start }];
        } catch (e) {
          const err = e as Error;
          return [{ name: "smoke", passed: false, durationMs: Date.now() - start, error: err.message }];
        }
      }
      default:
        return this.runAllTests();
    }
  }

  async getTestStatistics(): Promise<{
    totalRuns: number;
    lastRunAt?: string;
    totalImages?: number;
    averageImagesPerRun?: number;
  }> {
    try {
      // Aggregate stats from saved summaries under test-output/
      const dir = await fs.readdir(testOutputDir, { withFileTypes: true });
      const runDirs = dir.filter(d => d.isDirectory() && d.name.startsWith("workflow-test-"));
      let totalImages = 0;
      let runsWithSummary = 0;
      let lastRunAt: string | undefined;

      for (const d of runDirs) {
        try {
          const summaryPath = path.join(testOutputDir, d.name, "00-summary.json");
          const raw = await fs.readFile(summaryPath, "utf-8");
          const summary = JSON.parse(raw);
          if (typeof summary?.totalImages === "number") {
            totalImages += summary.totalImages;
          }
          runsWithSummary += 1;
          lastRunAt = summary?.timestamp || lastRunAt;
        } catch {
          // ignore per-run errors
        }
      }

      return {
        totalRuns: runDirs.length,
        lastRunAt,
        totalImages,
        averageImagesPerRun: runDirs.length ? Math.round((totalImages / Math.max(1, runsWithSummary)) * 100) / 100 : 0,
      };
    } catch {
      return { totalRuns: 0 };
    }
  }
}

export const testingService = new WorkflowTestService();
