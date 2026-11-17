---
name: personal-assistant
description: "Set up the user's personal assistant: a scheduled check of mail and calendar every 30 minutes that files bills, orders, events and replies owed, suggests or takes actions, and shows them on the Today page. Use for personal dashboard, be my assistant, watch my mail."
version: 0.1.0
platforms: [linux, macos, windows]
---
# Personal assistant

Use this when someone asks for a **personal dashboard** or a **personal assistant**, or to have their mail and
calendar watched ("create my personal dashboard", "be my assistant", "watch my mail and calendar"). It turns Hermes
proactive: a scheduled check reads mail and calendar every 30 minutes, files what needs the user, suggests what to do
or does the safe parts itself, and remembers each item until it is closed. The Today page in the sidebar shows
what's coming up, what needs the user and what was handled.

## Steps

1. **See what's there:** call `assistant_setup` with `show`. If it's already set up, say so and offer to change the
   interval or stop it (below).

```text
{"tool": "assistant_setup", "args": {"action": "show"}}
```

2. **Find the mail and calendar.** Of the MCP servers `show` named, the one whose tools read mail and a calendar
   (gmail has `gmail_search` and `calendar_list_events`) is the user's own: propose it, saying its name. Offer the
   **demo** (sample mail and calendar) only when there's no such server or the user asks to try it with sample data,
   and never present demo mail as the user's own. Say that each check sends the new mail to the profile's model.
3. **Save the choice:** `assistant_setup` with `set`, the server's name (or `"demo"`) and `ideas: true` unless the user
   said no to prepared ideas (photo ideas for birthdays and guests, each bill's own payment page; found by a separate
   job that never reads mail). It returns the exact arguments for the scheduled check, and for the ideas job.

```text
{"tool": "assistant_setup", "args": {"action": "set", "source": "gmail", "ideas": true}}
```

4. **Create the scheduled check** (and the ideas job, if returned; don't run that one) with `cronjob_manage`, passing
   the returned arguments unchanged (every 30 minutes,
   only the assistant's tools and the mail server's, nothing posted to chat). For the demo they look like this:

```text
{"tool": "cronjob_manage", "args": {"action": "create", "name": "Personal assistant check", "schedule": "30m", "prompt": "Run the personal assistant check: follow the assistant-check skill. Read new mail and the calendar with assistant_inbox and assistant_calendar, then record everything with one assistant_report call.", "skills": ["hermes-genui:assistant-check"], "enabled_toolsets": ["hermes_genui_assistant", "no_mcp"], "deliver": "local", "monitor": "hermes-genui-assistant.py"}}
```

5. **Run it once now**, with the job id the create call returned, so the dashboard fills straight away:

```text
{"tool": "cronjob_manage", "args": {"action": "run", "job_id": "<the new job's id>"}}
```

6. **Put the assistant on Today.** Call `dashboard` `show` first. If the user has a Today page, keep everything on it
   (greeting, work sections, extras) and only add what it lacks: the sky band, Up next and `assistant.today`. With
   none yet, use Today's shape: the sky band for their city, Up next, then Needs you / Handled with Prepared for you;
   no summary row and no Needs you checklist:

```text
{"tool": "dashboard", "args": {"action": "set", "spec": {"title": "Today", "greeting": true, "name": "Sam", "sections": [{"from": "today.briefing.Seattle"}, {"from": "calendar.upnext", "compact": true}, {"from": "assistant.today"}]}}}
```

7. **Tell the user** in one or two sentences: it checks every 30 minutes, and **Today** in the sidebar shows the day,
   what's coming, what needs them and what it handled (paid, renewed, delivered), with ideas it prepared. Tapping a suggestion puts it in a
   chat to send. The dashboard is made of the plugin's own blocks, so they can ask to change it ("add NVDA's month",
   "put my bills first").

## Changing it later

- "Check every hour": `cronjob_manage` with `action: "update"`, the job id and `schedule: "1h"`
  (find the id with `action: "list"`).
- "Pause the assistant": `cronjob_manage` `pause`; "start again": `resume`.
- "Stop the assistant" or "remove my dashboard": `cronjob_manage` `remove`, then `assistant_setup` `clear` and
  `dashboard` `clear`.

```text
{"tool": "assistant_setup", "args": {"action": "clear"}}
```

- **Sample mailbox only.** "Bring in the next sample mail" (or "next act"): `assistant_setup` `next` (a payment, a
  renewal and a delivery arrive), then run the check with `cronjob_manage` `run` and its id.
  "Reset the sample mailbox": `assistant_setup` `reset` (act 1 again, dated from today), then run the check.

```text
{"tool": "assistant_setup", "args": {"action": "next"}}
```

```text
{"tool": "assistant_setup", "args": {"action": "reset"}}
```

- "I paid the Xfinity bill", "that's done", "ignore the wedding invite" (dismiss): `assistant_items` with `show` to find the
  item, then `update` with `done` or `dismissed`.

```text
{"tool": "assistant_items", "args": {"action": "show"}}
```

## Rules

- The assistant never sends, pays, deletes, accepts or replies on its own. When the user asks for one of those
  ("pay the Xfinity bill"), say what it is (amount, due date) and that you can't do that yet; mark it done when they
  confirm they did it.
- Chats get one-line item summaries, never mail text. Don't ask the user to paste mail.
- Never draw blocks for setting this up, and never write HTML, a `::preview` widget or a code block for it.
