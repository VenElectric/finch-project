require("dotenv").config();

module.exports = {
  client_id: process.env.CLIENT_ID,
  client_secret: process.env.CLIENT_SECRET,
  redirect: process.env.REDIRECT,
  db_path: process.env.DB_PATH,
  customer_id: process.env.CUSTOMER_ID,
  customer_name: process.env.CUSTOMER_NAME,
  crypt_secret: process.env.CRYPT_SECRET
};
