const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    StreamType
} = require('@discordjs/voice');
const { spawn } = require('child_process');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

// Queue storage per guild
const queues = new Map();

/**
 * Get or create a queue for a guild
 */
function getQueue(guildId) {
    if (!queues.has(guildId)) {
        queues.set(guildId, {
            songs: [],
            player: null,
            connection: null,
            playing: false
        });
    }
    return queues.get(guildId);
}

/**
 * Get video info using yt-dlp
 */
async function getVideoInfo(url) {
    return new Promise((resolve, reject) => {
        const process = spawn('yt-dlp', [
            '--dump-json',
            '--no-warnings',
            url
        ]);

        let data = '';
        process.stdout.on('data', (chunk) => {
            data += chunk;
        });

        process.on('close', (code) => {
            if (code === 0) {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('Failed to parse video info'));
                }
            } else {
                reject(new Error('yt-dlp exited with code ' + code));
            }
        });

        process.on('error', reject);
    });
}

/**
 * Search videos using yt-dlp
 */
async function searchVideos(query, limit = 5) {
    return new Promise((resolve, reject) => {
        const process = spawn('yt-dlp', [
            `ytsearch${limit}:${query}`,
            '--dump-json',
            '--no-warnings',
            '--flat-playlist'
        ]);

        let data = '';
        process.stdout.on('data', (chunk) => {
            data += chunk;
        });

        process.on('close', (code) => {
            if (code === 0) {
                try {
                    const lines = data.trim().split('\n').filter(l => l);
                    const results = lines.map(line => JSON.parse(line));
                    resolve(results);
                } catch (e) {
                    reject(new Error('Failed to parse search results'));
                }
            } else {
                reject(new Error('yt-dlp search failed'));
            }
        });

        process.on('error', reject);
    });
}

/**
 * Play the next song in the queue
 */
async function playNext(guildId, textChannel) {
    const queue = getQueue(guildId);

    if (queue.songs.length === 0) {
        queue.playing = false;
        setTimeout(() => {
            const q = getQueue(guildId);
            if (!q.playing && q.connection) {
                q.connection.destroy();
                q.connection = null;
                queues.delete(guildId);
            }
        }, 120000);
        return;
    }

    const song = queue.songs[0];
    queue.playing = true;

    try {
        console.log('[MusicController] Playing:', song.title);

        // Spawn yt-dlp to stream audio
        const ytdlp = spawn('yt-dlp', [
            '-f', 'bestaudio',
            '-o', '-',
            '--no-warnings',
            song.url
        ]);

        ytdlp.stderr.on('data', (data) => {
            console.log('[yt-dlp]', data.toString().trim());
        });

        const resource = createAudioResource(ytdlp.stdout, {
            inputType: StreamType.Arbitrary
        });

        queue.player.play(resource);

        const embed = new EmbedBuilder()
            .setTitle('🎵 Now Playing')
            .setDescription(`**[${song.title}](${song.url})**`)
            .setThumbnail(song.thumbnail)
            .addFields(
                { name: 'Duration', value: song.duration, inline: true },
                { name: 'Requested by', value: `<@${song.requestedBy}>`, inline: true }
            )
            .setColor(0xBE00FF)
            .setFooter({ text: `Queue: ${queue.songs.length} song(s)` });

        await textChannel.send({ embeds: [embed] });

    } catch (error) {
        console.error('[MusicController] Error playing song:', error);
        queue.songs.shift();
        await textChannel.send(`❌ Error playing **${song.title}**. Skipping...`);
        playNext(guildId, textChannel);
    }
}

/**
 * Handle /playlink command
 */
async function handlePlayLink(interaction) {
    const url = interaction.options.getString('url');
    const member = interaction.member;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
        return interaction.reply({ content: '❌ Kamu harus berada di voice channel terlebih dahulu!', ephemeral: true });
    }

    await interaction.deferReply();

    try {
        const info = await getVideoInfo(url);

        const song = {
            title: info.title,
            url: info.webpage_url || url,
            duration: formatDuration(info.duration || 0),
            thumbnail: info.thumbnail || '',
            requestedBy: interaction.user.id
        };

        const queue = getQueue(interaction.guildId);

        if (!queue.connection) {
            queue.connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: interaction.guildId,
                adapterCreator: interaction.guild.voiceAdapterCreator
            });

            queue.player = createAudioPlayer();
            queue.connection.subscribe(queue.player);

            queue.player.on(AudioPlayerStatus.Idle, () => {
                queue.songs.shift();
                playNext(interaction.guildId, interaction.channel);
            });

            queue.player.on('error', (error) => {
                console.error('[MusicController] Player error:', error);
                queue.songs.shift();
                playNext(interaction.guildId, interaction.channel);
            });
        }

        queue.songs.push(song);

        if (!queue.playing) {
            await interaction.editReply(`✅ **${song.title}** ditambahkan dan akan segera diputar!`);
            playNext(interaction.guildId, interaction.channel);
        } else {
            await interaction.editReply(`✅ **${song.title}** ditambahkan ke antrian (posisi #${queue.songs.length})`);
        }

    } catch (error) {
        console.error('[MusicController] PlayLink error:', error);
        await interaction.editReply('❌ Gagal mendapatkan info video. Pastikan URL valid!');
    }
}

/**
 * Handle /playsearch command
 */
async function handlePlaySearch(interaction) {
    const query = interaction.options.getString('query');
    const member = interaction.member;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
        return interaction.reply({ content: '❌ Kamu harus berada di voice channel terlebih dahulu!', ephemeral: true });
    }

    await interaction.deferReply();

    try {
        const results = await searchVideos(query, 5);

        if (results.length === 0) {
            return interaction.editReply('❌ Tidak ditemukan hasil untuk pencarian tersebut.');
        }

        const options = results.map((video, index) => ({
            label: (video.title || `Video ${index + 1}`).substring(0, 100),
            description: `${formatDuration(video.duration || 0)} • ${video.channel || 'Unknown'}`.substring(0, 100),
            value: video.url || video.webpage_url || video.id
        }));

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('music_search_select')
                .setPlaceholder('Pilih lagu yang ingin diputar...')
                .addOptions(options)
        );

        const embed = new EmbedBuilder()
            .setTitle('🔍 Hasil Pencarian')
            .setDescription(`Pencarian untuk: **${query}**\n\nPilih salah satu dari menu di bawah:`)
            .setColor(0xBE00FF);

        await interaction.editReply({ embeds: [embed], components: [row] });

    } catch (error) {
        console.error('[MusicController] PlaySearch error:', error);
        await interaction.editReply('❌ Gagal mencari video. Coba lagi!');
    }
}

/**
 * Handle search select menu interaction
 */
async function handleSearchSelect(interaction) {
    const url = interaction.values[0];
    const member = interaction.member;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
        return interaction.reply({ content: '❌ Kamu harus berada di voice channel terlebih dahulu!', ephemeral: true });
    }

    await interaction.deferUpdate();

    try {
        const info = await getVideoInfo(url);

        const song = {
            title: info.title,
            url: info.webpage_url || url,
            duration: formatDuration(info.duration || 0),
            thumbnail: info.thumbnail || '',
            requestedBy: interaction.user.id
        };

        const queue = getQueue(interaction.guildId);

        if (!queue.connection) {
            queue.connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: interaction.guildId,
                adapterCreator: interaction.guild.voiceAdapterCreator
            });

            queue.player = createAudioPlayer();
            queue.connection.subscribe(queue.player);

            queue.player.on(AudioPlayerStatus.Idle, () => {
                queue.songs.shift();
                playNext(interaction.guildId, interaction.channel);
            });

            queue.player.on('error', (error) => {
                console.error('[MusicController] Player error:', error);
                queue.songs.shift();
                playNext(interaction.guildId, interaction.channel);
            });
        }

        queue.songs.push(song);
        await interaction.editReply({ components: [] });

        if (!queue.playing) {
            await interaction.followUp(`✅ **${song.title}** ditambahkan dan akan segera diputar!`);
            playNext(interaction.guildId, interaction.channel);
        } else {
            await interaction.followUp(`✅ **${song.title}** ditambahkan ke antrian (posisi #${queue.songs.length})`);
        }

    } catch (error) {
        console.error('[MusicController] SearchSelect error:', error);
        await interaction.followUp({ content: '❌ Gagal memutar video. Coba lagi!', ephemeral: true });
    }
}

async function handleSkip(interaction) {
    const queue = getQueue(interaction.guildId);
    if (!queue.playing || queue.songs.length === 0) {
        return interaction.reply({ content: '❌ Tidak ada lagu yang sedang diputar!', ephemeral: true });
    }
    const skipped = queue.songs[0];
    queue.player.stop();
    await interaction.reply(`⏭️ Skipped: **${skipped.title}**`);
}

async function handleStop(interaction) {
    const queue = getQueue(interaction.guildId);
    if (!queue.connection) {
        return interaction.reply({ content: '❌ Bot tidak sedang di voice channel!', ephemeral: true });
    }
    queue.songs = [];
    queue.playing = false;
    queue.player?.stop();
    queue.connection?.destroy();
    queue.connection = null;
    queues.delete(interaction.guildId);
    await interaction.reply('🛑 Musik dihentikan dan bot keluar dari voice channel.');
}

async function handlePause(interaction) {
    const queue = getQueue(interaction.guildId);
    if (!queue.playing) {
        return interaction.reply({ content: '❌ Tidak ada lagu yang sedang diputar!', ephemeral: true });
    }
    queue.player.pause();
    await interaction.reply('⏸️ Musik di-pause.');
}

async function handleResume(interaction) {
    const queue = getQueue(interaction.guildId);
    if (!queue.player) {
        return interaction.reply({ content: '❌ Tidak ada lagu yang sedang diputar!', ephemeral: true });
    }
    queue.player.unpause();
    await interaction.reply('▶️ Musik dilanjutkan.');
}

async function handleQueue(interaction) {
    const queue = getQueue(interaction.guildId);
    if (queue.songs.length === 0) {
        return interaction.reply({ content: '📭 Antrian kosong!', ephemeral: true });
    }
    const queueList = queue.songs.slice(0, 10).map((song, index) => {
        const prefix = index === 0 ? '🎵 **Now Playing:**' : `**${index}.**`;
        return `${prefix} [${song.title}](${song.url}) • \`${song.duration}\``;
    }).join('\n');

    const embed = new EmbedBuilder()
        .setTitle('📜 Music Queue')
        .setDescription(queueList)
        .setColor(0xBE00FF)
        .setFooter({ text: `Total: ${queue.songs.length} lagu` });

    await interaction.reply({ embeds: [embed] });
}

function formatDuration(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

module.exports = {
    handlePlayLink,
    handlePlaySearch,
    handleSearchSelect,
    handleSkip,
    handleStop,
    handlePause,
    handleResume,
    handleQueue,
    getQueue
};
