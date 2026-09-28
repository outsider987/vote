import type { PollerConfig, Prefix } from "./config.js";

export function pageUrl(config: Pick<PollerConfig, "countBaseUrl" | "prefixes">, prefix: Prefix, county: string, district = "00", town = "000", village = "000", station = "0000"): string {
  for (const [label, value, width] of [["county", county, 5], ["district", district, 2], ["town", town, 3], ["village", village, 3], ["station", station, 4]] as const) {
    if (!new RegExp(`^\\d{${width}}$`).test(value)) throw new Error(`Invalid ${label} code: ${value}`);
  }
  return new URL(`${config.prefixes[prefix]}/${county}${district}${town}${village}${station}.html`, config.countBaseUrl.replace(/\/?$/, "/")).href;
}
