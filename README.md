# User Story Analyzer

An AI-powered tool that accepts a **Business Context** and **User Story**, then automatically:

- 🔍 **Identifies gaps** — risks, missing acceptance criteria, edge cases, and additional personas
- 🖼️ **Generates a UI prototype** — a realistic mockup of the primary screen
- 📄 **Produces documentation** — structured feature docs with scope, requirements, dependencies, and open questions

Built with vanilla HTML/CSS/JS and the [Anthropic Claude API](https://docs.anthropic.com/).

---

## Getting Started

### Option A — Open directly in browser

Just open `index.html` in any modern browser. No build step needed.

### Option B — Serve locally

```bash
# Python
python3 -m http.server 8080

# Node (npx)
npx serve .
```

Then open `http://localhost:8080`.

---

## Usage

1. Enter your **Business Context** — domain, goals, target users, constraints
2. Enter your **User Story** — role, want, benefit, and any acceptance criteria you already have
3. Paste your **Anthropic API Key** (`sk-ant-...`) — it is never stored, only used in-session
4. Click **Analyze Story**

Results appear across three tabs:

| Tab | What you get |
|---|---|
| **Gap Analysis** | Gaps & risks (high / medium / low), suggested acceptance criteria, missing personas |
| **Prototype** | Auto-generated HTML mockup of the primary user screen |
| **Documentation** | Structured feature doc — copy to clipboard or download as `.md` |

---

## Project Structure

```
user-story-analyzer/
├── index.html   # Markup & tab structure
├── style.css    # All styles
├── app.js       # Analysis logic & API calls
└── README.md
```

---

## API Key

You need an [Anthropic API key](https://console.anthropic.com/). The key is sent directly from your browser to `api.anthropic.com` and is **never stored or logged** by this app.

---

## Deployment

This is a pure static site — deploy anywhere:

- **GitHub Pages** — push to a repo, enable Pages in Settings → Pages
- **Netlify / Vercel** — drag and drop the folder
- **Any static host** — upload the three files

---

## License

MIT
