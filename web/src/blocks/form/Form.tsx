// A form in a reply: the user changes the model's prefilled answers and presses Send, which sends one plain message
// (formMessage.ts) as the user. A form is sent once; then it greys out with the choices still showing and "✓ Sent".
// Inside a `::blocks` tag the sent state is saved with the board (sentForm.ts), so it stays sent after a reload.
// Both answers live on the BOARD, keyed by the form's identity — the unsent draft the reader is typing (filed from
// the keystroke) and the sent record (positionally until an update makes the board living). An update that moves the
// form, a reopen of the board, a reload: the form comes back as the reader left it, and a different form wearing the
// vacated position reads nothing of it.
import { useContext } from "react";
import { BlockActions } from "../../host/actions";
import { useStoredValue } from "../../core/blockState";
import { formatWithUnit } from "../../lib/format";
import { TEXT_VALUE, type CheckboxField, type ChoiceField, type FormBlock, type FormField, type FormOption } from "./read";
import { InlineText } from "../../lib/InlineText";
import { answerMessage, canSend, startingValues, startsGroup, type FormValue, type FormValues } from "./formMessage";
import { draftFits, readSent, sentRecord, type SentRecord } from "./sentForm";

export function Form(form: FormBlock) {
  const { send } = useContext(BlockActions);
  const [draft, writeDraft] = useStoredValue<FormValues>({
    door: "identity", field: "~v",
    initial: () => startingValues(form),
    revive: (saved) => draftFits(saved, form),
    stored: (value) => value,
  });
  const [record, setRecord] = useStoredValue<SentRecord | null>({
    path: form.path, door: "always",
    initial: () => null,
    revive: (saved) => (readSent(saved, form) !== null ? (saved as SentRecord) : null),
    stored: (value) => value,
  });
  const sent = record !== null;                       // a Send pressed before the door answers stays sent:
  const answers = record !== null ? readSent(record, form) : null;  // the local record is the newest truth
  const values = answers ?? draft;
  const ready = canSend(form, values, sent);
  function onSend() {
    if (!ready) return;
    setRecord(sentRecord(values));  // saved as the message goes
    send(answerMessage(form, values));
  }
  return (
    <form className={sent ? "hb-card hb-form hb-form-sent" : "hb-card hb-form"} aria-disabled={sent}
      onSubmit={(e) => { e.preventDefault(); onSend(); }}>
      {form.title && <div className="hb-card-title"><InlineText text={form.title} /></div>}
      <fieldset disabled={sent}>
        {form.fields.map((field, i) => (
          <div key={field.id}>
            {startsGroup(form.fields, i) && <div className="hb-form-group"><InlineText text={field.group!} /></div>}
            <FieldView field={field} value={values[field.id]}
              onChange={(v) => writeDraft({ ...values, [field.id]: v })} />
          </div>
        ))}
      </fieldset>
      <div className="hb-form-foot">
        {sent && <span className="hb-form-done">✓ Sent</span>}
        <button type="submit" className="hb-pill hb-pill-solid" disabled={!ready}>{form.submit}</button>
      </div>
    </form>
  );
}

function FieldView({ field, value, onChange }: { field: FormField; value: FormValue | undefined; onChange: (v: FormValue) => void }) {
  if (field.kind === "slider") {
    const at = typeof value === "number" ? value : field.value;
    return (
      <label className="hb-form-field">
        <span className="hb-calc-head">
          <span className="hb-calc-label"><InlineText text={field.label} /></span>
          <span className="hb-calc-value">{formatWithUnit(at, field.unit)}</span>
        </span>
        <input type="range" className="hb-range" min={field.min} max={field.max} step={field.step} value={at}
          onChange={(e) => onChange(Number(e.target.value))} />
        {field.ends && <span className="hb-form-ends"><span>{field.ends[0]}</span><span>{field.ends[1]}</span></span>}
      </label>
    );
  }
  if (field.kind === "text") {
    const text = typeof value === "string" ? value : "";
    const props = { className: "hb-input", value: text, maxLength: TEXT_VALUE, placeholder: field.placeholder };
    return (
      <label className="hb-form-field">
        <span className="hb-form-label"><InlineText text={field.label} /></span>
        {field.multiline
          ? <textarea {...props} rows={3} onChange={(e) => onChange(e.target.value)} />
          : <input type="text" {...props} onChange={(e) => onChange(e.target.value)} />}
      </label>
    );
  }
  if (field.kind === "select") {
    const chosen = field.options.find((o) => o.value === value);
    return (
      <label className="hb-form-field">
        <span className="hb-form-label"><InlineText text={field.label} /></span>
        <select className="hb-input" value={chosen ? chosen.value : ""} onChange={(e) => onChange(e.target.value)}>
          {!chosen && <option value="" disabled>Choose…</option>}
          {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {chosen?.note && <span className="hb-form-note">{chosen.note}</span>}
      </label>
    );
  }
  return <Pills field={field} value={value} onChange={onChange} />;
}

/** Radio and checkbox options as pills, each with its note under its label. A radio tap picks that option; a checkbox
 *  tap ticks or unticks it, keeping the ticked ones in the options' order.
 *  checkbox [Music] tap "Food stops" → [Music, Food stops];  tap "Music" → [] */
function Pills({ field, value, onChange }: { field: ChoiceField | CheckboxField; value: FormValue | undefined; onChange: (v: FormValue) => void }) {
  const isRadio = field.kind === "radio";
  const picked = isRadio ? [String(value ?? "")] : Array.isArray(value) ? value : [];
  function tap(option: FormOption) {
    if (isRadio) return onChange(option.value);
    const ticked = picked.includes(option.value) ? picked.filter((v) => v !== option.value) : [...picked, option.value];
    onChange(field.options.map((o) => o.value).filter((v) => ticked.includes(v)));
  }
  return (
    <div className="hb-form-field" role={isRadio ? "radiogroup" : "group"} aria-label={field.label}>
      <span className="hb-form-label"><InlineText text={field.label} /></span>
      <div className="hb-options">
        {field.options.map((o) => {
          const on = picked.includes(o.value);
          return (
            <button key={o.value} type="button" role={isRadio ? "radio" : "checkbox"} aria-checked={on} onClick={() => tap(o)}
              className={on ? "hb-option hb-option-on" : "hb-option"}>
              {o.label}
              {o.note && <span className="hb-option-note">{o.note}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
