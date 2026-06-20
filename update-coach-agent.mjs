import { readFileSync } from "node:fs";

const rootEnv = readFileSync("../../.env", "utf8");
const key = rootEnv.match(/^ELEVENLABS_API_KEY=(.+)$/m)?.[1]?.trim();
const agentId = readFileSync(".env.local", "utf8").match(/^COACH_AGENT_ID=(.+)$/m)?.[1]?.trim();
if (!key || !agentId) { console.error("missing key or agent id"); process.exit(1); }

const PROMPT = `You are an upbeat, concise Atomic Habits coach. You help the user FULLY set up one habit through a short spoken conversation, proposing concrete values and filling the on-screen form live as you go.

SITUATION (read this first): {{habit_context}}

Continuity rule: If the situation says the habit already exists, you are CONTINUING earlier work — do NOT start over and do NOT re-ask fields that are already filled. Acknowledge what's there in one line, then focus on what's still missing or on strengthening it (environment cues, a temptation bundle, an accountability contract). Only revisit a core field if the user asks. If the situation says it's a brand-new habit, walk the full flow below.

Core rules:
- Ask ONE short question at a time (1-2 sentences). Be warm and encouraging, never lecture.
- Whenever the user gives (or you propose) a value, IMMEDIATELY call the matching tool so the field fills in on screen, then confirm in a few words and move on.
- If the user is vague, PROPOSE a sensible specific value and confirm it. Never leave a field blank, never skip ahead.

For a brand-new habit, walk through ALL of these in order, each via set_field(field, value):
1. name — the habit itself
2. type — exactly "good", "bad", or "neutral"
3. cue — the trigger, ideally "after [an existing routine]"
4. craving — why they want it / what makes it attractive
5. response — the actual action, kept easy
6. reward — the immediate payoff
7. intention_time — 24-hour HH:MM
8. intention_location — where
9. gateway_text — the 2-minute version ("so easy you can't say no")
10. visibility — "private", or "connections" if they want a friend to be able to follow it

Then offer to make it stronger and, if they're up for it, use:
- add_environment(text, kind): kind "obvious" (make a good cue visible, e.g. "lay running shoes by the door") or "friction" (make a bad habit harder).
- add_bundle(want): pair the habit with something they enjoy (a podcast, a treat).
- set_contract(commitment, stake, consequence, partner): an accountability contract.

Finish by summarizing the habit in one encouraging sentence and telling them to review and save on screen. If the user directly asks for any specific part, just do that part.`;

// The opening line is supplied per-screen via the coach_opening dynamic variable
// (new-habit screen vs. "strengthen this existing habit" detail screen).
const FIRST = "{{coach_opening}}";

const obj = (props, required) => ({ type: "object", properties: props, required });
const S = (description) => ({ type: "string", description });
const tools = [
  { type: "client", name: "set_identity", description: "Fill the identity fields (who they want to become).", parameters: obj({ name: S("short identity label e.g. Runner"), statement: S("an 'I am a ...' statement") }, ["name", "statement"]), expects_response: false },
  { type: "client", name: "set_field", description: "Fill one habit field. field is one of: name, type, cue, craving, response, reward, intention_time, intention_location, gateway_text, visibility.", parameters: obj({ field: S("the field name"), value: S("the value") }, ["field", "value"]), expects_response: false },
  { type: "client", name: "add_environment", description: "Add an environment-design item to the habit.", parameters: obj({ text: S("what to set up or remove"), kind: S("'obvious' or 'friction'") }, ["text", "kind"]), expects_response: false },
  { type: "client", name: "add_bundle", description: "Add a temptation bundle (something they want, paired with the habit).", parameters: obj({ want: S("the enjoyable thing to pair") }, ["want"]), expects_response: false },
  { type: "client", name: "set_contract", description: "Fill the accountability contract.", parameters: obj({ commitment: S("the commitment"), stake: S("what's on the line"), consequence: S("if they slip"), partner: S("accountability partner name") }, ["commitment"]), expects_response: false },
];

const body = {
  conversation_config: {
    agent: {
      prompt: { prompt: PROMPT, tools },
      first_message: FIRST,
      language: "en",
      dynamic_variables: {
        dynamic_variable_placeholders: {
          coach_opening:
            "Hey! I'm your habits coach — let's design one habit that actually sticks, and I'll fill it in as we talk. First: what's the habit you want to build?",
          habit_context: "A brand-new habit — nothing is filled in yet.",
        },
      },
    },
    tts: { voice_id: "21m00Tcm4TlvDq8ikWAM" },
  },
};

const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
  method: "PATCH",
  headers: { "xi-api-key": key, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const text = await res.text();
console.log(res.status, res.ok ? "agent updated ✅" : text.slice(0, 500));
