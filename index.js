import { chromium } from "playwright";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  // Commented CSV logic for now
  // const data = await readCSV('./input.csv');
  const browser = await chromium.launch({ headless: false, slowMo: 100 });

  // Use a very large, modern desktop resolution (e.g., 1920x1080 or larger)
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });
  //   const browser = await chromium.launch({ headless: false, slowMo: 100 });
  //   const page = await browser.newPage();

  // Step 1: Login
  console.log("🔐 Logging in...");
  await page.goto(process.env.MASAI_URL);
  await page.waitForSelector('input[type="text"]', { timeout: 10000 });
  await page.fill('input[type="text"]', process.env.MASAI_USER);
  await page.fill('input[type="password"]', process.env.MASAI_PASS);
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: "networkidle" });
  console.log("✅ Login successful");

  // Find the visible modal container first
  const modal = page
    .locator('h2:has-text("Please select a client")')
    .locator(".."); // go up one level
  const dropdown = modal.locator("select.chakra-select");

  // Wait for the dropdown inside the modal
  await dropdown.first().waitFor({ state: "visible", timeout: 10000 });

  // Select "Masai LMS" by label
  await dropdown.first().selectOption({ label: "Masai LMS" });
  console.log('✅ Selected "Masai LMS" from client dropdown');

  // Optional: trigger change event if UI needs it
  await dropdown.first().dispatchEvent("change");

  // Wait for modal to close
  await page.waitForSelector("text=Please select a client", {
    state: "detached",
    timeout: 10000,
  });
  console.log("✅ Modal closed successfully");

  // Go directly to Assessment Templates list page
  console.log("🌐 Navigating to Assessment Templates list...");
  await page.goto(
    "https://assess-admin.masaischool.com/assessment-templates/list?size=10&page=1",
    {
      waitUntil: "networkidle",
      timeout: 30000,
    }
  );
  console.log("✅ Navigated to Assessment Templates page.");

  // Wait for the search input and type "Testing for Automation"
  const searchInput = page.locator('input[placeholder="Search by title"]');
  await searchInput.waitFor({ state: "visible", timeout: 10000 });
  await searchInput.fill("Testing for Automation");
  await page.waitForTimeout(1000); // give time for results to render
  console.log('🔍 Typed "Testing for Automation" into search box.');

  // ✅ Wait for the search results table to appear
  await page.waitForSelector("table", { timeout: 10000 });
  console.log("📋 Search results table appeared.");

  // ✅ Wait for the first clone button to be visible
  const cloneButton = page.locator('button[aria-label="clone"]').first();
  await cloneButton.waitFor({ state: "visible", timeout: 10000 });

  // ✅ Click the first clone button
  await cloneButton.click({ force: true });
  console.log("🧬 Clicked the clone button of the first assessment.");
  /////////
  // ✅ Wait for the clone modal to appear
  await page.waitForSelector('div[role="dialog"]', { timeout: 10000 });
  console.log("🪟 Clone modal appeared.");

  // ✅ Click the "Clone Sections as well" radio label
  const cloneSectionsRadio = page.locator(
    'label:has-text("Clone Sections as well")'
  );
  await cloneSectionsRadio.waitFor({ state: "visible", timeout: 5000 });
  await cloneSectionsRadio.click({ force: true });
  console.log('☑️ Selected "Clone Sections as well" radio option.');

  // ✅ Click the "CONFIRM AND CLONE" button
  const confirmButton = page.locator('button:has-text("CONFIRM AND CLONE")');
  await confirmButton.waitFor({ state: "visible", timeout: 5000 });
  await confirmButton.click({ force: true });
  console.log('✅ Clicked "CONFIRM AND CLONE" button.');

  // ✅ Wait for modal to close (clone complete)
  await page.waitForSelector('div[role="dialog"]', {
    state: "detached",
    timeout: 15000,
  });
  console.log("🎉 Clone completed successfully!");

  await page.goto(
    "https://assess-admin.masaischool.com/assessment-templates/list?size=10&page=1",
    {
      waitUntil: "networkidle",
      timeout: 30000,
    }
  );
  console.log("✅ Navigated to Assessment Templates page.");
  // Wait for the search input and type "Testing for Automation"
  const searchInput2 = page.locator('input[placeholder="Search by title"]');
  await searchInput2.waitFor({ state: "visible", timeout: 10000 });
  await searchInput2.fill("Copy of Testing for Automation");
  await page.waitForTimeout(1000); // give time for results to render
  console.log('🔍 Typed "Testing for Automation" into search box.');
  // ✅ Wait for the search results table to appear
  await page.waitForSelector("table", { timeout: 10000 });
  console.log("📋 Search results table appeared.");
  // ✅ Wait for the first clone button to be visible

  // ✅ Locate the first matching <a> with text "Copy of Testing for Automation"
  const clickButton = page
    .locator('a:has-text("Copy of Testing for Automation")')
    .first();

  // ✅ Wait until it's visible and click it
  await clickButton.waitFor({ state: "visible", timeout: 10000 });
  await clickButton.click({ force: true });
  console.log('🧬 Clicked on "Copy of Testing for Automation" link.');

  /////////////////
  // ✅ Wait for and click the "EDIT" button
  const editButton = page.locator('button:has-text("EDIT")');
  await editButton.waitFor({ state: "visible", timeout: 10000 });
  await editButton.click({ force: true });
  console.log("📝 Clicked the EDIT button.");

  // ✅ Wait for the input with placeholder "Assessment Title"
  const titleInput = page.locator('input[placeholder="Assessment Title"]');
  await titleInput.waitFor({ state: "visible", timeout: 10000 });

  // ✅ Clear existing text and type new title
  await titleInput.fill("Testing for Automation");
  console.log('✏️ Updated Assessment Title to "Testing for Automation".');

  // ✅ Wait for the "UPDATE" button to appear
  const updateButton = page.locator('button:has-text("UPDATE")');
  await updateButton.waitFor({ state: "visible", timeout: 10000 });

  // ✅ Click the button to save the changes
  await updateButton.click({ force: true });
  console.log('💾 Clicked the "UPDATE" button and saved the changes.');

  // ✅ Optional: wait for a success toast or navigation
  await page.waitForTimeout(3000); // give time for update to complete
  console.log("🎉 Assessment updated successfully!");
}

main();
//
