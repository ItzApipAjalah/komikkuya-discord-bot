const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const path = require('path');
const config = require('../config/config');

let discordClient;

/**
 * Initialize Verify System Web Server
 * @param {Client} client - Discord Client
 */
function init(client) {
    discordClient = client;
    const app = express();
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());

    // Serve Verification Page
    app.get('/verify', (req, res) => {
        const token = req.query.token;
        if (!token) return res.status(400).send('❌ Invalid Verification Link');

        try {
            const decoded = jwt.verify(token, config.JWT_SECRET);

            // Basic HTML with hCaptcha
            const html = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Komikkuya Verification</title>
                    <script src="https://js.hcaptcha.com/1/api.js" async defer></script>
                    <style>
                        body { background: #1a1a1b; color: white; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                        .card { background: #2f3136; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); text-align: center; max-width: 400px; width: 90%; }
                        h1 { color: #BE00FF; margin-bottom: 10px; }
                        p { color: #b9bbbe; margin-bottom: 30px; }
                        .btn { background: #BE00FF; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; cursor: pointer; width: 100%; margin-top: 20px; }
                        .btn:hover { background: #9d00d3; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h1>Verification</h1>
                        <p>Selesaikan captcha di bawah untuk mendapatkan akses ke server.</p>
                        <form action="/api/verify-success" method="POST">
                            <input type="hidden" name="token" value="${token}">
                            <div class="h-captcha" data-sitekey="${config.HCAPTCHA_SITE_KEY}"></div>
                            <button type="submit" class="btn">Verify Me</button>
                        </form>
                    </div>
                </body>
                </html>
            `;
            res.send(html);
        } catch (err) {
            res.status(401).send('❌ Link expired or invalid. Please generate a new one on Discord.');
        }
    });

    // Handle verification success
    app.post('/api/verify-success', async (req, res) => {
        const { token, 'h-captcha-response': captchaResponse } = req.body;

        if (!token || !captchaResponse) {
            return res.status(400).send('❌ Missing parameters.');
        }

        try {
            // 1. Verify hCaptcha with their API
            const response = await axios.post('https://hcaptcha.com/siteverify',
                `secret=${config.HCAPTCHA_SECRET_KEY}&response=${captchaResponse}`,
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );

            if (!response.data.success) {
                return res.status(400).send('❌ Captcha verification failed. Try again.');
            }

            // 2. Decode JWT to get User ID and Guild ID
            const verified = jwt.verify(token, config.JWT_SECRET);

            const guild = await discordClient.guilds.fetch(verified.guildId).catch(() => null);
            if (!guild) return res.send('❌ Server not found.');

            const member = await guild.members.fetch(verified.userId).catch(() => null);
            if (!member) return res.send('❌ Member not found.');

            // 3. Add Role
            const roleId = config.VERIFY_ROLE_ID;
            await member.roles.add(roleId).catch(console.error);

            res.send(`
                <body style="background: #1a1a1b; color: white; display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif;">
                    <div style="text-align:center;">
                        <h1 style="color: #43b581;">✅ Verified Successfully!</h1>
                        <p>Kamu sudah diberikan role member. Sekarang kamu bisa kembali ke Discord.</p>
                    </div>
                </body>
            `);

        } catch (error) {
            console.error('[VerifyController] Error:', error);
            res.status(500).send('❌ An error occurred during verification.');
        }
    });

    app.listen(config.WEB_PORT, () => {
        console.log(`[VerifyController] Web Server running at ${config.VERIFY_URL}`);
    });

    // Start auto-refresh loop
    startAutoRefresh(client);
}

/**
 * Automatically send/refresh the verify message every 10 minutes
 * @param {Client} client 
 */
function startAutoRefresh(client) {
    const refreshInterval = 10 * 60 * 1000; // 10 minutes

    const runRefresh = async () => {
        try {
            const channel = await client.channels.fetch(config.VERIFY_CHANNEL_ID).catch(() => null);
            if (!channel) return console.error('[VerifyController] Verify channel not found for auto-refresh!');

            // Delete old bot messages in the channel to keep it clean
            const messages = await channel.messages.fetch({ limit: 50 });
            const botMessages = messages.filter(m => m.author.id === client.user.id);

            if (botMessages.size > 0) {
                for (const msg of botMessages.values()) {
                    await msg.delete().catch(() => { });
                }
            }

            // Send new interface
            await sendVerifyInterface(channel);
            console.log('[VerifyController] Verification interface refreshed.');

        } catch (error) {
            console.error('[VerifyController] Auto-refresh error:', error);
        }
    };

    // Initial run
    runRefresh();

    // Set interval
    setInterval(runRefresh, refreshInterval);
}

/**
 * Send the Verification interface to the channel
 * @param {TextChannel} channel 
 */
async function sendVerifyInterface(channel) {
    const embed = new EmbedBuilder()
        .setTitle('Verifikasi Member')
        .setDescription('Selamat datang! Untuk mendapatkan akses penuh ke server ini, silakan klik tombol di bawah untuk memverifikasi bahwa kamu bukan bot.')
        .setColor(0xBE00FF)
        .setThumbnail('https://komikkuya.my.id/assets/icon.png')
        .setImage('https://komikkuya.my.id/assets/verify_banner.png'); // Optional banner

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('verify_start')
            .setLabel('Verify Now')
            .setEmoji('🛡️')
            .setStyle(ButtonStyle.Primary)
    );

    await channel.send({ embeds: [embed], components: [row] });
}

/**
 * Handle verification interaction
 * @param {Interaction} interaction 
 */
async function handleInteraction(interaction) {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'verify_start') {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        // Generate a token valid for 10 minutes
        const token = jwt.sign({ userId, guildId }, config.JWT_SECRET, { expiresIn: '10m' });
        const verifyLink = `${config.VERIFY_URL}/verify?token=${token}`;

        await interaction.reply({
            content: `🛡️ **Sistem Verifikasi**\n\nSilakan buka link di bawah ini dan selesaikan captcha:\n🔗 [Klik di Sini untuk Verifikasi](${verifyLink})\n\n*Link ini berlaku selama 10 menit.*`,
            flags: 64 // Ephemeral
        });
    }
}

// Rename sendVerifyInterface to setupVerificationChannel for consistency
module.exports = {
    init,
    setupVerificationChannel: sendVerifyInterface,
    handleInteraction
};
