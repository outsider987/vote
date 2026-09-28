import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const replayFile = (name: string) => new URL(`../../../data/${name}`, import.meta.url);

export async function readJson<T>(path: string | URL): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value)}\n`);
  await rename(temp, path);
}
