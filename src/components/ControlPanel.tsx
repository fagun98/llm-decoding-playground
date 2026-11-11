interface ControlPanelProps {
  temperature: number;
  topK: number;
  topP: number;
  useSeededRandom: boolean;
  onTemperatureChange: (value: number) => void;
  onTopKChange: (value: number) => void;
  onTopPChange: (value: number) => void;
  onSeededRandomChange: (value: boolean) => void;
  disabled?: boolean;
}

export function ControlPanel({
  temperature,
  topK,
  topP,
  useSeededRandom,
  onTemperatureChange,
  onTopKChange,
  onTopPChange,
  onSeededRandomChange,
  disabled
}: ControlPanelProps) {
  return (
    <div className="card">
      <h2 className="card-title">2. Adjust Sampling Parameters</h2>

      <div className="controls-grid">
        <div className="control-group">
          <label className="control-label">
            <span>Temperature</span>
            <span className="control-value">{temperature.toFixed(2)}</span>
          </label>
          <input
            type="range"
            className="slider"
            min="0"
            max="2"
            step="0.01"
            value={temperature}
            onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
            disabled={disabled}
          />
          <div className="control-hint">
            Low (→0) = focused/greedy, High (2.0) = creative/random
          </div>
        </div>

        <div className="control-group">
          <label className="control-label">
            <span>Top-K</span>
            <span className="control-value">{topK === 0 ? 'Off' : topK}</span>
          </label>
          <input
            type="range"
            className="slider"
            min="0"
            max="50"
            step="1"
            value={topK}
            onChange={(e) => onTopKChange(parseInt(e.target.value))}
            disabled={disabled}
          />
          <div className="control-hint">Keep only top K tokens (0 = disabled)</div>
        </div>

        <div className="control-group">
          <label className="control-label">
            <span>Top-P (nucleus)</span>
            <span className="control-value">{topP.toFixed(2)}</span>
          </label>
          <input
            type="range"
            className="slider"
            min="0"
            max="1"
            step="0.01"
            value={topP}
            onChange={(e) => onTopPChange(parseFloat(e.target.value))}
            disabled={disabled}
          />
          <div className="control-hint">
            Cumulative probability threshold (1.0 = disabled)
          </div>
        </div>
      </div>

      <div className="checkbox-group">
        <input
          type="checkbox"
          id="seeded-random"
          checked={useSeededRandom}
          onChange={(e) => onSeededRandomChange(e.target.checked)}
          disabled={disabled}
        />
        <label htmlFor="seeded-random">Use fixed random seed (reproducible results)</label>
      </div>
    </div>
  );
}
