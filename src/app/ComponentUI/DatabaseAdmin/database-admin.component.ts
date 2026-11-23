import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { ResetDataDialogComponent } from './reset-data-dialog.component';
import { Backup, DatabaseAdminService, DbTable, MaintResult, ServerInfo, StorageInfo } from './database-admin.service';

type Tab = 'backup' | 'server' | 'storage' | 'operations';

@Component({
  selector: 'app-database-admin',
  templateUrl: './database-admin.component.html',
  styleUrls: ['./database-admin.component.scss']
})
export class DatabaseAdminComponent implements OnInit {
  readonly tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'backup', label: 'Database backup', icon: 'backup' },
    { id: 'server', label: 'Server management', icon: 'dns' },
    { id: 'storage', label: 'Storage management', icon: 'sd_storage' },
    { id: 'operations', label: 'Database operations', icon: 'build_circle' },
  ];
  index = 0;

  backups: Backup[] = [];
  serverInfo?: ServerInfo;
  storageInfo?: StorageInfo;
  tables: DbTable[] = [];

  loading: { [k in Tab]: boolean } = { backup: false, server: false, storage: false, operations: false };
  error: { [k in Tab]: string } = { backup: '', server: '', storage: '', operations: '' };
  private loaded: { [k in Tab]: boolean } = { backup: false, server: false, storage: false, operations: false };

  creating = false;
  downloading = '';
  running = false;
  selected = new Set<string>();
  search = '';
  results: MaintResult[] = [];
  resultTitle = '';

  constructor(private api: DatabaseAdminService, private snack: MatSnackBar, private notify: NotificationsService, private dialog: MatDialog) { }

  ngOnInit(): void { this.open(0); }

  /** Each tab loads its own data the first time it is opened. */
  open(i: number): void {
    this.index = i;
    const id = this.tabs[i].id;
    if (!this.loaded[id]) { this.load(id); }
  }

  load(id: Tab): void {
    this.loading[id] = true; this.error[id] = '';
    const done = () => { this.loading[id] = false; this.loaded[id] = true; };
    const fail = (e: any) => { this.loading[id] = false; this.error[id] = DatabaseAdminService.errorMessage(e, 'Could not load this section.'); };
    switch (id) {
      case 'backup': this.api.backups().subscribe({ next: b => { this.backups = b; done(); }, error: fail }); break;
      case 'server': this.api.server().subscribe({ next: s => { this.serverInfo = s; done(); }, error: fail }); break;
      case 'storage': this.api.storage().subscribe({ next: s => { this.storageInfo = s; done(); }, error: fail }); break;
      case 'operations': this.api.tables().subscribe({ next: t => { this.tables = t; this.selected.clear(); done(); }, error: fail }); break;
    }
  }

  // ------------------------------------------------------------------- helpers
  fmt(bytes: number): string {
    if (!bytes) { return '0 B'; }
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(u.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
  }
  uptime(sec: number): string {
    const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
    return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
  }
  extensions(): { name: string; ok: boolean }[] {
    return Object.entries(this.serverInfo?.server.extensions || {}).map(([name, ok]) => ({ name, ok }));
  }
  get riskyDebug(): boolean { return !!this.serverInfo && this.serverInfo.app.debug && this.serverInfo.app.environment === 'production'; }
  get backupBytes(): number { return this.backups.reduce((n, b) => n + b.bytes, 0); }
  barPct(bytes: number): number {
    const max = Math.max(1, ...(this.storageInfo?.folders || []).map(f => f.bytes));
    return Math.max(2, Math.round((bytes / max) * 100));
  }

  // -------------------------------------------------------------------- backup
  createBackup(): void {
    this.creating = true;
    this.api.createBackup().subscribe({
      next: b => {
        this.creating = false;
        this.backups = [b, ...this.backups];
        this.snack.open('Backup created', 'OK', { duration: 2500 });
      },
      error: e => { this.creating = false; this.snack.open(DatabaseAdminService.errorMessage(e, 'The backup could not be created.'), 'OK', { duration: 5000 }); },
    });
  }

  download(b: Backup): void {
    this.downloading = b.name;
    this.api.downloadBackup(b.name).subscribe({
      next: blob => {
        this.downloading = '';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = b.name; a.click();
        URL.revokeObjectURL(url);
      },
      error: e => { this.downloading = ''; this.snack.open(DatabaseAdminService.errorMessage(e, 'Download failed.'), 'OK', { duration: 4000 }); },
    });
  }

  // ---------------------------------------------------------------- reset
  openReset(): void {
    this.dialog.open(ResetDataDialogComponent, { width: '560px', maxWidth: '95vw', disableClose: true, autoFocus: false })
      .afterClosed().subscribe(done => {
        if (!done) { return; }
        // the data changed under every tab, so reload whichever are visible next
        (Object.keys(this.loaded) as Tab[]).forEach(k => this.loaded[k] = false);
        this.load(this.tabs[this.index].id);
      });
  }

  // ---------------------------------------------------------------- operations
  get filtered(): DbTable[] {
    const q = this.search.trim().toLowerCase();
    return this.tables.filter(t => !q || t.name.toLowerCase().includes(q));
  }
  get reclaimable(): number { return this.tables.reduce((n, t) => n + t.free_bytes, 0); }
  get totalBytes(): number { return this.tables.reduce((n, t) => n + t.total_bytes, 0); }
  get allSelected(): boolean { return !!this.filtered.length && this.filtered.every(t => this.selected.has(t.name)); }

  toggle(name: string, on: boolean): void { on ? this.selected.add(name) : this.selected.delete(name); }
  toggleAll(on: boolean): void { this.filtered.forEach(t => this.toggle(t.name, on)); }
  selectReclaimable(): void { this.selected.clear(); this.tables.filter(t => t.free_bytes > 0).forEach(t => this.selected.add(t.name)); }

  run(action: 'optimize' | 'analyze', only?: string): void {
    const names = only ? [only] : Array.from(this.selected);
    if (!names.length) { return; }
    const label = action === 'optimize' ? 'Optimize' : 'Analyze';
    const detail = action === 'optimize'
      ? 'Rebuilds the table to reclaim space. The table may be briefly locked, so do it during a quiet period. No data is removed.'
      : 'Refreshes index statistics only. No data is changed.';
    this.notify.popupWarning(`${label} ${names.length} table${names.length === 1 ? '' : 's'}?`, detail).then((r: any) => {
      if (!r.isConfirmed) { return; }
      this.running = true;
      this.api.maintain(action, names).subscribe({
        next: res => {
          this.running = false;
          this.results = res.data; this.resultTitle = res.message;
          this.snack.open(res.message, 'OK', { duration: 3000 });
          this.load('operations');
        },
        error: e => { this.running = false; this.snack.open(DatabaseAdminService.errorMessage(e), 'OK', { duration: 5000 }); },
      });
    });
  }
}
