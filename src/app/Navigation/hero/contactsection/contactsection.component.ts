import { Component, OnInit } from '@angular/core';
import { BusinessInfoService, PublicBusinessInfo } from 'src/app/ComponentUI/BusinessInfo/business-info.service';

const SOCIAL_ICONS: { [k: string]: { icon: string; label: string } } = {
  facebook: { icon: 'fab fa-facebook-f', label: 'Facebook' },
  instagram: { icon: 'fab fa-instagram', label: 'Instagram' },
  linkedin: { icon: 'fab fa-linkedin-in', label: 'LinkedIn' },
  youtube: { icon: 'fab fa-youtube', label: 'YouTube' },
  twitter: { icon: 'fab fa-twitter', label: 'X / Twitter' },
  tiktok: { icon: 'fab fa-tiktok', label: 'TikTok' },
};

@Component({
  selector: 'app-contactsection',
  templateUrl: './contactsection.component.html',
  styleUrls: ['./contactsection.component.css']
})
export class ContactsectionComponent implements OnInit {

  /** Saved business information from the API (null while loading or if it cannot be reached: the built-in text shows). */
  biz: PublicBusinessInfo | null = null;

  contactModel = { fullName: '', email: '', phone: '', subject: '', message: '' };
  isSubmitting = false;
  submitSuccess = false;
  submitError = '';

  constructor(private api: BusinessInfoService) { }

  ngOnInit(): void {
    this.api.getPublic().subscribe({ next: r => this.biz = r.data, error: () => this.biz = null });
  }

  get socials(): { href: string; icon: string; label: string }[] {
    const s = this.biz?.social || {};
    return Object.keys(SOCIAL_ICONS).filter(k => s[k]).map(k => ({ href: s[k], ...SOCIAL_ICONS[k] }));
  }

  get hasInfo(): boolean {
    const b = this.biz;
    return !!b && !!(b.address || b.phone_primary || b.phone_alt || b.email || b.operating_hours || this.socials.length || b.other_links?.length);
  }

  onContactSubmit(): void {
    this.isSubmitting = true;
    this.submitSuccess = false;
    this.submitError = '';
    this.api.sendContact(this.contactModel).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.submitSuccess = true;
        this.contactModel = { fullName: '', email: '', phone: '', subject: '', message: '' };
      },
      error: e => {
        this.isSubmitting = false;
        this.submitError = e?.status === 429 ? 'Too many messages. Please wait a minute and try again.' : BusinessInfoService.errorMessage(e, 'Your message could not be sent. Please try again.');
      }
    });
  }
}
