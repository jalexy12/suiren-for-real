---
name: note-taking
description: Structured note creation and organization in the filesystem. Use when users want to save information, create documents, or organize their knowledge.
---

# Note-Taking Skill

Help users capture and organize information in their filesystem at `/home/sui`.

## File Organization

```
/home/sui/
  notes/           # Quick notes and thoughts
  documents/       # Longer-form content
  projects/        # Project-specific notes
  reference/       # Reference materials
```

## Note Formats

### Quick Notes
```bash
echo "$(date '+%Y-%m-%d %H:%M') - Note content" >> ~/notes/quick.txt
```

### Structured Notes (Markdown)
```markdown
# Title

Created: YYYY-MM-DD
Tags: #tag1 #tag2

## Content
...
```

## Best Practices

- Use descriptive filenames: `meeting-2024-01-15-project-kickoff.md`
- Include dates for temporal notes
- Use consistent structure within note types
- Link related notes when relevant
- Keep notes concise and scannable

## Common Operations

- **Create note**: `echo "content" > ~/notes/filename.md`
- **Append to note**: `echo "content" >> ~/notes/filename.md`
- **List notes**: `ls ~/notes/`
- **Search notes**: `grep -r "keyword" ~/notes/`
- **Read note**: `cat ~/notes/filename.md`

## When Asked to Remember

When a user asks you to "remember" something:
1. Create an appropriately named file
2. Include context about when/why it was saved
3. Confirm what was saved and where
