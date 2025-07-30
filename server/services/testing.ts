import { storage } from "../storage";
import { validationService } from "./validation";
import { errorHandlerService } from "./error-handler";
import { videoWorkflowService } from "./video-workflow";
import type { Channel, VideoTemplate, ThumbnailTemplate } from "@shared/schema";

export interface TestResult {
  testId: string;
  testName: string;
  passed: boolean;
  duration: number;
  errors: string[];
  warnings: string[];
  details: any;
  timestamp: Date;
}

export interface TestSuite {
  name: string;
  description: string;
  tests: TestCase[];
}

export interface TestCase {
  name: string;
  description: string;
  execute: () => Promise<TestResult>;
  required: boolean;
  timeout: number;
}

export class TestingService {
  private testSuites: Map<string, TestSuite> = new Map();

  constructor() {
    this.initializeTestSuites();
  }

  private initializeTestSuites() {
    // Template validation tests
    this.testSuites.set('template_validation', {
      name: 'Template Validation',
      description: 'Tests for video template configuration and quality',
      tests: [
        {
          name: 'Template Required Fields',
          description: 'Check that all required template fields are present',
          execute: this.testTemplateRequiredFields.bind(this),
          required: true,
          timeout: 5000
        },
        {
          name: 'Template Content Quality',
          description: 'Validate template content quality and length',
          execute: this.testTemplateContentQuality.bind(this),
          required: false,
          timeout: 10000
        },
        {
          name: 'Template Ideas List',
          description: 'Check ideas list format and content',
          execute: this.testTemplateIdeasList.bind(this),
          required: true,
          timeout: 5000
        }
      ]
    });

    // System integration tests
    this.testSuites.set('system_integration', {
      name: 'System Integration',
      description: 'Tests for system services and dependencies',
      tests: [
        {
          name: 'OpenAI Service',
          description: 'Test OpenAI API connectivity and functionality',
          execute: this.testOpenAIService.bind(this),
          required: true,
          timeout: 15000
        },
        {
          name: 'Image Generation Service',
          description: 'Test image generation service connectivity',
          execute: this.testImageGenerationService.bind(this),
          required: true,
          timeout: 20000
        },
        {
          name: 'Audio Generation Service',
          description: 'Test audio generation service connectivity',
          execute: this.testAudioGenerationService.bind(this),
          required: true,
          timeout: 15000
        },
        {
          name: 'Video Rendering Service',
          description: 'Test video rendering service functionality',
          execute: this.testVideoRenderingService.bind(this),
          required: true,
          timeout: 30000
        }
      ]
    });

    // End-to-end workflow tests
    this.testSuites.set('workflow_tests', {
      name: 'Workflow Tests',
      description: 'End-to-end video generation workflow tests',
      tests: [
        {
          name: 'Complete Video Generation',
          description: 'Test complete video generation workflow',
          execute: this.testCompleteVideoGeneration.bind(this),
          required: true,
          timeout: 120000
        },
        {
          name: 'Error Handling',
          description: 'Test error handling and recovery',
          execute: this.testErrorHandling.bind(this),
          required: false,
          timeout: 30000
        },
        {
          name: 'Quality Validation',
          description: 'Test content quality validation',
          execute: this.testQualityValidation.bind(this),
          required: false,
          timeout: 60000
        }
      ]
    });
  }

  // Run all test suites
  async runAllTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const [suiteName, suite] of this.testSuites.entries().toArray()) {
      console.log(`Running test suite: ${suite.name}`);
      for (const testCase of suite.tests) {
        try {
          const result = await this.runTest(testCase);
          results.push(result);
          
          if (!result.passed && testCase.required) {
            console.error(`Required test failed: ${testCase.name}`);
            break;
          }
        } catch (error) {
          results.push({
            testId: `${suiteName}_${testCase.name}`,
            testName: testCase.name,
            passed: false,
            duration: 0,
            errors: [error instanceof Error ? error.message : String(error)],
            warnings: [],
            details: {},
            timestamp: new Date()
          });
        }
      }
    }
    
    return results;
  }

  // Run specific test suite
  async runTestSuite(suiteName: string): Promise<TestResult[]> {
    const suite = this.testSuites.get(suiteName);
    if (!suite) {
      throw new Error(`Test suite '${suiteName}' not found`);
    }

    const results: TestResult[] = [];
    
    for (const testCase of suite.tests) {
      const result = await this.runTest(testCase);
      results.push(result);
    }
    
    return results;
  }

  // Run individual test
  private async runTest(testCase: TestCase): Promise<TestResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    let details: any = {};

    try {
      const result = await Promise.race([
        testCase.execute(),
        this.timeoutPromise(testCase.timeout)
      ]);

      return {
        ...result,
        duration: Date.now() - startTime,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        testId: testCase.name,
        testName: testCase.name,
        passed: false,
        duration: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings,
        details,
        timestamp: new Date()
      };
    }
  }

  // Template validation tests
  private async testTemplateRequiredFields(): Promise<TestResult> {
    const templates = await storage.getVideoTemplates();
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const template of templates) {
      if (!template.storyOutlinePrompt) {
        errors.push(`Template ${template.name}: Missing story outline prompt`);
      }
      if (!template.imagePrompt) {
        errors.push(`Template ${template.name}: Missing image prompt`);
      }
      if (!template.ideasList) {
        errors.push(`Template ${template.name}: Missing ideas list`);
      }
    }

    return {
      testId: 'template_required_fields',
      testName: 'Template Required Fields',
      passed: errors.length === 0,
      duration: 0,
      errors,
      warnings,
      details: { templatesChecked: templates.length },
      timestamp: new Date()
    };
  }

  private async testTemplateContentQuality(): Promise<TestResult> {
    const templates = await storage.getVideoTemplates();
    const warnings: string[] = [];

    for (const template of templates) {
      if (template.storyOutlinePrompt && template.storyOutlinePrompt.length < 50) {
        warnings.push(`Template ${template.name}: Story outline prompt is very short`);
      }
      if (template.videoLength && (template.videoLength < 5 || template.videoLength > 120)) {
        warnings.push(`Template ${template.name}: Video length should be between 5 and 120 minutes`);
      }
      if (template.imageCount && (template.imageCount < 3 || template.imageCount > 20)) {
        warnings.push(`Template ${template.name}: Image count should be between 3 and 20`);
      }
    }

    return {
      testId: 'template_content_quality',
      testName: 'Template Content Quality',
      passed: true,
      duration: 0,
      errors: [],
      warnings,
      details: { templatesChecked: templates.length },
      timestamp: new Date()
    };
  }

  private async testTemplateIdeasList(): Promise<TestResult> {
    const templates = await storage.getVideoTemplates();
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const template of templates) {
      if (template.ideasList) {
        const ideas = template.ideasList.split(template.ideasDelimiter || "---");
        if (ideas.length < 2) {
          errors.push(`Template ${template.name}: Ideas list should contain at least 2 ideas`);
        }
        if (ideas.length > 20) {
          warnings.push(`Template ${template.name}: Ideas list is very long`);
        }
      }
    }

    return {
      testId: 'template_ideas_list',
      testName: 'Template Ideas List',
      passed: errors.length === 0,
      duration: 0,
      errors,
      warnings,
      details: { templatesChecked: templates.length },
      timestamp: new Date()
    };
  }

  // System integration tests
  private async testOpenAIService(): Promise<TestResult> {
    try {
      const { openaiService } = await import("./openai");
      
      // Test with a simple prompt
      const testPrompt = "Generate a simple story outline for a 5-minute video about technology.";
      const result = await openaiService.generateStoryOutline("Test idea", 5, testPrompt);
      
      if (!result.title || !result.chapters || result.chapters.length === 0) {
        throw new Error("OpenAI service returned invalid response format");
      }

      return {
        testId: 'openai_service',
        testName: 'OpenAI Service',
        passed: true,
        duration: 0,
        errors: [],
        warnings: [],
        details: { responseReceived: true },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        testId: 'openai_service',
        testName: 'OpenAI Service',
        passed: false,
        duration: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
        details: {},
        timestamp: new Date()
      };
    }
  }

  private async testImageGenerationService(): Promise<TestResult> {
    try {
      const { fluxService } = await import("./flux");
      
      // Test with a simple image prompt
      const testPrompt = "A simple landscape with mountains and trees";
      const result = await fluxService.generateImageWithFallback(testPrompt);
      
      if (!result.filename) {
        throw new Error("Image generation service returned invalid response");
      }

      return {
        testId: 'image_generation_service',
        testName: 'Image Generation Service',
        passed: true,
        duration: 0,
        errors: [],
        warnings: [],
        details: { imageGenerated: true },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        testId: 'image_generation_service',
        testName: 'Image Generation Service',
        passed: false,
        duration: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
        details: {},
        timestamp: new Date()
      };
    }
  }

  private async testAudioGenerationService(): Promise<TestResult> {
    try {
      const { elevenLabsService } = await import("./elevenlabs");

      const voices = await elevenLabsService.getAvailableVoices();
      
      // Test with a simple text
      const testText = "This is a test of the audio generation service.";
      const result = await elevenLabsService.generateAudio(testText, voices[0].voice_id, "test-voice");
      
      if (!result.filename) {
        throw new Error("Audio generation service returned invalid response");
      }

      return {
        testId: 'audio_generation_service',
        testName: 'Audio Generation Service',
        passed: true,
        duration: 0,
        errors: [],
        warnings: [],
        details: { audioGenerated: true },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        testId: 'audio_generation_service',
        testName: 'Audio Generation Service',
        passed: false,
        duration: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
        details: {},
        timestamp: new Date()
      };
    }
  }

  private async testVideoRenderingService(): Promise<TestResult> {
    try {
      const { remotionService } = await import("./remotion");
      
      // Test bundle initialization
      await remotionService.initializeBundle();
      
      return {
        testId: 'video_rendering_service',
        testName: 'Video Rendering Service',
        passed: true,
        duration: 0,
        errors: [],
        warnings: [],
        details: { bundleInitialized: true },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        testId: 'video_rendering_service',
        testName: 'Video Rendering Service',
        passed: false,
        duration: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
        details: {},
        timestamp: new Date()
      };
    }
  }

  // Workflow tests
  private async testCompleteVideoGeneration(): Promise<TestResult> {
    try {
      // Get test channel and template
      const channels = await storage.getChannels();
      const templates = await storage.getVideoTemplates();

      if (channels.length === 0 || templates.length === 0) {
        throw new Error("No channels, templates, or thumbnail templates available for testing");
      }

      const channel = channels[0];
      const template = templates[0];

      // Create test video
      const video = await storage.createVideo({
        channelId: channel.id,
        templateId: template.id,
        title: "Test Video Generation",
        status: "generating",
      });

      // Run video generation in test mode
      await videoWorkflowService.generateVideo(
        video.id,
        channel.id,
        template,
        true // test mode
      );

      // Verify video was created successfully
      const updatedVideo = await storage.getVideo(video.id);
      if (!updatedVideo || updatedVideo.status === "error") {
        throw new Error("Video generation failed");
      }

      return {
        testId: 'complete_video_generation',
        testName: 'Complete Video Generation',
        passed: true,
        duration: 0,
        errors: [],
        warnings: [],
        details: { videoId: video.id, status: updatedVideo.status },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        testId: 'complete_video_generation',
        testName: 'Complete Video Generation',
        passed: false,
        duration: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
        details: {},
        timestamp: new Date()
      };
    }
  }

  private async testErrorHandling(): Promise<TestResult> {
    try {
      // Test with invalid input
      const validationResult = await validationService.validateVideoGenerationInput(
        999999, // Invalid channel ID
        999999, // Invalid template ID
        true
      );

      if (validationResult.isValid) {
        throw new Error("Validation should have failed with invalid inputs");
      }

      return {
        testId: 'error_handling',
        testName: 'Error Handling',
        passed: true,
        duration: 0,
        errors: [],
        warnings: [],
        details: { validationErrors: validationResult.errors.length },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        testId: 'error_handling',
        testName: 'Error Handling',
        passed: false,
        duration: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
        details: {},
        timestamp: new Date()
      };
    }
  }

  private async testQualityValidation(): Promise<TestResult> {
    try {
      // Test content quality validation
      const qualityResult = await validationService.validateGeneratedContent(
        "This is a test script with sufficient content for quality validation.",
        [{ filename: "test1.jpg" }, { filename: "test2.jpg" }],
        [{ filename: "test1.mp3" }, { filename: "test2.mp3" }],
        "Test Video Title"
      );

      if (!qualityResult.passed) {
        throw new Error(`Quality validation failed: ${qualityResult.issues.join(", ")}`);
      }

      return {
        testId: 'quality_validation',
        testName: 'Quality Validation',
        passed: true,
        duration: 0,
        errors: [],
        warnings: [],
        details: { qualityScore: qualityResult.score },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        testId: 'quality_validation',
        testName: 'Quality Validation',
        passed: false,
        duration: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
        details: {},
        timestamp: new Date()
      };
    }
  }

  // Utility method for timeout
  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Test timed out after ${ms}ms`)), ms);
    });
  }

  // Get test statistics
  async getTestStatistics(): Promise<any> {
    try {
      const results = await this.runAllTests();
      
      const stats = {
        totalTests: results.length,
        passedTests: results.filter(r => r.passed).length,
        failedTests: results.filter(r => !r.passed).length,
        successRate: (results.filter(r => r.passed).length / results.length) * 100,
        averageDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
        errorsByTest: results.filter(r => !r.passed).map(r => ({
          testName: r.testName,
          errors: r.errors
        }))
      };

      return stats;
    } catch (error) {
      console.error('Failed to get test statistics:', error);
      return { totalTests: 0, passedTests: 0, failedTests: 0, successRate: 0 };
    }
  }
}

export const testingService = new TestingService(); 