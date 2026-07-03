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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { RefreshCw, Key, Trash2, Shield, ShieldOff, Search, Download } from 'lucide-react';

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
  const [archiveUser, setArchiveUser] = useState(null);
  const [archiveStorageOption, setArchiveStorageOption] = useState('server'); // 'server', 'download', or 'both'
  const [archivePasswordExport, setArchivePasswordExport] = useState('');
  const [encryptArchiveExport, setEncryptArchiveExport] = useState(false);
  const [creatingArchive, setCreatingArchive] = useState(false);

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
      setError(err.message || 'Kunde inte hämta användarna');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAdmin = async (userId) => {
    try {
      await adminAPI.toggleAdmin(userId);
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Kunde inte ändra adminstatus');
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
      setError(err.message || 'Kunde inte ta bort eller arkivera användaren');
    }
  };

  const handleCreateArchive = async () => {
    if (!archiveUser) return;
    
    try {
      setCreatingArchive(true);
      setError(null);
      await adminAPI.createUserArchive(
        archiveUser.id,
        encryptArchiveExport ? archivePasswordExport : undefined,
        archiveStorageOption
      );
      setArchiveUser(null);
      setArchivePasswordExport('');
      setEncryptArchiveExport(false);
      setArchiveStorageOption('server');
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Kunde inte skapa arkivet');
    } finally {
      setCreatingArchive(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString) => {
    if (!dateString) return 'Aldrig';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return <div className="text-center py-8">Hämtar användare…</div>;
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
            placeholder="Sök användare…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={loadUsers} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Uppdatera
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Användare ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left p-2">Användarnamn</th>
                  <th className="text-left p-2">Admin</th>
                  <th className="text-left p-2">Senast inloggad</th>
                  <th className="text-left p-2">Pjäser</th>
                  <th className="text-left p-2">Material</th>
                  <th className="text-left p-2">Skapad</th>
                  <th className="text-right p-2">Åtgärder</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]">
                    <td className="p-2 font-medium">{user.username}</td>
                    <td className="p-2">
                      {user.is_admin === 1 ? (
                        <span className="text-green-600 dark:text-green-400">Ja</span>
                      ) : (
                        <span className="text-[var(--color-text-secondary)]">Nej</span>
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
                          title="Återställ lösenord"
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleAdmin(user.id)}
                          title={user.is_admin === 1 ? 'Ta bort adminbehörighet' : 'Gör till admin'}
                        >
                          {user.is_admin === 1 ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setArchiveUser(user)}
                          title="Exportera arkiv"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setDeleteUser(user);
                            setDeleteAction('delete');
                          }}
                          title="Ta bort användare"
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
                {searchTerm ? 'Inga användare matchade sökningen' : 'Inga användare'}
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

      {/* Archive Export Dialog */}
      <Dialog open={!!archiveUser} onOpenChange={(open) => !open && setArchiveUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exportera arkiv för {archiveUser?.username}</DialogTitle>
            <DialogDescription>
              Skapa ett arkiv med all data för {archiveUser?.username}. Det kan sparas på servern, laddas ner, eller både och.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="storage-option">Lagring</Label>
              <Select value={archiveStorageOption} onValueChange={setArchiveStorageOption}>
                <SelectTrigger id="storage-option">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="server">Spara på servern</SelectItem>
                  <SelectItem value="download">Endast nedladdning</SelectItem>
                  <SelectItem value="both">Spara och ladda ner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={encryptArchiveExport}
                  onChange={(e) => setEncryptArchiveExport(e.target.checked)}
                />
                <span>Kryptera arkivet med lösenord</span>
              </label>
            </div>
            {encryptArchiveExport && (
              <div className="space-y-2">
                <Label htmlFor="archive-password-export">Lösenord för arkivet</Label>
                <Input
                  id="archive-password-export"
                  type="password"
                  value={archivePasswordExport}
                  onChange={(e) => setArchivePasswordExport(e.target.value)}
                  placeholder="Välj ett lösenord"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveUser(null)}>
              Avbryt
            </Button>
            <Button onClick={handleCreateArchive} disabled={creatingArchive}>
              {creatingArchive ? 'Skapar…' : 'Skapa arkiv'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete/Archive Dialog */}
      <Dialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleteAction === 'archive' ? 'Arkivera användare' : 'Ta bort användare'}
            </DialogTitle>
            <DialogDescription>
              {deleteAction === 'archive'
                ? `Arkivera all data för ${deleteUser?.username}? Datan sparas och kan återställas senare.`
                : `Vill du ta bort ${deleteUser?.username}? Det här går inte att ångra.`}
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
                  <span>Kryptera arkivet med lösenord</span>
                </label>
              </div>
              {encryptArchive && (
                <div className="space-y-2">
                  <Label htmlFor="archive-password">Lösenord för arkivet</Label>
                  <Input
                    id="archive-password"
                    type="password"
                    value={archivePassword}
                    onChange={(e) => setArchivePassword(e.target.value)}
                    placeholder="Välj ett lösenord"
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
                  <span>Ta bort kontot efter arkivering</span>
                </label>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteAction('delete')}
                >
                  Byt till borttagning
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
                  Byt till arkivering
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)}>
              Avbryt
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              {deleteAction === 'archive' ? 'Arkivera' : 'Ta bort'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default UserManagement;

