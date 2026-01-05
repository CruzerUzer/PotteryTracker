import React, { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/card';
import { Button } from './ui/button';
import UserManagement from './UserManagement';
import ArchiveManagement from './ArchiveManagement';
import RegistrationControl from './RegistrationControl';
import { Users, Archive, Settings as SettingsIcon } from 'lucide-react';

function AdminPanel() {
  const [activeTab, setActiveTab] = useState('users');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Admin Panel</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--color-border)]">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'users'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          <Users className="inline-block mr-2 h-4 w-4" />
          Users
        </button>
        <button
          onClick={() => setActiveTab('archives')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'archives'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          <Archive className="inline-block mr-2 h-4 w-4" />
          Archives
        </button>
        <button
          onClick={() => setActiveTab('registration')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'registration'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          <SettingsIcon className="inline-block mr-2 h-4 w-4" />
          Registration
        </button>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'archives' && <ArchiveManagement />}
        {activeTab === 'registration' && <RegistrationControl />}
      </div>
    </div>
  );
}

export default AdminPanel;

