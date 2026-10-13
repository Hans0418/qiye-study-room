# Inook AI setup

Use Node.js 22 or newer. The local server serves outputs/study-room-mvp and the same-origin AI API. API keys stay outside the public directory.

Copy .env.example to .env and enter a key locally (never in chat or frontend code). Configure one provider to begin. OpenAI defaults to gpt-5.4-mini (no reasoning) for a quick first step and gpt-5.4 (medium reasoning) for study assistance. Qwen defaults to qwen-flash / qwen-plus; select the matching regional endpoint from your console. Seed requires both exact model or endpoint IDs from your Ark console, supporting thinking disabled/enabled respectively.

Run: `node --env-file=.env server.mjs`

Open http://127.0.0.1:8766. Without .env, `node server.mjs` serves the app and returns an explicit unconfigured response for AI. The old port 8765 is static-only and cannot serve AI requests.

Only explicit clicks invoke models. Opening a panel never spends tokens. Suggestions require user acceptance. This is a local development server, bound to loopback with same-origin checks, a two-request concurrency limit, 30 calls/hour per process, input and output bounds, timeouts and response validation. It has no public user authentication or durable per-user billing limits; add these before public deployment. GitHub Pages alone cannot run this backend.

No provider keys were present during implementation. Live provider calls, latency, account model access and answer quality must be verified after configuration. No model can guarantee absence of hallucinations. Assistant prompts forbid invented citations and claims of browsing; no retrieval tool is connected.

References: https://developers.openai.com/api/docs/models/gpt-5.4-mini ; https://help.aliyun.com/en/model-studio/deep-thinking ; https://docs.volcengine.com/docs/ark/chat-api
# 当前版本说明

当前运行路径已改为仅本地模型，不再调用下方历史云端配置。请按 [AGENT-DESIGN.md](AGENT-DESIGN.md) 配置 LOCAL_MODEL 和 Ollama。以下云端说明仅供保留参考。
