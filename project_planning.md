# Project planning: embedding-based recommendations demo

## Goal
Build a small, hackable **demo UI** that uses **image embeddings** to power simple **recommendations / similarity search** over a tiny catalog of product images.

This repo is intentionally minimal: it’s meant to be a playground for iterating on an embeddings-based recommendation flow (and related data hygiene), not a fully-fledged product.

## What we have so far

### Source-of-truth manifest
- `file_downloads.json` is the source of truth for the demo catalog.
- It is a JSON array of entries with:
  - `source_url`: where to download an image from
  - `dest_path`: where to store the standardized image locally (relative path, POSIX-style)

Adding more catalog items is done by adding new entries to `file_downloads.json`.

### Local image store (standardized)
- Images are stored under `products/images/...` based on `dest_path` values.
- `npm run download:images` downloads and standardizes all entries:
  - converts to **JPG**
  - resizes/crops to **500×700** (a consistent input shape for downstream steps)

Implementation: `scripts/download_and_standardize_images.js` (uses `sharp`).

## What we’re trying to demonstrate with embeddings

### Core idea
1. Take each product image.
2. Compute a vector embedding for it (e.g. using CLIP image encoder or similar).
3. For a given query (another image, or later possibly text), compute a query embedding.
4. Use vector similarity (typically cosine similarity) to find the nearest catalog embeddings.
5. Return the top-\(k\) nearest items as “recommended” / “similar”.

### What “recommendation” means in this demo
At this stage, “recommendation” just means **nearest neighbors in embedding space** over a small dataset.

We’re intentionally leaving open later decisions like:
- whether we add user history / session context
- whether we combine embeddings with filters (categories, price, availability)
- whether we add re-ranking or other heuristics

## Planned workflow (high level)

### Step A — data preparation
- Maintain `file_downloads.json`.
- Run `npm run download:images` to ensure we have a clean, standardized local image set.

Why this matters:
- Standardization reduces accidental variance (format, extreme aspect ratios, huge images).
- It also makes the demo deterministic and easier to debug.

### Step B — embedding generation
For each standardized image:
- Generate an embedding vector using an image embedding model.

We will use the **Replicate API** for embedding generation.

Current state in this repo:
- There’s an example call to Replicate in `test_replicate.js` using `openai/clip`.

Open decisions (deliberately not chosen yet):
- exact model/version and whether we support multiple models
- where embeddings are stored (in-memory, JSON file, sqlite, a vector DB, etc.)
- whether embeddings are normalized at write time, query time, or both

### Step C — similarity search
Given a query embedding:
- compute similarity against all catalog vectors
- sort and return top-\(k\)

Open decisions:
- similarity metric (cosine / dot / L2) and normalization strategy
- whether we use brute-force search (fine for tiny \(N\)) or an ANN index (FAISS/HNSW/etc.)

### Step D — demo interface
Build an interactive demo UI where a user can take actions on products (e.g. **Like**, **Purchase**) and the UI reacts by showing updated recommendations.

High-level intent:
- A user sees a set of products.
- The user performs one or more actions (like/purchase/other).
- Those actions update the “current preference signal”.
- Recommendations refresh based on that signal using embeddings.

Open decisions (deliberately not chosen yet):
- UI technology (plain HTML, a small framework, etc.)
- what actions exist beyond “like” / “purchase”, and how they’re weighted
- how we represent session state (in-memory, persisted, etc.)
- whether recommendations are computed client-side or server-side

## Success criteria (for the demo)
- **Reproducible**: anyone can run the scripts and get the same local image set.
- **Understandable**: clear mapping from manifest → images → embeddings → nearest neighbors.
- **Easy to extend**: adding more images is just updating `file_downloads.json`.
- **Fast enough** for small datasets: brute-force similarity should be fine initially.

## Next steps (suggested, not yet implemented)
- Add a script to compute embeddings for all images in `products/images/**`.
- Add a script to run a similarity query (pick one item and retrieve nearest neighbors).
- Decide on a simple embeddings storage format for this demo (keep it transparent).
- Add lightweight evaluation checks (spot-check results, sanity checks on vector shapes, etc.).

