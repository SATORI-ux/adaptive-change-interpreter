import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv";

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

const schemaPath = path.resolve(
  "schemas/adaptive_change_interpreter_response.schema.json"
);
const dataPath = process.argv[2];

if (!dataPath) {
  console.error("Usage: node src/validateSchema.mjs <path-to-json-output>");
  process.exit(1);
}

const absoluteDataPath = path.resolve(dataPath);

if (!fs.existsSync(schemaPath)) {
  console.error(`Schema file not found: ${schemaPath}`);
  process.exit(1);
}

if (!fs.existsSync(absoluteDataPath)) {
  console.error(`JSON file not found: ${absoluteDataPath}`);
  process.exit(1);
}

try {
  const schema = readJson(schemaPath);
  const data = readJson(absoluteDataPath);

  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const isValid = validate(data);

  if (isValid) {
    console.log("Validation passed.");
  } else {
    console.log("Validation failed. Errors:\n");
    for (const error of validate.errors || []) {
      console.log(`- path: ${error.instancePath || "/"}`);
      console.log(`  keyword: ${error.keyword}`);
      console.log(`  message: ${error.message}`);
      if (error.params) {
        console.log(`  details: ${JSON.stringify(error.params)}`);
      }
      console.log("");
    }
    process.exit(1);
  }
} catch (error) {
  console.error("Validator crashed:");
  console.error(error.message);
  process.exit(1);
}
