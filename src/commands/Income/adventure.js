const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType, MessageFlags } = require('discord.js');
const db = require('../../utils/db');
const adventures = require('../../config/adventures.json');
const items = require('../../config/items.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('adventure')
        .setDescription('Go on an adventure!'),
    async execute(interaction) {
        const userId = interaction.user.id;

        // --- Phase 1: Selection Screen ---
        const adventureKey = 'halloween';
        const adventureData = adventures[adventureKey];

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('adventure_select')
            .setPlaceholder('Select an Adventure')
            .addOptions([
                { label: adventureData.name, value: adventureKey, description: adventureData.description, emoji: '🎃' }
            ]);

        const startButton = new ButtonBuilder()
            .setCustomId('adventure_start_init')
            .setLabel(`Start (${adventureData.ticket_cost} Adventure Ticket)`)
            .setStyle(ButtonStyle.Success);

        const refreshButton = new ButtonBuilder()
            .setCustomId('adventure_refresh')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Secondary);

        // Check tickets
        const ticketCount = db.getItemCount(userId, 'adventure_ticket');
        if (ticketCount < adventureData.ticket_cost) {
            startButton.setDisabled(true);
        }

        const row1 = new ActionRowBuilder().addComponents(selectMenu);
        const row2 = new ActionRowBuilder().addComponents(startButton, refreshButton);

        // Allowed items visual
        let allowedItemsDesc = '';
        adventureData.allowed_items.forEach(id => {
            const item = items.find(i => i.id === id);
            if (item) allowedItemsDesc += item.emoji;
        });

        const initialEmbed = new EmbedBuilder()
            .setTitle('Choose an Adventure')
            .setDescription(`**Name**\n${adventureData.name}\n\n**Description**\n${adventureData.description}\n\n**Allowed Items**\n${allowedItemsDesc}`)
            // Image handling is ignored as per prompt
            .setFooter({ text: 'Fun Fact: 0 users went on this adventure today!' }) // Placeholder dynamic footer
            .setColor(0xFFA500);

        const response = await interaction.reply({
            embeds: [initialEmbed],
            components: [row1, row2],
            withResponse: true
        });

        const collector = response.resource.message.createMessageComponentCollector({
            filter: i => i.user.id === userId,
            time: 300000 // 5 mins for selection
        });

        // --- Session State ---
        let session = {
            active: false,
            adventure: adventureData,
            equipped: [], // Array of item IDs
            nodeIndex: 0,
            nodes: [], // Shuffled node sequence
            backpack: [], // Items found
            rewards: { coins: 0, items: [] }, // Rewards accumulated (for summary)
            history: [], // Text history? prompt implies active node text replacement
            interactions: 0
        };

        collector.on('collect', async i => {
            if (i.customId === 'adventure_refresh') {
                const newCount = db.getItemCount(userId, 'adventure_ticket');
                if (newCount >= adventureData.ticket_cost) {
                    startButton.setDisabled(false);
                }
                await i.update({ components: [row1, new ActionRowBuilder().addComponents(startButton, refreshButton)] });
            }
            else if (i.customId === 'adventure_start_init') {
                // Deduct tickets
                db.removeItem(userId, 'adventure_ticket', adventureData.ticket_cost);

                // Move to Item Selection
                await showItemSelection(i, session);
            }
            else if (i.customId.startsWith('equip_')) {
                const itemId = i.customId.replace('equip_', '');
                if (session.equipped.includes(itemId)) {
                    session.equipped = session.equipped.filter(id => id !== itemId);
                } else {
                    session.equipped.push(itemId);
                }
                await updateItemSelection(i, session);
            }
            else if (i.customId === 'equip_start') {
                // Start Adventure Loop
                session.active = true;

                // Shuffle nodes: 15 nodes total.
                // Prompt: "6-9 nodes are flavour text only... 6-9 nodes are interactive".
                // We have ~28 nodes in config. We pick 15 random ones.
                const allNodes = [...adventureData.nodes];
                const shuffled = allNodes.sort(() => 0.5 - Math.random());
                session.nodes = shuffled.slice(0, 15);

                // Initial Backpack = Equipped items (removed from inventory?)
                // Prompt: "Lose your items removes a random allowed item from the backpack."
                // Usually in Dank Memer, equipped items are moved to "adventure backpack" temporarily.
                // We will remove them from DB inventory now and restore surviving ones at end.
                for (const itemId of session.equipped) {
                    db.removeItem(userId, itemId, 1);
                    const itemObj = items.find(it => it.id === itemId);
                    if (itemObj) session.backpack.push(itemObj);
                }

                await showNode(i, session);
            }
            else if (i.customId === 'adventure_next') {
                session.nodeIndex++;
                if (session.nodeIndex >= 15) {
                    await showSummary(i, session);
                    collector.stop();
                } else {
                    await showNode(i, session);
                }
            }
            else if (i.customId.startsWith('opt_')) {
                const optIdx = parseInt(i.customId.replace('opt_', ''));
                await handleOption(i, session, optIdx);
            }
            else if (i.customId === 'adventure_backpack') {
                await showBackpack(i, session);
            }
        });

        // --- Helper Functions ---

        async function showItemSelection(i, session) {
            // Get user's inventory count for allowed items
            const userInv = db.getInventory(userId);
            const gridRows = [];
            let currentRow = new ActionRowBuilder();

            adventureData.allowed_items.forEach((itemId, idx) => {
                const item = items.find(it => it.id === itemId);
                const count = userInv.find(inv => inv.item_id === itemId)?.quantity || 0;

                if (item) {
                    const btn = new ButtonBuilder()
                        .setCustomId(`equip_${itemId}`)
                        .setEmoji(item.emoji)
                        .setStyle(session.equipped.includes(itemId) ? ButtonStyle.Primary : ButtonStyle.Secondary)
                        .setDisabled(count === 0);

                    currentRow.addComponents(btn);

                    if (currentRow.components.length === 4 || idx === adventureData.allowed_items.length - 1) {
                        gridRows.push(currentRow);
                        currentRow = new ActionRowBuilder();
                    }
                }
            });

            const controlRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('equip_start').setLabel('Start Adventure').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('equip_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setDisabled(true) // Not impl
            );

            const embed = new EmbedBuilder()
                .setTitle(`${interaction.user.username}, choose items you want to bring along`)
                .setDescription('They can give you extra luck! Be careful though, you might lose them...\n\n**Recommended:**\n- <:VoodooDoll:1024827756300750848> Voodoo Doll\n- <:ScaryMask:1024829726159798272> Scary Mask\n- <a:JackyOLanty:968850393431961630> Jacky o\' Lanty')
                .setColor(0x0099FF);

            await i.update({ embeds: [embed], components: [...gridRows, controlRow] });
        }

        async function updateItemSelection(i, session) {
            // Re-render only components
            await showItemSelection(i, session); // Reuse logic effectively
        }

        async function showNode(i, session) {
            const node = session.nodes[session.nodeIndex];
            session.interactions++;

            // Progress Bar
            const p = session.nodeIndex + 1;
            let footer = '';
            if (p <= 3) footer = '🚀 - ⦾ - ⦾ - ⦾ - ⦾';
            else if (p <= 6) footer = '⦾ - 🚀 - ⦾ - ⦾ - ⦾';
            else if (p <= 9) footer = '⦾ - ⦾ - 🚀 - ⦾ - ⦾';
            else if (p <= 12) footer = '⦾ - ⦾ - ⦾ - 🚀 - ⦾';
            else footer = '⦾ - ⦾ - ⦾ - ⦾ - 🚀';

            const embed = new EmbedBuilder()
                // Title is (No title)
                .setDescription(node.text)
                .setFooter({ text: footer })
                .setColor(0x2F3136);

            const buttons = node.options.map((opt, idx) =>
                new ButtonBuilder()
                    .setCustomId(`opt_${idx}`)
                    .setLabel(opt.label)
                    .setStyle(ButtonStyle.Secondary)
            );

            const controlRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('adventure_backpack').setEmoji('🎒').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('adventure_next').setEmoji('➡️').setStyle(ButtonStyle.Secondary).setDisabled(true)
            );

            // Split options if > 5? Usually 2-3 options.
            const optionRow = new ActionRowBuilder().addComponents(buttons);

            await i.update({ embeds: [embed], components: [optionRow, controlRow] });
        }

        async function handleOption(i, session, optIdx) {
            const node = session.nodes[session.nodeIndex];
            const option = node.options[optIdx];

            // RNG Outcome
            const roll = Math.random() * 100;
            let cumulative = 0;
            let outcome = null;
            for (const out of option.outcomes) {
                cumulative += out.chance;
                if (roll <= cumulative) {
                    outcome = out;
                    break;
                }
            }
            if (!outcome) outcome = option.outcomes[0]; // Fallback

            // Process Outcome
            let resultText = "";
            let ended = false;

            if (outcome.type === 'none') {
                resultText = "Nothing interesting happened.";
            } else if (outcome.type === 'item') {
                const item = items.find(it => it.id === outcome.id);
                if (item) {
                    session.rewards.items.push({ ...item, quantity: outcome.amount });
                    session.backpack.push(item); // Add to backpack logic? Usually rewards are separate but "Lose items" can take from rewards?
                    // Prompt says "Backpack [List of items currently in backpack]".
                    // Let's assume found items go to backpack.
                    resultText = `You found a ${item.name}!\n- ${outcome.amount} ${item.emoji} ${item.name}`;
                }
            } else if (outcome.type === 'coins') {
                session.rewards.coins += outcome.amount;
                resultText = `You found some coins!\n- ⏣ ${outcome.amount.toLocaleString()}`;
            } else if (outcome.type === 'lose_item') {
                if (session.backpack.length > 0) {
                    const lostIdx = Math.floor(Math.random() * session.backpack.length);
                    const lostItem = session.backpack.splice(lostIdx, 1)[0];
                    resultText = `Oh no! You lost your ${lostItem.name}.`;
                } else {
                    resultText = "You almost lost an item, but your backpack was empty!";
                }
            } else if (outcome.type === 'end') {
                resultText = "Your adventure has ended.";
                ended = true;
            } else if (outcome.type === 'end_loss') {
                resultText = "Adventure Ends & you lost all your items!";
                session.backpack = []; // Wipe
                ended = true;
            } else if (outcome.type === 'title') {
                resultText = `You earned a title: ${outcome.text}`;
                db.addTitle(userId, outcome.id);
            }

            // Update Embed
            const p = session.nodeIndex + 1;
            let footer = '';
            if (p <= 3) footer = '🚀 - ⦾ - ⦾ - ⦾ - ⦾';
            else if (p <= 6) footer = '⦾ - 🚀 - ⦾ - ⦾ - ⦾';
            else if (p <= 9) footer = '⦾ - ⦾ - 🚀 - ⦾ - ⦾';
            else if (p <= 12) footer = '⦾ - ⦾ - ⦾ - 🚀 - ⦾';
            else footer = '⦾ - ⦾ - ⦾ - ⦾ - 🚀';

            const embed = new EmbedBuilder()
                .setDescription(`> ${node.text}\n\n${resultText}`)
                .setFooter({ text: footer })
                .setColor(0x2F3136);

            // Rebuild buttons: Selected Green, Others Gray Disabled
            const optionButtons = node.options.map((opt, idx) =>
                new ButtonBuilder()
                    .setCustomId(`opt_${idx}`)
                    .setLabel(opt.label)
                    .setStyle(idx === optIdx ? ButtonStyle.Success : ButtonStyle.Secondary)
                    .setDisabled(true)
            );

            const controlRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('adventure_backpack').setEmoji('🎒').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('adventure_next').setEmoji('➡️').setStyle(ButtonStyle.Secondary).setDisabled(false) // Enable Next
            );

            const optionRow = new ActionRowBuilder().addComponents(optionButtons);

            await i.update({ embeds: [embed], components: [optionRow, controlRow] });

            if (ended) {
                // Short delay then summary or wait for 'Next' click?
                // Prompt: "On the Final Node... clicking Next shows Summary".
                // If "Adventure Ends" outcome, does it force end immediately or wait for Next?
                // "Adventure Ends means the session stops immediately, and the summary is shown."
                // But the UI flow shows "Next" button enabling.
                // I'll assume clicking "Next" triggers the summary if ended flag is set.
                // I'll set session.nodeIndex to 15 (end) so next click triggers summary.
                session.nodeIndex = 15; // Force end
            }
        }

        async function showBackpack(i, session) {
            const p = session.nodeIndex + 1;
            let footer = '';
            if (p <= 3) footer = '🚀 - ⦾ - ⦾ - ⦾ - ⦾';
            else if (p <= 6) footer = '⦾ - 🚀 - ⦾ - ⦾ - ⦾';
            else if (p <= 9) footer = '⦾ - ⦾ - 🚀 - ⦾ - ⦾';
            else if (p <= 12) footer = '⦾ - ⦾ - ⦾ - 🚀 - ⦾';
            else footer = '⦾ - ⦾ - ⦾ - ⦾ - 🚀';

            let backpackList = session.backpack.map(it => `${it.emoji} ${it.name}`).join('\n');
            if (!backpackList) backpackList = "Empty";

            let rewardList = '';
            if (session.rewards.coins > 0) rewardList += `⏣ ${session.rewards.coins.toLocaleString()}\n`;
            session.rewards.items.forEach(it => {
                rewardList += `${it.quantity} ${it.emoji} ${it.name}\n`;
            });
            if (!rewardList) rewardList = "None";

            const embed = new EmbedBuilder()
                .setTitle('Adventure Progress')
                .setDescription(`> ${adventureData.name}`)
                .addFields(
                    { name: 'Backpack', value: backpackList },
                    { name: 'Rewards', value: rewardList },
                    { name: 'Interactions', value: `${session.interactions}` }
                )
                .setFooter({ text: footer });

            await i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        async function showSummary(i, session) {
            // Grant Rewards to DB
            if (session.rewards.coins > 0) db.addBalance(userId, session.rewards.coins);
            // Grant items found
            for (const rItem of session.rewards.items) {
                db.addItem(userId, rItem.id, rItem.quantity);
            }
            // Return surviving backpack items (originally equipped) to inventory
            // But wait, "backpack" contains ALL items including found ones?
            // Logic:
            // 1. We removed equipped items at start.
            // 2. Found items were added to 'backpack' array in memory.
            // 3. 'Lose item' removed from 'backpack'.
            // 4. At end, 'backpack' contains what the user HAS.
            // 5. We need to sync this to DB.
            //    - Re-add everything in backpack to DB?
            //    - But wait, `session.rewards` tracks found items.
            //    - If I add `session.rewards` items to DB, and ALSO `backpack` items... double counting found items?
            //    Refined Logic:
            //    - Rewards list is just for display/logging of what was *found*.
            //    - Backpack is the *current state of possession*.
            //    - So, we should just dump the entire `backpack` content into DB?
            //    - Not exactly. We removed equipped items. We need to give them back.
            //    - Found items: We haven't added them to DB yet.
            //    - So YES, adding everything in `backpack` to DB is the correct "Result state".
            //    - BUT, `session.rewards` is separately tracked for the "Rewards" field in summary.
            //    - Wait, if I lose a "Found" item, it disappears from backpack.
            //    - So `backpack` = (Equipped + Found) - Lost.
            //    - Simple: Add everything in `session.backpack` to inventory.
            //    - AND `session.rewards.coins` to balance.

            // Re-Add Backpack items
            // Consolidate duplicates
            const finalLoot = {};
            for (const item of session.backpack) {
                finalLoot[item.id] = (finalLoot[item.id] || 0) + 1;
            }
            for (const [id, qty] of Object.entries(finalLoot)) {
                db.addItem(userId, id, qty);
            }

            // Generate Summary Text
            let rewardText = "";
            // We want to show what was *gained*? Or final state?
            // Prompt Summary: "Rewards ... Jar of Singularity ... Coins ... Skin Fragments".
            // This usually implies NET GAIN.
            // But prompt also lists "Backpack [Items remaining]".
            // So Rewards field = Found Items + Coins.
            // Backpack field = Remaining Items.

            // Rewards Display
            if (session.rewards.coins > 0) rewardText += `- ⏣ ${session.rewards.coins.toLocaleString()}\n`;
            // Aggregate rewards for display
            const aggRewards = {};
            session.rewards.items.forEach(it => {
                aggRewards[it.id] = (aggRewards[it.id] || 0) + it.quantity;
            });
            for (const [id, qty] of Object.entries(aggRewards)) {
                const item = items.find(it => it.id === id);
                rewardText += `- ${qty} ${item.emoji} ${item.name}\n`;
            }
            if (!rewardText) rewardText = "None";

            // Backpack Display
            let backpackText = "";
            for (const [id, qty] of Object.entries(finalLoot)) {
                const item = items.find(it => it.id === id);
                backpackText += `${qty}x ${item.emoji} ${item.name}\n`;
            }
            if (!backpackText) backpackText = "Empty";

            const embed = new EmbedBuilder()
                .setTitle('Adventure Summary')
                .setDescription(`**Name**\n${adventureData.name}\n\n**Interactions**\n${session.interactions}\n\n**Backpack**\n${backpackText}\n\n**Rewards**\n${rewardText}`)
                .setColor(0x00FF00);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('adv_end').setEmoji('⏰').setLabel('2m').setStyle(ButtonStyle.Secondary).setDisabled(true)
            );

            await i.update({ embeds: [embed], components: [row] });
        }
    }
};
