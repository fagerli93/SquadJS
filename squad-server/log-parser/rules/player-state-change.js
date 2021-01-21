import { PLAYER_STATE_CHANGE } from '../../events.js';

export default {
  regex: /^\[([0-9.:-]+)]\[([ 0-9]*)]LogSquadTrace: \[DedicatedServer]ChangeState\(\): PC=(.+) OldState=(Inactive|Playing) NewState=(Inactive|Playing)/,
  onMatch: (args, logParser) => {
    const data = {
      raw: args[0],
      time: args[1],
      chainID: args[2],
      player: args[3],
      oldState: args[4],
      newState: args[5]
    };

    logParser.server.emit(PLAYER_STATE_CHANGE, data);
  }
};
