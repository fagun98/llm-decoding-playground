/**
 * LLM model integration using transformers.js for client-side inference
 */

import { pipeline, AutoTokenizer, AutoModelForCausalLM } from '@xenova/transformers';

export interface ModelOutput {
  logits: number[];
  tokenIds: number[];
  tokens: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let modelInstance: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tokenizerInstance: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let generatorInstance: any = null;
let isLoading = false;

const MODEL_NAME = 'Xenova/distilgpt2';

export async function loadModel(
  onProgress?: (progress: { status: string; progress?: number }) => void
): Promise<void> {
  if (modelInstance && tokenizerInstance && generatorInstance) return;
  if (isLoading) return;

  isLoading = true;

  try {
    onProgress?.({ status: 'Loading model...', progress: 0 });

    // Load model directly for logits access
    modelInstance = await AutoModelForCausalLM.from_pretrained(MODEL_NAME, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      progress_callback: (progress: any) => {
        if (progress.status === 'progress' && progress.progress) {
          onProgress?.({
            status: `Loading ${progress.file}...`,
            progress: progress.progress
          });
        } else if (progress.status === 'done') {
          onProgress?.({ status: 'Model loaded!', progress: 100 });
        }
      }
    });

    tokenizerInstance = await AutoTokenizer.from_pretrained(MODEL_NAME);
    
    // Also load pipeline for text generation
    generatorInstance = await pipeline('text-generation', MODEL_NAME);

    onProgress?.({ status: 'Ready', progress: 100 });
  } finally {
    isLoading = false;
  }
}

export async function getNextTokenLogits(text: string, topN: number = 50): Promise<ModelOutput> {
  if (!modelInstance || !tokenizerInstance) {
    throw new Error('Model not loaded. Call loadModel() first.');
  }

  const inputs = await tokenizerInstance(text);
  const outputs = await modelInstance(inputs);

  const logitsArray = Array.from(outputs.logits.data) as number[];
  const vocabSize = outputs.logits.dims[outputs.logits.dims.length - 1];
  
  const lastTokenLogits = logitsArray.slice(-vocabSize);

  const indexed = lastTokenLogits.map((logit, idx) => ({ logit, idx }));
  indexed.sort((a, b) => b.logit - a.logit);
  const top = indexed.slice(0, topN);

  const tokenIds = top.map((item) => item.idx);
  const tokens = tokenIds.map((id) => {
    const decoded = tokenizerInstance.decode([id], { skip_special_tokens: false });
    return decoded;
  });
  const logits = top.map((item) => item.logit);

  return { logits, tokenIds, tokens };
}

export function isModelLoaded(): boolean {
  return modelInstance !== null && tokenizerInstance !== null && generatorInstance !== null;
}

export async function generateWithModel(
  text: string,
  maxTokens: number = 20,
  temperature: number = 1.0,
  topK: number = 50,
  topP: number = 1.0
): Promise<string> {
  if (!generatorInstance) {
    throw new Error('Model not loaded. Call loadModel() first.');
  }

  const result = await generatorInstance(text, {
    max_new_tokens: maxTokens,
    temperature: temperature === 0 ? 0.01 : temperature,
    top_k: topK > 0 ? topK : 0,
    top_p: topP,
    do_sample: temperature > 0,
    return_full_text: false
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (result as any)[0].generated_text;
}

export function getModelInfo() {
  return {
    name: MODEL_NAME,
    description: 'DistilGPT2 - A distilled version of GPT-2, ~80MB',
    size: '~80MB',
    loaded: isModelLoaded()
  };
}
