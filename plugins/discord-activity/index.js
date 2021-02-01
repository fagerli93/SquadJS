export default {
  name: 'discord-activity',
  description:
    'The <code>discord-activity</code> plugin will retrieve the activity for players for a given period of time ',
  defaultEnabled: true,
  optionsSpec: {
    discordClient: {
      required: true,
      description: 'The name of the Discord Connector to use.',
      default: 'discord'
    },
    channelID: {
      required: true,
      description: 'The ID of the channel to log activity to',
      default: '',
      example: '667741905228136459'
    },
    color: {
      required: false,
      description: 'The color of the embed.',
      default: 16761867
    }
  },

  init: async (server, options) => {
    const channel = await options.discordClient.channels.fetch(options.channelID);
    const regex = /^(!activity )(([0-2][0-9]|(3)[0-1])(\/)(((0)[0-9])|((1)[0-2]))(\/)\d{4} )(([0-2][0-9]|(3)[0-1])(\/)(((0)[0-9])|((1)[0-2]))(\/)\d{4}) (.*)$/g;

    channel.on('message', (msg) => {
      if (msg.match(regex)) {
        msg.reply('Hello billyboi');
      }
    });
  }
};
