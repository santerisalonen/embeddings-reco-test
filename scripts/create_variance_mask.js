import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import dotenv from "dotenv";
import Replicate from "replicate";

dotenv.config();

const DEFAULT_VARIANTS = 8;
const DEFAULT_PERCENTILE = 0.2; // top 20% highest-variance dims
const DEFAULT_HIGH_WEIGHT = 1.0;
const DEFAULT_LOW_WEIGHT = 0.1;

function parseArgs(argv) {
  const args = {};
  for (const a of argv) {
    if (a.startsWith("--") && a.includes("=")) {
      const [k, ...rest] = a.slice(2).split("=");
      args[k] = rest.join("=");
    } else if (a.startsWith("--")) {
      args[a.slice(2)] = true;
    }
  }
  return args;
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function outputToUrl(output) {
  if (!output) return null;
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return outputToUrl(output[0]);
  if (typeof output?.url === "function") return output.url();
  if (typeof output?.url === "string") return output.url;
  return null;
}

async function downloadUrlToFile(url, destPath) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.writeFile(destPath, buf);
}

function toDataUriJpeg(buffer) {
  const base64 = buffer.toString("base64");
  return `data:image/jpeg;base64,${base64}`;
}

async function embedImageFile(replicate, absImagePath) {
  const imageBuffer = await fs.readFile(absImagePath);
  const dataUri = toDataUriJpeg(imageBuffer);
  const output = await replicate.run("openai/clip", { input: { image: dataUri } });
  if (!output?.embedding || !Array.isArray(output.embedding)) {
    throw new Error(`Unexpected embedding output shape`);
  }
  return output.embedding;
}

function computeVariancePerDim(vectors) {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const mean = new Array(dim).fill(0);
  const meanSq = new Array(dim).fill(0);

  for (const v of vectors) {
    if (!Array.isArray(v) || v.length !== dim) throw new Error("Inconsistent vector dims");
    for (let i = 0; i < dim; i++) {
      const x = v[i];
      mean[i] += x;
      meanSq[i] += x * x;
    }
  }

  const n = vectors.length;
  const variance = new Array(dim);
  for (let i = 0; i < dim; i++) {
    const mu = mean[i] / n;
    const mu2 = meanSq[i] / n;
    variance[i] = Math.max(0, mu2 - mu * mu);
  }
  return variance;
}

function buildWeightsFromVariance(variance, percentile, highWeight, lowWeight) {
  const dim = variance.length;
  if (dim === 0) return [];

  const indexed = variance.map((v, i) => ({ i, v }));
  indexed.sort((a, b) => b.v - a.v);

  const topK = Math.max(1, Math.ceil(dim * percentile));
  const weights = new Array(dim).fill(lowWeight);
  for (let j = 0; j < topK; j++) {
    weights[indexed[j].i] = highWeight;
  }

  const topDims = indexed.slice(0, Math.min(topK, 50)).map(({ i, v }) => ({ i, variance: v }));
  return { weights, topK, topDims };
}

async function loadProductsAndMetadata(repoRoot) {
  const productsRaw = await fs.readFile(path.join(repoRoot, "products.yaml"), "utf8");
  const products = yaml.load(productsRaw) || [];
  const metaRaw = await fs.readFile(path.join(repoRoot, "products_metadata.yaml"), "utf8");
  const metadata = yaml.load(metaRaw) || {};
  if (!Array.isArray(products)) throw new Error("products.yaml must be a YAML array");
  if (typeof metadata !== "object" || !metadata) throw new Error("products_metadata.yaml must be a YAML object");
  return { products, metadata };
}

async function selectBaseProduct({ category, products, metadata, baseId }) {
  const candidates = baseId
    ? products.filter((p) => p?.id === baseId)
    : products.filter((p) => p?.category === category);

  if (candidates.length === 0) {
    throw new Error(`No products found for category=${category}${baseId ? ` baseId=${baseId}` : ""}`);
  }

  for (const p of candidates) {
    const id = p?.id;
    const img = p?.image_path;
    if (!id || !img) continue;

    const meta = metadata[id] || {};
    if (category === "apparel") {
      if (String(meta.presentation || "").toLowerCase() !== "model") continue;
    }
    if (category === "eyewear") {
      if (String(meta.eyewearType || "") !== "eyeglasses") continue;
    }

    const absImagePath = path.join(process.cwd(), ...String(img).split("/"));
    if (!(await fileExists(absImagePath))) continue;

    return { id, image_path: img, metadata: meta };
  }

  // If baseId was provided, be strict and fail fast (don’t silently choose a different item).
  if (baseId) {
    throw new Error(`Base id ${baseId} did not meet selection criteria or image was missing`);
  }
  throw new Error(`No suitable base product found for category=${category}`);
}

function getVariantPrompts(category) {
  if (category === "apparel") {
    return [
      "Change the clothing to business casual (blazer and trousers). Keep the same person, face, hair, pose, background, and lighting. Only change the clothing.",
      "Change the clothing to minimalist casual (plain t-shirt and straight-leg pants). Keep everything else identical; only change the clothing.",
      "Change the clothing to sporty athleisure (hoodie and joggers). Keep the same identity/background/lighting; only change the outfit.",
      "Change the clothing to 90s retro streetwear (oversized denim jacket). Keep everything else the same; only change the clothing.",
      "Change the clothing to bohemian chic (flowy patterned dress). Keep the same person and scene; only change the clothing.",
      "Change the clothing to formal evening wear (tailored suit or elegant dress). Keep everything else identical; only change the clothing."
    ];
  }

  // eyewear
  return [
    "Change the eyewear to bold oversized square eyeglasses frames in matte black. Keep the same person, face, hair, pose, background, and lighting. Only change the eyewear.",
    "Change the eyewear to classic round panto eyeglasses frames in polished gold. Keep everything else identical; only change the eyewear.",
    "Change the eyewear to modern cat-eye eyeglasses frames in deep navy blue. Keep the same identity and scene; only change the eyewear.",
    "Change the eyewear to minimalist titanium wire eyeglasses frames in brushed silver. Keep everything else the same; only change the eyewear.",
    "Change the eyewear to elegant acetate eyeglasses frames in crystal clear. Keep the same person and background; only change the eyewear."
  ];
}

async function makeFluxEdit({ replicate, prompt, inputImageDataUri }) {
  const input = {
    prompt,
    input_image: inputImageDataUri,
    aspect_ratio: "match_input_image",
    output_format: "jpg",
    safety_tolerance: 2,
    prompt_upsampling: false
  };
  const output = await replicate.run("black-forest-labs/flux-kontext-pro", { input });
  const url = outputToUrl(output);
  if (!url) throw new Error("Could not resolve Flux output to a URL");
  return { url };
}

async function runCategory({
  replicate,
  repoRoot,
  category,
  variants,
  percentile,
  highWeight,
  lowWeight,
  baseId,
  dryRun
}) {
  const { products, metadata } = await loadProductsAndMetadata(repoRoot);
  const base = await selectBaseProduct({ category, products, metadata, baseId });
  const absBaseImagePath = path.join(repoRoot, ...String(base.image_path).split("/"));
  const baseBuffer = await fs.readFile(absBaseImagePath);
  const baseDataUri = toDataUriJpeg(baseBuffer);

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(repoRoot, "experiments", "latent-mask", category, runId);
  const relOutDir = path.relative(repoRoot, outDir);
  await fs.mkdir(outDir, { recursive: true });

  const baseCopyPath = path.join(outDir, "base.jpg");
  await fs.writeFile(baseCopyPath, baseBuffer);

  const prompts = getVariantPrompts(category);
  const usedPrompts = [];
  const variantRelPaths = [];

  for (let i = 0; i < variants; i++) {
    const prompt = prompts[i % prompts.length];
    usedPrompts.push(prompt);

    const variantFilename = `variant_${String(i).padStart(2, "0")}.jpg`;
    const absVariantPath = path.join(outDir, variantFilename);
    const relVariantPath = path.join(relOutDir, variantFilename);

    if (dryRun) {
      // In dry run, don’t call Replicate; just record the intended path.
      variantRelPaths.push(relVariantPath);
      continue;
    }

    const { url } = await makeFluxEdit({ replicate, prompt, inputImageDataUri: baseDataUri });
    await downloadUrlToFile(url, absVariantPath);
    variantRelPaths.push(relVariantPath);
    console.log(`[${category}] Saved ${relVariantPath}`);
  }

  if (dryRun) {
    const runManifest = {
      category,
      runId,
      baseProductId: base.id,
      baseImagePath: base.image_path,
      experimentDir: relOutDir,
      variants,
      prompts: usedPrompts,
      variantImagePaths: variantRelPaths,
      dryRun: true
    };
    await fs.writeFile(path.join(outDir, "run.json"), JSON.stringify(runManifest, null, 2));
    console.log(`[${category}] Dry run wrote ${path.join(relOutDir, "run.json")}`);
    return;
  }

  // Embed base + variants
  const vectors = [];
  const embeddingByImage = {};

  const baseVec = await embedImageFile(replicate, absBaseImagePath);
  vectors.push(baseVec);
  embeddingByImage["base"] = baseVec;

  for (let i = 0; i < variantRelPaths.length; i++) {
    const absVariantPath = path.join(repoRoot, variantRelPaths[i]);
    const vec = await embedImageFile(replicate, absVariantPath);
    vectors.push(vec);
    embeddingByImage[path.basename(variantRelPaths[i])] = vec;
  }

  await fs.writeFile(path.join(outDir, "embeddings.json"), JSON.stringify(embeddingByImage, null, 2));

  // Discover mask
  const variance = computeVariancePerDim(vectors);
  const { weights, topK, topDims } = buildWeightsFromVariance(variance, percentile, highWeight, lowWeight);

  const mask = {
    category,
    baseProductId: base.id,
    runId,
    experimentDir: relOutDir,
    params: {
      variants,
      percentile,
      highWeight,
      lowWeight
    },
    topK,
    topDims,
    weights
  };

  const masksDir = path.join(repoRoot, "masks");
  await fs.mkdir(masksDir, { recursive: true });
  const maskPath = path.join(masksDir, `${category}_mask.json`);
  await fs.writeFile(maskPath, JSON.stringify(mask, null, 2));

  const runManifest = {
    category,
    runId,
    baseProductId: base.id,
    baseImagePath: base.image_path,
    experimentDir: relOutDir,
    variants,
    prompts: usedPrompts,
    variantImagePaths: variantRelPaths,
    maskPath: path.relative(repoRoot, maskPath)
  };
  await fs.writeFile(path.join(outDir, "run.json"), JSON.stringify(runManifest, null, 2));

  console.log(`[${category}] Wrote mask ${path.relative(repoRoot, maskPath)}`);
}

async function main() {
  const repoRoot = process.cwd();
  const args = parseArgs(process.argv.slice(2));

  const replicateToken = process.env.REPLICATE_API_TOKEN;
  if (!replicateToken && !args.dryRun) {
    throw new Error("Missing REPLICATE_API_TOKEN (or run with --dryRun)");
  }

  const replicate = new Replicate({ auth: replicateToken });

  const categoryArg = String(args.category || "both");
  const categories =
    categoryArg === "both" ? ["eyewear", "apparel"] : [categoryArg];

  const variants = Number(args.variants ?? DEFAULT_VARIANTS) || DEFAULT_VARIANTS;
  const percentile = Number(args.percentile ?? DEFAULT_PERCENTILE) || DEFAULT_PERCENTILE;
  const highWeight = Number(args.highWeight ?? DEFAULT_HIGH_WEIGHT) || DEFAULT_HIGH_WEIGHT;
  const lowWeight = Number(args.lowWeight ?? DEFAULT_LOW_WEIGHT) || DEFAULT_LOW_WEIGHT;
  const dryRun = !!args.dryRun;

  for (const category of categories) {
    if (category !== "eyewear" && category !== "apparel") {
      throw new Error(`Invalid category: ${category} (expected eyewear|apparel|both)`);
    }

    const baseId =
      category === "eyewear" ? args.baseIdEyewear : args.baseIdApparel;

    console.log(`[${category}] Selecting base image...`);
    await runCategory({
      replicate,
      repoRoot,
      category,
      variants,
      percentile,
      highWeight,
      lowWeight,
      baseId,
      dryRun
    });
  }
}

await main();

