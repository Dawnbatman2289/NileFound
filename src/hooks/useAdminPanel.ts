import { useState, useEffect, useRef, useCallback } from 'react';
import { CampusItem, User } from '../types/index.ts';
import { formatDateDDMMYYYY } from '../utils/dateFormatter.ts';
import { sanitizeCsvCell } from '../utils/csv.ts';
import {
  isConfiguredAdmin,
  fetchItemPrivateDetails,
  ItemPrivateDetails,
  fetchCampusAuditCounts,
  CampusAuditCounts,
} from '../services/firestoreService.ts';
import { reportError } from '../components/ErrorBoundary.tsx';

interface UseAdminPanelOptions {
  currentUser: User | null;
  items: CampusItem[];
  isAdmin: boolean;
  isSecurity: boolean;
  isDemoMode: boolean;
  lowDataMode: boolean;
  hasMoreItems: boolean;
  onFetchFullPhoto?: (itemId: string) => Promise<string | null>;
  onLoadAll?: () => Promise<void>;
}

export function useAdminPanel({
  currentUser,
  items,
  isAdmin,
  isSecurity,
  isDemoMode,
  lowDataMode,
  hasMoreItems,
  onFetchFullPhoto,
  onLoadAll,
}: UseAdminPanelOptions) {
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<CampusItem | null>(null);
  const [selectedItemPhoto, setSelectedItemPhoto] = useState<string | null>(null);
  const [isLoadingItemPhoto, setIsLoadingItemPhoto] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CampusItem | null>(null);
  const [privateDetails, setPrivateDetails] = useState<ItemPrivateDetails>({});
  const [isLoadingPrivate, setIsLoadingPrivate] = useState(false);
  const [serverCounts, setServerCounts] = useState<CampusAuditCounts | null>(null);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isMasterOwner, setIsMasterOwner] = useState(false);

  const deleteDialogRef = useRef<HTMLDivElement>(null);
  const detailDialogRef = useRef<HTMLDivElement>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const clearNoticeTimer = () => {
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
  };
  useEffect(() => () => clearNoticeTimer(), []);

  const showNotification = useCallback((msg: string) => {
    clearNoticeTimer();
    setActionError(null);
    setActionNotice(msg);
    noticeTimerRef.current = window.setTimeout(() => setActionNotice(null), 4000);
  }, []);

  const showError = useCallback((msg: string) => {
    clearNoticeTimer();
    setActionNotice(null);
    setActionError(msg);
    noticeTimerRef.current = window.setTimeout(() => setActionError(null), 5000);
  }, []);

  useEffect(() => {
    if (isDemoMode || !currentUser?.id || !isAdmin) {
      setIsMasterOwner(false);
      return;
    }
    let active = true;
    isConfiguredAdmin(currentUser.id).then((ok) => {
      if (active) setIsMasterOwner(ok);
    });
    return () => { active = false; };
  }, [isDemoMode, currentUser?.id, isAdmin]);

  const refreshAuditCounts = useCallback(() => {
    if (isDemoMode || !currentUser || !(isAdmin || isSecurity)) {
      setServerCounts(null);
      return;
    }
    fetchCampusAuditCounts().then(setServerCounts).catch((err) => reportError('fetchCampusAuditCounts failed', err));
  }, [isDemoMode, currentUser, isAdmin, isSecurity]);

  useEffect(() => { refreshAuditCounts(); }, [refreshAuditCounts]);

  useEffect(() => {
    if (!pendingDelete && !selectedItem) return;
    if (pendingDelete) deleteDialogRef.current?.focus();
    else if (selectedItem) detailDialogRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pendingDelete) setPendingDelete(null);
        else setSelectedItem(null);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [pendingDelete, selectedItem]);

  useEffect(() => {
    if (!selectedItem) {
      setPrivateDetails({});
      setSelectedItemPhoto(null);
      setIsLoadingItemPhoto(false);
      return;
    }
    let cancelled = false;
    setIsLoadingPrivate(true);
    fetchItemPrivateDetails(selectedItem.id)
      .then((d) => { if (!cancelled) setPrivateDetails(d); })
      .catch((err) => {
        reportError('fetchItemPrivateDetails failed', err);
        if (!cancelled) setPrivateDetails({});
      })
      .finally(() => { if (!cancelled) setIsLoadingPrivate(false); });

    if (lowDataMode || selectedItem.category === 'student_id') {
      setSelectedItemPhoto(null);
    } else if (selectedItem.imageUrl) {
      setSelectedItemPhoto(selectedItem.imageUrl);
    } else if (selectedItem.thumbUrl && onFetchFullPhoto && !isDemoMode) {
      setIsLoadingItemPhoto(true);
      onFetchFullPhoto(selectedItem.id)
        .then((fullUrl) => { if (!cancelled) setSelectedItemPhoto(fullUrl || selectedItem.thumbUrl || null); })
        .catch((err) => {
          reportError('Admin fetch full photo failed', err);
          if (!cancelled) setSelectedItemPhoto(selectedItem.thumbUrl || null);
        })
        .finally(() => { if (!cancelled) setIsLoadingItemPhoto(false); });
    } else {
      setSelectedItemPhoto(selectedItem.thumbUrl || null);
    }
    return () => { cancelled = true; };
  }, [selectedItem, lowDataMode, onFetchFullPhoto, isDemoMode]);

  const exportAuditLogCsv = useCallback(async () => {
    setIsExportingCsv(true);
    try {
      if (hasMoreItems && onLoadAll) await onLoadAll();
      const headers = ['ID', 'Type', 'Title', 'Category', 'Location', 'Holding Desk', 'Status', 'Date Reported'];
      const rows = items.map((i) => [
        sanitizeCsvCell(i.id),
        sanitizeCsvCell(i.type),
        sanitizeCsvCell(i.title),
        sanitizeCsvCell(i.category),
        sanitizeCsvCell(`${i.location}${i.locationDetails ? ` - ${i.locationDetails}` : ''}`),
        sanitizeCsvCell(i.holdingLocation),
        sanitizeCsvCell(i.status),
        sanitizeCsvCell(formatDateDDMMYYYY(i.dateLostOrFound)),
      ]);
      const blob = new Blob(['\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nilefound_campus_audit_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showNotification(`Exported ${items.length} records to CSV.`);
    } catch {
      showNotification('Could not complete full audit export. Please try again.');
    } finally {
      setIsExportingCsv(false);
    }
  }, [hasMoreItems, onLoadAll, items, showNotification]);

  return {
    actionNotice, actionError,
    selectedItem, setSelectedItem,
    selectedItemPhoto, isLoadingItemPhoto,
    pendingDelete, setPendingDelete,
    privateDetails, isLoadingPrivate,
    serverCounts, isExportingCsv, isMasterOwner,
    deleteDialogRef, detailDialogRef,
    showNotification, showError, refreshAuditCounts, exportAuditLogCsv,
  };
}
