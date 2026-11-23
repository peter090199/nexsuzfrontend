import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DeleteUserDialogComponent } from './delete-user-dialog.component';
import { UsersUIComponent } from 'src/app/ComponentSharedUI/system/users-ui/users-ui.component';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { UserServicesService } from 'src/app/services/MasterAdmin/user-services.service';
import { SharedRoutinesService } from 'src/app/services/Function/shared-routines.service';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css']
})
export class UsersComponent implements OnInit, AfterViewInit {
  searchKey: string = '';
  placeHolder: string = 'Search';

  displayedColumns: string[] = [
    'id', 'photo', 'fullname', 'email', 'contactno', 'company', 'status', 'is_online', 'role_code', 'actions'
  ];
  dataSource = new MatTableDataSource<any>([]);
  isLoading = false;

  selectedRole: string = ''; // store selected role
  roleCodes: string[] = ['DEF-MASTERADMIN', 'DEF-ADMIN', 'DEF-USERS', 'DEF-CLIENT'];
  selectedStatus: string = '';   // '' = all, 'A' = active, 'I' = inactive

  /** photos that failed to load fall back to initials */
  brokenPhotos: Record<string, boolean> = {};
  /** account being activated / deactivated right now */
  busyCode: number | string | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private userServices: UserServicesService,
    private notificationsService: NotificationsService,
    public dialog: MatDialog,
    private router: Router,
    private sharedRoutines: SharedRoutinesService
  ) { }

  /** only a master admin sees Activate / Deactivate (the API checks the role as well) */
  get canManage(): boolean {
    return this.sharedRoutines.getisMasterAdmin();
  }

  isSelf(user: any): boolean {
    return String(user?.code) === String(sessionStorage.getItem('code'));
  }

  /** Why this row's Delete button is off (the API enforces the same rules), or '' when it is allowed. */
  deleteBlockedReason(user: any): string {
    if (this.isSelf(user)) { return "You can't delete your own account"; }
    if (user?.role_code === 'DEF-ADMIN' || user?.role_code === 'DEF-MASTERADMIN') { return "Admin accounts can't be deleted here"; }
    return '';
  }

  /** Delete an account and everything it created. The dialog previews it and asks for the email + your password. */
  deleteUser(user: any): void {
    if (this.deleteBlockedReason(user)) { return; }
    this.dialog.open(DeleteUserDialogComponent, { width: '520px', maxWidth: '95vw', disableClose: true, autoFocus: false, data: { user } })
      .afterClosed().subscribe(deleted => {
        if (!deleted) { return; }
        this.dataSource.data = this.dataSource.data.filter(u => String(u.code) !== String(user.code));   // gone from the table at once
        this.notificationsService.toastrSuccess(`${user.fullname} and their data were deleted.`);
      });
  }

  initialsOf(name: string): string {
    return this.sharedRoutines.getInitials(name || '');
  }

  /** Clicking a photo opens that person's profile (people and company/admin accounts have different profile pages) */
  openProfile(user: any): void {
    const role = this.sharedRoutines.getRole();
    const page = user.role_code === 'DEF-USERS' ? 'profile' : 'client_profile';
    this.router.navigate(['/' + role, page, user.code]);
  }

  /** Deactivate or activate an account, after confirmation; the row updates in place */
  toggleStatus(user: any): void {
    if (this.busyCode !== null) { return; }
    const deactivating = user.status === 'A';
    const next: 'A' | 'I' = deactivating ? 'I' : 'A';

    this.notificationsService.popupWarning(
      `${deactivating ? 'Deactivate' : 'Activate'} ${user.fullname}?`,
      deactivating
        ? 'They will be signed out right away and will not be able to sign in until you activate them again. Nothing is deleted.'
        : 'They will be able to sign in again.'
    ).then(result => {
      if (!result.isConfirmed) { return; }

      this.busyCode = user.code;
      this.userServices.setUserStatus(user.code, next).subscribe({
        next: (res: any) => {
          this.busyCode = null;
          if (res?.success) {
            user.status = next;
            if (next === 'I') { user.is_online = 0; }
            this.dataSource.data = [...this.dataSource.data];   // refresh the table at once
            this.applyFilter();
            this.notificationsService.toastrSuccess(res.message);
          } else {
            this.notificationsService.toastrError(res?.message || 'Could not update this account.');
          }
        },
        error: (err) => {
          this.busyCode = null;
          this.notificationsService.toastrError(err?.error?.message || 'Could not update this account.');
        }
      });
    });
  }

  ngOnInit(): void {
    this.getUsers();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;

    // Custom filter predicate for search + role
    this.dataSource.filterPredicate = (data: any, filter: string) => {
      const { search, role, status } = JSON.parse(filter);
      const has = (v: any) => String(v ?? '').toLowerCase().includes(search);

      const matchesSearch = has(data.fullname) || has(data.email) || has(data.contactno) || has(data.company);
      const matchesRole = role ? data.role_code === role : true;
      const matchesStatus = status ? data.status === status : true;

      return matchesSearch && matchesRole && matchesStatus;
    };
  }

  applyFilter(): void {
    const filterValue = JSON.stringify({
      search: this.searchKey.trim().toLowerCase(),
      role: this.selectedRole,
      status: this.selectedStatus
    });

    this.dataSource.filter = filterValue;

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  clearSearch(): void {
    this.searchKey = '';
    this.selectedRole = '';
    this.selectedStatus = '';
    this.applyFilter();
  }

  /** Fetch users from API */
  async getUsers(): Promise<void> {
    try {
      this.isLoading = true;
      const res = await firstValueFrom(this.userServices.getUsers());

      if (res.success) {
        this.dataSource.data = res.data;
        this.applyFilter(); // Apply filter after data load
      } else {
        this.notificationsService.toastrError(res.message || 'Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      this.notificationsService.toastrError('Something went wrong while fetching users');
    } finally {
      this.isLoading = false;
    }
  }

  /** Open dialog to create/edit user */
  newSubmodule(): void {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;
    dialogConfig.width = '600px';
    dialogConfig.data = {}; // pass any initial data if needed

    const dialogRef = this.dialog.open(UsersUIComponent, dialogConfig);

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.getUsers(); // Refresh table after dialog closes
      }
    });
  }

  /** Edit user */
  editUser(user: any): void {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;
    dialogConfig.width = '600px';
    dialogConfig.data = { user }; // pass selected user to dialog

    const dialogRef = this.dialog.open(UsersUIComponent, dialogConfig);

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.getUsers(); // Refresh table after edit
      }
    });
  }

  /** Refresh table */
  viewUsers(): void {
    this.getUsers();
  }
}
