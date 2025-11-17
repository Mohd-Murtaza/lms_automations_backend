import crypto from "crypto";

const SECRET_KEY = process.env.PASSWORD_SECRET || "default_secret_key"; // must be 32 bytes for aes-256
const IV = crypto.randomBytes(16); // initialization vector
const ALGO = "aes-256-ctr";

// 🔹 Make SECRET_KEY 32 bytes
const key = crypto.createHash("sha256").update(String(SECRET_KEY)).digest("base64").substr(0, 32);

export function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  // store IV with encrypted text
  return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(hash) {
  const [ivHex, encryptedText] = hash.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
