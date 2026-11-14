import React from 'react';
import { CampusItem } from '../../types/index.ts';
import { ADMIN_CARD } from './adminStyles.ts';

interface DeleteConfirmModalProps {
  pendingDelete: CampusItem | null;
  dialogRef: React.RefObject<HTMLDivElement | null>;
  onCancel: () => void;
  onConfirmDelete: (item: CampusItem) => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  pendingDelete,
  dialogRef,
  onCancel,
  onConfirmDelete,
}) => {
  if (!pendingDelete) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-3" onClick={onCancel}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-[480px] p-5 shadow-xl outline-none ${ADMIN_CARD}`}
      >
        <h2 id="delete-title" className="text-base font-bold">Delete this item?</h2>
        <p className="mt-2 text-sm text-[#4A443C] dark:text-[#CEC7BB]">
          This permanently removes &ldquo;{pendingDelete.title}&rdquo; and its claims.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] rounded-[10px] border border-[#857C70] dark:border-[#787065] px-4 text-sm cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirmDelete(pendingDelete)}
            className="min-h-[44px] rounded-[10px] bg-[#9B1C1C] px-4 text-sm font-medium text-white cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
