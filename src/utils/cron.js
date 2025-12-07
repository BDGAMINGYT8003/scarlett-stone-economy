const db = require('./db');
const jobs = require('../config/jobs.json');
const { log } = require('./logger');

const runDailyJobCheck = () => {
    log('Running daily job check...', 'info');

    const usersWithJobs = db.getAllUsersWithJobs();
    let firedCount = 0;

    usersWithJobs.forEach(user => {
        const job = jobs.find(j => j.id === user.job_id);
        if (!job) {
            // Job config missing? Remove job to be safe.
            db.removeJob(user.id);
            return;
        }

        if (user.shifts_completed_today < job.daily_req) {
            db.removeJob(user.id);
            firedCount++;
            // Ideally we would notify the user, but we can't DM them easily without client.users.fetch
            // For now, silent fire.
        } else {
            // Reset shifts for the new day
            db.resetDailyShifts(user.id);
        }
    });

    log(`Daily job check complete. Fired ${firedCount} users.`, 'info');
};

const startCron = () => {
    // Check every minute if it is 6:00 AM UTC
    setInterval(() => {
        const now = new Date();
        if (now.getUTCHours() === 6 && now.getUTCMinutes() === 0) {
            runDailyJobCheck();
        }
    }, 60000);
};

module.exports = { startCron };
