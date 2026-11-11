interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const PRESET_PROMPTS = [
  { label: 'Email opener', text: 'Hi team, I wanted to' },
  { label: 'Story opener', text: 'Once upon a time, in a land far away,' },
  { label: 'Technical', text: 'The main advantage of using TypeScript is' },
  { label: 'Factual', text: 'The capital of France is' },
  { label: 'Question', text: 'What is the meaning of' }
];

export function PromptInput({ value, onChange, disabled }: PromptInputProps) {
  return (
    <div className="card">
      <h2 className="card-title">1. Enter or Select a Prompt</h2>
      <textarea
        className="prompt-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type a prompt or click a preset below..."
        rows={3}
        disabled={disabled}
      />
      <div className="preset-buttons">
        {PRESET_PROMPTS.map((preset) => (
          <button
            key={preset.label}
            className="btn"
            onClick={() => onChange(preset.text)}
            disabled={disabled}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
