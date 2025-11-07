import { Worker } from "bullmq";
import { chromium } from "playwright";
import dotenv from "dotenv";
import { connection } from "../../configs/redis_bullmq.config.js";
import { createAssignment } from "../createAssignment.js";

dotenv.config();
console.log("This Queue is Running for Assignment Creation ✅");
const assignmentWorker = new Worker(
  "assignmentCreationQueue",
  async (job) => {
    const { assignments } = job.data;

    if (!assignments || assignments.length === 0) {
      console.log("⚠️ No assignments to process.");
      return;
    }

    // 🧭 Launch browser once
    const browser = await chromium.launch({ headless: false, slowMo: 100 });
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
    });
    ///
    try {
      console.log("🔐 Logging into Assessment Platform...");
      await page.goto(process.env.MASAI_ADMIN_LMS_URL, {
        waitUntil: "networkidle",
      });
      await page.fill(
        'input[type="email"]',
        process.env.MASAI_ADMIN_LMS_USER_EMAIL
      );
      await page.fill(
        'input[type="password"]',
        process.env.MASAI_ADMIN_LMS_USER_PASSWORD
      );
      await page.click('button[type="submit"]');
      await page.waitForNavigation({ waitUntil: "networkidle" });
      console.log(" ✅ Login successful");

      //////// creation logic
      for (const a of assignments) {
        const redisKey = `assignment:${a.assesment_template_name}`;
        const status = await createAssignment(page, a);

        await connection.hset(redisKey, {
          isAssignmentCreated: status === "Done" ? "true" : "false",
          assignmentCreationError: status === "Error" ? "Creation failed" : "",
          lastUpdated: new Date().toISOString(),
        });
      }

      /// the below logic should change for Assignment creation
      // Process all assignments sequentially
      //   for (const a of assignments) {
      //     if ((a.isCloned || "").toLowerCase() === "yes") {
      //       console.log(`⏩ Skipping already cloned: ${a.assesment_template_name}`);
      //       continue;
      //     }

      //     console.log(`🚀 Starting clone for: ${a.assesment_template_name}`);

      //     const status = await cloneAndEditAssessment(
      //       page,
      //       a.previous_assessment_templateName,
      //       a.assesment_template_name
      //     );

      //     // Optionally update Redis to track progress
      //     const redisKey = `assignment:${a.assesment_template_name}`;
      //     await connection.hset(redisKey, "isCloned", status === "Done" ? "yes" : "error");
      //     await connection.hset(redisKey, "lastUpdated", new Date().toISOString());

      //     console.log(`✅ ${a.assesment_template_name} → ${status}`);
      //   }

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
