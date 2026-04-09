import { startServer } from './src/index.js';
import fs from 'fs';
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
config.security.require_approval = false; 
startServer(3000, 'Password123!', config).then(() => console.log('Server started on 3000')).catch(e => console.error(e));
