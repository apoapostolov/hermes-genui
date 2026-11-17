// A form in a reply: the user changes the model's prefilled answers and presses Send, which sends one plain message
// (formMessage.ts) as the user. A form is sent once; then it greys out with the choices still showing and "✓ Sent".
// Inside a `::blocks` tag the sent state is saved with the board (sentForm.ts), so it stays sent after a reload.
import { useContext, useEffect, useRef, useState } from "react";
import { BlockActions } from "../../host/actions";
import { formatWithUnit } from "../../lib/format";
import { TEXT_VALUE, type CheckboxField, type ChoiceField, type FormBlock, type FormField, type FormOption } from "./read";
import { InlineText } from "../../lib/InlineText";
import { loadBoardState, saveBoardValue } from "../checklist/savedState";
import { answerMessage, canSend, startingValues, startsGroup, type FormValue, type FormValues } from "./formMessage";
import { readSent, sentRecord } from "./sentForm";
import { useNamed } from "../../core/a11y";

export function Form(form: FormBlock) {
  const { send } = useContext(BlockActions);
  const [values, setValues] = useState<FormValues>(() => startingValues(form));
  const [sent, markSent] = useSentForm(form, setValues);
  const ready = canSend(form, values, sent);
  const named = useNamed("form", form.title);
  function onSend() {
    if (!ready) return;
    markSent(values);  // saved as the message goes
    send(answerMessage(form, values));
  }
  return (
    <form className={sent ? "hb-card hb-form hb-form-sent" : "hb-card hb-form"} aria-disabled={sent} {...named.root}
      onSubmit={(e) => { e.preventDefault(); onSend(); }}>
      {form.title && <div id={named.title.id} className="hb-card-title"><InlineText text={form.title} /></div>}
      <fieldset disabled={sent}>
        {form.fields.map((field, i) => (
          <div key={field.id}>
            {startsGroup(form.fields, i) && <div className="hb-form-group"><InlineText text={field.group!} /></div>}
            <FieldView field={field} value={values[field.id]} onChange={(v) => setValues((all) => ({ ...all, [field.id]: v }))} />
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

/** Whether the form was sent, and how to mark it sent. With a board and a REST door (inside a `::blocks` tag) a form
 *  sent before shows as sent with the answers it sent, and Send is saved; without them (or when the server fails) the
 *  sent state just lives on screen. A Send pressed before the saved state arrives stays sent. */
function useSentForm(form: FormBlock, setValues: (values: FormValues) => void): [boolean, (values: FormValues) => void] {
  const { rest, blockId } = useContext(BlockActions);
  const [sent, setSent] = useState(false);
  const sentHere = useRef(false);
  const latest = useRef(form);
  latest.current = form;

  useEffect(() => {
    if (!rest || !blockId) return;
    let live = true;
    loadBoardState(rest, blockId).then((state) => {
      if (!live || sentHere.current) return;
      const answers = readSent(state[latest.current.path], latest.current);
      if (!answers) return;
      setValues(answers);
      setSent(true);
    });
    return () => {
      live = false;
    };
  }, [rest, blockId, form.path, setValues]);

  function markSent(values: FormValues) {
    sentHere.current = true;
    setSent(true);
    if (rest && blockId) void saveBoardValue(rest, blockId, form.path, sentRecord(values));
  }
  return [sent, markSent];
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
