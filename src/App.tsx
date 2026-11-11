import { useState, useEffect, useRef } from 'react';
import './App.css';
import { PromptInput } from './components/PromptInput';
import { ControlPanel } from './components/ControlPanel';
import { ProbabilityChart } from './components/ProbabilityChart';
import { GenerationPanel } from './components/GenerationPanel';
import { Explainer } from './components/Explainer';
import { loadModel, getNextTokenLogits, getModelInfo } from './utils/model';
import { decodeNextToken, SeededRandom, TokenProbability } from './utils/sampling';

interface ComparisonResult {
  title: string;
  params: string;
  text: string;
}

async function generateContinuation(
  prompt: string,
  maxTokens: number,
  temperature: number,
  topK: number,
  topP: number,
  seedBase: number
): Promise<string> {
  let text = '';
  for (let i = 0; i < maxTokens; i++) {
    const { logits, tokenIds, tokens } = await getNextTokenLogits(prompt + text);
    const random = temperature === 0 ? null : new SeededRandom(seedBase + i * 9973);
    const result = decodeNextToken(logits, tokenIds, tokens, temperature, topK, topP, random);
    text += result.selectedToken;
  }
  return text;
}

function App() {
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<{ status: string; progress?: number }>({
    status: '',
    progress: 0
  });
  const [prompt, setPrompt] = useState('Hi team, I wanted to');
  const [temperature, setTemperature] = useState(1.0);
  const [topK, setTopK] = useState(0);
  const [topP, setTopP] = useState(1.0);
  const [useSeededRandom, setUseSeededRandom] = useState(true);
  const [probabilities, setProbabilities] = useState<TokenProbability[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [generatedText, setGeneratedText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [comparison, setComparison] = useState<ComparisonResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const updateSeq = useRef(0);

  useEffect(() => {
    const initModel = async () => {
      try {
        await loadModel((progress) => {
          setLoadingProgress(progress);
        });
        setLoading(false);
      } catch (err) {
        console.error('Failed to load model:', err);
        setError(err instanceof Error ? err.message : 'Failed to load model');
        setLoading(false);
      }
    };
    initModel();
  }, []);

  const updateProbabilities = async (text: string) => {
    if (!text.trim()) {
      setProbabilities([]);
      return;
    }

    const seq = ++updateSeq.current;
    try {
      const { logits, tokenIds, tokens } = await getNextTokenLogits(text);
      if (seq !== updateSeq.current) return;
      const random = useSeededRandom ? new SeededRandom(42) : null;
      const result = decodeNextToken(logits, tokenIds, tokens, temperature, topK, topP, random);
      setProbabilities(result.probabilities);
      setError(null);
    } catch (err) {
      console.error('Failed to get probabilities:', err);
      setError(err instanceof Error ? err.message : 'Failed to get probabilities');
    }
  };

  useEffect(() => {
    if (!loading && prompt.trim()) {
      updateProbabilities(prompt + generatedText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, temperature, topK, topP, useSeededRandom, loading]);

  const handleSampleOne = async () => {
    if (!prompt.trim()) return;

    try {
      const currentText = prompt + generatedText;
      const { logits, tokenIds, tokens } = await getNextTokenLogits(currentText);
      const random = useSeededRandom ? new SeededRandom(42 + generatedText.length) : null;
      const result = decodeNextToken(logits, tokenIds, tokens, temperature, topK, topP, random);

      setSelectedToken(result.selectedToken);
      setGeneratedText((prev) => prev + result.selectedToken);
      setProbabilities(result.probabilities);

      setTimeout(() => {
        setSelectedToken('');
      }, 1000);
    } catch (err) {
      console.error('Failed to sample token:', err);
      setError(err instanceof Error ? err.message : 'Failed to sample token');
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setGenerating(true);
    setGeneratedText('');
    setComparison([]);

    try {
      const currentText = prompt;
      let newText = '';

      for (let i = 0; i < 25; i++) {
        const { logits, tokenIds, tokens } = await getNextTokenLogits(currentText + newText);
        const random = useSeededRandom ? new SeededRandom(42 + i) : null;
        const result = decodeNextToken(
          logits,
          tokenIds,
          tokens,
          temperature,
          topK,
          topP,
          random
        );

        newText += result.selectedToken;
        setGeneratedText(newText);
        setProbabilities(result.probabilities);
      }
    } catch (err) {
      console.error('Failed to generate:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setGenerating(false);
    }
  };

  const handleCompare = async () => {
    if (!prompt.trim()) return;

    setGenerating(true);
    setComparison([]);

    try {
      const strategies = [
        { title: 'Greedy (temp=0)', temp: 0, topK: 0, topP: 1.0, seed: 1 },
        { title: 'Balanced (temp=0.7)', temp: 0.7, topK: 40, topP: 0.9, seed: 7 },
        { title: 'Creative (temp=1.5)', temp: 1.5, topK: 0, topP: 0.95, seed: 99 }
      ];

      const results: ComparisonResult[] = [];

      for (const strategy of strategies) {
        const text = await generateContinuation(
          prompt,
          30,
          strategy.temp,
          strategy.topK,
          strategy.topP,
          strategy.seed
        );
        results.push({
          title: strategy.title,
          params: `T=${strategy.temp}, K=${strategy.topK || 'off'}, P=${strategy.topP}`,
          text
        });
        setComparison([...results]);
      }
    } catch (err) {
      console.error('Failed to generate comparison:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate comparison');
    } finally {
      setGenerating(false);
    }
  };

  const handleReset = () => {
    setGeneratedText('');
    setSelectedToken('');
    setComparison([]);
    updateProbabilities(prompt);
  };

  const modelInfo = getModelInfo();

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2>Loading Model...</h2>
          <p>{loadingProgress.status}</p>
          {loadingProgress.progress !== undefined && loadingProgress.progress > 0 && (
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${loadingProgress.progress}%` }}
              ></div>
            </div>
          )}
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '1rem' }}>
            {modelInfo.size} · First load may take a minute · Runs fully in your browser
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>LLM Decoding Playground</h1>
        <p className="subtitle">
          Explore how language models pick the next token with temperature, top-k, and top-p
          sampling
        </p>
        <div className="model-info">
          Model: {modelInfo.name} · {modelInfo.size}
        </div>
      </header>

      {error && (
        <div className="explainer" style={{ borderLeftColor: '#dc3545' }}>
          <h3>Error</h3>
          <p>{error}</p>
        </div>
      )}

      <Explainer />

      <PromptInput value={prompt} onChange={setPrompt} disabled={generating} />

      <ControlPanel
        temperature={temperature}
        topK={topK}
        topP={topP}
        useSeededRandom={useSeededRandom}
        onTemperatureChange={setTemperature}
        onTopKChange={setTopK}
        onTopPChange={setTopP}
        onSeededRandomChange={setUseSeededRandom}
        disabled={generating}
      />

      {probabilities.length > 0 && (
        <div className="card">
          <ProbabilityChart probabilities={probabilities} selectedToken={selectedToken} />
        </div>
      )}

      <GenerationPanel
        onSampleOne={handleSampleOne}
        onGenerate={handleGenerate}
        onCompare={handleCompare}
        onReset={handleReset}
        generating={generating}
        disabled={!prompt.trim()}
      />

      {generatedText && (
        <div className="card">
          <h2 className="card-title">Generated Text</h2>
          <div className="generated-text">
            <strong>{prompt}</strong>
            {generatedText}
          </div>
        </div>
      )}

      {comparison.length > 0 && (
        <div className="card">
          <h2 className="card-title">Strategy Comparison</h2>
          <div className="comparison-grid">
            {comparison.map((result, idx) => (
              <div key={idx} className="comparison-item">
                <div className="comparison-title">{result.title}</div>
                <div className="comparison-params">{result.params}</div>
                <div className="comparison-text">
                  <strong>{prompt}</strong>
                  {result.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <footer>
        <p>
          Built with{' '}
          <a href="https://huggingface.co/docs/transformers.js" target="_blank" rel="noopener noreferrer">
            Transformers.js
          </a>{' '}
          · Running DistilGPT2 in your browser · No API keys required
        </p>
        <p style={{ marginTop: '0.5rem' }}>
          <a
            href="https://github.com/fagun98/llm-decoding-playground"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
