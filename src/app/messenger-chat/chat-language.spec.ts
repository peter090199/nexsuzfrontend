import { MessengerChatComponent } from './messenger-chat.component';

describe('Chat translation language', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.setItem('code', '7'); });
  afterEach(() => { localStorage.clear(); sessionStorage.removeItem('code'); });

  it('is remembered separately for each conversation, and for each signed-in person', () => {
    const chat: MessengerChatComponent = Object.create(MessengerChatComponent.prototype);
    const open = (id: number) => chat.selected = { user_id: id } as any;

    open(1); chat.chatLanguage = 'ja';
    open(2);
    expect(chat.chatLanguage).toBe('');
    chat.chatLanguage = 'ar';
    open(1);
    expect(chat.chatLanguage).toBe('ja');
    sessionStorage.setItem('code', '8');
    expect(chat.chatLanguage).toBe('');
  });
});
