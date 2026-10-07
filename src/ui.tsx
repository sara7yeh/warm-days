import { useEffect, useRef, type ReactNode } from "react";
import { X, Plus, Check, Trash2, Pencil, Leaf } from "lucide-react";
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="关闭" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Empty({
  text = "这里还空着，写下第一条吧",
  action,
  onAdd,
}: {
  text?: string;
  action?: string;
  onAdd?: () => void;
}) {
  return (
    <div className="empty">
      <Leaf size={26} />
      <p>{text}</p>
      {onAdd && (
        <button className="soft-button" onClick={onAdd}>
          <Plus size={16} />
          {action ?? "添加记录"}
        </button>
      )}
    </div>
  );
}
export function Section({
  title,
  aside,
  children,
  className = "",
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      <div className="section-heading">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
export function PageHead({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="subtitle">{description}</p>
      </div>
      {action}
    </header>
  );
}
export function AddButton({
  onClick,
  children = "新增",
}: {
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button className="primary" onClick={onClick}>
      <Plus size={18} />
      {children}
    </button>
  );
}
export function EditButtons({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="row-actions">
      <button className="icon-button" onClick={onEdit} aria-label="编辑">
        <Pencil size={15} />
      </button>
      <button
        className="icon-button danger"
        onClick={onDelete}
        aria-label="删除"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
export function CheckButton({
  checked,
  onClick,
  label,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      className={`check-button ${checked ? "checked" : ""}`}
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onClick}
    >
      {checked && <Check size={15} />}
    </button>
  );
}
export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Chart({
  points,
  unit,
  color = "#b87551",
}: {
  points: { date: string; value: number }[];
  unit: string;
  color?: string;
}) {
  if (!points.length) return <Empty text="有了记录，变化就会在这里慢慢出现" />;
  const width = 640,
    height = 190,
    pad = 32;
  const values = points.map((p) => p.value);
  const min = Math.max(
    0,
    Math.min(...values) -
      Math.max(1, (Math.max(...values) - Math.min(...values)) * 0.2),
  );
  const max =
    Math.max(...values) + Math.max(1, (Math.max(...values) - min) * 0.2);
  const first = Date.parse(points[0].date),
    last = Date.parse(points.at(-1)!.date);
  const xy = points.map((p) => ({
    x:
      points.length === 1
        ? width / 2
        : pad +
          ((Date.parse(p.date) - first) / Math.max(1, last - first)) *
            (width - pad * 2),
    y: height - pad - ((p.value - min) / (max - min)) * (height - pad * 2),
    ...p,
  }));
  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${unit}变化趋势，${points.length}条记录`}
      >
        <title>
          {points
            .map((p) => `${p.date}: ${p.value.toFixed(1)}${unit}`)
            .join("；")}
        </title>
        {[0, 0.5, 1].map((n) => (
          <g key={n}>
            <line
              x1={pad}
              y1={pad + n * (height - pad * 2)}
              x2={width - pad}
              y2={pad + n * (height - pad * 2)}
              stroke="#e9e0d6"
              strokeDasharray="4 5"
            />
            <text
              x={pad}
              y={pad + n * (height - pad * 2) - 7}
              fontSize="12"
              fill="#8c7d70"
            >
              {(max - n * (max - min)).toFixed(1)}
            </text>
          </g>
        ))}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={xy.map((p) => `${p.x},${p.y}`).join(" ")}
        />
        {xy.map((p) => (
          <circle key={p.date} cx={p.x} cy={p.y} r="4" fill={color}>
            <title>
              {p.date} · {p.value.toFixed(1)} {unit}
            </title>
          </circle>
        ))}
      </svg>
      <div className="chart-axis">
        <span>{points[0].date}</span>
        <span>{unit}</span>
        <span>{points.at(-1)!.date}</span>
      </div>
      <details className="chart-data">
        <summary>查看数据</summary>
        <div className="data-scroll">
          <table>
            <thead>
              <tr>
                <th>日期</th>
                <th>{unit}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date}>
                  <td>{p.date}</td>
                  <td>{p.value.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
