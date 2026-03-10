# AI Evaluation Matrix and Model Research

Last updated: 2026-03-09

## Purpose

This document defines how Aurora Hotel evaluates AI model choices for chatbot, intent handling, and room recommendation. It is designed for practical selection, repeatable benchmarking, and clear reporting in project documentation.

## Current AI Architecture

The backend chat flow is hybrid and fault-tolerant:

1. Local LLM via Ollama (`/api/chat`)
2. Python NLP intent chatbot fallback
3. Rule-based fallback replies
4. Separate ML recommender for room suggestion/rating (`/api/predict`)

This design improves reliability because service failures degrade gracefully instead of fully breaking chat features.

## Model Types to Research

### 1) Local LLMs (Natural Chat)

Goal: natural language responses, bilingual support (English/Filipino), context continuity.

Candidate families:

- `Llama 3.2 Instruct`
- `Mistral 7B Instruct`
- `Qwen2.5 Instruct`

Selection notes:

- Prefer instruction-tuned models for chat quality.
- Measure quality together with latency and memory footprint on target hardware.

### 2) Intent Models (Fast Classification)

Goal: robust detection of user intent when LLM is unavailable or for low-latency routing.

Candidate families:

- `TF-IDF + Logistic Regression`
- `TF-IDF + Linear SVM`
- `DistilBERT` (or equivalent compact transformer)

Selection notes:

- Start with linear baselines for speed and interpretability.
- Promote to compact transformer only if classification quality gains are clear.

### 3) Recommendation/Regression Models (Room Fit)

Goal: estimate user satisfaction or recommendation quality from guests, nights, room type, and price.

Candidate families:

- `Linear Regression` (baseline)
- `Random Forest Regressor`
- `XGBoost` or `LightGBM`
- `CatBoost`

Selection notes:

- Keep a simple baseline model for calibration and regression checks.
- Favor models that balance accuracy with explainability for hospitality use.

### 4) Rule-Based Layer (Safety and Continuity)

Goal: guaranteed fallback for critical hotel FAQs and policy-safe responses.

Candidate approach:

- Pattern rules + slot extraction for guests, nights, and budget
- Deterministic answers for rates, amenities, booking, and support flows

## Evaluation Matrix

Use separate scorecards by component, then combine into a weighted final decision.

### A. Chat LLM Scorecard

| Metric | Description | Target |
|---|---|---|
| Task success rate | Correctly handles hotel questions and requests | >= 85% |
| Grounded factuality | Avoids invented room details/prices | >= 90% |
| Bilingual quality | Handles English/Filipino and mixed prompts | >= 85% |
| Latency P95 | End-to-end response time | <= 2.5 s |
| Fallback rate | How often LLM path fails and falls back | <= 10% |
| Resource usage | RAM/CPU within deployment budget | Within budget |

### B. Intent Model Scorecard

| Metric | Description | Target |
|---|---|---|
| Macro F1 | Balanced intent quality under class imbalance | >= 0.85 |
| Unknown intent detection | Correctly identifies out-of-scope prompts | >= 0.80 |
| Confusion risk | Critical confusion (booking vs cancellation) | Minimal |
| Inference time | Single-request model runtime | <= 50 ms |

### C. Recommendation Model Scorecard

| Metric | Description | Target |
|---|---|---|
| MAE | Mean absolute prediction error | Lower is better |
| RMSE | Penalizes larger prediction misses | Lower is better |
| Constraint compliance | Recommended room fits capacity and budget | 100% |
| Top-1 acceptance proxy | User accepts/clicks recommended room | Increasing trend |
| Coverage | Can recommend for most valid input combinations | >= 95% |

### D. System-Level Scorecard

| Metric | Description | Target |
|---|---|---|
| End-to-end success | User receives useful answer or recommendation | >= 95% |
| Chat availability | `/api/ai/chat` works with graceful degradation | >= 99% |
| Incident-free fallback | No hard failures when AI services are down | 100% |
| Safety pass rate | No unsafe/off-domain policy violations | >= 99% |

## Weighted Decision Formula

Recommended default weights for this project:

- Correctness and groundedness: `35%`
- Task completion: `25%`
- Latency: `15%`
- Robust fallback behavior: `15%`
- Cost and resource usage: `10%`

Overall score formula:

`FinalScore = 0.35*Quality + 0.25*Completion + 0.15*Latency + 0.15*Reliability + 0.10*Cost`

## Benchmark Protocol

1. Build a benchmark set of at least 150 prompts.
2. Include English, Filipino, mixed-language, typo-heavy, and short/long prompts.
3. Include policy checks: pricing, booking, cancellation, amenities, and AI meta questions.
4. Run each candidate model on the exact same dataset.
5. Log latency, output quality labels, fallback events, and error classes.
6. Select one primary and one backup model per component.
7. Re-run benchmark monthly using recent anonymized conversation samples.

## Recommended Starting Stack

Based on current architecture and local deployment constraints:

1. Primary chat LLM: `llama3.2` (Ollama)
2. Secondary chat LLM candidate: `qwen2.5-instruct` (A/B test)
3. Intent baseline: `TF-IDF + Linear SVM`
4. Recommender baseline: `RandomForestRegressor` vs `XGBoost`
5. Keep rule-based fallback always enabled

## Documentation Output Template

Use this short summary format when reporting evaluation runs:

- Date and dataset version
- Candidate models tested
- Per-component scorecards
- Weighted final scores
- Chosen production model and backup
- Known risks and next validation date
