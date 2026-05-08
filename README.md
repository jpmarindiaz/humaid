# LFM2.5-VL on Ollama: from Hugging Face to a published model

Walkthrough of taking [LiquidAI/LFM2.5-VL-450M-GGUF](https://huggingface.co/LiquidAI/LFM2.5-VL-450M-GGUF) and publishing it to Ollama as [`jpmarindiaz/lfm2.5-vl-450m`](https://ollama.com/jpmarindiaz/lfm2.5-vl-450m).

The published model is **text-only** for now — see [Vision support](#vision-support) below.

## Prerequisites

- macOS with [Homebrew](https://brew.sh)
- An [ollama.com](https://ollama.com) account
- ~1 GB free disk

```bash
brew install llama.cpp ollama
```

Make sure the Ollama daemon is running (open the Ollama app once, or `ollama serve` in a terminal).

## 1. Pull the GGUF from Hugging Face

`llama.cpp` can fetch a GGUF directly from HF and cache it locally. This also lets us verify the model actually runs before bothering with Ollama:

```bash
llama-mtmd-cli -hf LiquidAI/LFM2.5-VL-450M-GGUF:Q4_0
```

The `:Q4_0` suffix selects the quantization. The cached files land under `~/.cache/huggingface/hub/`:

```
~/.cache/huggingface/hub/models--LiquidAI--LFM2.5-VL-450M-GGUF/snapshots/<hash>/
├── LFM2.5-VL-450M-Q4_0.gguf            # main model
└── mmproj-LFM2.5-VL-450m-Q8_0.gguf     # vision projector (used by llama.cpp, not Ollama)
```

Note the absolute path of the main `.gguf` — you'll need it for the Modelfile.

## 2. Write a Modelfile

A `Modelfile` is Ollama's recipe for building a model — like a Dockerfile, but for LLMs. Create it as plain text:

```Modelfile
FROM /Users/<you>/.cache/huggingface/hub/models--LiquidAI--LFM2.5-VL-450M-GGUF/snapshots/<hash>/LFM2.5-VL-450M-Q4_0.gguf

TEMPLATE """{{ if .System }}<|im_start|>system
{{ .System }}<|im_end|>
{{ end }}{{ if .Prompt }}<|im_start|>user
{{ .Prompt }}<|im_end|>
{{ end }}<|im_start|>assistant
{{ .Response }}<|im_end|>
"""

PARAMETER stop "<|im_end|>"
PARAMETER stop "<|im_start|>"
```

### Why the template matters

LFM2 uses ChatML-style turn markers (`<|im_start|>` / `<|im_end|>`). If you skip the `TEMPLATE` block and let Ollama default to passthrough (`{{ .Prompt }}`), the model has no idea where the user turn ends and emits an EOS token immediately on the chat API path. Symptom: `ollama run` from the CLI looks fine, but `/api/chat` returns an empty response.

The template uses `.Prompt` and `.Response` (rather than `.Messages`) so it works with both the single-shot CLI path and the chat API. The two `PARAMETER stop` lines stop generation cleanly at turn boundaries.

Don't add a `<|startoftext|>` BOS token to the template — the GGUF metadata already adds one automatically, and a double BOS makes generation hang.

## 3. Build it locally and test

```bash
ollama create lfm2-vl -f Modelfile
ollama run lfm2-vl "What is 2 plus 2?"
```

Verify the chat API works too:

```bash
curl -s http://localhost:11434/api/chat -d '{
  "model": "lfm2-vl",
  "messages": [{"role": "user", "content": "Hello!"}],
  "stream": false
}' | python3 -m json.tool
```

You should get a non-empty `message.content`.

## 4. Register your signing key with ollama.com

Pushing requires your local Ollama public key to be registered on ollama.com:

```bash
cat ~/.ollama/id_ed25519.pub
```

Paste the output into [ollama.com → Settings → Keys](https://ollama.com/settings/keys).

## 5. Tag under your namespace and push

```bash
ollama cp lfm2-vl jpmarindiaz/lfm2.5-vl-450m
ollama push jpmarindiaz/lfm2.5-vl-450m
```

The model is now public at `https://ollama.com/jpmarindiaz/lfm2.5-vl-450m` and anyone can run it with:

```bash
ollama run jpmarindiaz/lfm2.5-vl-450m
```

## Vision support

Although the source model is multimodal, this Ollama package is text-only:

- The `mmproj-*.gguf` (vision projector) can't be cleanly attached to an LFM2 main model in current Ollama. Adding it as a second `FROM` line caused load errors (`missing tensor 'output_norm'`) in our testing.
- For full image inference, use `llama.cpp` directly:

  ```bash
  llama-mtmd-cli -hf LiquidAI/LFM2.5-VL-450M-GGUF:Q4_0 \
    --image path/to/image.jpg -p "describe this image"
  ```

  Or run an OpenAI-compatible server:

  ```bash
  llama-server -hf LiquidAI/LFM2.5-VL-450M-GGUF:Q4_0 --port 8080
  ```

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| API returns `"content": ""` and `eval_count: 1` | Missing chat template — see step 2 |
| `ollama run` hangs and never replies | Bad template (e.g. extra BOS, mismatched variables) — kill the runner with `pkill -f "ollama runner"` and rebuild |
| `error loading model: missing tensor 'output_norm'` | Tried to attach `mmproj` as a second `FROM` — remove it |
| `ollama push` returns 401 | Public key not registered at [ollama.com/settings/keys](https://ollama.com/settings/keys) |
# humaid
