import { Worker } from "bullmq";
import { chromium } from "playwright";
import dotenv from "dotenv";
import { connection } from "../../configs/redis_bullmq.config.js";
import { createAssignment } from "../createAssignment.js";
import { decrypt } from "../crypto.js";
import { updateSheetCell } from "../updateSheet.js";
import { getConfig } from "../getConfig.js";
const { MASAI_ADMIN_LMS_USER_EMAIL, MASAI_ADMIN_LMS_USER_PASSWORD, GOOGLE_SHEET_ID} = getConfig()

dotenv.config();
console.log("This Queue is Running for Assignment Creation ✅");
const assignmentWorker = new Worker(
  "assignmentCreationQueue",
  async (job) => {
    const { assignments } = job.data;
    console.log("🚀 ~ assignments from queue:", assignments)

    if (!assignments || assignments.length === 0) {
      console.log("⚠️ No assignments to process.");
      return;
    }

    // 🧭 Launch browser once
    const browser = await chromium.launch({
      headless: false,
      slowMo: 100,
      args: ["--start-maximized"],
    });

    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();
    ///
    try {
      console.log("🔐 Logging into Assessment Platform...");
      await page.goto(process.env.MASAI_ADMIN_LMS_URL, {
        waitUntil: "networkidle",
      });
      await page.fill(
        'input[type="email"]',
        MASAI_ADMIN_LMS_USER_EMAIL
      );
      await page.fill(
        'input[type="password"]',
        decrypt(MASAI_ADMIN_LMS_USER_PASSWORD)
      );
      await page.click('button[type="submit"]');
      await page.waitForNavigation({ waitUntil: "networkidle" });
      console.log(" ✅ Login successful");

      //////// creation logic
      for(const a of assignments){
        const redisKey = `assignments:${a.redisId}`;
        const status = await createAssignment(page, a);
        const isAssignmentCreatedValue = status === "Done" ? "yes" : "no";
        await connection.hset(redisKey, {
          isAssignmentCreated: isAssignmentCreatedValue,
          assignmentCreationError: status === "Error" ? "Creation failed" : "",
          lastUpdated: new Date().toISOString(),
        });
        // Update Sheet
        await updateSheetCell(
          GOOGLE_SHEET_ID,
          "assignment",
          a.redisId,
          "isAssignmentCreated",
          isAssignmentCreatedValue
        );

        console.log(`✅ ${a.title} → ${status}`);
      }
      

      console.log("🎯 All queued assignments processed successfully!");
    } catch (err) {
      console.error("❌ Worker runtime error:", err.message);
    } finally {
      await browser.close();
      console.log("🪟 Browser closed.");
    }
  },
  { connection }
);
