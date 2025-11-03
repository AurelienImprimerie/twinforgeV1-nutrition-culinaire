/**
 * AI Cost Calculator for OpenAI Models
 * Calculates estimated costs based on token usage and model pricing
 */

// OpenAI pricing per 1M tokens (as of 2025 - GPT-5 models)
const MODEL_PRICING = {
  // GPT-5 models (latest)
  'gpt-5': {
    input: 1.25,   // $1.25 per 1M input tokens
    output: 10.00  // $10.00 per 1M output tokens
  },
  'gpt-5-mini': {
    input: 0.25,   // $0.25 per 1M input tokens
    output: 2.00   // $2.00 per 1M output tokens
  },
  'gpt-5-nano': {
    input: 0.05,   // $0.05 per 1M input tokens
    output: 0.40   // $0.40 per 1M output tokens
  },
  // GPT-4 models (legacy)
  'gpt-4o': {
    input: 2.50,   // $2.50 per 1M input tokens
    output: 10.00  // $10.00 per 1M output tokens
  },
  'gpt-4o-mini': {
    input: 0.15,   // $0.15 per 1M input tokens
    output: 0.60   // $0.60 per 1M output tokens
  },
  'gpt-4-turbo': {
    input: 10.00,  // $10.00 per 1M input tokens
    output: 30.00  // $30.00 per 1M output tokens
  },
  'gpt-4': {
    input: 30.00,  // $30.00 per 1M input tokens
    output: 60.00  // $60.00 per 1M output tokens
  },
  'gpt-3.5-turbo': {
    input: 0.50,   // $0.50 per 1M input tokens
    output: 1.50   // $1.50 per 1M output tokens
  },
  // Image generation models
  'gpt-image-1': {
    per_image: 0.015  // $0.015 per 1024x1024 image (75% cheaper than DALL-E 3)
  },
  'dall-e-3': {
    per_image: 0.040  // $0.040 per 1024x1024 image (legacy)
  }
};

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens?: number; // GPT-5 reasoning tokens (hidden, consumed before output)
  total_tokens: number;
  cost_estimate_usd: number;
  model_used: string;
  reasoning_cost_usd?: number; // Separate cost tracking for reasoning tokens
  output_cost_usd?: number; // Separate cost tracking for output tokens
}

/**
 * Calculate the estimated cost for OpenAI API usage with GPT-5 reasoning token support
 * @param inputTokens Number of input tokens used (prompt_tokens)
 * @param outputTokens Number of output tokens used (visible completion_tokens)
 * @param modelName Name of the OpenAI model used
 * @param reasoningTokens Optional: Number of reasoning tokens used (GPT-5 hidden reasoning)
 * @returns TokenUsage object with detailed cost breakdown
 */
export function calculateGPT5TokenCost(
  inputTokens: number,
  outputTokens: number,
  modelName: string,
  reasoningTokens?: number
): TokenUsage {
  // Normalize model name to match pricing keys
  const normalizedModel = normalizeModelName(modelName);

  // Get pricing for the model, fallback to gpt-5-mini if unknown
  const pricing = MODEL_PRICING[normalizedModel] || MODEL_PRICING['gpt-5-mini'];

  // Calculate costs (pricing is per 1M tokens)
  const inputCost = (inputTokens / 1_000_000) * pricing.input;

  // For GPT-5 models, reasoning tokens are billed at output token rate
  // Total completion tokens = reasoning_tokens + actual output tokens
  const totalCompletionTokens = outputTokens + (reasoningTokens || 0);
  const outputCost = (totalCompletionTokens / 1_000_000) * pricing.output;

  // Separate cost tracking for transparency
  const reasoningCost = reasoningTokens ? (reasoningTokens / 1_000_000) * pricing.output : 0;
  const actualOutputCost = (outputTokens / 1_000_000) * pricing.output;

  const totalCost = inputCost + outputCost;

  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    reasoning_tokens: reasoningTokens || 0,
    total_tokens: inputTokens + totalCompletionTokens,
    cost_estimate_usd: Math.round(totalCost * 10000) / 10000, // Round to 4 decimal places
    model_used: normalizedModel,
    reasoning_cost_usd: Math.round(reasoningCost * 10000) / 10000,
    output_cost_usd: Math.round(actualOutputCost * 10000) / 10000
  };
}

/**
 * Normalize model name to match pricing keys
 * @param modelName Raw model name from OpenAI response
 * @returns Normalized model name
 */
function normalizeModelName(modelName: string): string {
  const model = modelName.toLowerCase();

  // GPT-5 models (prioritize latest)
  if (model.includes('gpt-5-nano')) return 'gpt-5-nano';
  if (model.includes('gpt-5-mini')) return 'gpt-5-mini';
  if (model.includes('gpt-5')) return 'gpt-5';

  // GPT-4 models (legacy)
  if (model.includes('gpt-4o-mini')) return 'gpt-4o-mini';
  if (model.includes('gpt-4o')) return 'gpt-4o';
  if (model.includes('gpt-4-turbo')) return 'gpt-4-turbo';
  if (model.includes('gpt-4')) return 'gpt-4';
  if (model.includes('gpt-3.5-turbo')) return 'gpt-3.5-turbo';

  // Default fallback to gpt-5-mini
  return 'gpt-5-mini';
}

/**
 * Log AI cost tracking information with GPT-5 reasoning token breakdown
 * @param operation Operation name (e.g., 'scan-estimate')
 * @param tokenUsage Token usage data
 * @param traceId Trace ID for correlation
 */
export function logAICostTracking(
  operation: string,
  tokenUsage: TokenUsage,
  traceId: string
): void {
  const reasoningPercentage = tokenUsage.reasoning_tokens && tokenUsage.output_tokens
    ? Math.round((tokenUsage.reasoning_tokens / (tokenUsage.reasoning_tokens + tokenUsage.output_tokens)) * 100)
    : 0;

  console.log(`🔍 [AI_COST_TRACKING] [${operation}] [${traceId}]`, {
    model: tokenUsage.model_used,
    input_tokens: tokenUsage.input_tokens,
    output_tokens: tokenUsage.output_tokens,
    reasoning_tokens: tokenUsage.reasoning_tokens || 0,
    reasoning_percentage: `${reasoningPercentage}%`,
    total_tokens: tokenUsage.total_tokens,
    cost_estimate_usd: tokenUsage.cost_estimate_usd,
    reasoning_cost_usd: tokenUsage.reasoning_cost_usd || 0,
    output_cost_usd: tokenUsage.output_cost_usd || 0,
    operation,
    traceId,
    warning: reasoningPercentage > 70 ? 'HIGH_REASONING_TOKEN_USAGE' : undefined
  });
}