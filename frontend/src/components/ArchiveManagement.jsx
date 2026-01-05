import React, { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Download, Trash2, Upload, RefreshCw } from 'lucide-react';

function ArchiveManagement() {
  const [archives, setArchives] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [importArchive, setImportArchive] = useState(null);
  const [importUserId, setImportUserId] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [importing, setImporting] = useState(false);
  const [deleteArchive, setDeleteArchive] = useState(null);
  const [uploadImportOpen, setUploadImportOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadImportUserId, setUploadImportUserId] = useState('');
  const [uploadImportPassword, setUploadImportPassword] = useState('');
  const [uploadImporting, setUploadImporting] = useState(false);

  useEffect(() => {
    loadArchives();
    loadUsers();
  }, []);

  const loadArchives = async () => {
    try {
      setLoading(true);
      const data = await adminAPI.getArchives();
      setArchives(data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load archives');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await adminAPI.getUsers();
      setUsers(data);
    } catch (err) {
      // Ignore errors loading users for import
    }
  };

  const handleDownload = async (archiveId) => {
    try {
      const response = await adminAPI.downloadArchive(archiveId);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Get filename from response headers or use default
      const archive = archives.find(a => a.id === archiveId);
      a.download = archive?.archive_filename || 'archive.zip';
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err.message || 'Failed to download archive');
    }
  };

  const handleDelete = async () => {
    if (!deleteArchive) return;
    
    try {
      await adminAPI.deleteArchive(deleteArchive.id);
      setDeleteArchive(null);
      await loadArchives();
    } catch (err) {
      setError(err.message || 'Failed to delete archive');
    }
  };

  const handleImport = async () => {
    if (!importArchive || !importUserId) return;
    
    try {
      setImporting(true);
      await adminAPI.importArchive(importArchive.id, parseInt(importUserId), importPassword || undefined);
      setImportArchive(null);
      setImportUserId('');
      setImportPassword('');
      await loadArchives();
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to import archive');
    } finally {
      setImporting(false);
    }
  };

  const handleUploadImport = async () => {
    if (!uploadFile || !uploadImportUserId) return;
    
    try {
      setUploadImporting(true);
      setError(null);
      await adminAPI.importArchiveUpload(uploadFile, parseInt(uploadImportUserId), uploadImportPassword || undefined);
      setUploadImportOpen(false);
      setUploadFile(null);
      setUploadImportUserId('');
      setUploadImportPassword('');
      await loadArchives();
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to import archive');
    } finally {
      setUploadImporting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return 'Unknown';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
    return `${mb.toFixed(2)} MB`;
  };

  if (loading) {
    return <div className="text-center py-8">Loading archives...</div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <Button onClick={() => setUploadImportOpen(true)} variant="default">
          <Upload className="mr-2 h-4 w-4" />
          Upload & Import Archive
        </Button>
        <Button onClick={loadArchives} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Archives ({archives.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left p-2">Username</th>
                  <th className="text-left p-2">Encrypted</th>
                  <th className="text-left p-2">Size</th>
                  <th className="text-left p-2">Created</th>
                  <th className="text-right p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {archives.map((archive) => (
                  <tr key={archive.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]">
                    <td className="p-2 font-medium">{archive.username}</td>
                    <td className="p-2">
                      {archive.is_encrypted === 1 ? (
                        <span className="text-green-600 dark:text-green-400">Yes</span>
                      ) : (
                        <span className="text-[var(--color-text-secondary)]">No</span>
                      )}
                    </td>
                    <td className="p-2 text-sm">{formatSize(archive.file_size)}</td>
                    <td className="p-2 text-sm text-[var(--color-text-secondary)]">{formatDate(archive.created_at)}</td>
                    <td className="p-2">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(archive.id)}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setImportArchive(archive)}
                          title="Import"
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleteArchive(archive)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {archives.length === 0 && (
              <div className="text-center py-8 text-[var(--color-text-secondary)]">
                No archives
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <Dialog open={!!importArchive} onOpenChange={(open) => !open && setImportArchive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Archive</DialogTitle>
            <DialogDescription>
              Import archive for {importArchive?.username} to a user account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="import-user">Target User</Label>
              <Select value={importUserId} onValueChange={setImportUserId}>
                <SelectTrigger id="import-user">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {importArchive?.is_encrypted === 1 && (
              <div className="space-y-2">
                <Label htmlFor="import-password">Archive Password</Label>
                <Input
                  id="import-password"
                  type="password"
                  value={importPassword}
                  onChange={(e) => setImportPassword(e.target.value)}
                  placeholder="Enter password to decrypt archive"
                  required
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportArchive(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!importUserId || (importArchive?.is_encrypted === 1 && !importPassword) || importing}
            >
              {importing ? 'Importing...' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Import Dialog */}
      <Dialog open={uploadImportOpen} onOpenChange={setUploadImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload and Import Archive</DialogTitle>
            <DialogDescription>
              Upload an archive file and import it to a user account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="upload-file">Archive File (.zip or .encrypted.zip)</Label>
              <Input
                id="upload-file"
                type="file"
                accept=".zip,.encrypted.zip"
                onChange={(e) => setUploadFile(e.target.files[0] || null)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="upload-import-user">Target User</Label>
              <Select value={uploadImportUserId} onValueChange={setUploadImportUserId}>
                <SelectTrigger id="upload-import-user">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {uploadFile && uploadFile.name.endsWith('.encrypted.zip') && (
              <div className="space-y-2">
                <Label htmlFor="upload-import-password">Archive Password</Label>
                <Input
                  id="upload-import-password"
                  type="password"
                  value={uploadImportPassword}
                  onChange={(e) => setUploadImportPassword(e.target.value)}
                  placeholder="Enter password to decrypt archive"
                  required
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadImportOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUploadImport}
              disabled={!uploadFile || !uploadImportUserId || (uploadFile?.name.endsWith('.encrypted.zip') && !uploadImportPassword) || uploadImporting}
            >
              {uploadImporting ? 'Importing...' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteArchive} onOpenChange={(open) => !open && setDeleteArchive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Archive</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the archive for {deleteArchive?.username}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteArchive(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ArchiveManagement;

