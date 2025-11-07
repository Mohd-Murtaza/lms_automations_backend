// config/queues.js or wherever you're maintaining this
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// 🧭 Shared Redis connection (same instance for all queues)
export const connection = new IORedis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASS || undefined,
  maxRetriesPerRequest: null, // ✅ Required by BullMQ
});

// 🎯 Define and export queues
export const assessmenCloneRenameQueue = new Queue('assessmenCloneRenameQueue', { connection });
export const assignmentCreationQueue = new Queue('assignmentCreationQueue', { connection });
export const notesUpdationQueue = new Queue('notesUpdationQueue', { connection });
// (optional) — if you plan to add more related queues later:
//export const automationEventsQueue = new Queue('automationEventsQueue', { connection });

// 🧩 Just for sanity logs
console.log('✅ Queues initialized: automationQueue');
