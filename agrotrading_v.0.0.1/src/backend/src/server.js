const { createDb } = require('./db');
const { createApp } = require('./app');

const PORT = process.env.PORT || 3001;
createApp(createDb()).listen(PORT, () => console.log(`AgroTrading API em http://localhost:${PORT}`));
