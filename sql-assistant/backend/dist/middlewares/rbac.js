"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = void 0;
/**
 * Middleware to restrict route access to specific roles.
 */
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        const userRole = req.user?.role;
        if (!userRole) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        if (!allowedRoles.includes(userRole)) {
            res.status(403).json({
                error: `Forbidden: Access restricted. Requires one of the following roles: ${allowedRoles.join(', ')}`,
            });
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
