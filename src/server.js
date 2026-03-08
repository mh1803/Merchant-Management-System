require('dotenv').config();

const app = require('./app');

const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  // Keep startup logging minimal and explicit.
  console.log(`Auth storage: ${process.env.AUTH_STORAGE || 'postgres'}`);
  console.log(`Server listening on port ${port}`);
});
