export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
export const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const params = new URLSearchParams(location.search);
export const SVGNS = "http://www.w3.org/2000/svg";
