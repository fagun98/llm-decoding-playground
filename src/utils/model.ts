/**
 * LLM model integration using transformers.js for client-side inference.
 * Uses Xenova/distilgpt2 (~82MB quantized ONNX) downloaded from Hugging Face
 * on first load and cached by the browser.
 */

import {
  env,
  AutoTokenizer,
  AutoModelForCausalLM
} from '@xenova/transformers';

// Serve the quantized DistilGPT2 ONNX from /models (copied into public/).
// Same-origin hosting avoids Hugging Face CORS issues on localhost / Pages.
env.localModelPath = `${import.meta.env.BASE_URL}models/`;
env.allowLocalModels = true;
// Prefer the vendored ONNX under public/models; remote HF is CORS-fragile in some hosts.
env.allowRemoteModels = false;
env.useBrowserCache = true;
// Avoid SharedArrayBuffer / COOP-COEP requirements in plain Pages hosting.
env.backends.onnx.wasm.numThreads = 1;

export interface ModelOutput {
  logits: number[];
  tokenIds: number[];
  tokens: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let modelInstance: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tokenizerInstance: any = null;
let isLoading = false;
let loadPromise: Promise<void> | null = null;

const MODEL_NAME = 'Xenova/distilgpt2';

export async function loadModel(
  onProgress?: (progress: { status: string; progress?: number }) => void
): Promise<void> {
  if (modelInstance && tokenizerInstance) return;
  if (loadPromise) return loadPromise;

  isLoading = true;
  loadPromise = (async () => {
    try {
      onProgress?.({ status: 'Loading tokenizer...', progress: 5 });

      tokenizerInstance = await AutoTokenizer.from_pretrained(MODEL_NAME);

      onProgress?.({ status: 'Downloading DistilGPT2 (~82MB)...', progress: 10 });

      modelInstance = await AutoModelForCausalLM.from_pretrained(MODEL_NAME, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        progress_callback: (progress: any) => {
          if (progress.status === 'progress' && typeof progress.progress === 'number') {
            onProgress?.({
              status: `Loading ${progress.file || 'model'}...`,
              progress: Math.min(99, Math.round(progress.progress))
            });
          } else if (progress.status === 'done') {
            onProgress?.({ status: 'Model loaded!', progress: 100 });
          }
        }
      });

      onProgress?.({ status: 'Ready', progress: 100 });
    } finally {
      isLoading = false;
    }
  })();

  return loadPromise;
}

export async function getNextTokenLogits(text: string, topN: number = 50): Promise<ModelOutput> {
  if (!modelInstance || !tokenizerInstance) {
    throw new Error('Model not loaded. Call loadModel() first.');
  }

  const inputs = await tokenizerInstance(text);
  const { logits } = await modelInstance(inputs);

  const vocabSize = logits.dims[logits.dims.length - 1] as number;
  const data = logits.data as Float32Array;
  const offset = data.length - vocabSize;
  const lastTokenLogits = Array.from(data.subarray(offset)) as number[];

  const indexed = lastTokenLogits.map((logit, idx) => ({ logit, idx }));
  indexed.sort((a, b) => b.logit - a.logit);
  const top = indexed.slice(0, topN);

  const tokenIds = top.map((item) => item.idx);
  const tokens = tokenIds.map((id) =>
    tokenizerInstance.decode([id], { skip_special_tokens: false })
  );
  const topLogits = top.map((item) => item.logit);

  return { logits: topLogits, tokenIds, tokens };
}

export function isModelLoaded(): boolean {
  return modelInstance !== null && tokenizerInstance !== null;
}

export function isModelLoading(): boolean {
  return isLoading;
}

export function getModelInfo() {
  return {
    name: MODEL_NAME,
    description: 'DistilGPT2 — distilled GPT-2 (ONNX via Transformers.js)',
    size: '~82MB',
    loaded: isModelLoaded()
  };
}
