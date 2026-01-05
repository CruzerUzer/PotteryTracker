import React, { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import PasswordResetDialog from './PasswordResetDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Label } from './ui/label';
import { RefreshCw, Key, Trash2, Shield, ShieldOff, Search } from 'lucide-react';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [deleteAction, setDeleteAction] = useState('delete'); // 'delete' or 'archive'
  const [archivePassword, setArchivePassword] = useState('');
  const [encryptArchive, setEncryptArchive] = useState(false);
  const [deleteServerCopy, setDeleteServerCopy] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await adminAPI.getUsers();
      setUsers(data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAdmin = async (userId) => {
    try {
      await adminAPI.toggleAdmin(userId);
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to toggle admin status');
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    
    try {
      if (deleteAction === 'archive') {
        await adminAPI.deleteUser(deleteUser.id, 'archive', encryptArchive ? archivePassword : undefined, deleteServerCopy);
      } else {
        await adminAPI.deleteUser(deleteUser.id, 'delete');
      }
      setDeleteUser(null);
      setArchivePassword('');
      setEncryptArchive(false);
      setDeleteServerCopy(false);
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to delete/archive user');
    }
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading users...</div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[var(--color-text-secondary)]" />
          <Input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={loadUsers} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left p-2">Username</th>
                  <th className="text-left p-2">Admin</th>
                  <th className="text-left p-2">Last Login</th>
                  <th className="text-left p-2">Pieces</th>
                  <th className="text-left p-2">Materials</th>
                  <th className="text-left p-2">Created</th>
                  <th className="text-right p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]">
                    <td className="p-2 font-medium">{user.username}</td>
                    <td className="p-2">
                      {user.is_admin === 1 ? (
                        <span className="text-green-600 dark:text-green-400">Yes</span>
                      ) : (
                        <span className="text-[var(--color-text-secondary)]">No</span>
                      )}
                    </td>
                    <td className="p-2 text-sm text-[var(--color-text-secondary)]">{formatDate(user.last_login)}</td>
                    <td className="p-2">{user.pieces_count || 0}</td>
                    <td className="p-2">{user.materials_count || 0}</td>
                    <td className="p-2 text-sm text-[var(--color-text-secondary)]">{formatDate(user.created_at)}</td>
                    <td className="p-2">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setResetPasswordUser(user)}
                          title="Reset Password"
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleAdmin(user.id)}
                          title={user.is_admin === 1 ? 'Remove Admin' : 'Make Admin'}
                        >
                          {user.is_admin === 1 ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setDeleteUser(user);
                            setDeleteAction('delete');
                          }}
                          title="Delete User"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredUsers.length === 0 && (
              <div className="text-center py-8 text-[var(--color-text-secondary)]">
                {searchTerm ? 'No users found' : 'No users'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reset Password Dialog */}
      {resetPasswordUser && (
        <PasswordResetDialog
          user={resetPasswordUser}
          onClose={() => setResetPasswordUser(null)}
        />
      )}

      {/* Delete/Archive Dialog */}
      <Dialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleteAction === 'archive' ? 'Archive User' : 'Delete User'}
            </DialogTitle>
            <DialogDescription>
              {deleteAction === 'archive'
                ? `Archive data for ${deleteUser?.username}? The data will be saved and can be restored later.`
                : `Are you sure you want to delete ${deleteUser?.username}? This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          {deleteAction === 'archive' && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={encryptArchive}
                    onChange={(e) => setEncryptArchive(e.target.checked)}
                  />
                  <span>Encrypt archive with password</span>
                </label>
              </div>
              {encryptArchive && (
                <div className="space-y-2">
                  <Label htmlFor="archive-password">Archive Password</Label>
                  <Input
                    id="archive-password"
                    type="password"
                    value={archivePassword}
                    onChange={(e) => setArchivePassword(e.target.value)}
                    placeholder="Enter password for encryption"
                  />
                </div>
              )}
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={deleteServerCopy}
                    onChange={(e) => setDeleteServerCopy(e.target.checked)}
                  />
                  <span>Delete user account after archiving</span>
                </label>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteAction('delete')}
                >
                  Switch to Delete
                </Button>
              </div>
            </div>
          )}
          {deleteAction === 'delete' && (
            <div className="py-4">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteAction('archive')}
                >
                  Switch to Archive
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              {deleteAction === 'archive' ? 'Archive' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default UserManagement;

