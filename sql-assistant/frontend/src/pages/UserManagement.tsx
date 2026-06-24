import { useState, useEffect } from 'react';
import { Users, Search, UserCheck, UserX, Trash2, Ban, ShieldAlert, ArrowUpCircle, ArrowDownCircle, RefreshCw } from 'lucide-react';
import api from '../services/api';

interface User {
  id: number;
  email: string;
  role: 'USER' | 'DATABASE_MANAGER' | 'ADMIN';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'DISABLED';
  createdAt: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Search and filter parameters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, statusFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      
      const { data } = await api.get('/admin/users', {
        params: {
          search: search || undefined,
          role: roleFilter,
          status: statusFilter
        }
      });
      setUsers(data.users);
    } catch (err: any) {
      console.error('Failed to load users:', err);
      setError(err.response?.data?.error || 'Failed to retrieve users');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  const handleStatusChange = async (userId: number, newStatus: string) => {
    try {
      await api.post(`/admin/users/${userId}/status`, { status: newStatus });
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update user status');
    }
  };

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      await api.post(`/admin/users/${userId}/role`, { role: newRole });
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update user role');
    }
  };

  const handleDeleteUser = async (userId: number, email: string) => {
    const confirmed = window.confirm(`Are you absolutely sure you want to delete user account "${email}"? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      await api.delete(`/admin/users/${userId}`);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete user account');
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
      case 'APPROVED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'PENDING':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse';
      case 'DISABLED':
        return 'bg-rose-500/10 text-rose-450 border-rose-500/20';
      case 'REJECTED':
        return 'bg-slate-500/10 text-slate-400 border-slate-700/50';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            User Access Management
          </h1>
          <p className="text-slate-400 mt-1">Approve pending database managers, adjust roles, or disable access</p>
        </div>
        <button
          onClick={fetchUsers}
          className="px-4 py-2 text-xs font-semibold text-slate-350 bg-slate-900 hover:bg-slate-800 border border-slate-700/50 rounded-lg flex items-center gap-1.5 transition-all self-end sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Sync List
        </button>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Filters and Search toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-lg">
          <input
            type="text"
            placeholder="Search by email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-10 py-2 text-sm text-slate-100 placeholder-slate-505 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <button type="submit" className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300">
            <Search className="w-4 h-4" />
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Role:</label>
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg p-2 outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Roles</option>
              <option value="USER">User (Read-only)</option>
              <option value="DATABASE_MANAGER">Database Manager</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status:</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg p-2 outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active / Approved</option>
              <option value="PENDING">Pending Approval</option>
              <option value="DISABLED">Suspended</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users List Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="p-12 flex flex-col justify-center items-center text-slate-550">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm">Fetching user records...</p>
          </div>
        ) : users.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-350 border-collapse">
              <thead className="text-xs uppercase bg-slate-950/60 sticky top-0 text-slate-400 border-b border-slate-850">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">User Account</th>
                  <th className="px-6 py-3.5 font-semibold">Security Role</th>
                  <th className="px-6 py-3.5 font-semibold">System Status</th>
                  <th className="px-6 py-3.5 font-semibold">Joined Date</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Access Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-955/20 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-205">
                      {u.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                        u.role === 'ADMIN' 
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                          : u.role === 'DATABASE_MANAGER'
                          ? 'bg-primary/10 text-primary border-primary/20'
                          : 'bg-slate-500/10 text-slate-350 border-slate-700/50'
                      }`}>
                        {u.role === 'DATABASE_MANAGER' ? 'DATABASE MANAGER' : u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeColor(u.status)}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        
                        {/* Approval workflow for Pending Database Managers */}
                        {u.role === 'DATABASE_MANAGER' && u.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleStatusChange(u.id, 'APPROVED')}
                              title="Approve Database Manager"
                              className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-450 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 transition-colors"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleStatusChange(u.id, 'REJECTED')}
                              title="Reject Database Manager"
                              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-rose-500 hover:text-white border border-slate-700/50 transition-colors"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {/* Promote / Demote Controls */}
                        {u.role === 'USER' && (
                          <button
                            onClick={() => handleRoleChange(u.id, 'DATABASE_MANAGER')}
                            title="Promote to Database Manager"
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-primary/20 hover:text-primary border border-slate-700/50 transition-colors"
                          >
                            <ArrowUpCircle className="w-4 h-4" />
                          </button>
                        )}
                        {u.role === 'DATABASE_MANAGER' && u.status !== 'PENDING' && (
                          <button
                            onClick={() => {
                              handleRoleChange(u.id, 'USER');
                              handleStatusChange(u.id, 'ACTIVE');
                            }}
                            title="Demote to read-only User"
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-amber-500/20 hover:text-amber-500 border border-slate-700/50 transition-colors"
                          >
                            <ArrowDownCircle className="w-4 h-4" />
                          </button>
                        )}

                        {/* Suspension Controls */}
                        {u.role !== 'ADMIN' && (
                          u.status === 'DISABLED' ? (
                            <button
                              onClick={() => handleStatusChange(u.id, 'ACTIVE')}
                              title="Re-activate Account"
                              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-500 border border-slate-700/50 transition-colors"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStatusChange(u.id, 'DISABLED')}
                              title="Suspend Account"
                              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-rose-500/20 hover:text-rose-450 border border-slate-700/50 transition-colors"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )
                        )}

                        {/* Delete Account */}
                        {u.role !== 'ADMIN' && (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.email)}
                            title="Delete Account"
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:bg-rose-600 hover:text-white border border-slate-700/50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center">
            <ShieldAlert className="w-12 h-12 text-slate-700 mb-2" />
            <p>No user accounts matching filters found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
