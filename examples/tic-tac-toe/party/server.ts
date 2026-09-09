import { createPartyKitServer } from '@multiplayer-agent-sdk/adapter-partykit';
import { ticTacToeRoom } from '../src/room.js';

export default createPartyKitServer(ticTacToeRoom);
