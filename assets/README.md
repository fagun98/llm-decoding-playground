# Screenshots

Screenshots will be generated after manual testing of the deployed application.

The application includes:
1. **Main Interface** - Shows the probability chart with token bars, parameter sliders (Temperature, Top-K, Top-P), and interactive controls
2. **Filtered Tokens** - Demonstrates how tokens are visually filtered (greyed out and crossed out) when top-k or top-p thresholds are applied
3. **Strategy Comparison** - Side-by-side comparison of greedy (temp=0), balanced (temp=0.7), and creative (temp=1.5) sampling outputs

## To Generate Screenshots

1. Run the application: `npm run dev`
2. Open http://localhost:5173/llm-decoding-playground/ in a browser
3. Wait for the model to load (~1-2 minutes on first load)
4. Interact with the controls:
   - Adjust sliders to see real-time probability changes
   - Set Top-K to 10 or Top-P to 0.5 to see token filtering
   - Use "Sample 1 Token" and "Generate 20 Tokens" buttons
   - Click "Compare Strategies" for side-by-side outputs
5. Capture screenshots showing these features

## Production Build Testing

```bash
npm run build
npm run preview
```

Then visit http://localhost:4173/llm-decoding-playground/
