function requireLogin(req, res, next) {
  if (req.session.userId) {
    next(); // User is logged in, proceed to the next middleware
  } else {
    res.redirect("/login"); // User is not logged in, redirect to login page
  }
}

module.exports = requireLogin;
