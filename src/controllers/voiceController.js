const {
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    UserSelectMenuBuilder,
    StringSelectMenuBuilder
} = require('discord.js');
const config = require('../config/config');

// Store active temporary channels: { channelId: { ownerId: string, createdAt: number } }
const activeTempChannels = new Map();
// Stores the "Join to Create" channel ID dynamically
let triggerChannelId = config.JOIN_TO_CREATE_CHANNEL_ID;

/**
 * Setup or find the "Join to Create" voice channel
 * @param {Client} client 
 */
async function setupTriggerChannel(client) {
    try {
        const guild = client.guilds.cache.first(); // Assuming single guild bot
        if (!guild) return;

        const categoryId = config.TEMP_VOICE_CATEGORY_ID;
        const category = await guild.channels.fetch(categoryId).catch(() => null);

        if (!category || category.type !== ChannelType.GuildCategory) {
            console.error('[VoiceController] Invalid Category ID in config!');
            return;
        }

        // Look for existing trigger channel in this category
        let trigger = guild.channels.cache.find(c =>
            c.parentId === categoryId &&
            c.type === ChannelType.GuildVoice &&
            c.name.includes('➕ Join to Create')
        );

        if (!trigger) {
            console.log('[VoiceController] Creating "Join to Create" channel...');
            trigger = await guild.channels.create({
                name: '➕ Join to Create',
                type: ChannelType.GuildVoice,
                parent: categoryId,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone,
                        allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel],
                    }
                ]
            });
        }

        triggerChannelId = trigger.id;
        console.log(`[VoiceController] Trigger channel ready: ${trigger.name} (${trigger.id})`);

        // Start empty channel cleanup loop
        startCleanupLoop(guild);

    } catch (error) {
        console.error('[VoiceController] Setup error:', error);
    }
}

/**
 * Handle voice state updates for creation/deletion
 */
async function handleVoiceStateUpdate(oldState, newState) {
    const { member, guild } = newState;
    if (member.user.bot) return;

    // --- CASE 1: User joins "Join to Create" ---
    if (newState.channelId === triggerChannelId) {
        try {
            // Check if user already owns a channel
            const existingChannelId = [...activeTempChannels.entries()].find(([id, data]) => data.ownerId === member.id)?.[0];

            if (existingChannelId) {
                const existingChannel = await guild.channels.fetch(existingChannelId).catch(() => null);
                if (existingChannel) {
                    await member.voice.setChannel(existingChannel);
                    return;
                } else {
                    activeTempChannels.delete(existingChannelId);
                }
            }

            const randomId = Math.random().toString(36).substring(2, 6).toUpperCase();
            const channelName = `${member.user.username}-${randomId}`;

            const newChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildVoice,
                parent: config.TEMP_VOICE_CATEGORY_ID,
                permissionOverwrites: [
                    {
                        id: member.id,
                        allow: [
                            PermissionFlagsBits.ManageChannels,
                            PermissionFlagsBits.MoveMembers,
                            PermissionFlagsBits.MuteMembers,
                            PermissionFlagsBits.DeafenMembers,
                            PermissionFlagsBits.Connect,
                            PermissionFlagsBits.Speak
                        ],
                    }
                ]
            });

            // Move user to the new channel
            await member.voice.setChannel(newChannel);

            // Track ownership
            activeTempChannels.set(newChannel.id, {
                ownerId: member.id,
                createdAt: Date.now()
            });

            console.log(`[VoiceController] Created temp channel for ${member.user.tag}`);

        } catch (error) {
            console.error('[VoiceController] Channel creation error:', error);
        }
    }
}

/**
 * Cleanup empty channels every minute
 */
function startCleanupLoop(guild) {
    setInterval(async () => {
        const now = Date.now();
        for (const [channelId, data] of activeTempChannels.entries()) {
            try {
                const channel = await guild.channels.fetch(channelId).catch(() => null);

                if (!channel) {
                    activeTempChannels.delete(channelId);
                    continue;
                }

                if (channel.members.size === 0) {
                    // Set empty timestamp if not already set
                    if (!data.emptySince) {
                        data.emptySince = now;
                        continue;
                    }

                    // Check if it's been empty for at least 60 seconds
                    if (now - data.emptySince >= 60000) {
                        await channel.delete().catch(() => { });
                        activeTempChannels.delete(channelId);
                        console.log(`[VoiceController] Deleted empty channel: ${channelId}`);
                    }
                } else {
                    // Reset empty timestamp if someone joined
                    data.emptySince = null;
                }
            } catch (error) {
                console.error(`[VoiceController] Cleanup error for ${channelId}:`, error);
            }
        }
    }, 30000); // Check every 30 seconds for better responsiveness
}

/**
 * Send management interface embed
 */
async function sendInterface(channel) {
    const embed = new EmbedBuilder()
        .setColor(0x2F3136)
        .setTitle('TempVoice Interface')
        .setDescription('This **interface** can be used to manage temporary voice channels.\nMore options are available with **/voice** commands.')
        .setThumbnail('https://komikkuya.my.id/assets/icon.png')
        .addFields(
            { name: '⚙️ Press the buttons below to use the interface', value: '\u200B' }
        );

    // Row 1: NAME, LIMIT, PRIVACY, WAITING R., CHAT
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tv_name').setLabel('NAME').setEmoji('\u{1F4DD}').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tv_limit').setLabel('LIMIT').setEmoji('\u{1F465}').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tv_lock').setLabel('PRIVACY').setEmoji('\u{1F512}').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tv_waiting').setLabel('WAITING R.').setEmoji('\u{23F3}').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tv_chat').setLabel('CHAT').setEmoji('\u{1F4AC}').setStyle(ButtonStyle.Secondary)
    );

    // Row 2: TRUST, UNTRUST, INVITE, KICK, REGION
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tv_trust').setLabel('TRUST').setEmoji('\u{1F464}').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tv_untrust').setLabel('UNTRUST').setEmoji('\u{1F465}').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tv_invite').setLabel('INVITE').setEmoji('\u{1F4DE}').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tv_kick').setLabel('KICK').setEmoji('\u{1F6AB}').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tv_region').setLabel('REGION').setEmoji('\u{1F310}').setStyle(ButtonStyle.Secondary)
    );

    // Row 3: BLOCK, UNBLOCK, CLAIM, TRANSFER, DELETE
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tv_block').setLabel('BLOCK').setEmoji('\u{1F6D1}').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tv_unblock').setLabel('UNBLOCK').setEmoji('\u{1F513}').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tv_claim').setLabel('CLAIM').setEmoji('\u{1F451}').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tv_transfer').setLabel('TRANSFER').setEmoji('\u{1F6A9}').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tv_delete').setLabel('DELETE').setEmoji('\u{1F5D1}').setStyle(ButtonStyle.Danger)
    );

    await channel.send({ embeds: [embed], components: [row1, row2, row3] });
}

/**
 * Handle button interactions for voice management
 */
async function handleInteraction(interaction) {
    if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isAnySelectMenu()) return;

    const member = interaction.member;
    const voiceChannel = member.voice.channel;

    // Check if user is in a temp channel tracked by us
    if (!voiceChannel || !activeTempChannels.has(voiceChannel.id)) {
        if (interaction.isButton()) {
            return interaction.reply({ content: '❌ Kamu harus berada di Voice Channel buatanmu sendiri untuk menggunakan ini.', flags: 64 });
        }
        return;
    }

    const channelData = activeTempChannels.get(voiceChannel.id);
    const isOwner = channelData.ownerId === member.id;

    // Handle Buttons
    if (interaction.isButton()) {
        if (!isOwner && interaction.customId !== 'tv_claim') {
            return interaction.reply({ content: '❌ Hanya pemilik channel yang bisa melakukan ini.', flags: 64 });
        }

        switch (interaction.customId) {
            case 'tv_name':
                const nameModal = new ModalBuilder()
                    .setCustomId('modal_tv_name')
                    .setTitle('Rename Voice Channel')
                    .addComponents(new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('name_input')
                            .setLabel('Enter new name')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                            .setMaxLength(30)
                    ));
                await interaction.showModal(nameModal);
                break;

            case 'tv_limit':
                const limitModal = new ModalBuilder()
                    .setCustomId('modal_tv_limit')
                    .setTitle('Set User Limit')
                    .addComponents(new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('limit_input')
                            .setLabel('User limit (0 untuk tanpa batas)')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                            .setMaxLength(2)
                    ));
                await interaction.showModal(limitModal);
                break;

            case 'tv_lock':
                const isLocked = !voiceChannel.permissionsFor(interaction.guild.roles.everyone).has(PermissionFlagsBits.Connect);
                await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: isLocked });
                await interaction.reply({ content: `${!isLocked ? '🔒' : '🔓'} Channel sekarang **${!isLocked ? 'DIKUNCI' : 'DIBUKA'}** untuk semua orang.`, flags: 64 });
                break;

            case 'tv_claim':
                if (isOwner) return interaction.reply({ content: '❌ Kamu sudah menjadi pemilik channel ini.', flags: 64 });
                const owner = await interaction.guild.members.fetch(channelData.ownerId).catch(() => null);
                if (owner && owner.voice.channelId === voiceChannel.id) {
                    return interaction.reply({ content: '❌ Pemilik asli masih ada di dalam channel.', flags: 64 });
                }
                channelData.ownerId = member.id;
                await interaction.reply({ content: '👑 Kamu sekarang adalah pemilik channel ini.', flags: 64 });
                break;

            case 'tv_kick':
                const members = voiceChannel.members.filter(m => m.id !== member.id);
                if (members.size === 0) return interaction.reply({ content: '❌ Tidak ada orang lain di channelmu.', flags: 64 });

                const kickSelect = new StringSelectMenuBuilder()
                    .setCustomId('tv_kick_select')
                    .setPlaceholder('Pilih user yang ingin di-kick')
                    .addOptions(members.map(m => ({
                        label: m.user.username,
                        value: m.id
                    })));

                await interaction.reply({ content: '🔍 Pilih user untuk di-kick:', components: [new ActionRowBuilder().addComponents(kickSelect)], flags: 64 });
                break;

            case 'tv_delete':
                await interaction.reply({ content: '🗑️ Menghapus channel...', flags: 64 });
                await voiceChannel.delete().catch(() => { });
                activeTempChannels.delete(voiceChannel.id);
                break;

            case 'tv_waiting':
                return interaction.reply({ content: '⏳ Menunggu room tersedia...', flags: 64 });

            case 'tv_chat':
                const chatStatus = voiceChannel.permissionsFor(interaction.guild.roles.everyone).has(PermissionFlagsBits.SendMessages);
                await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: !chatStatus });
                await interaction.reply({ content: `💬 Chat channel sekarang **${!chatStatus ? 'DIBUKA' : 'DITUTUP'}** untuk semua orang.`, flags: 64 });
                break;

            case 'tv_trust':
            case 'tv_block':
            case 'tv_untrust':
            case 'tv_unblock':
            case 'tv_transfer':
            case 'tv_region':
                return interaction.reply({ content: '🛠️ Fitur ini sedang dalam pengembangan.', flags: 64 });
        }
    }

    // Handle Select Menus
    if (interaction.isStringSelectMenu()) {
        if (!isOwner) return interaction.reply({ content: '❌ Hanya pemilik channel yang bisa melakukan ini.', flags: 64 });

        if (interaction.customId === 'tv_kick_select') {
            const targetId = interaction.values[0];
            const target = await interaction.guild.members.fetch(targetId).catch(() => null);

            if (target && target.voice.channelId === voiceChannel.id) {
                await target.voice.setChannel(null);
                await interaction.update({ content: `✅ **${target.user.username}** telah di-kick dari voice room.`, components: [], flags: 64 });
            } else {
                await interaction.update({ content: '❌ User sudah tidak ada di channel.', components: [], flags: 64 });
            }
        }
    }

    // Handle Modals
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_tv_name') {
            const newName = interaction.fields.getTextInputValue('name_input');
            await voiceChannel.setName(newName);
            await interaction.reply({ content: `✅ Nama channel diubah menjadi: **${newName}**`, flags: 64 });
        }

        if (interaction.customId === 'modal_tv_limit') {
            const limit = parseInt(interaction.fields.getTextInputValue('limit_input'));
            if (isNaN(limit) || limit < 0 || limit > 99) {
                return interaction.reply({ content: '❌ Batas user harus angka antara 0 - 99.', flags: 64 });
            }
            await voiceChannel.setUserLimit(limit);
            await interaction.reply({ content: `✅ Batas user diubah menjadi: **${limit || 'Tanpa Batas'}**`, flags: 64 });
        }
    }
}

module.exports = {
    setupTriggerChannel,
    handleVoiceStateUpdate,
    handleInteraction,
    sendInterface
};
