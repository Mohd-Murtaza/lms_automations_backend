import express from "express";
import dotenv from "dotenv";
import { getSheetsClient } from "../configs/googleSheetClient.js";
import { assessmenCloneRenameQueue, assignmentCreationQueue, connection, notesUpdationQueue} from "../configs/redis_bullmq.config.js";
import { batch } from "googleapis/build/src/apis/batch/index.js";
dotenv.config();

export const AutomationRouter = express.Router();

AutomationRouter.post("/add-assignment-data", async (req, res) => {
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_FOR_ASSIGNMENT;
    const range = "Sheet1!A:Z";

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.status(400).json({ message: "No data found in sheet" });
    }

    const headers = rows[0];
    const records = rows.slice(1).map((row) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = row[i] || ""));
      return obj;
    });

    let success = 0,
      failed = 0;

    // Store all in Redis hash: key per assignment template name
    for (const rec of records) {
      try {
        const redisKey = `assignment:${rec.assesment_template_name}`;

        // store object in Redis as a hash
        await connection.hset(redisKey, rec);
        success++;
      } catch (err) {
        console.error(
          "❌ Redis insert error for:",
          rec.assesment_template_name,
          err.message
        );
        failed++;
      }
    }

    // Get only isCloned = "no"
    const keys = await connection.keys("assignment:*");
    const pendingAssignments = [];

    for (const key of keys) {
      const data = await connection.hgetall(key);
      if ((data.isCloned || "").toLowerCase() === "no") {
        pendingAssignments.push(data);
      }
    }
    
    // Add ONE job with all non-cloned assignments
    if (pendingAssignments.length > 0) {
      await assessmenCloneRenameQueue.add("bulkAssessmentCloneJob", {
        assignments: pendingAssignments,
      });
    }

    return res.json({
      message:
        "✅ Assignment data loaded and pending tasks queued for automation",
      totalSheetRows: records.length,
      insertedToRedis: success,
      failedRedisInsert: failed,
      queuedForAutomation: pendingAssignments.length,
    });
  } catch (err) {
    console.error("❌ Error reading sheet or queuing data:", err.message);
    return res.status(500).json({
      message: "Server error while uploading / queuing assessments",
      error: err.message,
    });
  }
});

AutomationRouter.post("/create-assignments", async (req, res) => {
  try {
    // Step 1️⃣ — Get all assignment data from Redis
    const keys = await connection.keys("assignment:*");
    const allAssignments = [];

    for (const key of keys) {
      const data = await connection.hgetall(key);
      if (data && Object.keys(data).length > 0) {
        allAssignments.push(data);
      }
    }

    if (allAssignments.length === 0) {
      return res.status(404).json({ message: "No assignments found in Redis" });
    }

    // Step 2️⃣ — Filter only cloned ones that are not yet created
    const pendingAssignments = allAssignments.filter(
      (a) =>
        a.isCloned &&
        a.isCloned.toLowerCase() === "yes" &&
        (!a.isAssignmentCreated ||
          a.isAssignmentCreated.toLowerCase() !== "true")
    );

    if (pendingAssignments.length === 0) {
      return res.status(200).json({
        message: "All cloned assignments already have been created.",
      });
    }

    // Step 3️⃣ — Add one job for all pending assignments
    const job = await assignmentCreationQueue.add("bulkAssignmentCreateJob", {
      assignments: pendingAssignments,
    });

    return res.json({
      message: "✅ Assignment creation job queued successfully.",
      queuedAssignments: pendingAssignments.length,
      jobId: job.id,
    });
  } catch (err) {
    console.error("❌ Error while queuing assignment creation:", err.message);
    return res.status(500).json({
      message: "Server error while adding assignment creation job",
      error: err.message,
    });
  }
});

AutomationRouter.post("/start-update-notes", async (req, res) => {
  try {
    // Step 1️⃣ — Get all assignment data from Redis
    const keys = await connection.keys("assignment:*");
    const allAssignments = [];

    for (const key of keys) {
      const data = await connection.hgetall(key);
      if (data && Object.keys(data).length > 0) {
        allAssignments.push(data);
      }
    }

    if (allAssignments.length === 0) {
      return res.status(404).json({ message: "No assignments found in Redis" });
    }

    // Step 2️⃣ — Filter only those whose notes are not updated yet
    const pendingNotesToUpdate = allAssignments.filter(
      (a) =>
        !a.isNotesUpdated ||
        (a.isNotesUpdated && a.isNotesUpdated.toLowerCase() !== "true")
    );

    console.log("Pending notes to update:", pendingNotesToUpdate.length);

    if (pendingNotesToUpdate.length === 0) {
      return res.status(200).json({
        message: "✅ All Assignments already have updated notes.",
      });
    }

    // Step 3️⃣ — Add one job for all pending notes
    const job = await notesUpdationQueue.add("bulkNotesUpdateJob", {
      lectures: pendingNotesToUpdate, // still calling them 'lectures' for compatibility
    });

    return res.json({
      message: "✅ Notes updation job queued successfully.",
      queuedLectures: pendingNotesToUpdate.length,
      jobId: job.id,
    });
  } catch (err) {
    console.error("❌ Error while queuing notes update:", err.message);
    return res.status(500).json({
      message: "Server error while adding notes update job",
      error: err.message,
    });
  }
});

// ✅ GET all assignment data summaries
AutomationRouter.get("/get-automation-status", async (req, res) => {
  try {
    const keys = await connection.keys("assignment:*");

    if (keys.length === 0) {
      return res.status(404).json({ message: "No assignment data found in Redis." });
    }

    const allAssignments = [];
    for (const key of keys) {
      const data = await connection.hgetall(key);
      if (data && Object.keys(data).length > 0) {
        allAssignments.push({
          title: data.assesment_template_name || key.replace("assignment:", ""),
          batch:data.batch,
          isCloned: data.isCloned || "N/A",
          isAssignmentCreated: data.isAssignmentCreated || "N/A",
          isNotesUpdated: data.isNotesUpdated || "N/A",
        });
      }
    }

    return res.json({
      total: allAssignments.length,
      assignments: allAssignments,
    });
  } catch (err) {
    console.error("❌ Error fetching automation status:", err.message);
    return res.status(500).json({
      message: "Server error while fetching automation status",
      error: err.message,
    });
  }
});

// ✅ Clear all Redis data related to automation
AutomationRouter.delete("/cleardata", async (req, res) => {
  try {
    // Delete all assignment keys
    const assignmentKeys = await connection.keys("assignment:*");
    if (assignmentKeys.length > 0) {
      await connection.del(assignmentKeys);
      console.log(`🧹 Deleted ${assignmentKeys.length} assignment keys`);
    }

    // Clear all queues (BullMQ keys)
    const queuesToClear = [
      "assessmenCloneRenameQueue",
      "assignmentCreationQueue",
      "notesUpdationQueue",
    ];

    for (const q of queuesToClear) {
      const pattern = `bull:${q}:*`;
      const queueKeys = await connection.keys(pattern);
      if (queueKeys.length > 0) {
        await connection.del(queueKeys);
        console.log(`🧼 Cleared queue data for ${q}`);
      }
    }

    return res.json({
      message: "🧹 All assignment and queue data cleared successfully.",
      clearedAssignments: assignmentKeys.length,
    });
  } catch (err) {
    console.error("❌ Error clearing Redis data:", err.message);
    return res.status(500).json({
      message: "Server error while clearing Redis data",
      error: err.message,
    });
  }
});



