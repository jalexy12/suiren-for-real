---
name: planning
description: Task breakdown and project planning. Use when users need to organize complex tasks, create roadmaps, or break down large goals into actionable steps.
---

# Planning Skill

Help users break down complex tasks and create actionable plans.

## Planning Process

1. **Understand the goal** - Clarify the desired outcome
2. **Identify constraints** - Time, resources, dependencies
3. **Break down** - Decompose into smaller, concrete tasks
4. **Sequence** - Order tasks by dependencies and priority
5. **Document** - Save the plan for reference

## Plan Structure

```markdown
# Project: [Name]

## Goal
[Clear statement of what success looks like]

## Tasks
- [ ] Task 1 (dependency: none)
- [ ] Task 2 (dependency: Task 1)
- [ ] Task 3 (dependency: none)

## Notes
- Key decisions
- Risks or blockers
- Resources needed
```

## Best Practices

- Make tasks specific and actionable ("Write intro section" not "Work on document")
- Keep tasks small enough to complete in one session
- Identify blockers and dependencies early
- Include decision points where user input is needed
- Save plans to `/home/sui/projects/` for tracking

## When to Use Subagents

For complex planning tasks, use `start_task` with the `planner` agent to do deep analysis and return a structured plan.

## Progress Tracking

Help users track progress by:
- Checking off completed items
- Updating plans as requirements change
- Summarizing progress on request
