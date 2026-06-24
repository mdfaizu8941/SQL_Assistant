import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

/**
 * Middleware to restrict route access to specific roles.
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;

    if (!userRole) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({
        error: `Forbidden: Access restricted. Requires one of the following roles: ${allowedRoles.join(
          ', '
        )}`,
      });
      return;
    }

    next();
  };
};
