import { createSignal, For, Show, onMount } from "solid-js";

interface DepStatus {
  name: string;
  installed: boolean;
  installing: boolean;
  error?: string;
}

export function App() {
  const platform = window.electronAPI?.platform ?? navigator.platform;
  const [deps, setDeps] = createSignal<DepStatus[]>([]);
  const [checking, setChecking] = createSignal(true);

  onMount(() => {
    window.electronAPI?.onDepsStatus((statuses) => {
      setDeps(statuses);
      setChecking(false);
    });
  });

  const allInstalled = () =>
    deps().length > 0 && deps().every((d) => d.installed);

  const hasErrors = () => deps().some((d) => d.error);

  return (
    <main class="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_15%_15%,#ffdca9_0,transparent_30%),radial-gradient(circle_at_80%_85%,#ffc0a9_0,transparent_28%),#f4efe7] px-8 py-8 text-[#171413]">
      <section class="w-full max-w-[680px] rounded-[22px] border border-[#d8cec0] bg-[#fffcf7]/90 p-9 shadow-[0_24px_44px_rgba(56,36,21,0.14)]">
        <p class="m-0 text-[0.72rem] uppercase tracking-[0.1em] text-[#ca4c2f]">
          Setup
        </p>
        <h1 class="mt-2 mb-0 text-[clamp(1.8rem,4vw,2.7rem)] leading-[1.05]">
          Dependency Check
        </h1>

        <Show when={checking()}>
          <p class="mt-3 mb-6 text-[#5a4f45]">Checking dependencies...</p>
        </Show>

        <Show when={!checking()}>
          <Show when={allInstalled()}>
            <p class="mt-3 mb-6 text-[#2d7a3a] font-medium">
              All dependencies are installed.
            </p>
          </Show>
          <Show when={!allInstalled()}>
            <p class="mt-3 mb-6 text-[#5a4f45]">
              {hasErrors()
                ? "Some dependencies could not be installed."
                : "Installing missing dependencies..."}
            </p>
          </Show>
        </Show>

        <div class="mt-4 space-y-3">
          <For each={deps()}>
            {(dep) => (
              <div class="flex items-center justify-between border-b border-[#d8cec0] pb-2">
                <span class="text-[0.95rem]">{dep.name}</span>
                <span
                  class={`text-[0.95rem] ${
                    dep.installed
                      ? "text-[#2d7a3a]"
                      : dep.error
                        ? "text-[#c0392b]"
                        : "text-[#5a4f45]"
                  }`}
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

        <Show when={hasErrors()}>
          <div class="mt-4 rounded-lg bg-[#fdf0ee] p-4">
            <For each={deps().filter((d) => d.error)}>
              {(dep) => (
                <p class="text-[0.82rem] text-[#c0392b] mt-1">
                  <strong>{dep.name}:</strong> {dep.error}
                </p>
              )}
            </For>
          </div>
        </Show>

        <div class="mt-6 flex items-center justify-between border-t border-[#d8cec0] pt-4 text-[0.95rem]">
          <span>Platform</span>
          <strong class="text-[1.05rem]">{platform}</strong>
        </div>
      </section>
    </main>
  );
}
