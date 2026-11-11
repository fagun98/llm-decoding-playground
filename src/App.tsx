import { useState, useEffect } from 'react';
import './App.css';
import { PromptInput } from './components/PromptInput';
import { ControlPanel } from './components/ControlPanel';
import { ProbabilityChart } from './components/ProbabilityChart';
import { GenerationPanel } from './components/GenerationPanel';
import { Explainer } from './components/Explainer';
import { loadModel, getNextTokenLogits, generateWithModel, getModelInfo } from './utils/model';
import { decodeNextToken, SeededRandom, TokenProbability } from './utils/sampling';

interface ComparisonResult {
  title: string;
  params: string;
  text: string;
}

function App() {
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<{ status: string; progress?: number }>({ status: '', progress: 0 });
  const [prompt, setPrompt] = useState('Hi team, I wanted to');
  const [temperature, setTemperature] = useState(1.0);
  const [topK, setTopK] = useState(0);
  const [topP, setTopP] = useState(1.0);
  const [useSeededRandom, setUseSeededRandom] = useState(false);
  const [probabilities, setProbabilities] = useState<TokenProbability[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [generatedText, setGeneratedText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [comparison, setComparison] = useState<ComparisonResult[]>([]);

  useEffect(() => {
    const initModel = async () => {
      try {
        await loadModel((progress) => {
          setLoadingProgress(progress);
        });
        setLoading(false);
      } catch (err) {
        console.error('Failed to load model:', err);
        alert('Failed to load model. Please refresh the page.');
      }
    };
    initModel();
  }, []);

  const updateProbabilities = async (text: string) => {
    if (!text.trim()) {
      setProbabilities([]);
      return;
    }

    try {
      const { logits, tokenIds, tokens } = await getNextTokenLogits(text);
      const random = useSeededRandom ? new SeededRandom(42) : null;
      const result = decodeNextToken(logits, tokenIds, tokens, temperature, topK, topP, random);
      setProbabilities(result.probabilities);
    } catch (err) {
      console.error('Failed to get probabilities:', err);
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
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setGenerating(true);
    setGeneratedText('');
    setComparison([]);

    try {
      const currentText = prompt + generatedText;
      let newText = '';

      for (let i = 0; i < 20; i++) {
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

        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    } catch (err) {
      console.error('Failed to generate:', err);
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
        { title: 'Greedy (temp=0)', temp: 0, topK: 0, topP: 1.0 },
        { title: 'Balanced (temp=0.7)', temp: 0.7, topK: 40, topP: 0.9 },
        { title: 'Creative (temp=1.5)', temp: 1.5, topK: 0, topP: 0.95 }
      ];

      const results: ComparisonResult[] = [];

      for (const strategy of strategies) {
        const text = await generateWithModel(prompt, 30, strategy.temp, strategy.topK, strategy.topP);
        results.push({
          title: strategy.title,
          params: `T=${strategy.temp}, K=${strategy.topK}, P=${strategy.topP}`,
          text: text
        });
      }

      setComparison(results);
    } catch (err) {
      console.error('Failed to generate comparison:', err);
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
            {modelInfo.size} • First load may take a minute
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>🎲 LLM Decoding Playground</h1>
        <p className="subtitle">
          Explore how language models pick the next token with temperature, top-k, and top-p
          sampling
        </p>
        <div className="model-info">
          Model: {modelInfo.name} • {modelInfo.size}
        </div>
      </header>

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
          <a href="https://huggingface.co/docs/transformers.js" target="_blank" rel="noopener">
            Transformers.js
          </a>{' '}
          • Running DistilGPT2 in your browser • No API keys required
        </p>
        <p style={{ marginTop: '0.5rem' }}>
          <a
            href="https://github.com/fagun98/llm-decoding-playground"
            target="_blank"
            rel="noopener"
          >
            View on GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
