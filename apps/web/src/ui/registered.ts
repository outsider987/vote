import { COUNTIES } from "@vote/shared";
import { app, select } from "../app";
import { partyLabel, partyOf } from "../config";
import { $ } from "../dom";
import { loadRegistered, type RegisteredCandidate } from "../model/data";

/** The CEC's registration snapshot is separate from the approved election-night roster. */
export async function initRegistered() {
  const county = $<HTMLSelectElement>("registered-county");
  const district = $<HTMLSelectElement>("registered-district");
  const summary = $("registered-summary");
  const list = $("registered-list");
  try {
    const data = await loadRegistered();
    if (data.status !== "registered-pending-review") throw new Error("unexpected registration status");
    let mode: "mayor" | "council" = "mayor";
    county.replaceChildren(...COUNTIES.map((item) => new Option(item.name, item.name)));
    county.value = "臺北市";

    const render = () => {
      const countyName = county.value;
      const inCounty = data[mode].filter((candidate) => candidate.county === countyName);
      $("registered-district-wrap").hidden = mode !== "council";
      if (mode === "council") {
        const selected = district.value;
        const names = [...new Set(inCounty.map((candidate) => candidate.district))]
          .sort((a, b) => a.localeCompare(b, "zh-Hant-TW", { numeric: true }));
        district.replaceChildren(...names.map((name) => new Option(name.replace(countyName, ""), name)));
        district.value = names.includes(selected) ? selected : names[0] ?? "";
      }
      const rows = mode === "council" ? inCounty.filter((candidate) => candidate.district === district.value) : inCounty;
      summary.textContent = `${mode === "council" ? district.value || countyName : countyName + "長"}・${rows.length} 位已登記（尚非正式候選名單）`;
      list.replaceChildren(...rows.map((candidate: RegisteredCandidate) => {
        const item = document.createElement("li");
        const chip = document.createElement("i");
        chip.className = "chip";
        chip.style.setProperty("--c", partyOf(candidate.party).color);
        const name = document.createElement("strong");
        name.textContent = candidate.name;
        const party = document.createElement("span");
        party.textContent = partyLabel(candidate.party);
        const date = document.createElement("small");
        date.textContent = `${Number(candidate.registeredAt.slice(5, 7))}/${Number(candidate.registeredAt.slice(8, 10))} 登記`;
        item.append(chip, name, party, date);
        return item;
      }));
    };

    county.addEventListener("change", () => {
      const code = COUNTIES.find((item) => item.name === county.value)?.code;
      if (code && app.selected !== code) select(code, { byUser: true });
      render();
    });
    district.addEventListener("change", render);
    document.querySelectorAll<HTMLButtonElement>("[data-registered-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        mode = button.dataset.registeredMode as "mayor" | "council";
        document.querySelectorAll<HTMLButtonElement>("[data-registered-mode]")
          .forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
        render();
      });
    });
    render();
  } catch {
    summary.textContent = "登記名冊暫時無法載入，請開啟下方中選會原始資料。";
  }
}
