import { app, county } from "../app";
import { partyLabel, partyOf } from "../config";
import { $ } from "../dom";
import { ReplaySource } from "../model/replay";
import type { Race } from "../model/types";

export function initPlatformViewer(getRace: () => Race | null) {
  const dialog = $<HTMLDialogElement>("platform-view");
  const documentArea = $("platform-document");
  const preview = $<HTMLImageElement>("platform-image");
  const frame = $<HTMLIFrameElement>("platform-frame");
  const original = $<HTMLAnchorElement>("platform-original");
  const loading = $("platform-loading");
  const zoom = $("platform-zoom");
  const zoomOut = $<HTMLButtonElement>("platform-zoom-out");
  const zoomIn = $<HTMLButtonElement>("platform-zoom-in");
  const widths = [640, 900, 1300, 1800];
  let zoomIndex = 1;
  let trigger: HTMLButtonElement | null = null;
  let resume: ReplaySource | null = null;
  let loadTimer = 0;

  const setZoom = (index: number) => {
    const center = (documentArea.scrollLeft + documentArea.clientWidth / 2) / (preview.clientWidth || widths[zoomIndex]);
    zoomIndex = Math.max(0, Math.min(widths.length - 1, index));
    preview.style.width = `${widths[zoomIndex]}px`;
    zoomOut.disabled = zoomIndex === 0;
    zoomIn.disabled = zoomIndex === widths.length - 1;
    requestAnimationFrame(() => { documentArea.scrollLeft = center * preview.clientWidth - documentArea.clientWidth / 2; });
  };
  zoomOut.addEventListener("click", () => setZoom(zoomIndex - 1));
  zoomIn.addEventListener("click", () => setZoom(zoomIndex + 1));

  $("rows").addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-platform]");
    const race = getRace();
    if (!button || !race) return;
    const candidate = race.candidates[Number(button.dataset.platform)];
    if (!candidate?.platformUrl) return;
    trigger = button;
    const page = candidate.platformUrl.match(/#page=(\d+)/)?.[1];
    $("platform-title").textContent = candidate.platformImage ? `${candidate.name}的政見` : "選舉公報";
    const person = $("platform-person");
    person.textContent = `${county(app.selected).name}${race.kind === "district" ? ` ${race.name}` : ""}・${candidate.no} 號・${partyLabel(candidate.party)}`;
    person.style.setProperty("--c", partyOf(candidate.party).color);
    $("platform-note").textContent = candidate.platformImage
      ? `中選會選舉公報節錄${page ? `・第 ${page} 頁` : ""}。可左右滑動、放大閱讀；開啟原檔可查證完整公報。`
      : `目前只能顯示完整公報${page ? `第 ${page} 頁` : ""}，請依 ${candidate.no} 號及姓名查找。`;
    original.href = candidate.platformUrl;
    clearTimeout(loadTimer);
    loading.textContent = "正在載入中選會選舉公報…";
    loading.hidden = false;
    zoom.hidden = !candidate.platformImage;
    preview.hidden = !candidate.platformImage;
    frame.hidden = !!candidate.platformImage;
    dialog.showModal();
    document.body.classList.add("platform-open");
    app.pendingFollow = null;
    if (candidate.platformImage) {
      zoomIndex = 1;
      preview.style.width = `${widths[zoomIndex]}px`;
      zoomOut.disabled = false;
      zoomIn.disabled = false;
      documentArea.scrollTo(0, 0);
      preview.alt = `${candidate.name}的中選會選舉公報政見節錄`;
      preview.src = candidate.platformImage;
    } else {
      frame.title = `${candidate.name}的中選會選舉公報`;
      frame.src = candidate.platformUrl;
    }
    if (app.source instanceof ReplaySource && app.source.playing) {
      resume = app.source;
      resume.playing = false;
    }
    $("platform-close").focus();
  });
  preview.addEventListener("load", () => {
    if (dialog.open && preview.hasAttribute("src")) {
      loading.hidden = true;
      documentArea.scrollLeft = window.innerWidth <= 900 ? preview.clientWidth * .3 : 0;
    }
  });
  preview.addEventListener("error", () => { if (dialog.open) loading.textContent = "預覽載入失敗，請開啟官方原檔查看。"; });
  frame.addEventListener("load", () => {
    if (dialog.open && frame.hasAttribute("src")) loadTimer = window.setTimeout(() => { loading.hidden = true; }, 1800);
  });
  $("platform-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => {
    clearTimeout(loadTimer);
    preview.removeAttribute("src");
    frame.removeAttribute("src");
    document.body.classList.remove("platform-open");
    if (resume) { resume.playing = true; resume = null; }
    if (trigger?.isConnected) trigger.focus();
    trigger = null;
  });
}
