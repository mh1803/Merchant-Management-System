import 'dotenv/config';
import app from './app';

const port = Number(process.env.PORT || 3000);

// Server bootstrap stays intentionally small so the app can be imported directly in tests.
app.listen(port, () => {
  console.log(`Auth storage: ${process.env.AUTH_STORAGE || 'postgres'}`);
  console.log(`Server listening on port ${port}`);
});
