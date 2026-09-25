# llama.cpp OpenVINO Backend CI Dashboard

Tracks the daily CI health of the [OpenVINO backend](https://github.com/ggml-org/llama.cpp/blob/master/docs/backend/OPENVINO.md) in [ggml-org/llama.cpp](https://github.com/ggml-org/llama.cpp) `master` branch.

### Explore the Dashboard: <https://ravi9.github.io/llamacpp-ov-ci-dashboard/>

**Tracked:** `CI (openvino)` · `CI (self-hosted OpenVINO backend)` — daily pass/fail/cancelled status, 90-day history.

---

## How it works

Every day, this repo syncs to `ggml-org/llama.cpp`'s `master` branch and runs `build-openvino.yml` and `ci-self-hosted-openvino.yml` CI workflows against it and updates the dashboard.

---
- [LlamaCPP OpenVINO CI Dashboard](https://ravi9.github.io/llamacpp-ov-ci-dashboard/)
- [OpenVINO Docs](https://docs.openvino.ai/)
- [LlamaCPP OpenVINO Backend Docs](https://github.com/ggml-org/llama.cpp/blob/master/docs/backend/OPENVINO.md)
- [LlamaCPP Download Metrics Dashboard](https://github.com/ravi9/llamacpp-metrics)
