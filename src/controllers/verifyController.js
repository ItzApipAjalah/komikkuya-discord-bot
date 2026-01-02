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

// Cache for user tokens (userId -> { token, expiresAt })
const tokenCache = new Map();

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

            // Modern HTML with hCaptcha and Font Awesome
            const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Komikkuya Verification</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <script src="https://js.hcaptcha.com/1/api.js" async defer></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', sans-serif;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            background: linear-gradient(135deg, #0d0d0f 0%, #1a0a1f 50%, #0d0d0f 100%);
            padding: 20px;
            position: relative;
            overflow: hidden;
        }
        
        /* Animated background orbs */
        body::before, body::after {
            content: '';
            position: fixed;
            border-radius: 50%;
            filter: blur(100px);
            opacity: 0.4;
            animation: float 8s ease-in-out infinite;
        }
        
        body::before {
            width: 400px;
            height: 400px;
            background: rgba(138, 43, 226, 0.3);
            top: -100px;
            left: -100px;
        }
        
        body::after {
            width: 300px;
            height: 300px;
            background: rgba(190, 0, 255, 0.25);
            bottom: -50px;
            right: -50px;
            animation-delay: -4s;
        }
        
        @keyframes float {
            0%, 100% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(30px, -30px) scale(1.1); }
        }
        
        .card {
            background: rgba(20, 12, 28, 0.85);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(138, 43, 226, 0.2);
            border-radius: 24px;
            padding: 48px 40px;
            max-width: 420px;
            width: 100%;
            text-align: center;
            position: relative;
            z-index: 1;
            box-shadow: 
                0 25px 50px -12px rgba(0, 0, 0, 0.5),
                0 0 0 1px rgba(138, 43, 226, 0.1),
                inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }
        
        .icon-wrapper {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #8a2be2 0%, #be00ff 100%);
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
            box-shadow: 0 8px 32px rgba(190, 0, 255, 0.3);
        }
        
        .icon-wrapper i {
            font-size: 36px;
            color: white;
        }
        
        h1 {
            color: #ffffff;
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 12px;
            letter-spacing: -0.5px;
        }
        
        p {
            color: rgba(255, 255, 255, 0.6);
            font-size: 15px;
            line-height: 1.6;
            margin-bottom: 32px;
        }
        
        .captcha-container {
            display: flex;
            justify-content: center;
            margin-bottom: 24px;
        }
        
        .h-captcha {
            transform-origin: center;
        }
        
        .btn {
            width: 100%;
            padding: 16px 24px;
            background: linear-gradient(135deg, #8a2be2 0%, #be00ff 100%);
            border: none;
            border-radius: 12px;
            color: white;
            font-family: 'Inter', sans-serif;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 20px rgba(190, 0, 255, 0.3);
        }
        
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 30px rgba(190, 0, 255, 0.4);
        }
        
        .btn:active {
            transform: translateY(0);
        }
        
        .footer {
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid rgba(138, 43, 226, 0.15);
        }
        
        .footer p {
            font-size: 13px;
            color: rgba(255, 255, 255, 0.4);
            margin-bottom: 0;
        }
        
        .footer a {
            color: #be00ff;
            text-decoration: none;
            font-weight: 500;
        }
        
        .footer a:hover {
            text-decoration: underline;
        }
        
        /* Responsive */
        @media (max-width: 480px) {
            .card {
                padding: 36px 24px;
                border-radius: 20px;
            }
            
            .icon-wrapper {
                width: 64px;
                height: 64px;
                border-radius: 16px;
            }
            
            .icon-wrapper i {
                font-size: 28px;
            }
            
            h1 {
                font-size: 24px;
            }
            
            p {
                font-size: 14px;
            }
            
            .h-captcha {
                transform: scale(0.9);
            }
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon-wrapper">
            <i class="fa-solid fa-shield-halved"></i>
        </div>
        <h1>Verification</h1>
        <p>Selesaikan captcha di bawah untuk memverifikasi bahwa kamu bukan bot dan mendapatkan akses ke server.</p>
        <form action="/api/verify-success" method="POST">
            <input type="hidden" name="token" value="${token}">
            <div class="captcha-container">
                <div class="h-captcha" data-sitekey="${config.HCAPTCHA_SITE_KEY}" data-theme="dark"></div>
            </div>
            <button type="submit" class="btn">
                <i class="fa-solid fa-check-circle"></i>
                Verify Me
            </button>
        </form>
        <div class="footer">
            <p>Protected by <a href="https://komikkuya.my.id" target="_blank">Komikkuya</a></p>
        </div>
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
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verification Successful - Komikkuya</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            background: linear-gradient(135deg, #0d0d0f 0%, #1a0a1f 50%, #0d0d0f 100%);
            padding: 20px;
            position: relative;
            overflow: hidden;
        }
        body::before {
            content: '';
            position: fixed;
            width: 400px;
            height: 400px;
            background: rgba(67, 181, 129, 0.2);
            border-radius: 50%;
            filter: blur(100px);
            top: -100px;
            left: -100px;
            animation: float 8s ease-in-out infinite;
        }
        body::after {
            content: '';
            position: fixed;
            width: 300px;
            height: 300px;
            background: rgba(138, 43, 226, 0.2);
            border-radius: 50%;
            filter: blur(100px);
            bottom: -50px;
            right: -50px;
            animation: float 8s ease-in-out infinite reverse;
        }
        @keyframes float {
            0%, 100% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(30px, -30px) scale(1.1); }
        }
        .card {
            background: rgba(20, 12, 28, 0.85);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(67, 181, 129, 0.2);
            border-radius: 24px;
            padding: 48px 40px;
            max-width: 420px;
            width: 100%;
            text-align: center;
            position: relative;
            z-index: 1;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .icon-wrapper {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #2ecc71 0%, #43b581 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
            box-shadow: 0 8px 32px rgba(67, 181, 129, 0.3);
        }
        .icon-wrapper i { font-size: 36px; color: white; }
        h1 { color: #43b581; font-size: 28px; font-weight: 700; margin-bottom: 12px; }
        p { color: rgba(255, 255, 255, 0.6); font-size: 15px; line-height: 1.6; margin-bottom: 24px; }
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 14px 28px;
            background: linear-gradient(135deg, #8a2be2 0%, #be00ff 100%);
            border-radius: 12px;
            color: white;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s ease;
            box-shadow: 0 4px 20px rgba(190, 0, 255, 0.3);
        }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(190, 0, 255, 0.4); }
        @media (max-width: 480px) {
            .card { padding: 36px 24px; }
            .icon-wrapper { width: 64px; height: 64px; }
            .icon-wrapper i { font-size: 28px; }
            h1 { font-size: 24px; }
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon-wrapper">
            <i class="fa-solid fa-circle-check"></i>
        </div>
        <h1>Verified Successfully!</h1>
        <p>Kamu sudah diberikan role member. Sekarang kamu bisa kembali ke Discord dan menikmati server.</p>
        <a href="https://discord.com/channels/1456296379050885209" class="btn">
            <i class="fa-brands fa-discord"></i>
            Kembali ke Discord
        </a>
    </div>
</body>
</html>
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
        .setImage('https://komikkuya.my.id/assets/og-image.png'); // Optional banner

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
        const cacheKey = `${guildId}-${userId}`;

        let verifyLink;
        const now = Date.now();

        // Check if user has a cached token that's still valid
        if (tokenCache.has(cacheKey)) {
            const cached = tokenCache.get(cacheKey);
            if (cached.expiresAt > now) {
                // Reuse existing link
                verifyLink = cached.link;
            } else {
                // Token expired, remove from cache
                tokenCache.delete(cacheKey);
            }
        }

        // Generate new token if not cached
        if (!verifyLink) {
            const token = jwt.sign({ userId, guildId }, config.JWT_SECRET, { expiresIn: '10m' });
            verifyLink = `${config.VERIFY_URL}/verify?token=${token}`;

            // Cache for 10 minutes
            tokenCache.set(cacheKey, {
                link: verifyLink,
                expiresAt: now + (10 * 60 * 1000) // 10 minutes from now
            });
        }

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
