import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CampusItem, User } from '../types/index.ts';
import { formatDateDDMMYYYY } from '../utils/dateFormatter.ts';
import { sanitizeCsvCell } from '../utils/csv.ts';
import {
  fetchItemPrivateDetails,
  ItemPrivateDetails,
  fetchCampusAuditCounts,
  CampusAuditCounts,
} from '../services/firestoreService.ts';
import { isMasterAdminUser } from '../utils/admin.ts';
import { trapFocusOnTab } from '../utils/modalFocus.ts';
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
  onLoadAll?: () => Promise<CampusItem[] | null | void>;
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
  const isMasterOwner = !isDemoMode && isAdmin && isMasterAdminUser(currentUser?.id);

  const activeSelectedItem = useMemo(
    () => (selectedItem ? items.find((i) => i.id === selectedItem.id) ?? selectedItem : null),
    [selectedItem, items]
  );

  const deleteDialogRef = useRef<HTMLDivElement>(null);
  const detailDialogRef = useRef<HTMLDivElement>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const activeSelectedItemRef = useRef(activeSelectedItem);
  const hasPendingDeleteRef = useRef(Boolean(pendingDelete));

  useEffect(() => {
    activeSelectedItemRef.current = activeSelectedItem;
  }, [activeSelectedItem]);

  useEffect(() => {
    hasPendingDeleteRef.current = Boolean(pendingDelete);
  }, [pendingDelete]);

  const clearNoticeTimer = () => {
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
  };
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearNoticeTimer();
    };
  }, []);

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

  const refreshAuditCounts = useCallback(() => {
    if (isDemoMode || !currentUser || !(isAdmin || isSecurity)) {
      setServerCounts(null);
      return;
    }
    fetchCampusAuditCounts()
      .then((counts) => {
        if (isMountedRef.current) setServerCounts(counts);
      })
      .catch((err) => {
        if (isMountedRef.current) reportError('fetchCampusAuditCounts failed', err);
      });
  }, [isDemoMode, currentUser, isAdmin, isSecurity]);

  useEffect(() => { refreshAuditCounts(); }, [refreshAuditCounts]);

  const pendingDeleteId = pendingDelete?.id ?? null;
  const selectedItemId = activeSelectedItem?.id ?? null;

  useEffect(() => {
    if (!pendingDeleteId && !selectedItemId) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const activeDialog = pendingDeleteId ? deleteDialogRef.current : detailDialogRef.current;
    const focusTimer = window.setTimeout(() => activeDialog?.focus(), 0);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (hasPendingDeleteRef.current) setPendingDelete(null);
        else setSelectedItem(null);
        return;
      }
      trapFocusOnTab(e, hasPendingDeleteRef.current ? deleteDialogRef.current : detailDialogRef.current);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus?.();
    };
  }, [pendingDeleteId, selectedItemId]);

  useEffect(() => {
    const current = activeSelectedItemRef.current;
    if (!selectedItemId || !current) {
      setPrivateDetails({});
      setSelectedItemPhoto(null);
      setIsLoadingItemPhoto(false);
      return;
    }
    let cancelled = false;
    if (isDemoMode) {
      setIsLoadingPrivate(false);
      setPrivateDetails({
        authorName: 'Campus Demo Reporter',
        authorEmail: 'Recorded in live campus account',
        expectedAnswer: current.verificationAnswer || 'Demo verification answer',
      });
    } else {
      setIsLoadingPrivate(true);
      fetchItemPrivateDetails(selectedItemId)
        .then((d) => { if (!cancelled) setPrivateDetails(d); })
        .catch((err) => {
          reportError('fetchItemPrivateDetails failed', err);
          if (!cancelled) setPrivateDetails({});
        })
        .finally(() => { if (!cancelled) setIsLoadingPrivate(false); });
    }

    if (lowDataMode || current.category === 'student_id') {
      setSelectedItemPhoto(null);
    } else if (current.imageUrl) {
      setSelectedItemPhoto(current.imageUrl);
    } else if (current.thumbUrl && onFetchFullPhoto && !isDemoMode) {
      setIsLoadingItemPhoto(true);
      onFetchFullPhoto(selectedItemId)
        .then((fullUrl) => { if (!cancelled) setSelectedItemPhoto(fullUrl || current.thumbUrl || null); })
        .catch((err) => {
          reportError('Admin fetch full photo failed', err);
          if (!cancelled) setSelectedItemPhoto(current.thumbUrl || null);
        })
        .finally(() => { if (!cancelled) setIsLoadingItemPhoto(false); });
    } else {
      setSelectedItemPhoto(current.thumbUrl || null);
    }
    return () => { cancelled = true; };
  }, [selectedItemId, lowDataMode, onFetchFullPhoto, isDemoMode]);

  const exportAuditLogCsv = useCallback(async () => {
    setIsExportingCsv(true);
    try {
      let exportItems = items;
      if (hasMoreItems && onLoadAll) {
        const loaded = await onLoadAll();
        if (loaded === null) {
          showError('Could not complete full audit export. Please try again.');
          return;
        }
        if (Array.isArray(loaded)) {
          exportItems = loaded;
        }
      }
      const headers = ['ID', 'Type', 'Title', 'Category', 'Location', 'Holding Desk', 'Status', 'Date Reported'];
      const rows = exportItems.map((i) => [
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
      showNotification(`Exported ${exportItems.length} records to CSV.`);
    } catch (err) {
      reportError('exportAuditLogCsv failed', err);
      showError('Could not complete full audit export. Please try again.');
    } finally {
      setIsExportingCsv(false);
    }
  }, [hasMoreItems, onLoadAll, items, showNotification, showError]);

  return {
    actionNotice, actionError,
    selectedItem: activeSelectedItem, setSelectedItem,
    selectedItemPhoto, isLoadingItemPhoto,
    pendingDelete, setPendingDelete,
    privateDetails, isLoadingPrivate,
    serverCounts, isExportingCsv, isMasterOwner,
    deleteDialogRef, detailDialogRef,
    showNotification, showError, refreshAuditCounts, exportAuditLogCsv,
  };
}
