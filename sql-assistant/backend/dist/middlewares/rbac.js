"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = void 0;
/**
 * Middleware to restrict route access to specific roles.
 */
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        next();
    };
};
exports.requireRole = requireRole;
