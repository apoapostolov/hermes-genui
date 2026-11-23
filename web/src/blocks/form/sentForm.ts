// A form's "sent" state, saved with its board through the checklist's board state (GET and PUT /blocks/<id>/state),
// under the form's place in the board: {"1": {sent: true, values: {pace: "Packed", who: "Asha"}}}. So after a reload,
// or on another device, the form shows as sent with the answers it sent, and can't be sent twice.
// The saved values are only shown, never sent, and each is checked against the form before it is drawn.
import { onStep, TEXT_VALUE, type FormBlock, type FormField } from "./read";
import { startingValues, type FormValue, type FormValues } from "./formMessage";

export type SentRecord = { sent: true; values: FormValues };

/** What is saved when the user presses Send.  {where: "Beach"} → {sent: true, values: {where: "Beach"}} */
export function sentRecord(values: FormValues): SentRecord {
  return { sent: true, values: { ...values } };
}

/**
 * The answers a saved record says the form was sent with, or null when it doesn't say the form was sent. Each answer
 * that fits its field is kept; anything else (an unknown option, a slider out of range, text too long, a key that
 * isn't a field) gives way to the field's starting value.
 *   {sent: true, values: {where: "Beach", spend: 99}} with spend 5-30 → {where: "Beach", spend: 30, ...starting values}
 *   {sent: true} → the starting values;  {values: {...}} or "sent" or undefined → null
 */
export function readSent(saved: unknown, form: FormBlock): FormValues | null {
  if (!saved || typeof saved !== "object" || (saved as { sent?: unknown }).sent !== true) return null;
  const given = (saved as { values?: unknown }).values;
  const values = startingValues(form);
  if (!given || typeof given !== "object" || Array.isArray(given)) return values;
  for (const field of form.fields) {
    if (!Object.prototype.hasOwnProperty.call(given, field.id)) continue;
    const kept = fitting(field, (given as Record<string, unknown>)[field.id]);
    if (kept !== undefined) values[field.id] = kept;
  }
  return values;
}

/** A saved DRAFT (what the reader was typing before Send), as answers the form can show;
 *  null when it isn't an answers object. Each fitting answer is kept, the rest start from the model's words. */
export function draftFits(saved: unknown, form: FormBlock): FormValues | null {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return null;
  const given = saved as Record<string, unknown>;
  const values = startingValues(form);
  for (const field of form.fields) {
    if (!Object.prototype.hasOwnProperty.call(given, field.id)) continue;
    const kept = fitting(field, given[field.id]);
    if (kept !== undefined) values[field.id] = kept;
  }
  return values;
}

/** A saved answer if it fits the field, else undefined.
 *  radio "Packed" with options Easy, Packed → "Packed";  radio "Mars" → undefined;  checkbox ["b", "a", "b"] with
 *  options a, b → ["a", "b"];  slider 99 (5-30) → 30;  text "Asha" → "Asha";  text of 600 characters → undefined */
function fitting(field: FormField, value: unknown): FormValue | undefined {
  if (field.kind === "slider") return typeof value === "number" && isFinite(value) ? onStep(value, field.min, field.max, field.step) : undefined;
  if (field.kind === "text") return typeof value === "string" && value.length <= TEXT_VALUE ? value : undefined;
  const options = field.options.map((o) => o.value);
  if (field.kind === "checkbox") {
    if (!Array.isArray(value)) return undefined;
    return options.filter((o) => value.includes(o));
  }
  if (value === null) return null;
  return typeof value === "string" && options.includes(value) ? value : undefined;
}
