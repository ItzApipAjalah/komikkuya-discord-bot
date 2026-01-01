const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { AttachmentBuilder } = require('discord.js');
const GIFEncoder = require('gif-encoder-2');
const path = require('path');
const config = require('../config/config');

/**
 * Generate an animated welcome GIF for a new member
 * @param {GuildMember} member - The member who joined
 * @returns {Promise<AttachmentBuilder>} - The generated GIF as an attachment
 */
async function generateWelcomeGif(member) {
    const width = 1024;
    const height = 371;

    // Setup for GIF encoding
    const encoder = new GIFEncoder(width, height);
    encoder.start();
    encoder.setRepeat(0);   // 0 for repeat, -1 for no-repeat
    encoder.setDelay(80);   // delay in ms
    encoder.setQuality(10); // image quality. 10 is default.

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Load static assets
    const templatePath = path.join(__dirname, '../../assets/welcome_template.png');
    const background = await loadImage(templatePath);

    const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
    const avatarImg = await loadImage(avatarUrl);

    const displayName = member.user.username.toUpperCase();

    const avatarX = 72;
    const avatarY = 65;
    const avatarSize = 230;
    const centerX = avatarX + avatarSize / 2;
    const centerY = avatarY + avatarSize / 2;
    const radius = avatarSize / 2;

    // Animation frames (15 frames for a smooth rotation)
    const numFrames = 15;

    for (let i = 0; i < numFrames; i++) {
        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // 1. Draw Background
        ctx.drawImage(background, 0, 0, width, height);

        // 2. Draw Animated Border (Rotating segments)
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate((i * (360 / numFrames) * Math.PI) / 180);

        // Draw 3 glowing segments
        for (let s = 0; s < 3; s++) {
            ctx.rotate((120 * Math.PI) / 180);
            ctx.beginPath();
            ctx.arc(0, 0, radius + 5, 0, (Math.PI / 2)); // 90 degree arc
            ctx.lineWidth = 8;
            ctx.strokeStyle = '#BE00FF'; // Purple Neon
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#BE00FF';
            ctx.stroke();

            // Inner white line for extra shine
            ctx.beginPath();
            ctx.arc(0, 0, radius + 5, 0, (Math.PI / 2));
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#FFFFFF';
            ctx.shadowBlur = 0;
            ctx.stroke();
        }
        ctx.restore();

        // 3. Draw Avatar (Clipped Circle)
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius - 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();

        // 4. Draw Static Text (Name)
        const nameX = 680;
        const nameY = 145;

        ctx.shadowColor = '#BE00FF';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        let fontSize = 70;
        ctx.textAlign = 'center';
        ctx.font = `bold ${fontSize}px sans-serif`;

        while (ctx.measureText(displayName).width > 500 && fontSize > 30) {
            fontSize -= 2;
            ctx.font = `bold ${fontSize}px sans-serif`;
        }

        ctx.lineWidth = 4;
        ctx.strokeStyle = '#FFFFFF';
        ctx.strokeText(displayName, nameX, nameY);

        ctx.fillStyle = '#F0E0FF';
        ctx.fillText(displayName, nameX, nameY);
        ctx.shadowBlur = 0;

        // Add frame to encoder
        encoder.addFrame(ctx);
    }

    encoder.finish();
    const buffer = encoder.out.getData();

    return new AttachmentBuilder(buffer, { name: `welcome-${member.id}.gif` });
}

/**
 * Handle new member join event
 * @param {GuildMember} member 
 */
async function handleMemberJoin(member) {
    try {
        const channel = await member.guild.channels.fetch(config.WELCOME_CHANNEL_ID).catch(() => null);
        if (!channel) return;

        console.log(`[WelcomeController] Generating GIF for ${member.user.tag}...`);
        const attachment = await generateWelcomeGif(member);

        // Find custom emoji named 'discord'
        const discordEmoji = member.guild.emojis.cache.find(e => e.name === 'discord') || '👋';

        await channel.send({
            content: `${discordEmoji} **Selamat datang di server, ${member}!**`,
            files: [attachment]
        });

        console.log(`[WelcomeController] Sent welcome GIF for ${member.user.tag}`);
    } catch (error) {
        console.error('[WelcomeController] Error:', error);
    }
}

module.exports = {
    handleMemberJoin
};
