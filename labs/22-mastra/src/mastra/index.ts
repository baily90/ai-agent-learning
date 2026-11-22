import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { supportAgent } from './agents/support';
import { ticketWorkflow } from './workflows/ticket';

export const mastra = new Mastra({
  storage: new LibSQLStore({ id: 'lab-storage', url: 'file:./mastra.db' }),
  agents: { support: supportAgent },
  workflows: { ticket: ticketWorkflow },
});
