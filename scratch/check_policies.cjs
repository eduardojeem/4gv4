require('dotenv').config({path: '.env.local'});
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => {
  return client.query("SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'products'");
}).then(res => {
  console.log(JSON.stringify(res.rows, null, 2));
  client.end();
}).catch(console.error);
