---
name: research
description: Deep research on topics using web search and synthesis. Use when users need comprehensive information gathering, fact-checking, or exploring unfamiliar domains.
---

# Research Skill

When conducting research for the user:

## Process

1. **Clarify scope** - Understand what the user wants to learn and any constraints
2. **Search strategically** - Use `web_search` with specific, targeted queries
3. **Verify sources** - Cross-reference multiple sources for accuracy
4. **Synthesize findings** - Present organized, actionable insights

## Best Practices

- Start broad, then narrow down based on initial findings
- Note source credibility and recency
- Distinguish facts from opinions
- Highlight uncertainties or conflicting information
- Save important findings to notes for future reference

## Output Format

Present research as:
- **Key findings** (bullet points)
- **Sources consulted** (with links if available)
- **Confidence level** (high/medium/low)
- **Areas needing more research** (if applicable)

## When to Use Subagents

For complex research tasks, consider using `start_task` with the `researcher` agent to conduct deep investigation while you continue interacting with the user.
