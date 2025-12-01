import fs from "fs";
export function getConfig() {
  return JSON.parse(fs.readFileSync("./config.json", "utf8"));
}
