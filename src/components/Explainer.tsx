export function Explainer() {
  return (
    <div className="explainer">
      <h3>How LLM Decoding Works</h3>
      <p>
        Language models predict the next token by computing <strong>logits</strong> (raw scores)
        for every possible token. Here's the decoding pipeline:
      </p>
      <ol style={{ marginLeft: '1.5rem', color: 'var(--text-secondary)' }}>
        <li>
          <strong>Temperature scaling:</strong> Divide logits by temperature. Lower values
          (→0) sharpen the distribution (more focused/greedy), higher values (2.0+) flatten
          it (more random/creative).
        </li>
        <li>
          <strong>Softmax:</strong> Convert scaled logits to probabilities that sum to 1.
        </li>
        <li>
          <strong>Top-k filtering:</strong> Keep only the k most probable tokens, set others
          to zero, renormalize.
        </li>
        <li>
          <strong>Top-p (nucleus) filtering:</strong> Keep tokens until cumulative
          probability ≥ p, renormalize.
        </li>
        <li>
          <strong>Sampling:</strong> Pick a token randomly from the final distribution.
        </li>
      </ol>
      <p>
        <strong>When to use:</strong> Greedy (temp=0) for factual tasks, moderate temp (0.7-1.0)
        for balanced creativity, high temp (1.5+) for brainstorming. Top-k and top-p prevent
        sampling very unlikely tokens.
      </p>
    </div>
  );
}
