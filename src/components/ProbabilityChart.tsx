import { TokenProbability } from '../utils/sampling';

interface ProbabilityChartProps {
  probabilities: TokenProbability[];
  selectedToken?: string;
  maxBars?: number;
}

export function ProbabilityChart({
  probabilities,
  selectedToken,
  maxBars = 15
}: ProbabilityChartProps) {
  const displayProbs = probabilities.slice(0, maxBars);
  const maxProb = Math.max(...displayProbs.map((p) => p.probability));

  return (
    <div className="probability-chart">
      <h3 className="card-title">Token Probabilities</h3>
      <div className="chart-bars">
        {displayProbs.map((prob, idx) => {
          const widthPercent = maxProb > 0 ? (prob.probability / maxProb) * 100 : 0;
          const isSelected = selectedToken === prob.token;

          return (
            <div key={`${prob.tokenId}-${idx}`} className="chart-bar">
              <div className={`bar-label ${prob.filtered ? 'filtered' : ''}`}>
                {prob.token.replace(/\n/g, '\\n').replace(/\t/g, '\\t') || '(empty)'}
              </div>
              <div className="bar-container">
                <div
                  className={`bar-fill ${prob.filtered ? 'filtered' : ''} ${
                    isSelected ? 'selected' : ''
                  }`}
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
              <div className={`bar-value ${prob.filtered ? 'filtered' : ''}`}>
                {prob.filtered ? '—' : (prob.probability * 100).toFixed(1) + '%'}
              </div>
            </div>
          );
        })}
      </div>
      {probabilities.length > maxBars && (
        <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Showing top {maxBars} of {probabilities.length} tokens
        </p>
      )}
    </div>
  );
}
