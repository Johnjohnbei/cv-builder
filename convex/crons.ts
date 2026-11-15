import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();
crons.weekly('official ATS documentation', { dayOfWeek: 'monday', hourUTC: 7, minuteUTC: 0 }, internal._ai.atsWatch.checkSources);
crons.daily('expire private offer analyses', { hourUTC: 3, minuteUTC: 0 }, internal.ats.cleanExpired);
export default crons;
