const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const session = require("express-session");
const axios = require("axios");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
const Jimp = require("jimp");

// Middleware
const requireLogin = require("./authMiddleware");
const isAdmin = require("./adminMiddleware");

dotenv.config({
  path: "./.env",
});

(async () => {
  const app = express();

  // const db = await mysql.createConnection({
  //   host: process.env.DATABASE_HOST,
  //   user: process.env.DATABASE_USER,
  //   password: process.env.DATABASE_PASSWORD,
  //   database: process.env.DATABASE,
  // });
  const db = await mysql.createPool({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    idleTimeout: 60000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });
  console.log("MySQL Connected");

  const publicDirectory = path.join(__dirname, "./public");
  app.use(express.static(publicDirectory));

  app.use(express.urlencoded({ extended: false }));

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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

  const cekAuto = require("./cekAuto");

  cekAuto(db);

  // Routes
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

  app.use(requireLogin(db));

  app.get("/", async (req, res) => {
    try {
      if (req.user == null) return res.redirect("/login");

      const user = req.user;

      const allDeviceCountQuery =
        user.regional > 0
          ? `SELECT COUNT(*) as count FROM devices WHERE regional = ?`
          : `SELECT COUNT(*) as count FROM devices`;
      const validDeviceCountQuery =
        user.regional > 0
          ? `SELECT COUNT(*) as count FROM devices WHERE status = 1 AND regional = ?`
          : `SELECT COUNT(*) as count FROM devices WHERE status = 1`;
      const notValidDeviceCountQuery =
        user.regional > 0
          ? `SELECT COUNT(*) as count FROM devices WHERE status = 0 AND regional = ?`
          : `SELECT COUNT(*) as count FROM devices WHERE status = 0`;

      let [allDeviceCount] = await db.query(allDeviceCountQuery, [
        user.regional,
      ]);
      let [validDeviceCount] = await db.query(validDeviceCountQuery, [
        user.regional,
      ]);
      let [notValidDeviceCount] = await db.query(notValidDeviceCountQuery, [
        user.regional,
      ]);

      allDeviceCount = allDeviceCount[0].count;
      validDeviceCount = validDeviceCount[0].count;
      notValidDeviceCount = notValidDeviceCount[0].count;

      res.render("index.ejs", {
        user,
        allDeviceCount,
        validDeviceCount,
        notValidDeviceCount,
      });
    } catch (e) {
      console.log(e);
    }
  });

  app.get("/list", async (req, res) => {
    try {
      const status = req.query.status || "";
      const serialNumber = req.query.sn || "";

      const user = req.user;

      let query = `SELECT * FROM devices WHERE`;
      const queryParams = [];

      if (status !== "") {
        query += ` status = ? AND`;
        queryParams.push(status);
      }

      if (serialNumber !== "") {
        query += " sn LIKE ? AND";
        queryParams.push(`%${serialNumber}%`);
      }

      if (user.regional === 0) {
        query = query.replace("WHERE", "");
      }
      if (user.regional > 0) {
        query += " regional = ?";
        queryParams.push(user.regional);
      }

      console.log(query);

      const [results] = await db.query(query, queryParams);

      res.render("list", { devices: results });
    } catch (e) {
      console.log(e);
      res.status(500).send("Internal Server Error");
    }
  });

  app.get("/detail/:sn", async (req, res) => {
    const deviceSn = req.params.sn;
    try {
      const query = `SELECT * FROM devices WHERE sn = ?`;
      const [results] = await db.query(query, [deviceSn]);

      const historyQuery = "SELECT * FROM history WHERE device_sn = ?";
      const [histories] = await db.query(historyQuery, [deviceSn]);

      const device = results[0];

      device.image =
        device.image != "" ? device.image : "/img/img_perangkat_aktif.svg";
      res.render("detail.ejs", { device, histories });
    } catch (e) {
      console.log(e);
      res.status(500).send("Internal Server Error");
    }
  });

  app.get("/detail/:sn/camera", async (req, res) => {
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

  app.get("/detail/:sn/update", async (req, res) => {
    const deviceSn = req.params.sn;
    try {
      const query = `SELECT * FROM devices WHERE sn = ?`;
      const [results] = await db.query(query, [deviceSn]);

      const device = results[0];
      device.image =
        device.image != "" ? device.image : "/img/img_perangkat_aktif.svg";
      res.render("update.ejs", { device });
    } catch (e) {
      console.log(e);
      res.status(500).send("Internal Server Error");
    }
  });

  app.post("/update-status/:sn", async (req, res) => {
    const sn = req.params.sn;
    const notes = req.body.notes;

    try {
      const query = `UPDATE devices SET status = 0, notes = ? WHERE sn = ?`;
      await db.query(query, [notes, sn]);

      res.status(200).redirect("/detail/" + sn);
    } catch (e) {
      console.log(e);
      res.status(500).send("Internal Server Error");
    }
  });

  app.get("/location", async (req, res) => {
    const location_api_key = process.env.location_api_key;
    try {
      const response = await axios.get(
        `https://us1.locationiq.com/v1/reverse?key=${location_api_key}&lat=${req.query.lat}&lon=${req.query.lon}&format=json`
      );

      const locationData = response.data;
      res.json(locationData);
    } catch (error) {
      console.error("Error fetching location:", error);
      res.status(500).json({ error: "Error fetching location" });
    }
  });

  app.post("/upload/:sn", upload.single("deviceImage"), async (req, res) => {
    const image = req.file;
    const sn = req.params.sn;
    const notes = req.body.notes;
    const deviceLocation = req.body.location;

    var currentDateTime = new Date();

    const monthNames = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];

    var day = currentDateTime.getDate();
    var month = currentDateTime.getMonth() + 1;
    var monthIndex = currentDateTime.getMonth();
    var year = currentDateTime.getFullYear();
    var currentTime = currentDateTime.toLocaleTimeString();

    var formattedDatetime =
      day + " " + monthNames[monthIndex] + " " + year + ", " + currentTime;

    console.log(formattedDatetime);
    console.log(deviceLocation);

    if (image.mimetype != "image/jpeg" && image.mimetype != "image/png")
      return res.status(400).json({ error: "File harus jpeg/png" });

    console.log(image.buffer.toJSON());
    console.log(sn);

    // Buat gambar latar belakang untuk teks watermark
    const imageBefore = await Jimp.read(image.buffer);
    const imageResized = imageBefore.cover(500, 500);

    const imageWidth = imageResized.getWidth();
    const imageHeight = imageResized.getHeight();

    console.log(imageWidth);
    console.log(imageHeight);

    const textWidth = 500; // Lebar latar belakang teks
    const textHeight = 500; // Tinggi latar belakang teks
    const backgroundColor = 0x000000ff; // Warna latar belakang (hitam)

    const backgroundWatermark = new Jimp(
      textWidth,
      textHeight,
      backgroundColor
    );

    // Tambahkan teks pada latar belakang
    const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
    backgroundWatermark.print(
      font,
      10,
      100,
      {
        text:
          "Serial Number : " +
          sn +
          ", Tanggal : " +
          formattedDatetime +
          ", Lokasi : " +
          deviceLocation,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_BOTTOM,
      },
      450,
      200
    );

    // Gabungkan latar belakang teks dengan gambar asli
    const x = 0; // Posisi x untuk teks pada gambar asli
    const y = 0; // Posisi y untuk teks pada gambar asli

    imageResized.composite(backgroundWatermark, x, y, {
      mode: Jimp.BLEND_SOURCE_OVER, // Atur mode blending untuk transparansi
      opacitySource: 0.2, // Ubah kecerahan teks agar tidak terlalu terang
    });

    const base64Image = await imageResized.getBase64Async(Jimp.MIME_JPEG);

    try {
      const query =
        "UPDATE devices SET image = ?, time = NOW(), location = ?, status = 1, notes = ? WHERE sn = ?";
      await db.query(query, [base64Image, deviceLocation, notes, sn]);

      const historyQuery =
        "INSERT INTO history (device_sn, time, location) VALUES (?, NOW(), ?)";
      await db.query(historyQuery, [sn, deviceLocation]);

      // Ambil pengaturan admin untuk tanggal kadaluwarsa perangkat
      const adminSettingsQuery =
        "SELECT device_expiration_days FROM admin_settings";
      const [adminSettingsResult] = await db.query(adminSettingsQuery);
      const deviceExpirationDays =
        adminSettingsResult[0].device_expiration_days;

      // Ambil tanggal validasi terakhir perangkat
      const getLastValidationQuery = "SELECT time FROM devices WHERE sn = ?";
      const [lastValidationResult] = await db.query(getLastValidationQuery, [
        sn,
      ]);
      const lastValidationDate = lastValidationResult[0].validation_date;

      // Hitung tanggal kadaluwarsa berdasarkan pengaturan admin dan tanggal validasi terakhir
      const currentDate = new Date();
      const validationDate = new Date(currentDate);
      validationDate.setDate(validationDate.getDate() + deviceExpirationDays);

      // Perbarui tanggal kadaluwarsa dan status perangkat di database
      const updateQuery =
        "UPDATE devices SET time = ?, expiration_date = ?, status = ? WHERE sn = ?";
      await db.query(updateQuery, [currentDate, validationDate, 1, sn]);

      res.status(200).redirect("/detail/" + sn);
    } catch (e) {
      console.error("Error uploading image:", e);
      res.status(500).json({ error: "Error uploading image" });
    }
  });

  app.get("/dashboard", isAdmin, async (req, res) => {
    try {
      const query = `SELECT * FROM devices`;

      const [results] = await db.query(query);
      res.render("dashboard", { devices: results });
    } catch (e) {
      res.status(500).send("Internal Server Error");
    }
  });

  app.get("/dashboard/add", isAdmin, async (req, res) => {
    const successMessage = req.query.success;
    res.render("add", { successMessage });
  });

  app.post("/add-device", isAdmin, async (req, res) => {
    const sn = req.body.serialNumber;
    const csm = req.body.csm;
    const perangkat = req.body.perangkat;
    const jenis = req.body.jenis;
    const nama = req.body.nama;
    const regional = req.body.regional;
    const deviceUse = req.body.deviceUse;
    const nik = req.body.nik;
    const telp = "62" + req.body.telepon;

    try {
      const query = `INSERT INTO devices (sn, csm, perangkat, jenis, nama, regional, device_use, nik, telp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      await db.query(query, [
        sn,
        csm,
        perangkat,
        jenis,
        nama,
        regional,
        deviceUse,
        nik,
        telp,
      ]);

      res.status(200).redirect("/dashboard/add?success=1");
    } catch (e) {
      res.status(500).send("Internal Server Error");
    }
  });

  app.get("/dashboard/settings", isAdmin, async (req, res) => {
    const successMessage = req.query.success;
    try {
      const query = `SELECT * FROM admin_settings`;

      const [results] = await db.query(query);

      res.render("settings", {
        successMessage: successMessage,
        settings: results,
      });
    } catch (e) {
      res.status(500).send("Internal Server Error");
    }
  });

  app.post("/update-admin-settings", isAdmin, async (req, res) => {
    const deviceExpirationDays = req.body.deviceExpirationDays;

    try {
      const query = `UPDATE admin_settings SET device_expiration_days = ? WHERE id = 1`;

      await db.query(query, [deviceExpirationDays]);

      const updateExpirationDayQuery = `UPDATE devices SET expiration_date = DATE_ADD(time, INTERVAL ? DAY) WHERE status = 1`;

      await db.query(updateExpirationDayQuery, [deviceExpirationDays]);

      res.status(200).redirect("/dashboard/settings?success=1");
    } catch (e) {
      console.log(e);
      res.status(500).send("Internal Server Error");
    }
  });

  app.get("/register", isAdmin, async (req, res) => {
    const successMessage = req.query.success;

    res.render("register", { successMessage });
  });

  app.post("/add-user", isAdmin, async (req, res) => {
    try {
      const { username, password, regional, admin = 0 } = req.body;

      const hashedPassword = await bcrypt.hash(password, 10);

      const insertQuery = `INSERT INTO users (username, password, regional, admin) VALUES (?, ?, ?, ?)`;
      await db.query(insertQuery, [username, hashedPassword, regional, admin]);

      console.log("User registered successfully");
      res.redirect("/register?success=1");
    } catch (e) {
      console.error(e);
      res.status(500).send("Error adding user");
    }
  });

  // End Routes

  app.listen(5000, () => {
    console.log("Server started on Port 5000");
  });
})();
