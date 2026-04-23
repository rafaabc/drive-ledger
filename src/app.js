const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../resources/swagger.json');

const authRoutes = require('./routes/auth.routes');
const expensesRoutes = require('./routes/expenses.routes');

const app = express();
app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use('/api/auth', authRoutes);
app.use('/api/expenses', expensesRoutes);

module.exports = app;
