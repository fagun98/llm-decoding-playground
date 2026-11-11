interface GenerationPanelProps {
  onSampleOne: () => void;
  onGenerate: () => void;
  onCompare: () => void;
  onReset: () => void;
  generating?: boolean;
  disabled?: boolean;
}

export function GenerationPanel({
  onSampleOne,
  onGenerate,
  onCompare,
  onReset,
  generating,
  disabled
}: GenerationPanelProps) {
  return (
    <div className="card">
      <h2 className="card-title">3. Sample & Generate</h2>
      <div className="action-buttons">
        <button
          className="btn btn-primary"
          onClick={onSampleOne}
          disabled={disabled || generating}
        >
          Sample 1 Token
        </button>
        <button className="btn btn-primary" onClick={onGenerate} disabled={disabled || generating}>
          {generating ? 'Generating...' : 'Generate ~25 Tokens'}
        </button>
        <button className="btn" onClick={onCompare} disabled={disabled || generating}>
          Compare Strategies
        </button>
        <button className="btn" onClick={onReset} disabled={disabled || generating}>
          Reset
        </button>
      </div>
    </div>
  );
}
