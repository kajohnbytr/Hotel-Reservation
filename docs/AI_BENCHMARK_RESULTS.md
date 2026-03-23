# AI Benchmark Results

Date: 2026-03-23
Evaluator: ai/evaluate_ai.py

## Chat Metrics

- Dataset prompts tested: 2014
- Intent recall proxy: 44.34% (893/2014)
- Average latency: 0.00 ms
- P95 latency: 0.01 ms

## Intent Classification Metrics (Label-Normalized)

- Samples evaluated: 2014
- Accuracy: 27.71%
- Macro precision: 36.02%
- Macro recall: 22.30%
- Macro F1: 20.74%

### Per-Class Metrics

| Label | Precision | Recall | F1 | Support |
|---|---:|---:|---:|---:|
| amenities | 99.49% | 59.63% | 74.57% | 327 |
| cancellation | 0.00% | 0.00% | 0.00% | 10 |
| contact | 0.00% | 0.00% | 0.00% | 7 |
| fallback | 0.00% | 0.00% | 0.00% | 148 |
| greeting | 42.25% | 76.76% | 54.50% | 284 |
| location | 0.00% | 0.00% | 0.00% | 143 |
| policy | 100.00% | 13.00% | 23.01% | 200 |
| price | 0.00% | 0.00% | 0.00% | 241 |
| recommendation | 0.00% | 0.00% | 0.00% | 197 |
| reservation | 100.00% | 18.18% | 30.77% | 209 |
| rooms | 100.00% | 29.44% | 45.48% | 231 |
| thanks | 0.00% | 0.00% | 0.00% | 3 |
| unknown | 0.00% | 0.00% | 0.00% | 0 |
| wifi | 26.53% | 92.86% | 41.27% | 14 |

### Confusion Matrix

| Actual / Predicted | amenities | cancellation | contact | fallback | greeting | location | policy | price | recommendation | reservation | rooms | thanks | unknown | wifi |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| amenities | 195 | 0 | 0 | 0 | 41 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 58 | 33 |
| cancellation | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 10 | 0 |
| contact | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 7 | 0 |
| fallback | 0 | 0 | 0 | 0 | 57 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 91 | 0 |
| greeting | 0 | 0 | 0 | 0 | 218 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 66 | 0 |
| location | 0 | 0 | 0 | 0 | 21 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 122 | 0 |
| policy | 1 | 0 | 0 | 0 | 30 | 0 | 26 | 0 | 0 | 0 | 0 | 0 | 143 | 0 |
| price | 0 | 0 | 0 | 0 | 39 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 202 | 0 |
| recommendation | 0 | 0 | 0 | 0 | 39 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 155 | 3 |
| reservation | 0 | 0 | 0 | 0 | 32 | 0 | 0 | 0 | 0 | 38 | 0 | 0 | 139 | 0 |
| rooms | 0 | 0 | 0 | 0 | 38 | 0 | 0 | 0 | 0 | 0 | 68 | 0 | 125 | 0 |
| thanks | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 0 |
| unknown | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| wifi | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 13 |

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

- Classification metrics are label-normalized proxies to compare the intent matcher against the dataset taxonomy.
- This benchmark is deterministic and lightweight for class defense reproducibility.
- For final defense, attach sample transcripts and confusion examples alongside this report.
