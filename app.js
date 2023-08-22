const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const session = require("express-session");
const requireLogin = require("./authMiddleware");

dotenv.config({
  path: "./.env",
});

const app = express();

let db;

mysql
  .createConnection({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE,
  })
  .then((connection) => {
    console.log("MySQL Connected");
    db = connection;
  });

const publicDirectory = path.join(__dirname, "./public");
app.use(express.static(publicDirectory));

app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(
  session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: true,
  })
);

app.set("view engine", "ejs");

// Routes
app.get("/", requireLogin, async (req, res) => {
  try {
    const query = "SELECT username FROM users WHERE id = ?";
    const [results] = await db.query(query, [req.session.userId]);

    if (results[0] == null) return res.redirect("/login");

    const username = results[0].username;

    const allDeviceCountQuery = `SELECT COUNT(*) as count FROM devices`;
    const validDeviceCountQuery = `SELECT COUNT(*) as count FROM devices WHERE status = 1`;
    const notValidDeviceCountQuery = `SELECT COUNT(*) as count FROM devices WHERE status = 0`;

    let [allDeviceCount] = await db.query(allDeviceCountQuery);
    let [validDeviceCount] = await db.query(validDeviceCountQuery);
    let [notValidDeviceCount] = await db.query(notValidDeviceCountQuery);

    allDeviceCount = allDeviceCount[0].count;
    validDeviceCount = validDeviceCount[0].count;
    notValidDeviceCount = notValidDeviceCount[0].count;

    res.render("index.ejs", {
      username,
      allDeviceCount,
      validDeviceCount,
      notValidDeviceCount,
    });
  } catch (e) {
    console.log(e);
  }
});

app.get("/login", (req, res) => {
  if (req.session.userId) {
    res.redirect("/");
  } else {
    res.render("login.ejs");
  }
});

app.post("/login", async (req, res) => {
  console.log(req.body);
  try {
    const userEnteredPassword = req.body.password;
    const query = "SELECT password, id FROM users WHERE username = ?";
    const [results] = await db.query(query, [req.body.username]);
    if (results[0] != null) {
      const hashedPasswordFromDatabase = results[0].password;

      bcrypt.compare(
        userEnteredPassword,
        hashedPasswordFromDatabase,
        (err, result) => {
          if (err) {
            console.error("Error comparing passwords:", err);
          } else {
            if (result) {
              console.log("Password matches");
              req.session.userId = results[0].id;
              return res.redirect("/");
            } else {
              console.log("Password does not match");
              // Deny access
              return res.render("login", { alert: "Password salah" });
            }
          }
        }
      );
    } else {
      return res.render("login", { alert: "User tidak terdaftar" });
    }
  } catch (e) {
    console.log(e);
  }
  //   const userEnteredPassword = req.body.password;
  //   const query = "SELECT password, id FROM users WHERE username = ?";
  //   db.query(query, [req.body.username], (error, results) => {
  //     if (error) {
  //       console.error("Error retrieving user:", error);
  //     } else {
  //       if (results[0] != null) {
  //         const hashedPasswordFromDatabase = results[0].password;

  //         bcrypt.compare(
  //           userEnteredPassword,
  //           hashedPasswordFromDatabase,
  //           (err, result) => {
  //             if (err) {
  //               console.error("Error comparing passwords:", err);
  //             } else {
  //               if (result) {
  //                 console.log("Password matches");
  //                 req.session.userId = results[0].id;
  //                 res.redirect("/");
  //               } else {
  //                 console.log("Password does not match");
  //                 // Deny access
  //                 res.render("login", { alert: "Password salah" });
  //               }
  //             }
  //           }
  //         );
  //       } else {
  //         res.render("login", { alert: "Akun tidak terdaftar" });
  //       }
  //     }
  //   });
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
    } else {
      res.redirect("/login");
    }
  });
});

app.get("/list", requireLogin, async (req, res) => {
  try {
    const status = req.query.status || "";
    const serialNumber = req.query.sn || "";

    let query = `SELECT * FROM devices`;
    const queryParams = [];

    if (status !== "") {
      query += ` WHERE status = ?`;
      queryParams.push(status);
    }

    if (serialNumber !== "") {
      query += " WHERE sn LIKE ?";
      queryParams.push(`%${serialNumber}%`);
    }

    const [results] = await db.query(query, queryParams);

    res.render("list", { devices: results });
  } catch (e) {
    console.log(e);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/detail/:sn", requireLogin, async (req, res) => {
  const deviceSn = req.params.sn;
  try {
    const query = `SELECT * FROM devices WHERE sn = ?`;
    const [results] = await db.query(query, [deviceSn]);

    const device = results[0];
    res.render("detail.ejs", { device });
  } catch (e) {
    console.log(e);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/detail/:sn/camera", requireLogin, async (req, res) => {
  const deviceSn = req.params.sn;
  try {
    const query = `SELECT * FROM devices WHERE sn = ?`;
    const [results] = await db.query(query, [deviceSn]);

    const device = results[0];
    res.render("camera.ejs", { device });
  } catch (e) {
    console.log(e);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/detail/:sn/update", requireLogin, async (req, res) => {
  const deviceSn = req.params.sn;
  try {
    const query = `SELECT * FROM devices WHERE sn = ?`;
    const [results] = await db.query(query, [deviceSn]);

    const device = results[0];
    res.render("update.ejs", { device });
  } catch (e) {
    console.log(e);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/update-status/:sn", requireLogin, async (req, res) => {
  const deviceSn = req.params.sn;
  const newStatus = req.body.status;

  console.log(req.body);

  console.log(deviceSn);
  console.log(newStatus);

  try {
    const query = `UPDATE devices SET status = ? WHERE sn = ?`;
    await db.query(query, [newStatus, deviceSn]);

    res.status(200).send("Device status updated");
  } catch (e) {
    console.log(e);
    res.status(500).send("Internal Server Error");
  }
});

// End Routes

app.listen(5000, () => {
  console.log("Server started on Port 5000");
});
