import { createApp } from './app.js';
import { createPorts } from './ports/index.js';
import { config } from './config.js';

const ports = createPorts();
const app = createApp(ports);

app.listen(config.port, () => {
  console.log(`PapelHub API listening on :${config.port} (env=${config.nodeEnv})`);
});
