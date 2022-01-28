import express from 'express';
import dotenv from "dotenv"
import { rootHandler } from './handlers/handlers';

if (process.env.NODE_ENV === 'development') dotenv.config({ path: './.env.local' })

const app = express();
const port = process.env.PORT || '3000';

app.get('/', rootHandler);

app.listen(port, err => {
  if (err) return console.error(err);
  return console.log(`Server is running: http://localhost:${port}`);
});
