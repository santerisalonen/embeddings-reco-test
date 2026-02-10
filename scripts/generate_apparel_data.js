import fs from "node:fs/promises";
import path from "node:path";
import Replicate from "replicate";
import dotenv from "dotenv";
import yaml from "js-yaml";
import sharp from "sharp";

dotenv.config();

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const CATEGORIES = {
  photoStyle: ['Fashion editorial photo'],
  gender: ['female', 'male', 'non-binary'],
  style: ['bohemian chic style', 'minimalist style', '90s retro style', 'business casual style', '70s boho style'],
  color: ['sage green', 'charcoal grey', 'terracotta', 'electric blue', 'cream', 'mustard yellow', 'deep burgundy'],
  productType: ['maxi dress', 'oversized t-shirt', 'tailored blazer', 'cargo pants', 'silk blouse', 'knit sweater'],
  modelDetail: ['short curly hair', 'long straight hair', 'slicked back hair', 'buzz cut', 'braided hair', 'tousled waves'],
  pose: ['walking pose', 'leaning against a wall', 'standing tall'],
  background: ['neutral beige studio backdrop', 'urban city street', 'lush botanical garden', 'industrial concrete wall', 'minimalist interior'],
  lighting: ['soft diffused lighting',  'natural window light'],
    vibe: ['high-end fashion magazine style', 'raw and authentic vibe', 'vintage film aesthetic'],
  presentation: ['Model', 'Flat-lay']
};

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateCombination() {
  const config = {
    photoStyle: getRandom(CATEGORIES.photoStyle),
    style: getRandom(CATEGORIES.style),
    color: getRandom(CATEGORIES.color),
    productType: getRandom(CATEGORIES.productType),
    background: getRandom(CATEGORIES.background),
    lighting: getRandom(CATEGORIES.lighting),
    vibe: getRandom(CATEGORIES.vibe),
    presentation: getRandom(CATEGORIES.presentation)
  };

  if (config.presentation === 'Model') {
    config.gender = getRandom(CATEGORIES.gender);
    config.modelDetail = getRandom(CATEGORIES.modelDetail);
    config.pose = getRandom(CATEGORIES.pose);
  }

  return config;
}

function assemblePrompt(config) {
  if (config.presentation === 'Flat-lay') {
    return `${config.photoStyle} of a ${config.style} ${config.color} ${config.productType} in a flat-lay arrangement, ${config.background}, ${config.lighting}, ${config.vibe}.`;
  }

  return `${config.photoStyle} of a ${config.gender} model in a ${config.style} ${config.color} ${config.productType}, ${config.modelDetail}, ${config.pose}, ${config.background}, ${config.lighting}, ${config.vibe}.`;
}

async function generateImage(prompt) {
  console.log(`Generating image with prompt: ${prompt}`);
  const output = await replicate.run(
    "black-forest-labs/flux-dev-lora",
    {
      input: {
        prompt: prompt,
        go_fast: true,
        guidance: 3,
        lora_scale: 1,
        megapixels: "1",
        num_outputs: 1,
        aspect_ratio: "2:3",
        output_format: "webp",
        output_quality: 80,
        prompt_strength: 0.8,
        num_inference_steps: 28
      }
    }
  );
  // The output from this model is an array of objects with a .url() method or similar
  return typeof output[0] === 'string' ? output[0] : output[0].url();
}

async function downloadAndStandardize(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  await fs.mkdir(path.dirname(destPath), { recursive: true });

  await sharp(buffer)
    .rotate()
    .resize(500, 700, {
      fit: "cover",
      position: "attention"
    })
    .jpeg({
      quality: 85,
      mozjpeg: true
    })
    .toFile(destPath);
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 1;

  const repoRoot = process.cwd();
  const productsYamlPath = path.join(repoRoot, "products.yaml");
  const metadataYamlPath = path.join(repoRoot, "products_metadata.yaml");

  let products = [];
  try {
    const raw = await fs.readFile(productsYamlPath, "utf8");
    products = yaml.load(raw) || [];
  } catch (err) {}

  let metadata = {};
  try {
    const raw = await fs.readFile(metadataYamlPath, "utf8");
    metadata = yaml.load(raw) || {};
  } catch (err) {}

  console.log(`Starting synthetic data generation with limit: ${limit}`);

  for (let i = 0; i < limit; i++) {
    const config = generateCombination();
    const prompt = assemblePrompt(config);
    
    try {
      const imageUrl = await generateImage(prompt);
      const id = `s${Date.now()}_${i}`;
      const destPath = `public/products/images/synthetic/${id}.jpg`;
      const absDestPath = path.join(repoRoot, ...destPath.split("/"));

      console.log(`Downloading and standardizing ${id}...`);
      await downloadAndStandardize(imageUrl, absDestPath);

      products.push({
        id: id,
        image_path: destPath
      });

      metadata[id] = config;

      // Save incrementally
      await fs.writeFile(productsYamlPath, yaml.dump(products));
      await fs.writeFile(metadataYamlPath, yaml.dump(metadata));

      console.log(`Successfully generated and saved ${id}`);
    } catch (err) {
      console.error(`Error generating image ${i}:`, err.message);
    }
  }

  console.log("Synthetic data generation complete.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { CATEGORIES, generateCombination, assemblePrompt };
