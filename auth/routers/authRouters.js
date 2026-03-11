// Dependencies
const login = require("../login");
const signup = require("../signup");
const refreshToken = require("../refreshToken");
const { authenticateToken, authorizeRoles, authenticateRender, authorizeAdminRender } = require("../middleware/authMiddleware");

module.exports = {
    login,
    signup,
    refreshToken,
    authenticateToken,
    authorizeRoles,
    authenticateRender,
    authorizeAdminRender
}
