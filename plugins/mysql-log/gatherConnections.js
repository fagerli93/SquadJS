import { StateEnum } from './stateEnum.js';

export const gatherPlayerConnections = (server, options, updatedPlayerList, oldPlayerList) => {
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
        interval: this.calculateIntervalMinutes(res.connect, res.disconnect)
      };
    });
  if (disconnectedPlayers.length > 0) {
    console.log('Player disconnected', disconnectedPlayers);
    // Capture last bit of connectionTime and log to DB
    disconnectedPlayers.foreach((disconnectedPlayer) => {
      switch (disconnectedPlayer.state) {
        case StateEnum.Inactive: {
          disconnectedPlayer.inactiveTime =
            (disconnectedPlayer.inactiveTime ?? 0) +
            this.calculateIntervalMinutes(
              currentTime,
              disconnectedPlayer.lastUpdate ?? currentTime
            );
          break;
        }
        case StateEnum.Seeding: {
          disconnectedPlayer.seedingTime =
            (disconnectedPlayer.seedingTime ?? 0) +
            this.calculateIntervalMinutes(
              currentTime,
              disconnectedPlayer.lastUpdate ?? currentTime
            );
          break;
        }
        default: {
          disconnectedPlayer.activeTime =
            (disconnectedPlayer.activeTime ?? 0) +
            this.calculateIntervalMinutes(
              currentTime,
              disconnectedPlayer.lastUpdate ?? currentTime
            );
          break;
        }
      }
      console.log('Attempting to write to DB');
      options.mysqlPool.query(
        'INSERT INTO PlayerConnections(steamID, name, connect, disconnect, interval, active, inactive, seeding) VALUES (?,?,?,?,?,?,?,?)',
        [
          disconnectedPlayer.steamID,
          disconnectedPlayer.name,
          disconnectedPlayer.connect,
          disconnectedPlayer.disconnect,
          disconnectedPlayer.interval,
          disconnectedPlayer.activeTime ?? 0,
          disconnectedPlayer.inactiveTime ?? 0,
          disconnectedPlayer.seedingTime ?? 0
        ]
      );
    });
  }

  return updatedPlayerList.map((updatedPlayer) => {
    return {
      ...updatedPlayer,
      connect:
        oldPlayerList.find((oldPlayer) => oldPlayer.steamID === updatedPlayer.steamID) ??
        currentTime,
      state: updatedPlayerList.length >= 40 ? StateEnum.Playing : StateEnum.Seeding,
      lastUpdate: updatedPlayer.lastUpdate || currentTime
    };
  });
};

export const calculateIntervalMinutes = (date1, date2) => {
  return Math.round((((date1 - date2) % 86400000) % 3600000) / 60000);
};
