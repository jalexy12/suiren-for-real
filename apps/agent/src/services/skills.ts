import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import { AGENTFS_PATHS } from '@suiren/shared'

// Schema for skill frontmatter
export const SkillMetadataSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
})
export type SkillMetadata = z.infer<typeof SkillMetadataSchema>

// Full skill including body content
export interface Skill extends SkillMetadata {
  filename: string
  body: string
}

// Skill registry holding all loaded skills
export interface SkillRegistry {
  skills: Map<string, Skill>
  summaries: SkillMetadata[]
  files: Record<string, string> // For bootstrapping into virtual FS
}

// Parse YAML frontmatter from markdown content
export function parseSkillFile(content: string): { metadata: SkillMetadata; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/
  const match = content.match(frontmatterRegex)

  if (!match) {
    throw new Error('Invalid skill file: missing YAML frontmatter')
  }

  const [, yamlContent, body] = match
  const rawMetadata = parseYaml(yamlContent)
  const metadata = SkillMetadataSchema.parse(rawMetadata)

  return { metadata, body: body.trim() }
}

// Load all skills from the skills directory
export async function loadSkills(skillsDir: string): Promise<SkillRegistry> {
  const skills = new Map<string, Skill>()
  const summaries: SkillMetadata[] = []
  const files: Record<string, string> = {}

  let mdFiles: string[] = []
  try {
    const allFiles = await readdir(skillsDir)
    mdFiles = allFiles.filter((f) => f.endsWith('.md'))
  } catch {
    // Skills directory doesn't exist yet, return empty registry
    return { skills, summaries, files }
  }

  for (const filename of mdFiles) {
    const filepath = join(skillsDir, filename)
    const content = await readFile(filepath, 'utf-8')

    try {
      const { metadata, body } = parseSkillFile(content)
      const skill: Skill = { ...metadata, filename, body }

      skills.set(metadata.name, skill)
      summaries.push({ name: metadata.name, description: metadata.description })

      // Add to files map for virtual FS bootstrap
      const virtualPath = `${AGENTFS_PATHS.skills}/${filename}`
      files[virtualPath] = content
    } catch (error) {
      console.error(`Failed to load skill ${filename}:`, error)
    }
  }

  return { skills, summaries, files }
}

// Generate metadata summary for system prompt (always injected)
export function generateSkillsPrompt(summaries: SkillMetadata[]): string {
  if (summaries.length === 0) {
    return ''
  }

  const skillList = summaries.map((s) => `- **${s.name}**: ${s.description}`).join('\n')

  return `
## Available Skills
You have access to specialized skills. Use \`load_skill\` to load full instructions when needed.

${skillList}
`
}

// Get list of available skill names
export function getAvailableSkills(registry: SkillRegistry): string[] {
  return Array.from(registry.skills.keys())
}
