import { chromium } from "playwright";
import fs from "fs";
import csv from "csv-parser";
import dotenv from "dotenv";

dotenv.config();

// ---------- Utility: Read + Write CSV ----------
async function readCSV(filePath) {
  const results = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", reject);
  });
}

async function writeCSV(filePath, data) {
  const header = Object.keys(data[0]).join(",") + "\n";
  const rows = data.map((row) => Object.values(row).join(",")).join("\n");
  await fs.promises.writeFile(filePath, header + rows);
}

// ---------- Core Automation ----------
async function cloneAndEditAssessment(page, previousTitle, currentTitle) {
  try {
    // Navigate to assessment list
    await page.goto(
      "https://assess-admin.masaischool.com/assessment-templates/list?size=10&page=1",
      { waitUntil: "networkidle", timeout: 30000 }
    );

    // Search by title
    const searchInput = page.locator('input[placeholder="Search by title"]');
    await searchInput.waitFor({ state: "visible", timeout: 10000 });
    await searchInput.fill(previousTitle);
    await page.waitForTimeout(1000);
    console.log(`🔍 Searched for "${previousTitle}"`);

    // Click clone
    const cloneButton = page.locator('button[aria-label="clone"]').first();
    await cloneButton.waitFor({ state: "visible", timeout: 10000 });
    await cloneButton.click({ force: true });
    console.log("🧬 Clone initiated");

    // Wait for clone modal
    await page.waitForSelector('div[role="dialog"]', { timeout: 10000 });

    // Select “Clone Sections as well”
    const cloneSectionsRadio = page.locator('label:has-text("Clone Sections as well")');
    await cloneSectionsRadio.click({ force: true });

    // Confirm clone
    const confirmButton = page.locator('button:has-text("CONFIRM AND CLONE")');
    await confirmButton.click({ force: true });
    console.log("✅ Confirmed clone");

    await page.waitForSelector('div[role="dialog"]', { state: "detached", timeout: 15000 });
    console.log("🎉 Clone completed successfully!");

    // Now edit the new clone
    await page.goto(
      "https://assess-admin.masaischool.com/assessment-templates/list?size=10&page=1",
      { waitUntil: "networkidle", timeout: 30000 }
    );

    const searchInput2 = page.locator('input[placeholder="Search by title"]');
    await searchInput2.waitFor({ state: "visible", timeout: 10000 });
    await searchInput2.fill(`Copy of ${previousTitle}`);
    await page.waitForTimeout(1000);

    const clickButton = page.locator(`a:has-text("Copy of ${previousTitle}")`).first();
    await clickButton.waitFor({ state: "visible", timeout: 10000 });
    await clickButton.click({ force: true });

    const editButton = page.locator('button:has-text("EDIT")');
    await editButton.waitFor({ state: "visible", timeout: 10000 });
    await editButton.click({ force: true });

    const titleInput = page.locator('input[placeholder="Assessment Title"]');
    await titleInput.waitFor({ state: "visible", timeout: 10000 });
    await titleInput.fill(currentTitle);

    const updateButton = page.locator('button:has-text("UPDATE")');
    await updateButton.waitFor({ state: "visible", timeout: 10000 });
    await updateButton.click({ force: true });

    await page.waitForTimeout(3000);
    console.log(`✅ Updated "${currentTitle}" successfully`);
    return "Done";
  } catch (err) {
    console.error(`❌ Error for "${currentTitle}": ${err.message}`);
    return "Error";
  }
}

// ---------- Main ----------
async function main() {
  const data = await readCSV("./input.csv");
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  // Login once
  console.log("🔐 Logging in...");
  await page.goto(process.env.MASAI_URL);
  await page.fill('input[type="text"]', process.env.MASAI_USER);
  await page.fill('input[type="password"]', process.env.MASAI_PASS);
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: "networkidle" });
  console.log("✅ Login successful");

  // Select Client: Masai LMS
  const modal = page.locator('h2:has-text("Please select a client")').locator("..");
  const dropdown = modal.locator("select.chakra-select");
  await dropdown.first().waitFor({ state: "visible", timeout: 10000 });
  await dropdown.first().selectOption({ label: "Masai LMS" });
  await dropdown.first().dispatchEvent("change");
  await page.waitForSelector("text=Please select a client", { state: "detached" });
  console.log("✅ Selected client 'Masai LMS'");

  // Iterate over assessments
  for (const row of data) {
    if (row.status && row.status.toLowerCase() === "done") {
      console.log(`⏩ Skipping already completed: ${row.title}`);
      continue;
    }
    row.status = await cloneAndEditAssessment(page, row.previousTitle, row.currentTitle);
    await writeCSV("./input.csv", data);
  }

  await browser.close();
  console.log("🎯 All assessments processed successfully!");
}

main();
