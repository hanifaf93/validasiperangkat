function isAdmin(req, res, next) {
  if (req.user.admin === 1) {
    next();
  } else {
    res.redirect("/");
  }
}

module.exports = isAdmin;
