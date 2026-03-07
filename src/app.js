const express = require('express');
const { authRouter } = require('./routes/authRoutes');
const { notFound } = require('./middleware/notFound');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/auth', authRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
