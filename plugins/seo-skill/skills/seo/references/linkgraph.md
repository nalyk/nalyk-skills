# Internal Link Graph Analysis

Analyze how internal links distribute authority across your site.

## Capabilities

### PageRank-like Scoring
- Simplified PageRank algorithm on internal link graph
- Shows relative importance of each page based on link structure
- Identifies pages receiving disproportionate/insufficient link equity

### Orphan Page Detection
- Pages in sitemap but unreachable by internal links
- Pages with zero incoming internal links (except homepage)
- Compares crawl graph vs sitemap for coverage gaps

### Dead-End Detection
- Pages with zero outgoing internal links
- Users and crawlers get trapped on these pages
- Fix by adding contextual internal links

### Hub & Authority Pages
- **Hub pages**: High outgoing link count (navigation, category pages)
- **Authority pages**: High incoming link count (popular content)
- Imbalance detection (e.g., /pricing has 3 incoming vs /blog has 47)

### Cannibalization Detection
- TF-IDF similarity between page titles and H1s
- Flags pages competing for the same keyword space
- Similarity threshold: >60% word overlap (stopwords excluded)

### Auto-Suggested Links
- Scans page content for mentions of other page topics
- Suggests: source URL, target URL, anchor text, reason
- Only suggests links that don't already exist

## Commands

| Command | What it does |
|---------|-------------|
| `/seo linkgraph <url>` | Full link graph analysis |
| `/seo linkgraph <url> --suggest` | Focus on link suggestions |
| `/seo linkgraph <url> --orphans` | Focus on orphan pages |
| `/seo linkgraph <url> --cannibalization` | Focus on cannibalization |

## Output

### Link Equity Distribution
```
Top 5 by PageRank:     Bottom 5 by PageRank:
1. /           0.0842  1. /blog/old-post    0.0003
2. /blog       0.0531  2. /terms            0.0005
3. /pricing    0.0412  3. /blog/draft       0.0007
4. /features   0.0389  4. /careers/old      0.0008
5. /about      0.0301  5. /press/2023       0.0010
```

### Suggested Links
```
SOURCE: /blog/seo-tips/
TARGET: /services/schema-audit/
ANCHOR: "schema markup audit"
REASON: Content mentions 'schema markup' 4× but doesn't link to target page
```

## Engine

Uses `engine/link_graph.py` which implements:
- PageRank with damping factor 0.85, 50 iterations
- Jaccard similarity for cannibalization (stopword-filtered)
- Keyword → URL mapping for link suggestions
