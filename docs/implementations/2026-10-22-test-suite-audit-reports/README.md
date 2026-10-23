Reports are written incrementally as JSONL events, with an atomic final JSON snapshot.
Every finding includes confidence and poor_quality_probability (0–1).
The primary reviewer prioritizes ambiguous quality claims near probability 0.5 before confirmed poor cases near 1.0; demonstrated good guards stay intact.
Original source mutations must run only in isolated temporary snapshots.

These are historical agent snapshots and incremental findings. root.json and realism/review.json record primary decisions and corrections. Confidence scores are reviewer judgments, not probabilities of complete correctness. Any /tmp log references identify ephemeral execution evidence; final outcomes are recorded here, but raw logs are not included.
