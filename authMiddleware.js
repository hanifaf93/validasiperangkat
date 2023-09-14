function requireLogin(db) {
  return async (req, res, next) => {
    if (req.session.userId) {
      const query = "SELECT * FROM users WHERE id = ?";
      const [user] = await db.query(query, [req.session.userId]);
      req.user = user[0];
      next(); // User is logged in, proceed to the next middleware
    } else {
      res.redirect("/login"); // User is not logged in, redirect to login page
    }
  };
}

module.exports = requireLogin;
