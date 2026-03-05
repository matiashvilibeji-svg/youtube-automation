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

## Scene References with @N
Users can reference specific scenes by typing @1, @2, @3 etc. in their message. When a user mentions @N, they are referring to scene N. The full current data for those scenes (sentence, image prompt, Kling prompt) will be appended to their message automatically.

When you see a scene reference:
- Focus your changes ONLY on the referenced scene(s)
- Use the \`update_scenes\` tool to apply changes
- Only modify what the user asked to change — keep everything else the same
- If the user says "@1 make the lighting warmer", update ONLY scene 1's image prompt to have warmer lighting

You may include a short text message alongside any tool call, but data MUST go through the tool, not in a text/code block.

## Script Editing Rules
When the user wants to modify an existing script:
- Use \`update_scenes\` for targeted changes (changing specific scenes, tweaking prompts, adjusting tone). This is preferred.
- Use \`generate_script_only\` only when the user wants a complete rewrite of the entire script.
- In your text response, briefly explain what you changed and why.
- Only modify the fields the user asked to change — don't rewrite fields that weren't mentioned.

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
  { id: 'audio', label: 'Audio', num: 5 },
  { id: 'done', label: 'Done', num: 6 },
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
    summary += `[${i + 1}] "${s.sentence || ''}" — img:${s.imgStatus}, vid:${s.vidStatus}, aud:${s.audioStatus || 'pending'}\n`
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

export const ELEVENLABS_MODELS = [
  { id: 'eleven_multilingual_v2', label: 'Multilingual v2' },
  { id: 'eleven_turbo_v2_5', label: 'Turbo v2.5' },
  { id: 'eleven_flash_v2_5', label: 'Flash v2.5' },
  { id: 'eleven_v3', label: 'v3' },
]

export const ELEVENLABS_VOICES = [
  { voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', category: 'premade' },
  { voice_id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', category: 'premade' },
  { voice_id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', category: 'premade' },
  { voice_id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', category: 'premade' },
  { voice_id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill', category: 'premade' },
  { voice_id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', category: 'premade' },
  { voice_id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum', category: 'premade' },
  { voice_id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', category: 'premade' },
  { voice_id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', category: 'premade' },
  { voice_id: 'iP95p4xoKVk53GoZ742B', name: 'Chris', category: 'premade' },
  { voice_id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', category: 'premade' },
  { voice_id: 'CYw3kZ02Hs0563khs1Fj', name: 'Dave', category: 'premade' },
  { voice_id: 'ThT5KcBeYPX3keUQqHPh', name: 'Dorothy', category: 'premade' },
  { voice_id: '29vD33N1CtxCmqQRPOHJ', name: 'Drew', category: 'premade' },
  { voice_id: 'LcfcDJNUP1GQjkzn1xUU', name: 'Emily', category: 'premade' },
  { voice_id: 'g5CIjZEefAph4nQFvHAz', name: 'Ethan', category: 'premade' },
  { voice_id: 'D38z5RcWu1voky8WS1ja', name: 'Fin', category: 'premade' },
  { voice_id: 'jsCqWAovK2LkecY7zXl4', name: 'Freya', category: 'premade' },
  { voice_id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', category: 'premade' },
  { voice_id: 'jBpfuIE2acCO8z3wKNLl', name: 'Gigi', category: 'premade' },
  { voice_id: 'zcAOhNBS3c14rBihAFp1', name: 'Giovanni', category: 'premade' },
  { voice_id: 'z9fAnlkpzviPz146aGWa', name: 'Glinda', category: 'premade' },
  { voice_id: 'oWAxZDx7w5VEj9dCyTzz', name: 'Grace', category: 'premade' },
  { voice_id: 'SOYHLrjzK2X1ezoPC6cr', name: 'Harry', category: 'premade' },
  { voice_id: 'ZQe5CZNOzWyzPSCn5a3c', name: 'James', category: 'premade' },
  { voice_id: 'bVMeCyTHy58xNoL34h3p', name: 'Jeremy', category: 'premade' },
  { voice_id: 't0jbNlBVZ17f02VDIeMI', name: 'Jessie', category: 'premade' },
  { voice_id: 'Zlb1dXrM653N07WRdFW3', name: 'Joseph', category: 'premade' },
  { voice_id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', category: 'premade' },
  { voice_id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', category: 'premade' },
  { voice_id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', category: 'premade' },
  { voice_id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', category: 'premade' },
  { voice_id: 'flq6f7yk4E4fJM5XTYuZ', name: 'Michael', category: 'premade' },
  { voice_id: 'zrHiDhphv9ZnVXBqCLjz', name: 'Mimi', category: 'premade' },
  { voice_id: 'piTKgcLEGmPE4e6mEKli', name: 'Nicole', category: 'premade' },
  { voice_id: 'ODq5zmih8GrVes37Dizd', name: 'Patrick', category: 'premade' },
  { voice_id: '5Q0t7uMcjvnagumLfvZi', name: 'Paul', category: 'premade' },
  { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', category: 'premade' },
  { voice_id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', category: 'premade' },
  { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', category: 'premade' },
  { voice_id: 'pMsXgVXv3BLzUgSXRplE', name: 'Serena', category: 'premade' },
  { voice_id: 'GBv7mTt0atIp3Br8iCZE', name: 'Thomas', category: 'premade' },
]

export const STORAGE_KEY = 'vp-api-keys'
export const VOICE_STORAGE_KEY = 'vp-voice-settings'
