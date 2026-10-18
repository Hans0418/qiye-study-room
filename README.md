# Qiye

An AI-powered study room that turns vague goals and existing plans into actionable, editable tasks, then connects those tasks to focused work.

**[Try the live demo](https://qiye-study-room.vercel.app)**

**Describe or paste a plan → Review AI suggestions → Adjust tasks and time → Start focused work**

Qiye is built around the moment before studying: knowing what you want to achieve, but not knowing where to start. Its core is a user-controlled AI planning workflow, supported by timers, a task inbox, and an immersive study environment.

> Portfolio MVP. Cloud AI requires sign-in and is limited to 3 requests per account and 20 across the site each day. Documentation is in English; the 24 author-supplied screenshots show the current Chinese-language interface.

<details>
<summary>Before You Start: Register, Sign In, and Choose an Avatar</summary>

Register with a nickname and an email or phone identifier, then sign in with a password. Users can choose to stay signed in for seven days, browse without signing in, and select a preset avatar or upload their own image. Cloud AI planning requires sign-in.

The demo does not verify email or phone ownership and does not provide password recovery. Use test credentials rather than a password used elsewhere.

**View sign-in, registration, and avatar selection**

<img src="docs/screenshots/account-login.png" alt="Email or phone sign-in form" width="440">

<img src="docs/screenshots/account-register.png" alt="Registration form with demo-account limitations" width="440">

<img src="docs/screenshots/account-avatar.png" alt="Preset avatar selection and custom image upload" width="440">

</details>

## AI Planning to Focused Execution

### 1. Turn a Vague Goal into Concrete Steps

Open the planning assistant and describe what you are trying to do. It proposes a task breakdown, can ask for more context, and supports follow-up adjustments before you commit to a plan.

<img src="docs/screenshots/ai-input.png" alt="Describe a learning goal to the AI planning assistant" width="720">

Review the proposed steps, edit task text and estimated durations, and ask for a smaller or more specific plan. Suggestions remain under your control: generating a plan does not automatically start a session.

<img src="docs/screenshots/ai-plan.png" alt="Review, edit, and refine an AI-generated task breakdown" width="560">

### 2. Turn an Existing Plan into Structured Tasks

Already have an assignment outline or study plan? Open **Organize an Existing Plan** from the to-do list, or **Paste an Existing Plan** in the task inbox. Paste the text and explicitly request AI recognition.

<img src="docs/screenshots/plan-import.png" alt="Paste an existing assignment plan for AI recognition" width="720">

Review the extracted titles and task details, choose dates, and adjust optional duration estimates. Arrange the selected tasks for a day or start working with them immediately.

<img src="docs/screenshots/plan-review.png" alt="Review extracted tasks, details, dates, and estimated durations" width="640">

Duration suggestions depend on the plan and available context and may be left blank. They are editable estimates, not guaranteed completion times or a learned personal productivity model.

### 3. Take the Confirmed Plan into Focused Work

Choose **Start with This Plan** to bring the confirmed steps into the study to-do list. Select a task, track its countdown alongside the Pomodoro timer, and work through the plan without switching tools.

![Confirmed AI plan in the learning scene with timed tasks](docs/screenshots/task-execution.png)

### How the AI Workflow Works

Local mode uses Ollama; cloud mode uses a fixed Doubao model through a server-side API. The model generates a structured plan; the application validates fields and steps and uses a deterministic time-allocation tool to constrain the total duration. It supports clarification when context is insufficient. User confirmation is required before execution. Cloud AI requires sign-in and has shared daily request limits. Provider-side free-quota auto-pause must remain enabled; application request limits are not billing caps.

This is a controlled planning workflow, not a general-purpose autonomous agent with unrestricted actions. It currently has no knowledge-base retrieval or web search capabilities, and improved learning efficiency has not been validated.

See [Agent Design](AGENT-DESIGN.md) for the detailed design. The core implementation is in `focus-agent.mjs`.

## The Study Session

### Set Up Your Environment

Enter from the home screen, then choose the surroundings that help you concentrate.

![Qiye home screen](docs/screenshots/home.png)

Returning users can start fresh or keep their previous goal and to-do list. The timer and assistant conversation restart for the new session.

![Start fresh or preserve the previous goal and todos](docs/screenshots/resume-session.png)

Choose from six environments: a snowy study, seaside study, morning window, rainy library, forest study, or open countryside.

![Choose a study environment](docs/screenshots/scene-selection.png)

Control music and ambient volume separately. Preview and mix rain, wind, waves, streams, leaves, fan noise, white noise, and brown noise.

![Music and environmental sound settings](docs/screenshots/sound-settings.png)

Choose a session duration and an optional goal. The setup page also offers AI planning for the selected time, so users can prepare a plan before entering the learning scene.

![Session duration and goal with an AI planning entry point](docs/screenshots/session-setup.png)

### Work with or without AI

The learning scene keeps the goal and timer visible. Pause, use focus mode, or open the to-do list without leaving the scene.

![Rainy library focus screen](docs/screenshots/focus.png)

Users can also add tasks manually, set durations, and choose which task to work on. Task details expand from the list and current goal when available; longer task text wraps.

![Manually create a task and set its duration](docs/screenshots/manual-todos.png)

### Keep Future Plans in the Task Inbox

Schedule tasks for future dates, edit their details and optional estimates, and review completed records separately.

<img src="docs/screenshots/task-inbox-calendar.png" alt="Schedule tasks by date in the task inbox" width="640">

On a day with unfinished scheduled tasks, in-app reminders reconnect the plan to action. Starting from the home reminder goes through scene selection and carries the selected tasks into the session. A first-entry learning-page reminder offers access to today's inbox.

The learning-page reminder is marked as seen when it appears, so refreshing does not show it again that day. These are in-app reminders, not background notifications or scheduled emails.

## Supporting Daily Habits

Planning and execution are the core experience. Companions, check-ins, and journaling provide optional ways to return, reflect, and track progress.

### Grow a Study Companion

Earn pet food by reaching daily focused-study milestones. Feed your companion to increase its growth value and eventually advance its growth stage. The pet profile shows days together, growth progress, stored food, and today's study progress. Food does not expire.

**View the pet backpack, feeding progress, and adoption options**

<img src="docs/screenshots/pet-backpack.png" alt="Pet backpack and current companion" width="640">

<img src="docs/screenshots/pet-growth.png" alt="Companion profile, feeding, growth, and daily food milestones" width="540">

<img src="docs/screenshots/pet-adoption.png" alt="Additional companions and adoption-slot unlock progress" width="640">


### Check In Each Day

The focus calendar supports daily check-ins and shows the current streak, total check-ins, and this month's count. After checking in, an encouragement dialog offers a route back to studying or the calendar. From a learning scene, it preserves the current scene; from home, it opens session setup.

The current encouragement is a fixed message, not a personalized daily AI-generated quote or a push notification.

**View the focus calendar and check-in encouragement**

<img src="docs/screenshots/daily-checkin.png" alt="Daily check-in calendar and study statistics" width="640">

<img src="docs/screenshots/checkin-encouragement.png" alt="Encouragement after checking in with options to study or stay in the calendar" width="640">


### Write and Revisit a Diary

Open the diary from the study environment, choose a date, and record the day's thoughts. Save the entry and revisit previous entries through a calendar, with a preview and a link to reopen the selected day.

![Diary entry point in the rainy library](docs/screenshots/diary-scene.png)

**View the diary editor and past entries**

<img src="docs/screenshots/diary-editor.png" alt="Date-based diary editor with a word count and save action" width="640">

<img src="docs/screenshots/diary-history.png" alt="Calendar of past diary entries and selected-day preview" width="640">




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
