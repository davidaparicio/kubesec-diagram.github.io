import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const rootDir = process.cwd();
const dataPath = path.join(rootDir, "data.js");
const outputPath = path.join(rootDir, "dist", "app.bundle.js");
const metadataPath = path.join(rootDir, "METADATA.md");
const tagDescriptionsPath = path.join(rootDir, "src", "tag-descriptions.generated.js");

// METADATA.md is where the tag tree is maintained and reviewed. Generating the
// runtime map from it means a description cannot drift from the rules.
function parseTagDescriptions() {
  const source = fs.readFileSync(metadataPath, "utf8");
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line.trim() === "## Tag tree");
  if (start < 0) {
    throw new Error("METADATA.md has no '## Tag tree' section");
  }

  const descriptions = {};
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith("## ")) break;

    const match = line.match(/^\s*-\s+`([^`]+)`(?:\s+—\s+(.+))?\s*$/);
    if (!match) continue;
    descriptions[match[1]] = (match[2] || "").trim();
  }

  if (Object.keys(descriptions).length === 0) {
    throw new Error("No tags parsed from the '## Tag tree' section of METADATA.md");
  }

  return descriptions;
}

function writeTagDescriptions() {
  const descriptions = parseTagDescriptions();
  const entries = Object.keys(descriptions)
    .sort()
    .map((tag) => `  ${JSON.stringify(tag)}: ${JSON.stringify(descriptions[tag])},`)
    .join("\n");

  fs.writeFileSync(
    tagDescriptionsPath,
    `// Auto-generated from METADATA.md by scripts/build-bundle.mjs. Do not edit manually.\nwindow.tagDescriptions = {\n${entries}\n};\n`,
    "utf8",
  );
  console.log(
    `Generated ${path.relative(rootDir, tagDescriptionsPath)} (${Object.keys(descriptions).length} tags)`,
  );
}

function loadRuntimeScriptsFromConfig() {
  const dataSource = fs.readFileSync(dataPath, "utf8");
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`${dataSource}\nthis.__CONFIG__ = config;`, sandbox, {
    filename: "data.js",
  });

  const runtimeScripts = sandbox.__CONFIG__?.runtime?.scripts;
  if (!Array.isArray(runtimeScripts) || runtimeScripts.length === 0) {
    throw new Error("config.runtime.scripts must be a non-empty array in data.js");
  }

  return runtimeScripts;
}

function normalizeRelativePath(relPath) {
  return relPath.replace(/^\.\//, "");
}

function buildBundle() {
  writeTagDescriptions();
  const scripts = loadRuntimeScriptsFromConfig();
  const chunks = [];

  chunks.push("// Auto-generated bundle. Do not edit manually.\n");

  for (const relPath of scripts) {
    const normalizedRelPath = normalizeRelativePath(relPath);
    const absolutePath = path.join(rootDir, normalizedRelPath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Missing script from config.runtime.scripts: ${relPath}`);
    }

    const content = fs.readFileSync(absolutePath, "utf8");
    chunks.push(`\n// ---- ${relPath} ----\n`);
    chunks.push(content.endsWith("\n") ? content : `${content}\n`);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, chunks.join(""), "utf8");
  console.log(`Built ${path.relative(rootDir, outputPath)}`);
}

buildBundle();
