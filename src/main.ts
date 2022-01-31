import express from 'express';
import dotenv from "dotenv"
import errorHandler from './api/middleware/errorHandler'
import { rootHandler } from './handlers/handlers';

if (process.env.NODE_ENV === 'development') dotenv.config({ path: './.env.local' })

const app = express();
const port = process.env.PORT || '3000';

app.use(errorHandler);

app.get('/', rootHandler);

app.listen(port, () => {
  console.log(`Server is running at: http://localhost:${port}`);
});
