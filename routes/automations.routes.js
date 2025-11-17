import express from "express";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { getSheetsClient } from "../configs/googleSheetClient.js";
import { assessmentCloneRenameQueue, assignmentCreationQueue, connection, notesUpdationQueue, lectureCreationQueue} from "../configs/redis_bullmq.config.js";
import { batch } from "googleapis/build/src/apis/batch/index.js";
dotenv.config();

export const AutomationRouter = express.Router();

// only read the data from google sheet and add that into the Redis only
AutomationRouter.post("/add-assignment-data", async (req, res) => {
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    console.log("🚀 ~ spreadsheetId:", spreadsheetId)
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
    console.log("🚀 ~ records:", records)

    let success = 0,
      failed = 0;
    
    for (const rec of records) {
      const redisId= rec.lecture_id ? rec.lecture_id : rec.title.replace(/\s+/g, "-").toLowerCase() + "-" + uuidv4();
      rec.redisId=redisId
      console.log("🚀 ~ redisKey:", redisId)
      
      try {
        const redisKey = `assignments:${redisId}`;
        await connection.hset(redisKey, rec);
        success++;
      } catch (err) {
        console.error("❌ Redis insert error:", redisId, err.message);
        failed++;
      }
    }

    return res.json({
      message: "✅ Assignment data loaded into Redis successfully.",
      totalSheetRows: records.length,
      insertedToRedis: success,
      failedRedisInsert: failed,
    });
  } catch (err) {
    console.error("❌ Error reading sheet:", err.message);
    return res.status(500).json({
      message: "Server error while uploading assignment data.",
      error: err.message,
    });
  }
});

AutomationRouter.post("/create-lectures", async (req, res) => {
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = "lecture!A:Z";

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
    console.log("🚀 ~ records:", records)

    let success = 0,
      failed = 0;

    for (const rec of records) {
      const redisId = rec.title.replace(/\s+/g, "-").toLowerCase() + "-" + uuidv4();
      rec.redisId = redisId;
      console.log("🚀 ~ redisKey:", redisId)
      
      try {
        const redisKey = `lectures:${redisId}`;
        await connection.hset(redisKey, rec);
        success++;
      } catch (err) {
        console.error("❌ Redis insert error:", redisId, err.message);
        failed++;
      }
    }
    // Step 2️⃣ — Fetch from Redis (after insertion)
    const keys = await connection.keys("lectures:*");
    const allLectures = [];

    for (const key of keys) {
      const data = await connection.hgetall(key);
      if (data && Object.keys(data).length > 0) allLectures.push(data);
    }

    // Step 3 — Queue the job
    const job = await lectureCreationQueue.add("bulkLectureCreateJob", {
      lectures: allLectures,
    });

    // Step 4 — Final response
    return res.json({
      message: "✅ Lecture data loaded & creation job queued successfully.",
      totalSheetRows: records.length,
      insertedToRedis: success,
      failedRedisInsert: failed,
      queuedLectures: allLectures.length,
      jobId: job.id,
    });
  } catch (err) {
    console.error("❌ Error reading sheet:", err.message);
    return res.status(500).json({
      message: "Server error while uploading assignment data.",
      error: err.message,
    });
  }
});

AutomationRouter.post("/clone-assessment-template", async (req, res) => {
  try {
    // Fetch all assignment data from Redis
    const keys = await connection.keys("assignments:*");
    const allAssignments = [];

    for (const key of keys) {
      const data = await connection.hgetall(key);
      if (data && Object.keys(data).length > 0) {
        allAssignments.push(data);
      }
    }

    if (allAssignments.length === 0) {
      return res.status(404).json({ message: "No assignment data found in Redis." });
    }

    // Filter only those which are not cloned yet
    const pendingAssignments = allAssignments.filter(
      (a) => (a.isCloned || "").toLowerCase() === "no"
    );

    if (pendingAssignments.length === 0) {
      return res.status(200).json({ message: "✅ All assignments are already cloned." });
    }

    // Queue cloning jobs
    const job = await assessmentCloneRenameQueue.add("bulkAssessmentCloneJob", {
      assignments: pendingAssignments,
    });

    return res.json({
      message: "✅ Assessment cloning job queued successfully.",
      queuedAssignments: pendingAssignments.length,
      jobId: job.id,
    });
  } catch (err) {
    console.error("❌ Error while queuing clone jobs:", err.message);
    return res.status(500).json({
      message: "Server error while queuing assessment clone job.",
      error: err.message,
    });
  }
});


AutomationRouter.post("/create-assignments", async (req, res) => {
  try {
    // Step 1️⃣ — Get all assignment data from Redis
    const keys = await connection.keys("assignments:*");
    const allAssignments = [];

    for (const key of keys) {
      const data = await connection.hgetall(key);
      if (data && Object.keys(data).length > 0) {
        allAssignments.push(data);
      }
    }
    
    // console.log("🚀 ~ allAssignments:", allAssignments)
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
    console.log("all pending assignments are here ==>", pendingAssignments)
    if (pendingAssignments.length === 0) {
      return res.status(200).json({
        message: "All cloned assignments already have been created.",
      });
    }
    console.log("📚 these are the pending assignments =>",pendingAssignments)
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
    const keys = await connection.keys("assignments:*");
    const allLectures = [];

    for (const key of keys) {
      const data = await connection.hgetall(key);
      if (data && Object.keys(data).length > 0) {
        allLectures.push(data);
      }
    }

    if (allLectures.length === 0) {
      return res.status(404).json({ message: "No assignments found in Redis" });
    }

    // Step 2️⃣ — Filter only those whose notes are not updated yet
    const pendingNotesToUpdate = allLectures.filter(
      (a) =>
        !a.isNotesUpdated ||
        (a.isNotesUpdated && a.isNotesUpdated.toLowerCase() !== "true")
    );

    console.log("Pending notes to update:", pendingNotesToUpdate.length);

    if (pendingNotesToUpdate.length === 0) {
      return res.status(200).json({
        message: "✅ All Lectures already have updated notes.",
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
    const keys = await connection.keys("assignments:*");

    if (keys.length === 0) {
      return res.status(404).json({ message: "No assignment data found in Redis." });
    }

    const allAssignments = [];
    for (const key of keys) {
      const data = await connection.hgetall(key);
      if (data && Object.keys(data).length > 0) {
        allAssignments.push({
          title: data.title || key.replace("assignment:", ""),
          batch:data.batch,
          section:data.section,
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

AutomationRouter.patch("/update-automation-status", async (req, res) => {
  try {
    const { title, field, newValue } = req.body;

    if (!title || !field || typeof newValue === "undefined") {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Find the Redis key
    const redisKey = `assignments:${redisId}`;

    // Check if key exists
    const exists = await connection.exists(redisKey);
    if (!exists) {
      return res.status(404).json({ message: `No record found for ${title}` });
    }

    // Normalize the field names between frontend & Redis
    let redisField;
    switch (field) {
      case "assessmentClone":
        redisField = "isCloned";
        break;
      case "assignmentCreated":
        redisField = "isAssignmentCreated";
        break;
      case "notesUpdated":
        redisField = "isNotesUpdated";
        break;
      default:
        return res.status(400).json({ message: "Invalid field name" });
    }

    // Update the field in Redis
    await connection.hset(redisKey, redisField, newValue);

    return res.json({
      message: `✅ ${redisField} updated successfully for ${title}`,
      updatedField: redisField,
      newValue,
    });
  } catch (err) {
    console.error("❌ Error updating automation status:", err.message);
    return res.status(500).json({
      message: "Server error while updating automation status",
      error: err.message,
    });
  }
});


// ✅ Clear all Redis data related to automation
AutomationRouter.delete("/cleardata", async (req, res) => {
  try {
    // Delete all assignment keys
    const assignmentKeys = await connection.keys("assignments:*");
    if (assignmentKeys.length > 0) {
      await connection.del(assignmentKeys);
      console.log(`🧹 Deleted ${assignmentKeys.length} assignment keys`);
    }

    // Clear all queues (BullMQ keys)
    const queuesToClear = [
      "assessmentCloneRenameQueue",
      "assignmentCreationQueue",
      "notesUpdationQueue",
      "lectureCreationQueue"
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