import { parse as parseYaml } from 'yaml'
import { z } from 'zod'

// Schema for thread notes frontmatter
export const ThreadNotesMetadataSchema = z.object({
  summary: z.string().optional(),
})
export type ThreadNotesMetadata = z.infer<typeof ThreadNotesMetadataSchema>

// Parsed thread notes
export interface ThreadNotes {
  summary: string
  body: string
}

// Parse YAML frontmatter from thread notes content
export function parseThreadNotes(content: string): ThreadNotes {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/
  const match = content.match(frontmatterRegex)

  if (!match) {
    // No frontmatter, return content as body with empty summary
    return { summary: '', body: content.trim() }
  }

  const [, yamlContent, body] = match

  try {
    const rawMetadata = parseYaml(yamlContent)
    const metadata = ThreadNotesMetadataSchema.parse(rawMetadata)
    return {
      summary: metadata.summary || '',
      body: body.trim(),
    }
  } catch {
    // Invalid YAML, return content as body with empty summary
    return { summary: '', body: content.trim() }
  }
}
