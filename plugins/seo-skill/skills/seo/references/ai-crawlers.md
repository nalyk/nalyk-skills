# AI Crawlers — Single Source of Truth

Known AI crawlers and their robots.txt tokens (2025-2026):

| Crawler | Company | robots.txt token | Purpose |
|---------|---------|-----------------|---------|
| GPTBot | OpenAI | `GPTBot` | Model training |
| OAI-SearchBot | OpenAI | `OAI-SearchBot` | OpenAI search features |
| ChatGPT-User | OpenAI | `ChatGPT-User` | Real-time browsing / citations |
| ClaudeBot | Anthropic | `ClaudeBot` | Model training + Claude web features |
| anthropic-ai | Anthropic | `anthropic-ai` | Claude training |
| PerplexityBot | Perplexity | `PerplexityBot` | Search index + training |
| Bytespider | ByteDance | `Bytespider` | Model training (TikTok/Douyin AI) |
| Google-Extended | Google | `Google-Extended` | Gemini training (NOT search) |
| CCBot | Common Crawl | `CCBot` | Open dataset (often blocked) |
| cohere-ai | Cohere | `cohere-ai` | Cohere models |

## Key Distinctions

- Blocking `Google-Extended` prevents Gemini training but does NOT affect
  Google Search indexing or AI Overviews (those use `Googlebot`).
- Blocking `GPTBot` prevents OpenAI training but does NOT prevent ChatGPT
  from citing your content via browsing (`ChatGPT-User`).
- ~3-5% of websites use AI-specific robots.txt rules.
- AI crawlers do NOT execute JavaScript — server-side rendering is critical
  for AI visibility.

## Recommendation

For AI search visibility: allow `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`,
`ClaudeBot`, `PerplexityBot`. Block `CCBot` and training-only crawlers if
desired. Consider AI visibility strategy before blocking — citations drive
brand awareness and referral traffic.

## Example — Selective AI Crawler Blocking

```
# Allow search indexing, block AI training crawlers
User-agent: GPTBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: Bytespider
Disallow: /

# Allow all other crawlers (including Googlebot for search)
User-agent: *
Allow: /
```
