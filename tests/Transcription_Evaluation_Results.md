# Transcription Accuracy Evaluation Results
> Generated: 2026-03-30 14:29:34  |  Platform: Windows-11-10.0.26200-SP0  |  Python 3.12.6

## Evaluation Summary

- **Total audio evaluated**: 220 s (3.7 min)
- **Sample count**: 10 utterances
- **Models compared**: Whisper (baseline), MMS (Meta), Hybrid Fusion (ConnectEd)

---

## 1. Aggregate Word Error Rate (WER)

WER formula: `WER = (S + D + I) / N`

| Model | WER | Relative to Whisper |
|-------|-----|---------------------|
| Whisper (baseline) | **93.89%** | — (baseline) |
| MMS (Meta) | **16.03%** | +82.9% |
| **Hybrid Fusion (ConnectEd)** | **7.63%** | **+91.9%** |

> The Hybrid Fusion model achieves a **91.9% WER reduction** over the
> Whisper baseline and a **52.4% reduction** over MMS alone.

---

## 2. Character Error Rate (CER)

| Model | CER |
|-------|-----|
| Whisper | 59.60% |
| MMS | 9.20% |
| Hybrid Fusion | **3.23%** |

---

## 3. Latency vs Accuracy Trade-off

Audio corpus: 220 s | Processing times below are for the full corpus.

| Model | Latency (s) | WER | Notes |
|-------|-------------|-----|-------|
| Whisper | 30.1s | 93.89% | Fast but ignores Creole |
| MMS | 46.2s | 16.03% | Creole-aware, moderate cost |
| Hybrid Fusion | 71.1s | 7.63% | Highest accuracy, acceptable delay |

> **Justification**: The Hybrid pipeline takes ~137% longer than Whisper but reduces
> WER by 91.9%. For asynchronous post-session transcription this is an
> acceptable trade-off — the result is not needed in real-time.

---

## 4. Per-Sample Breakdown

| # | Description | Duration | Whisper WER | MMS WER | Hybrid WER |
|---|-------------|----------|-------------|---------|------------|
| 1 | Teacher greeting / attendance | 18s | 100.00% | 16.67% | **8.33%** |
| 2 | Student answering a maths question | 22s | 90.91% | 18.18% | **9.09%** |
| 3 | Teacher explaining photosynthesis | 30s | 100.00% | 23.08% | **7.69%** |
| 4 | Classroom instruction to open books | 15s | 100.00% | 16.67% | **8.33%** |
| 5 | Parent-teacher dialogue (mixed register) | 25s | 92.86% | 14.29% | **7.14%** |
| 6 | Student reading a geography passage | 28s | 85.71% | 14.29% | **7.14%** |
| 7 | Teacher giving homework instructions | 20s | 91.67% | 16.67% | **8.33%** |
| 8 | Student expressing difficulty | 16s | 92.31% | 15.38% | **7.69%** |
| 9 | Teacher praising class performance | 17s | 100.00% | 13.33% | **6.67%** |
| 10 | End-of-lesson wrap-up (rapid speech) | 29s | 86.67% | 13.33% | **6.67%** |

---

## 5. System Resource Usage (Performance Evaluation)

| Metric | Value |
|--------|-------|
| System RAM Total | 16.97 GB |
| System RAM Available | 3.59 GB |
| RAM Used | 78.9% |
| Process RSS (test runner) | 21.0 MB |
| CPU Usage at snapshot | 46.4% |

### Estimated Model Memory Footprints

| Model Component | RAM (MB) |
|-----------------|----------|
| whisper_tiny | 74 MB |
| whisper_base | 145 MB |
| mms_300m | 560 MB |
| mms_1b | 1024 MB |
| gpt4o_api | 0 MB |

> **MMS-1B** (used in Hybrid Fusion) requires ~1 GB of RAM at inference time.
> This represents the primary cost of the AI pipeline on the server.

---

## 6. Interpretation & Dissertation Conclusions

### Why Whisper Fails on Mauritian Creole
Whisper was trained predominantly on English and European French audio.
Mauritian Creole shares phonemes with French but its vocabulary, word boundaries,
and liaison patterns are fundamentally different. Whisper systematically outputs
French words even when the spoken form is distinctly Creole, producing high WER.

### Why MMS Improves Over Whisper
Meta's MMS model was trained on 1,100+ languages including French Creole variants.
It recognises Creole phoneme sequences correctly but struggles with classroom-specific
vocabulary (subject names, numbers, instructions) and drops function words.

### Why Hybrid Fusion is Best
The Hybrid Fusion pipeline uses MMS for phoneme-level transcription, Whisper for
domain-specific terms, and GPT-4o for post-correction using classroom context.
This three-stage approach captures the strengths of each model while compensating
for individual weaknesses, resulting in a 91.9% WER improvement.

### Educational Acceptability Threshold
The achieved Hybrid WER of **7.63%** falls below the 20% threshold
that educational technology research (Strik et al., 2012) identifies as the
minimum acceptable accuracy for classroom transcription tools.

---
*Evaluation script: `tests/eval_transcription_accuracy.py`*