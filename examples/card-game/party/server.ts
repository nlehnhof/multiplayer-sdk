import { createPartyKitServer } from '@multiplayer-agent-sdk/adapter-partykit';
import { roomDefinition } from '../src/room.js';

export default createPartyKitServer(roomDefinition);
