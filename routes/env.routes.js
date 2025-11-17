import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { encrypt, decrypt } from "../utils/crypto.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const EnvRouter = express.Router();

const ENV_PATH = path.join(__dirname, "../.env");

// Required Keys
const requiredKeys = [
  "MASAI_ADMIN_LMS_USER_EMAIL",
  "MASAI_ADMIN_LMS_USER_PASSWORD",
  "MASAI_ASSESS_PLATFORM_USER_EMAIL",
  "MASAI_ASSESS_PLATFORM_USER_PASSWORD",
  "GOOGLE_SHEET_ID",
];

// Validate key=value format (allow spaces)
function validateEnvFormat(line) {
  return /^[A-Z0-9_]+\s*=\s*.*$/.test(line);
}

/* ----------------------------- SAVE ----------------------------- */
EnvRouter.post("/save", (req, res) => {
  try {
    // Check all required fields
    for (const key of requiredKeys) {
      if (!req.body[key]) {
        return res.status(400).json({ message: `Missing: ${key}` });
      }
    }

    let existingLines = [];
    if (fs.existsSync(ENV_PATH)) {
      existingLines = fs.readFileSync(ENV_PATH, "utf8").split("\n");
    }

    const updatedLines = existingLines.map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return line;

      const [key, ...rest] = line.split("=");
      if (requiredKeys.includes(key.trim())) {
        let value = req.body[key];

        // Encrypt passwords
        if (key.toLowerCase().includes("password")) {
          value = encrypt(value);
        }

        return `${key}="${value}"`;
      } else {
        return line;
      }
    });

    // Add any missing required keys that weren't in the file
    for (const key of requiredKeys) {
      if (!updatedLines.some((l) => l.startsWith(key + "="))) {
        let value = req.body[key];
        if (key.toLowerCase().includes("password")) {
          value = encrypt(value);
        }
        updatedLines.push(`${key}="${value}"`);
      }
    }

    fs.writeFileSync(ENV_PATH, updatedLines.join("\n"));
    res.json({ message: "Saved successfully!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


/* ----------------------------- READ ----------------------------- */
EnvRouter.get("/read", (req, res) => {
  try {
    if (!fs.existsSync(ENV_PATH)) {
      return res.json({});
    }

    const lines = fs.readFileSync(ENV_PATH, "utf8").split("\n");
    console.log("🚀 ~ lines:", lines);

    const result = {};

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines or comments
      if (!trimmed || trimmed.startsWith("#")) continue;

      if (!validateEnvFormat(trimmed)) continue;

      // Split key/value
      const [key, ...rest] = trimmed.split("=");
      let value = rest.join("=").trim();

      // Remove surrounding quotes
      value = value.replace(/^['"]|['"]$/g, "");

      // Decrypt passwords
      if (key.toLowerCase().includes("password")) {
        try {
          value = decrypt(value);
        } catch {
          value = "";
        }
      }

      result[key.trim()] = value;
    }

    console.log("this is from ==>", result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ----------------------------- RESET ONLY 5 KEYS ----------------------------- */
EnvRouter.post("/reset", (req, res) => {
  try {
    if (!fs.existsSync(ENV_PATH)) {
      return res.json({ message: "No .env file found" });
    }

    const lines = fs.readFileSync(ENV_PATH, "utf8").split("\n");
    const newLines = lines.map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return line;

      const [key, ...rest] = line.split("=");
      if (requiredKeys.includes(key.trim())) {
        return `${key.trim()}=""`;
      } else {
        return line;
      }
    });

    fs.writeFileSync(ENV_PATH, newLines.join("\n"));

    res.json({ message: "Selected environment values reset!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default EnvRouter;
