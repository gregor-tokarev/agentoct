import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { BrowserPanel } from "./BrowserPanel";

export function App() {
  const platform = window.electronAPI?.platform ?? navigator.platform;
  const [browserUrl, setBrowserUrl] = createSignal<string | null>(null);
  const [urlInput, setUrlInput] = createSignal("");

  onMount(() => {
    const cleanup = window.electronAPI?.onNavigateToUrl((url: string) => {
      setBrowserUrl(url);
    });
    onCleanup(() => cleanup?.());
  });

  const openUrl = (raw: string) => {
    let url = raw.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    setBrowserUrl(url);
  };

  return (
    <Show
      when={browserUrl()}
      fallback={
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
            <form
              onSubmit={(e) => {
                e.preventDefault();
                openUrl(urlInput());
              }}
              class="mb-6 flex gap-2"
            >
              <input
                type="text"
                value={urlInput()}
                onInput={(e) => setUrlInput(e.currentTarget.value)}
                placeholder="Enter a URL to open..."
                class="flex-1 rounded-lg border border-[#d8cec0] bg-white px-4 py-2 text-sm outline-none focus:border-[#ca4c2f]"
              />
              <button
                type="submit"
                class="rounded-lg bg-[#ca4c2f] px-5 py-2 text-sm font-medium text-white hover:bg-[#b4412a]"
              >
                Open
              </button>
            </form>
            <div class="flex items-center justify-between border-t border-[#d8cec0] pt-4 text-[0.95rem]">
              <span>Platform</span>
              <strong class="text-[1.05rem]">{platform}</strong>
            </div>
          </section>
        </main>
      }
    >
      {(url) => (
        <BrowserPanel url={url()} onClose={() => setBrowserUrl(null)} />
      )}
    </Show>
  );
}
