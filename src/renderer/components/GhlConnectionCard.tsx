import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Unplug,
  ShieldCheck,
  Clock,
  Lock,
  Building2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { GHLConnectionStatus } from '@shared/types';
import {
  DEFAULT_GHL_LOCATION_ID,
  REQUIRED_GHL_SCOPE,
  disconnectGhlAccount,
  fetchGhlConnectionStatus,
  saveAndTestGhlCredentials,
  subscribeGhlStatus,
  testGhlConnectionRequest,
} from '../lib/ghlClient';

interface GhlConnectionCardProps {
  onConnectionChange?: (status: GHLConnectionStatus) => void;
  compact?: boolean;
}

export const GhlConnectionCard: React.FC<GhlConnectionCardProps> = ({
  onConnectionChange,
  compact = false,
}) => {
  const [status, setStatus] = useState<GHLConnectionStatus | null>(null);
  const [locationIdInput, setLocationIdInput] = useState(DEFAULT_GHL_LOCATION_ID);
  const [tokenInput, setTokenInput] = useState('');
  const [showUnsavedToken, setShowUnsavedToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchGhlConnectionStatus().then(initial => {
      setStatus(initial);
      if (initial.locationId) {
        setLocationIdInput(initial.locationId);
      }
      onConnectionChange?.(initial);
    });

    const unsubscribe = subscribeGhlStatus(updated => {
      setStatus(updated);
      if (updated.locationId) {
        setLocationIdInput(updated.locationId);
      }
      onConnectionChange?.(updated);
    });

    return unsubscribe;
  }, []);

  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setLocalSuccess(null);

    const trimmedLoc = locationIdInput.trim();
    if (!trimmedLoc) {
      setLocalError('Location ID is required.');
      return;
    }

    const trimmedToken = tokenInput.trim();
    if (!trimmedToken && !status?.hasToken) {
      setLocalError(
        'Please enter your GoHighLevel Sub-Account Private Integration Token to establish a connection.'
      );
      return;
    }

    setIsSaving(true);
    try {
      const updated = await saveAndTestGhlCredentials({
        token: trimmedToken || undefined,
        locationId: trimmedLoc,
      });

      // Immediately clear the raw token from React component state so it is never retained in memory/DOM
      setTokenInput('');
      setShowUnsavedToken(false);
      setStatus(updated);

      if (updated.connected) {
        setLocalSuccess(updated.statusMessage || 'Connected to GoHighLevel Media Storage!');
      } else {
        setLocalError(updated.lastError || updated.statusMessage || 'Failed to verify GoHighLevel connection.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setLocalError(null);
    setLocalSuccess(null);
    setIsTesting(true);
    try {
      const updated = await testGhlConnectionRequest({
        token: tokenInput.trim() || undefined,
        locationId: locationIdInput.trim() || DEFAULT_GHL_LOCATION_ID,
      });
      if (tokenInput.trim()) {
        setTokenInput('');
        setShowUnsavedToken(false);
      }
      setStatus(updated);
      if (updated.connected) {
        setLocalSuccess(updated.statusMessage || 'Connection verified successfully!');
      } else {
        setLocalError(updated.lastError || updated.statusMessage || 'Connection test failed.');
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = async () => {
    setLocalError(null);
    setLocalSuccess(null);
    setIsDisconnecting(true);
    try {
      const updated = await disconnectGhlAccount();
      setTokenInput('');
      setShowUnsavedToken(false);
      setStatus(updated);
      setLocalSuccess('Disconnected and cleared Private Integration Token from secure backend storage.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const renderStatusBadge = () => {
    if (!status) {
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded-full bg-gray-800 text-gray-300 border border-gray-700">
          Checking...
        </span>
      );
    }

    if (status.connected && status.status === 'connected') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-500/40">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          CONNECTED (API v3)
        </span>
      );
    }

    if (status.status === 'error') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded-full bg-rose-950/70 text-rose-300 border border-rose-500/40">
          <XCircle className="w-3 h-3 text-rose-400" />
          CONNECTION ERROR
        </span>
      );
    }

    if (status.status === 'disconnected') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded-full bg-amber-950/60 text-amber-300 border border-amber-500/30">
          <Unplug className="w-3 h-3 text-amber-400" />
          DISCONNECTED
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded-full bg-blue-950/60 text-blue-300 border border-blue-500/30">
        <KeyRound className="w-3 h-3 text-blue-400" />
        AWAITING TOKEN
      </span>
    );
  };

  return (
    <div className="bg-[#121829] border border-[#1e2942] rounded-2xl p-6 shadow-lg space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1e2942]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2563eb]/20 to-[#7c3aed]/20 border border-[#2563eb]/40 text-blue-400 flex items-center justify-center">
            <KeyRound className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              GoHighLevel Media Storage Connection
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-600/20 text-violet-300 border border-violet-500/30">
                Scope: {REQUIRED_GHL_SCOPE}
              </span>
            </h3>
            <p className="text-[11px] text-gray-400">
              Server-side encrypted Private Integration Token for live GoHighLevel Media Storage (API v3)
            </p>
          </div>
        </div>

        {renderStatusBadge()}
      </div>

      {/* Status & Last Sync Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-[#0a0e1a] border border-[#1e2942] flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
                Backend Vault Status
              </div>
              <div className="text-xs font-medium text-white mt-0.5">
                {status?.hasToken
                  ? `Token Saved (${status.maskedToken})`
                  : 'No Token Stored'}
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono text-gray-400 bg-[#121829] px-2 py-0.5 rounded border border-[#1e2942]">
            AES-256-GCM
          </span>
        </div>

        <div className="p-3 rounded-xl bg-[#0a0e1a] border border-[#1e2942] flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-300">
            <Clock className="w-4 h-4 text-blue-400 shrink-0" />
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
                Last Successful Sync
              </div>
              <div className="text-xs font-mono text-white mt-0.5">
                {status?.lastSyncedAt
                  ? new Date(status.lastSyncedAt).toLocaleString()
                  : 'Never synced'}
              </div>
            </div>
          </div>
          {status?.stats && (
            <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/30">
              Verified
            </span>
          )}
        </div>
      </div>

      {/* Feedback / Error Alerts */}
      {(localError || (status?.status === 'error' && status?.lastError)) && (
        <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-rose-300">
              {status?.errorCode === 'UNAUTHORIZED'
                ? 'Invalid or Revoked Private Integration Token (401)'
                : status?.errorCode === 'FORBIDDEN_SCOPE'
                ? 'Missing Required Permission Scope: medias.readonly (403)'
                : status?.errorCode === 'INVALID_LOCATION'
                ? 'Invalid GoHighLevel Location ID'
                : status?.errorCode === 'RATE_LIMITED'
                ? 'GoHighLevel Rate Limit Reached (429)'
                : 'GoHighLevel Connection Error'}
            </div>
            <p className="text-[11px] text-rose-200/90 leading-relaxed">
              {localError || status?.lastError}
            </p>
          </div>
        </div>
      )}

      {localSuccess && !localError && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{localSuccess}</span>
        </div>
      )}

      {/* Credential Configuration Form */}
      <form onSubmit={handleSaveConnection} className="space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Location ID Input */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              Sub-Account Location ID *
            </label>
            <input
              type="text"
              value={locationIdInput}
              onChange={e => setLocationIdInput(e.target.value)}
              placeholder="tSCoUOTHrXglK2BwDeYc"
              className="w-full bg-[#0a0e1a] border border-[#1e2942] focus:border-[#2563eb] rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-gray-500 focus:outline-none"
              required
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Sent as <code className="text-blue-300">altType=location&amp;altId={locationIdInput || '...'}</code>
            </p>
          </div>

          {/* Private Integration Token Input */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-violet-400" />
              Private Integration Token {status?.hasToken ? '(Replace Stored Token)' : '*'}
            </label>
            <div className="relative">
              <input
                type={showUnsavedToken ? 'text' : 'password'}
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                placeholder={
                  status?.hasToken
                    ? '•••••••••••••••••••••••• (Stored securely — enter new token to replace)'
                    : 'Enter Sub-Account Private Integration Token...'
                }
                autoComplete="off"
                spellCheck={false}
                className="w-full bg-[#0a0e1a] border border-[#1e2942] focus:border-[#2563eb] rounded-xl pl-3.5 pr-9 py-2 text-xs font-mono text-white placeholder-gray-500 focus:outline-none"
              />
              {tokenInput.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowUnsavedToken(prev => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  title={showUnsavedToken ? 'Mask input' : 'Show unsaved input'}
                >
                  {showUnsavedToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Stored exclusively on the trusted backend. Never returned or displayed after saving.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1e2942]">
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isSaving || isTesting}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#7c3aed] hover:from-[#1d4ed8] hover:to-[#6d28d9] disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-950/40 transition-all"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving & Verifying...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Save Connection
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isSaving || isTesting || (!status?.hasToken && !tokenInput.trim())}
              className="px-3.5 py-2 rounded-xl bg-[#161f36] hover:bg-[#1e2942] disabled:opacity-40 border border-[#263554] text-gray-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isTesting ? 'animate-spin' : ''}`} />
              Test Connection
            </button>
          </div>

          {status?.hasToken && (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={isDisconnecting || isSaving}
              className="px-3.5 py-2 rounded-xl bg-rose-950/30 hover:bg-rose-900/40 border border-rose-800/40 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Unplug className="w-3.5 h-3.5" />
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          )}
        </div>
      </form>

      {!compact && (
        <div className="p-3 rounded-xl bg-[#0a0e1a] border border-[#1e2942] text-[11px] text-gray-400 flex items-start gap-2">
          <Lock className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
          <div>
            <span className="text-gray-200 font-semibold">Security Guarantee:</span> Your GoHighLevel Private Integration Token is encrypted at rest on the backend and is never sent to the browser, stored in <code className="text-violet-300">localStorage</code>, logged, or embedded into exported landing page HTML.
          </div>
        </div>
      )}
    </div>
  );
};
