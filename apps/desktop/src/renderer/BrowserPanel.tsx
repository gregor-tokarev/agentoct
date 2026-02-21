import { createSignal, createEffect, on, onMount, onCleanup } from "solid-js";

interface BrowserPanelProps {
  url: string;
  onClose: () => void;
}

export function BrowserPanel(props: BrowserPanelProps) {
  const [inputValue, setInputValue] = createSignal(props.url);
  const [loading, setLoading] = createSignal(false);
  const [canGoBack, setCanGoBack] = createSignal(false);
  const [canGoForward, setCanGoForward] = createSignal(false);
  let webviewRef: ElectronWebviewElement | undefined;

  onMount(() => {
    const wv = webviewRef;
    if (!wv) return;

    const onStartLoading = () => setLoading(true);
    const onStopLoading = () => {
      setLoading(false);
      setCanGoBack(wv.canGoBack());
      setCanGoForward(wv.canGoForward());
    };
    const onNavigate = (e: Event) =>
      setInputValue((e as unknown as { url: string }).url);
    const onNavigateInPage = (e: Event) => {
      const detail = e as unknown as { url: string; isMainFrame: boolean };
      if (detail.isMainFrame) setInputValue(detail.url);
    };

    wv.addEventListener("did-start-loading", onStartLoading);
    wv.addEventListener("did-stop-loading", onStopLoading);
    wv.addEventListener("did-navigate", onNavigate);
    wv.addEventListener("did-navigate-in-page", onNavigateInPage);

    onCleanup(() => {
      wv.removeEventListener("did-start-loading", onStartLoading);
      wv.removeEventListener("did-stop-loading", onStopLoading);
      wv.removeEventListener("did-navigate", onNavigate);
      wv.removeEventListener("did-navigate-in-page", onNavigateInPage);
    });
  });

  createEffect(
    on(
      () => props.url,
      (newUrl) => {
        if (newUrl && webviewRef) {
          webviewRef.loadURL(newUrl);
          setInputValue(newUrl);
        }
      },
      { defer: true },
    ),
  );

  const normalizeUrl = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return "https://" + trimmed;
  };

  const navigate = (rawUrl: string) => {
    const url = normalizeUrl(rawUrl);
    if (!url) return;
    webviewRef?.loadURL(url);
    setInputValue(url);
  };

  return (
    <div class="flex h-screen flex-col bg-[#f4efe7]">
      <div class="flex items-center gap-1.5 border-b border-[#d8cec0] bg-[#f4efe7] px-3 py-2">
        <button
          onClick={() => webviewRef?.goBack()}
          disabled={!canGoBack()}
          class="rounded-md px-2 py-1 text-sm text-[#5a4f45] hover:bg-[#e8e0d4] disabled:opacity-30"
          title="Back"
        >
          &larr;
        </button>
        <button
          onClick={() => webviewRef?.goForward()}
          disabled={!canGoForward()}
          class="rounded-md px-2 py-1 text-sm text-[#5a4f45] hover:bg-[#e8e0d4] disabled:opacity-30"
          title="Forward"
        >
          &rarr;
        </button>
        <button
          onClick={() =>
            loading() ? webviewRef?.stop() : webviewRef?.reload()
          }
          class="rounded-md px-2 py-1 text-sm text-[#5a4f45] hover:bg-[#e8e0d4]"
          title={loading() ? "Stop" : "Reload"}
        >
          {loading() ? "\u2715" : "\u21BB"}
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate(inputValue());
          }}
          class="flex-1"
        >
          <input
            type="text"
            value={inputValue()}
            onInput={(e) => setInputValue(e.currentTarget.value)}
            onFocus={(e) => e.currentTarget.select()}
            class="w-full rounded-lg border border-[#d8cec0] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#ca4c2f]"
            placeholder="Enter URL..."
          />
        </form>
        <button
          onClick={props.onClose}
          class="rounded-md px-2 py-1 text-sm text-[#5a4f45] hover:bg-[#e8e0d4]"
          title="Close browser"
        >
          &times;
        </button>
      </div>

      <webview
        ref={webviewRef}
        src={props.url}
        style={{ flex: "1", width: "100%", height: "100%" }}
      />
    </div>
  );
}
