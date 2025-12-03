import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ConfigRouter = express.Router();

const CONFIG_PATH = path.join(__dirname, "../config.json");

// Required Keys
const requiredKeys = [
  "MASAI_ADMIN_LMS_USER_EMAIL",
  "MASAI_ADMIN_LMS_USER_PASSWORD",
  "MASAI_ASSESS_PLATFORM_USER_EMAIL",
  "MASAI_ASSESS_PLATFORM_USER_PASSWORD",
  "GOOGLE_SHEET_ID",
];

/* ----------------------------- LOAD JSON ----------------------------- */
function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, "{}");
  }
  const data = fs.readFileSync(CONFIG_PATH, "utf8");
  return JSON.parse(data || "{}");
}

/* ----------------------------- SAVE JSON ----------------------------- */
function saveConfig(json) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(json, null, 2));
}

/* ----------------------------- SAVE ROUTE (NO ENCRYPTION) ----------------------------- */
ConfigRouter.post("/save", (req, res) => {
  try {
    // Validate all required fields present
    for (const key of requiredKeys) {
      if (!req.body[key]) {
        return res.status(400).json({ message: `Missing: ${key}` });
      }
    }

    const config = loadConfig();

    for (const key of requiredKeys) {
      config[key] = req.body[key]; // ⭐ Direct save — no encryption
    }

    saveConfig(config);

    res.json({ message: "Saved successfully!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ----------------------------- READ ROUTE (PLAIN TEXT) ----------------------------- */
ConfigRouter.get("/read", (req, res) => {
  try {
    const config = loadConfig();
    const finalData = {};

    for (const key of requiredKeys) {
      finalData[key] = config[key] || ""; // ⭐ No decryption
    }

    console.log("🚀 ~ finalData:", finalData);
    res.json(finalData);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ----------------------------- RESET ROUTE ----------------------------- */
ConfigRouter.post("/reset", (req, res) => {
  try {
    const config = loadConfig();

    for (const key of requiredKeys) {
      config[key] = ""; // ⭐ Remove value
    }

    saveConfig(config);

    res.json({ message: "Selected config values reset!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default ConfigRouter;











// import express from "express";
// import fs from "fs";
// import path from "path";
// import { fileURLToPath } from "url";
// import { encrypt, decrypt } from "../utils/crypto.js";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// export const ConfigRouter = express.Router();

// const CONFIG_PATH = path.join(__dirname, "../config.json");

// // Required Keys
// const requiredKeys = [
//   "MASAI_ADMIN_LMS_USER_EMAIL",
//   "MASAI_ADMIN_LMS_USER_PASSWORD",
//   "MASAI_ASSESS_PLATFORM_USER_EMAIL",
//   "MASAI_ASSESS_PLATFORM_USER_PASSWORD",
//   "GOOGLE_SHEET_ID",
// ];

// /* ----------------------------- LOAD JSON ----------------------------- */
// function loadConfig() {
//   if (!fs.existsSync(CONFIG_PATH)) {
//     fs.writeFileSync(CONFIG_PATH, "{}");
//   }
//   const data = fs.readFileSync(CONFIG_PATH, "utf8");
//   return JSON.parse(data || "{}");
// }

// /* ----------------------------- SAVE JSON ----------------------------- */
// function saveConfig(json) {
//   fs.writeFileSync(CONFIG_PATH, JSON.stringify(json, null, 2));
// }

// /* ----------- CHECK IF STRING IS ALREADY ENCRYPTED (IV:HEX FORMAT) ----------- */
// function isEncrypted(value) {
//   if (!value || typeof value !== "string") return false;
//   if (!value.includes(":")) return false;

//   const [iv, enc] = value.split(":");

//   return /^[0-9a-fA-F]+$/.test(iv) && /^[0-9a-fA-F]+$/.test(enc);
// }

// /* ----------------------------- SAVE ROUTE ----------------------------- */
// ConfigRouter.post("/save", (req, res) => {
//   try {
//     // Validate all required fields present
//     for (const key of requiredKeys) {
//       if (!req.body[key]) {
//         return res.status(400).json({ message: `Missing: ${key}` });
//       }
//     }

//     const config = loadConfig();

//     for (const key of requiredKeys) {
//       let value = req.body[key];

//       if (key.toLowerCase().includes("password")) {
//         // 🔥 Prevent double encryption
//         if (!isEncrypted(value)) {
//           value = encrypt(value);
//         }
//       }

//       config[key] = value;
//     }

//     saveConfig(config);

//     res.json({ message: "Saved successfully!" });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

// /* ----------------------------- READ ROUTE ----------------------------- */
// ConfigRouter.get("/read", (req, res) => {
//   try {
//     const config = loadConfig();
//     const finalData = {};

//     for (const key of requiredKeys) {
//       let value = config[key] || "";

//       // 🔓 Decrypt passwords only
//       if (key.toLowerCase().includes("password") && isEncrypted(value)) {
//         try {
//           value = decrypt(value);
//         } catch {
//           value = "";
//         }
//       }

//       finalData[key] = value;
//     }

//     console.log("🚀 ~ finalData:", finalData);
//     res.json(finalData);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

// /* ----------------------------- RESET ROUTE ----------------------------- */
// ConfigRouter.post("/reset", (req, res) => {
//   try {
//     const config = loadConfig();

//     for (const key of requiredKeys) {
//       config[key] = "";
//     }

//     saveConfig(config);

//     res.json({ message: "Selected config values reset!" });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

// export default ConfigRouter;