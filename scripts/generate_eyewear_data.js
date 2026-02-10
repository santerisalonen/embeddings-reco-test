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
  gender: ['female', 'male'],
  eyewearType: ['eyeglasses', 'sunglasses'],
  frameStyle: [
    'elegant acetate frames', 
    'minimalist titanium wire frames', 
    'bold oversized square frames', 
    'classic round panto frames', 
    'modern cat-eye frames',
    'vintage-inspired aviator frames'
  ],
  frameColor: [
    'tortoiseshell brown', 
    'matte black', 
    'polished gold', 
    'crystal clear', 
    'deep navy blue', 
    'brushed silver',
    'champagne translucent'
  ],
  lensColor: [
    'dark grey tinted lenses',
    'gradient brown lenses',
    'mirrored silver lenses',
    'bottle green tinted lenses',
    'classic black lenses'
  ],
  modelDetail: [
    'soft natural makeup, hair pulled back', 
    'clean shaven, short groomed hair', 
    'minimalist aesthetic, natural skin texture', 
    'sophisticated look, hair in a neat bun',
    'modern professional look, short side-parted hair'
  ]
};

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateCombination() {
  const eyewearType = getRandom(CATEGORIES.eyewearType);
  const config = {
    category: 'eyewear',
    eyewearType: eyewearType,
    gender: getRandom(CATEGORIES.gender),
    frameStyle: getRandom(CATEGORIES.frameStyle),
    frameColor: getRandom(CATEGORIES.frameColor),
    modelDetail: getRandom(CATEGORIES.modelDetail)
  };

  if (eyewearType === 'sunglasses') {
    config.lensColor = getRandom(CATEGORIES.lensColor);
  }

  return config;
}

function assemblePrompt(config) {
  const lensDetail = config.eyewearType === 'sunglasses' ? ` with ${config.lensColor}` : '';
  const focusDetail = config.eyewearType === 'sunglasses' ? 'sunglasses' : 'glasses frames';
  
  return `Fashion editorial close-up portrait of a ${config.gender} model wearing ${config.frameStyle} ${config.eyewearType} in ${config.frameColor}${lensDetail}, looking directly at camera, ${config.modelDetail}, clean white studio backdrop, soft diffused lighting highlighting frame details, high-end eyewear campaign style, sharp focus on ${focusDetail}.`;
}

async function generateImage(prompt) {
  console.log(`Generating eyewear image with prompt: ${prompt}`);
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

  console.log(`Starting eyewear synthetic data generation with limit: ${limit}`);

  for (let i = 0; i < limit; i++) {
    const config = generateCombination();
    const prompt = assemblePrompt(config);
    
    try {
      const imageUrl = await generateImage(prompt);
      const id = `e${Date.now()}_${i}`;
      const destPath = `public/products/images/synthetic/${id}.jpg`;
      const absDestPath = path.join(repoRoot, ...destPath.split("/"));

      console.log(`Downloading and standardizing ${id}...`);
      await downloadAndStandardize(imageUrl, absDestPath);

      products.push({
        id: id,
        image_path: destPath,
        category: 'eyewear',
        recommendation_only: (i % 3 === 0) // Assign 1/3 as recommendation only for new items
      });

      metadata[id] = config;

      // Save incrementally
      await fs.writeFile(productsYamlPath, yaml.dump(products));
      await fs.writeFile(metadataYamlPath, yaml.dump(metadata));

      console.log(`Successfully generated and saved ${id}`);
    } catch (err) {
      console.error(`Error generating eyewear image ${i}:`, err.message);
    }
  }

  console.log("Eyewear synthetic data generation complete.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { CATEGORIES, generateCombination, assemblePrompt };
