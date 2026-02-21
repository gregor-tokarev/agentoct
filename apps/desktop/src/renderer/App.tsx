import { createSignal, For, Show, onCleanup, onMount } from "solid-js";
import { BrowserPanel } from "./BrowserPanel";

interface DepStatus {
  name: string;
  installed: boolean;
  installing: boolean;
  error?: string;
}

export function App() {
  const platform = window.electronAPI?.platform ?? navigator.platform;
  const [browserUrl, setBrowserUrl] = createSignal<string | null>(null);
  const [urlInput, setUrlInput] = createSignal("");
  const [deps, setDeps] = createSignal<DepStatus[]>([]);
  const [checking, setChecking] = createSignal(true);

  onMount(() => {
    const cleanupNavigate = window.electronAPI?.onNavigateToUrl(
      (url: string) => {
        setBrowserUrl(url);
      },
    );

    const cleanupDeps = window.electronAPI?.onDepsStatus((statuses) => {
      setDeps(statuses);
      setChecking(false);
    });

    onCleanup(() => {
      cleanupNavigate?.();
      cleanupDeps?.();
    });
  });

  const allInstalled = () =>
    deps().length > 0 && deps().every((dep) => dep.installed);

  const hasErrors = () => deps().some((dep) => dep.error);

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
            <p class="mt-3 mb-4 text-[#5a4f45]">
              Browser view is rendered with Solid and styled by Tailwind.
            </p>

            <div class="mb-6 rounded-lg border border-[#e7ddcf] bg-[#fff8ef] p-4">
              <p class="m-0 text-[0.72rem] uppercase tracking-[0.1em] text-[#ca4c2f]">
                Setup
              </p>

              <Show when={checking()}>
                <p class="mt-2 mb-0 text-[#5a4f45]">Checking dependencies...</p>
              </Show>

              <Show when={!checking()}>
                <p class="mt-2 mb-0 text-[#5a4f45]">
                  {allInstalled()
                    ? "All dependencies are installed."
                    : hasErrors()
                      ? "Some dependencies could not be installed."
                      : "Installing missing dependencies..."}
                </p>
              </Show>

              <Show when={deps().length > 0}>
                <div class="mt-3 space-y-2">
                  <For each={deps()}>
                    {(dep) => (
                      <div class="flex items-center justify-between border-b border-[#eadfce] pb-1.5 text-[0.92rem]">
                        <span>{dep.name}</span>
                        <span
                          class={
                            dep.installed
                              ? "text-[#2d7a3a]"
                              : dep.error
                                ? "text-[#c0392b]"
                                : "text-[#5a4f45]"
                          }
                        >
                          {dep.installed
                            ? "Installed"
                            : dep.installing
                              ? "Installing..."
                              : dep.error
                                ? "Failed"
                                : "Pending"}
                        </span>
                      </div>
                    )}
                  </For>
                </div>
              </Show>

              <Show when={hasErrors()}>
                <div class="mt-3 rounded-md bg-[#fdf0ee] p-3">
                  <For each={deps().filter((dep) => dep.error)}>
                    {(dep) => (
                      <p class="mt-1 text-[0.82rem] text-[#c0392b]">
                        <strong>{dep.name}:</strong> {dep.error}
                      </p>
                    )}
                  </For>
                </div>
              </Show>
            </div>

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
