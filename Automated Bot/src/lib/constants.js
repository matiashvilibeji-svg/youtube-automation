/**
 * Technical rules that MUST always be present in the system prompt.
 * These are pipeline-critical — without them, generation breaks.
 * Creative direction (character, style, script rules) is now per-project.
 */
export const TECHNICAL_RULES = `## Chat Mode
For normal conversation (brainstorming, refining ideas, making changes to script), respond naturally and conversationally. No tools are triggered.

## Project State Awareness
Before each message you receive a "Current Project State" block showing all scenes, their statuses, and the current pipeline stage. Use this to answer questions like "which scenes failed?" or "how many videos are done?" accurately.

## Tool Selection Guide
Choose the right tool based on what the user wants:

- **Full pipeline** ("generate", "start", "make this", "let's do it", "go ahead", "do it") → \`generate_pipeline\` — creates script AND starts image+video generation
- **Script only** ("just write the script", "write it out", "create the scenes", "script only") → \`generate_script_only\` — creates scenes but does NOT start any media generation
- **Generate images** ("generate images", "make the images", "generate image for scene X") → \`generate_images\` — starts image generation for specific scenes or all scenes
- **Generate videos** ("generate videos", "make videos", "generate video for scene X") → \`generate_videos\` — starts video generation for scenes that have completed images
- **Update scenes** ("change scene X", "update the prompt", "make scene X darker") → \`update_scenes\` — modifies scene prompts without regenerating media

You may include a short text message alongside any tool call, but data MUST go through the tool, not in a text/code block.

## Array Rules
- All three arrays MUST be the same length
- 15–22 sentences total
- One image prompt per sentence
- One Kling prompt per sentence
- Every single sentence in the script becomes its own numbered key sentence
- Sentences that share the same visual context and do not need a separate image are combined into one entry
- Each sentence is prefixed with its number: [1], [2], [3]...

## Image Prompt Rules
Follow the image prompt philosophy from "## Image Prompt Philosophy" above if provided.
Each image prompt must include:
1. **Camera angle** — specified explicitly at the start. Must vary per scene. Examples:
   - Cinematic wide establishing shot
   - Low angle looking up
   - Over the shoulder angle
   - Medium two-shot
   - Close up side profile
   - High aerial shot
   - Backshot (character walking away from camera)
   - POV angle

2. **Lighting description** — golden hour, candlelight, torchlight, overcast, dramatic shaft of light, etc.

3. **Full character description** — Copy the COMPLETE character description from the "## Character Description" section above and include it verbatim in every image prompt. Never abbreviate or summarize. If no Character Description section is provided, describe the character based on context.

4. **Scene action** — exactly what the character is doing, their posture, what they're holding, expression

5. **Environment** — background, setting details, other characters if present

6. **End tag** — always ends with: Photorealistic, cinematic lighting, 9:16 vertical format.

## Kling Prompt Rules
Follow the video animation direction from "## Video Animation Direction" above if provided.
Each Kling prompt describes how to animate the corresponding image into a 5-second video clip. Must include:
1. **Character action** — exactly what the character does during the clip (gestures, movement, reactions)
2. **Camera movement** — push in, pull back, orbit, static hold, handheld shake, slow pan, etc.
3. **Atmosphere** — sound references if relevant, lighting mood, crowd behavior in background
4. **End tag** — always ends with: Realistic motion, 9:16 vertical.
Length: 2–4 sentences per Kling prompt.`

/**
 * Build the full system prompt from per-project structured instructions + technical rules.
 */
export function buildSystemPrompt({
  ideaInstructions = '', scriptInstructions = '', characterDescription = '',
  imageInstructions = '', videoInstructions = '',
  sampleInput = '', sampleOutput = '', projectContext = '',
} = {}) {
  const parts = []

  if (ideaInstructions.trim()) {
    parts.push(`## Idea & Brainstorming Direction\n${ideaInstructions.trim()}`)
  }
  if (scriptInstructions.trim()) {
    parts.push(`## Script Writing Rules\n${scriptInstructions.trim()}`)
  }
  if (characterDescription.trim()) {
    parts.push(`## Character Description\n${characterDescription.trim()}`)
  }
  if (imageInstructions.trim()) {
    parts.push(`## Image Prompt Philosophy\n${imageInstructions.trim()}`)
  }
  if (videoInstructions.trim()) {
    parts.push(`## Video Animation Direction\n${videoInstructions.trim()}`)
  }

  if (sampleInput.trim() && sampleOutput.trim()) {
    parts.push(`## Few-Shot Example

**User input:**
${sampleInput.trim()}

**Ideal output:**
${sampleOutput.trim()}`)
  }

  parts.push(TECHNICAL_RULES)

  if (projectContext) {
    parts.push(projectContext)
  }

  return parts.join('\n\n')
}

export const CLAUDE_MODEL = 'claude-sonnet-4-6'

export const STAGES = [
  { id: 'ideas', label: 'Ideas', num: 1 },
  { id: 'script', label: 'Script', num: 2 },
  { id: 'images', label: 'Images', num: 3 },
  { id: 'videos', label: 'Videos', num: 4 },
  { id: 'done', label: 'Done', num: 5 },
]

export const TRIGGER_WORDS = ['generate', 'start', 'make this', "let's do it"]

export const PIPELINE_TOOL = {
  name: 'generate_pipeline',
  description:
    'Generate the video pipeline when the user confirms they want to create the video. Call this tool with the full script sentences, image prompts, and Kling prompts.',
  input_schema: {
    type: 'object',
    properties: {
      sentences: {
        type: 'array',
        items: { type: 'string' },
        description: 'Numbered script sentences, e.g. "[1] First key sentence."',
      },
      imagePrompts: {
        type: 'array',
        items: { type: 'string' },
        description: 'One image prompt per sentence with full character description, camera angle, lighting, scene, and end tag.',
      },
      klingPrompts: {
        type: 'array',
        items: { type: 'string' },
        description: 'One Kling animation prompt per sentence with character action, camera movement, atmosphere, and end tag.',
      },
    },
    required: ['sentences', 'imagePrompts', 'klingPrompts'],
  },
}

export const SCRIPT_ONLY_TOOL = {
  name: 'generate_script_only',
  description:
    'Generate the script (scenes) without starting image or video generation. Use when the user wants to see/review the script first.',
  input_schema: {
    type: 'object',
    properties: {
      sentences: {
        type: 'array',
        items: { type: 'string' },
        description: 'Numbered script sentences, e.g. "[1] First key sentence."',
      },
      imagePrompts: {
        type: 'array',
        items: { type: 'string' },
        description: 'One image prompt per sentence with full character description, camera angle, lighting, scene, and end tag.',
      },
      klingPrompts: {
        type: 'array',
        items: { type: 'string' },
        description: 'One Kling animation prompt per sentence with character action, camera movement, atmosphere, and end tag.',
      },
    },
    required: ['sentences', 'imagePrompts', 'klingPrompts'],
  },
}

export const GENERATE_IMAGES_TOOL = {
  name: 'generate_images',
  description:
    'Start image generation for specific scenes or all scenes. Only use on scenes that already exist (script must be generated first).',
  input_schema: {
    type: 'object',
    properties: {
      sceneNumbers: {
        type: 'array',
        items: { type: 'integer' },
        description: '1-based scene numbers to generate images for, e.g. [1, 3, 5].',
      },
      all: {
        type: 'boolean',
        description: 'Set to true to generate images for all scenes.',
      },
    },
  },
}

export const GENERATE_VIDEOS_TOOL = {
  name: 'generate_videos',
  description:
    'Start video generation for specific scenes or all scenes. Only works on scenes that have a completed image.',
  input_schema: {
    type: 'object',
    properties: {
      sceneNumbers: {
        type: 'array',
        items: { type: 'integer' },
        description: '1-based scene numbers to generate videos for, e.g. [2, 4].',
      },
      all: {
        type: 'boolean',
        description: 'Set to true to generate videos for all scenes with completed images.',
      },
    },
  },
}

export const UPDATE_SCENES_TOOL = {
  name: 'update_scenes',
  description:
    'Update prompts or sentences for specific scenes without regenerating media.',
  input_schema: {
    type: 'object',
    properties: {
      updates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            sceneNumber: { type: 'integer', description: '1-based scene number' },
            sentence: { type: 'string', description: 'New sentence text (optional)' },
            imagePrompt: { type: 'string', description: 'New image prompt (optional)' },
            klingPrompt: { type: 'string', description: 'New Kling prompt (optional)' },
          },
          required: ['sceneNumber'],
        },
        description: 'Array of scene updates.',
      },
    },
    required: ['updates'],
  },
}

export const ALL_TOOLS = [PIPELINE_TOOL, SCRIPT_ONLY_TOOL, GENERATE_IMAGES_TOOL, GENERATE_VIDEOS_TOOL, UPDATE_SCENES_TOOL]

/**
 * Build a concise project state summary to inject into Claude's context.
 */
export function buildProjectContext(scenes, stage) {
  if (!scenes || scenes.length === 0) {
    return '\n\n## Current Project State\nNo scenes created yet. Stage: ideas'
  }

  const imgDone = scenes.filter((s) => s.imgStatus === 'done').length
  const imgErr = scenes.filter((s) => s.imgStatus === 'error').length
  const imgLoading = scenes.filter((s) => s.imgStatus === 'loading').length
  const vidDone = scenes.filter((s) => s.vidStatus === 'done').length
  const vidErr = scenes.filter((s) => s.vidStatus === 'error').length
  const vidLoading = scenes.filter((s) => s.vidStatus === 'loading').length
  const audioDone = scenes.filter((s) => s.audioStatus === 'done').length
  const audioErr = scenes.filter((s) => s.audioStatus === 'error').length
  const audioLoading = scenes.filter((s) => s.audioStatus === 'loading').length

  let summary = `\n\n## Current Project State\nStage: ${stage} | Scenes: ${scenes.length} total`
  summary += ` | Images: ${imgDone} done`
  if (imgLoading) summary += `, ${imgLoading} loading`
  if (imgErr) summary += `, ${imgErr} error`
  summary += ` | Videos: ${vidDone} done`
  if (vidLoading) summary += `, ${vidLoading} loading`
  if (vidErr) summary += `, ${vidErr} error`
  summary += ` | Audio: ${audioDone} done`
  if (audioLoading) summary += `, ${audioLoading} loading`
  if (audioErr) summary += `, ${audioErr} error`
  summary += '\n'

  scenes.forEach((s, i) => {
    const text = s.sentence?.length > 50 ? s.sentence.slice(0, 50) + '...' : s.sentence
    summary += `[${i + 1}] "${text}" — img:${s.imgStatus}, vid:${s.vidStatus}, aud:${s.audioStatus || 'pending'}\n`
  })

  return summary
}

export const IMAGE_POLL_INTERVAL = 4000
export const IMAGE_POLL_MAX_ATTEMPTS = 60
export const IMAGE_BATCH_SIZE = 3

export const VIDEO_POLL_INTERVAL = 5000
export const VIDEO_POLL_MAX_ATTEMPTS = 120
export const VIDEO_BATCH_SIZE = 3

export const ELEVENLABS_DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB' // "Adam" narration voice
export const ELEVENLABS_MODEL_ID = 'eleven_multilingual_v2'
export const AUDIO_BATCH_SIZE = 3

export const STORAGE_KEY = 'vp-api-keys'
