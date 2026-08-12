export function TopBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-10 border-b border-neutral-800 bg-background pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-md items-center justify-end gap-2 px-4 py-2.5">
        <img src="/lolalog-icono-1024.svg" alt="" className="h-6 w-6 rounded-md" />
        <span className="text-base font-semibold text-foreground">
          Lola<span className="text-brand-green-light">Log</span>
        </span>
      </div>
    </header>
  );
}
