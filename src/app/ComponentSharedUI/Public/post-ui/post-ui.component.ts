// // import { Component, OnInit } from '@angular/core';
// // import { MatDialog, MatDialogRef, MatDialogConfig } from '@angular/material/dialog';
// // import { ProfileService } from 'src/app/services/Profile/profile.service';
// // import { PostUploadImageComponent } from '../post-upload-image/post-upload-image.component';
// // import { PostUploadImagesService } from 'src/app/services/post-upload-images.service';
// // import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
// // import { HttpClient } from '@angular/common/http';  // Import HttpClient

// // @Component({
// //   selector: 'app-post-ui',
// //   templateUrl: './post-ui.component.html',
// //   styleUrls: ['./post-ui.component.css']
// // })
// // export class PostUIComponent implements OnInit {
// //   postForm!: FormGroup;
// //   profiles: any = [];
// //   error: any;
// //   selectedFiles: File[] = [];
// //   uploadedImages: File[] = []; 

// //   statusOptions = [
// //     { label: 'Public', value: 1 },
// //     { label: 'Private', value: 0 }
// //   ];

// //   constructor(
// //     public dialogRef: MatDialogRef<PostUIComponent>,
// //     private profile: ProfileService,
// //     public dialog: MatDialog,
// //     private imageUploadService: PostUploadImagesService,
// //     private fb: FormBuilder,
// //     private http: HttpClient  // Inject HttpClient
// //   ) {}

// //   ngOnInit(): void {
// //     this.postForm = this.fb.group({
// //       caption: new FormControl(''),
// //       status: new FormControl(1),
// //       post:this.uploadedImages
// //     });

// //     const url = window.location.href;

// //     this.imageUploadService.images$.subscribe((formData: FormData | null) => {
// //       if (formData) {
// //         this.uploadedImages = [];
// //         formData.forEach((file) => {
// //           if (file instanceof File) {
// //             this.uploadedImages.push(file);
// //           }
// //         });
// //         console.log('Received images in Post UI:', this.uploadedImages);
// //       }
// //     });


// //   }

// //   postDataxxxx() {
// //   if (this.postForm.valid && this.selectedFiles.length > 0) {
// //     const formData = new FormData();

// //     // Append files to FormData
// //     this.selectedFiles.forEach((file: File) => {
// //       formData.append('files[]', file, file.name);
// //     });

// //     // Append form data to FormData
// //     formData.append('caption', this.postForm.value.caption);
// //     formData.append('status', this.postForm.value.status.toString()); // Ensure it's a string
// //     formData.append('posts', JSON.stringify(this.uploadedImages)); // Append posts (e.g., image URLs)

// //     // Log formData
// //     for (let pair of (formData as any).entries()) {  // Cast formData to any to allow entries() method
// //       console.log(pair[0] + ": " + pair[1]); // Log key-value pairs
// //     }
// //     // Optionally, you can return here for testing
// //     return;  // Prevent actual HTTP request for now
// //   } else {
// //     console.error('Form is invalid or no files selected');
// //   }
// // }

// // postData() {
// //   if (this.postForm.valid) {
// //     const formData = new FormData();

// //     // Append files to FormData
// //     this.uploadedImages.forEach((file: File) => {
// //       formData.append('files[]', file, file.name);
// //     });

// //     // Append form data (caption and status)
// //     formData.append('caption', this.postForm.value.caption);
// //     formData.append('status', this.postForm.value.status.toString()); // Ensure it's a string
// //     // formData.append('posts', this.uploadedImages); // Append posts (e.g., image URLs)

// //     for (let pair of (formData as any).entries()) {  // Cast formData to any to allow entries() method
// //       console.log(pair[0] + ": " + pair[1]); // Log key-value pairs
// //     }


// //     // Now make the HTTP request (uncomment to enable)
// //     // this.http.post('https://your-laravel-api.com/api/posts', formData).subscribe({
// //     //   next: (response) => {
// //     //     console.log('Post saved successfully:', response);
// //     //     this.dialogRef.close(); // Close dialog on success
// //     //   },
// //     //   error: (error) => {
// //     //     console.error('Error saving post:', error); // Handle errors
// //     //   }
// //     // });
// //   } else {
// //     console.error('Form is invalid or no files selected');
// //   }
// // }


// //   postDataxxx() {
// //     if (this.postForm.valid) { // Make sure selectedFiles is not empty
// //       const formData = new FormData();

// //       // // Append files to FormData
// //       // this.selectedFiles.forEach((file: File) => {
// //       //   formData.append('files[]', file, file.name); // Ensure you append the file and its name
// //       // });

// //       formData.append('caption', this.postForm.value.caption);
// //       formData.append('status', this.postForm.value.status.toString()); // Ensure it's a string
// //       formData.append('posts', JSON.stringify(this.uploadedImages)); 
// //       console.log(formData)


// //       return;

// //       // Send POST request to the Laravel backend
// //       this.http.post('https://your-laravel-api.com/api/posts', formData).subscribe({
// //         next: (response) => {
// //           console.log('Post saved successfully:', response);
// //           this.dialogRef.close();
// //         },
// //         error: (error) => {
// //           console.error('Error saving post:', error);
// //         }
// //       });
// //     } else {
// //       console.error('Form is invalid or no files selected');
// //     }
// //   }


// //   postDataxx() {
// //     if (!this.postForm.valid) return;

// //     const formData = new FormData();
// //     this.uploadedImages.forEach((file) => {
// //       formData.append('files[]', file);
// //     });

// //     formData.append('caption', this.postForm.value.caption);
// //     formData.append('status', this.postForm.value.status);


// //     // Send FormData to Laravel
// //     this.http.post('http://your-laravel-api.com/api/posts', formData).subscribe({
// //       next: (response) => {
// //         console.log('Post successful:', response);
// //         this.dialogRef.close(response); // Close dialog and return response
// //       },
// //       error: (error) => {
// //         console.error('Error posting:', error);
// //         this.error = error.message || 'Failed to post data';
// //       }
// //     });
// //   }

// //   closeDialog() {
// //     this.dialogRef.close();
// //   }

// //   // loadProfileCV(){
// //   //       this.profile.getProfileByUser(this.code).subscribe({
// //   //         next: (response) => {
// //   //           if (response.success == true) {
// //   //             this.profiles = response.message; 

// //   //           } else {
// //   //             this.error = 'Failed to load profile data';
// //   //           }
// //   //         },
// //   //         error: (err) => {
// //   //           this.error = err.message || 'An error occurred while fetching profile data';
// //   //         },
// //   //       });
// //   //     }

// //   uploadImage() {
// //     const dialogConfig = new MatDialogConfig();
// //     dialogConfig.disableClose = true;
// //     dialogConfig.autoFocus = true;
// //     const dialogRef = this.dialog.open(PostUploadImageComponent, dialogConfig);

// //     dialogRef.afterClosed().subscribe((images: File[] | undefined) => {
// //       if (images) {
// //         this.uploadedImages = images;
// //         console.log('Received images from dialog:', images);
// //       }
// //     });
// //   }

// //   uploadVideo() {
// //     console.log('Video upload clicked');
// //   }
// // }


// import { Component, Inject, OnInit } from '@angular/core';
// import { MatDialog, MatDialogRef, MatDialogConfig, MAT_DIALOG_DATA } from '@angular/material/dialog';
// import { ProfileService } from 'src/app/services/Profile/profile.service';
// import { PostUploadImageComponent } from '../post-upload-image/post-upload-image.component';
// import { PostUploadImagesService } from 'src/app/services/post-upload-images.service';
// import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
// import { HttpClient } from '@angular/common/http';  // Import HttpClient
// import { NotificationsService } from 'src/app/services/Global/notifications.service';

// import { DomSanitizer, SafeUrl } from '@angular/platform-browser';




// @Component({
//   selector: 'app-post-ui',
//   templateUrl: './post-ui.component.html',
//   styleUrls: ['./post-ui.component.css']
// })
// export class PostUIComponent implements OnInit {
//   postForm!: FormGroup;
//   profiles: any;
//   error: any;
//   selectedFiles: File[] = [];
//   uploadedImages: File[] = [];  // This will hold the selected images
//   btnSave: string = "Post";
//   profiles2: any = []
//   statusOptions = [
//     { label: 'Public', value: 1 },
//     { label: 'Private', value: 0 }
//   ];

//   constructor(
//     public dialogRef: MatDialogRef<PostUIComponent>,
//     private profile: ProfileService,
//     public dialog: MatDialog,
//     private imageUploadService: PostUploadImagesService,
//     private fb: FormBuilder,
//     private http: HttpClient,
//     private alert: NotificationsService,
//     private authService: ProfileService, private sanitizer: DomSanitizer,
//     @Inject(MAT_DIALOG_DATA) public data: any,
//   ) {
//     if (this.data?.id) {
//       this.btnSave = "Update Post";
//       this.fillFormData();
//       console.log(this.data)
//     }
//     else {
//       this.btnSave = "Post";
//     }

//   }

//   imagePreviewUrl: any = null;
//   fillFormData() {
//     if (!this.postForm) return; // Safety guard in case of timing issues

//     this.postForm.patchValue({
//       status: this.data?.status || '',
//       caption: this.data?.caption || '',
//       image: this.data?.image || '',
//       video: this.data?.video || ''
//     });

//     // Optional: Preview setup
//     if (this.data?.video) {
//       this.videoPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.data.video);
//     }

//     if (this.data?.image) {
//       this.imagePreviewUrl = this.data.image;
//     }
//   }


//   ngOnInit(): void {
//     this.loadUserProfile();
//     this.loadUser();
//     this.postForm = this.fb.group({
//       caption: ['', Validators.required],
//       status: ['', Validators.required] // Corrected here
//     });


//     // Subscribe to the image upload service to update uploaded images
//     this.imageUploadService.images$.subscribe((formData: FormData | null) => {
//       if (formData) {
//         this.uploadedImages = []; // Clear existing images
//         formData.forEach((file) => {
//           if (file instanceof File) {
//             this.uploadedImages.push(file);  // Add valid file to uploadedImages
//           }
//         });
//         console.log('Received images in Post UI:', this.uploadedImages);
//       }
//     });
//   }

//   getProfileImage(url: string): string {
//     if (!url) {
//       return 'assets/default-profile.png';
//     }

//     // If string contains https, extract it
//     const match = url.match(/https?:\/\/[^\s]+/);
//     return match ? match[0] : url;
//   }


//   getSelectedStatus() {
//     return this.statusOptions.find(option => option.value === this.postForm.get('status')?.value)?.label;
//   }

//   loadUserProfile(): void {
//     this.authService.getProfileByUserOnly().subscribe({
//       next: (res) => {
//         if (res.success == true) {
//           this.profiles2 = res.message;
//         } else {
//           console.error('⚠️ Failed to load user profile:', res.message);
//         }
//       },
//       error: (err) => {
//         console.error('❌ Error fetching user data:', err);
//       },
//     });
//   }

//   loadUser() {
//     this.authService.getProfileByBasicInfo().subscribe({
//       next: (res) => {
//         this.profiles = res.data;

//       },
//       error: (err) => {
//         console.error('❌ Error fetching user data:', err);
//       },
//     });
//   }

//   isUploading: boolean = false;
//   uploadProgress: number = 0;
//   postData() {
//     if (this.postForm.valid) {
//       this.isUploading = true; // show progress bar

//       const formData = new FormData();
//       formData.append('caption', this.postForm.value.caption);
//       formData.append('status', this.postForm.value.status.toString());

//       for (let file of this.uploadedImages) {
//         formData.append('posts[]', file);
//       }

//       if (this.selectedVideoFile) {
//         formData.append('video', this.selectedVideoFile);
//       }

//       this.imageUploadService.uploadImages(formData).subscribe({
//         next: (res) => {
//           this.isUploading = false; // hide progress bar
//           if (res.success == true) {
//             this.alert.toastrSuccess(res.message);
//             this.resetForm();
//           }
//         },
//         error: (error) => {
//           this.isUploading = false; // hide progress bar
//           console.error('Upload failed:', error);
//           this.alert.toastrWarning(error.error?.message || "Upload failed. Please try again.");
//         }
//       });
//     }
//   }

//   postDataxx() {
//     if (this.postForm.valid) {
//       this.isUploading = true;
//       this.uploadProgress = 0;

//       const formData = new FormData();
//       formData.append('caption', this.postForm.value.caption);
//       formData.append('status', this.postForm.value.status.toString());

//       for (let file of this.uploadedImages) {
//         formData.append('posts[]', file);
//       }

//       // Append video (if any)
//       if (this.selectedVideoFile) {
//         formData.append('video', this.selectedVideoFile);
//       }

//       this.imageUploadService.uploadImages(formData).subscribe({
//         next: (res) => {
//           if (res.success == true) {
//             this.isUploading = false;
//             this.alert.toastrSuccess(res.message);
//             this.resetForm();
//           }

//         },
//         error: (error) => {
//           console.error('Upload failed:', error);
//           this.alert.toastrWarning(error.error?.message || "Upload failed. Please try again.");
//           //this.isUploading = false;
//         }
//       });

//     }
//   }

//   resetForm() {
//     this.uploadedImages = [];
//     this.postForm.reset();
//     this.imageUploadService.clearImages();
//     this.selectedVideoFile = null;
//     this.videoPreviewUrl = null;
//   }

//   // Upload image function
//   uploadImage() {
//     const dialogConfig = new MatDialogConfig();
//     dialogConfig.disableClose = true;
//     dialogConfig.autoFocus = true;
//     dialogConfig.width = '700px';
//     const dialogRef = this.dialog.open(PostUploadImageComponent, dialogConfig);
//     dialogRef.afterClosed().subscribe(() => {
//       // this.closeDialog()
//     });


//     // After image upload dialog closes, update the uploaded images
//     // dialogRef.afterClosed().subscribe((images: File[] | undefined) => {
//     //   if (images) {
//     //     this.uploadedImages = images;  // Update uploaded images
//     //     console.log('Received images from dialog:', images);
//     //   }
//     // });
//   }


//   selectedVideoFile: File | null = null;
//   videoPreviewUrl: SafeUrl | null = null;
//   onVideoSelected(event: Event): void {
//     const input = event.target as HTMLInputElement;
//     const file = input.files && input.files[0] ? input.files[0] : null;

//     if (!file) {
//       this.selectedVideoFile = null;
//       this.videoPreviewUrl = null; // will show static sample
//       return;
//     }

//     // optional basic validations
//     const maxSizeMB = 50;
//     if (file.size > maxSizeMB * 1024 * 1024) {
//       alert(`Video too large. Max ${maxSizeMB}MB.`);
//       input.value = '';
//       return;
//     }
//     if (!file.type.startsWith('video/')) {
//       alert('Please select a valid video file.');
//       input.value = '';
//       return;
//     }

//     this.selectedVideoFile = file;
//     const blobUrl = URL.createObjectURL(file);
//     this.videoPreviewUrl = this.sanitizer.bypassSecurityTrustUrl(blobUrl);
//   }


//   isPlaying = false;
//   videoPaused = true;
//   currentTime = 0;

//   toggleVideo(video: HTMLVideoElement) {
//     if (video.paused) {
//       video.play();
//       this.isPlaying = true;
//       this.videoPaused = false;
//     } else {
//       video.pause();
//       this.isPlaying = false;
//       this.videoPaused = true;
//     }
//   }

//   progressValue = 0;
//   updateProgress(video: HTMLVideoElement) {
//     this.currentTime = video.currentTime;
//     if (video.duration > 0) {
//       this.progressValue = (video.currentTime / video.duration) * 100;
//     }
//   }

//   seekVideo(video: HTMLVideoElement, event: any) {
//     video.currentTime = event.target.value;
//   }

//   formatTime(seconds: number): string {
//     if (!seconds) return '0:00';
//     const mins = Math.floor(seconds / 60);
//     const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
//     return `${mins}:${secs}`;
//   }

//   onPause() {
//     this.isPlaying = false;
//     this.videoPaused = true;
//   }

//   toggleFullscreen(video: HTMLVideoElement) {
//     if (video.requestFullscreen) {
//       video.requestFullscreen();
//     } else if ((video as any).webkitEnterFullscreen) {
//       (video as any).webkitEnterFullscreen(); // Safari
//     }
//   }

//   onPlay() {
//     this.isPlaying = true;
//   }

//   closeDialog() {
//     this.dialogRef.close();  // Close the dialog

//   }
// }


import { Component, HostListener, Inject, OnDestroy, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MatDialogConfig, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ProfileService } from 'src/app/services/Profile/profile.service';
import { POST_PRIVACY, privacyOf } from '../post-privacy';
import { PostUploadImageComponent } from '../post-upload-image/post-upload-image.component';
import { PostUploadImagesService } from 'src/app/services/post-upload-images.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { DomSanitizer, SafeResourceUrl, SafeUrl } from '@angular/platform-browser';
import { ThemePalette } from '@angular/material/core';
import { ProgressSpinnerMode } from '@angular/material/progress-spinner';
import { PostUploadVideosComponent } from '../post-upload-videos/post-upload-videos.component';
import { SightengineWorkflowService } from 'src/app/services/DetectorAI/sightengine-workflow.service';
import { ProfileImageService } from 'src/app/services/Profile/profile-image.service';
import { filter } from 'rxjs/operators';


@Component({
  selector: 'app-post-ui',
  templateUrl: './post-ui.component.html',
  styleUrls: ['./post-ui.component.css']
})
export class PostUIComponent implements OnInit, OnDestroy {
  postForm!: FormGroup;
  profiles: any;
  profiles2: any = [];
  uploadedImages: File[] = [];
  uploadedVideos: File[] = [];
  selectedVideoFile: File | null = null;
  videoPreviewUrl: SafeUrl | null = null;
  imagePreviewUrl: string | null = null;

  // ----- image picker (limits mirror the Laravel validation in PostController) -----
  readonly maxImages = 10;
  readonly maxImageMB = 3;
  readonly allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  lightboxIndex: number | null = null;   // index of the preview shown enlarged
  // "url" is the raw object URL (revoked on remove/destroy); "safe" is what the template binds.
  // Angular rewrites blob: URLs in [src] to "unsafe:blob:..." unless they are marked trusted,
  // which is what broke the image previews. The URL comes from URL.createObjectURL(File), so it is safe.
  previews: { file: File; url: string; safe: SafeUrl }[] = [];
  imageErrors: string[] = [];
  uploadPercent = 0;
  errorMessage = '';

  btnSave: string = "Post";
  private photoSub?: Subscription;

  // ----- edit mode: what the post already has, and what the user detached -----
  existingImages: { posts_uuind: string; path_url: string }[] = [];
  existingVideo: { posts_uuind: string; path_url: string } | null = null;
  existingVideoSafe: SafeResourceUrl | null = null;
  removedAttachmentIds: string[] = [];

  get isEdit(): boolean { return !!this.data?.id; }

  /** Every image currently shown (saved ones first, then newly chosen ones) for the enlarged preview. */
  get gallery(): { name: string; src: any }[] {
    return [
      ...this.existingImages.map((e, i) => ({ name: 'Saved image ' + (i + 1), src: e.path_url })),
      ...this.previews.map(p => ({ name: p.file.name, src: p.safe }))
    ];
  }

  get totalImages(): number { return this.existingImages.length + this.previews.length; }

  get hasMedia(): boolean {
    return this.totalImages > 0 || !!this.selectedVideoFile || (!!this.existingVideo);
  }

  /** A post needs text, or at least one image/video. */
  get canPost(): boolean {
    const text = String(this.postForm?.get('caption')?.value ?? '').trim();
    return (text.length > 0 || this.hasMedia) && !!this.postForm?.get('status')?.valid;
  }
  isUploading: boolean = false;
  progressValue = 0;
  currentTime = 0;
  isPlaying = false;
  videoPaused = true;
  color: ThemePalette = 'primary';
  mode: ProgressSpinnerMode = 'determinate';
  value = 50;

  /** Public / Friends / Private (posts.status 1 / 2 / 0); the server enforces it */
  statusOptions = POST_PRIVACY.map(p => ({ label: p.label, value: p.value }));

  get privacyIcon(): string { return privacyOf(this.postForm?.get('status')?.value).icon; }
  get privacyHint(): string { return privacyOf(this.postForm?.get('status')?.value).hint; }

  constructor(
    public dialogRef: MatDialogRef<PostUIComponent>,
    public dialog: MatDialog,
    private fb: FormBuilder,
    private http: HttpClient,
    private profile: ProfileService,
    private authService: ProfileService,
    private alert: NotificationsService,
    private sanitizer: DomSanitizer,
    private imageUploadService: PostUploadImagesService,
    @Inject(MAT_DIALOG_DATA) public data: any, private sightService: SightengineWorkflowService,
    private profileImages: ProfileImageService
  ) { }

  ngOnInit(): void {
    this.postForm = this.fb.group({
      caption: [''],
      status: ['', Validators.required],
      image: [''],
      video: ['']
    });

    this.photoSub = this.profileImages.photo$.pipe(filter(url => url !== undefined)).subscribe(url => {
      this.profiles = { ...(this.profiles || {}), photo_pic: url };
    });

    this.loadUserProfile();
    this.loadUser();

    // ✅ If editing an existing post
    if (this.data?.id) {
      this.btnSave = "Save changes";
      this.fillFormData();
    }

    // start every composer with a clean image state
    this.imageUploadService.clearImages();
  }

  /** 🔹 Pre-fill data when editing */
  fillFormData() {
    if (!this.data) return;

    this.postForm.patchValue({
      status: this.data.status ?? '',
      caption: this.data.caption ?? '',
    });

    // current images/video: shown in the editor, kept unless the user removes them
    const images = Array.isArray(this.data.images) ? this.data.images : [];
    this.existingImages = images
      .filter((i: any) => i?.posts_uuind && i?.path_url)
      .map((i: any) => ({ posts_uuind: i.posts_uuind, path_url: i.path_url }));

    const video = Array.isArray(this.data.videos) ? this.data.videos[0] : this.data.videos;
    if (video?.posts_uuind && video?.path_url) {
      this.existingVideo = { posts_uuind: video.posts_uuind, path_url: video.path_url };
      this.existingVideoSafe = this.sanitizer.bypassSecurityTrustResourceUrl(video.path_url);
    }
  }

  /** 🔹 Get profile info */
  loadUserProfile(): void {
    this.authService.getProfileByUserOnly().subscribe({
      next: (res) => {
        if (res.success) {
          this.profiles2 = res.message;
        }
      },
      error: (err) => console.error('Error fetching profile:', err),
    });
  }

  loadUser() {
    this.authService.getProfileByBasicInfo().subscribe({
      next: (res) => this.profiles = res.data,
      error: (err) => console.error('Error fetching user:', err),
    });
  }
  onPlay() {
    this.isPlaying = true;
  }

  onVideoSelectedxx(videos: any) {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;
    dialogConfig.width = '600px';
    dialogConfig.data = videos;
    this.dialog.open(PostUploadVideosComponent, dialogConfig);
  }


  /** 🔹 Handle video selection */
  videoWarning: string = '';
  onVideoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const maxSizeMB = 50;
    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`Video too large. Max ${maxSizeMB}MB.`);
      input.value = '';
      return;
    }

    if (!file.type.startsWith('video/')) {
      alert('Please select a valid video file.');
      input.value = '';
      return;
    }

    this.selectedVideoFile = file;

    // Create preview URL
    const blobUrl = URL.createObjectURL(file);
    this.videoPreviewUrl = this.sanitizer.bypassSecurityTrustUrl(blobUrl);

    // Reset any old warning
    this.videoWarning = '';

    // 👉 Check video using your API
    this.sightService.checkVideos(file).subscribe(
      res => {

        if (res.summary.action === 'reject') {
          const reasons = res.summary.reject_reason
            .map((r: any) => r.text)
            .join(', ');

          this.videoWarning = `⚠️ Rejected! (${res.summary.reject_prob}) – ${reasons}`;
        } else {
          this.videoWarning = '';
        }
      },
      err => {
        console.error('Error checking video:', err);
        this.videoWarning = '⚠️ Error scanning video.';
      }
    );
  }

  // onVideoSelected(event: Event): void {
  //   const input = event.target as HTMLInputElement;
  //   const file = input.files?.[0];
  //   if (!file) return;

  //   const maxSizeMB = 50;
  //   if (file.size > maxSizeMB * 1024 * 1024) {
  //     alert(`Video too large. Max ${maxSizeMB}MB.`);
  //     input.value = '';
  //     return;
  //   }

  //   if (!file.type.startsWith('video/')) {
  //     alert('Please select a valid video file.');
  //     input.value = '';
  //     return;
  //   }

  //   this.selectedVideoFile = file;
  //   const blobUrl = URL.createObjectURL(file);
  //   this.videoPreviewUrl = this.sanitizer.bypassSecurityTrustUrl(blobUrl);

  //    this.sightService.checkImage(file).subscribe(
  //       res => {
  //         console.log('Sightengine response:', res);

  //         if (res.summary.action === 'reject') {
  //           const reasons = res.summary.reject_reason
  //             .map((r: any) => r.text)
  //             .join(', ');

  //           slide.warning = `⚠️ Rejected! (${res.summary.reject_prob}) – ${reasons}`;
  //         } else {
  //           slide.warning = '';
  //         }
  //       },
  //       err => console.error('Error checking image:', err)
  //     );

  // }


  onPause() {
    this.isPlaying = false;
    this.videoPaused = true;
  }
  /** 🔹 Upload image dialog */
  uploadImage(images: any) {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;
    dialogConfig.width = '600px';
    dialogConfig.data = images;
    this.dialog.open(PostUploadImageComponent, dialogConfig);
  }
  uploadImage2(images: any) {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;
    dialogConfig.width = '600px';
    dialogConfig.data = images;
    this.dialog.open(PostUploadImageComponent, dialogConfig);
  }

  postData() {
    if (this.isUploading) {
      return; // prevent duplicate submissions
    }
    if (!this.canPost) {
      this.alert.toastrWarning("Write something or attach an image or video.");
      return;
    }

    this.errorMessage = '';
    this.uploadPercent = 0;
    this.isUploading = true;

    const formData = new FormData();
    formData.append('caption', String(this.postForm.value.caption ?? '').trim());
    formData.append('status', this.postForm.value.status.toString());

    for (const file of this.uploadedImages) {
      formData.append('posts[]', file);
    }
    if (this.selectedVideoFile) {
      formData.append('video', this.selectedVideoFile);
    }

    const editing = this.isEdit;
    if (editing) {
      // saved images the user took off the post
      for (const id of this.removedAttachmentIds) {
        formData.append('remove_attachments[]', id);
      }
    }

    const request$ = editing
      ? this.imageUploadService.updatePost(formData, this.data.transNo)
      : this.imageUploadService.createPost(formData);

    request$.subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.uploadPercent = Math.round((100 * event.loaded) / event.total);
        } else if (event.type === HttpEventType.Response) {
          this.isUploading = false;
          const res: any = event.body;
          if (res?.success === true) {
            this.alert.toastrSuccess(res.message);
            this.resetForm();
            // the edited post travels back so the feed can swap it in without a refresh
            this.dialogRef.close(editing ? { post: res.post } : true);
          } else {
            this.errorMessage = res?.message || (editing
              ? 'The post could not be updated. Please try again.'
              : 'The post could not be saved. Please try again.');
          }
        }
      },
      error: (error) => this.onSaveError(error)
    });
  }

  private onSaveError(error: any): void {
    this.isUploading = false;
    this.uploadPercent = 0;
    // Laravel validation (422) returns a readable "message"; fall back to the first field error
    const fieldErrors = error?.error?.errors ? (Object.values(error.error.errors)[0] as string[])?.[0] : '';
    this.errorMessage = error?.error?.message || fieldErrors
      || (error?.status === 413 ? 'The upload is too large for the server.' : 'Upload failed. Please check your connection and try again.');
  }

  // ------------------------------------------------------------------
  //  image picker
  // ------------------------------------------------------------------
  onImagesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    this.imageErrors = [];

    for (const file of files) {
      if (this.totalImages >= this.maxImages) {
        this.imageErrors.push(`You can attach up to ${this.maxImages} images.`);
        break;
      }
      if (!this.allowedImageTypes.includes(file.type)) {
        this.imageErrors.push(`"${file.name}" is not supported. Use JPG, PNG, GIF or WEBP.`);
        continue;
      }
      if (file.size > this.maxImageMB * 1024 * 1024) {
        this.imageErrors.push(`"${file.name}" is larger than ${this.maxImageMB} MB.`);
        continue;
      }
      const url = URL.createObjectURL(file);
      this.previews.push({ file, url, safe: this.sanitizer.bypassSecurityTrustUrl(url) });
    }

    this.uploadedImages = this.previews.map(p => p.file);
    input.value = '';   // allow choosing the same file again after removing it
  }

  removeImage(index: number): void {
    const [removed] = this.previews.splice(index, 1);
    if (removed) { URL.revokeObjectURL(removed.url); }
    this.uploadedImages = this.previews.map(p => p.file);
    this.imageErrors = [];
    if (this.lightboxIndex !== null) { this.closePreview(); }
  }

  // ---------- enlarged preview (lightbox) ----------
  openPreview(index: number): void {
    this.lightboxIndex = index;
  }

  closePreview(): void {
    this.lightboxIndex = null;
  }

  stepPreview(delta: number): void {
    const count = this.gallery.length;
    if (this.lightboxIndex === null || !count) { return; }
    this.lightboxIndex = (this.lightboxIndex + delta + count) % count;
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (this.lightboxIndex === null) { return; }
    if (e.key === 'Escape') { this.closePreview(); e.stopPropagation(); }
    else if (e.key === 'ArrowRight') { this.stepPreview(1); }
    else if (e.key === 'ArrowLeft') { this.stepPreview(-1); }
  }

  /** Cancel: drop every selection and preview, then close. */
  cancel(): void {
    this.resetForm();
    this.closePreview();
    this.dialogRef.close(false);
  }

  /** Edit mode: detach one of the post's saved images (applied only when the user saves). */
  removeExistingImage(index: number): void {
    const [removed] = this.existingImages.splice(index, 1);
    if (removed) { this.removedAttachmentIds.push(removed.posts_uuind); }
    this.imageErrors = [];
    this.closePreview();
  }

  /** Edit mode: detach the post's saved video (applied only when the user saves). */
  removeExistingVideo(): void {
    if (this.existingVideo) { this.removedAttachmentIds.push(this.existingVideo.posts_uuind); }
    this.existingVideo = null;
    this.existingVideoSafe = null;
  }

  removeVideo(): void {
    this.selectedVideoFile = null;
    this.videoPreviewUrl = null;
    this.videoWarning = '';
  }

  ngOnDestroy(): void {
    this.photoSub?.unsubscribe();
    this.previews.forEach(p => URL.revokeObjectURL(p.url));
  }

  /** 🔹 Create or Update Post */
  postDataxx() {
    if (!this.postForm.valid) {
      this.alert.toastrWarning("Please fill in required fields.");
      return;
    }

    this.isUploading = true;
    const formData = new FormData();
    formData.append('caption', this.postForm.value.caption);
    formData.append('status', this.postForm.value.status.toString());

    this.uploadedImages.forEach((file) => formData.append('posts[]', file));
    if (this.selectedVideoFile) formData.append('video', this.selectedVideoFile);

    if (this.data?.id) {
      // ✅ UPDATE EXISTING POST
      this.http.post(`https://your-laravel-api.com/api/posts/update/${this.data.id}`, formData)
        .subscribe({
          next: (res: any) => {
            this.isUploading = false;
            if (res.success) {
              this.alert.toastrSuccess('Post updated successfully.');
              this.dialogRef.close(true);
            } else {
              this.alert.toastrWarning(res.message || 'Update failed.');
            }
          },
          error: (err) => {
            this.isUploading = false;
            console.error('Update failed:', err);
            this.alert.toastrWarning('Error updating post.');
          }
        });
    } else {
      // ✅ CREATE NEW POST
      this.http.post(`https://your-laravel-api.com/api/posts`, formData)
        .subscribe({
          next: (res: any) => {
            this.isUploading = false;
            if (res.success) {
              this.alert.toastrSuccess('Post created successfully.');
              this.resetForm();
              this.dialogRef.close(true);
            } else {
              this.alert.toastrWarning(res.message || 'Failed to create post.');
            }
          },
          error: (err) => {
            this.isUploading = false;
            console.error('Post failed:', err);
            this.alert.toastrWarning('Error posting content.');
          }
        });
    }
  }

  /** 🔹 Reset after success */
  resetForm() {
    this.postForm.reset();
    this.previews.forEach(p => URL.revokeObjectURL(p.url));
    this.previews = [];
    this.imageErrors = [];
    this.uploadedImages = [];
    this.selectedVideoFile = null;
    this.videoPreviewUrl = null;
    this.imagePreviewUrl = null;
    this.imageUploadService.clearImages();
  }

  /** 🔹 Utility functions */
  toggleVideo(video: HTMLVideoElement) {
    if (video.paused) {
      video.play();
      this.isPlaying = true;
      this.videoPaused = false;
    } else {
      video.pause();
      this.isPlaying = false;
      this.videoPaused = true;
    }
  }

  updateProgress2(video: HTMLVideoElement): void {
    if (!video) return;

    this.currentTime = video.currentTime || 0;

    if (video.duration && video.duration > 0) {
      this.progressValue = (video.currentTime / video.duration) * 100;
    } else {
      this.progressValue = 0;
    }
  }


  updateProgress(event: Event): void {
    const video = event.target as HTMLVideoElement;
    if (!video) return;

    this.currentTime = video.currentTime || 0;

    if (video.duration && video.duration > 0) {
      this.progressValue = (video.currentTime / video.duration) * 100;
    } else {
      this.progressValue = 0;
    }
  }


  seekVideo(video: HTMLVideoElement, event: any) {
    video.currentTime = event.target.value;
  }

  formatTime(seconds: number): string {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  toggleFullscreen(video: HTMLVideoElement) {
    if (video.requestFullscreen) video.requestFullscreen();
    else if ((video as any).webkitEnterFullscreen) (video as any).webkitEnterFullscreen();
  }

  closeDialog() {
    this.dialogRef.close();
  }

  getProfileImage(url: string): string {
    if (!url) return 'assets/default-profile.png';
    const match = url.match(/https?:\/\/[^\s]+/);
    return match ? match[0] : url;
  }

  getSelectedStatus() {
    return this.statusOptions.find(opt => opt.value === this.postForm.get('status')?.value)?.label;
  }
}
