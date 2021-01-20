import {
  NEW_GAME,
  PLAYER_WOUNDED,
  PLAYER_DIED,
  PLAYER_REVIVED,
  TICK_RATE,
  PLAYERS_UPDATED
} from 'squad-server/events';

export default {
  name: 'mysql-log',
  description:
    'The <code>mysql-log</code> plugin will log various server statistics and events to a MySQL database. This is great for ' +
    'server performance monitoring and/or player stat tracking.' +
    '\n\n' +
    'Installation:\n' +
    ' * Obtain/Install MySQL. MySQL v8.x.x has been tested with this plugin and is recommended.\n' +
    ' * Enable legacy authentication in your database using [this guide](https://stackoverflow.com/questions/50093144/mysql-8-0-client-does-not-support-authentication-protocol-requested-by-server).\n' +
    ' * Execute the [schema](https://github.com/Thomas-Smyth/SquadJS/blob/master/plugins/mysql-log/mysql-schema.sql) to setup the database.\n' +
    ' * Add a server to the database with <code>INSERT INTO Server (name) VALUES ("Your Server Name");</code>.\n' +
    ' * Find the ID of the server you just inserted with <code>SELECT * FROM Server;</code>.\n' +
    ' * Replace the server ID in your config with the ID from the inserted record in the database.\n' +
    '\n\n' +
    'If you encounter any issues you can enable <code>"debug": true</code> in your MySQL connector to get more error logs in the console.\n' +
    '\n\n' +
    'Grafana:\n' +
    ' * [Grafana](https://grafana.com/) is a cool way of viewing server statistics stored in the database.\n' +
    ' * Install Grafana.\n' +
    ' * Add your MySQL database as a datasource named <code>SquadJS - MySQL</code>.\n' +
    ' * Import the [SquadJS Dashboard](https://github.com/Thomas-Smyth/SquadJS/blob/master/plugins/mysql-log/SquadJS-Dashboard.json) to get a preconfigured MySQL only Grafana dashboard.\n' +
    ' * Install any missing Grafana plugins.',

  defaultEnabled: false,
  optionsSpec: {
    mysqlPool: {
      required: true,
      description: 'The name of the MySQL Pool Connector to use.',
      default: 'mysql'
    },
    overrideServerID: {
      required: false,
      description: 'A overridden server ID.',
      default: null
    },
    logPlayerConnections: {
      required: false,
      description: 'Whether or not to log player connections',
      default: false
    }
  },
  init: async (server, options) => {
    const serverID = options.overrideServerID === null ? server.id : options.overrideServerID;
    let currentPlayerList = [];

    server.on(TICK_RATE, (info) => {
      options.mysqlPool.query(
        'INSERT INTO ServerTickRate(time, server, tick_rate) VALUES (?,?,?)',
        [info.time, serverID, info.tickRate]
      );
    });

    server.on(PLAYERS_UPDATED, (players) => {
      options.mysqlPool.query(
        'INSERT INTO PlayerCount(time, server, player_count) VALUES (NOW(),?,?)',
        [serverID, players.length]
      );
      if (options.logPlayerConnections) {
        currentPlayerList = this.gatherPlayerConnections(
          server,
          options,
          players,
          currentPlayerList
        );
      }
    });

    server.on(NEW_GAME, (info) => {
      options.mysqlPool.query('call NewMatch(?,?,?,?,?,?,?,?)', [
        serverID,
        info.time,
        info.dlc,
        info.mapClassname,
        info.layerClassname,
        info.map,
        info.layer,
        info.winner
      ]);
    });

    server.on(PLAYER_WOUNDED, (info) => {
      options.mysqlPool.query('call InsertPlayerWounded(?,?,?,?,?,?,?,?,?,?,?,?,?)', [
        serverID,
        info.time,
        info.victim ? info.victim.steamID : null,
        info.victim ? info.victim.name : null,
        info.victim ? info.victim.teamID : null,
        info.victim ? info.victim.squadID : null,
        info.attacker ? info.attacker.steamID : null,
        info.attacker ? info.attacker.name : null,
        info.attacker ? info.attacker.teamID : null,
        info.attacker ? info.attacker.squadID : null,
        info.damage,
        info.weapon,
        info.teamkill
      ]);
    });

    server.on(PLAYER_DIED, (info) => {
      options.mysqlPool.query('call InsertPlayerDied(?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
        serverID,
        info.time,
        info.woundTime,
        info.victim ? info.victim.steamID : null,
        info.victim ? info.victim.name : null,
        info.victim ? info.victim.teamID : null,
        info.victim ? info.victim.squadID : null,
        info.attacker ? info.attacker.steamID : null,
        info.attacker ? info.attacker.name : null,
        info.attacker ? info.attacker.teamID : null,
        info.attacker ? info.attacker.squadID : null,
        info.damage,
        info.weapon,
        info.teamkill
      ]);
    });

    server.on(PLAYER_REVIVED, (info) => {
      options.mysqlPool.query('call InsertPlayerRevived(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
        serverID,
        info.time,
        info.woundTime,
        info.victim ? info.victim.steamID : null,
        info.victim ? info.victim.name : null,
        info.victim ? info.victim.teamID : null,
        info.victim ? info.victim.squadID : null,
        info.attacker ? info.attacker.steamID : null,
        info.attacker ? info.attacker.name : null,
        info.attacker ? info.attacker.teamID : null,
        info.attacker ? info.attacker.squadID : null,
        info.damage,
        info.weapon,
        info.teamkill,
        info.reviver ? info.reviver.steamID : null,
        info.reviver ? info.reviver.name : null,
        info.reviver ? info.reviver.teamID : null,
        info.reviver ? info.reviver.squadID : null
      ]);
    });
  },
  gatherPlayerConnections: (server, options, updatedPlayerList, oldPlayerList) => {
    const currentTime = new Date();
    // Filter out the new players compared to old list
    const updatedPlayerListSteamIds = updatedPlayerList.map((p) => p.steamID);
    const disconnectedPlayers = oldPlayerList
      .filter((oldPlayer) => !updatedPlayerListSteamIds.includes(oldPlayer.steamID))
      .map((disconnectedPlayer) => {
        const res = {
          ...disconnectedPlayer,
          connect:
            oldPlayerList.find((oldPlayer) => oldPlayer.steamID === disconnectedPlayer.steamID) ??
            currentTime,
          disconnect: currentTime
        };
        return {
          ...res,
          interval: Math.round((((res.connect - res.disconnect) % 86400000) % 3600000) / 60000)
        };
      });
    if (disconnectedPlayers.length > 0) {
      disconnectedPlayers.foreach((disconnectedPlayer) => {
        options.mysqlPool.query(
          'INSERT INTO PlayerConnections(steamID, name, connect, disconnect, interval) VALUES (?,?,?,?,?)',
          [
            disconnectedPlayer.steamID,
            disconnectedPlayer.name,
            disconnectedPlayer.connect,
            disconnectedPlayer.disconnect,
            disconnectedPlayer.interval
          ]
        );
      });
    }

    return updatedPlayerList.map((updatedPlayer) => {
      return {
        ...updatedPlayer,
        connect:
          oldPlayerList.find((oldPlayer) => oldPlayer.steamID === updatedPlayer.steamID) ??
          currentTime
      };
    });
  }
};
