import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { X } from "lucide-react";
import { money } from "./finance";
export const currency = (value: number | null | undefined) =>
  value === null || value === undefined ? "Não informado" : money(value);
export const count = (value: number | null) =>
  value === null ? "Não informado" : value.toLocaleString("pt-BR");
export const unit = (value: number | null) =>
  value === null
    ? "Não apurado"
    : "R$ " +
      (value / 100).toLocaleString("pt-BR", {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      });
export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={"pill " + tone}>{children}</span>;
}
export function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}
export function Section({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-title">
        <h2>{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
export type Field = {
  name: string;
  label: string;
  type?:
    | "text"
    | "date"
    | "number"
    | "money"
    | "decimal"
    | "textarea"
    | "select"
    | "checkbox";
  value?: string | number | boolean | null;
  required?: boolean;
  options?: { value: string; label: string }[];
  hint?: string;
  min?: number;
  step?: string;
};
export type Editor = {
  title: string;
  fields: Field[];
  description?: ReactNode;
  save: (v: Record<string, string | number | boolean | null>) => Promise<void>;
};
export const options = (
  items: { id: string; name: string }[],
  empty = "Não vinculado",
) => [
  { value: "", label: empty },
  ...items.map((x) => ({ value: x.id, label: x.name })),
];
export const select = (
  name: string,
  label: string,
  value: string,
  values: Record<string, string>,
): Field => ({
  name,
  label,
  type: "select",
  value,
  options: Object.entries(values).map(([value, label]) => ({ value, label })),
});
export function Dialog({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    const values: Record<string, string | number | boolean | null> = {};
    for (const field of editor.fields) {
      const raw = String(data.get(field.name) ?? "");
      values[field.name] =
        field.type === "checkbox"
          ? data.has(field.name)
          : ["number", "money", "decimal"].includes(field.type ?? "")
            ? raw === ""
              ? null
              : field.type === "money"
                ? Math.round(Number(raw) * 100)
                : Number(raw)
            : raw;
    }
    try {
      await editor.save(values);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="editor"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <form onSubmit={submit}>
        <header>
          <h2>{editor.title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Fechar"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {editor.description && (
          <div className="notice">{editor.description}</div>
        )}
        <div className="form-grid">
          {editor.fields.map((f) => (
            <label key={f.name} className={f.type === "textarea" ? "wide" : ""}>
              {f.type === "checkbox" ? (
                <>
                  <input
                    name={f.name}
                    type="checkbox"
                    defaultChecked={!!f.value}
                  />
                  {f.label}
                </>
              ) : (
                <>
                  <span>
                    {f.label}
                    {f.required ? " *" : ""}
                  </span>
                  {f.type === "select" ? (
                    <select
                      name={f.name}
                      defaultValue={String(f.value ?? "")}
                      required={f.required}
                    >
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea
                      name={f.name}
                      defaultValue={String(f.value ?? "")}
                      maxLength={2000}
                      required={f.required}
                    />
                  ) : (
                    <input
                      name={f.name}
                      type={
                        ["money", "decimal"].includes(f.type ?? "")
                          ? "number"
                          : (f.type ?? "text")
                      }
                      defaultValue={
                        f.value === null || f.value === undefined
                          ? ""
                          : f.type === "money"
                            ? Number(f.value) / 100
                            : String(f.value)
                      }
                      min={
                        ["number", "money", "decimal"].includes(f.type ?? "")
                          ? (f.min ?? 0)
                          : undefined
                      }
                      step={
                        f.step ??
                        (f.type === "money"
                          ? "0.01"
                          : f.type === "decimal"
                            ? "0.0001"
                            : "1")
                      }
                      required={f.required}
                      maxLength={f.type === "text" ? 500 : undefined}
                    />
                  )}
                </>
              )}
              {f.hint && <small>{f.hint}</small>}
            </label>
          ))}
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <footer>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button>
        </footer>
      </form>
    </dialog>
  );
}

