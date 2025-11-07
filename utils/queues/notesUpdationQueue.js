import { Worker } from "bullmq";
import { chromium } from "playwright";
import dotenv from "dotenv";
import { connection } from "../../configs/redis_bullmq.config.js";
import { updateNotes } from "../notesUpdation.js";

dotenv.config();
console.log("This Queue is Running for Notes Updation ✅");
const notesUpdationWorker = new Worker(
  "notesUpdationQueue",
  async (job) => {
    const { lectures } = job.data;

    if (!lectures || lectures.length === 0) {
      console.log("⚠️ No lectures to process.");
      return;
    }

    // 🧭 Launch browser once
    const browser = await chromium.launch({ headless: false, slowMo: 100 });
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
    });

    try {
      console.log("🔐 Logging into LMS...");
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
      console.log("✅ LMS Login successful");

      //////// 🧠 Start updating notes
      for (const lecture of lectures) {
        const redisKey = `assignment:${lecture.assesment_template_name}`;
        console.log(
          `🧾 Processing Lecture: ${lecture.assesment_template_name}`
        );

        const status = await updateNotes(page, lecture);
        console.log(`📋 updateNotes returned: ${status}`);

        await connection.hset(redisKey, {
          isNotesUpdated: status === "Done" ? "true" : "false",
          isNotesUpdatedError: status === "Error" ? "Failed To Update" : "",
          lastUpdated: new Date().toISOString(),
        });
        console.log(
          `📦 Redis updated for assignment: ${lecture.assesment_template_name}`
        );
       
      }

      console.log("🎯 All lectures processed successfully!");
    } catch (err) {
      console.error("❌ Worker runtime error:", err.message);
    } finally {
      await browser.close();
      console.log("🪟 Browser closed.");
    }
  },
  { connection, concurrency: 1 } // 👈 Sequential for stability
);


