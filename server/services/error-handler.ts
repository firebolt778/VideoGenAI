import { storage } from "../storage";

export interface ErrorContext {
  videoId: number;
  stage: string;
  channelId: number;
  templateId: number;
  testMode: boolean;
  retryCount: number;
  maxRetries: number;
  error: Error;
  timestamp: Date;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  retryableErrors: string[];
  nonRetryableErrors: string[];
}

export class ErrorHandlerService {
  private retryConfigs: Map<string, RetryConfig> = new Map();

  constructor() {
    this.initializeRetryConfigs();
  }

  private initializeRetryConfigs() {
    // OpenAI service retry config
    this.retryConfigs.set('openai', {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      retryableErrors: [
        'rate_limit_exceeded',
        'server_error',
        'timeout',
        'network_error',
        'service_unavailable'
      ],
      nonRetryableErrors: [
        'invalid_api_key',
        'insufficient_quota',
        'model_not_found',
        'invalid_request'
      ]
    });

    // Image generation retry config
    this.retryConfigs.set('image_generation', {
      maxRetries: 2,
      baseDelay: 2000,
      maxDelay: 15000,
      backoffMultiplier: 2,
      retryableErrors: [
        'generation_failed',
        'timeout',
        'service_unavailable',
        'rate_limit'
      ],
      nonRetryableErrors: [
        'invalid_prompt',
        'content_policy_violation',
        'unsafe_content'
      ]
    });

    // Audio generation retry config
    this.retryConfigs.set('audio_generation', {
      maxRetries: 2,
      baseDelay: 1500,
      maxDelay: 12000,
      backoffMultiplier: 2,
      retryableErrors: [
        'generation_failed',
        'timeout',
        'service_unavailable'
      ],
      nonRetryableErrors: [
        'invalid_text',
        'unsupported_language',
        'voice_not_found'
      ]
    });

    // Video rendering retry config
    this.retryConfigs.set('video_rendering', {
      maxRetries: 1,
      baseDelay: 5000,
      maxDelay: 30000,
      backoffMultiplier: 1.5,
      retryableErrors: [
        'rendering_failed',
        'memory_error',
        'timeout'
      ],
      nonRetryableErrors: [
        'invalid_config',
        'missing_assets',
        'unsupported_format'
      ]
    });

    // YouTube upload retry config
    this.retryConfigs.set('youtube_upload', {
      maxRetries: 2,
      baseDelay: 3000,
      maxDelay: 20000,
      backoffMultiplier: 2,
      retryableErrors: [
        'upload_failed',
        'network_error',
        'quota_exceeded',
        'service_unavailable'
      ],
      nonRetryableErrors: [
        'invalid_credentials',
        'channel_not_found',
        'content_policy_violation'
      ]
    });
  }

  // Determine if an error is retryable
  isRetryableError(error: Error, service: string): boolean {
    const config = this.retryConfigs.get(service);
    if (!config) return false;

    const errorMessage = error.message.toLowerCase();
    
    // Check non-retryable errors first
    for (const nonRetryable of config.nonRetryableErrors) {
      if (errorMessage.includes(nonRetryable.toLowerCase())) {
        return false;
      }
    }

    // Check retryable errors
    for (const retryable of config.retryableErrors) {
      if (errorMessage.includes(retryable.toLowerCase())) {
        return true;
      }
    }

    // Default to retryable for unknown errors
    return true;
  }

  // Calculate retry delay with exponential backoff
  calculateRetryDelay(retryCount: number, service: string): number {
    const config = this.retryConfigs.get(service);
    if (!config) return 1000;

    const delay = config.baseDelay * Math.pow(config.backoffMultiplier, retryCount);
    return Math.min(delay, config.maxDelay);
  }

  // Handle error with retry logic
  async handleErrorWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    service: string
  ): Promise<T> {
    const config = this.retryConfigs.get(service);
    if (!config) {
      throw context.error;
    }

    let lastError = context.error;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Log the error
        await this.logError({
          ...context,
          error: lastError,
          retryCount: attempt,
          timestamp: new Date()
        });

        // Check if we should retry
        if (attempt >= config.maxRetries || !this.isRetryableError(lastError, service)) {
          break;
        }

        // Wait before retry
        const delay = this.calculateRetryDelay(attempt, service);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  // Handle fallback operations
  async handleWithFallback<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    context: ErrorContext,
    service: string
  ): Promise<T> {
    try {
      return await this.handleErrorWithRetry(primaryOperation, context, service);
    } catch (primaryError) {
      // Log primary operation failure
      await this.logError({
        ...context,
        error: primaryError instanceof Error ? primaryError : new Error(String(primaryError)),
        timestamp: new Date()
      });

      // Try fallback operation
      try {
        return await this.handleErrorWithRetry(fallbackOperation, {
          ...context,
          error: primaryError instanceof Error ? primaryError : new Error(String(primaryError)),
          retryCount: 0
        }, service);
      } catch (fallbackError) {
        // Both primary and fallback failed
        await this.logError({
          ...context,
          error: fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)),
          timestamp: new Date()
        });
        throw fallbackError;
      }
    }
  }

  // Handle content generation with quality checks
  async handleContentGeneration<T>(
    operation: () => Promise<T>,
    qualityCheck: (result: T) => Promise<boolean>,
    context: ErrorContext,
    service: string
  ): Promise<T> {
    const maxQualityAttempts = 3;
    
    for (let attempt = 0; attempt < maxQualityAttempts; attempt++) {
      try {
        const result = await this.handleErrorWithRetry(operation, context, service);
        
        // Perform quality check
        const qualityPassed = await qualityCheck(result);
        if (qualityPassed) {
          return result;
        }

        // Quality check failed, try again
        await this.logError({
          ...context,
          error: new Error(`Quality check failed on attempt ${attempt + 1}`),
          timestamp: new Date()
        });

        if (attempt < maxQualityAttempts - 1) {
          await this.sleep(1000); // Brief delay before retry
        }
      } catch (error) {
        if (attempt === maxQualityAttempts - 1) {
          throw error;
        }
        // Continue to next attempt
      }
    }

    throw new Error(`Content generation failed quality checks after ${maxQualityAttempts} attempts`);
  }

  // Log error to database
  private async logError(context: ErrorContext): Promise<void> {
    try {
      await storage.createJobLog({
        type: "error",
        entityId: context.videoId,
        status: "error",
        message: `Error in ${context.stage}: ${context.error.message}`,
        details: {
          stage: context.stage,
          channelId: context.channelId,
          templateId: context.templateId,
          testMode: context.testMode,
          retryCount: context.retryCount,
          maxRetries: context.maxRetries,
          error: context.error.stack,
          timestamp: context.timestamp.toISOString()
        }
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }

  // Sleep utility
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get error statistics
  async getErrorStatistics(days: number = 7): Promise<any> {
    try {
      const logs = await storage.getJobLogs(1000);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const errorLogs = logs.filter(log => 
        log.status === 'error' && 
        new Date(log.createdAt) >= cutoffDate
      );

      const stats = {
        totalErrors: errorLogs.length,
        errorsByStage: {} as Record<string, number>,
        errorsByService: {} as Record<string, number>,
        recentErrors: errorLogs.slice(0, 10).map(log => ({
          message: log.message,
          stage: (log.details as any)?.stage,
          timestamp: log.createdAt
        }))
      };

      errorLogs.forEach(log => {
        const details = log.details as any;
        const stage = details?.stage || 'unknown';
        stats.errorsByStage[stage] = (stats.errorsByStage[stage] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Failed to get error statistics:', error);
      return { totalErrors: 0, errorsByStage: {}, errorsByService: {}, recentErrors: [] };
    }
  }

  // Clean up old error logs
  async cleanupOldErrorLogs(daysToKeep: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // This would require a cleanup method in storage service
      // For now, we'll just log the intention
      console.log(`Would cleanup error logs older than ${cutoffDate.toISOString()}`);
    } catch (error) {
      console.error('Failed to cleanup old error logs:', error);
    }
  }
}

export const errorHandlerService = new ErrorHandlerService(); 