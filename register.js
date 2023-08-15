const mysql = require("mysql")
const bcrypt = require("bcrypt")
const dotenv = require("dotenv")

dotenv.config({
    path: './.env'
})

const db = mysql.createConnection({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE
})

const saltRounds = 10

const username = 'admin2'
const plainPassword = 'admin123'

bcrypt.hash(plainPassword, saltRounds, (error, hash) => {
    if (error) {
      console.error('Error hashing password:', error);
    } else {
      // Store 'hash' in your database's user table
      // You should store 'hash' in the 'password' column for that user
      const query = `INSERT INTO users (username, password) VALUES (?, ?)`;
        db.query(query, [username, hash], (error, results) => {
            if (error) {
                console.error('Error inserting user:', error);
            } else {
                console.log('User registered successfully');
            }
        });
    }
  });