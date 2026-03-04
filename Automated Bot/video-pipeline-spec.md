# Video Pipeline — Full Product Specification

## Overview

A full-stack browser-based automation tool that converts a single chat conversation into a complete YouTube Shorts video pipeline. The user chats with an AI to brainstorm and finalize a "What if you [did X] in [historical era]?" concept, then says "generate" — and the app automatically produces all script sentences, image prompts, Kling motion prompts, generates all images via Nano Banana API, and generates all videos via Kling API, displaying real-time progress in a visual scene grid.

---

## Layout

The app is a two-panel full-screen web interface.

### Left Panel — Chat (width: ~280px)
- Header bar with app logo/name ("Video Pipeline") and a settings gear icon
- Scrollable message thread (chat history)
- Text input at the bottom with a send button
- Small hint text: "Say 'generate' to start the pipeline"

### Right Panel — Pipeline (flex: 1, takes remaining space)
- Stage progress bar at the top
- Stats row showing: total scenes, images completed/total, videos completed/total
- Scrollable scene grid (auto-fill columns, min 110px per card)
- Script sentence strip at the bottom (collapsible, shows all numbered sentences)

---

## Stage Progress Bar

Five stages displayed as numbered circles with connecting lines:

```
① Ideas → ② Script → ③ Images → ④ Videos → ⑤ Done
```

- Completed stages: filled yellow circle with checkmark
- Active stage: pulsing yellow ring
- Upcoming stages: gray

---

## Chat Bot Behavior

### System Prompt Rules (Claude)

The bot is a creative director for viral YouTube Shorts. It knows the exact script style from the user's proven videos:

- **Hook**: "What if you [premise]?" then immediately "Day one."
- **Day jumps**: Not sequential. Skips days intentionally (Day 1, 3, 7, 10, 15...). Each jump = escalation.
- **Segment length**: 3–4 sentences max per day. One action. One reaction. One consequence.
- **Reframe line**: Around Day 5–7, one sentence that sounds philosophical but lands like a punchline. This is the emotional core of the video.
- **Authority figures react**: Crowd, emperor, king, bishop — their shock mirrors the protagonist's power.
- **No resolution**: Always ends on a cliffhanger or dark punchline. Never wraps up.
- **POV**: Always second person — "you."

### Regular Chat Mode
For normal conversation (brainstorming, refining ideas, making changes to script), the bot responds naturally and conversationally. No pipeline is triggered.

### Pipeline Trigger Words
When the user says any of the following, the pipeline is triggered:
- "generate"
- "start"
- "make this"
- "let's do it"
- Any confirmation that they want to create the video

### Pipeline Output Format
When triggered, Claude responds ONLY with a JSON block in this format (no other text):

```
```pipeline
{
  "sentences": [
    "[1] First key sentence.",
    "[2] Second key sentence.",
    ...
  ],
  "imagePrompts": [
    "Cinematic [angle] shot... [FULL SKELETON DESCRIPTION] [scene details]. Photorealistic, cinematic lighting, 9:16 vertical format.",
    ...
  ],
  "klingPrompts": [
    "[Character action]. [Camera movement]. [Atmosphere]. Realistic motion, 9:16 vertical.",
    ...
  ]
}
```
```

**Array rules:**
- All three arrays must be the same length
- 15–22 sentences total
- One image prompt per sentence
- One Kling prompt per sentence

---

## Script Sentence Rules

- Every single sentence in the script becomes its own numbered key sentence
- Sentences that share the same visual context and do not need a separate image are combined into one entry
- Each sentence is prefixed with its number: `[1]`, `[2]`, `[3]`...
- Sentences are the atomic unit of the pipeline — each one maps to exactly one image and one video

---

## Skeleton Character Description

This description is automatically injected into every single image prompt. It is never shortened, summarized, or referenced indirectly. It is always written in full:

> A full-body realistic humanoid SKELETON character with a semi-transparent human-shaped outer body shell. The character has: A fully exposed skull (NO skin, NO face, NO muscles) Clean, smooth, anatomically accurate skull Large, round eye sockets with visible eyeballs Bright yellow irises with dark pupils Neutral to slightly vacant expression Visible upper and lower teeth Smooth cranium with no cracks, damage, decay, or horror elements. The body is a semi-transparent, glass-like human silhouette that clearly reveals the entire internal skeletal structure from head to toe. Skeleton details: Ivory / pale beige bones Smooth, medical-grade surfaces Accurate human proportions Clearly defined rib cage, spine, pelvis, arms, hands, legs, knees, ankles, and feet All joints, vertebrae, and phalanges visible and anatomically correct.

---

## Image Prompt Rules

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

3. **Full skeleton character description** — injected in full every time

4. **Scene action** — exactly what the character is doing, their posture, what they're holding, expression

5. **Environment** — background, setting details, other characters if present

6. **End tag** — always ends with: `Photorealistic, cinematic lighting, 9:16 vertical format.`

**Camera angle philosophy:**
- The skeleton does NOT always face the camera
- Walking toward something = backshot
- Confrontation or dialogue = over the shoulder
- Establishing power = low angle looking up
- Intimate moment = close up side profile
- Showing scale/environment = wide shot

---

## Kling Prompt Rules

Each Kling prompt describes how to animate the corresponding image into a 5-second video clip. Must include:

1. **Character action** — exactly what the skeleton does during the clip (gestures, movement, reactions)
2. **Camera movement** — push in, pull back, orbit, static hold, handheld shake, slow pan, etc.
3. **Atmosphere** — sound references if relevant, lighting mood, crowd behavior in background
4. **End tag** — always ends with: `Realistic motion, 9:16 vertical.`

**Length**: 2–4 sentences per Kling prompt.

---

## Nano Banana API Integration

**Endpoint:** `POST https://nanobnana.com/api/v2/generate`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {NANO_BANANA_API_KEY}
```

**Request body:**
```json
{
  "prompt": "[full image prompt]",
  "aspect_ratio": "9:16",
  "size": "2K",
  "format": "png"
}
```

**Response:**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "task_id": "nprob71e549f645122eb8db5f75af2c11nono"
  }
}
```

Generation is asynchronous. After receiving `task_id`, poll the status endpoint.

**Status Endpoint:** `GET https://nanobnana.com/api/v2/status/{task_id}`

**Headers:**
```
Authorization: Bearer {NANO_BANANA_API_KEY}
```

**Poll until:**
```json
{
  "code": 200,
  "data": {
    "status": "completed",
    "output_url": "https://..."
  }
}
```

Poll every 4 seconds. Timeout after 60 attempts (4 minutes).

**Batching:** Generate images in parallel batches of 3 at a time to avoid rate limits.

---

## Kling API Integration

**Provider:** kie.ai

**Endpoint:** `POST https://api.kie.ai/api/v1/jobs/createTask`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {KLING_API_KEY}
```

**Request body:**
```json
{
  "model": "kling-2.1/image-to-video",
  "input": {
    "image_url": "[nano banana output image URL]",
    "prompt": "[kling motion prompt]",
    "aspect_ratio": "9:16",
    "duration": "5"
  }
}
```

**Response:**
```json
{
  "data": {
    "job_id": "abc123"
  }
}
```

**Status Endpoint:** `GET https://api.kie.ai/api/v1/jobs/{job_id}`

**Poll until status is** `"completed"` or `"succeed"`. Extract `video_url` from response.

Poll every 5 seconds. Timeout after 120 attempts (10 minutes).

**Batching:** Generate videos in parallel batches of 3 at a time.

**Important:** Video generation only starts after the corresponding image is confirmed completed (status: done).

---

## Pipeline Execution Flow

```
User says "generate"
        ↓
Claude generates pipeline JSON
(sentences + imagePrompts + klingPrompts)
        ↓
Stage: Script
Show all sentences in bottom strip
        ↓
Stage: Images
For each batch of 3 scenes:
  → POST to Nano Banana (get task_id)
  → Poll status every 4s
  → When done, show image in scene card
        ↓
Stage: Videos
For each batch of 3 scenes (image must be done):
  → POST to Kling with image URL + prompt (get job_id)
  → Poll status every 5s
  → When done, show play button on scene card
        ↓
Stage: Done
All scenes show green VID ✓ status
```

---

## Scene Card UI

Each scene is displayed as a card in a responsive grid. Card structure:

```
┌─────────────────┐
│  [scene number] │  ← badge top-left
│                 │
│   IMAGE (9:16)  │  ← fills card
│                 │
│  [▶ play btn]   │  ← only shows when video is ready (overlay)
│                 │
│ [loading spinner│  ← shows while video is being generated
│  over image]    │
├─────────────────┤
│ Sentence text   │  ← 2 lines max, gray, small
│ IMG ✓  VID ⟳   │  ← status indicators
└─────────────────┘
```

**Status indicator states:**
- `pending` → gray circle `○`
- `loading` → spinning/pulsing yellow `⟳`
- `done` → green checkmark `✓`
- `error` → red `✗`

---

## Settings Modal

Triggered by the ⚙️ icon. Contains three password input fields:

| Field | Placeholder | Where to get it |
|-------|-------------|-----------------|
| Claude API Key | `sk-ant-...` | console.anthropic.com |
| Nano Banana API Key | `nb-...` | nanobnana.com/dashboard/api-keys |
| Kling API Key | `kie-...` | kie.ai dashboard |

Keys are saved to persistent storage (`vp-api-keys`) so they survive page refreshes.

---

## Data Persistence

The app saves API keys between sessions using `window.storage` (key: `vp-api-keys`).

Project data (sentences, image/video URLs) is held in React state for the current session only. Past projects are not saved.

---

## Error Handling

| Error | Behavior |
|-------|----------|
| Claude API error | Show error message in chat |
| Image generation failed | Scene card shows ❌, imgStatus = "error", pipeline continues |
| Image generation timed out | Same as above |
| Video generation failed | Scene card shows vidStatus = "error", pipeline continues |
| Missing API key | Open settings modal automatically |

Failed scenes do not block the rest of the pipeline. Each scene is independent.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React (JSX, hooks) |
| Styling | Tailwind CSS utility classes |
| State management | useState, useCallback, useRef |
| Persistence | window.storage API |
| Claude API | anthropic.com/v1/messages (claude-sonnet-4-20250514) |
| Image API | nanobnana.com/api/v2 |
| Video API | kie.ai/api/v1 |
| Deployment | Single .jsx file, no build step required |

---

## Proven Script Examples (Style Reference for Claude)

These are examples from existing successful videos on the channel. Claude uses these as style references when generating scripts:

- *What if you used testosterone as a gladiator in ancient Rome*
- *What if you opened a casino in medieval Europe*
- *What if you opened a dental office in ancient Rome*
- *What if you had a gun in the samurai era*

**Key style elements extracted from these scripts:**
- The "reframe line" (e.g. *"You're not competing against warriors. You're competing against hungry men."*)
- Authority figure reactions (Emperor leaning forward, Bishop accepting bribe, King sliding a document)
- Endings that leave the viewer with a question (e.g. *"He wants to know what's in the vial."*)
- Day skip cadence: never consecutive, always accelerating

---

## Character Notes

The skeleton character is the consistent protagonist across all videos. Key behavior notes for Kling prompts:

- He is always calm, unbothered, and deliberate
- He never rushes or panics
- Eye contact with other characters: slow, measured turns of the skull
- In crowds: completely still while chaos happens around him
- In confrontations: does not flinch, does not stand unless necessary
- Walking away: unhurried, cloak flowing, yellow eyes forward
