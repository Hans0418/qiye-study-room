# Qiye | 栖页

An AI-powered virtual study room for people who find it hard to get started. This independently developed MVP connects task planning with focused execution, reducing the effort of manually breaking down goals and creating to-do lists before studying.

**[Open the live demo](https://qiye-study-room.vercel.app)**

> Portfolio MVP with local and cloud runtime modes. AI planning requires registration/sign-in and has daily demo limits (3 requests per account, 20 across the site). Screenshots below show the developer's local version. Selected runtime images are included; audio recordings and secrets are not.

![Qiye home screen with a snowy mountain study room](docs/screenshots/home.png)

## Product Approach

Designed for exam preparation, assignments, academic writing, and independent learning, Qiye turns broad goals into actionable steps. AI proposes a plan; users decide whether to adopt it. Generating a plan does not automatically start execution.

Core flow: **Describe a goal → Generate an AI plan → Review and adjust → Work through tasks with timers**.

- **AI task planning**: Break down natural-language goals into a to-do list with estimated durations. Edit task content, timing, and order.
- **Focus environment**: Choose study scenes, mix ambient sounds, use a Pomodoro timer, and track study sessions.
- **Shared study rooms**: Invite friends, follow the host's goal or keep a personal goal, and synchronize shared goals, task lists, and goal countdowns.
- **Study companion**: Track days together and feed a virtual pet to support its growth.

## Product Walkthrough

Updated October 17, 2026 with 24 screenshots supplied by the project author. The walkthrough covers setup, focused work, AI planning, the task inbox, companion growth, daily check-ins, journaling, and accounts.

### 1. Start Fresh or Keep Your Plan

Enter from the home screen. When a previous goal and to-do list are available, choose a fresh start or keep them for the next session. The session timer and assistant conversation restart.

<details>
<summary>View the resume choice</summary>

![Start fresh or preserve the previous goal and todos](docs/screenshots/resume-session.png)

</details>

### 2. Choose a Scene, Sound, Time, and Goal

Choose from six study environments, including the snowy study, seaside study, morning window, rainy library, forest study, and open countryside.

![Choose a study environment](docs/screenshots/scene-selection.png)

<details>
<summary>View music, ambient mixing, session time, and goal planning</summary>

Control background music and ambient volume separately. Mix rain, wind, waves, streams, leaves, fan noise, white noise, and brown noise, with individual volume controls and a preview.

![Music and environmental sound settings](docs/screenshots/sound-settings.png)

Choose a session duration and optionally describe what to work on. Start directly or use the AI planning entry point to turn the goal into a proposed plan for the selected time.

![Session time and goal with AI planning](docs/screenshots/session-setup.png)

</details>

### 3. Focus and Build Your Own To-Do List

The learning scene keeps the current goal and Pomodoro timer visible. Pause the session, use focus mode, or open the to-do list without leaving the scene.

![Rainy library focus screen](docs/screenshots/focus.png)

Add tasks manually, set their durations, and choose which task to work on. Task details can be expanded from the list and the current goal when available; longer task text wraps.

<details>
<summary>View manual task creation</summary>

![Add a task and set its duration](docs/screenshots/manual-todos.png)

</details>

### 4. Paste an Existing Plan

Use "已有计划，整理成清单" or the inbox's "粘贴已有计划" tab. Paste an existing plan and explicitly request AI recognition. Review the recognized task titles, details, dates, and optional duration estimates before arranging them for a day or starting.

AI can suggest task durations based on the plan and context; estimates remain editable and may be left blank. They are suggestions, not guaranteed completion times or a learned personal productivity model.

<details>
<summary>View plan input and editable recognition results</summary>

<img src="docs/screenshots/plan-import.png" alt="Paste a course assignment plan for AI recognition" width="720">

<img src="docs/screenshots/plan-review.png" alt="Review recognized task details, dates, and optional durations" width="640">

</details>

### 5. Ask the AI Assistant to Help You Get Started

"帮我理一理" helps turn a vague need into concrete next steps. Describe the work, review the proposed breakdown, edit tasks and estimates, and ask for adjustments. Select "按计划开始" to bring the confirmed plan into the study to-do list.

<details>
<summary>View the assistant conversation and plan review</summary>

<img src="docs/screenshots/ai-input.png" alt="Describe a vague assignment to the planning assistant" width="720">

<img src="docs/screenshots/ai-plan.png" alt="Review and adjust the assistant's proposed tasks before starting" width="560">

</details>

The confirmed tasks appear in the study scene. Select a task, track its countdown, and work through the list alongside the session timer.

![AI plan brought into the learning scene as timed todos](docs/screenshots/task-execution.png)

### 6. Plan Ahead with the Task Inbox

Choose a calendar date to create tasks in advance. Edit task details, optional estimated minutes, and dates; review completed records separately.

<img src="docs/screenshots/task-inbox-calendar.png" alt="Schedule future tasks in the calendar-based task inbox" width="640">

On a day with unfinished scheduled tasks, in-app reminders help bring them back into focus. The home reminder's start action goes through scene selection and carries the selected tasks into the session. A first-entry learning-page reminder offers access to today's inbox, where users can select tasks and start with them.

The learning-page reminder is marked as seen as soon as it appears, so refreshing without clicking does not show it again that day. Reminders are in-app, not background notifications or scheduled emails.

### 7. Grow a Study Companion

Earn pet food by reaching daily focused-study milestones. Feed your companion to increase its growth value and eventually advance its growth stage. The pet profile shows days together, growth progress, stored food, and today's study progress. Food does not expire.

<details>
<summary>View the pet backpack, feeding progress, and adoption options</summary>

<img src="docs/screenshots/pet-backpack.png" alt="Pet backpack and current companion" width="640">

<img src="docs/screenshots/pet-growth.png" alt="Companion profile, feeding, growth, and daily food milestones" width="540">

<img src="docs/screenshots/pet-adoption.png" alt="Additional companions and adoption-slot unlock progress" width="640">

</details>

### 8. Check In Each Day

The focus calendar supports daily check-ins and shows the current streak, total check-ins, and this month's count. After checking in, an encouragement dialog offers a route back to studying or the calendar. From a learning scene, it preserves the current scene; from home, it opens session setup.

The current encouragement is a fixed message, not a personalized daily AI-generated quote or a push notification.

<details>
<summary>View the focus calendar and check-in encouragement</summary>

<img src="docs/screenshots/daily-checkin.png" alt="Daily check-in calendar and study statistics" width="640">

<img src="docs/screenshots/checkin-encouragement.png" alt="Encouragement after checking in with options to study or stay in the calendar" width="640">

</details>

### 9. Write and Revisit a Diary

Open the diary from the study environment, choose a date, and record the day's thoughts. Save the entry and revisit previous entries through a calendar, with a preview and a link to reopen the selected day.

![Diary entry point in the rainy library](docs/screenshots/diary-scene.png)

<details>
<summary>View the diary editor and past entries</summary>

<img src="docs/screenshots/diary-editor.png" alt="Date-based diary editor with a word count and save action" width="640">

<img src="docs/screenshots/diary-history.png" alt="Calendar of past diary entries and selected-day preview" width="640">

</details>

### 10. Register, Sign In, and Choose an Avatar

Register with a nickname and an email or phone identifier, then sign in with a password. Users can choose to stay signed in for seven days, browse without signing in, and select a preset avatar or upload their own image. Cloud AI planning requires sign-in.

The demo does not verify email or phone ownership and does not provide password recovery. Use test credentials rather than a password used elsewhere.

<details>
<summary>View sign-in, registration, and avatar selection</summary>

<img src="docs/screenshots/account-login.png" alt="Email or phone sign-in form" width="440">

<img src="docs/screenshots/account-register.png" alt="Registration form with demo-account limitations" width="440">

<img src="docs/screenshots/account-avatar.png" alt="Preset avatar selection and custom image upload" width="440">

</details>

## AI Workflow

Local mode uses Ollama; cloud mode uses a fixed Doubao model through a server-side API. The model generates a structured plan; the application validates fields and steps and uses a deterministic time-allocation tool to constrain the total duration. It supports clarification when context is insufficient. User confirmation is required before execution. Cloud AI requires sign-in and has shared daily request limits. Provider-side free-quota auto-pause must remain enabled; application request limits are not billing caps.

This is a controlled planning workflow, not a general-purpose autonomous agent with unrestricted actions. It currently has no knowledge-base retrieval or web search capabilities, and improved learning efficiency has not been validated.

See [Agent Design](AGENT-DESIGN.md) for the detailed design. The core implementation is in `focus-agent.mjs`.

## Run Locally

Requirements: Node.js 24 and a running Ollama instance with a model installed.

1. Copy `.env.example` to `.env` and set `LOCAL_MODEL` to the name of an installed model.
2. Run this command from the project root:

```sh
node --env-file=.env server.mjs
```

3. Open the address printed in the terminal. The default is `http://127.0.0.1:8766/`.

On macOS, you can also run `zsh start-local.command`, which defaults to port 8769. The regular interface can run without a configured model, but AI planning will be unavailable. Local mode accepts local connections only. GitHub Pages cannot run this backend.

## Cloud Deployment

The cloud runtime targets Vercel with Supabase Postgres and Volcano Ark. Run `npm ci` and `npm run build`. Configure server-only environment variables using `.env.cloud.example`; never commit real values. Follow [Cloud Setup](docs/CLOUD-SETUP.md) for database migration, verified TLS, credentials, and deployment checks.

## Architecture

| Path | Responsibility |
| --- | --- |
| `outputs/study-room-mvp/` | HTML, CSS, and JavaScript frontend |
| `server.mjs` | Static files and same-origin APIs |
| `focus-agent.mjs` | Prompts, structured output validation, and time allocation |
| `auth.mjs` | Local SQLite accounts and sessions |
| `rooms.mjs` | Shared study rooms and state synchronization |
| `cloud-auth.mjs`, `cloud-rooms.mjs`, `database.mjs` | Postgres-backed cloud accounts, sessions, rooms, and request limits |
| `api/index.mjs`, `vercel.json`, `build.mjs` | Serverless API routing and allowlisted static build |

Development was primarily assisted by Codex. Ollama provides local model inference.

## Tests

Core tests that do not require a live model:

```sh
node --test server.test.mjs auth.test.mjs rooms.test.mjs ai-errors.test.mjs focus-agent.test.mjs companion-store.test.cjs companion-ui.test.mjs goal-clock.test.cjs calendar-store.test.cjs together.test.mjs task-order.test.mjs
```

`scene-effects.test.mjs` still references image-testing dependencies on the development machine and is excluded from the portable command above. Run live model evaluations separately with `node --env-file=.env agent-eval.mjs`. Passing automated tests does not establish model quality or readiness for secure public deployment.

## Current Limitations

- Local registration and sign-in are supported, but email or phone verification and password recovery are not. Use test identities; do not collect sensitive real-user information.
- The task inbox is stored in the current browser and is not account-isolated or synced across devices. Signed-in diary and study-history backup are separate features; do not assume every browser-local record follows the account.
- Local rooms are stored in server memory. Cloud rooms use Postgres with a 24-hour lifetime; mutations are serialized for this small demo, not optimized for high traffic.
- Public login, shared-room APIs, permissions, logout, runtime images, and one real AI plan passed smoke testing on October 14, 2026. Earlier AI requests failed output validation; generation may need a manual retry. This is not a model-quality evaluation or a production-readiness claim.

## Assets and Privacy

Audio files, private runtime data, and secrets are excluded from this repository. `docs/screenshots/` contains only screenshots selected by the project author for the product showcase, not reusable original scene assets. Users must supply local audio files they have the right to use. YouTube background music relies on a third-party service and does not imply permission to redistribute that music. Ambient sounds include browser-synthesized audio.

Rights to scene images, avatars, and other visual assets must be checked separately. This repository does not grant reuse or redistribution rights to third-party assets. Existing third-party license files are retained; no project-wide open-source license has been added.
