import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";

export async function getManifest() {
  const raw = await fs.readFile(path.join(process.cwd(), "products.yaml"), "utf8");
  return yaml.load(raw);
}

export async function getEmbeddings() {
  const raw = await fs.readFile(path.join(process.cwd(), "embeddings.json"), "utf8");
  return JSON.parse(raw);
}

export async function getMask(category) {
  const maskPath = path.join(process.cwd(), "masks", `${category}_mask.json`);
  try {
    const raw = await fs.readFile(maskPath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

export async function getEvents() {
  const eventsPath = path.join(process.cwd(), "events.json");
  try {
    const raw = await fs.readFile(eventsPath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

export async function saveEvent(event) {
  const events = await getEvents();
  events.push({ ...event, timestamp: new Date().toISOString() });
  await fs.writeFile(path.join(process.cwd(), "events.json"), JSON.stringify(events, null, 2));
}

export async function clearEvents() {
  await fs.writeFile(path.join(process.cwd(), "events.json"), JSON.stringify([], null, 2));
}
