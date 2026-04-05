const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fish')
        .setDescription('Fishing commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('catch')
                .setDescription('Play a minigame to catch a fish!')
        ),
    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'catch') {
            await interaction.deferReply();

            // 1. Generate 3x3 grid array
            // 1 fish, 1-2 mines, rest water
            const grid = [];
            const numMines = Math.floor(Math.random() * 2) + 1; // 1 or 2
            grid.push('fish');
            for (let i = 0; i < numMines; i++) {
                grid.push('mine');
            }
            while (grid.length < 9) {
                grid.push('water');
            }

            // Shuffle array
            for (let i = grid.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [grid[i], grid[j]] = [grid[j], grid[i]];
            }

            // 2. Create canvas
            const canvas = createCanvas(300, 300);
            const ctx = canvas.getContext('2d');

            const imagesPath = path.join(__dirname, '../../Images');

            // Helper to load image or fallback to colored rect
            const loadTile = async (type) => {
                try {
                    return await loadImage(path.join(imagesPath, `${type}.png`));
                } catch (e) {
                    return null;
                }
            };

            const waterImg = await loadTile('water');
            const fishImg = await loadTile('fish');
            const mineImg = await loadTile('mine');

            const drawTile = (x, y, type) => {
                let img = null;
                let fallbackColor = 'blue';
                if (type === 'water') { img = waterImg; fallbackColor = '#3498db'; }
                if (type === 'fish') { img = fishImg; fallbackColor = '#2ecc71'; }
                if (type === 'mine') { img = mineImg; fallbackColor = '#e74c3c'; }

                if (img) {
                    ctx.drawImage(img, x, y, 100, 100);
                } else {
                    ctx.fillStyle = fallbackColor;
                    ctx.fillRect(x, y, 100, 100);
                    ctx.fillStyle = 'white';
                    ctx.font = '20px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(type, x + 50, y + 50);
                }
            };

            // Draw grid
            for (let i = 0; i < 9; i++) {
                const row = Math.floor(i / 3);
                const col = i % 3;
                drawTile(col * 100, row * 100, grid[i]);
            }

            const buffer = canvas.toBuffer('image/png');
            const attachment = new AttachmentBuilder(buffer, { name: 'fishing-grid.png' });

            // 3. UI & Interaction
            const embed = new EmbedBuilder()
                .setTitle('Fishing...')
                .setDescription('Cast your line! Pick a tile to catch something.')
                .setImage('attachment://fishing-grid.png')
                .setFooter({ text: 'Reel it in slowly...' });

            const rows = [];
            for (let i = 0; i < 3; i++) {
                const row = new ActionRowBuilder();
                for (let j = 0; j < 3; j++) {
                    const index = i * 3 + j;
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`catch_${interaction.id}_${index}`)
                            .setLabel('[Catch]')
                            .setStyle(ButtonStyle.Secondary)
                    );
                }
                rows.push(row);
            }

            const message = await interaction.editReply({
                embeds: [embed],
                components: rows,
                files: [attachment]
            });

            const filter = i => i.customId.startsWith(`catch_${interaction.id}_`) && i.user.id === interaction.user.id;
            const collector = message.createMessageComponentCollector({ filter, time: 30000 });

            collector.on('collect', async i => {
                const parts = i.customId.split('_');
                const index = parseInt(parts[2], 10);
                const result = grid[index];

                let resultText = '';
                if (result === 'fish') {
                    resultText = 'You caught a fish! 🐟';
                } else if (result === 'mine') {
                    resultText = 'Oh no! You caught a mine! 💥';
                } else {
                    resultText = 'Nothing but empty water... 🌊';
                }

                // Update embed
                const updatedEmbed = EmbedBuilder.from(embed)
                    .setDescription(resultText)
                    .setImage(null);

                // Update components
                const updatedRows = rows.map((row, rIndex) => {
                    const updatedRow = new ActionRowBuilder();
                    row.components.forEach((btn, cIndex) => {
                        const btnIndex = rIndex * 3 + cIndex;
                        const newBtn = ButtonBuilder.from(btn).setDisabled(true);
                        if (btnIndex === index) {
                            newBtn.setStyle(ButtonStyle.Primary);
                        }
                        updatedRow.addComponents(newBtn);
                    });
                    return updatedRow;
                });

                await i.update({
                    embeds: [updatedEmbed],
                    components: updatedRows,
                    attachments: [] // remove the image
                });

                collector.stop('clicked');
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    const timeoutEmbed = EmbedBuilder.from(embed)
                        .setDescription(`~~${embed.data.description}~~`); // Strikethrough

                    const disabledRows = rows.map((row) => {
                        const updatedRow = new ActionRowBuilder();
                        row.components.forEach((btn) => {
                            updatedRow.addComponents(ButtonBuilder.from(btn).setDisabled(true));
                        });
                        return updatedRow;
                    });

                    await interaction.editReply({
                        embeds: [timeoutEmbed],
                        components: disabledRows
                    }).catch(() => {});
                }
            });
        }
    },
};
