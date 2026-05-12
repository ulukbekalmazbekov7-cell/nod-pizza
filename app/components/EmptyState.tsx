type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-neutral-900/40 p-8 text-center">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {description ? <p className="mt-2 text-sm text-white/60">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
