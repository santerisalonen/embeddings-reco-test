import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import yaml from "js-yaml";

const DEFAULT_WIDTH = 500;
const DEFAULT_HEIGHT = 700;
const DEFAULT_CONCURRENCY = 4;

function toAbs(repoRoot, posixRelPath) {
  // paths are posix-style; convert for current OS.
  return path.join(repoRoot, ...String(posixRelPath).split("/"));
}

async function downloadToBuffer(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "embedding-reco-test/1.0 (image downloader)"
    }
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}

async function standardizeToJpg(buffer, width, height) {
  return sharp(buffer)
    .rotate()
    .resize(width, height, {
      fit: "cover",
      position: "attention"
    })
    .jpeg({
      quality: 85,
      mozjpeg: true
    })
    .toBuffer();
}

async function runWithConcurrency(items, concurrency, worker) {
  let i = 0;
  const results = [];
  const runners = Array.from({ length: concurrency }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}

async function main() {
  const repoRoot = process.cwd();
  const manifestPath = path.join(repoRoot, "scripts", "manifest.yaml");
  const raw = await fs.readFile(manifestPath, "utf8");
  const manifest = yaml.load(raw);

  if (!Array.isArray(manifest)) {
    throw new Error("scripts/manifest.yaml must be a YAML array of { source_url, dest_path }");
  }

  const width = DEFAULT_WIDTH;
  const height = DEFAULT_HEIGHT;
  const concurrency = Number(process.env.DOWNLOAD_CONCURRENCY ?? DEFAULT_CONCURRENCY) || DEFAULT_CONCURRENCY;

  const stats = {
    total: manifest.length,
    downloaded: 0,
    failed: 0
  };

  await runWithConcurrency(manifest, concurrency, async (f) => {
    const sourceUrl = String(f.source_url ?? "");
    const destPathPosix = String(f.dest_path ?? "");
    if (!sourceUrl || !destPathPosix) {
      stats.failed++;
      console.error(`Invalid entry (missing source_url/dest_path):`, f);
      return;
    }

    const absDestPath = toAbs(repoRoot, destPathPosix);
    const absDestDir = path.dirname(absDestPath);

    try {
      await fs.mkdir(absDestDir, { recursive: true });
      const buf = await downloadToBuffer(sourceUrl);
      const jpg = await standardizeToJpg(buf, width, height);
      await fs.writeFile(absDestPath, jpg);
      stats.downloaded++;
      console.log(`Saved ${destPathPosix}`);
    } catch (err) {
      stats.failed++;
      console.error(`Failed ${sourceUrl} -> ${destPathPosix}: ${err?.message ?? err}`);
    }
  });

  console.log(`Done. total=${stats.total} downloaded=${stats.downloaded} failed=${stats.failed}`);
}

main().catch(console.error);
