const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const db = require('../../utils/db');
const jobs = require('../../config/jobs.json');
const { checkDurationCooldown, setDurationCooldown, getCooldownEmbed } = require('../../utils/cooldownManager');

const ITEMS_PER_PAGE = 5;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Work shifts to earn money and unlock better jobs.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all available jobs.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('apply')
                .setDescription('Apply for a job.')
                .addStringOption(option =>
                    option.setName('job')
                        .setDescription('The job to apply for')
                        .setRequired(true)
                        .setAutocomplete(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('resign')
                .setDescription('Resign from your current job.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stars')
                .setDescription('View your job mastery progress.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('shift')
                .setDescription('Start a work shift.')),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const userId = interaction.user.id;
        const userData = db.getUser(userId);
        const totalShifts = userData.total_shifts_completed || 0;

        // Filter jobs user can unlock (req_shifts <= totalShifts)
        const unlockedJobs = jobs.filter(job => totalShifts >= job.req_shifts && job.name.toLowerCase().includes(focusedValue));

        await interaction.respond(
            unlockedJobs.slice(0, 25).map(job => ({ name: job.name, value: job.id }))
        );
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'list') {
            await this.handleList(interaction);
        } else if (subcommand === 'apply') {
            await this.handleApply(interaction);
        } else if (subcommand === 'resign') {
            await this.handleResign(interaction);
        } else if (subcommand === 'stars') {
            await this.handleStars(interaction);
        } else if (subcommand === 'shift') {
            await this.handleShift(interaction);
        }
    },

    async handleList(interaction) {
        const userData = db.getUser(interaction.user.id);
        const totalShifts = userData.total_shifts_completed || 0;
        let currentPage = 0;
        const maxPages = Math.ceil(jobs.length / ITEMS_PER_PAGE);

        const generateEmbed = (page) => {
            const start = page * ITEMS_PER_PAGE;
            const end = start + ITEMS_PER_PAGE;
            const currentJobs = jobs.slice(start, end);

            let desc = 'Jobs with <:CX:1071484097957994587> next to them are locked.\n\n';

            currentJobs.forEach(job => {
                const isUnlocked = totalShifts >= job.req_shifts;
                const statusEmoji = isUnlocked ? '<:CY:1071484103762915348>' : '<:CX:1071484097957994587>';
                const timeString = `${job.cooldown}m`; // job.cooldown is in minutes from JSON

                desc += `${statusEmoji} ${job.emoji} **${job.name}**\n`;
                desc += `<:ReplyCont:1457839483541127208>Shifts Required Per Day: \`${job.daily_req}\`\n`;
                desc += `<:ReplyCont:1457839483541127208>Time Between Shifts : \`${timeString}\`\n`;
                desc += `<:ReplyCont:1457839483541127208>Total Shifts Required To Unlock: \`${job.req_shifts}\`\n`;
                desc += `<:Reply:1457839486011445391>Salary: \`֍ ${job.salary.toLocaleString()} per shift\`\n\n`;
            });

            return new EmbedBuilder()
                .setTitle('Available Jobs')
                .setDescription(desc)
                .setColor(0x0099FF)
                .setFooter({ text: `Page ${page + 1} of ${maxPages}` });
        };

        const getComponents = (page) => {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('prev_page').setLabel('Previous').setStyle(ButtonStyle.Primary).setDisabled(page === 0),
                new ButtonBuilder().setCustomId('next_page').setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(page >= maxPages - 1)
            );
            return [row];
        };

        const response = await interaction.reply({
            embeds: [generateEmbed(currentPage)],
            components: getComponents(currentPage),
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'This is not your list!', flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'prev_page') currentPage--;
            if (i.customId === 'next_page') currentPage++;

            await i.update({
                embeds: [generateEmbed(currentPage)],
                components: getComponents(currentPage)
            });
        });
    },

    async handleApply(interaction) {
        const jobId = interaction.options.getString('job');
        const userData = db.getUser(interaction.user.id);

        if (userData.job_id) {
            const embed = new EmbedBuilder()
                .setTitle('Already Employed')
                .setDescription('You already have a job! Use `/work resign` first.')
                .setColor(0xFF0000);
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        const job = jobs.find(j => j.id === jobId);
        if (!job) {
            const embed = new EmbedBuilder()
                .setTitle('Invalid Job')
                .setDescription('That job does not exist.')
                .setColor(0xFF0000);
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        const totalShifts = userData.total_shifts_completed || 0;
        if (totalShifts < job.req_shifts) {
            const embed = new EmbedBuilder()
                .setTitle('Job Locked')
                .setDescription(`You need **${job.req_shifts}** total shifts to apply for this job. You only have **${totalShifts}**.`)
                .setColor(0xFF0000);
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        db.setJob(interaction.user.id, job.id);

        const embed = new EmbedBuilder()
            .setTitle("You're Hired!")
            .setDescription(`Congratulations, you are now working as a **${job.name}**\n\nYou're required to work at least **${job.daily_req}** times a day via \`/work shift\`, or you'll be fired.\nYou start now, and your salary starts at **֍ ${job.salary.toLocaleString()}** per shift.`)
            .setColor(0x00FF00);

        await interaction.reply({ embeds: [embed] });
    },

    async handleResign(interaction) {
        const userData = db.getUser(interaction.user.id);
        if (!userData.job_id) {
            const embed = new EmbedBuilder()
                .setTitle('Unemployed')
                .setDescription('You don\'t have a job to resign from.')
                .setColor(0xFF0000);
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        const job = jobs.find(j => j.id === userData.job_id);

        const embed = new EmbedBuilder()
            .setTitle('Resignation Confirmation')
            .setDescription(`Are you sure you want to resign from your position as a **${job ? job.name : 'Unknown Job'}**?`)
            .setColor(0xFFFF00);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_resign').setLabel('Yes, Resign').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cancel_resign').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
        );

        const response = await interaction.reply({
            embeds: [embed],
            components: [row],
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) return i.reply({ content: 'Not your confirmation.', flags: MessageFlags.Ephemeral });

            if (i.customId === 'confirm_resign') {
                db.removeJob(interaction.user.id);
                const successEmbed = new EmbedBuilder()
                    .setTitle('Resigned')
                    .setDescription('You have successfully resigned from your job.')
                    .setColor(0x00FF00);
                await i.update({ embeds: [successEmbed], components: [] });
            } else {
                const cancelEmbed = new EmbedBuilder()
                    .setTitle('Cancelled')
                    .setDescription('Resignation cancelled.')
                    .setColor(0x00AAFF);
                await i.update({ embeds: [cancelEmbed], components: [] });
            }
            collector.stop();
        });
    },

    async handleStars(interaction) {
        // Quick DB update for job stars if not exists
        try {
            db.prepare(`
                CREATE TABLE IF NOT EXISTS user_job_stats (
                    user_id TEXT,
                    job_id TEXT,
                    stars INTEGER DEFAULT 0,
                    PRIMARY KEY (user_id, job_id)
                )
            `).run();
        } catch (e) {}

        // Helper to get stars
        const getJobStars = (userId) => {
            return db.prepare('SELECT * FROM user_job_stats WHERE user_id = ?').all(userId);
        };

        const userStars = getJobStars(interaction.user.id);

        let desc = '> Earn stars by getting 10 promotions!\n\n';

        if (userStars.length === 0) {
            desc += 'You haven\'t earned any stars yet.';
        } else {
            userStars.forEach(stat => {
                const jobName = jobs.find(j => j.id === stat.job_id)?.name || 'Unknown Job';
                desc += `\` ${stat.stars} ⭐ \` **${jobName}**\n`;
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('Work Stars')
            .setDescription(desc)
            .setColor(0xFFD700)
            .setFooter({ text: 'Page 1 of 1' });

        await interaction.reply({ embeds: [embed] });
    },

    async handleShift(interaction) {
        const userId = interaction.user.id;
        const userData = db.getUser(userId);

        if (!userData.job_id) {
            const embed = new EmbedBuilder()
                .setTitle('Unemployed')
                .setDescription('You need a job to work! Use `/work apply` to find one.')
                .setColor(0xFF0000);
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        const job = jobs.find(j => j.id === userData.job_id);
        // Fallback
        if (!job) {
             return interaction.reply({ content: 'Error: Job data not found.', flags: MessageFlags.Ephemeral });
        }

        // Check Cooldown
        const defaultCooldownSeconds = job.cooldown * 60; // minutes to seconds
        const premiumCooldownSeconds = Math.floor(defaultCooldownSeconds / 2); // 50%

        const cooldown = checkDurationCooldown(userId, 'work_shift');
        if (cooldown.onCooldown) {
            const readyUnix = Math.floor(cooldown.readyAt / 1000);

            // Format minutes string
            const defaultMins = `${Math.floor(defaultCooldownSeconds / 60)} minutes`;
            const premiumMins = `${Math.floor(premiumCooldownSeconds / 60)} minutes`;

            // Custom embed format for Work Shift as requested
            const embed = new EmbedBuilder()
                .setTitle("Easy tiger, let's not rush")
                .setDescription(`### You can start your next shift again <t:${readyUnix}:R>.\nThe __default__ cooldown for working as **${job.name}** is **${defaultMins}**\nThe __premium__ cooldown for working as **${job.name}** is **${premiumMins}**`)
                .setColor(0xFF0000);
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        // Minigame Selection
        const gameType = Math.random() < 0.5 ? 'RPS' : 'TicTacToe';

        if (gameType === 'RPS') {
            await this.playRPS(interaction, job, userData, defaultCooldownSeconds, premiumCooldownSeconds);
        } else {
            await this.playTicTacToe(interaction, job, userData, defaultCooldownSeconds, premiumCooldownSeconds);
        }
    },

    async playRPS(interaction, job, userData, defaultSeconds, premiumSeconds) {
        const embed = new EmbedBuilder()
            .setTitle('Work Shift: RPS')
            .setDescription('Your shift has started! Beat the boss at RPS to finish work!')
            .setColor(0x0099FF);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rps_rock').setLabel('Rock').setStyle(ButtonStyle.Primary).setEmoji('🪨'),
            new ButtonBuilder().setCustomId('rps_paper').setLabel('Paper').setStyle(ButtonStyle.Primary).setEmoji('📄'),
            new ButtonBuilder().setCustomId('rps_scissors').setLabel('Scissors').setStyle(ButtonStyle.Primary).setEmoji('✂️')
        );

        const response = await interaction.reply({
            embeds: [embed],
            components: [row],
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) return i.reply({ content: 'Not your shift!', flags: MessageFlags.Ephemeral });

            const userChoice = i.customId.replace('rps_', '');
            const choices = ['rock', 'paper', 'scissors'];
            const botChoice = choices[Math.floor(Math.random() * choices.length)];

            let result = 'draw';
            if (
                (userChoice === 'rock' && botChoice === 'scissors') ||
                (userChoice === 'paper' && botChoice === 'rock') ||
                (userChoice === 'scissors' && botChoice === 'paper')
            ) {
                result = 'win';
            } else if (userChoice !== botChoice) {
                result = 'lose';
            }

            await this.finishShift(i, result === 'win', job, userData, defaultSeconds, premiumSeconds);
            collector.stop();
        });
    },

    async playTicTacToe(interaction, job, userData, defaultSeconds, premiumSeconds) {
        // Simple 3x3 grid logic
        let board = Array(9).fill(null);

        const getBoardComponents = (disabled = false) => {
            const rows = [];
            for (let r = 0; r < 3; r++) {
                const row = new ActionRowBuilder();
                for (let c = 0; c < 3; c++) {
                    const idx = r * 3 + c;
                    const val = board[idx];
                    const label = val ? val : '-';
                    const style = val === 'X' ? ButtonStyle.Success : (val === 'O' ? ButtonStyle.Danger : ButtonStyle.Secondary);

                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`ttt_${idx}`)
                            .setLabel(label)
                            .setStyle(style)
                            .setDisabled(disabled || val !== null)
                    );
                }
                rows.push(row);
            }
            return rows;
        };

        const embed = new EmbedBuilder()
            .setTitle('Work Shift: Tic-Tac-Toe')
            .setDescription('Your shift has started! Win Tic-Tac-Toe to finish work!\nYou are **X**.')
            .setColor(0x0099FF);

        const response = await interaction.reply({
            embeds: [embed],
            components: getBoardComponents(),
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) return i.reply({ content: 'Not your shift!', flags: MessageFlags.Ephemeral });

            const idx = parseInt(i.customId.replace('ttt_', ''));
            board[idx] = 'X';

            // Check Win
            if (this.checkTTTWin(board, 'X')) {
                await this.finishShift(i, true, job, userData, defaultSeconds, premiumSeconds);
                collector.stop();
                return;
            }

            // Check Draw (Full board)
            if (!board.includes(null)) {
                await this.finishShift(i, false, job, userData, defaultSeconds, premiumSeconds); // Draw = Partial
                collector.stop();
                return;
            }

            // AI Move (Simple Random blocking not implemented for brevity, just random empty slot)
            const emptyIndices = board.map((v, index) => v === null ? index : null).filter(v => v !== null);
            const aiMove = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
            board[aiMove] = 'O';

            // Check Loss
            if (this.checkTTTWin(board, 'O')) {
                await this.finishShift(i, false, job, userData, defaultSeconds, premiumSeconds);
                collector.stop();
                return;
            }

            await i.update({ components: getBoardComponents() });
        });
    },

    checkTTTWin(board, player) {
        const lines = [
            [0,1,2], [3,4,5], [6,7,8], // Rows
            [0,3,6], [1,4,7], [2,5,8], // Cols
            [0,4,8], [2,4,6] // Diags
        ];
        return lines.some(line => line.every(idx => board[idx] === player));
    },

    async finishShift(interaction, success, job, userData, defaultSeconds, premiumSeconds) {
        const userId = interaction.user.id;
        let salary = job.salary;

        if (!success) {
            salary = Math.floor(salary * 0.5);
        }

        db.addBalance(userId, salary);
        db.incrementStat(userId, 'work_earnings', salary);

        // Set Duration Cooldown
        setDurationCooldown(userId, 'work_shift', defaultSeconds, premiumSeconds);

        // Update Job Stats
        db.addShift(userId, Date.now());

        // Check Promotions
        // "Working 10+ shifts in a single day grants 'Promotion Progress'"
        // So if shifts_today becomes 10 (after adding), we add a promotion.
        // Wait, `addShift` increments `shifts_completed_today`.
        // We need to fetch fresh data or increment local var.
        const freshUser = db.getUser(userId);

        // Only trigger exactly on 10th shift? Or 20th? "Working 10+ shifts... grants Promotion Progress".
        // It likely means once per day, after 10 shifts.
        // Or every 10 shifts? "Getting 10 Promotions grants 1 Star".
        // Let's assume once per day when hitting 10.
        if (freshUser.shifts_completed_today === 10) {
            db.addPromotion(userId);
            // Check for Star
            if (freshUser.promotions + 1 >= 10) { // +1 because we just added
                // Reset promotions?
                // Add Star
                try {
                    // Check if entry exists
                    const existing = db.prepare('SELECT * FROM user_job_stats WHERE user_id = ? AND job_id = ?').get(userId, job.id);
                    if (existing) {
                        db.prepare('UPDATE user_job_stats SET stars = stars + 1 WHERE user_id = ? AND job_id = ?').run(userId, job.id);
                    } else {
                        db.prepare('INSERT INTO user_job_stats (user_id, job_id, stars) VALUES (?, ?, 1)').run(userId, job.id);
                    }
                    // Reset promotions on user table? Or keep counting?
                    // Typically you reset progress.
                    db.prepare('UPDATE users SET promotions = 0 WHERE id = ?').run(userId);
                } catch(e) { console.error(e); }
            }
        }

        const embed = new EmbedBuilder();
        if (success) {
            embed.setTitle('Shift Finished')
                .setDescription(`Great work! You received your full salary.\n\n**You Received:**\n- ֍ ${salary.toLocaleString()}`)
                .setColor(0x00FF00)
                .setFooter({ text: `Working as a ${job.name}` });
        } else {
            embed.setTitle('Terrible work!')
                .setDescription('You slacked off and the boss caught you.\n\n**You were given:**\n- ֍ ' + salary.toLocaleString() + ' for a sub-par shift')
                .setColor(0xFF0000)
                .setFooter({ text: `Working as a ${job.name}` });
        }

        await interaction.update({ embeds: [embed], components: [] });
    }
};
