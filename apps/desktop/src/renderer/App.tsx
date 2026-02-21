export function App() {
  const platform = window.electronAPI?.platform ?? navigator.platform;

  return (
    <main class="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_15%_15%,#ffdca9_0,transparent_30%),radial-gradient(circle_at_80%_85%,#ffc0a9_0,transparent_28%),#f4efe7] px-8 py-8 text-[#171413]">
      <section class="w-full max-w-[680px] rounded-[22px] border border-[#d8cec0] bg-[#fffcf7]/90 p-9 shadow-[0_24px_44px_rgba(56,36,21,0.14)]">
        <p class="m-0 text-[0.72rem] uppercase tracking-[0.1em] text-[#ca4c2f]">
          Electron + Solid + Tailwind
        </p>
        <h1 class="mt-2 mb-0 text-[clamp(1.8rem,4vw,2.7rem)] leading-[1.05]">
          Desktop Control Surface
        </h1>
        <p class="mt-3 mb-6 text-[#5a4f45]">
          Browser view is rendered with Solid and styled by Tailwind.
        </p>
        <div class="flex items-center justify-between border-t border-[#d8cec0] pt-4 text-[0.95rem]">
          <span>Platform</span>
          <strong class="text-[1.05rem]">{platform}</strong>
        </div>
      </section>
    </main>
  );
}
