# AI Benchmark Results

Date: 2026-03-21
Evaluator: ai/evaluate_ai.py

## Chat Metrics

- Dataset prompts tested: 2014
- Intent recall proxy: 44.34% (893/2014)
- Average latency: 0.00 ms
- P95 latency: 0.01 ms

## Recommendation Metrics

- Cases evaluated: 175
- Constraint compliance (capacity/budget): 47.43% (83/175)

## Behavioral Tests

- Cases passed: 6/6
- Pass rate: 100.00%

## Weighted Decision Score

Using weights from docs/AI_EVALUATION_MATRIX.md:

- Quality: 63.92
- Completion: 72.17
- Latency: 100.00
- Reliability: 100.00
- Cost: 95.00

Final score = 0.35*Quality + 0.25*Completion + 0.15*Latency + 0.15*Reliability + 0.10*Cost

Final score: 79.92/100

## Notes

- This benchmark is deterministic and lightweight for class defense reproducibility.
- For final defense, attach sample transcripts and confusion examples alongside this report.
