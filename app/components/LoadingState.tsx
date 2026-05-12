export default function LoadingState({ label = "Загрузка…" }: { label?: string }) {
  return (
    <div className="flex min-h-[30vh] items-center justify-center rounded-2xl border border-white/10 bg-neutral-900/60 p-8 text-white/70">
      {label}
    </div>
  );
}
