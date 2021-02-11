import { StateEnum } from './stateEnum.js';

export const calculateIntervalMinutes = (date1, date2) => {
  return Math.round((((date1 - date2) % 86400000) % 3600000) / 60000);
};

export const gatherPlayerConnections = (server, options, updatedPlayerList, oldPlayerList) => {
  console.log('Updated list: ', updatedPlayerList);
  console.log('Old list: ', oldPlayerList);
  // Get some info that we need
  const currentTime = new Date();
  const updatedPlayerListSteamIds = updatedPlayerList.map((p) => p.steamID);
  const oldPlayerListSteamIds = oldPlayerList.map((p) => p.steamID);
  const connectedPlayersListSteamIds = updatedPlayerList
    .filter((updatedPlayer) => !oldPlayerListSteamIds.includes(updatedPlayer.steamID))
    .map((p) => p.steamID);
  const disconnectedPlayers = oldPlayerList
    .filter((oldPlayer) => !updatedPlayerListSteamIds.includes(oldPlayer.steamID))
    .map((disconnectedPlayer) => {
      const res = {
        ...disconnectedPlayer,
        disconnect: currentTime
      };
      return {
        ...res,
        interval: calculateIntervalMinutes(res.connect, res.disconnect)
      };
    });
  const disconnectedPlayersListSteamIds = disconnectedPlayers.map(
    (disconnectedPlayer) => disconnectedPlayer.steamID
  );

  // Update all players state
  updatedPlayerList = updatedPlayerList.map((player) => {
    return {
      ...player,
      state:
        updatedPlayerList.length >= options.seedingLimit ? StateEnum.Playing : StateEnum.Seeding
    };
  });

  // Handle newly connected players and update their lastUpdate and connect time
  if (connectedPlayersListSteamIds.length > 0) {
    console.log(`Newly connected players: `, connectedPlayersListSteamIds);
    updatedPlayerList = updatedPlayerList.map((updatedPlayer) => {
      if (connectedPlayersListSteamIds.includes(updatedPlayer.steamID)) {
        console.log('Setting currentTime and shit for connected player');
        return { ...updatedPlayer, lastUpdate: currentTime, connect: currentTime };
      }
      return updatedPlayer;
    });
  }

  // Handle disconnected players
  if (disconnectedPlayers.length > 0) {
    console.log('Disconnected players', disconnectedPlayers);
    for (let i = 0; i < disconnectedPlayers.length; i++) {
      const intervalInMinutes = calculateIntervalMinutes(
        currentTime,
        disconnectedPlayers[i].lastUpdate ?? currentTime
      );
      console.log(
        `Going through for player: ${disconnectedPlayers[i].name} with state ${disconnectedPlayers[i].state} - interval: ${intervalInMinutes}`
      );
      switch (disconnectedPlayers[i].state) {
        case StateEnum.Inactive: {
          disconnectedPlayers[i].inactiveTime =
            (disconnectedPlayers[i].inactiveTime ?? 0) + intervalInMinutes;

          break;
        }
        case StateEnum.Seeding: {
          disconnectedPlayers[i].seedingTime =
            (disconnectedPlayers[i].seedingTime ?? 0) + intervalInMinutes;
          break;
        }
        default: {
          disconnectedPlayers[i].activeTime =
            (disconnectedPlayers[i].activeTime ?? 0) + intervalInMinutes;
          break;
        }
      }
      console.log(
        'Attempting to write to DB',
        disconnectedPlayers[i].activeTime ?? 0,
        disconnectedPlayers[i].inactiveTime ?? 0,
        disconnectedPlayers[i].seedingTime ?? 0
      );
      options.mysqlPool.query(
        'INSERT INTO PlayerConnections(steamID, name, connect, disconnect, interval, active, inactive, seeding) VALUES (?,?,?,?,?,?,?,?)',
        [
          disconnectedPlayers[i].steamID,
          disconnectedPlayers[i].name,
          disconnectedPlayers[i].connect,
          disconnectedPlayers[i].disconnect,
          disconnectedPlayers[i].interval,
          disconnectedPlayers[i].activeTime ?? 0,
          disconnectedPlayers[i].inactiveTime ?? 0,
          disconnectedPlayers[i].seedingTime ?? 0
        ]
      );
    }
  }

  // Handle players that changed their state
  const playersWithPossibleNewState = updatedPlayerList
    .filter((player) => !disconnectedPlayersListSteamIds.includes(player.steamID))
    .filter((player) => !connectedPlayersListSteamIds.includes(player.steamID));
  for (let i = 0; i < playersWithPossibleNewState.length; i++) {
    const oldListIndex = oldPlayerList.findIndex(
      (player) => player.steamID === playersWithPossibleNewState[i].steamID
    );
    const updatedIndex = updatedPlayerList.findIndex(
      (player) => player.steamID === playersWithPossibleNewState[i].steamID
    );
    // Get previous state and merge
    if (oldListIndex !== -1) {
      if (updatedIndex !== -1) {
        updatedPlayerList[updatedIndex] = {
          ...oldPlayerList[oldListIndex],
          ...updatedPlayerList[updatedIndex]
        };
      } else {
        console.warn('UPDATED INDEX NOT VALID - SOMETHING WENT TO SHIT');
      }
      if (playersWithPossibleNewState[i].state !== oldPlayerList[oldListIndex].state) {
        console.log(`User ${playersWithPossibleNewState[i].name} changed his state`);
        switch (oldPlayerList[oldListIndex].state) {
          case StateEnum.Seeding: {
            updatedPlayerList[updatedIndex].seedingTime =
              (updatedPlayerList[updatedIndex].seedingTime ?? 0) +
              calculateIntervalMinutes(updatedPlayerList[updatedIndex].lastUpdate, currentTime);
            break;
          }
          default: {
            updatedPlayerList[updatedIndex].activeTime =
              (updatedPlayerList[updatedIndex].activeTime ?? 0) +
              calculateIntervalMinutes(updatedPlayerList[updatedIndex].lastUpdate, currentTime);
          }
        }
        updatedPlayerList[updatedIndex].lastUpdate = currentTime;
      }
    } else {
      console.warn('OLD INDEX NOT VALID - SOMETHING WENT TO SHIT');
    }
    // User changed his state
  }

  console.log('Returning list: ', updatedPlayerList);

  return updatedPlayerList;
};
