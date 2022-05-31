const d = require('discord.js');

module.exports = {
    name: 'play',
    usage: 'h play <query: string>',
    description: 'Search for a song and play it',
    cooldown: '5s',
    aliases: 'p',
    run: async (client, message, args) => {
        const player = client.player;
        if (!message.member.voice.channelId)
            return await message.reply('You are not in a voice channel');
        if (
            message.guild.me.voice.channelId &&
            message.member.voice.channelId != message.guild.me.voice.channelId
        )
            return message.reply('You are not in my voice channel');
        if (!args[0]) return message.reply('Please provide a search query');

        const queue = player.createQueue(message.guild, {
            ytdlOptions: {
                filter: 'audioonly',
                highWaterMark: 1 << 30,
                dlChunkSize: 0
            },
            metadata: {
                channel: message.channel
            }
        });

        try {
            if (!queue.connection)
                await queue.connect(message.member.voice.channel);
        } catch {
            queue.destroy();
            return message.reply('Could not join your voice channel');
        }

        message.channel.sendTyping();
        let status = 0;

        const tracks = await player
            .search(args.join(' '), {
                requestedBy: message.user
            })
            .then((x) => x.tracks.slice(0, 5));

        let options = [];
        for (let i = 0; i < tracks.length; i++) {
            let n = tracks[i];
            tracks[i].pos = i + 1;
            options.push({
                label: `${i + 1}. ${
                    n.title.slice(0, 94) + (n.title.length > 94 ? '...' : '')
                }`,
                description: `By ${n.author} (${n.duration})`,
                value: i.toString()
            });
        }
        options.push({
            label: 'Cancel',
            description: 'Cancel this operation',
            value: 'x'
        });

        const row = new d.MessageActionRow().addComponents(
            new d.MessageSelectMenu()
                .setCustomId('search')
                .setPlaceholder('Select a song')
                .addOptions(options)
        );
        options = options.slice(0, -1);

        const drow = new d.MessageActionRow().addComponents(
            new d.MessageSelectMenu()
                .setCustomId('selected')
                .setPlaceholder('Select a song')
                .addOptions([
                    {
                        label: 'what are you looking at?',
                        description: 'this is just a',
                        value: 'disabled'
                    },
                    {
                        label: 'select menu',
                        description: 'smh',
                        value: 'now stop reading this'
                    }
                ])
                .setDisabled(true)
        );

        const em = new d.MessageEmbed()
            .setTitle('Please select one of the songs below')
            .setDescription(
                options
                    .map((x) => tracks[Number(x.value)])
                    .map(
                        (x) =>
                            `**${x.pos}.** [${x.title}](${x.url}) (\`${x.duration}\`)`
                    )
                    .join('\n')
            )
            .setFooter({
                text: message.author.tag,
                iconURL: message.author.avatarURL({ dynamic: true })
            })
            .setTimestamp()
            .setColor(client.config.c.d);

        const msg = await message.reply({ embeds: [em], components: [row] });

        const col = msg.createMessageComponentCollector({
            time: 60000,
            idle: 69420
        });

        col.on('collect', async (i) => {
            if (i.user.id != message.author.id)
                return i.reply({
                    content: `Only <@${message.author.id}> can use this select menu!`,
                    ephemeral: true
                });

            status = 1;
            i.deferUpdate().catch(() => {});

            if (i.values[0] == 'x') {
                if (!queue.playing) queue.destroy();
                msg.edit({ content: 'Cancelled', components: [drow] });
            } else {
                let track = tracks[Number(i.values[0])];
                track.requestedBy = message.member.user;
                msg.reply({
                    embeds: [
                        new d.MessageEmbed()
                            .setTitle(track.title)
                            .setURL(track.url)
                            .setAuthor({ name: 'Added a song to the queue' })
                            .setDescription(
                                `By **${track.author}** (\`${track.duration}\`)`
                            )
                            .setFooter({
                                text: message.author.tag,
                                iconURL: message.author.avatarURL({
                                    dynamic: true
                                })
                            })
                            .setTimestamp()
                            .setColor(client.config.c.d)
                            .setThumbnail(track.thumbnail)
                    ]
                });
                msg.edit({ components: [drow] });
                queue.addTracks([track]);
                if (!queue.playing) await queue.play();
            }
        });

        col.on('end', () => {
            if (status == 0) {
                if (!queue.playing) queue.destroy();
                return msg.edit({
                    content: 'Command timed out',
                    components: [drow]
                });
            }
        });
    }
};
