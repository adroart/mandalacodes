import { Capacitor } from '../../mobile/node_modules/@capacitor/core';
import { Share } from '../../mobile/node_modules/@capacitor/share';
/** Existing profile actions use the Web Share API; bridge URL sharing on iOS. */
export function installNativeSharing() {
  if (!Capacitor.isNativePlatform()) return;
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: (data: ShareData) => !data.files?.length });
  Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: ShareData) => {
    if (data.files?.length) throw new Error('File sharing is not supported by this app.');
    await Share.share({ title: data.title, text: data.text, url: data.url, dialogTitle: 'Share Oracle' });
  } });
}
