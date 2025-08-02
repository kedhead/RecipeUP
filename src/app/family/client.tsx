'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/layouts/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

interface FamilyGroup {
  id: string;
  name: string;
  description?: string;
  inviteCode: string;
  role: string;
  memberCount: number;
  createdBy: string;
  isOwner: boolean;
  createdAt: string;
}

interface FamilyMember {
  id: string;
  userId: string;
  role: string;
  nickname?: string;
  joinedAt: string;
  user: {
    username: string;
    firstName?: string;
    lastName?: string;
  };
}

export function FamilyClient({ user }: { user: any }) {
  const [familyGroups, setFamilyGroups] = useState<FamilyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    description: '',
  });
  const [joinFormData, setJoinFormData] = useState({
    inviteCode: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadFamilyGroups();
  }, []);

  const loadFamilyGroups = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/family-groups', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setFamilyGroups(data.familyGroups);
      }
    } catch (error) {
      console.error('Failed to load family groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFormData.name.trim()) return;

    try {
      setSubmitting(true);
      const response = await fetch('/api/family-groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: createFormData.name.trim(),
          description: createFormData.description.trim() || undefined,
        }),
      });

      if (response.ok) {
        await loadFamilyGroups();
        setShowCreateForm(false);
        setCreateFormData({ name: '', description: '' });
      } else {
        const error = await response.json();
        alert(`Failed to create family group: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to create family group:', error);
      alert('Failed to create family group. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinFormData.inviteCode.trim()) return;

    try {
      setSubmitting(true);
      const response = await fetch('/api/family-groups/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          inviteCode: joinFormData.inviteCode.trim().toUpperCase(),
        }),
      });

      if (response.ok) {
        await loadFamilyGroups();
        setShowJoinForm(false);
        setJoinFormData({ inviteCode: '' });
      } else {
        const error = await response.json();
        alert(`Failed to join family group: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to join family group:', error);
      alert('Failed to join family group. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyInviteCode = (inviteCode: string) => {
    navigator.clipboard.writeText(inviteCode);
    alert('Invite code copied to clipboard!');
  };

  if (loading) {
    return (
      <DashboardLayout user={user}>
        <div className="text-center py-12">
          <div className="text-gray-600">Loading family groups...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Family Groups</h1>
            <p className="text-gray-600 mt-2">Manage your family groups and share recipes</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowJoinForm(true)}>
              🔗 Join Group
            </Button>
            <Button onClick={() => setShowCreateForm(true)}>
              ➕ Create Group
            </Button>
          </div>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <Card className="border-brand-200">
            <CardHeader>
              <CardTitle>➕ Create Family Group</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateGroup} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Group Name *
                  </label>
                  <input
                    type="text"
                    value={createFormData.name}
                    onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    placeholder="e.g., The Smith Family"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    value={createFormData.description}
                    onChange={(e) => setCreateFormData({ ...createFormData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    placeholder="A brief description of your family group..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={submitting}>
                    Create Group
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowCreateForm(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Join Form */}
        {showJoinForm && (
          <Card className="border-brand-200">
            <CardHeader>
              <CardTitle>🔗 Join Family Group</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleJoinGroup} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Invite Code *
                  </label>
                  <input
                    type="text"
                    value={joinFormData.inviteCode}
                    onChange={(e) => setJoinFormData({ ...joinFormData, inviteCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono"
                    placeholder="Enter 8-character invite code"
                    maxLength={8}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={submitting}>
                    Join Group
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowJoinForm(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Family Groups List */}
        {familyGroups.length > 0 ? (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Your Family Groups</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {familyGroups.map((group) => (
                <Card key={group.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>👨‍👩‍👧‍👦 {group.name}</span>
                      {group.isOwner && (
                        <span className="text-xs bg-brand-100 text-brand-800 px-2 py-1 rounded-full">
                          Admin
                        </span>
                      )}
                    </CardTitle>
                    {group.description && (
                      <CardDescription>{group.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Members:</span>
                      <span className="font-medium">{group.memberCount}</span>
                    </div>
                    
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Invite Code:</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyInviteCode(group.inviteCode)}
                        >
                          📋 Copy
                        </Button>
                      </div>
                      <div className="bg-gray-50 rounded p-2 font-mono text-center text-lg font-bold tracking-wider">
                        {group.inviteCode}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        👥 View Members
                      </Button>
                      {group.isOwner && (
                        <Button variant="outline" size="sm" className="flex-1">
                          ⚙️ Settings
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>👨‍👩‍👧‍👦 No Family Groups Yet</CardTitle>
              <CardDescription>
                Create or join a family group to start sharing recipes and meal plans.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <div className="text-gray-600 mb-4">
                  Family groups let you share recipes, plan meals together, and collaborate on grocery lists.
                </div>
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => setShowCreateForm(true)}>
                    ➕ Create Your First Group
                  </Button>
                  <Button variant="outline" onClick={() => setShowJoinForm(true)}>
                    🔗 Join Existing Group
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Features Info */}
        <div className="bg-brand-50 border border-brand-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-brand-900 mb-2">
            🔗 Family Features
          </h3>
          <div className="text-brand-800 text-sm space-y-1">
            <div>• Share recipes privately within your family group</div>
            <div>• Collaborate on weekly meal planning</div>
            <div>• Generate shared grocery lists from meal plans</div>
            <div>• Invite family members with simple 8-character codes</div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}