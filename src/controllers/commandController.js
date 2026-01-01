const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const voiceController = require('./voiceController');
const verifyController = require('./verifyController');
const config = require('../config/config');

// Admin role ID (only users with this role can use admin commands)
const ADMIN_ROLE_ID = '1456296379050885212';

/**
 * Check if user has admin role
 * @param {GuildMember} member - Guild member to check
 * @returns {boolean}
 */
function isAdmin(member) {
    if (!member) return false;
    return member.roles.cache.has(ADMIN_ROLE_ID);
}

/**
 * Handle .delete command
 * @param {Message} message - Discord message
 * @param {string[]} args - Command arguments
 */
async function handleDelete(message, args) {
    if (!isAdmin(message.member)) {
        return message.reply({ content: '❌ Kamu tidak punya izin untuk menggunakan perintah ini.', flags: 64 });
    }

    const amount = parseInt(args[0]);

    if (isNaN(amount) || amount < 1 || amount > 100) {
        return message.reply('❌ Masukkan jumlah pesan yang valid (1-100).');
    }

    try {
        // Delete the command message first
        await message.delete();

        // Bulk delete messages
        const deleted = await message.channel.bulkDelete(amount, true);

        // Send confirmation (auto-delete after 3 seconds)
        const confirmMsg = await message.channel.send(`✅ Berhasil menghapus **${deleted.size}** pesan.`);
        setTimeout(() => confirmMsg.delete().catch(() => { }), 3000);

    } catch (error) {
        console.error('[CommandController] Delete error:', error);
        message.channel.send('❌ Gagal menghapus pesan. Pastikan pesan tidak lebih dari 14 hari.');
    }
}

/**
 * Handle .rules command
 * @param {Message} message - Discord message
 */
async function handleRules(message) {
    if (!isAdmin(message.member)) {
        return message.reply({ content: '❌ Kamu tidak punya izin untuk menggunakan perintah ini.', flags: 64 });
    }

    // Delete the command message
    await message.delete().catch(() => { });

    // Main rules embed
    const rulesEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Peraturan Komikkuya ✅')
        .setThumbnail('https://komikkuya.my.id/assets/icon.png')
        .setDescription(`**Saling menghormati sesama anggota.** 💖
Komikkuya adalah tempat untuk bersantai dan membaca komik bersama!

Kami tidak mentoleransi segala bentuk pelecehan atau perilaku tidak sopan terhadap anggota lain. Anggota yang melanggar akan dikenakan sanksi tegas hingga ban dari server.

Hal-hal yang dilarang:
• Menghina, bullying, atau mendiskriminasi sesama pembaca.
• Mengirim pesan spam atau iklan tanpa izin.
• Perilaku kasar atau toksik dalam diskusi.

**Jaga server tetap nyaman.** 🥰
Konten NSFW **TIDAK** diizinkan di sini. Ini termasuk gambar dewasa, kekerasan berlebihan, dll. Kami ingin menjaga komunitas tetap sehat untuk semua kalangan.

Jika ada anggota yang sengaja merusak suasana server, sanksi ban akan langsung diberikan tanpa toleransi!`)
        .setTimestamp();

    // Reading rules embed
    const readingEmbed = new EmbedBuilder()
        .setColor(0x95E1D3)
        .setTitle('📚 TEMPAT BACA KOMIK 📚')
        .setDescription(`Baca koleksi manga, manhwa, dan manhua di [komikkuya.my.id](http://komikkuya.my.id/)!

Notifikasi update chapter terbaru otomatis dikirim di channel <#1456308962604613828>.

**Spoiler Alert!**
Gunakan spoiler tag ||seperti ini|| jika ingin membahas bagian seru atau plot twist agar tidak mengganggu pembaca lain.`);

    // Community embed  
    const communityEmbed = new EmbedBuilder()
        .setColor(0xFFE66D)
        .setTitle('💬 DISKUSI UMUM 💬')
        .setDescription(`**Gunakan channel yang sesuai.** Bahas komik di channel komik, jangan campur aduk.

**Bersenang-senanglah!** 🎉 Bagikan rekomendasi komik favorit kamu, cari info komik seru, dan cari teman baca baru di sini.

**Patuhi ToS Discord.** Tetap patuhi aturan dasar penggunaan Discord.`)
        .setFooter({ text: 'Pelanggaran peraturan berakibat mute, kick, atau ban. • Komikkuya' });

    // Send all embeds
    await message.channel.send({ embeds: [rulesEmbed, readingEmbed, communityEmbed] });
}

/**
 * Handle .setupvoice command
 * @param {Message} message - Discord message
 */
async function handleSetupVoice(message) {
    if (!isAdmin(message.member)) {
        return message.reply({ content: '❌ Kamu tidak punya izin untuk menggunakan perintah ini.', flags: 64 });
    }

    const channel = await message.guild.channels.fetch(config.TEMP_VOICE_INTERFACE_CHANNEL_ID).catch(() => null);
    if (!channel) {
        return message.reply('❌ Channel interface tidak ditemukan. Cek config!');
    }

    await voiceController.sendInterface(channel);
    await message.reply(`✅ Interface TempVoice berhasil dikirim ke <#${channel.id}>`);
}

/**
 * Process incoming message for commands
 * @param {Message} message - Discord message
 */
async function processCommand(message) {
    // Ignore bot messages
    if (message.author.bot) return;

    // Check if message starts with prefix
    if (!message.content.startsWith('.')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    switch (command) {
        case 'delete':
            await handleDelete(message, args);
            break;
        case 'rules':
            await handleRules(message);
            break;
        case 'setupvoice':
            await handleSetupVoice(message);
            break;
        case 'setupverify':
            if (!isAdmin(message.member)) {
                return message.reply({ content: '❌ Kamu tidak punya izin untuk menggunakan perintah ini.', flags: 64 });
            }
            if (message.channel.id !== config.VERIFY_CHANNEL_ID) {
                return message.reply(`❌ Perintah ini harus dijalankan di channel verifikasi: <#${config.VERIFY_CHANNEL_ID}>`);
            }
            await verifyController.setupVerificationChannel(message.channel);
            await message.delete().catch(() => { });
            break;
    }
}

module.exports = {
    processCommand,
    isAdmin
};
