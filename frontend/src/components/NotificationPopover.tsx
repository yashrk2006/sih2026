import React from 'react';
import { 
  ShieldCheck, 
  History, 
  Link as LinkIcon, 
  FileText, 
  Briefcase, 
  Cpu, 
  CheckCheck, 
  Trash2, 
  X,
  BellOff
} from 'lucide-react';
import type { NotificationItem } from '../services/notificationService';

interface NotificationPopoverProps {
  notifications: NotificationItem[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClearSingle: (id: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}

export const NotificationPopover: React.FC<NotificationPopoverProps> = ({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onClearSingle,
  onClearAll,
  onClose,
}) => {

  const getCategoryIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'SECURITY':
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      case 'AUDIT':
        return <History className="w-4 h-4 text-sky-400" />;
      case 'BLOCKCHAIN':
        return <LinkIcon className="w-4 h-4 text-teal-400" />;
      case 'DOCUMENT':
        return <FileText className="w-4 h-4 text-indigo-400" />;
      case 'CASE':
        return <Briefcase className="w-4 h-4 text-amber-400" />;
      case 'AI':
        return <Cpu className="w-4 h-4 text-purple-400" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="w-80 sm:w-96 bg-[#111827] border border-[#1f2937] rounded-md shadow-2xl overflow-hidden font-sans z-50">
      
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1f2937] bg-[#0b0f19] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Notifications</h3>
          {unreadCount > 0 && (
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-sky-950 text-sky-400 border border-sky-900">
              {unreadCount} UNREAD
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#1f2937] transition flex items-center gap-1 text-[10px]"
              title="Mark all as read"
            >
              <CheckCheck className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Mark all read</span>
            </button>
          )}

          {notifications.length > 0 && (
            <button
              onClick={onClearAll}
              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-[#1f2937] transition"
              title="Clear all notifications"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#1f2937] transition ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Notification List */}
      <div className="max-h-80 overflow-y-auto divide-y divide-[#1f2937]">
        {notifications.length === 0 ? (
          <div className="py-10 px-4 text-center space-y-2">
            <BellOff className="w-8 h-8 text-slate-600 mx-auto" />
            <span className="text-xs font-medium text-slate-400 block">No new notifications</span>
            <span className="text-[11px] text-slate-500 block">All system events are up to date.</span>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.read && onMarkRead(n.id)}
              className={`p-3 transition flex items-start space-x-3 cursor-pointer ${
                n.read ? 'bg-[#111827] opacity-80 hover:opacity-100' : 'bg-[#0b0f19] font-medium'
              }`}
            >
              <div className="p-2 rounded bg-[#1f2937] border border-[#374151] shrink-0 mt-0.5">
                {getCategoryIcon(n.type)}
              </div>

              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-100 truncate">{n.title}</span>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0 ml-2" title="Unread" />
                  )}
                </div>
                <p className="text-[11px] text-slate-300 leading-normal line-clamp-2">{n.message}</p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-mono text-slate-500">{n.timestamp}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearSingle(n.id);
                    }}
                    className="text-[10px] text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition"
                    title="Clear notification"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
};
