# llama.cpp OpenVINO Backend CI Dashboard

Tracks the daily CI health of the [OpenVINO backend](https://github.com/ggml-org/llama.cpp/blob/master/docs/backend/OPENVINO.md) in [ggml-org/llama.cpp](https://github.com/ggml-org/llama.cpp) `master` branch.

### Explore the Dashboard: <https://ravi9.github.io/llamacpp-ov-ci-dashboard/>

**Tracked:** `CI (openvino)` · `CI (self-hosted OpenVINO backend)` — daily pass/fail/cancelled status, 90-day history.

---

## How it works

Every day, this repo syncs to `ggml-org/llama.cpp`'s `master` branch and runs `build-openvino.yml` and `ci-self-hosted-openvino.yml` CI workflows against it and updates the dashboard.

---

## Setup: `SYNC_TOKEN`

The daily sync workflow needs a personal access token (PAT) in the `SYNC_TOKEN` secret. It uses the token to push the upstream merge (which can change `.github/workflows/*`) and to start the OpenVINO CI workflows. Runs started with the built-in `GITHUB_TOKEN` do not trigger the dashboard update, so a PAT is required.

If the sync fails at "Checkout mirror (master)" with `fatal: could not read Username for 'https://github.com': terminal prompts disabled`, the token has expired or is invalid. Replace it as below.

Do not paste the token into chats, issues or files.

### 1. Create the token

1. Open <https://github.com/settings/personal-access-tokens/new> (profile photo -> Settings -> Developer settings -> Personal access tokens -> Fine-grained tokens -> Generate new token).
2. **Token name:** `llamacpp-ov-ci-dashboard sync`
3. **Resource owner:** `ravi9`
4. **Expiration:** Custom, about one year ahead. Set a calendar reminder a week before it expires.
5. **Repository access:** Only select repositories -> `ravi9/llamacpp-ov-ci-dashboard`
6. **Repository permissions** (Metadata read-only is added automatically):
   - **Contents:** Read and write (check out and push the merge commit)
   - **Workflows:** Read and write (push upstream changes to `.github/workflows/*`)
   - **Actions:** Read and write (start the OpenVINO CI workflows)
7. Click **Generate token** and copy it. GitHub shows it only once.

A classic PAT also works: Tokens (classic) -> Generate new token (classic), scopes `repo` and `workflow`.

### 2. Save it as the secret

- **Web:** <https://github.com/ravi9/llamacpp-ov-ci-dashboard/settings/secrets/actions> -> pencil next to `SYNC_TOKEN` (or **New repository secret** the first time) -> paste -> **Update secret**.
- **CLI:** run the command below in your own terminal and paste the token at the prompt, so it stays out of shell history:

  ```bash
  gh secret set SYNC_TOKEN --repo ravi9/llamacpp-ov-ci-dashboard
  ```

### 3. Verify

1. Start the sync: Actions -> "[OV CI Dashboard] Sync upstream + trigger OV CI" -> **Run workflow** on `master`, or:

   ```bash
   gh workflow run 0-ov-ci-dash-sync-upstream.yml --repo ravi9/llamacpp-ov-ci-dashboard
   ```

2. "Checkout mirror (master)" passes. If upstream has new commits, the merge is pushed and `CI (openvino)` and `CI (self-hosted OpenVINO backend)` start.
3. When each CI run finishes, "[OV CI Dashboard] Log OV CI status" runs and updates the dashboard.
4. Optional: delete the old token under Settings -> Developer settings -> Personal access tokens.

---
- [LlamaCPP OpenVINO CI Dashboard](https://ravi9.github.io/llamacpp-ov-ci-dashboard/)
- [OpenVINO Docs](https://docs.openvino.ai/)
- [LlamaCPP OpenVINO Backend Docs](https://github.com/ggml-org/llama.cpp/blob/master/docs/backend/OPENVINO.md)
- [LlamaCPP Download Metrics Dashboard](https://github.com/ravi9/llamacpp-metrics)
