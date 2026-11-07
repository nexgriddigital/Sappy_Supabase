import React, { useState, useMemo } from 'react';
import {
  UserCog,
  UserPlus,
  Users,
  Shield,
  ShieldCheck,
  KeyRound,
  Lock,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Edit2,
  Trash2,
  LogIn,
  Power,
  Store,
  Phone,
  Mail,
  Calendar,
  Sparkles,
  Info,
  X,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Clock,
  Layers,
  ArrowUpDown,
  UserCheck,
  HelpCircle,
} from 'lucide-react';
import { AppUser, UserRole, UserStatus, StoreConfig } from '../types/pos.ts';
import { storageService } from '../services/storageService.ts';

interface UsersTabProps {
  currentUser: AppUser | null;
  config: StoreConfig;
  onUserChanged: (user: AppUser) => void;
  onRefreshData: () => void;
}

export const UsersTab: React.FC<UsersTabProps> = ({
  currentUser,
  config,
  onUserChanged,
  onRefreshData,
}) => {
  // All Users from storage
  const [users, setUsers] = useState<AppUser[]>(() => storageService.getUsers());

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'recent' | 'created'>('name');

  // Modal States
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [isPermissionsGuideOpen, setIsPermissionsGuideOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinTargetUser, setPinTargetUser] = useState<AppUser | null>(null);
  const [newPinCode, setNewPinCode] = useState('');

  // Delete Confirmation State
  const [deleteTargetUser, setDeleteTargetUser] = useState<AppUser | null>(null);

  // Status Alerts
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Add / Edit Form State
  const [formData, setFormData] = useState<{
    fullName: string;
    email: string;
    role: UserRole;
    phone: string;
    storeName: string;
    status: UserStatus;
    pinCode: string;
    notes: string;
  }>({
    fullName: '',
    email: '',
    role: 'cashier',
    phone: '',
    storeName: config.storeName || 'Sappy Stationary',
    status: 'active',
    pinCode: '',
    notes: '',
  });

  const reloadUserList = () => {
    const list = storageService.getUsers();
    setUsers(list);
    onRefreshData();
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 5000);
  };

  // Filter and Sort Users
  const filteredUsers = useMemo(() => {
    let result = users.filter((u) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone && u.phone.toLowerCase().includes(q)) ||
        (u.notes && u.notes.toLowerCase().includes(q));

      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const userStatus = u.status || 'active';
      const matchesStatus = statusFilter === 'all' || userStatus === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });

    result.sort((a, b) => {
      if (sortBy === 'name') {
        return a.fullName.localeCompare(b.fullName);
      }
      if (sortBy === 'role') {
        const order: Record<UserRole, number> = { owner: 1, manager: 2, cashier: 3 };
        return order[a.role] - order[b.role];
      }
      if (sortBy === 'recent') {
        const timeA = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
        const timeB = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
        return timeB - timeA;
      }
      if (sortBy === 'created') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return 0;
    });

    return result;
  }, [users, searchQuery, roleFilter, statusFilter, sortBy]);

  // Counts
  const totalCount = users.length;
  const ownerCount = users.filter((u) => u.role === 'owner').length;
  const managerCount = users.filter((u) => u.role === 'manager').length;
  const cashierCount = users.filter((u) => u.role === 'cashier').length;
  const activeCount = users.filter((u) => (u.status || 'active') === 'active').length;

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({
      fullName: '',
      email: '',
      role: 'cashier',
      phone: '',
      storeName: config.storeName || 'Sappy Stationary',
      status: 'active',
      pinCode: '',
      notes: '',
    });
    setIsAddEditModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (user: AppUser) => {
    setEditingUser(user);
    setFormData({
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      phone: user.phone || '',
      storeName: user.storeName || config.storeName || 'Sappy Stationary',
      status: user.status || 'active',
      pinCode: user.pinCode || '',
      notes: user.notes || '',
    });
    setIsAddEditModalOpen(true);
  };

  // Save User (Create or Update)
  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.email.trim()) {
      showError('Please provide both full name and email address.');
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      showError('Please enter a valid email address.');
      return;
    }

    // PIN validation if provided: must be 4 digits
    if (formData.pinCode && !/^\d{4}$/.test(formData.pinCode.trim())) {
      showError('Quick Terminal PIN must be exactly 4 numeric digits (e.g., 1234).');
      return;
    }

    // Check duplicate email
    const duplicate = users.find(
      (u) =>
        u.email.toLowerCase() === formData.email.trim().toLowerCase() &&
        (!editingUser || u.id !== editingUser.id)
    );
    if (duplicate) {
      showError(`A staff member with email "${formData.email}" already exists.`);
      return;
    }

    if (editingUser) {
      // Safeguard: cannot demote the only owner
      if (editingUser.role === 'owner' && formData.role !== 'owner' && ownerCount <= 1) {
        showError('Cannot change the role of the only remaining Store Owner.');
        return;
      }

      // Update
      const updatedUser: AppUser = {
        ...editingUser,
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        role: formData.role,
        phone: formData.phone.trim() || undefined,
        storeName: formData.storeName.trim() || config.storeName,
        status: formData.status,
        pinCode: formData.pinCode.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      };

      storageService.saveUser(updatedUser);
      if (currentUser && currentUser.id === updatedUser.id) {
        onUserChanged(updatedUser);
      }
      showSuccess(`Staff profile for "${updatedUser.fullName}" updated successfully.`);
    } else {
      // Create new user
      const newUser: AppUser = {
        id: `usr-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        role: formData.role,
        phone: formData.phone.trim() || undefined,
        storeName: formData.storeName.trim() || config.storeName,
        status: formData.status,
        pinCode: formData.pinCode.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        createdAt: new Date().toISOString(),
        lastLoginAt: undefined,
      };

      storageService.saveUser(newUser);
      showSuccess(`New staff member "${newUser.fullName}" registered successfully.`);
    }

    reloadUserList();
    setIsAddEditModalOpen(false);
  };

  // Toggle User Active / Suspended Status
  const handleToggleStatus = (user: AppUser) => {
    if (currentUser && currentUser.id === user.id) {
      showError('You cannot suspend your own currently active terminal account.');
      return;
    }
    if (user.role === 'owner' && ownerCount <= 1 && (user.status || 'active') === 'active') {
      showError('Cannot suspend the only remaining Store Owner.');
      return;
    }

    const nextStatus: UserStatus = (user.status || 'active') === 'active' ? 'suspended' : 'active';
    storageService.updateUserStatus(user.id, nextStatus);
    reloadUserList();
    showSuccess(
      `User "${user.fullName}" is now ${nextStatus === 'active' ? 'Active' : 'Suspended'}.`
    );
  };

  // Delete User
  const handleConfirmDelete = () => {
    if (!deleteTargetUser) return;
    const res = storageService.deleteUser(deleteTargetUser.id);
    if (!res.success) {
      showError(res.error || 'Failed to delete user.');
    } else {
      showSuccess(`User "${deleteTargetUser.fullName}" removed from system.`);
      reloadUserList();
    }
    setDeleteTargetUser(null);
  };

  // Set / Update Quick PIN
  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinTargetUser) return;
    if (newPinCode && !/^\d{4}$/.test(newPinCode.trim())) {
      showError('PIN must be exactly 4 numeric digits, or leave blank to remove.');
      return;
    }

    storageService.setUserPin(pinTargetUser.id, newPinCode.trim());
    reloadUserList();
    showSuccess(
      newPinCode.trim()
        ? `4-digit PIN updated for ${pinTargetUser.fullName}.`
        : `PIN removed for ${pinTargetUser.fullName}.`
    );
    setIsPinModalOpen(false);
    setPinTargetUser(null);
    setNewPinCode('');
  };

  // Switch Active Terminal User
  const handleSwitchUser = (user: AppUser) => {
    if ((user.status || 'active') === 'suspended') {
      showError(`Cannot switch to suspended account "${user.fullName}".`);
      return;
    }

    storageService.setCurrentUser(user);
    onUserChanged(user);
    setIsSwitchModalOpen(false);
    showSuccess(`Terminal switched to ${user.fullName} (${user.role.toUpperCase()}).`);
  };

  // Seed Demo Staff (One-click helpful shortcut)
  const handleSeedDemoStaff = () => {
    storageService.seedDemoStaff();
    reloadUserList();
    showSuccess('Sample Manager (Dawit) and Cashier (Selamawit) added to directory!');
  };

  // Format Dates
  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Never';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Unknown';
    }
  };

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return 'Never logged in';
    try {
      const d = new Date(isoString);
      return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return 'Unknown';
    }
  };

  // Role Badge Helper
  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-950/70 border border-amber-600/60 text-amber-300 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Store Owner</span>
          </span>
        );
      case 'manager':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-950/70 border border-emerald-600/60 text-emerald-300 text-xs font-semibold">
            <UserCog className="w-3.5 h-3.5 text-emerald-400" />
            <span>Store Manager</span>
          </span>
        );
      case 'cashier':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-sky-950/70 border border-sky-600/60 text-sky-300 text-xs font-semibold">
            <UserCheck className="w-3.5 h-3.5 text-sky-400" />
            <span>Cashier</span>
          </span>
        );
    }
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
      
      {/* ======================================================== */}
      {/* 1. TOP HEADER & CONTEXT BAR */}
      {/* ======================================================== */}
      <div className="bg-charcoal-900 rounded-2xl p-6 border border-charcoal-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 text-xs font-mono text-charcoal-400">
            <span className="text-forest-400 font-bold">POS Administration</span>
            <span aria-hidden="true">/</span>
            <span>Access Control & Team</span>
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-forest-400" />
            <span>Users & Staff Directory</span>
          </h1>

          <p className="text-xs sm:text-sm text-charcoal-300 mt-1 max-w-2xl">
            Configure employee roles, 4-digit quick terminal PINs, cashier shift assignments, and role-based operational permissions for {config.storeName}.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsPermissionsGuideOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-charcoal-950 hover:bg-charcoal-800 text-charcoal-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 border border-charcoal-700 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-forest-400" />
            <span>Role Permissions</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSwitchModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-charcoal-950 hover:bg-charcoal-800 text-charcoal-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 border border-charcoal-700 transition-colors cursor-pointer"
          >
            <Power className="w-4 h-4 text-amber-400" />
            <span>Switch Shift</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-forest-700 hover:bg-forest-600 text-white text-xs font-bold flex items-center gap-1.5 border border-forest-500 shadow-md shadow-forest-950/40 transition-all cursor-pointer active:scale-95"
          >
            <UserPlus className="w-4 h-4 text-forest-200" />
            <span>Add New User</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. ALERTS & NOTIFICATIONS */}
      {/* ======================================================== */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-forest-950 border border-forest-600 text-forest-200 text-xs font-semibold flex items-center gap-2.5 shadow-lg animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-forest-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950 border border-rose-700 text-rose-200 text-xs font-semibold flex items-center gap-2.5 shadow-lg animate-fade-in">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. ACTIVE SHIFT SPOTLIGHT & METRICS RIBBON */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        
        {/* Active Terminal Session Spotlight (5 Cols) */}
        <div className="md:col-span-5 bg-charcoal-900 rounded-2xl p-4 sm:p-5 border border-charcoal-800 shadow-md flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-forest-900/80 border border-forest-500/60 flex items-center justify-center text-forest-200 font-bold text-lg font-mono shrink-0 shadow-inner">
              {currentUser?.fullName.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-forest-400 font-bold">
                  Active Terminal Shift
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-forest-400 animate-pulse" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white truncate">
                {currentUser?.fullName || 'Not Signed In'}
              </h3>
              <div className="flex items-center gap-2 text-xs text-charcoal-400 mt-0.5">
                <span className="capitalize text-charcoal-300 font-medium">
                  {currentUser?.role || 'Staff'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-[11px]">
                  {currentUser?.pinCode ? 'PIN Active' : 'No PIN Set'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsSwitchModalOpen(true)}
            className="px-3 py-2 rounded-xl bg-charcoal-950 hover:bg-charcoal-800 text-xs font-bold text-charcoal-200 hover:text-white border border-charcoal-700 transition-colors cursor-pointer shrink-0"
            title="Switch cashier or manager on this POS terminal"
          >
            Switch User
          </button>
        </div>

        {/* Staff Metrics KPI Cards (7 Cols) */}
        <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
          
          <div className="bg-charcoal-900 rounded-2xl p-4 border border-charcoal-800 shadow-md flex flex-col justify-between">
            <span className="text-[11px] font-medium text-charcoal-400">Total Staff</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-white font-mono tabular-nums">{totalCount}</span>
              <span className="text-[10px] font-mono text-forest-400">{activeCount} active</span>
            </div>
          </div>

          <div className="bg-charcoal-900 rounded-2xl p-4 border border-charcoal-800 shadow-md flex flex-col justify-between">
            <span className="text-[11px] font-medium text-charcoal-400">Cashiers</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-sky-400 font-mono tabular-nums">{cashierCount}</span>
              <span className="text-[10px] text-charcoal-500 font-mono">Counter</span>
            </div>
          </div>

          <div className="bg-charcoal-900 rounded-2xl p-4 border border-charcoal-800 shadow-md flex flex-col justify-between">
            <span className="text-[11px] font-medium text-charcoal-400">Managers</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-emerald-400 font-mono tabular-nums">{managerCount}</span>
              <span className="text-[10px] text-charcoal-500 font-mono">Floor</span>
            </div>
          </div>

          <div className="bg-charcoal-900 rounded-2xl p-4 border border-charcoal-800 shadow-md flex flex-col justify-between">
            <span className="text-[11px] font-medium text-charcoal-400">Store Owners</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-amber-400 font-mono tabular-nums">{ownerCount}</span>
              <span className="text-[10px] text-charcoal-500 font-mono">Admin</span>
            </div>
          </div>

        </div>

      </div>

      {/* Quick Demo Staff Seeding Banner if only 1 user exists */}
      {users.length <= 1 && (
        <div className="p-4 rounded-2xl bg-charcoal-900 border border-forest-800/80 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-forest-950 border border-forest-600/60 flex items-center justify-center text-forest-400 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">
                Multi-User Terminal Quick Start
              </p>
              <p className="text-[11px] text-charcoal-400">
                Generate pre-configured demo staff profiles (Store Manager & Cashier with PINs 2026 & 1234) to test role switching right away.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSeedDemoStaff}
            className="px-3.5 py-2 rounded-xl bg-forest-800 hover:bg-forest-700 text-white text-xs font-bold transition-colors cursor-pointer border border-forest-600 shrink-0 flex items-center justify-center gap-1.5 active:scale-95"
          >
            <UserPlus className="w-3.5 h-3.5 text-forest-300" />
            <span>Seed Demo Staff</span>
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. SEARCH, FILTER & SORT TOOLBAR */}
      {/* ======================================================== */}
      <div className="bg-charcoal-900 rounded-2xl p-4 border border-charcoal-800 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-charcoal-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search staff by name, email, phone, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-charcoal-950 border border-charcoal-800 rounded-xl text-xs text-white placeholder-charcoal-500 focus:outline-hidden focus:border-forest-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-charcoal-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Segmented Controls */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Role Filter */}
          <div className="flex items-center gap-1 p-1 bg-charcoal-950 rounded-xl border border-charcoal-800">
            {(
              [
                { id: 'all', label: 'All Roles' },
                { id: 'owner', label: 'Owners' },
                { id: 'manager', label: 'Managers' },
                { id: 'cashier', label: 'Cashiers' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => setRoleFilter(item.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  roleFilter === item.id
                    ? 'bg-forest-700 text-white shadow-xs'
                    : 'text-charcoal-400 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 p-1 bg-charcoal-950 rounded-xl border border-charcoal-800">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'active', label: 'Active' },
                { id: 'suspended', label: 'Suspended' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => setStatusFilter(item.id)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  statusFilter === item.id
                    ? 'bg-charcoal-800 text-white'
                    : 'text-charcoal-400 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5 pl-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-charcoal-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-charcoal-950 text-charcoal-200 border border-charcoal-800 rounded-xl px-2.5 py-1.5 text-xs focus:outline-hidden focus:border-forest-500 cursor-pointer"
            >
              <option value="name">Sort: Name (A-Z)</option>
              <option value="role">Sort: Role Priority</option>
              <option value="recent">Sort: Recently Active</option>
              <option value="created">Sort: Date Joined</option>
            </select>
          </div>

        </div>

      </div>

      {/* ======================================================== */}
      {/* 5. USER DIRECTORY DATA TABLE */}
      {/* ======================================================== */}
      <div className="bg-charcoal-900 rounded-2xl border border-charcoal-800 shadow-xl overflow-hidden">
        
        {filteredUsers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Users className="w-10 h-10 text-charcoal-600 mx-auto" />
            <h4 className="text-sm font-bold text-white">No Staff Accounts Found</h4>
            <p className="text-xs text-charcoal-400 max-w-sm mx-auto">
              {searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
                ? 'No users match your active filters. Try clearing the search query or changing role criteria.'
                : 'Get started by creating your first cashier or manager staff account.'}
            </p>
            {(searchQuery || roleFilter !== 'all' || statusFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setRoleFilter('all');
                  setStatusFilter('all');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-charcoal-800 text-xs font-semibold text-white hover:bg-charcoal-700 cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-charcoal-950 border-b border-charcoal-800 text-[11px] font-mono uppercase text-charcoal-400 tracking-wider">
                  <th className="py-3 px-4 font-bold">Staff Member</th>
                  <th className="py-3 px-4 font-bold">Role & Permissions</th>
                  <th className="py-3 px-4 font-bold">Terminal PIN</th>
                  <th className="py-3 px-4 font-bold">Contact Phone</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 px-4 font-bold">Last Activity</th>
                  <th className="py-3 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-800/80">
                {filteredUsers.map((user) => {
                  const isCurrent = currentUser?.id === user.id;
                  const isSuspended = (user.status || 'active') === 'suspended';

                  return (
                    <tr
                      key={user.id}
                      className={`transition-colors hover:bg-charcoal-800/40 ${
                        isCurrent ? 'bg-forest-950/20' : ''
                      }`}
                    >
                      {/* Column 1: Staff Member */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 border ${
                              user.role === 'owner'
                                ? 'bg-amber-950/80 text-amber-300 border-amber-600/50'
                                : user.role === 'manager'
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50'
                                : 'bg-sky-950/80 text-sky-300 border-sky-600/50'
                            }`}
                          >
                            {user.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white text-xs truncate max-w-[170px]">
                                {user.fullName}
                              </span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 bg-forest-900 text-forest-200 border border-forest-600 rounded text-[9px] font-mono font-semibold">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-charcoal-400 font-mono truncate max-w-[200px]">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Role */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getRoleBadge(user.role)}
                      </td>

                      {/* Column 3: Terminal PIN */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setPinTargetUser(user);
                            setNewPinCode(user.pinCode || '');
                            setIsPinModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 text-xs text-charcoal-300 hover:text-white group cursor-pointer"
                          title="Click to view or change 4-digit POS register PIN"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-forest-400 group-hover:scale-110 transition-transform" />
                          <span className="font-mono">
                            {user.pinCode ? `•••• (${user.pinCode})` : 'Set PIN'}
                          </span>
                        </button>
                      </td>

                      {/* Column 4: Contact Phone */}
                      <td className="py-3 px-4 font-mono text-[11px] text-charcoal-300 whitespace-nowrap">
                        {user.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-charcoal-500" />
                            <span>{user.phone}</span>
                          </span>
                        ) : (
                          <span className="text-charcoal-600">—</span>
                        )}
                      </td>

                      {/* Column 5: Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(user)}
                          disabled={isCurrent}
                          title={
                            isCurrent
                              ? 'Cannot suspend yourself'
                              : `Click to ${isSuspended ? 'activate' : 'suspend'} staff member`
                          }
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer border transition-colors ${
                            isCurrent ? 'cursor-not-allowed opacity-80' : ''
                          } ${
                            isSuspended
                              ? 'bg-rose-950/60 text-rose-300 border-rose-800 hover:bg-rose-900/60'
                              : 'bg-forest-950/60 text-forest-300 border-forest-800 hover:bg-forest-900/60'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSuspended ? 'bg-rose-500' : 'bg-forest-400'
                            }`}
                          />
                          <span className="capitalize">{user.status || 'active'}</span>
                        </button>
                      </td>

                      {/* Column 6: Last Activity */}
                      <td className="py-3 px-4 font-mono text-[11px] text-charcoal-400 whitespace-nowrap">
                        {formatDateTime(user.lastLoginAt)}
                      </td>

                      {/* Column 7: Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Switch to User */}
                          {!isCurrent && !isSuspended && (
                            <button
                              type="button"
                              onClick={() => handleSwitchUser(user)}
                              className="px-2 py-1 rounded-lg bg-charcoal-950 hover:bg-charcoal-800 text-charcoal-200 hover:text-white border border-charcoal-700 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                              title={`Switch active terminal session to ${user.fullName}`}
                            >
                              <LogIn className="w-3 h-3 text-forest-400" />
                              <span>Switch</span>
                            </button>
                          )}

                          {/* Edit User Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(user)}
                            className="p-1.5 rounded-lg text-charcoal-400 hover:text-white hover:bg-charcoal-800 transition-colors cursor-pointer"
                            title="Edit User Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete User Button */}
                          <button
                            type="button"
                            disabled={isCurrent || (user.role === 'owner' && ownerCount <= 1)}
                            onClick={() => setDeleteTargetUser(user)}
                            className="p-1.5 rounded-lg text-charcoal-400 hover:text-rose-400 hover:bg-charcoal-800 disabled:opacity-30 disabled:hover:text-charcoal-400 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            title={
                              isCurrent
                                ? 'Cannot delete your active account'
                                : user.role === 'owner' && ownerCount <= 1
                                ? 'Cannot delete the only Owner'
                                : 'Delete User'
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Directory Footer Summary */}
        <div className="bg-charcoal-950 px-4 py-3 border-t border-charcoal-800 flex flex-col sm:flex-row items-center justify-between text-xs text-charcoal-400 gap-2">
          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span>Showing {filteredUsers.length} of {totalCount} registered staff</span>
            <span>·</span>
            <span className="text-forest-400 font-semibold">{activeCount} Active</span>
          </div>
          <span className="text-[11px] text-charcoal-500">
            Protected by Role-Based Access Control (RBAC) & SAPPY Terminal Security
          </span>
        </div>

      </div>

      {/* ======================================================== */}
      {/* 6. MODAL: ADD / EDIT USER */}
      {/* ======================================================== */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-950/80 backdrop-blur-xs">
          <div className="bg-charcoal-900 border border-charcoal-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-white">
            
            <div className="flex items-center justify-between pb-3 border-b border-charcoal-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-forest-950 border border-forest-600/60 flex items-center justify-center text-forest-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingUser ? 'Edit Staff Profile' : 'Register New Staff Member'}
                  </h3>
                  <p className="text-[11px] text-charcoal-400">
                    {editingUser ? `Updating account for ${editingUser.fullName}` : 'Create POS login and assign operational role'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddEditModalOpen(false)}
                className="text-charcoal-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              
              <div>
                <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Abebe Bikila"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full bg-charcoal-950 border border-charcoal-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-charcoal-500 focus:outline-hidden focus:border-forest-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. abebe@sappystationery.et"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-charcoal-950 border border-charcoal-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-charcoal-500 focus:outline-hidden focus:border-forest-500 font-mono"
                />
              </div>

              {/* Role Selection with Capabilities preview */}
              <div>
                <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1.5">
                  Assigned Role *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      {
                        id: 'owner' as UserRole,
                        label: 'Owner',
                        desc: 'Full system control & P&L',
                      },
                      {
                        id: 'manager' as UserRole,
                        label: 'Manager',
                        desc: 'Stock, expenses & ledger',
                      },
                      {
                        id: 'cashier' as UserRole,
                        label: 'Cashier',
                        desc: 'POS sales checkout',
                      },
                    ]
                  ).map((r) => {
                    const isSelected = formData.role === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, role: r.id })}
                        className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-forest-900/80 border-forest-500 text-white shadow-sm'
                            : 'bg-charcoal-950 border-charcoal-800 text-charcoal-400 hover:text-white'
                        }`}
                      >
                        <p className="text-xs font-bold">{r.label}</p>
                        <p className="text-[10px] text-charcoal-400 mt-0.5 leading-tight">{r.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Terminal PIN & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                    Terminal Quick PIN (4 Digits)
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="e.g. 1234"
                    value={formData.pinCode}
                    onChange={(e) => setFormData({ ...formData, pinCode: e.target.value.replace(/\D/g, '') })}
                    className="w-full bg-charcoal-950 border border-charcoal-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-charcoal-500 focus:outline-hidden focus:border-forest-500 font-mono tracking-widest"
                  />
                  <p className="text-[10px] text-charcoal-500 mt-1">For instant counter register switching</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="+251 91 123 4567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-charcoal-950 border border-charcoal-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-charcoal-500 focus:outline-hidden focus:border-forest-500 font-mono"
                  />
                </div>
              </div>

              {/* Status & Store Branch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                    Account Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as UserStatus })}
                    className="w-full bg-charcoal-950 border border-charcoal-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-hidden focus:border-forest-500 cursor-pointer"
                  >
                    <option value="active">Active (Access Allowed)</option>
                    <option value="suspended">Suspended (Access Blocked)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                    Store Location / Branch
                  </label>
                  <input
                    type="text"
                    value={formData.storeName}
                    onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                    className="w-full bg-charcoal-950 border border-charcoal-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-hidden focus:border-forest-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                  Department / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Morning counter shift, Stationery & Photocopy"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-charcoal-950 border border-charcoal-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-charcoal-500 focus:outline-hidden focus:border-forest-500"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-charcoal-800">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-charcoal-800 text-charcoal-300 text-xs font-semibold hover:bg-charcoal-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-forest-700 hover:bg-forest-600 text-white font-bold text-xs flex items-center gap-1.5 border border-forest-500 shadow-md cursor-pointer active:scale-95 transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingUser ? 'Save Changes' : 'Create Staff User'}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. MODAL: QUICK TERMINAL SHIFT SWITCHER */}
      {/* ======================================================== */}
      {isSwitchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-950/80 backdrop-blur-xs">
          <div className="bg-charcoal-900 border border-charcoal-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-white">
            
            <div className="flex items-center justify-between pb-3 border-b border-charcoal-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-forest-950 border border-forest-600/60 flex items-center justify-center text-forest-400">
                  <Power className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Switch Terminal Shift</h3>
                  <p className="text-[11px] text-charcoal-400">Select active staff member for POS checkout</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSwitchModalOpen(false)}
                className="text-charcoal-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-charcoal-300">
              Select an employee to take over the active counter register shift:
            </p>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {users
                .filter((u) => (u.status || 'active') === 'active')
                .map((u) => {
                  const isCurrent = currentUser?.id === u.id;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      disabled={isCurrent}
                      onClick={() => handleSwitchUser(u)}
                      className={`w-full p-3 rounded-xl border text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-forest-950/60 border-forest-700 text-forest-200 cursor-default'
                          : 'bg-charcoal-950 hover:bg-charcoal-800 border-charcoal-800 text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-charcoal-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 text-white border border-charcoal-700">
                          {u.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{u.fullName}</p>
                          <p className="text-[10px] text-charcoal-400 font-mono uppercase">{u.role}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isCurrent ? (
                          <span className="text-[10px] font-mono text-forest-400 font-bold">Current</span>
                        ) : (
                          <span className="text-xs font-bold text-forest-400 flex items-center gap-1">
                            <span>Switch</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSwitchModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-charcoal-800 text-charcoal-300 text-xs font-semibold hover:bg-charcoal-700 cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 8. MODAL: SET / EDIT QUICK 4-DIGIT PIN */}
      {/* ======================================================== */}
      {isPinModalOpen && pinTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-950/80 backdrop-blur-xs">
          <div className="bg-charcoal-900 border border-charcoal-700 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-white">
            
            <div className="flex items-center justify-between pb-3 border-b border-charcoal-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-forest-950 border border-forest-600/60 flex items-center justify-center text-forest-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Set Terminal PIN</h3>
                  <p className="text-[11px] text-charcoal-400">Quick POS register passcode</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPinModalOpen(false)}
                className="text-charcoal-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePin} className="space-y-4">
              <p className="text-xs text-charcoal-300">
                Set a 4-digit numeric passcode for <strong className="text-white">{pinTargetUser.fullName}</strong>. Leave blank to clear.
              </p>

              <div>
                <input
                  type="text"
                  maxLength={4}
                  autoFocus
                  placeholder="e.g. 1234"
                  value={newPinCode}
                  onChange={(e) => setNewPinCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center text-2xl tracking-[0.5em] font-mono py-3 bg-charcoal-950 border border-charcoal-700 rounded-xl text-white focus:outline-hidden focus:border-forest-500 font-bold"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-charcoal-800 text-charcoal-300 text-xs font-semibold hover:bg-charcoal-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-forest-700 hover:bg-forest-600 text-white font-bold text-xs flex items-center gap-1.5 border border-forest-500 shadow-md cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Save PIN</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 9. MODAL: ROLE PERMISSIONS MATRIX GUIDE */}
      {/* ======================================================== */}
      {isPermissionsGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-950/80 backdrop-blur-xs">
          <div className="bg-charcoal-900 border border-charcoal-700 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl text-white max-h-[90vh] flex flex-col">
            
            <div className="flex items-center justify-between pb-3 border-b border-charcoal-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-forest-950 border border-forest-600/60 flex items-center justify-center text-forest-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Role-Based Access Control (RBAC)</h3>
                  <p className="text-[11px] text-charcoal-400">Security & Operational Privilege Matrix</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPermissionsGuideOpen(false)}
                className="text-charcoal-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 pr-1 space-y-4 text-xs">
              <p className="text-charcoal-300">
                Sappy POS employs strict role segregation to ensure transaction integrity, inventory accuracy, and financial privacy:
              </p>

              <div className="border border-charcoal-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-charcoal-950 border-b border-charcoal-800 text-[11px] font-mono uppercase text-charcoal-400">
                      <th className="py-2.5 px-3">System Feature</th>
                      <th className="py-2.5 px-3 text-center text-amber-400">Store Owner</th>
                      <th className="py-2.5 px-3 text-center text-emerald-400">Store Manager</th>
                      <th className="py-2.5 px-3 text-center text-sky-400">Cashier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-charcoal-800/60 font-mono text-[11px]">
                    {[
                      { feat: 'POS Register Sales & Receipt Print', owner: 'Full', mgr: 'Full', cashier: 'Full' },
                      { feat: 'Customer Credit & Debt Settlement', owner: 'Full', mgr: 'Full', cashier: 'View & Collect' },
                      { feat: 'Custom Line Item Discounting', owner: 'Uncapped', mgr: 'Standard', cashier: 'Up to 10%' },
                      { feat: 'Product Inventory & Stock Adjustments', owner: 'Full', mgr: 'Full', cashier: 'View Only' },
                      { feat: 'COGS & Wholesale Profit Margin View', owner: 'Yes', mgr: 'Yes', cashier: 'Hidden' },
                      { feat: 'Daily P&L & Financial Reports', owner: 'Full', mgr: 'Operational', cashier: 'Hidden' },
                      { feat: 'Operating Expenses Recording', owner: 'Full', mgr: 'Log & View', cashier: 'Hidden' },
                      { feat: 'Staff User Management & PINs', owner: 'Full Control', mgr: 'Shift View', cashier: 'Restricted' },
                      { feat: 'Cloud Sync & Database Reset', owner: 'Full Admin', mgr: 'Sync Only', cashier: 'Restricted' },
                    ].map((row, idx) => (
                      <tr key={idx} className="hover:bg-charcoal-800/30">
                        <td className="py-2.5 px-3 text-white font-sans font-medium">{row.feat}</td>
                        <td className="py-2.5 px-3 text-center text-amber-300">{row.owner}</td>
                        <td className="py-2.5 px-3 text-center text-emerald-300">{row.mgr}</td>
                        <td className="py-2.5 px-3 text-center text-sky-300">{row.cashier}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-2 flex justify-end border-t border-charcoal-800">
              <button
                type="button"
                onClick={() => setIsPermissionsGuideOpen(false)}
                className="px-4 py-2 rounded-xl bg-forest-700 hover:bg-forest-600 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Understood
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 10. MODAL: DELETE CONFIRMATION */}
      {/* ======================================================== */}
      {deleteTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-950/80 backdrop-blur-xs">
          <div className="bg-charcoal-900 border border-rose-900/80 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-white">
            
            <div className="flex items-center gap-3 text-rose-400">
              <Trash2 className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold">Remove Staff Account?</h3>
            </div>

            <p className="text-xs text-charcoal-300 leading-relaxed">
              Are you sure you want to remove <strong className="text-white">{deleteTargetUser.fullName}</strong> ({deleteTargetUser.email})? This user will no longer have access to the POS terminal.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetUser(null)}
                className="px-4 py-2 rounded-xl bg-charcoal-800 text-charcoal-300 text-xs font-semibold hover:bg-charcoal-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-1.5 border border-rose-500 shadow-md cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirm Removal</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
