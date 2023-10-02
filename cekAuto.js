const cron = require("node-cron");

function cekAuto(db) {
  // Jadwal pengecekan, misalnya setiap hari pukul 00:00
  const task = cron.schedule("0 0 * * *", async () => {
    try {
      // Ambil pengaturan admin untuk tanggal kadaluwarsa perangkat
      const adminSettingsQuery =
        "SELECT device_expiration_days FROM admin_settings";
      const [adminSettingsResult] = await db.query(adminSettingsQuery);
      const deviceExpirationDays =
        adminSettingsResult[0].device_expiration_days;

      // Ambil semua perangkat yang perlu diperbarui tanggal kadaluwarsanya
      const devicesQuery =
        "SELECT id, validation_date FROM devices WHERE status = 1";
      const [devicesResult] = await db.query(devicesQuery);

      // Perbarui tanggal kadaluwarsa untuk setiap perangkat
      for (const device of devicesResult) {
        const validationDate = new Date(device.validation_date);
        validationDate.setDate(validationDate.getDate() + deviceExpirationDays);

        const currentDate = new Date();

        // Jika tanggal kadaluwarsa lebih kecil dari atau sama dengan tanggal saat ini
        if (validationDate <= currentDate) {
          // Update status perangkat menjadi tidak valid
          const updateQuery =
            "UPDATE devices SET expiration_date = ?, status = 0 WHERE id = ?";
          await db.query(updateQuery, [validationDate, device.id]);
        }
      }

      console.log("Tanggal kadaluwarsa perangkat diperbarui.");
    } catch (error) {
      console.error("Terjadi kesalahan:", error);
    }
  });

  // Memulai penjadwalan tugas
  task.start();
}

module.exports = cekAuto;
