import React, { useState } from 'react';
import {
  X,
  Bell,
  BellRing,
  BellOff,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  VolumeX,
  Smartphone,
  ShieldAlert,
  Clock,
  Send,
  Trash2,
  ExternalLink,
  Layers,
  ChevronRight
} from 'lucide-react';
import { Position, PriceAlertSettings, TriggeredPriceAlert } from '../types';
import { EGXScheduleStatus } from '../services/marketPriceSync';
import { StockLogo } from './StockLogo';

interface PriceAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  positions: Position[];
  settings: PriceAlertSettings;
  onUpdateSettings: (newSettings: Partial<PriceAlertSettings>) => void;
  alertHistory: TriggeredPriceAlert[];
  onClearHistory: () => void;
  onMarkAllRead: () => void;
  permission: NotificationPermission;
  onRequestPermission: () => Promise<NotificationPermission>;
  onSendTestNotification: () => Promise<boolean>;
  scheduleStatus: EGXScheduleStatus;
  onEditPosition?: (position: Position) => void;
}

export const PriceAlertsModal: React.FC<PriceAlertsModalProps> = ({
  isOpen,
  onClose,
  positions,
  settings,
  onUpdateSettings,
  alertHistory,
  onClearHistory,
  onMarkAllRead,
  permission,
  onRequestPermission,
  onSendTestNotification,
  scheduleStatus,
  onEditPosition,
}) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'watches' | 'history'>('watches');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  if (!isOpen) return null;

  // Positions with defined Targets or Stop-Losses
  const positionsWithTargets = positions.filter(p => (p.targetPrice && p.targetPrice > 0) || (p.stopLoss && p.stopLoss > 0));

  const handleTestNotification = async () => {
    setIsSendingTest(true);
    setTestResult(null);
    try {
      const success = await onSendTestNotification();
      if (success) {
        setTestResult('Test notification sent successfully!');
      } else {
        setTestResult('Could not trigger notification. Ensure browser permission is granted.');
      }
    } catch {
      setTestResult('Notification test failed.');
    } finally {
      setIsSendingTest(false);
      setTimeout(() => setTestResult(null), 4000);
    }
  };

  const formatEgp = (n?: number) =>
    n !== undefined ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

  return (
    <div className="premium-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="premium-modal rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Price Target &amp; Push Alerts
                {permission === 'granted' && settings.enabled && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Active
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                PWA Service Worker notifications for targets &amp; stop-loss breaches
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="premium-icon-action p-1.5 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Permission Banner */}
        <div className="px-5 py-3 bg-slate-950/70 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 text-xs">
            {permission === 'granted' ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                Browser Push Notifications Enabled
              </span>
            ) : permission === 'denied' ? (
              <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                Notifications Blocked in Browser Settings
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <BellOff className="w-4 h-4 text-amber-400 shrink-0" />
                Permission Required for Background Push
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {permission !== 'granted' && (
              <button
                onClick={onRequestPermission}
                className="premium-action premium-action-success px-3 py-1.5 rounded-lg text-xs font-bold"
              >
                Enable Notifications
              </button>
            )}
            <button
              onClick={handleTestNotification}
              disabled={isSendingTest}
              className="premium-action px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5 text-blue-400" />
              <span>{isSendingTest ? 'Sending...' : 'Test Notification'}</span>
            </button>
          </div>
        </div>

        {testResult && (
          <div className="px-5 py-2 bg-blue-950/60 border-b border-blue-500/30 text-xs font-medium text-blue-200 flex items-center gap-2 animate-in fade-in">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span>{testResult}</span>
          </div>
        )}

        {/* Cairo Trading Hours Banner */}
        <div className="px-5 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Cairo Market Session:</span>
            <span className={`font-semibold px-1.5 py-0.5 rounded text-[10px] ${
              scheduleStatus.isSessionActive
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}>
              {scheduleStatus.isSessionActive ? 'OPEN' : 'CLOSED'}
            </span>
          </div>
          <span className="font-mono text-slate-300">
            {scheduleStatus.cairoTimeString} Cairo
          </span>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-5 pt-2">
          <button
            onClick={() => setActiveTab('watches')}
            className={`premium-filter-pill pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 rounded-t-lg ${
              activeTab === 'watches'
                ? 'border-amber-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Active Targets &amp; Stops ({positionsWithTargets.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`premium-filter-pill pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 rounded-t-lg ${
              activeTab === 'settings'
                ? 'border-amber-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            Alert Settings
          </button>
          <button
            onClick={() => {
              setActiveTab('history');
              onMarkAllRead();
            }}
            className={`premium-filter-pill pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 rounded-t-lg ${
              activeTab === 'history'
                ? 'border-amber-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Alert Log ({alertHistory.length})
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
          
          {/* TAB 1: WATCHES */}
          {activeTab === 'watches' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Holdings with Target Price or Stop-Loss boundaries</span>
                <span className="font-medium text-slate-300">
                  {positionsWithTargets.length} Monitored
                </span>
              </div>

              {positionsWithTargets.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-950/50 border border-slate-800 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                    <BellOff className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-slate-300">No Target Prices or Stop-Losses Set</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Edit your open positions in the portfolio table and specify a Target Price or Stop-Loss to enable automated alerts.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {positionsWithTargets.map(pos => {
                    const current = pos.currentPrice || 0;
                    const target = pos.targetPrice || 0;
                    const stop = pos.stopLoss || 0;

                    const isTargetHit = target > 0 && current >= target;
                    const isStopLossHit = stop > 0 && current <= stop;

                    const targetDistancePercent = target > 0 ? ((target - current) / target) * 100 : null;
                    const slDistancePercent = stop > 0 ? ((current - stop) / stop) * 100 : null;

                    return (
                      <div
                        key={pos.id}
                        className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isTargetHit
                            ? 'bg-emerald-950/30 border-emerald-500/50 shadow-sm shadow-emerald-950'
                            : isStopLossHit
                            ? 'bg-rose-950/30 border-rose-500/50 shadow-sm shadow-rose-950'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <StockLogo ticker={pos.ticker} companyName={pos.companyName} size="md" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">{pos.ticker}</span>
                              <span className="text-xs text-slate-400 truncate max-w-[140px] sm:max-w-[180px]">
                                {pos.companyName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs font-mono">
                              <span className="text-slate-300">Current:</span>
                              <span className="font-bold text-white">{formatEgp(current)} EGP</span>
                              <span className="text-slate-500">•</span>
                              <span className="text-slate-400">{pos.shares.toLocaleString()} shs</span>
                            </div>
                          </div>
                        </div>

                        {/* Boundaries & Status */}
                        <div className="flex items-center gap-3 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                          <div className="flex items-center gap-2">
                            {target > 0 && (
                              <div className="text-right text-[11px] font-mono">
                                <div className="text-emerald-400 font-semibold flex items-center justify-end gap-1">
                                  <span>🎯 {formatEgp(target)}</span>
                                </div>
                                <div className={`text-[10px] ${targetDistancePercent !== null && targetDistancePercent <= 0 ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}>
                                  {targetDistancePercent !== null && targetDistancePercent <= 0
                                    ? 'TARGET HIT'
                                    : `${targetDistancePercent?.toFixed(1)}% away`}
                                </div>
                              </div>
                            )}

                            {stop > 0 && (
                              <div className="text-right text-[11px] font-mono border-l border-slate-800 pl-2">
                                <div className="text-rose-400 font-semibold flex items-center justify-end gap-1">
                                  <span>🛑 {formatEgp(stop)}</span>
                                </div>
                                <div className={`text-[10px] ${slDistancePercent !== null && slDistancePercent <= 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                                  {slDistancePercent !== null && slDistancePercent <= 0
                                    ? 'SL BREACHED'
                                    : `${slDistancePercent?.toFixed(1)}% away`}
                                </div>
                              </div>
                            )}
                          </div>

                          {onEditPosition && (
                            <button
                              onClick={() => {
                                onEditPosition(pos);
                                onClose();
                              }}
                              className="premium-icon-action premium-icon-edit p-1.5 rounded-lg"
                              title="Edit Target / Stop Loss"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              
              {/* Master Toggle */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-400" />
                    Enable Price Target &amp; Push Alerts
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Allow the app to track and dispatch price threshold alerts
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enabled}
                    onChange={(e) => onUpdateSettings({ enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Notification Types */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Notification Triggers
                </h4>

                {/* Target Price Hit */}
                <div className="flex items-center justify-between py-1">
                  <div>
                    <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Target Price Touched / Reached
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Notify immediately when current market price is at or above profit target
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifyOnTarget}
                    onChange={(e) => onUpdateSettings({ notifyOnTarget: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-500 bg-slate-800 border-slate-700 focus:ring-emerald-500"
                  />
                </div>

                {/* Stop Loss Hit */}
                <div className="flex items-center justify-between py-1 border-t border-slate-800/80">
                  <div>
                    <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-400" />
                      Stop-Loss Boundary Breached
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Notify immediately when current market price drops at or below stop-loss
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifyOnStopLoss}
                    onChange={(e) => onUpdateSettings({ notifyOnStopLoss: e.target.checked })}
                    className="w-4 h-4 rounded text-rose-500 bg-slate-800 border-slate-700 focus:ring-rose-500"
                  />
                </div>

                {/* Proximity Warning */}
                <div className="py-1 border-t border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        Proximity Warning (Approaching Target / Stop)
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Pre-alert when price is approaching within a custom % of the target/stop
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notifyOnProximity}
                      onChange={(e) => onUpdateSettings({ notifyOnProximity: e.target.checked })}
                      className="w-4 h-4 rounded text-amber-500 bg-slate-800 border-slate-700 focus:ring-amber-500"
                    />
                  </div>

                  {settings.notifyOnProximity && (
                    <div className="flex items-center gap-3 pt-1">
                      <input
                        type="range"
                        min="0.5"
                        max="5.0"
                        step="0.5"
                        value={settings.proximityPercent}
                        onChange={(e) => onUpdateSettings({ proximityPercent: parseFloat(e.target.value) })}
                        className="flex-1 accent-amber-500"
                      />
                      <span className="text-xs font-bold font-mono text-amber-300 w-12 text-right">
                        {settings.proximityPercent}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Delivery Rules */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Delivery &amp; Schedule Rules
                </h4>

                {/* Cairo Market Hours Only */}
                <div className="flex items-center justify-between py-1">
                  <div>
                    <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      Alert Only During Cairo Market Hours
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Restrict alerts to Sunday–Thursday regular trading hours (10:00 AM – 02:30 PM Cairo time)
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.cairoHoursOnly}
                    onChange={(e) => onUpdateSettings({ cairoHoursOnly: e.target.checked })}
                    className="w-4 h-4 rounded text-cyan-500 bg-slate-800 border-slate-700 focus:ring-cyan-500"
                  />
                </div>

                {/* Sound Chimes */}
                <div className="flex items-center justify-between py-1 border-t border-slate-800/80">
                  <div>
                    <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      {settings.soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
                      Audio Chimes (Web Audio Synthesizer)
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Play pleasant ascending chimes on target hits and warning tones on stop-loss breaches
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.soundEnabled}
                    onChange={(e) => onUpdateSettings({ soundEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-500 bg-slate-800 border-slate-700 focus:ring-emerald-500"
                  />
                </div>

                {/* Vibration */}
                <div className="flex items-center justify-between py-1 border-t border-slate-800/80">
                  <div>
                    <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-purple-400" />
                      Device Vibration
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Vibrate mobile devices on push notification arrival
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.vibrateEnabled}
                    onChange={(e) => onUpdateSettings({ vibrateEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-purple-500 bg-slate-800 border-slate-700 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ALERT HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Recent price threshold events
                </span>
                {alertHistory.length > 0 && (
                  <button
                    onClick={onClearHistory}
                    className="premium-action premium-action-danger px-2 py-1 rounded-lg text-xs flex items-center gap-1 font-semibold"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear Log
                  </button>
                )}
              </div>

              {alertHistory.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-950/50 border border-slate-800 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-slate-300">No Triggered Alerts Yet</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    When live prices cross your defined targets or stop losses during trading sessions, they will be logged here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alertHistory.map((alert) => {
                    const isTarget = alert.type === 'TARGET_HIT' || alert.type === 'TARGET_APPROACHING';
                    return (
                      <div
                        key={alert.id}
                        className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                          isTarget
                            ? 'bg-emerald-950/20 border-emerald-500/30'
                            : 'bg-rose-950/20 border-rose-500/30'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isTarget ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">{alert.ticker}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                alert.type === 'TARGET_HIT'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : alert.type === 'STOP_LOSS_HIT'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}>
                                {alert.type.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-slate-400 text-[11px] mt-0.5">
                              Price: <span className="font-mono text-white font-bold">{formatEgp(alert.currentPrice)} EGP</span> (Threshold: {formatEgp(alert.thresholdPrice)} EGP)
                            </p>
                          </div>
                        </div>

                        <div className="text-right text-[11px] text-slate-500 font-mono shrink-0">
                          {alert.timeFormatted}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Service Worker Auto-Sync</span>
          </div>
          <button
            onClick={onClose}
            className="premium-action px-4 py-1.5 rounded-lg font-semibold"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
