require('dotenv').config();

const app = require('./app');
const { loadOperatorsFromFile } = require('./db/inMemoryStore');

const port = Number(process.env.PORT || 3000);
const loaded = loadOperatorsFromFile();

app.listen(port, () => {
  // Keep startup logging minimal and explicit.
  console.log(`Loaded ${loaded.count} operators from ${loaded.filePath}`);
  console.log(`Server listening on port ${port}`);
});
