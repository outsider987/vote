import { app, county, select } from "../app";
import { LEGEND, ORDER, SHORT, partyLabel, partyOf, type PartyKey } from "../config";
import { $ } from "../dom";
import { hideFloat, showFloat } from "./tips";

/* The national seat tally in the top bar: 22 mayor seats, or the councilor seat bar. */

const seatEls: HTMLButtonElement[] = [];
let last: string | null = null;

export function initNational() {
  const list = $("seats");
  for (const code of ORDER) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "seat";
    b.textContent = SHORT[code];
    b.addEventListener("click", () => select(code, { byUser: true }));
    b.addEventListener("pointerenter", () => showFloat(b, b.getAttribute("aria-label") ?? ""));
    b.addEventListener("pointerleave", hideFloat);
    li.appendChild(b);
    list.appendChild(li);
    seatEls.push(b);
  }
}

export function markSelectedSeat(code: string) {
  seatEls.forEach((el, k) => el.classList.toggle("is-selected", ORDER[k] === code));
}

export function resetNational() {
  last = null;
}

export function renderNational() {
  const tally = Object.fromEntries(LEGEND.map((l) => [l.key, 0])) as Record<PartyKey, number>;
  let decided = 0;
  if (app.mode !== "council") {
    ORDER.forEach((code, k) => {
      const c = county(code), s = c.mayor.state, el = seatEls[k];
      const w = s.decided && s.winners.length ? c.mayor.candidates[s.winners[0]] : null;
      if (w) {
        decided++;
        const p = partyOf(w.party);
        tally[p.key]++;
        if (!el.classList.contains("is-decided")) {
          el.classList.add("is-decided");
          el.style.setProperty("--c", p.color);
        }
        el.setAttribute("aria-label", `${c.name}：${w.name}（${partyLabel(w.party)}）當選`);
      } else {
        el.classList.remove("is-decided");
        el.setAttribute("aria-label", app.source.started ? `${c.name}：開票中 ${(s.p * 100).toFixed(0)}%` : `${c.name}：尚未開票`);
      }
    });
  } else {
    for (const c of app.counties) {
      const s = c.council.state;
      decided += s.decidedSeats;
      for (const [party, n] of Object.entries(s.decided)) tally[partyOf(party).key] += n;
    }
  }
  const total = app.mode === "council" ? app.councilSeats : ORDER.length;
  $("seat-decided").textContent = String(decided);
  const always = new Set<PartyKey>(["kmt", "dpp", "tpp"]);
  const items = LEGEND.filter((l) => always.has(l.key) || tally[l.key] > 0)
    .map((l) => `<li><i class="chip" style="--c:${l.color}"></i>${l.name}<b>${tally[l.key]}</b></li>`);
  if (decided < total) items.push(`<li><i class="chip pending"></i>${app.source.started ? "開票中" : "尚未開票"}<b>${total - decided}</b></li>`);
  const html = items.join("");
  if (html === last) return;
  last = html;
  $("party-totals").innerHTML = html;
  if (app.mode === "council") {
    $("seatbar").innerHTML = LEGEND.filter((l) => tally[l.key] > 0)
      .map((l) => `<span style="--c:${l.color};--n:${tally[l.key]}"></span>`).join("")
      + (decided < total ? `<span class="pending" style="--n:${total - decided}"></span>` : "");
  }
}
