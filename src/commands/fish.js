const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const IS_COMPONENTS_V2 = 1 << 15;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fish')
        .setDescription('Advanced fishing command')
        .addSubcommand(subcommand =>
            subcommand
                .setName('catch')
                .setDescription('Catch a fish')
        ),
    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'catch') {
            await sendFishingUI(interaction);
        } else {
            await interaction.reply({ content: 'Unknown subcommand.', flags: 64 });
        }
    }
};

async function generateFishingGrid() {
    // 3x3 grid
    const numCols = 3;
    const numRows = 3;
    const tileSize = 100;

    const canvas = createCanvas(numCols * tileSize, numRows * tileSize);
    const ctx = canvas.getContext('2d');

    // Read images
    const waterImg = await loadImage(path.join(__dirname, '../../Images/water.png'));
    const mineImg = await loadImage(path.join(__dirname, '../../Images/mine.png'));
    const fishImg = await loadImage(path.join(__dirname, '../../Images/fish.png'));

    // 1 fish, 1-2 mines, rest water
    const numFish = 1;
    const numMines = Math.floor(Math.random() * 2) + 1; // 1 or 2
    const numWater = 9 - numFish - numMines;

    let types = [];
    types.push('fish');
    for (let i = 0; i < numMines; i++) types.push('mine');
    for (let i = 0; i < numWater; i++) types.push('water');

    // Shuffle
    types.sort(() => Math.random() - 0.5);

    let gridTypes = [];
    for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < numCols; c++) {
            const type = types.pop();
            gridTypes.push(type);

            let img;
            if (type === 'fish') img = fishImg;
            else if (type === 'mine') img = mineImg;
            else img = waterImg;

            ctx.drawImage(img, c * tileSize, r * tileSize, tileSize, tileSize);
        }
    }

    const buffer = canvas.toBuffer('image/png');
    return { buffer, gridTypes };
}

async function sendFishingUI(interaction, isUpdate = false) {
    if (!isUpdate) {
        // Defer reply isn't well supported yet for completely custom RAW POST with flags unless using raw API fully
        // But we can defer normally, then edit via rest.
        await interaction.deferReply();
    }

    const { buffer, gridTypes } = await generateFishingGrid();

    const attachmentObj = {
        id: 0,
        filename: 'grid.png'
    };

    const initialText = `### Fishing...
[Components V2 Separator]
[Stitched Image Grid]
[Components V2 Separator]
**<:fishingrodtool:1162188819832000572> Fishing Rod** (+11)
<:PB1FB:1068212772954964070><:PB2E:1067894185597882419><:PB2E:1067894185597882419><:PB2E:1067894185597882419><:PB3E:1067894195504820294> 3/15
**<:EyeballBait:1143118957075767347> Eyeball Bait** (+1)
<:PB1CB:1068212774376849448><:PB2CB:1068212782639628308><:PB2CB:1068212782639628308><:PB2CB:1068212782639628308><:PB3FB:1068212789023363163> 2/2
**<a:spectralBucket:1299838471808225362> Bucket Space**
<:PB1HFB:1068212769968631898><:PB2E:1067894185597882419><:PB2E:1067894185597882419><:PB2E:1067894185597882419><:PB3E:1067894195504820294> 3/35`;

    const components = [
        {
            type: 10, // Text Display
            content: "### Fishing..."
        },
        {
            type: 14, // Separator
            divider: true,
            spacing: 1
        },
        {
            type: 12, // Media Gallery
            items: [
                {
                    media: {
                        url: "attachment://grid.png"
                    }
                }
            ]
        },
        {
            type: 14, // Separator
            divider: true,
            spacing: 1
        },
        {
            type: 10, // Text Display
            content: "**<:fishingrodtool:1162188819832000572> Fishing Rod** (+11)\n<:PB1FB:1068212772954964070><:PB2E:1067894185597882419><:PB2E:1067894185597882419><:PB2E:1067894185597882419><:PB3E:1067894195504820294> 3/15\n**<:EyeballBait:1143118957075767347> Eyeball Bait** (+1)\n<:PB1CB:1068212774376849448><:PB2CB:1068212782639628308><:PB2CB:1068212782639628308><:PB2CB:1068212782639628308><:PB3FB:1068212789023363163> 2/2\n**<a:spectralBucket:1299838471808225362> Bucket Space** \n<:PB1HFB:1068212769968631898><:PB2E:1067894185597882419><:PB2E:1067894185597882419><:PB2E:1067894185597882419><:PB3E:1067894195504820294> 3/35"
        },
        {
            type: 14, // Separator
            divider: true,
            spacing: 1
        }
    ];

    let customIdPrefix = `fish_${interaction.id}_`;

    // Create Action Rows for the buttons
    for (let r = 0; r < 3; r++) {
        let actionRow = {
            type: 1, // Action Row
            components: []
        };
        for (let c = 0; c < 3; c++) {
            let idx = r * 3 + c;
            actionRow.components.push({
                type: 2, // Button
                style: 2, // Secondary
                label: "Catch",
                custom_id: `${customIdPrefix}${idx}`
            });
        }
        components.push(actionRow);
    }

    const payload = {
        flags: IS_COMPONENTS_V2,
        components: components,
        attachments: [attachmentObj]
    };

    const files = [{
        attachment: buffer,
        name: 'grid.png'
    }];

    if (!isUpdate) {
        // Edit the deferred reply
        await interaction.client.rest.patch(`/webhooks/${interaction.client.user.id}/${interaction.token}/messages/@original`, {
            body: payload,
            files: files
        });
    } else {
        await interaction.client.rest.patch(`/webhooks/${interaction.client.user.id}/${interaction.token}/messages/@original`, {
            body: payload,
            files: files
        });
    }

    handleFishingGame(interaction, gridTypes, customIdPrefix);
}

function handleFishingGame(interaction, gridTypes, customIdPrefix) {
    const filter = i => i.customId.startsWith(customIdPrefix) && i.user.id === interaction.user.id;

    // We need to fetch the message or just use the channel collector
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000, max: 1 });

    collector.on('collect', async i => {
        const idxStr = i.customId.replace(customIdPrefix, '');
        if (idxStr === 'fish_again') {
            await i.deferUpdate();
            // Start a new game
            await sendFishingUI(interaction, true);
            return;
        }

        const idx = parseInt(idxStr, 10);
        const selectedType = gridTypes[idx];

        // Defer the update so the interaction doesn't fail
        await i.deferUpdate();

        // Prepare the new components V2 payload
        let resultTextDisplay = "";
        let finalButtons = [];
        let components = [];

        if (selectedType === 'fish') {
            resultTextDisplay = `### You caught a Purple Heartfish.
-# The purple heartfish is the working middle class of the heartfish society
-# **Size:** 4.4 lbs 7 in`;
            components.push({ type: 10, content: resultTextDisplay });
            components.push({ type: 14, divider: true, spacing: 1 });
            components.push({
                type: 10,
                content: "**<:fishingrodtool:1162188819832000572> Fishing Rod** (+10)\n<:PB1CB:1068212774376849448><:PB2CB:1068212782639628308><:PB2CB:1068212782639628308><:PB2FB:1068212779267395715><:PB3E:1067894195504820294> 12/15\n**<:EyeballBait:1143118957075767347> Eyeball Bait** (+1)\n<:PB1CB:1068212774376849448><:PB2CB:1068212782639628308><:PB2CB:1068212782639628308><:PB2CB:1068212782639628308><:PB3FB:1068212789023363163> 2/2\n**<a:spectralBucket:1299838471808225362> Bucket Space** \n<:PB1FB:1068212772954964070><:PB2E:1067894185597882419><:PB2E:1067894185597882419><:PB2E:1067894185597882419><:PB3E:1067894195504820294> 8/35"
            });
            components.push({ type: 14, divider: true, spacing: 1 });
            finalButtons = [
                { type: 2, style: 2, label: "Go Back", custom_id: `${customIdPrefix}go_back` },
                { type: 2, style: 2, label: "View Bucket", custom_id: `${customIdPrefix}view_bucket` },
                { type: 2, style: 2, label: "Sell Creature", custom_id: `${customIdPrefix}sell_creature` }
            ];
            components.push({ type: 1, components: finalButtons });
            components.push({ type: 14, divider: true, spacing: 1 });
            components.push({ type: 10, content: "-# This is common!\n-# You can fish again <t:1775458222:R>" });
        } else if (selectedType === 'mine') {
            resultTextDisplay = `### You triggered a mine!
-# Your movement triggered the mine beneath the sea, your fishing rod lost 3 durability.`;
            components.push({ type: 10, content: resultTextDisplay });
            components.push({ type: 14, divider: true, spacing: 1 });
            components.push({
                type: 10,
                content: "**<:fishingrodtool:1162188819832000572> Fishing Rod** (+11)\n<:PB1FB:1068212772954964070><:PB2E:1067894185597882419><:PB2E:1067894185597882419><:PB2E:1067894185597882419><:PB3E:1067894195504820294> 3/15\n**<:EyeballBait:1143118957075767347> Eyeball Bait** (+1)\n<:PB1CB:1068212774376849448><:PB2CB:1068212782639628308><:PB2CB:1068212782639628308><:PB2CB:1068212782639628308><:PB3FB:1068212789023363163> 2/2\n**<a:spectralBucket:1299838471808225362> Bucket Space** \n<:PB1HFB:1068212769968631898><:PB2E:1067894185597882419><:PB2E:1067894185597882419><:PB2E:1067894185597882419><:PB3E:1067894195504820294> 3/35"
            });
            components.push({ type: 14, divider: true, spacing: 1 });
            finalButtons = [
                { type: 2, style: 2, label: "Go Back", custom_id: `${customIdPrefix}go_back` },
                { type: 2, style: 2, label: "Fish Again", custom_id: `${customIdPrefix}fish_again` }
            ];
            components.push({ type: 1, components: finalButtons });
            components.push({ type: 14, divider: true, spacing: 1 });
            components.push({ type: 10, content: "-# You can fish again <t:1775454381:R>" });
        } else {
            resultTextDisplay = `### There was nothing to catch.
-# Happens to even the best fisherfolk, sometimes there's just no fish to catch! Try again after the cooldown.`;
            components.push({ type: 10, content: resultTextDisplay });
            components.push({ type: 14, divider: true, spacing: 1 });
            components.push({
                type: 10,
                content: "**<:fishingrodtool:1162188819832000572> Fishing Rod** (+10)\n<:PB1CB:1068212774376849448><:PB2CB:1068212782639628308><:PB2CB:1068212782639628308><:PB2HFB:1068212777623228516><:PB3E:1067894195504820294> 10/15\n**<:EyeballBait:1143118957075767347> Eyeball Bait** (+1)\n<:PB1CB:1068212774376849448><:PB2CB:1068212782639628308><:PB2CB:1068212782639628308><:PB2CB:1068212782639628308><:PB3FB:1068212789023363163> 2/2\n**<a:spectralBucket:1299838471808225362> Bucket Space** \n<:PB1CB:1068212774376849448><:PB2HFB:1068212777623228516><:PB2E:1067894185597882419><:PB2E:1067894185597882419><:PB3E:1067894195504820294> 9/35"
            });
            components.push({ type: 14, divider: true, spacing: 1 });
            finalButtons = [
                { type: 2, style: 2, label: "Go Back", custom_id: `${customIdPrefix}go_back` },
                { type: 2, style: 2, label: "Fish Again", custom_id: `${customIdPrefix}fish_again` }
            ];
            components.push({ type: 1, components: finalButtons });
            components.push({ type: 14, divider: true, spacing: 1 });
            components.push({ type: 10, content: "-# You can fish again <t:1775458697:R>" });
        }

        // Add the disabled grid buttons at the bottom of the components (beneath text displays, but let's insert it before the final action row to match generic styling or just push them at the end. Actually the prompt says "Beneath the message, add a 3x3 grid". Let's put the 3x3 grid right where the new layout starts, or just replace the UI with the final result. Wait, the prompt says "Update the message layout based on what was caught". The 3x3 grid is removed in the examples, replaced by the new layout completely. Wait, no, the prompt says "Check the tile... Remove the merged image from the UI. Disable all the buttons in the view. Change the color of the specific button the user clicked to blue...". So we need to KEEP the 3x3 grid of buttons at the end of the view, disabled, with the clicked one as Primary. Let's rebuild the grid!)

        let gridComponents = [];
        for (let r = 0; r < 3; r++) {
            let actionRow = { type: 1, components: [] };
            for (let c = 0; c < 3; c++) {
                let currentIdx = r * 3 + c;
                actionRow.components.push({
                    type: 2,
                    style: currentIdx === idx ? 1 : 2, // 1 is Primary (blue), 2 is Secondary (grey)
                    label: "Catch",
                    custom_id: `${customIdPrefix}disabled_${currentIdx}`, // rename custom ID to prevent duplicate actions if not disabled properly somehow
                    disabled: true
                });
            }
            gridComponents.push(actionRow);
        }

        // Insert the 3x3 grid at the end (or before the final action buttons? Let's put it at the very bottom since it's the standard place for action rows).
        components.push(...gridComponents);

        const payload = {
            flags: IS_COMPONENTS_V2,
            components: components,
            attachments: [] // remove the media gallery
        };

        await interaction.client.rest.patch(`/webhooks/${interaction.client.user.id}/${interaction.token}/messages/@original`, {
            body: payload,
            files: [] // No files to upload
        });

        // If 'Fish Again' is clicked, we need a new collector. We can just set up a generic button handler for 'Fish Again'
        const filterFishAgain = i2 => i2.customId === `${customIdPrefix}fish_again` && i2.user.id === interaction.user.id;
        const collectorFishAgain = interaction.channel.createMessageComponentCollector({ filter: filterFishAgain, time: 30000, max: 1 });
        collectorFishAgain.on('collect', async i2 => {
            await i2.deferUpdate();
            await sendFishingUI(interaction, true);
        });

    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            handleTimeout(interaction, customIdPrefix);
        }
    });
}

async function handleTimeout(interaction, customIdPrefix) {
    // When an interactive embed flow is cancelled or times out, the message description should be visually updated by wrapping the text in strikethrough markdown formatting (~~...~~).
    // Let's patch the message
    const payload = {
        flags: IS_COMPONENTS_V2,
        components: [
            {
                type: 10,
                content: "~~### Fishing...~~"
            },
            {
                type: 14,
                divider: true,
                spacing: 1
            },
            {
                type: 10,
                content: "~~**<:fishingrodtool:1162188819832000572> Fishing Rod** (+11)\n<:PB1FB:1068212772954964070><:PB2E:1067894185597882419><:PB2E:1067894185597882419><:PB2E:1067894185597882419><:PB3E:1067894195504820294> 3/15\n**<:EyeballBait:1143118957075767347> Eyeball Bait** (+1)\n<:PB1CB:1068212774376849448><:PB2CB:1068212782639628308><:PB2CB:1068212782639628308><:PB2CB:1068212782639628308><:PB3FB:1068212789023363163> 2/2\n**<a:spectralBucket:1299838471808225362> Bucket Space** \n<:PB1HFB:1068212769968631898><:PB2E:1067894185597882419><:PB2E:1067894185597882419><:PB2E:1067894185597882419><:PB3E:1067894195504820294> 3/35~~"
            }
        ]
    };

    let gridComponents = [];
    for (let r = 0; r < 3; r++) {
        let actionRow = { type: 1, components: [] };
        for (let c = 0; c < 3; c++) {
            let currentIdx = r * 3 + c;
            actionRow.components.push({
                type: 2,
                style: 2,
                label: "Catch",
                custom_id: `${customIdPrefix}timeout_${currentIdx}`,
                disabled: true
            });
        }
        gridComponents.push(actionRow);
    }
    payload.components.push(...gridComponents);

    try {
        await interaction.client.rest.patch(`/webhooks/${interaction.client.user.id}/${interaction.token}/messages/@original`, {
            body: payload,
            files: [] // Remove the media gallery / files
        });
    } catch (e) {
        // message might be deleted
    }
}