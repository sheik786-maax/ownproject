const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "mysql.railway.internal",
  user: "root",
  password: "Sheik123",
  database: "billing_db",
  port: 3306,
});

db.connect((err) => {
  if (err) {
    console.log("DB connection failed:", err);
  } else {
    console.log("MySQL Connected Successfully!");
  }
});

module.exports = db;